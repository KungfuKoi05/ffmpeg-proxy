"""Everything that talks to YouTube, via yt-dlp.

Only a canonical URL rebuilt from a validated 11-character video ID is ever
passed to yt-dlp - see utils/urls.py. yt-dlp is used as a library rather than
a subprocess so we get structured errors instead of parsing stderr.
"""
from __future__ import annotations

import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from ..config import settings
from ..utils.errors import UserFacingError
from ..utils.logging import get_logger
from ..utils.urls import ParsedVideo

log = get_logger(__name__)

# Language preference for subtitle download. `en.*` catches en-US, en-GB and
# YouTube's `en-orig`.
SUBTITLE_LANGS = ["en", "en-orig", "en-US", "en-GB"]
SUBTITLE_FORMATS = "json3/srv3/vtt/best"


@dataclass
class VideoMetadata:
    video_id: str
    title: str
    channel: str | None
    duration: float
    thumbnail_url: str | None
    max_height: int | None
    is_live: bool
    availability: str | None = None
    upload_date: str | None = None
    view_count: int | None = None

    @property
    def resolution_label(self) -> str:
        return f"{self.max_height}p" if self.max_height else "unknown"


@dataclass
class DownloadResult:
    video_path: Path
    subtitle_paths: list[Path] = field(default_factory=list)
    subtitle_is_automatic: bool = False


def _import_ytdlp():
    try:
        import yt_dlp  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - depends on install
        raise UserFacingError(
            code="ytdlp_missing",
            message="yt-dlp isn't installed, so we can't fetch YouTube videos.",
            hint="Run: pip install -r backend/requirements.txt",
        ) from exc
    return yt_dlp


def ytdlp_version() -> str | None:
    try:
        import yt_dlp

        return getattr(yt_dlp.version, "__version__", None)
    except Exception:  # pragma: no cover - optional dependency probe
        return None


class _YtdlpLogger:
    """yt-dlp writes to stderr even when quiet. Send it to our log instead.

    Its errors are already surfaced to the user as a translated exception, so
    printing the raw text as well is just noise in the terminal.
    """

    def debug(self, message: str) -> None:
        log.debug("yt-dlp: %s", message)

    def info(self, message: str) -> None:
        log.debug("yt-dlp: %s", message)

    def warning(self, message: str) -> None:
        log.debug("yt-dlp: %s", message)

    def error(self, message: str) -> None:
        log.debug("yt-dlp: %s", message)


def _base_opts() -> dict:
    return {
        "logger": _YtdlpLogger(),
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
        "ignoreerrors": False,
        "retries": 3,
        "fragment_retries": 5,
        "socket_timeout": 30,
        "extractor_retries": 2,
        # We only ever process one video at a time; never follow playlists.
        "playlist_items": "1",
        **_access_opts(),
    }


# Browsers yt-dlp can read cookies from.
SUPPORTED_COOKIE_BROWSERS = (
    "brave", "chrome", "chromium", "edge", "firefox", "opera", "safari", "vivaldi", "whale",
)


def _access_opts() -> dict:
    """Optional credentials and routing, from configuration only.

    This presents the user's own logged-in session to YouTube. It does not
    circumvent any access control - a video you cannot watch while signed in
    is still a video this app will refuse.
    """
    opts: dict = {}

    browser = settings.ytdlp_cookies_from_browser.strip().lower()
    if browser:
        # Accepts "firefox" or "firefox:profile-name".
        name, _, profile = browser.partition(":")
        if name in SUPPORTED_COOKIE_BROWSERS:
            # yt-dlp expects (browser, profile, keyring, container).
            opts["cookiesfrombrowser"] = (name, profile or None, None, None)
        else:
            log.warning(
                "YTDLP_COOKIES_FROM_BROWSER=%r is not a browser yt-dlp knows; ignoring. "
                "Supported: %s",
                browser, ", ".join(SUPPORTED_COOKIE_BROWSERS),
            )

    cookie_file = settings.ytdlp_cookies_file.strip()
    if cookie_file:
        path = Path(cookie_file).expanduser()
        if path.is_file():
            opts["cookiefile"] = str(path)
        else:
            log.warning("YTDLP_COOKIES_FILE points at %s, which does not exist; ignoring", path)

    if settings.ytdlp_proxy.strip():
        opts["proxy"] = settings.ytdlp_proxy.strip()

    return opts


def _translate(exc: Exception) -> Exception:
    """yt-dlp errors are verbose; hand them to the shared error mapper."""
    from ..utils.errors import to_user_error

    return to_user_error(exc)


