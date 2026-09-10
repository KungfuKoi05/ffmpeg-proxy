"""Request/response shapes for the API."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .config import settings
from .utils.urls import InvalidYouTubeURL, parse_youtube_url

AspectRatio = Literal["16:9", "9:16", "1:1"]
Quality = Literal["1080p", "720p", "highest"]


class JobOptions(BaseModel):
    aspect_ratio: AspectRatio = "9:16"
    captions: bool = False
    quality: Quality = "1080p"
    clip_count: int | None = Field(default=None, ge=1, le=12)
    min_clip_seconds: float = Field(default=settings.min_clip_seconds, ge=10, le=180)
    max_clip_seconds: float = Field(default=settings.max_clip_seconds, ge=15, le=180)

    @field_validator("max_clip_seconds")
    @classmethod
    def _max_above_min(cls, value: float, info):
        minimum = info.data.get("min_clip_seconds", settings.min_clip_seconds)
        if value < minimum:
            raise ValueError("Maximum clip length must be at least the minimum.")
        return value


class JobCreate(BaseModel):
    url: str = Field(min_length=5, max_length=2048)
    options: JobOptions = Field(default_factory=JobOptions)

    @field_validator("url")
    @classmethod
    def _valid_youtube(cls, value: str) -> str:
        try:
            parse_youtube_url(value)
        except InvalidYouTubeURL as exc:
            raise ValueError(str(exc)) from exc
        return value


class ClipOut(BaseModel):
    id: str
    job_id: str
    index: int
    title: str
    start: float
    end: float
    start_label: str
    end_label: str
    duration: float
    duration_label: str
    width: int | None
    height: int | None
    resolution: str
    filesize: int | None
    has_captions: bool
    score: float
    score_breakdown: dict | None
    selected_by: str
    transcript_excerpt: str | None
    preview_url: str
    download_url: str
    thumbnail_url: str | None
    subtitle_url: str | None


class VideoOut(BaseModel):
    # None for uploaded files, which have no YouTube identity.
    video_id: str | None
    title: str | None
    channel: str | None
    duration: float | None
    duration_label: str | None
    thumbnail_url: str | None
    resolution: str | None
    source_url: str


class JobError(BaseModel):
    code: str
    message: str
    hint: str | None = None


class JobOut(BaseModel):
    id: str
    source_kind: str
    status: str
    stage: str
    progress: float
    created_at: datetime
    completed_at: datetime | None
    expires_at: datetime | None
    video: VideoOut
    options: JobOptions
    clip_count: int
    transcript_source: str | None
    analysis: dict | None
    error: JobError | None
    download_all_url: str | None


class JobCreated(BaseModel):
    job: JobOut
    owner_token: str


class VideoPreview(BaseModel):
    """Result of validating a URL before committing to a job."""

    video: VideoOut
    can_process: bool
    reason: str | None = None


class DependencyStatus(BaseModel):
    name: str
    available: bool
    version: str | None = None
    required: bool
    install_hint: str | None = None


class SystemStatus(BaseModel):
    ready: bool
    dependencies: list[DependencyStatus]
    limits: dict
    features: dict
    storage: dict
