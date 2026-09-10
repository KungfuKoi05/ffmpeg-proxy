"""Health and capability reporting.

The UI calls this on load so it can tell the user exactly what is missing
instead of failing halfway through a job.
"""
from __future__ import annotations

import shutil
import sys

from fastapi import APIRouter

from ..config import settings
from ..render.captions import available_styles
from ..schemas import DependencyStatus, SystemStatus
from ..services import media, storage, transcript, youtube

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/status", response_model=SystemStatus)
def system_status() -> SystemStatus:
    ffmpeg_ok = media.ffmpeg_available()
    ffprobe_ok = media.ffprobe_available()
    ytdlp_version = youtube.ytdlp_version()
    whisper_ok = transcript.whisper_available()

    dependencies = [
        DependencyStatus(
            name="ffmpeg",
            available=ffmpeg_ok,
            version=media.ffmpeg_version(),
            required=True,
            install_hint=None if ffmpeg_ok else
            "macOS: brew install ffmpeg | Ubuntu: sudo apt install ffmpeg | Windows: winget install Gyan.FFmpeg",
        ),
        DependencyStatus(
            name="ffprobe",
            available=ffprobe_ok,
            version=None,
            required=True,
            install_hint=None if ffprobe_ok else "Ships with FFmpeg - install FFmpeg.",
        ),
        DependencyStatus(
            name="yt-dlp",
            available=ytdlp_version is not None,
            version=ytdlp_version,
            required=True,
            install_hint=None if ytdlp_version else "pip install -r backend/requirements.txt",
        ),
        DependencyStatus(
            name="faster-whisper",
            available=whisper_ok,
            version=None,
            required=False,
            install_hint=None if whisper_ok else
            "Optional. Enables clip detection for videos with no captions: "
            "pip install -r backend/requirements-whisper.txt",
        ),
    ]

    return SystemStatus(
        ready=all(d.available for d in dependencies if d.required),
        dependencies=dependencies,
        limits={
            "max_video_duration": settings.max_video_duration,
            "min_video_duration": settings.min_video_duration,
            "min_clip_seconds": settings.min_clip_seconds,
            "max_clip_seconds": settings.max_clip_seconds,
            "min_clips": settings.min_clips,
            "max_clips": settings.max_clips,
            "max_concurrent_jobs": settings.max_concurrent_jobs,
            "job_ttl_hours": settings.job_ttl_hours,
        },
        features={
            "whisper_fallback": whisper_ok and settings.whisper_enabled,
            "llm_ranking": settings.llm_ranking_enabled and settings.llm_available,
            "hardware_encoder": media.detect_hardware_encoder(),
            "caption_styles": available_styles(),
            "python": sys.version.split()[0],
        },
        storage=storage.storage_report(),
    )


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok" if shutil.which("ffmpeg") else "degraded",
        "ffmpeg": media.ffmpeg_available(),
    }
