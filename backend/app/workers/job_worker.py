"""Background job execution.

A small thread pool keeps the API responsive: a request never waits on ffmpeg.
Threads (not processes) are the right call here because every expensive step -
yt-dlp's network I/O, ffmpeg, Whisper's C++ inference - releases the GIL.
"""
from __future__ import annotations

import threading
from concurrent.futures import Future, ThreadPoolExecutor

from ..config import settings
from ..database import session_scope
from ..models import Job, JobStatus
from ..utils.logging import get_logger
from .pipeline import run_job
from .progress import ProgressReporter

log = get_logger(__name__)


class JobManager:
    def __init__(self, max_workers: int | None = None) -> None:
        self.max_workers = max_workers or settings.max_concurrent_jobs
        self._executor: ThreadPoolExecutor | None = None
        self._futures: dict[str, Future] = {}
        self._reporters: dict[str, ProgressReporter] = {}
        self._lock = threading.Lock()

    # -- lifecycle --------------------------------------------------------
    def start(self) -> None:
        if self._executor is None:
            self._executor = ThreadPoolExecutor(
                max_workers=self.max_workers, thread_name_prefix="clipgen"
            )
            log.info("job manager started with %d worker(s)", self.max_workers)

    def shutdown(self, *, wait: bool = False) -> None:
        with self._lock:
            for reporter in self._reporters.values():
                reporter.cancel()
        if self._executor is not None:
            self._executor.shutdown(wait=wait, cancel_futures=True)
            self._executor = None
            log.info("job manager stopped")

    # -- queueing ---------------------------------------------------------
    @property
    def active_count(self) -> int:
        with self._lock:
            return sum(1 for f in self._futures.values() if not f.done())

    def has_capacity(self) -> bool:
        # One waiting job per worker is a reasonable queue depth for a local app.
        with self._lock:
            pending = sum(1 for f in self._futures.values() if not f.done())
        return pending < self.max_workers * 3

    def submit(self, job_id: str) -> None:
        self.start()
        assert self._executor is not None
        reporter = ProgressReporter(job_id)
        with self._lock:
            self._reporters[job_id] = reporter
            future = self._executor.submit(self._run, job_id, reporter)
            self._futures[job_id] = future
        future.add_done_callback(lambda _f, jid=job_id: self._finish(jid))
        log.info("queued job %s", job_id)

    def _run(self, job_id: str, reporter: ProgressReporter) -> None:
        run_job(job_id, reporter)

    def _finish(self, job_id: str) -> None:
        with self._lock:
            self._futures.pop(job_id, None)
            self._reporters.pop(job_id, None)

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            future = self._futures.get(job_id)
            reporter = self._reporters.get(job_id)
        if future is None:
            return False
        if future.cancel():
            self._finish(job_id)
            with session_scope() as session:
                job = session.get(Job, job_id)
                if job and not JobStatus(job.status).is_terminal:
                    job.status = JobStatus.CANCELLED.value
                    job.stage_message = "Cancelled"
            return True
        if reporter is not None:
            reporter.cancel()  # cooperative stop at the next checkpoint
            return True
        return False

    def requeue_orphans(self) -> int:
        """After a restart, jobs left mid-flight are dead. Fail them honestly."""
        stuck_states = [
            JobStatus.QUEUED.value,
            JobStatus.DOWNLOADING.value,
            JobStatus.ANALYZING.value,
            JobStatus.SELECTING_CLIPS.value,
            JobStatus.PROCESSING.value,
        ]
        count = 0
        with session_scope() as session:
            jobs = session.query(Job).filter(Job.status.in_(stuck_states)).all()
            for job in jobs:
                job.status = JobStatus.FAILED.value
                job.stage_message = "Failed"
                job.error_code = "interrupted"
                job.error_message = "Processing was interrupted when the server restarted."
                job.error_hint = "Submit the video again."
                count += 1
        if count:
            log.info("marked %d interrupted job(s) as failed after restart", count)
        return count


job_manager = JobManager()
