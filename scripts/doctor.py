#!/usr/bin/env python3
"""Check whether this machine can actually run the app - and say what to fix.

Run:  ./scripts/doctor.sh      (or: ./.venv/bin/python scripts/doctor.py)

The last check is the one that matters most: it asks YouTube for the metadata
of a Creative Commons video and reports exactly why it failed if it did.
Nothing is downloaded.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# A Blender Foundation short, Creative Commons licensed and stable for years.
PROBE_VIDEO_ID = "aqz-KE-bpKQ"

GREEN, YELLOW, RED, DIM, BOLD, OFF = (
    "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[1m", "\033[0m"
)
if not sys.stdout.isatty():
    GREEN = YELLOW = RED = DIM = BOLD = OFF = ""

problems: list[str] = []
warnings: list[str] = []
youtube_blocked = False


def ok(label: str, detail: str = "") -> None:
    print(f"  {GREEN}✓{OFF} {label}" + (f"  {DIM}{detail}{OFF}" if detail else ""))


def bad(label: str, fix: str) -> None:
    print(f"  {RED}✗{OFF} {label}")
    print(f"      {DIM}fix:{OFF} {fix}")
    problems.append(label)


def warn(label: str, note: str) -> None:
    print(f"  {YELLOW}!{OFF} {label}")
    print(f"      {DIM}{note}{OFF}")
    warnings.append(label)


def section(title: str) -> None:
    print(f"\n{BOLD}{title}{OFF}")


# ---------------------------------------------------------------------------
section("System tools")

for tool in ("ffmpeg", "ffprobe"):
    path = shutil.which(tool)
    if path:
        version = ""
        if tool == "ffmpeg":
            try:
                first = subprocess.run(
                    [tool, "-version"], capture_output=True, text=True, timeout=15
                ).stdout.splitlines()[0]
                version = first.split(" ")[2] if len(first.split(" ")) > 2 else ""
            except Exception:
                pass
        ok(tool, version)
    else:
        installer = {
            "darwin": "brew install ffmpeg",
            "linux": "sudo apt install ffmpeg",
        }.get(sys.platform, "winget install Gyan.FFmpeg")
        bad(f"{tool} not found", installer)

if sys.version_info >= (3, 10):
    ok("python", ".".join(str(v) for v in sys.version_info[:3]))
else:
    bad(f"python {sys.version_info.major}.{sys.version_info.minor} is too old", "install Python 3.10+")

# ---------------------------------------------------------------------------
section("Python packages")

for module, label, fix in (
    ("fastapi", "fastapi", "pip install -r backend/requirements.txt"),
    ("sqlalchemy", "sqlalchemy", "pip install -r backend/requirements.txt"),
    ("numpy", "numpy", "pip install -r backend/requirements.txt"),
):
    try:
        __import__(module)
        ok(label)
    except ImportError:
        bad(f"{label} not installed", fix)

try:
    import yt_dlp

    version = getattr(yt_dlp.version, "__version__", "unknown")
    ok("yt-dlp", version)
    year = str(version).split(".")[0]
    if year.isdigit() and int(year) < 2025:
        warn(
            f"yt-dlp {version} looks old",
            "YouTube changes often. Update: ./.venv/bin/pip install -U yt-dlp",
        )
except ImportError:
    bad("yt-dlp not installed", "pip install -r backend/requirements.txt")

try:
    import faster_whisper  # noqa: F401

    ok("faster-whisper", "captionless videos supported")
except ImportError:
    print(
        f"  {DIM}·{OFF} faster-whisper not installed "
        f"{DIM}(optional: only needed for videos with no captions){OFF}"
    )

# ---------------------------------------------------------------------------
section("Web interface")

if (ROOT / "frontend" / "dist" / "index.html").is_file():
    ok("frontend built")
else:
    bad("frontend/dist is missing", "cd frontend && npm install && npm run build")

# ---------------------------------------------------------------------------
section("Storage")

try:
    from backend.app.config import settings

    settings.ensure_dirs()
    free_mb = shutil.disk_usage(settings.temp_dir).free // (1024 * 1024)
    if free_mb >= settings.min_free_disk_mb:
        ok("disk space", f"{free_mb // 1024} GB free")
    else:
        bad(
            f"only {free_mb} MB free (need {settings.min_free_disk_mb} MB)",
            "free up space, or lower MIN_FREE_DISK_MB in .env",
        )
    ok("writable directories", str(settings.output_dir.parent))
except Exception as exc:
    bad(f"could not prepare storage: {exc}", "check directory permissions")

# ---------------------------------------------------------------------------
section("YouTube access")

if any("yt-dlp" in p for p in problems):
    print(f"  {DIM}skipped - yt-dlp is not installed{OFF}")
else:
    from backend.app.config import settings
    from backend.app.utils.errors import to_user_error
    from backend.app.utils.urls import ParsedVideo

    if settings.cookies_configured:
        source = settings.ytdlp_cookies_from_browser or settings.ytdlp_cookies_file
        print(f"  {DIM}using cookies from: {source}{OFF}")

    print(f"  {DIM}asking YouTube about a Creative Commons test video…{OFF}")
    try:
        from backend.app.services import youtube

        meta = youtube.fetch_metadata(ParsedVideo(PROBE_VIDEO_ID))
        ok("reached YouTube", f"{meta.title} · {meta.duration / 60:.0f} min · {meta.resolution_label}")
    except Exception as exc:
        error = to_user_error(exc)
        fixes = {
            "network_error": (
                "No route to YouTube from this machine. Check your connection, "
                "or set YTDLP_PROXY in .env if you are behind a proxy."
            ),
            "youtube_rate_limited": (
                "YouTube wants a signed-in session. Set "
                "YTDLP_COOKIES_FROM_BROWSER=chrome (or firefox/safari/edge) in .env "
                "to use the browser you are already logged into."
            ),
            "download_failed": "Update yt-dlp: ./.venv/bin/pip install -U yt-dlp",
            "video_unavailable": "Update yt-dlp: ./.venv/bin/pip install -U yt-dlp",
        }
        youtube_blocked = True
        bad(
            f"could not reach YouTube - {error.message}",
            fixes.get(error.code, error.hint or "see the raw error below"),
        )
        # fetch_metadata raises a translated error; the original is its cause.
        raw = exc.__cause__ or exc
        first_line = str(raw).strip().splitlines()[0] if str(raw).strip() else type(raw).__name__
        print(f"      {DIM}raw: {first_line[:170]}{OFF}")

# ---------------------------------------------------------------------------
print()
if problems:
    print(f"{RED}{len(problems)} problem(s) to fix.{OFF} Each is listed above with its fix.")
    if youtube_blocked and len(problems) == 1:
        print(
            f"\n{DIM}YouTube is the only failure. Everything else works, so you can still{OFF}\n"
            f"{DIM}use the app right now by dropping a video file onto the page instead{OFF}\n"
            f"{DIM}of pasting a link - same clips, same output, no network needed.{OFF}"
        )
        print(f"\n  Start the app:  ./scripts/start.sh")
        print(f"  Then open:      http://127.0.0.1:8000\n")
    sys.exit(1)

if warnings:
    print(f"{YELLOW}Ready, with {len(warnings)} warning(s).{OFF}")
else:
    print(f"{GREEN}Everything checks out.{OFF}")
print(f"\n  Start the app:  ./scripts/start.sh")
print(f"  Then open:      http://127.0.0.1:8000\n")
