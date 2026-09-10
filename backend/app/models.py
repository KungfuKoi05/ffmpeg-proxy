"""Database models: jobs and the clips they produce."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .config import settings
from .database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    DOWNLOADING = "DOWNLOADING"
    ANALYZING = "ANALYZING"
    SELECTING_CLIPS = "SELECTING_CLIPS"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

    @property
    def is_terminal(self) -> bool:
        return self in {
            JobStatus.COMPLETED,
            JobStatus.FAILED,
            JobStatus.EXPIRED,
            JobStatus.CANCELLED,
        }


# Human-readable label for each stage, shown on the processing screen.
STAGE_LABELS: dict[str, str] = {
    JobStatus.QUEUED.value: "Waiting in queue…",
    JobStatus.DOWNLOADING.value: "Downloading video…",
    JobStatus.ANALYZING.value: "Analyzing video…",
    JobStatus.SELECTING_CLIPS.value: "Finding interesting moments…",
    JobStatus.PROCESSING.value: "Creating clips…",
    JobStatus.COMPLETED.value: "Done",
    JobStatus.FAILED.value: "Failed",
    JobStatus.EXPIRED.value: "Expired",
    JobStatus.CANCELLED.value: "Cancelled",
}


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    owner_token: Mapped[str] = mapped_column(String(64), index=True, default=_uuid)

    # --- source video -------------------------------------------------
    video_id: Mapped[str] = mapped_column(String(16), index=True)
    source_url: Mapped[str] = mapped_column(String(256))
    title: Mapped[str | None] = mapped_column(String(512), default=None)
    channel: Mapped[str | None] = mapped_column(String(256), default=None)
    duration: Mapped[float | None] = mapped_column(Float, default=None)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024), default=None)
    source_width: Mapped[int | None] = mapped_column(Integer, default=None)
    source_height: Mapped[int | None] = mapped_column(Integer, default=None)
    source_fps: Mapped[float | None] = mapped_column(Float, default=None)
    source_path: Mapped[str | None] = mapped_column(Text, default=None)
    source_deleted: Mapped[int] = mapped_column(Integer, default=0)

    # --- request options ----------------------------------------------
    aspect_ratio: Mapped[str] = mapped_column(String(8), default="9:16")
    captions: Mapped[int] = mapped_column(Integer, default=0)
    quality: Mapped[str] = mapped_column(String(16), default="1080p")
    requested_clips: Mapped[int | None] = mapped_column(Integer, default=None)
    min_clip_seconds: Mapped[float] = mapped_column(Float, default=settings.min_clip_seconds)
    max_clip_seconds: Mapped[float] = mapped_column(Float, default=settings.max_clip_seconds)

    # --- progress ------------------------------------------------------
    status: Mapped[str] = mapped_column(String(24), default=JobStatus.QUEUED.value, index=True)
    stage_message: Mapped[str] = mapped_column(String(200), default=STAGE_LABELS[JobStatus.QUEUED.value])
    progress: Mapped[float] = mapped_column(Float, default=0.0)  # 0..100
    transcript_source: Mapped[str | None] = mapped_column(String(32), default=None)
    analysis: Mapped[dict | None] = mapped_column(JSON, default=None)

    # --- failure -------------------------------------------------------
    error_code: Mapped[str | None] = mapped_column(String(64), default=None)
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    error_hint: Mapped[str | None] = mapped_column(Text, default=None)

    # --- lifecycle -----------------------------------------------------
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: utcnow() + timedelta(hours=settings.job_ttl_hours),
    )

    clips: Mapped[list["Clip"]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="Clip.index",
        lazy="selectin",
    )

    @property
    def is_expired(self) -> bool:
        expires = self.expires_at
        if expires is None:
            return False
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return utcnow() > expires


class Clip(Base):
    __tablename__ = "clips"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)

    index: Mapped[int] = mapped_column(Integer)  # 1-based, display order
    title: Mapped[str] = mapped_column(String(200), default="")
    start: Mapped[float] = mapped_column(Float)
    end: Mapped[float] = mapped_column(Float)
    duration: Mapped[float] = mapped_column(Float)

    width: Mapped[int | None] = mapped_column(Integer, default=None)
    height: Mapped[int | None] = mapped_column(Integer, default=None)
    filesize: Mapped[int | None] = mapped_column(Integer, default=None)
    has_captions: Mapped[int] = mapped_column(Integer, default=0)

    file_path: Mapped[str] = mapped_column(Text)
    thumbnail_path: Mapped[str | None] = mapped_column(Text, default=None)
    subtitle_path: Mapped[str | None] = mapped_column(Text, default=None)

    score: Mapped[float] = mapped_column(Float, default=0.0)
    score_breakdown: Mapped[dict | None] = mapped_column(JSON, default=None)
    transcript_text: Mapped[str | None] = mapped_column(Text, default=None)
    selected_by: Mapped[str] = mapped_column(String(24), default="heuristic")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    job: Mapped[Job] = relationship(back_populates="clips")

    @property
    def resolution_label(self) -> str:
        if not self.height:
            return "unknown"
        return f"{self.height}p"
