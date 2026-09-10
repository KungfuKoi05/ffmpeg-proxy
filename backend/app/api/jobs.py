"""Job endpoints: create, poll, list clips, download everything, delete."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Job, JobStatus
from ..schemas import ClipOut, JobCreate, JobCreated, JobOptions, JobOut, VideoOut, VideoPreview
from ..services import media, storage, uploads, youtube
from pydantic import ValidationError

from ..utils.errors import UserFacingError, to_user_error
from ..utils.files import format_timestamp
from ..utils.logging import get_logger
from ..utils.urls import InvalidYouTubeURL, parse_youtube_url
from ..workers.job_worker import job_manager
from .deps import (
    OWNER_COOKIE,
    attachment_response,
    check_owner,
    job_or_404,
    owner_token_from,
    resolve_media_path,
)
from .serializers import clip_to_out, job_to_out

log = get_logger(__name__)
router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _reject_unprocessable(metadata: youtube.VideoMetadata) -> None:
    if metadata.is_live:
        raise UserFacingError(
            code="video_is_live",
            message="This is a live stream, and we can only clip finished videos.",
            hint="Wait until the stream ends, then use the recording.",
        )
    if metadata.duration and metadata.duration > settings.max_video_duration:
        raise UserFacingError(
            code="video_too_long",
            message=(
                f"This video is {metadata.duration / 60:.0f} minutes long - longer than the "
                f"{settings.max_video_duration // 60}-minute limit."
            ),
            hint="Try a shorter video.",
        )
    if metadata.duration and metadata.duration < settings.min_video_duration:
        raise UserFacingError(
            code="video_too_short",
            message=(
                f"This video is only {format_timestamp(metadata.duration)} long - too short to "
                "cut into 30-60 second clips."
            ),
            hint=f"Try a video longer than {settings.min_video_duration // 60} minutes.",
        )


@router.post("/preview", response_model=VideoPreview, tags=["jobs"])
def preview_video(payload: dict, request: Request) -> VideoPreview:
    """Validate a URL and fetch metadata without starting any processing."""
    raw = str(payload.get("url", ""))
    try:
        video = parse_youtube_url(raw)
    except InvalidYouTubeURL as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        metadata = youtube.fetch_metadata(video)
    except Exception as exc:
        error = to_user_error(exc)
        raise HTTPException(status_code=422, detail=error.to_dict()) from exc

    can_process, reason = True, None
    try:
        _reject_unprocessable(metadata)
    except UserFacingError as exc:
        can_process, reason = False, exc.message

    return VideoPreview(
        video=VideoOut(
            video_id=metadata.video_id,
            title=metadata.title,
            channel=metadata.channel,
            duration=metadata.duration,
            duration_label=format_timestamp(metadata.duration) if metadata.duration else None,
            thumbnail_url=metadata.thumbnail_url,
            resolution=metadata.resolution_label,
            source_url=video.canonical_url,
        ),
        can_process=can_process,
        reason=reason,
    )


@router.post("", response_model=JobCreated, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: JobCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> JobCreated:
    media.require_ffmpeg()

    if not job_manager.has_capacity():
        raise HTTPException(
            status_code=429,
            detail={
                "code": "queue_full",
                "message": "Too many videos are being processed right now.",
                "hint": "Wait for the current jobs to finish, then try again.",
            },
        )

    try:
        video = parse_youtube_url(payload.url)
    except InvalidYouTubeURL as exc:
        raise HTTPException(status_code=422, detail={"code": "invalid_url", "message": str(exc)}) from exc

    # Fetch metadata up front so an unusable video fails in a second rather
    # than after a five-minute download.
    try:
        metadata = youtube.fetch_metadata(video)
        _reject_unprocessable(metadata)
    except UserFacingError as exc:
        raise HTTPException(status_code=422, detail=exc.to_dict()) from exc
    except Exception as exc:
        error = to_user_error(exc)
        log.info("could not start job for %s: %s", video.video_id, exc)
        raise HTTPException(status_code=422, detail=error.to_dict()) from exc

    token = owner_token_from(request) or uuid.uuid4().hex
    options = payload.options

    job = Job(
        owner_token=token,
        video_id=video.video_id,
        source_url=video.canonical_url,
        title=metadata.title,
        channel=metadata.channel,
        duration=metadata.duration,
        thumbnail_url=metadata.thumbnail_url,
        source_height=metadata.max_height,
        aspect_ratio=options.aspect_ratio,
        captions=int(options.captions),
        quality=options.quality,
        requested_clips=options.clip_count,
        min_clip_seconds=options.min_clip_seconds,
        max_clip_seconds=options.max_clip_seconds,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    job_manager.submit(job.id)

    response.set_cookie(
        OWNER_COOKIE,
        token,
        max_age=settings.job_ttl_hours * 3600,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return JobCreated(job=job_to_out(job, token=token), owner_token=token)


@router.post("/upload", response_model=JobCreated, status_code=status.HTTP_201_CREATED)
def create_job_from_upload(
    request: Request,
    response: Response,
    file: UploadFile = File(..., description="A video file to cut into clips"),
    aspect_ratio: str = Form("9:16"),
    captions: bool = Form(False),
    quality: str = Form("1080p"),
    clip_count: int | None = Form(None),
    min_clip_seconds: float = Form(settings.min_clip_seconds),
    max_clip_seconds: float = Form(settings.max_clip_seconds),
    db: Session = Depends(get_db),
) -> JobCreated:
    """Create a job from a video file the user already has.

    Everything after this point is identical to a YouTube job - same
    transcript, scoring, selection and rendering path. This route exists so
    the app is useful even when YouTube refuses to serve a download.
    """
    media.require_ffmpeg()
    uploads.check_disk_headroom()

    if not job_manager.has_capacity():
        raise HTTPException(
            status_code=429,
            detail={
                "code": "queue_full",
                "message": "Too many videos are being processed right now.",
                "hint": "Wait for the current jobs to finish, then try again.",
            },
        )

    # Validate the options through the same model the JSON route uses, so both
    # entry points enforce identical limits.
    try:
        options = JobOptions(
            aspect_ratio=aspect_ratio,
            captions=captions,
            quality=quality,
            clip_count=clip_count,
            min_clip_seconds=min_clip_seconds,
            max_clip_seconds=max_clip_seconds,
        )
    except ValidationError as exc:
        message = str(exc.errors()[0].get("msg", "Those settings aren't valid."))
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_request", "message": message.replace("Value error, ", "")},
        ) from exc

    staging = storage.staging_path(uploads.safe_extension(file.filename))
    try:
        uploads.stream_to_disk(file.file, staging)
        source = uploads.verify(staging, filename=file.filename)
    except UserFacingError as exc:
        staging.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=exc.to_dict()) from exc
    except Exception as exc:
        staging.unlink(missing_ok=True)
        error = to_user_error(exc)
        log.exception("upload failed: %s", exc)
        raise HTTPException(status_code=422, detail=error.to_dict()) from exc
    finally:
        file.file.close()

    token = owner_token_from(request) or uuid.uuid4().hex
    job = Job(
        owner_token=token,
        source_kind="upload",
        video_id=None,
        source_url="",
        title=source.title,
        channel=None,
        duration=source.duration,
        thumbnail_url=None,
        source_width=source.info.width,
        source_height=source.info.height,
        source_fps=source.info.fps,
        aspect_ratio=options.aspect_ratio,
        captions=int(options.captions),
        quality=options.quality,
        requested_clips=options.clip_count,
        min_clip_seconds=options.min_clip_seconds,
        max_clip_seconds=options.max_clip_seconds,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Only now that the job exists do we know where the file belongs.
    try:
        final_path = uploads.move_into_job(staging, storage.work_dir(job.id))
    except OSError as exc:
        db.delete(job)
        db.commit()
        staging.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail={"code": "upload_failed", "message": "We couldn't save that file.", "hint": ""},
        ) from exc

    job.source_path = str(final_path)
    db.commit()
    db.refresh(job)

    job_manager.submit(job.id)

    response.set_cookie(
        OWNER_COOKIE, token, max_age=settings.job_ttl_hours * 3600,
        httponly=True, samesite="lax", path="/",
    )
    return JobCreated(job=job_to_out(job, token=token), owner_token=token)


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, request: Request, db: Session = Depends(get_db)) -> JobOut:
    job = job_or_404(db, job_id, request)
    return job_to_out(job, token=job.owner_token)


@router.get("/{job_id}/clips", response_model=list[ClipOut])
def get_job_clips(job_id: str, request: Request, db: Session = Depends(get_db)) -> list[ClipOut]:
    job = job_or_404(db, job_id, request)
    return [clip_to_out(clip, token=job.owner_token) for clip in job.clips]


@router.post("/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: str, request: Request, db: Session = Depends(get_db)) -> JobOut:
    job = job_or_404(db, job_id, request)
    if JobStatus(job.status).is_terminal:
        raise HTTPException(status_code=409, detail="This job has already finished.")
    job_manager.cancel(job_id)
    db.refresh(job)
    return job_to_out(job, token=job.owner_token)


@router.get("/{job_id}/download-all")
def download_all(job_id: str, request: Request, db: Session = Depends(get_db)):
    job = job_or_404(db, job_id, request)
    if job.status != JobStatus.COMPLETED.value or not job.clips:
        raise HTTPException(status_code=409, detail="This job has no clips to download yet.")

    entries: list[tuple] = []
    for clip in job.clips:
        path = resolve_media_path(clip.file_path, kind="clip")
        entries.append((path, storage.download_filename(job.title, clip.index)))
        if clip.subtitle_path:
            try:
                subtitle = resolve_media_path(clip.subtitle_path, kind="subtitle")
            except HTTPException:
                continue
            entries.append(
                (subtitle, storage.download_filename(job.title, clip.index, suffix=".srt"))
            )

    archive = storage.build_zip(job_id, entries)
    filename = storage.download_filename(job.title, 0).replace("-clip-00", "-clips")
    return attachment_response(archive, filename.replace(".mp4", ".zip"), media_type="application/zip")


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: str, request: Request, db: Session = Depends(get_db)) -> Response:
    job = job_or_404(db, job_id, request)
    job_manager.cancel(job_id)
    storage.delete_job_files(job_id)
    db.delete(job)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