def fetch_metadata(video: ParsedVideo) -> VideoMetadata:
    """Read title/duration/available resolutions without downloading media."""
    yt_dlp = _import_ytdlp()
    opts = {**_base_opts(), "skip_download": True}

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(video.canonical_url, download=False)
    except Exception as exc:  # yt-dlp raises many private error types
        log.info("metadata fetch failed for %s: %s", video.video_id, exc)
        raise _translate(exc) from exc

    if not isinstance(info, dict):
        raise UserFacingError(
            code="video_unavailable",
            message="We couldn't read anything about this video.",
            hint="Check the link and try again.",
        )

    live_status = info.get("live_status")
    is_live = bool(info.get("is_live")) or live_status in {"is_live", "is_upcoming", "post_live"}

    heights = [
        f.get("height")
        for f in (info.get("formats") or [])
        if f.get("height") and f.get("vcodec") not in (None, "none")
    ]
    max_height = max(heights) if heights else info.get("height")

    return VideoMetadata(
        video_id=video.video_id,
        title=str(info.get("title") or "Untitled video"),
        channel=(info.get("uploader") or info.get("channel") or None),
        duration=float(info.get("duration") or 0.0),
        thumbnail_url=info.get("thumbnail") or video.thumbnail_url,
        max_height=int(max_height) if max_height else None,
        is_live=is_live,
        availability=info.get("availability"),
        upload_date=info.get("upload_date"),
        view_count=info.get("view_count"),
    )


def _format_selector(max_height: int) -> str:
    """Best video at or below `max_height`, merged with the best audio.

    The fallbacks step down gracefully so a 480p-only source still works
    instead of failing with "requested format not available".
    """
    h = int(max_height)
    return (
        f"bestvideo[height<={h}][ext=mp4]+bestaudio[ext=m4a]/"
        f"bestvideo[height<={h}]+bestaudio/"
        f"best[height<={h}]/"
        f"bestvideo+bestaudio/best"
    )


def download_video(
    video: ParsedVideo,
    dest_dir: Path,
    *,
    max_height: int = 1080,
    want_subtitles: bool = True,
    on_progress: Callable[[float, str], None] | None = None,
) -> DownloadResult:
    """Download one copy of the source video (plus subtitles if published).

    Progress is real: it comes from yt-dlp's own byte counters, summed across
    the separate video and audio streams.
    """
    yt_dlp = _import_ytdlp()
    dest_dir.mkdir(parents=True, exist_ok=True)

    stream_bytes: dict[str, tuple[int, int]] = {}
    lock = threading.Lock()

    def hook(status: dict) -> None:
        if on_progress is None:
            return
        state = status.get("status")
        if state == "downloading":
            name = str(status.get("filename") or status.get("tmpfilename") or "stream")
            done = int(status.get("downloaded_bytes") or 0)
            total = int(
                status.get("total_bytes")
                or status.get("total_bytes_estimate")
                or 0
            )
            with lock:
                stream_bytes[name] = (done, max(total, done))
                total_done = sum(d for d, _ in stream_bytes.values())
                total_all = sum(t for _, t in stream_bytes.values())
            fraction = (total_done / total_all) if total_all else 0.0
            on_progress(min(0.99, fraction), "Downloading video…")
        elif state == "finished":
            on_progress(1.0, "Merging video and audio…")

    opts = {
        **_base_opts(),
        "format": _format_selector(max_height),
        "merge_output_format": "mp4",
        "outtmpl": str(dest_dir / "source.%(ext)s"),
        "progress_hooks": [hook],
        "overwrites": True,
        # Keep the container clean; we re-encode per clip anyway.
        "postprocessor_args": {"merger": ["-movflags", "+faststart"]},
    }

    if want_subtitles:
        opts.update(
            {
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": SUBTITLE_LANGS,
                "subtitlesformat": SUBTITLE_FORMATS,
            }
        )

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(video.canonical_url, download=True)
    except Exception as exc:
        log.info("download failed for %s: %s", video.video_id, exc)
        raise _translate(exc) from exc

    video_path = _locate_media(dest_dir)
    if video_path is None:
        raise UserFacingError(
            code="download_failed",
            message="The download finished but no video file was produced.",
            hint="Try again, or try a different video.",
        )

    subtitle_paths = sorted(
        p for p in dest_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".json3", ".vtt", ".srv3", ".srt"}
    )
    automatic = bool((info or {}).get("requested_subtitles") is None) or not (
        (info or {}).get("subtitles")
    )

    return DownloadResult(
        video_path=video_path,
        subtitle_paths=subtitle_paths,
        subtitle_is_automatic=automatic,
    )


def _locate_media(dest_dir: Path) -> Path | None:
    """Find whatever container yt-dlp actually produced."""
    preferred = [".mp4", ".mkv", ".webm", ".mov", ".m4v"]
    files = [p for p in dest_dir.iterdir() if p.is_file() and p.stem == "source"]
    for ext in preferred:
        for path in files:
            if path.suffix.lower() == ext:
                return path
    media = [p for p in files if p.suffix.lower() not in {".json3", ".vtt", ".srv3", ".srt", ".part"}]
    return media[0] if media else None
