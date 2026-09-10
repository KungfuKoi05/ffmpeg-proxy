"""Test fixtures.

Environment is redirected to a throwaway directory *before* the application
is imported, so tests never touch the real database or storage.
"""
from __future__ import annotations

import atexit
import json
import os
import shutil
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="clipgen-tests-"))
atexit.register(lambda: shutil.rmtree(_TMP, ignore_errors=True))

os.environ.setdefault("CLIPGEN_TESTING", "1")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/test.db"
os.environ["OUTPUT_DIRECTORY"] = str(_TMP / "jobs")
os.environ["TEMP_DIRECTORY"] = str(_TMP / "temp")
os.environ["VIDEO_PRESET"] = "veryfast"
os.environ["VIDEO_CRF"] = "23"
os.environ["MAX_CONCURRENT_JOBS"] = "1"
os.environ["LLM_RANKING_ENABLED"] = "0"
os.environ["WHISPER_ENABLED"] = "0"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.app.analyzers.types import Word  # noqa: E402
from backend.app.database import Base, engine, init_db  # noqa: E402
from backend.app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _database():
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def tmp_root() -> Path:
    return _TMP


def make_words(sentences: list[tuple[str, float, float]]) -> list[Word]:
    """Build word-level timings from (text, start, end) sentence tuples."""
    words: list[Word] = []
    for text, start, end in sentences:
        tokens = text.split()
        step = (end - start) / max(1, len(tokens))
        for i, token in enumerate(tokens):
            words.append(
                Word(text=token, start=round(start + i * step, 3), end=round(start + (i + 1) * step, 3))
            )
    return words


@pytest.fixture()
def sample_words() -> list[Word]:
    sentences = [
        ("Most people think learning a language takes years of study.", 1.0, 4.5),
        ("That is not what the research actually shows.", 5.2, 8.0),
        ("The single biggest predictor is how many hours you spend listening.", 8.7, 12.5),
        ("One student listened for two hours every single day.", 13.2, 16.4),
        ("In eleven months she was holding real conversations.", 17.1, 20.3),
        ("The grammar came later, almost by itself.", 21.0, 23.8),
        ("Here is the mistake almost every new runner makes.", 25.4, 28.6),
        ("They run every session as hard as they possibly can.", 29.3, 32.5),
        ("Your body adapts during recovery, not during the workout.", 33.2, 36.6),
        ("So eighty percent of your running should feel easy.", 37.3, 40.4),
        ("That is the whole secret, and nobody wants to hear it.", 41.1, 44.5),
        ("Slow down and you will get faster.", 45.2, 47.6),
        ("Why does bread rise at all?", 49.2, 51.4),
        ("Yeast eats the sugar and releases carbon dioxide.", 52.1, 55.3),
        ("That gas gets trapped by the gluten network you built.", 56.0, 59.4),
        ("If you skip the kneading the loaf stays flat.", 60.1, 63.2),
        ("It is a structural problem, not a chemistry problem.", 63.9, 67.1),
        ("Understanding that changed how I bake everything.", 67.8, 70.6),
    ]
    return make_words(sentences)


@pytest.fixture(scope="session")
def test_video():
    """A real 1080p media file with speech-shaped audio and matching captions.

    Cached between runs: generating it costs about a minute of ffmpeg time.
    """
    import subprocess
    import sys

    cache = Path(tempfile.gettempdir()) / "clipgen-fixture-video"
    video = cache / "source.mp4"
    captions = cache / "source.en.json3"

    if not (video.exists() and captions.exists()):
        script = Path(__file__).resolve().parents[2] / "scripts" / "make_test_video.py"
        subprocess.run(
            [sys.executable, str(script), "--out", str(cache), "--minutes", "6"],
            check=True, capture_output=True, timeout=1800,
        )

    return {
        "dir": cache,
        "video": video,
        "captions": captions,
        "script": json.loads((cache / "script.json").read_text()),
    }
