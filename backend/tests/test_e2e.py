"""End-to-end: a real job, rendered by real ffmpeg, downloaded over real HTTP.

The only thing standing in for production is the YouTube fetch itself: the
network call is replaced by a local synthetic 1080p video with matching
captions. Everything after that - transcript parsing, silence detection,
candidate scoring, selection, cropping, encoding, thumbnails, HTTP range
playback, downloads, ZIP packaging, cleanup - is the real code path.
"""
from __future__ import annotations

import shutil
import subprocess
import time
import zipfile
from pathlib import Path

import pytest

from backend.app.config import settings
from backend.app.services import youtube
from backend.app.utils.urls import ParsedVideo

pytestmark = pytest.mark.e2e

POLL_TIMEOUT = 900
VALID_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def ffprobe_json(path: Path) -> dict:
    import json

    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, timeout=120, check=True,
    ).stdout
    return json.loads(out)


@pytest.fixture()
def offline_youtube(monkeypatch, test_video):
    """Serve the local fixture instead of downloading from YouTube."""
    def fetch(video: ParsedVideo) -> youtube.VideoMetadata:
        return youtube.VideoMetadata(
            video_id=video.video_id,
            title="Six Ideas Worth Clipping",
            channel="Test Channel",
            duration=test_video["script"]["duration"],
            thumbnail_url=video.thumbnail_url,
            max_height=1080,
            is_live=False,
        )

    def download(video, dest_dir, *, max_height=1080, want_subtitles=True, on_progress=None):
        dest_dir.mkdir(parents=True, exist_ok=True)
        target = dest_dir / "source.mp4"
        subs = dest_dir / "source.en.json3"
        if on_progress:
            on_progress(0.0, "Downloading video…")
        shutil.copy2(test_video["video"], target)
        if want_subtitles:
            shutil.copy2(test_video["captions"], subs)
        if on_progress:
            on_progress(1.0, "Merging video and audio…")
        return youtube.DownloadResult(
            video_path=target,
            subtitle_paths=[subs] if want_subtitles else [],
            subtitle_is_automatic=False,
        )

    monkeypatch.setattr(youtube, "fetch_metadata", fetch)
    monkeypatch.setattr(youtube, "download_video", download)


def run_job(client, options: dict | None = None) -> dict:
    response = client.post("/api/jobs", json={"url": VALID_URL, "options": options or {}})
    assert response.status_code == 201, response.text
    created = response.json()
    job_id = created["job"]["id"]

    seen_stages: list[str] = []
    last_progress = -1.0
    deadline = time.time() + POLL_TIMEOUT

    while time.time() < deadline:
        body = client.get(f"/api/jobs/{job_id}").json()
        if body["status"] not in seen_stages:
            seen_stages.append(body["status"])
        # Progress must never go backwards.
        assert body["progress"] >= last_progress - 0.01, (last_progress, body["progress"])
        last_progress = body["progress"]
        if body["status"] in {"COMPLETED", "FAILED", "CANCELLED"}:
            body["_stages"] = seen_stages
            body["_token"] = created["owner_token"]
            return body
        time.sleep(0.6)

    pytest.fail(f"job did not finish within {POLL_TIMEOUT}s")


# ---------------------------------------------------------------------------
# The full run, asserted end to end
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def _results_cache() -> dict:
    return {}


@pytest.fixture()
def completed(client, offline_youtube, _results_cache):
    """One vertical, captioned run reused by the assertions below."""
    if "job" not in _results_cache:
        job = run_job(client, {"aspect_ratio": "9:16", "captions": True, "quality": "1080p"})
        assert job["status"] == "COMPLETED", job.get("error")
        clips = client.get(f"/api/jobs/{job['id']}/clips").json()
        _results_cache["job"] = job
        _results_cache["clips"] = clips
    return _results_cache


def test_the_job_completes(completed):
    assert completed["job"]["status"] == "COMPLETED"
    assert completed["job"]["progress"] == 100


def test_progress_moved_through_the_real_stages(completed):
    stages = completed["job"]["_stages"]
    assert "COMPLETED" in stages
    # At least one intermediate stage must have been observed, i.e. the bar
    # reflected actual work rather than jumping 0 -> 100.
    assert len(stages) >= 2


def test_between_five_and_eight_clips_were_produced(completed):
    count = len(completed["clips"])
    assert settings.min_clips <= count <= settings.max_clips, f"got {count} clips"


