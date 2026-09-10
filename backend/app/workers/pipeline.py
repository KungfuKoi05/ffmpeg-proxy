"""The whole job, start to finish.

    download -> transcript -> audio analysis -> candidates -> scores ->
    selection -> boundary snapping -> render -> thumbnails -> cleanup

Progress percentages below are the real cost of each stage, measured from
byte counts and ffmpeg's own reporting - nothing is on a timer.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from ..analyzers import candidate_generator, clip_selector, llm_ranker, titles
from ..analyzers.candidate_scorer import ScoringContext, score_candidates
from ..analyzers.types import Candidate, SceneAnalysis, Transcript
from ..config import settings
from ..database import session_scope
from ..models import Clip, Job, JobStatus
from ..services import media, storage, transcript as transcript_service, youtube
from ..utils.errors import UserFacingError, to_user_error
from ..utils.logging import get_logger
from ..utils.urls import ParsedVideo
from ..render.renderer import ClipRenderer, RenderRequest
from .progress import ProgressReporter

log = get_logger(__name__)

# Stage boundaries on the 0-100 bar.
P_DOWNLOAD = (2.0, 40.0)
P_TRANSCRIPT = (40.0, 58.0)
P_SCENE = (58.0, 64.0)
P_SELECT = (64.0, 70.0)
P_RENDER = (70.0, 97.0)


class JobCancelled(Exception):
    pass


@dataclass
class PipelineOutcome:
    clip_count: int
    transcript_source: str
    analysis: dict


def _max_height_for(quality: str, source_max: int | None) -> int:
    ceiling = {"1080p": 1080, "720p": 720, "highest": 4320}.get(quality, 1080)
    if source_max:
        return min(ceiling, source_max)
    return ceiling


def _check_cancelled(reporter: ProgressReporter) -> None:
    if reporter.cancelled:
        raise JobCancelled()


def run_job(job_id: str, reporter: ProgressReporter | None = None) -> None:
    """Entry point for the worker pool. Never raises - failures land in the DB."""
    reporter = reporter or ProgressReporter(job_id)
    try:
        outcome = _execute(job_id, reporter)
    except JobCancelled:
        _mark_cancelled(job_id)
        return
    except BaseException as exc:  # noqa: BLE001 - we translate everything
        user_error = to_user_error(exc)
        log.exception("job %s failed: %s", job_id, exc)
        _mark_failed(job_id, user_error)
        storage.cleanup_work_dir(job_id)
        return

    _mark_completed(job_id, outcome)


def _execute(job_id: str, reporter: ProgressReporter) -> PipelineOutcome:
    media.require_ffmpeg()

    ok, free_mb = storage.has_enough_disk()
    if not ok:
        raise UserFacingError(
            code="disk_full",
            message=f"Not enough free disk space to process this video ({free_mb} MB free).",
            hint=f"Free up at least {settings.min_free_disk_mb} MB and try again.",
        )

    with session_scope() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise UserFacingError(code="job_missing", message="This job no longer exists.")
        video = ParsedVideo(job.video_id)
        options = {
            "aspect": job.aspect_ratio,
            "captions": bool(job.captions),
            "quality": job.quality,
            "requested_clips": job.requested_clips,
            "title": job.title,
            "source_max_height": job.source_height,
        }
        job.started_at = datetime.now(timezone.utc)
        job.status = JobStatus.DOWNLOADING.value

    clips_out, scratch = storage.prepare_job_dirs(job_id)

    # ---------------------------------------------------------------- download
    reporter.set_stage(JobStatus.DOWNLOADING)
    _check_cancelled(reporter)

    def download_progress(fraction: float, message: str) -> None:
        if reporter.cancelled:
            raise JobCancelled()
        reporter.stage_progress(
            low=P_DOWNLOAD[0], high=P_DOWNLOAD[1], fraction=fraction, message=message
        )

    result = youtube.download_video(
        video,
        scratch,
        max_height=_max_height_for(options["quality"], options["source_max_height"]),
        want_subtitles=True,
        on_progress=download_progress,
    )
    source_path = result.video_path
    info = media.probe(source_path)

    if info.duration <= 0:
        raise UserFacingError(
            code="corrupt_media",
            message="The downloaded file has no readable duration.",
            hint="Try again - a re-download usually fixes this.",
        )
    if info.duration > settings.max_video_duration:
        raise UserFacingError(
            code="video_too_long",
            message=(
                f"This video is {info.duration / 60:.0f} minutes long, which is over the "
                f"{settings.max_video_duration // 60}-minute limit."
            ),
            hint="Try a shorter video.",
        )

    with session_scope() as session:
        job = session.get(Job, job_id)
        if job:
            job.source_path = str(source_path)
            job.source_width = info.width
            job.source_height = info.height
            job.source_fps = info.fps
            job.duration = info.duration

    # -------------------------------------------------------------- transcript
    reporter.set_stage(JobStatus.ANALYZING, "Retrieving transcript…")
    _check_cancelled(reporter)

    def transcript_progress(fraction: float, message: str) -> None:
        if reporter.cancelled:
            raise JobCancelled()
        reporter.stage_progress(
            low=P_TRANSCRIPT[0], high=P_TRANSCRIPT[1], fraction=fraction, message=message
        )

    transcript = transcript_service.build_transcript(
        source_path,
        result.subtitle_paths,
        duration=info.duration,
        on_progress=transcript_progress,
    )
    log.info(
        "job %s transcript: source=%s segments=%d",
        job_id, transcript.source, len(transcript.segments),
    )

    # ------------------------------------------------------------ audio scene
    reporter.update(progress=P_SCENE[0], message="Analyzing video…")
    _check_cancelled(reporter)
    scene: SceneAnalysis = media.analyze_scene(source_path, info.duration)
    reporter.update(progress=P_SCENE[1], message="Analyzing video…")

    # ----------------------------------------------------------- clip choice
    reporter.set_stage(JobStatus.SELECTING_CLIPS)
    _check_cancelled(reporter)

    selected, selection_method = _choose_clips(
        transcript=transcript,
        scene=scene,
        duration=info.duration,
        requested_clips=options["requested_clips"],
        reporter=reporter,
    )

    if not selected:
        raise UserFacingError(
            code="no_clips_found",
            message="We couldn't find any self-contained sections long enough to clip.",
            hint="This usually means the video is very short or has almost no speech.",
        )

    clip_titles = titles.titles_for(selected)

    # --------------------------------------------------------------- render
    reporter.set_stage(JobStatus.PROCESSING)
    renderer = ClipRenderer()
    total = len(selected)
    rendered_rows: list[dict] = []

    for position, candidate in enumerate(selected):
        _check_cancelled(reporter)
        index = position + 1
        dest = storage.clip_path(job_id, index)

        def clip_progress(fraction: float, _pos: int = position) -> None:
            if reporter.cancelled:
                raise JobCancelled()
            overall = (_pos + fraction) / total
            reporter.stage_progress(
                low=P_RENDER[0], high=P_RENDER[1], fraction=overall,
                message=f"Creating clips… ({_pos + 1} of {total})",
            )

        render_result = renderer.render(
            RenderRequest(
                source=source_path,
                dest=dest,
                start=candidate.start,
                end=candidate.end,
                aspect=options["aspect"],
                burn_captions=options["captions"],
                quality=options["quality"],
                words=transcript.words if transcript.available else None,
                work_dir=scratch,
            ),
            on_progress=clip_progress,
        )

        rendered_rows.append(
            {
                "index": index,
                "title": clip_titles[position],
                "start": candidate.start,
                "end": candidate.end,
                "duration": render_result.duration,
                "width": render_result.width,
                "height": render_result.height,
                "filesize": render_result.filesize,
                "has_captions": int(render_result.has_captions),
                "file_path": str(render_result.path),
                "thumbnail_path": str(render_result.thumbnail_path) if render_result.thumbnail_path else None,
                "subtitle_path": str(render_result.subtitle_path) if render_result.subtitle_path else None,
                "score": candidate.score,
                "score_breakdown": candidate.breakdown,
                "transcript_text": candidate.text[:4000] or None,
                "selected_by": selection_method,
            }
        )

    # ------------------------------------------------------------- persist
    reporter.update(progress=97.5, message="Finalizing exports…")
    with session_scope() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise JobCancelled()
        for row in rendered_rows:
            session.add(Clip(job_id=job_id, **row))

    # Source media is large and no longer needed - remove it now, not on a timer.
    storage.cleanup_work_dir(job_id)
    reporter.update(progress=99.0, message="Finalizing exports…")

    analysis = {
        "transcript_source": transcript.source,
        "segments": len(transcript.segments),
        "silences_detected": len(scene.silences),
        "selection_method": selection_method,
        "source_resolution": f"{info.width}x{info.height}",
        "source_fps": info.fps,
    }
    return PipelineOutcome(
        clip_count=len(rendered_rows),
        transcript_source=transcript.source,
        analysis=analysis,
    )


def _choose_clips(
    *,
    transcript: Transcript,
    scene: SceneAnalysis,
    duration: float,
    requested_clips: int | None,
    reporter: ProgressReporter,
) -> tuple[list[Candidate], str]:
    target = clip_selector.target_clip_count(duration, requested_clips)

    if transcript.available:
        reporter.stage_progress(
            low=P_SELECT[0], high=P_SELECT[1], fraction=0.15,
            message="Finding interesting moments…",
        )
        candidates = candidate_generator.generate_candidates(transcript)
        if candidates:
            ctx = ScoringContext(transcript=transcript, scene=scene, video_duration=duration)
            candidates = score_candidates(candidates, ctx)
            candidates.sort(key=lambda c: c.score, reverse=True)
            reporter.stage_progress(
                low=P_SELECT[0], high=P_SELECT[1], fraction=0.6,
                message="Finding interesting moments…",
            )

            method = "heuristic"
            selected = clip_selector.select_clips(
                candidates, video_duration=duration, target_count=target
            )

            if llm_ranker.is_enabled() and selected:
                reporter.update(message="Asking the model to rank the best moments…")
                picks = llm_ranker.rerank(candidates[:llm_ranker.MAX_CANDIDATES_SENT], want=target)
                if picks:
                    # Re-run overlap/diversity filtering over the model's picks,
                    # so a bad set can never produce overlapping clips.
                    validated = clip_selector.select_clips(
                        [p.candidate for p in picks],
                        video_duration=duration,
                        target_count=target,
                    )
                    if validated:
                        selected = validated
                        method = "llm"

            selected = clip_selector.snap_to_silence(
                selected, scene, transcript, video_duration=duration
            )
            reporter.stage_progress(
                low=P_SELECT[0], high=P_SELECT[1], fraction=1.0,
                message="Finding interesting moments…",
            )
            return selected, method

    # No transcript at all: fall back to silence-aligned segmentation.
    log.info("no transcript available; using audio-only segmentation")
    reporter.update(message="No transcript available - using audio analysis…")
    fallback = candidate_generator.generate_fallback_candidates(
        duration, silences=[(s.start, s.end) for s in scene.silences]
    )
    ctx = ScoringContext(transcript=transcript, scene=scene, video_duration=duration)
    fallback = score_candidates(fallback, ctx)
    # Without text, speech coverage is the only real quality signal we have.
    for cand in fallback:
        cand.score = round(scene.speech_ratio(cand.start, cand.end), 4)
    fallback.sort(key=lambda c: c.score, reverse=True)
    selected = clip_selector.select_clips(
        fallback, video_duration=duration, target_count=target
    )
    selected = clip_selector.snap_to_silence(selected, scene, transcript, video_duration=duration)
    return selected, "audio_only"


# --------------------------------------------------------------------------
# Terminal states
# --------------------------------------------------------------------------
def _mark_completed(job_id: str, outcome: PipelineOutcome) -> None:
    with session_scope() as session:
        job = session.get(Job, job_id)
        if job is None:
            return
        job.status = JobStatus.COMPLETED.value
        job.stage_message = f"Created {outcome.clip_count} clips"
        job.progress = 100.0
        job.transcript_source = outcome.transcript_source
        job.analysis = outcome.analysis
        job.completed_at = datetime.now(timezone.utc)
        job.source_deleted = 1


def _mark_failed(job_id: str, error: UserFacingError) -> None:
    try:
        with session_scope() as session:
            job = session.get(Job, job_id)
            if job is None:
                return
            job.status = JobStatus.FAILED.value
            job.stage_message = "Failed"
            job.error_code = error.code
            job.error_message = error.message
            job.error_hint = error.hint or None
            job.completed_at = datetime.now(timezone.utc)
            job.source_deleted = 1
    except Exception:  # pragma: no cover - database is already unhappy
        log.exception("could not record failure for job %s", job_id)


def _mark_cancelled(job_id: str) -> None:
    with session_scope() as session:
        job = session.get(Job, job_id)
        if job is None:
            return
        job.status = JobStatus.CANCELLED.value
        job.stage_message = "Cancelled"
        job.completed_at = datetime.now(timezone.utc)
    storage.cleanup_work_dir(job_id)
