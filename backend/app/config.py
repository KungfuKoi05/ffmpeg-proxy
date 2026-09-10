"""Application configuration, loaded from environment / .env file.

Every setting has a sane default so the app runs with no configuration at all.
Secrets are read from the environment only - nothing is hard-coded.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Project root = the directory containing `backend/` and `frontend/`.
ROOT_DIR = Path(__file__).resolve().parents[2]

load_dotenv(ROOT_DIR / ".env")


def _env(key: str, default: str) -> str:
    value = os.getenv(key)
    return default if value is None or value.strip() == "" else value.strip()


def _env_int(key: str, default: int) -> int:
    try:
        return int(_env(key, str(default)))
    except ValueError:
        return default


def _env_bool(key: str, default: bool) -> bool:
    return _env(key, "1" if default else "0").lower() in {"1", "true", "yes", "on"}


def _resolve(path_str: str) -> Path:
    path = Path(path_str).expanduser()
    if not path.is_absolute():
        path = ROOT_DIR / path
    return path.resolve()


@dataclass(frozen=True)
class Settings:
    # Storage
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL", "sqlite:///./storage/clipgen.db"))
    output_dir: Path = field(default_factory=lambda: _resolve(_env("OUTPUT_DIRECTORY", "./storage/jobs")))
    temp_dir: Path = field(default_factory=lambda: _resolve(_env("TEMP_DIRECTORY", "./temp")))

    # Limits
    max_video_duration: int = field(default_factory=lambda: _env_int("MAX_VIDEO_DURATION", 10800))
    min_video_duration: int = field(default_factory=lambda: _env_int("MIN_VIDEO_DURATION", 90))
    max_concurrent_jobs: int = field(default_factory=lambda: _env_int("MAX_CONCURRENT_JOBS", 2))
    job_ttl_hours: int = field(default_factory=lambda: _env_int("JOB_TTL_HOURS", 24))
    subprocess_timeout: int = field(default_factory=lambda: _env_int("SUBPROCESS_TIMEOUT", 3600))
    min_free_disk_mb: int = field(default_factory=lambda: _env_int("MIN_FREE_DISK_MB", 2048))

    # Clip shape
    min_clip_seconds: float = field(default_factory=lambda: float(_env_int("MIN_CLIP_SECONDS", 30)))
    max_clip_seconds: float = field(default_factory=lambda: float(_env_int("MAX_CLIP_SECONDS", 60)))
    target_clip_seconds: float = field(default_factory=lambda: float(_env_int("TARGET_CLIP_SECONDS", 52)))
    min_clips: int = field(default_factory=lambda: _env_int("MIN_CLIPS", 5))
    max_clips: int = field(default_factory=lambda: _env_int("MAX_CLIPS", 8))

    # Encoding
    video_crf: int = field(default_factory=lambda: _env_int("VIDEO_CRF", 18))
    video_preset: str = field(default_factory=lambda: _env("VIDEO_PRESET", "medium"))
    audio_bitrate: str = field(default_factory=lambda: _env("AUDIO_BITRATE", "192k"))
    prefer_hardware_encoder: bool = field(default_factory=lambda: _env_bool("PREFER_HARDWARE_ENCODER", False))

    # yt-dlp access helpers
    # YouTube increasingly demands a signed-in session ("confirm you're not a
    # bot"). Pointing yt-dlp at a browser you're already logged into is the
    # supported fix; nothing is bypassed, we just present your own session.
    ytdlp_cookies_from_browser: str = field(
        default_factory=lambda: _env("YTDLP_COOKIES_FROM_BROWSER", "")
    )
    ytdlp_cookies_file: str = field(default_factory=lambda: _env("YTDLP_COOKIES_FILE", ""))
    ytdlp_proxy: str = field(default_factory=lambda: _env("YTDLP_PROXY", ""))

    # Uploads
    max_upload_mb: int = field(default_factory=lambda: _env_int("MAX_UPLOAD_MB", 2048))

    # Speech to text
    whisper_model: str = field(default_factory=lambda: _env("WHISPER_MODEL", "base"))
    whisper_enabled: bool = field(default_factory=lambda: _env_bool("WHISPER_ENABLED", True))

    # Optional AI
    llm_ranking_enabled: bool = field(default_factory=lambda: _env_bool("LLM_RANKING_ENABLED", False))
    anthropic_api_key: str = field(default_factory=lambda: _env("ANTHROPIC_API_KEY", ""))
    openai_api_key: str = field(default_factory=lambda: _env("OPENAI_API_KEY", ""))

    # Server
    host: str = field(default_factory=lambda: _env("HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: _env_int("PORT", 8000))
    log_level: str = field(default_factory=lambda: _env("LOG_LEVEL", "INFO").upper())
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip()
            for o in _env(
                "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            ).split(",")
            if o.strip()
        )
    )

    @property
    def cookies_configured(self) -> bool:
        return bool(self.ytdlp_cookies_from_browser or self.ytdlp_cookies_file)

    @property
    def llm_available(self) -> bool:
        return bool(self.anthropic_api_key or self.openai_api_key)

    def ensure_dirs(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        if self.database_url.startswith("sqlite:///"):
            db_path = self.database_url[len("sqlite:///"):]
            _resolve(db_path).parent.mkdir(parents=True, exist_ok=True)

    def sqlite_path(self) -> Path | None:
        if not self.database_url.startswith("sqlite:///"):
            return None
        return _resolve(self.database_url[len("sqlite:///"):])


settings = Settings()
