"""Job file layout, retention and packaging.

Layout, one directory per job:

    storage/jobs/<job_id>/
        clips/clip_01.mp4      finished output (kept until the job expires)
        clips/clip_01.jpg      poster frame
        clips/clip_01.srt      subtitle sidecar, when a transcript existed
        clips.zip              built on demand for "Download All"
    temp/<job_id>/
        source.mp4             deleted as soon as rendering finishes
        source.en.json3        subtitle track from YouTube

Nothing outside these roots is ever read or written: every path goes through
safe_join, which refuses to escape its root.
"""
from __future__ import annotations

import zipfile
from datetime import datetime, timezone
from pathlib import Path

from ..config import settings
from ..utils.files import free_disk_mb, remove_tree, safe_join, sanitize_filename
from ..utils.logging import get_logger

log = get_logger(__name__)

VIDEO_ID_SAFE = 32


def job_dir(job_id: str) -> Path:
    return safe_join(settings.output_dir, sanitize_filename(job_id, max_length=VIDEO_ID_SAFE))


def clips_dir(job_id: str) -> Path:
    return safe_join(job_dir(job_id), "clips")


def work_dir(job_id: str) -> Path:
    return safe_join(settings.temp_dir, sanitize_filename(job_id, max_length=VIDEO_ID_SAFE))


def prepare_job_dirs(job_id: str) -> tuple[Path, Path]:
    output = clips_dir(job_id)
    scratch = work_dir(job_id)
    output.mkdir(parents=True, exist_ok=True)
    scratch.mkdir(parents=True, exist_ok=True)
    return output, scratch


def clip_path(job_id: str, index: int) -> Path:
    return safe_join(clips_dir(job_id), f"clip_{index:02d}.mp4")


def zip_path(job_id: str) -> Path:
    return safe_join(job_dir(job_id), "clips.zip")


def staging_dir() -> Path:
    """Where an upload lands before we know whether we'll accept it."""
    path = safe_join(settings.temp_dir, "_staging")
    path.mkdir(parents=True, exist_ok=True)
    return path


def staging_path(suffix: str = ".mp4") -> Path:
    import uuid

    return staging_dir() / f"{uuid.uuid4().hex}{suffix}"


def cleanup_work_dir(job_id: str) -> None:
    """Delete the downloaded source once every clip has been rendered."""
    try:
        remove_tree(work_dir(job_id))
    except ValueError:  # pragma: no cover - would mean a poisoned job id
        log.warning("refused to clean a path outside the temp root for job %s", job_id)


def delete_job_files(job_id: str) -> None:
    for path in (job_dir(job_id), work_dir(job_id)):
        try:
            remove_tree(path)
        except ValueError:
            log.warning("refused to delete a path outside our roots for job %s", job_id)


def download_filename(title: str | None, index: int, *, suffix: str = ".mp4") -> str:
    """A friendly, safe filename for the browser's Save dialog."""
    base = sanitize_filename(title or "clip", fallback="clip", max_length=60)
    return f"{base}-clip-{index:02d}{suffix}"


def build_zip(job_id: str, files: list[tuple[Path, str]], *, rebuild: bool = False) -> Path:
    """Package clips for Download All. Cached until the job changes."""
    destination = zip_path(job_id)
    if destination.exists() and not rebuild:
        return destination

    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp = destination.with_suffix(".zip.part")
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_STORED) as archive:
        # ZIP_STORED: MP4 is already compressed, so deflate burns CPU for ~0%.
        for source, arcname in files:
            if source.exists():
                archive.write(source, arcname=sanitize_filename(arcname, max_length=120))
    tmp.replace(destination)
    return destination


def has_enough_disk() -> tuple[bool, int]:
    free = free_disk_mb(settings.temp_dir)
    return free >= settings.min_free_disk_mb, free


def sweep_expired(expired_job_ids: list[str]) -> int:
    removed = 0
    for job_id in expired_job_ids:
        delete_job_files(job_id)
        removed += 1
    return removed


def sweep_orphans(known_job_ids: set[str]) -> int:
    """Delete directories left behind by a crash or a wiped database."""
    removed = 0
    for root in (settings.output_dir, settings.temp_dir):
        if not root.exists():
            continue
        for entry in root.iterdir():
            if entry.name.startswith('_'):
                continue
            if entry.is_dir() and entry.name not in known_job_ids:
                remove_tree(entry)
                removed += 1
                log.info("removed orphaned job directory %s", entry.name)
    return removed


def storage_report() -> dict:
    def size(path: Path) -> int:
        return sum(f.stat().st_size for f in path.rglob("*") if f.is_file()) if path.exists() else 0

    return {
        "output_bytes": size(settings.output_dir),
        "temp_bytes": size(settings.temp_dir),
        "free_disk_mb": free_disk_mb(settings.output_dir),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
