#!/usr/bin/env bash
# One command to try the app for real - no YouTube account, no video of your
# own, no network required.
#
#   ./scripts/demo.sh
#
# Builds a sample video with real speech timing and captions, starts the app,
# and tells you what to click.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'; DIM=$'\033[2m'
BOLD=$'\033[1m'; OFF=$'\033[0m'

MINUTES="${DEMO_MINUTES:-5}"
PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"
SAMPLE_DIR="$ROOT/demo"
SAMPLE="$SAMPLE_DIR/sample-talk.mp4"

if [ "${1:-}" = "--reset" ]; then
  rm -rf "$SAMPLE_DIR" storage temp
  echo "Demo files cleared."
  shift || true
fi

echo
echo "${BOLD}Clip Generator — demo${OFF}"
echo "${DIM}Turns a long video into 5–8 short clips. Everything runs on this machine.${OFF}"
echo

# ---------------------------------------------------------------- 1. setup
if [ ! -x .venv/bin/python ] || [ ! -f frontend/dist/index.html ]; then
  echo "${BOLD}Setting up first (one time)…${OFF}"
  ./scripts/setup.sh
  echo
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "${YELLOW}FFmpeg is required and isn't installed.${OFF}"
  echo "  macOS:  brew install ffmpeg"
  echo "  Ubuntu: sudo apt install ffmpeg"
  exit 1
fi

# ------------------------------------------------------- 2. sample video
if [ ! -f "$SAMPLE" ]; then
  echo "${BOLD}Building a sample video…${OFF}"
  echo "${DIM}About ${MINUTES} minutes of speech across a dozen unrelated topics, with${OFF}"
  echo "${DIM}the sentence being spoken shown on screen. Takes a minute or two, once.${OFF}"
  echo
  mkdir -p "$SAMPLE_DIR"
  ./.venv/bin/python scripts/make_test_video.py \
    --out "$SAMPLE_DIR" --minutes "$MINUTES" --on-screen-text --embed-subtitles >/dev/null
  mv "$SAMPLE_DIR/source.mp4" "$SAMPLE"
  rm -f "$SAMPLE_DIR/source.en.json3" "$SAMPLE_DIR/script.json"
  echo "${GREEN}✓${OFF} sample ready"
  echo
fi

# ------------------------------------------------- 3. can we reach YouTube?
echo "${BOLD}Checking YouTube access…${OFF}"
if ./.venv/bin/python - <<'PY' >/dev/null 2>&1
import sys
sys.path.insert(0, ".")
from backend.app.services import youtube
from backend.app.utils.urls import ParsedVideo
youtube.fetch_metadata(ParsedVideo("aqz-KE-bpKQ"))
PY
then
  YOUTUBE_OK=1
  echo "${GREEN}✓${OFF} YouTube reachable — you can paste a link too"
else
  YOUTUBE_OK=0
  echo "${YELLOW}!${OFF} YouTube is not reachable from this machine"
  echo "  ${DIM}Run ./scripts/doctor.sh to see why. The demo below works regardless.${OFF}"
fi
echo

# ------------------------------------------------------------- 4. serve
# A faster encoder preset so the demo feels responsive. Real runs default to
# 'medium', which is slower and slightly smaller for the same quality.
export VIDEO_PRESET="${VIDEO_PRESET:-veryfast}"

cleanup() { [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

./.venv/bin/python -m uvicorn backend.app.main:app \
  --host "$HOST" --port "$PORT" --log-level warning &
SERVER_PID=$!

URL="http://${HOST}:${PORT}"
for _ in $(seq 1 40); do
  if curl -sf "$URL/api/system/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

if ! curl -sf "$URL/api/system/health" >/dev/null 2>&1; then
  echo "The server didn't start. Try ./scripts/doctor.sh"
  exit 1
fi

# ------------------------------------------------------------ 5. tell them
cat <<EOF

${GREEN}${BOLD}Running.${OFF}  ${BLUE}${URL}${OFF}

${BOLD}Try this:${OFF}

  1. Open ${BLUE}${URL}${OFF}
  2. Click ${BOLD}"or use a video file"${OFF} and pick:

       ${SAMPLE}

  3. Watch the stages, then preview and download the clips.

${DIM}Takes about a minute. You should get 5 clips of 30–60 seconds each.${OFF}

${BOLD}What to look for:${OFF}
  ${DIM}·${OFF} Every clip starts at the beginning of a sentence and ends at the end
    of one — the on-screen text makes that easy to check.
  ${DIM}·${OFF} Each clip is about a different topic. They are not equal slices.
  ${DIM}·${OFF} "Why this clip?" on any card shows the signals that chose it.
  ${DIM}·${OFF} Open ${BOLD}Options${OFF} to try 16:9, square, or burned-in captions.
  ${DIM}·${OFF} ${BOLD}Download All${OFF} gives you a ZIP.

EOF

if [ "$YOUTUBE_OK" = "1" ]; then
  echo "${BOLD}Also try:${OFF} paste a real YouTube link — downloads work from here."
  echo
fi

cat <<EOF
${DIM}The sample is synthetic: generated speech-shaped audio with real sentence
timing, so no one's copyright is involved. Use your own videos, or ones you
have permission to process, for anything real.${OFF}

${DIM}Press Ctrl+C to stop.  Start over with: ./scripts/demo.sh --reset${OFF}

EOF

# Open a browser if we can, but never fail the demo over it.
if command -v open >/dev/null 2>&1; then open "$URL" 2>/dev/null || true
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true
fi

wait "$SERVER_PID"
