"""Model -> API payload conversion, in one place."""
from __future__ import annotations

from ..models import STAGE_LABELS, Clip, Job, JobStatus
from ..schemas import ClipOut, JobError, JobOptions, JobOut, VideoOut
from ..utils.files import format_timestamp


def clip_to_out(clip: Clip, *, token: str | None = None) -> ClipOut:
    query = f"?t={token}" if token else ""
    return ClipOut(
        id=clip.id,
        job_id=clip.job_id,
        index=clip.index,
        title=clip.title or f"Clip {clip.index:02d}",
        start=round(clip.start, 2),
        end=round(clip.end, 2),
        start_label=format_timestamp(clip.start),
        end_label=format_timestamp(clip.end),
        duration=round(clip.duration, 2),
        duration_label=format_timestamp(clip.duration),
        width=clip.width,
        height=clip.height,
        resolution=clip.resolution_label,
        filesize=clip.filesize,
        has_captions=bool(clip.has_captions),
        score=round(clip.score, 3),
        score_breakdown=clip.score_breakdown,
        selected_by=clip.selected_by,
        transcript_excerpt=(clip.transcript_text[:400] if clip.transcript_text else None),
        preview_url=f"/api/clips/{clip.id}/stream{query}",
        download_url=f"/api/clips/{clip.id}/download{query}",
        thumbnail_url=f"/api/clips/{clip.id}/thumbnail{query}" if clip.thumbnail_path else None,
        subtitle_url=f"/api/clips/{clip.id}/subtitles{query}" if clip.subtitle_path else None,
    )


def job_to_out(job: Job, *, token: str | None = None) -> JobOut:
    query = f"?t={token}" if token else ""
    error = None
    if job.error_message:
        error = JobError(
            code=job.error_code or "processing_failed",
            message=job.error_message,
            hint=job.error_hint,
        )

    completed = job.status == JobStatus.COMPLETED.value
    clip_count = len(job.clips)

    return JobOut(
        id=job.id,
        status=job.status,
        stage=job.stage_message or STAGE_LABELS.get(job.status, job.status),
        progress=round(job.progress, 1),
        created_at=job.created_at,
        completed_at=job.completed_at,
        expires_at=job.expires_at,
        video=VideoOut(
            video_id=job.video_id,
            title=job.title,
            channel=job.channel,
            duration=job.duration,
            duration_label=format_timestamp(job.duration) if job.duration else None,
            thumbnail_url=job.thumbnail_url,
            resolution=f"{job.source_height}p" if job.source_height else None,
            source_url=job.source_url,
        ),
        options=JobOptions(
            aspect_ratio=job.aspect_ratio,
            captions=bool(job.captions),
            quality=job.quality,
            clip_count=job.requested_clips,
            min_clip_seconds=job.min_clip_seconds,
            max_clip_seconds=job.max_clip_seconds,
        ),
        clip_count=clip_count,
        transcript_source=job.transcript_source,
        analysis=job.analysis,
        error=error,
        download_all_url=(
            f"/api/jobs/{job.id}/download-all{query}" if completed and clip_count else None
        ),
    )
