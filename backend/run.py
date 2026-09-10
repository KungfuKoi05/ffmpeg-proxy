"""Convenience launcher: `python -m backend.run` or `python backend/run.py`."""
from __future__ import annotations

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import uvicorn  # noqa: E402

from backend.app.config import settings  # noqa: E402


def main() -> None:
    uvicorn.run(
        "backend.app.main:app",
        host=settings.host,
        port=settings.port,
        reload="--reload" in sys.argv,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
