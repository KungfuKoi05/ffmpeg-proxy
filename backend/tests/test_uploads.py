"""The local-file path: validation, safety, and a full job end to end.

This route matters because it is the one that cannot be broken by YouTube
changing its mind. Everything after the file lands on disk is the same
pipeline a downloaded video goes through.
"""
from __future__ import annotations

import io
import subprocess
from pathlib import Path

import pytest

from backend.app.config import settings
from backend.app.services import uploads
from backend.app.utils.errors import UserFacingError
from backend.app.workers.job_worker import job_manager


# --------------------------------------------------------------- filenames
@pytest.mark.parametrize(
    "filename,expected",
    [
        ("clip.mp4", ".mp4"),
        ("CLIP.MP4", ".mp4"),
        ("movie.mkv", ".mkv"),
        ("talk.webm", ".webm"),
        ("payload.exe", ".mp4"),          # not an allowed container
        ("archive.mp4.exe", ".mp4"),      # only the final suffix counts
        ("../../../etc/passwd", ".mp4"),
        (None, ".mp4"),
        ("", ".mp4"),
    ],
)
def test_extension_is_chosen_by_us_not_by_the_uploader(filename, expected):
    assert uploads.safe_extension(filename) == expected


@pytest.mark.parametrize(
    "filename",
    ["../../../etc/passwd", "..\\..\\windows\\system32", "a/b/c.mp4", "\x00evil.mp4"],
)
def test_titles_from_hostile_filenames_contain_no_path(filename):
    title = uploads.display_title(filename)
    assert "/" not in title and "\\" not in title and "\x00" not in title
    assert ".." not in title


def test_title_is_readable():
    assert uploads.display_title("My_Great-Talk_2024.mp4") == "My Great Talk 2024"


# ------------------------------------------------------------------- limits
def test_oversized_uploads_are_refused_before_they_fill_the_disk(tmp_path):
    """The cap is enforced on bytes written, never on a declared length."""
    dest = tmp_path / "big.mp4"
    with pytest.raises(UserFacingError) as caught:
        uploads.stream_to_disk(io.BytesIO(b"x" * 5_000_000), dest, max_bytes=1_000_000)
    assert caught.value.code == "upload_too_large"
    assert not dest.exists(), "the partial file must be removed"


def test_empty_uploads_are_refused(tmp_path):
    with pytest.raises(UserFacingError) as caught:
        uploads.stream_to_disk(io.BytesIO(b""), tmp_path / "empty.mp4")
    assert caught.value.code == "upload_empty"


def test_a_file_that_is_not_a_video_is_refused(tmp_path):
    """An .mp4 extension proves nothing - ffprobe decides."""
    fake = tmp_path / "notavideo.mp4"
    fake.write_bytes(b"This is plain text pretending to be an MP4." * 500)
    with pytest.raises(UserFacingError) as caught:
        uploads.verify(fake, filename="notavideo.mp4")
    assert caught.value.code == "upload_not_video"


def test_an_audio_only_file_is_refused(tmp_path):
    audio = tmp_path / "podcast.m4a"
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=120",
         "-c:a", "aac", str(audio)],
        check=True, capture_output=True, timeout=300,
    )
    with pytest.raises(UserFacingError) as caught:
        uploads.verify(audio, filename="podcast.m4a")
    assert caught.value.code == "upload_not_video"


def test_a_too_short_video_is_refused(tmp_path):
    short = tmp_path / "short.mp4"
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", "testsrc2=s=320x240:r=15:d=5",
         "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(short)],
        check=True, capture_output=True, timeout=300,
    )
    with pytest.raises(UserFacingError) as caught:
        uploads.verify(short, filename="short.mp4")
    assert caught.value.code == "video_too_short"
    assert str(settings.min_video_duration // 60) in caught.value.hint


# ---------------------------------------------------------------- API layer
def _post_upload(client, path: Path, filename: str | None = None, **options):
    with open(path, "rb") as handle:
        return client.post(
            "/api/jobs/upload",
            files={"file": (filename or path.name, handle, "video/mp4")},
            data={k: str(v) for k, v in options.items()},
        )


@pytest.fixture()
def no_worker(monkeypatch):
    monkeypatch.setattr(job_manager, "submit", lambda job_id: None)


@pytest.mark.e2e
def test_upload_endpoint_rejects_a_non_video(client, no_worker, tmp_path):
    fake = tmp_path / "resume.mp4"
    fake.write_bytes(b"not a video" * 1000)
    response = _post_upload(client, fake)
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "upload_not_video"


@pytest.mark.e2e
def test_upload_endpoint_rejects_bad_options(client, no_worker, test_video):
    response = _post_upload(client, test_video["video"], aspect_ratio="4:3")
    assert response.status_code == 422


@pytest.mark.e2e
def test_a_rejected_upload_leaves_nothing_behind(client, no_worker, tmp_path):
    fake = tmp_path / "junk.mp4"
    fake.write_bytes(b"junk" * 5000)
    _post_upload(client, fake)
    staging = settings.temp_dir / "_staging"
    assert not staging.exists() or not any(staging.iterdir())


@pytest.mark.e2e
def test_uploaded_job_reports_itself_as_an_upload(client, no_worker, test_video):
    response = _post_upload(client, test_video["video"], filename="Conference Talk.mp4")
    assert response.status_code == 201, response.text
    job = response.json()["job"]
    assert job["source_kind"] == "upload"
    assert job["video"]["video_id"] is None
    assert job["video"]["title"] == "Conference Talk"
    # Real properties, read off the file rather than taken on trust.
    assert job["video"]["resolution"] == "1080p"
    assert job["video"]["duration_label"]


# ------------------------------------------------------------ full pipeline
@pytest.mark.e2e
def test_an_uploaded_file_produces_real_clips(client, test_video):
    """The whole point: this path works with no network at all."""
    import time

    response = _post_upload(client, test_video["video"], aspect_ratio="9:16", clip_count=5)
    assert response.status_code == 201, response.text
    job_id = response.json()["job"]["id"]

    deadline = time.time() + 900
    job = None
    while time.time() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in {"COMPLETED", "FAILED", "CANCELLED"}:
            break
        time.sleep(0.6)

    assert job and job["status"] == "COMPLETED", (job or {}).get("error")
    assert job["source_kind"] == "upload"

    clips = client.get(f"/api/jobs/{job_id}/clips").json()
    assert len(clips) == 5
    for clip in clips:
        assert 30 - 0.6 <= clip["duration"] <= 60 + 0.6
        assert clip["height"] == 1080
        assert clip["width"] / clip["height"] == pytest.approx(9 / 16, abs=0.02)

    # Downloadable exactly like a YouTube-sourced clip.
    assert client.get(clips[0]["download_url"]).status_code == 200
    assert client.get(job["download_all_url"]).status_code == 200


@pytest.mark.e2e
def test_the_uploaded_source_is_deleted_after_rendering(client, test_video):
    import time

    from backend.app.services import storage

    response = _post_upload(client, test_video["video"], aspect_ratio="16:9", clip_count=5)
    job_id = response.json()["job"]["id"]

    deadline = time.time() + 900
    while time.time() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in {"COMPLETED", "FAILED"}:
            break
        time.sleep(0.6)

    assert job["status"] == "COMPLETED", job.get("error")
    scratch = storage.work_dir(job_id)
    assert not scratch.exists() or not any(scratch.iterdir())
