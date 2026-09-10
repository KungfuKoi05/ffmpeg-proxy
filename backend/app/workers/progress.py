"""Progress reporting that writes through to the database, without hammering it."""
from __future__ import annotations

import threading
import time

from ..database import session_scope
from ..models import STAGE_LABELS, Job, JobStatus
from ..utils.logging import get_logger

log = get_logger(__name__)

MIN_WRITE_INTERVAL = 0.4   # seconds
MIN_PROGRESS_DELTA = 0.5   # percentage points


class ProgressReporter:
    """One per running job. Thread-safe: ffmpeg callbacks arrive from Popen readers."""

    def __init__(self, job_id: str) -> None:
        self.job_id = job_id
        self._lock = threading.Lock()
        self._last_write = 0.0
        self._last_progress = -1.0
        self._last_status = ""
        self._last_message = ""
        self._cancelled = False

    # -- public API -------------------------------------------------------
    def set_stage(self, status: JobStatus, message: str | None = None) -> None:
        self.update(
            status=status,
            message=message or STAGE_LABELS.get(status.value, status.value),
            force=True,
        )

    def update(
        self,
        *,
        status: JobStatus | None = None,
        message: str | None = None,
        progress: float | None = None,
        force: bool = False,
    ) -> None:
        now = time.monotonic()
        with self._lock:
            status_value = status.value if status else self._last_status
            changed_stage = bool(status and status.value != self._last_status)
            changed_message = bool(message and message != self._last_message)
            changed_progress = (
                progress is not None and abs(progress - self._last_progress) >= MIN_PROGRESS_DELTA
            )
            recent = (now - self._last_write) < MIN_WRITE_INTERVAL

            if not force and not changed_stage and not changed_message and not changed_progress:
                return
            if not force and recent and not changed_stage and not changed_message:
                return

            self._last_write = now
            if status:
                self._last_status = status_value
            if message:
                self._last_message = message
            if progress is not None:
                self._last_progress = progress

            payload_status = status_value or None
            payload_message = message
            payload_progress = progress

        try:
            with session_scope() as session:
                job = session.get(Job, self.job_id)
                if job is None:
                    return
                if payload_status:
                    job.status = payload_status
                if payload_message:
                    job.stage_message = payload_message[:200]
                if payload_progress is not None:
                    job.progress = round(max(0.0, min(100.0, payload_progress)), 2)
        except Exception as exc:  # never let progress reporting kill a job
            log.debug("progress write failed for %s: %s", self.job_id, exc)

    def stage_progress(
        self, *, low: float, high: float, fraction: float, message: str | None = None
    ) -> None:
        """Map a 0..1 fraction within one stage onto the overall 0..100 bar."""
        fraction = max(0.0, min(1.0, fraction))
        self.update(progress=low + (high - low) * fraction, message=message)

    def cancel(self) -> None:
        with self._lock:
            self._cancelled = True

    @property
    def cancelled(self) -> bool:
        with self._lock:
            return self._cancelled
