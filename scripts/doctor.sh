#!/usr/bin/env bash
# Diagnose whether this machine can run the app, and what to fix if not.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -x .venv/bin/python ]; then
  exec ./.venv/bin/python scripts/doctor.py "$@"
fi

echo "No .venv found - run ./scripts/setup.sh first."
echo "Checking system tools anyway:"
exec python3 scripts/doctor.py "$@"
