#!/usr/bin/env bash
# Runs the app: one server, backend API plus the built web UI.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  echo "No .venv found. Run ./scripts/setup.sh first."
  exit 1
fi

if [ ! -d frontend/dist ]; then
  echo "The web UI hasn't been built yet."
  echo "Run:  cd frontend && npm install && npm run build"
  echo "Starting the API only — http://127.0.0.1:8000/docs"
  echo ""
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

echo "YouTube Clip Generator → http://${HOST}:${PORT}"
echo "Press Ctrl+C to stop."
echo ""
exec ./.venv/bin/python -m uvicorn backend.app.main:app --host "$HOST" --port "$PORT"
