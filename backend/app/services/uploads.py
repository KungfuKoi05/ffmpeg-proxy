"""Accepting a video file the user already has.

This is the escape hatch for everything YouTube can throw at you - bot checks,
region blocks, rate limits, a video that simply isn't on YouTube. The file
lands on disk, gets verified by ffprobe, and then enters the exact same
pipeline as a downloaded video.

Nothing here trusts the upload: not the filename, not the declared content
type, not the extension. The only thing that decides whether a file is a
usable video is ffprobe reading it.
"""
from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

from ..config import settings
from ..services import media
from ..utils.errors import UserFacingError
from ..utils.files import free_disk_mb, sanitize_filename
from ..utils.logging import get_logger

log = get_logger(__name__)

# Containers ffmpeg reads reliably. The extension only picks the output
# filename - acceptance is decided by ffprobe, below.
ALLOWED_EXTENSIONS = frozenset(
    {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".mpg", ".mpeg", ".wmv", ".flv", ".ts", ".mts"}
)
CHUNK = 1024 * 1024


@dataclass
class UploadedSource:
    path: Path
    title: str
    info: media.MediaInfo

    @property
    def duration(self) -> float:
        return self.info.duration


def _reject(code: str, message: str, hint: str = "") -> UserFacingError:
    return UserFacingError(code=code, message=message, hint=hint)


def safe_extension(filename: str | None) -> str:
    """Pick an extension we're willing to write, ignoring whatever was sent."""
    if not filename:
        return ".mp4"
    suffix = Path(sanitize_filename(filename, max_length=120)).suffix.lower()
    return suffix if suffix in ALLOWED_EXTENSIONS else ".mp4"


def display_title(filename: str | None) -> str:
    """A readable title from the filename, with nothing dangerous left in it."""
    if not filename:
        return "Uploaded video"
    stem = Path(str(filename)).stem
    cleaned = sanitize_filename(stem, fallback="Uploaded video", max_length=90)
    cleaned = cleaned.replace("_", " ").replace("-", " ").strip()
    cleaned = " ".join(cleaned.split())
    return cleaned[:200] or "Uploaded video"


def stream_to_disk(stream, dest: Path, *, max_bytes: int | None = None) -> int:
    """Write an upload to disk, stopping hard at the size limit.

    We never read the whole file into memory, and we never trust a
    Content-Length header - the cap is enforced on bytes actually written.
    """
    limit = max_bytes if max_bytes is not None else settings.max_upload_mb * 1024 * 1024
    dest.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    try:
        with dest.open("wb") as handle:
            while True:
                chunk = stream.read(CHUNK)
                if not chunk:
                    break
                written += len(chunk)
                if written > limit:
                    handle.close()
                    dest.unlink(missing_ok=True)
                    raise _reject(
                        "upload_too_large",
                        f"That file is larger than the {settings.max_upload_mb} MB limit.",
                        "Raise MAX_UPLOAD_MB in .env, or use a smaller file.",
                    )
                handle.write(chunk)
    except OSError as exc:
        dest.unlink(missing_ok=True)
        if getattr(exc, "errno", None) == 28:
            raise _reject(
                "disk_full",
                "This machine ran out of disk space while saving the file.",
                "Free up some space and try again.",
            ) from exc
        raise

    if written == 0:
        dest.unlink(missing_ok=True)
        raise _reject("upload_empty", "That file is empty.", "Pick a video file and try again.")

    return written


def verify(path: Path, *, filename: str | None = None) -> UploadedSource:
    """Confirm the file really is a usable video, and read its real properties."""
    try:
        info = media.probe(path)
    except Exception as exc:
        log.info("rejected upload %s: %s", path.name, exc)
        raise _reject(
            "upload_not_video",
            "We couldn't read that file as a video.",
            "Supported formats include MP4, MOV, MKV, WebM and AVI.",
        ) from exc

    if info.width <= 0 or info.height <= 0:
        raise _reject(
            "upload_not_video",
            "That file doesn't contain a video track.",
            "Audio-only files can't be turned into clips.",
        )

    if info.duration <= 0:
        raise _reject(
            "corrupt_media",
            "That file has no readable duration, so it may be damaged.",
            "Try re-exporting it, or use a different file.",
        )

    if info.duration < settings.min_video_duration:
        raise _reject(
            "video_too_short",
            f"That video is only {info.duration:.0f} seconds long - too short to cut into "
            f"{settings.min_clip_seconds:.0f}-{settings.max_clip_seconds:.0f} second clips.",
            f"Use a video longer than {settings.min_video_duration // 60} minutes.",
        )

    if info.duration > settings.max_video_duration:
        raise _reject(
            "video_too_long",
            f"That video is {info.duration / 60:.0f} minutes long, over the "
            f"{settings.max_video_duration // 60}-minute limit.",
            "Use a shorter video, or raise MAX_VIDEO_DURATION in .env.",
        )

    if not info.has_audio:
        log.info("upload %s has no audio track; clips will be silent", path.name)

    return UploadedSource(path=path, title=display_title(filename), info=info)


def check_disk_headroom() -> None:
    free = free_disk_mb(settings.temp_dir)
    if free < settings.min_free_disk_mb:
        raise _reject(
            "disk_full",
            f"Not enough free disk space to process a video ({free} MB free).",
            f"Free up at least {settings.min_free_disk_mb} MB and try again.",
        )


def move_into_job(staged: Path, job_scratch: Path) -> Path:
    """Move a verified upload into its job's scratch directory."""
    job_scratch.mkdir(parents=True, exist_ok=True)
    destination = job_scratch / f"source{staged.suffix.lower()}"
    try:
        staged.replace(destination)
    except OSError:
        # Different filesystems (a /tmp staging dir, say) need a real copy.
        shutil.move(str(staged), str(destination))
    return destination
