"""Retention: finished jobs and their files do not live forever."""
from __future__ import annotations

import threading
from datetime import datetime, timezone

from ..config import settings
from ..database import session_scope
from ..models import Job, JobStatus
from ..services import storage
from ..utils.logging import get_logger

log = get_logger(__name__)

SWEEP_INTERVAL_SECONDS = 600


def expire_old_jobs() -> int:
    """Mark jobs past their TTL as expired and delete their files."""
    now = datetime.now(timezone.utc)
    expired_ids: list[str] = []

    with session_scope() as session:
        jobs = session.query(Job).filter(Job.status != JobStatus.EXPIRED.value).all()
        for job in jobs:
            expires = job.expires_at
            if expires is None:
                continue
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if now > expires:
                job.status = JobStatus.EXPIRED.value
                job.stage_message = "Expired"
                job.progress = 100.0
                expired_ids.append(job.id)

    if expired_ids:
        storage.sweep_expired(expired_ids)
        log.info("expired %d job(s) and removed their files", len(expired_ids))
    return len(expired_ids)


def remove_orphan_directories() -> int:
    """Delete job folders with no matching database row (crash leftovers)."""
    with session_scope() as session:
        known = {row[0] for row in session.query(Job.id).all()}
    live = {
        row_id
        for row_id in known
    }
    return storage.sweep_orphans(live)


def sweep() -> dict:
    expired = expire_old_jobs()
    orphans = remove_orphan_directories()
    return {"expired": expired, "orphans_removed": orphans}


class CleanupScheduler:
    """Runs the sweep on a daemon thread, and once at startup."""

    def __init__(self, interval: int = SWEEP_INTERVAL_SECONDS) -> None:
        self.interval = interval
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name="clipgen-cleanup", daemon=True)
        self._thread.start()
        log.info("cleanup scheduler started (every %ds, TTL %dh)", self.interval, settings.job_ttl_hours)

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                sweep()
            except Exception as exc:  # a failed sweep must not kill the thread
                log.warning("cleanup sweep failed: %s", exc)
            self._stop.wait(self.interval)


cleanup_scheduler = CleanupScheduler()