def test_every_clip_is_between_thirty_and_sixty_seconds(completed):
    for clip in completed["clips"]:
        assert 30 - 0.6 <= clip["duration"] <= 60 + 0.6, clip


def test_clips_do_not_overlap_and_are_ordered(completed):
    clips = sorted(completed["clips"], key=lambda c: c["index"])
    assert [c["index"] for c in clips] == list(range(1, len(clips) + 1))
    for a, b in zip(clips, clips[1:]):
        assert a["end"] <= b["start"] + 0.01


def test_clips_are_playable_files_with_video_and_audio(completed):
    from backend.app.services import storage

    for clip in completed["clips"]:
        path = storage.clip_path(completed["job"]["id"], clip["index"])
        assert path.exists() and path.stat().st_size > 50_000
        info = ffprobe_json(path)
        codecs = {s["codec_type"]: s for s in info["streams"]}
        assert "video" in codecs, "clip has no video stream"
        assert "audio" in codecs, "clip lost its audio"
        assert codecs["video"]["codec_name"] == "h264"
        assert codecs["audio"]["codec_name"] == "aac"
        assert float(info["format"]["duration"]) == pytest.approx(clip["duration"], abs=0.5)


def test_output_is_vertical_and_not_upscaled(completed):
    """9:16 from a 1080p source is 606x1080 of real pixels - never blown up."""
    for clip in completed["clips"]:
        assert clip["height"] == 1080, "vertical output should keep full source height"
        ratio = clip["width"] / clip["height"]
        assert ratio == pytest.approx(9 / 16, abs=0.02), (clip["width"], clip["height"])
        assert clip["width"] <= 1920, "width must never exceed the source"


def test_audio_is_not_silent(completed):
    """A clip that plays silence is worse than no clip."""
    from backend.app.services import storage

    clip = completed["clips"][0]
    path = storage.clip_path(completed["job"]["id"], clip["index"])
    result = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
         "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True, text=True, timeout=180,
    )
    mean_lines = [l for l in result.stderr.splitlines() if "mean_volume" in l]
    assert mean_lines, result.stderr[-500:]
    mean_db = float(mean_lines[0].split(":")[-1].replace("dB", "").strip())
    assert mean_db > -50, f"clip audio is effectively silent ({mean_db} dB)"


def test_clips_carry_titles_and_scores(completed):
    for clip in completed["clips"]:
        assert clip["title"] and clip["title"] != ""
        assert 0 <= clip["score"] <= 1
        assert clip["score_breakdown"]
        assert clip["selected_by"] == "heuristic"


def test_transcript_source_is_reported(completed):
    assert completed["job"]["transcript_source"] == "youtube_subtitles"
    assert completed["job"]["analysis"]["segments"] > 20


# ------------------------------------------------------------------ delivery
def test_thumbnails_were_generated(client, completed):
    for clip in completed["clips"]:
        assert clip["thumbnail_url"]
        response = client.get(clip["thumbnail_url"])
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert len(response.content) > 2000


def test_browser_preview_supports_range_requests(client, completed):
    """Without this the <video> scrubber silently refuses to seek."""
    url = completed["clips"][0]["preview_url"]

    full = client.get(url)
    assert full.status_code == 200
    assert full.headers["accept-ranges"] == "bytes"
    total = int(full.headers["content-length"])

    partial = client.get(url, headers={"Range": "bytes=0-1023"})
    assert partial.status_code == 206
    assert partial.headers["content-length"] == "1024"
    assert partial.headers["content-range"] == f"bytes 0-1023/{total}"
    assert len(partial.content) == 1024

    tail = client.get(url, headers={"Range": "bytes=-512"})
    assert tail.status_code == 206
    assert len(tail.content) == 512

    bad = client.get(url, headers={"Range": f"bytes={total + 10}-"})
    assert bad.status_code == 416


def test_individual_download_has_a_safe_friendly_filename(client, completed):
    response = client.get(completed["clips"][0]["download_url"])
    assert response.status_code == 200
    disposition = response.headers["content-disposition"]
    assert "attachment" in disposition
    assert "clip-01.mp4" in disposition
    assert "/" not in disposition.split("filename=")[-1]
    assert len(response.content) > 50_000


