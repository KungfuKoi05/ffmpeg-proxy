"""Thin, safe wrappers around ffmpeg / ffprobe.

Rules enforced here:
  * every subprocess is invoked with an argument list - never a shell string,
    so nothing a user typed can become a command;
  * every subprocess has a timeout;
  * failures raise with the tail of stderr, which the error mapper turns into
    a sentence for the UI.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from ..config import settings
from ..utils.errors import UserFacingError
from ..utils.logging import get_logger
from ..analyzers.types import SceneAnalysis, SilenceInterval

log = get_logger(__name__)

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"


class DependencyMissing(UserFacingError):
    pass


@dataclass(frozen=True)
class MediaInfo:
    duration: float
    width: int
    height: int
    fps: float
    video_codec: str
    audio_codec: str | None
    has_audio: bool
    bitrate: int | None

    @property
    def resolution_label(self) -> str:
        return f"{self.height}p" if self.height else "unknown"


def ffmpeg_available() -> bool:
    return shutil.which(FFMPEG) is not None


def ffprobe_available() -> bool:
    return shutil.which(FFPROBE) is not None


def require_ffmpeg() -> None:
    missing = [name for name in (FFMPEG, FFPROBE) if shutil.which(name) is None]
    if missing:
        raise DependencyMissing(
            code="ffmpeg_missing",
            message=f"{' and '.join(missing)} could not be found on this machine.",
            hint=(
                "Install FFmpeg and restart the app. "
                "macOS: brew install ffmpeg  |  Ubuntu/Debian: sudo apt install ffmpeg  |  "
                "Windows: winget install Gyan.FFmpeg"
            ),
        )


def ffmpeg_version() -> str | None:
    if not ffmpeg_available():
        return None
    try:
        out = subprocess.run(
            [FFMPEG, "-hide_banner", "-version"],
            capture_output=True, text=True, timeout=15, check=False,
        ).stdout
        first = out.splitlines()[0] if out else ""
        match = re.search(r"ffmpeg version (\S+)", first)
        return match.group(1) if match else first[:60] or None
    except (OSError, subprocess.SubprocessError):
        return None


def available_encoders() -> set[str]:
    if not ffmpeg_available():
        return set()
    try:
        out = subprocess.run(
            [FFMPEG, "-hide_banner", "-encoders"],
            capture_output=True, text=True, timeout=20, check=False,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return set()
    return set(re.findall(r"^\s*\S+\s+(\S+)", out, re.M))


def detect_hardware_encoder() -> str | None:
    """Return a hardware H.264 encoder name if the machine has one."""
    encoders = available_encoders()
    for name in ("h264_videotoolbox", "h264_nvenc", "h264_qsv", "h264_vaapi", "h264_amf"):
        if name in encoders:
            return name
    return None


def run(
    args: list[str],
    *,
    timeout: int | None = None,
    check: bool = True,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess:
    """Run a media subprocess with no shell, capturing output."""
    timeout = timeout or settings.subprocess_timeout
    log.debug("run: %s", " ".join(args[:12]) + (" …" if len(args) > 12 else ""))
    try:
        proc = subprocess.run(
            args, capture_output=True, text=True, timeout=timeout,
            check=False, cwd=str(cwd) if cwd else None,
        )
    except FileNotFoundError as exc:
        raise DependencyMissing(
            code="ffmpeg_missing",
            message=f"Couldn't run `{args[0]}` - it isn't installed on this machine.",
            hint="Install FFmpeg, then restart the app.",
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise TimeoutError(f"{args[0]} timed out after {timeout}s") from exc

    if check and proc.returncode != 0:
        tail = (proc.stderr or "").strip().splitlines()[-6:]
        raise RuntimeError(f"{args[0]} failed ({proc.returncode}): {' | '.join(tail)}")
    return proc


def probe(path: Path) -> MediaInfo:
    """Read real properties off the file - never trust the requested quality."""
    proc = run(
        [
            FFPROBE, "-v", "error",
            "-print_format", "json",
            "-show_format", "-show_streams",
            str(path),
        ],
        timeout=120,
    )
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("ffprobe returned unreadable output (corrupt media?)") from exc

    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    fmt = data.get("format", {})

    if video is None:
        raise RuntimeError("Invalid data found: the file has no video stream")

    duration = 0.0
    for source in (fmt.get("duration"), video.get("duration")):
        try:
            duration = float(source)
            if duration > 0:
                break
        except (TypeError, ValueError):
            continue

    fps = 0.0
    rate = video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/0"
    try:
        num, _, den = rate.partition("/")
        fps = float(num) / float(den) if float(den or 0) else 0.0
    except (TypeError, ValueError, ZeroDivisionError):
        fps = 0.0

    try:
        bitrate = int(fmt.get("bit_rate")) if fmt.get("bit_rate") else None
    except (TypeError, ValueError):
        bitrate = None

    return MediaInfo(
        duration=duration,
        width=int(video.get("width") or 0),
        height=int(video.get("height") or 0),
        fps=round(fps, 3),
        video_codec=str(video.get("codec_name") or "unknown"),
        audio_codec=str(audio.get("codec_name")) if audio else None,
        has_audio=audio is not None,
        bitrate=bitrate,
    )


_SILENCE_START = re.compile(r"silence_start:\s*(-?[\d.]+)")
_SILENCE_END = re.compile(r"silence_end:\s*(-?[\d.]+)")
_TIME_RE = re.compile(r"out_time_ms=(\d+)")


def detect_silences(
    path: Path,
    *,
    noise_db: float = -32.0,
    min_duration: float = 0.35,
    timeout: int | None = None,
) -> list[SilenceInterval]:
    """Find pauses in the audio. Audio-only decode, so this is fast."""
    proc = run(
        [
            FFMPEG, "-hide_banner", "-nostats", "-vn",
            "-i", str(path),
            "-af", f"silencedetect=noise={noise_db}dB:d={min_duration}",
            "-f", "null", "-",
        ],
        timeout=timeout or min(settings.subprocess_timeout, 1800),
        check=False,
    )
    stderr = proc.stderr or ""
    silences: list[SilenceInterval] = []
    pending: float | None = None
    for line in stderr.splitlines():
        start_match = _SILENCE_START.search(line)
        if start_match:
            pending = max(0.0, float(start_match.group(1)))
            continue
        end_match = _SILENCE_END.search(line)
        if end_match and pending is not None:
            end = float(end_match.group(1))
            if end > pending:
                silences.append(SilenceInterval(start=pending, end=end))
            pending = None
    return silences


def analyze_scene(path: Path, duration: float) -> SceneAnalysis:
    """Audio-side analysis used for boundary snapping and speech-ratio scoring."""
    try:
        silences = detect_silences(path)
    except (RuntimeError, TimeoutError) as exc:
        log.warning("silence detection failed, continuing without it: %s", exc)
        silences = []
    return SceneAnalysis(silences=silences, scene_cuts=[], duration=duration)


def run_with_progress(
    args: list[str],
    *,
    total_seconds: float,
    on_progress: Callable[[float], None] | None = None,
    timeout: int | None = None,
    cwd: Path | None = None,
) -> None:
    """Run ffmpeg and report genuine progress from its own `-progress` output."""
    timeout = timeout or settings.subprocess_timeout
    full = [*args[:1], "-progress", "pipe:1", "-nostats", *args[1:]]
    try:
        proc = subprocess.Popen(
            full, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            cwd=str(cwd) if cwd else None,
        )
    except FileNotFoundError as exc:
        raise DependencyMissing(
            code="ffmpeg_missing",
            message="FFmpeg isn't installed on this machine.",
            hint="Install FFmpeg, then restart the app.",
        ) from exc

    assert proc.stdout is not None
    try:
        for line in proc.stdout:
            match = _TIME_RE.search(line)
            if match and on_progress and total_seconds > 0:
                seconds = int(match.group(1)) / 1_000_000
                on_progress(max(0.0, min(1.0, seconds / total_seconds)))
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        proc.kill()
        raise TimeoutError("ffmpeg timed out") from exc

    if proc.returncode != 0:
        stderr = proc.stderr.read() if proc.stderr else ""
        tail = stderr.strip().splitlines()[-6:]
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}): {' | '.join(tail)}")


def subtitle_streams(path: Path) -> list[dict]:
    """List subtitle tracks carried inside a container."""
    try:
        proc = run(
            [
                FFPROBE, "-v", "error", "-print_format", "json",
                "-select_streams", "s", "-show_streams", str(path),
            ],
            timeout=120,
            check=False,
        )
        return json.loads(proc.stdout or "{}").get("streams", []) or []
    except (RuntimeError, TimeoutError, json.JSONDecodeError) as exc:
        log.debug("could not list subtitle streams: %s", exc)
        return []


# Image-based subtitles cannot be turned back into text.
_BITMAP_SUBTITLE_CODECS = {"dvd_subtitle", "dvb_subtitle", "hdmv_pgs_subtitle", "xsub"}


def extract_embedded_subtitles(path: Path, dest_dir: Path) -> list[Path]:
    """Pull text subtitle tracks out of a container into .srt files.

    Plenty of video files carry their own subtitles. Using them costs one cheap
    ffmpeg call and gives clip selection a real transcript instead of falling
    back to audio-only segmentation.
    """
    streams = subtitle_streams(path)
    if not streams:
        return []

    def rank(stream: dict) -> tuple[int, int]:
        language = str((stream.get("tags") or {}).get("language") or "").lower()
        disposition = stream.get("disposition") or {}
        return (
            0 if language.startswith("en") else 1,
            0 if disposition.get("default") else 1,
        )

    dest_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    for stream in sorted(streams, key=rank):
        codec = str(stream.get("codec_name") or "").lower()
        if codec in _BITMAP_SUBTITLE_CODECS:
            log.debug("skipping image-based subtitle track (%s)", codec)
            continue
        index = stream.get("index")
        if index is None:
            continue

        language = str((stream.get("tags") or {}).get("language") or "und").lower()[:8]
        language = "".join(ch for ch in language if ch.isalnum() or ch == "-") or "und"
        destination = dest_dir / f"embedded.{language}.srt"

        try:
            run(
                [
                    FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
                    "-i", str(path),
                    "-map", f"0:{int(index)}",
                    "-c:s", "srt",
                    str(destination),
                ],
                timeout=600,
            )
        except (RuntimeError, TimeoutError) as exc:
            log.debug("could not extract subtitle stream %s: %s", index, exc)
            continue

        if destination.exists() and destination.stat().st_size > 40:
            log.info("extracted embedded subtitles (%s) from %s", language, path.name)
            written.append(destination)
            break  # one usable track is enough
        destination.unlink(missing_ok=True)

    return written


def extract_thumbnail(source: Path, dest: Path, *, at_seconds: float, width: int = 640) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        run(
            [
                FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
                "-ss", f"{max(0.0, at_seconds):.3f}",
                "-i", str(source),
                "-frames:v", "1",
                "-vf", f"scale={width}:-2:flags=lanczos",
                "-q:v", "3",
                str(dest),
            ],
            timeout=120,
        )
    except (RuntimeError, TimeoutError) as exc:
        log.warning("thumbnail extraction failed: %s", exc)
        return False
    return dest.exists()
