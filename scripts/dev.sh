#!/usr/bin/env bash
# Development mode: FastAPI with auto-reload plus the Vite dev server.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  echo "No .venv found. Run ./scripts/setup.sh first."
  exit 1
fi

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

./.venv/bin/python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000 &
(cd frontend && npm run dev) &

echo ""
echo "  API   → http://127.0.0.1:8000/docs"
echo "  UI    → http://127.0.0.1:5173   (open this one)"
echo ""
wait
