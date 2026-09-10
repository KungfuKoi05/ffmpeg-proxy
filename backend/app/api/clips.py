"""Clip endpoints: metadata, in-browser preview, download, subtitles."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ClipOut
from ..services import storage
from .deps import attachment_response, clip_or_404, range_response, resolve_media_path
from .serializers import clip_to_out

router = APIRouter(prefix="/api/clips", tags=["clips"])


@router.get("/{clip_id}", response_model=ClipOut)
def get_clip(clip_id: str, request: Request, db: Session = Depends(get_db)) -> ClipOut:
    clip, job = clip_or_404(db, clip_id, request)
    return clip_to_out(clip, token=job.owner_token)


@router.get("/{clip_id}/stream")
def stream_clip(clip_id: str, request: Request, db: Session = Depends(get_db)):
    """Range-aware playback so the browser's scrubber works."""
    clip, _job = clip_or_404(db, clip_id, request)
    path = resolve_media_path(clip.file_path, kind="clip")
    return range_response(path, request, media_type="video/mp4")


@router.get("/{clip_id}/download")
def download_clip(clip_id: str, request: Request, db: Session = Depends(get_db)):
    clip, job = clip_or_404(db, clip_id, request)
    path = resolve_media_path(clip.file_path, kind="clip")
    return attachment_response(
        path, storage.download_filename(job.title, clip.index), media_type="video/mp4"
    )


@router.get("/{clip_id}/thumbnail")
def clip_thumbnail(clip_id: str, request: Request, db: Session = Depends(get_db)):
    clip, _job = clip_or_404(db, clip_id, request)
    path = resolve_media_path(clip.thumbnail_path, kind="thumbnail")
    return range_response(path, request, media_type="image/jpeg")


@router.get("/{clip_id}/subtitles")
def clip_subtitles(clip_id: str, request: Request, db: Session = Depends(get_db)):
    clip, job = clip_or_404(db, clip_id, request)
    path = resolve_media_path(clip.subtitle_path, kind="subtitle file")
    return attachment_response(
        path,
        storage.download_filename(job.title, clip.index, suffix=".srt"),
        media_type="application/x-subrip",
    )