def test_download_all_returns_a_valid_zip(client, completed, tmp_path):
    job = completed["job"]
    # The API hands back a tokenised URL precisely so a plain <a href> works.
    assert job["download_all_url"]
    response = client.get(job["download_all_url"])
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"

    archive = tmp_path / "clips.zip"
    archive.write_bytes(response.content)
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        names = bundle.namelist()
    mp4s = [n for n in names if n.endswith(".mp4")]
    assert len(mp4s) == len(completed["clips"])
    assert all("/" not in n and ".." not in n for n in names)


def test_subtitle_sidecars_are_downloadable(client, completed):
    clip = completed["clips"][0]
    assert clip["subtitle_url"]
    response = client.get(clip["subtitle_url"])
    assert response.status_code == 200
    assert "-->" in response.text


def test_captions_were_burned_in(completed):
    assert all(c["has_captions"] for c in completed["clips"])


# ------------------------------------------------------------- housekeeping
def test_the_downloaded_source_was_deleted(completed):
    from backend.app.services import storage

    scratch = storage.work_dir(completed["job"]["id"])
    assert not scratch.exists() or not any(scratch.iterdir()), "temp files were left behind"


def test_finished_clips_are_kept(completed):
    from backend.app.services import storage

    assert storage.clips_dir(completed["job"]["id"]).exists()


def test_a_stranger_cannot_download_your_clips(client, completed):
    clip = completed["clips"][0]
    client.cookies.clear()
    blocked = client.get(
        clip["download_url"].split("?")[0], headers={"X-Owner-Token": "not-your-token"}
    )
    assert blocked.status_code == 404


def test_deleting_the_job_removes_every_file(client, offline_youtube):
    job = run_job(client, {"aspect_ratio": "16:9", "clip_count": 5})
    assert job["status"] == "COMPLETED"

    from backend.app.services import storage

    directory = storage.job_dir(job["id"])
    assert directory.exists()

    assert client.delete(f"/api/jobs/{job['id']}").status_code == 204
    assert not directory.exists()


# ---------------------------------------------------------------- variations
def test_landscape_output_keeps_the_source_framing(client, offline_youtube):
    job = run_job(client, {"aspect_ratio": "16:9", "captions": False, "clip_count": 5})
    assert job["status"] == "COMPLETED"
    clips = client.get(f"/api/jobs/{job['id']}/clips").json()
    assert clips
    for clip in clips:
        assert (clip["width"], clip["height"]) == (1920, 1080)
        assert clip["has_captions"] is False


def test_square_output(client, offline_youtube):
    job = run_job(client, {"aspect_ratio": "1:1", "clip_count": 5})
    assert job["status"] == "COMPLETED"
    clips = client.get(f"/api/jobs/{job['id']}/clips").json()
    for clip in clips:
        assert clip["width"] == clip["height"] == 1080


def test_720p_quality_downscales(client, offline_youtube):
    job = run_job(client, {"aspect_ratio": "16:9", "quality": "720p", "clip_count": 5})
    assert job["status"] == "COMPLETED"
    clips = client.get(f"/api/jobs/{job['id']}/clips").json()
    for clip in clips:
        assert clip["height"] == 720


def test_a_job_with_no_transcript_still_produces_clips(client, monkeypatch, offline_youtube, test_video):
    """Videos with no captions fall back to audio-only segmentation."""
    import shutil as _shutil

    def download_without_subs(video, dest_dir, *, max_height=1080, want_subtitles=True, on_progress=None):
        dest_dir.mkdir(parents=True, exist_ok=True)
        target = dest_dir / "source.mp4"
        _shutil.copy2(test_video["video"], target)
        return youtube.DownloadResult(video_path=target, subtitle_paths=[])

    monkeypatch.setattr(youtube, "download_video", download_without_subs)
    job = run_job(client, {"aspect_ratio": "16:9", "clip_count": 5})
    assert job["status"] == "COMPLETED", job.get("error")
    assert job["transcript_source"] == "none"
    assert job["analysis"]["selection_method"] == "audio_only"

    clips = client.get(f"/api/jobs/{job['id']}/clips").json()
    assert clips
    for clip in clips:
        assert 30 - 0.6 <= clip["duration"] <= 60 + 0.6


def test_a_download_failure_surfaces_as_a_readable_error(client, monkeypatch, offline_youtube):
    def broken(video, dest_dir, **kwargs):
        raise RuntimeError("ERROR: unable to download video data: HTTP Error 403: Forbidden")

    monkeypatch.setattr(youtube, "download_video", broken)
    job = run_job(client)
    assert job["status"] == "FAILED"
    assert job["error"]["code"] == "download_failed"
    assert "Traceback" not in job["error"]["message"]
