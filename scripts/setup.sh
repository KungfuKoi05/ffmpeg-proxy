#!/usr/bin/env bash
# One-time setup: checks system tools, installs Python and Node dependencies.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; OFF=$'\033[0m'

say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$OFF" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$OFF" "$*"; }
fail() { printf '%s✗%s %s\n' "$RED" "$OFF" "$*"; }

say "Setting up YouTube Clip Generator in $ROOT"
say ""

# ---------------------------------------------------------------- system tools
missing=0

if command -v ffmpeg >/dev/null 2>&1; then
  ok "ffmpeg  $(ffmpeg -version 2>/dev/null | head -1 | cut -d' ' -f3)"
else
  fail "ffmpeg is not installed"
  case "$(uname -s)" in
    Darwin) say "   ${DIM}brew install ffmpeg${OFF}" ;;
    Linux)  say "   ${DIM}sudo apt install ffmpeg${OFF}   (or your distro's package manager)" ;;
    *)      say "   ${DIM}winget install Gyan.FFmpeg${OFF}" ;;
  esac
  missing=1
fi

command -v ffprobe >/dev/null 2>&1 && ok "ffprobe" || { fail "ffprobe is missing (it ships with ffmpeg)"; missing=1; }

if command -v python3 >/dev/null 2>&1; then
  PY_VERSION="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
  if python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'; then
    ok "python  $PY_VERSION"
  else
    fail "python $PY_VERSION found, but 3.10 or newer is required"
    missing=1
  fi
else
  fail "python3 is not installed"
  missing=1
fi

if command -v node >/dev/null 2>&1; then
  ok "node    $(node --version)"
else
  warn "node is not installed - you can still run the API, but not build the web UI"
  say "   ${DIM}https://nodejs.org (version 18 or newer)${OFF}"
fi

if [ "$missing" -ne 0 ]; then
  say ""
  fail "Install the tools listed above, then run this script again."
  exit 1
fi

# -------------------------------------------------------------------- python
say ""
say "Installing Python dependencies…"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  ok "created .venv"
fi
./.venv/bin/pip install --quiet --upgrade pip
./.venv/bin/pip install --quiet -r backend/requirements.txt
ok "backend dependencies installed"

if [ "${WITH_WHISPER:-0}" = "1" ]; then
  say "Installing faster-whisper (this one is large)…"
  ./.venv/bin/pip install --quiet -r backend/requirements-whisper.txt
  ok "faster-whisper installed"
else
  say "${DIM}  Optional: WITH_WHISPER=1 ./scripts/setup.sh  adds local speech-to-text${OFF}"
  say "${DIM}  for videos that have no captions.${OFF}"
fi

# ---------------------------------------------------------------------- node
if command -v npm >/dev/null 2>&1; then
  say ""
  say "Installing and building the web UI…"
  (cd frontend && npm install --silent && npm run build --silent)
  ok "frontend built into frontend/dist"
fi

# ----------------------------------------------------------------------- env
say ""
if [ ! -f .env ]; then
  cp .env.example .env
  ok "created .env from .env.example"
else
  ok ".env already exists - left untouched"
fi

mkdir -p storage temp
ok "storage directories ready"

say ""
say "${GREEN}Setup complete.${OFF}"
say ""
say "  Start the app:   ./scripts/start.sh"
say "  Then open:       http://127.0.0.1:8000"
say ""
