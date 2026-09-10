"""API surface: validation, job lifecycle, ownership isolation, error shapes."""
from __future__ import annotations

import pytest

from backend.app.services import youtube
from backend.app.utils.errors import UserFacingError
from backend.app.utils.urls import ParsedVideo
from backend.app.workers.job_worker import job_manager

VALID_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


@pytest.fixture()
def fake_youtube(monkeypatch):
    """Stand in for the network so API tests are deterministic and offline."""
    def fetch(video: ParsedVideo) -> youtube.VideoMetadata:
        return youtube.VideoMetadata(
            video_id=video.video_id,
            title="A Perfectly Normal Test Video",
            channel="Test Channel",
            duration=600.0,
            thumbnail_url="https://i.ytimg.com/vi/x/hqdefault.jpg",
            max_height=1080,
            is_live=False,
        )

    monkeypatch.setattr(youtube, "fetch_metadata", fetch)
    monkeypatch.setattr(job_manager, "submit", lambda job_id: None)
    return fetch


# ------------------------------------------------------------------- system
def test_system_status_reports_dependencies(client):
    body = client.get("/api/system/status").json()
    names = {d["name"] for d in body["dependencies"]}
    assert {"ffmpeg", "ffprobe", "yt-dlp"} <= names
    assert isinstance(body["ready"], bool)
    assert body["limits"]["min_clip_seconds"] == 30


def test_health(client):
    assert client.get("/api/system/health").status_code == 200


# ------------------------------------------------------------- job creation
def test_create_job_returns_a_queued_job(client, fake_youtube):
    response = client.post("/api/jobs", json={"url": VALID_URL})
    assert response.status_code == 201
    body = response.json()
    assert body["job"]["status"] == "QUEUED"
    assert body["job"]["video"]["title"] == "A Perfectly Normal Test Video"
    assert body["owner_token"]
    assert body["job"]["progress"] == 0


@pytest.mark.parametrize(
    "url",
    ["https://vimeo.com/1", "not-a-url", "", "https://youtube.com/playlist?list=PL1"],
)
def test_invalid_urls_are_rejected_with_a_readable_message(client, fake_youtube, url):
    response = client.post("/api/jobs", json={"url": url})
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["message"]
    assert "Traceback" not in detail["message"]


def test_options_are_stored_on_the_job(client, fake_youtube):
    response = client.post(
        "/api/jobs",
        json={
            "url": VALID_URL,
            "options": {
                "aspect_ratio": "16:9",
                "captions": True,
                "quality": "720p",
                "clip_count": 6,
            },
        },
    )
    options = response.json()["job"]["options"]
    assert options["aspect_ratio"] == "16:9"
    assert options["captions"] is True
    assert options["quality"] == "720p"
    assert options["clip_count"] == 6


def test_bad_option_values_are_rejected(client, fake_youtube):
    response = client.post(
        "/api/jobs", json={"url": VALID_URL, "options": {"aspect_ratio": "4:3"}}
    )
    assert response.status_code == 422


def test_max_below_min_clip_length_is_rejected(client, fake_youtube):
    response = client.post(
        "/api/jobs",
        json={"url": VALID_URL, "options": {"min_clip_seconds": 60, "max_clip_seconds": 30}},
    )
    assert response.status_code == 422


def test_live_streams_are_refused(client, monkeypatch, fake_youtube):
    def live(video):
        return youtube.VideoMetadata(
            video_id=video.video_id, title="Live", channel=None, duration=0.0,
            thumbnail_url=None, max_height=1080, is_live=True,
        )

    monkeypatch.setattr(youtube, "fetch_metadata", live)
    response = client.post("/api/jobs", json={"url": VALID_URL})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "video_is_live"


def test_very_short_videos_are_refused(client, monkeypatch, fake_youtube):
    def short(video):
        return youtube.VideoMetadata(
            video_id=video.video_id, title="Short", channel=None, duration=20.0,
            thumbnail_url=None, max_height=1080, is_live=False,
        )

    monkeypatch.setattr(youtube, "fetch_metadata", short)
    assert client.post("/api/jobs", json={"url": VALID_URL}).json()["detail"]["code"] == "video_too_short"


def test_very_long_videos_are_refused(client, monkeypatch, fake_youtube):
    def long_video(video):
        return youtube.VideoMetadata(
            video_id=video.video_id, title="Long", channel=None, duration=99999.0,
            thumbnail_url=None, max_height=1080, is_live=False,
        )

    monkeypatch.setattr(youtube, "fetch_metadata", long_video)
    assert client.post("/api/jobs", json={"url": VALID_URL}).json()["detail"]["code"] == "video_too_long"


def test_unavailable_video_gets_a_human_message(client, monkeypatch, fake_youtube):
    def boom(video):
        raise RuntimeError("ERROR: [youtube] xyz: Video unavailable")

    monkeypatch.setattr(youtube, "fetch_metadata", boom)
    detail = client.post("/api/jobs", json={"url": VALID_URL}).json()["detail"]
    assert detail["code"] == "video_unavailable"
    assert "couldn't access this video" in detail["message"]


def test_private_video_gets_a_human_message(client, monkeypatch, fake_youtube):
    def boom(video):
        raise RuntimeError("ERROR: Private video. Sign in if you've been granted access")

    monkeypatch.setattr(youtube, "fetch_metadata", boom)
    assert client.post("/api/jobs", json={"url": VALID_URL}).json()["detail"]["code"] == "video_private"


# ------------------------------------------------------------------ polling
def test_job_status_can_be_polled(client, fake_youtube):
    job_id = client.post("/api/jobs", json={"url": VALID_URL}).json()["job"]["id"]
    body = client.get(f"/api/jobs/{job_id}").json()
    assert body["id"] == job_id
    assert body["stage"]
    assert body["clip_count"] == 0


def test_unknown_job_is_a_404(client):
    assert client.get("/api/jobs/deadbeef").status_code == 404


def test_unknown_clip_is_a_404(client):
    assert client.get("/api/clips/deadbeef").status_code == 404


def test_clips_endpoint_is_empty_until_processing_finishes(client, fake_youtube):
    job_id = client.post("/api/jobs", json={"url": VALID_URL}).json()["job"]["id"]
    assert client.get(f"/api/jobs/{job_id}/clips").json() == []


def test_download_all_before_completion_is_refused(client, fake_youtube):
    job_id = client.post("/api/jobs", json={"url": VALID_URL}).json()["job"]["id"]
    assert client.get(f"/api/jobs/{job_id}/download-all").status_code == 409


# ---------------------------------------------------------------- ownership
def test_another_visitor_cannot_read_your_job(client, fake_youtube):
    created = client.post("/api/jobs", json={"url": VALID_URL}).json()
    job_id = created["job"]["id"]
    assert client.get(f"/api/jobs/{job_id}").status_code == 200

    client.cookies.clear()
    stranger = client.get(f"/api/jobs/{job_id}", headers={"X-Owner-Token": "someone-else"})
    assert stranger.status_code == 404


def test_the_owner_token_works_as_a_header_and_as_a_query_param(client, fake_youtube):
    created = client.post("/api/jobs", json={"url": VALID_URL}).json()
    job_id, token = created["job"]["id"], created["owner_token"]

    client.cookies.clear()
    assert client.get(f"/api/jobs/{job_id}", headers={"X-Owner-Token": token}).status_code == 200
    assert client.get(f"/api/jobs/{job_id}?t={token}").status_code == 200


def test_deleting_a_job_removes_it(client, fake_youtube):
    job_id = client.post("/api/jobs", json={"url": VALID_URL}).json()["job"]["id"]
    assert client.delete(f"/api/jobs/{job_id}").status_code == 204
    assert client.get(f"/api/jobs/{job_id}").status_code == 404


# ------------------------------------------------------------------ preview
def test_preview_returns_metadata_without_starting_work(client, fake_youtube):
    body = client.post("/api/jobs/preview", json={"url": VALID_URL}).json()
    assert body["can_process"] is True
    assert body["video"]["duration_label"] == "10:00"


def test_preview_flags_a_video_it_cannot_process(client, monkeypatch, fake_youtube):
    def live(video):
        return youtube.VideoMetadata(
            video_id=video.video_id, title="Live", channel=None, duration=0.0,
            thumbnail_url=None, max_height=1080, is_live=True,
        )

    monkeypatch.setattr(youtube, "fetch_metadata", live)
    body = client.post("/api/jobs/preview", json={"url": VALID_URL}).json()
    assert body["can_process"] is False
    assert body["reason"]


# ------------------------------------------------------------ error shaping
def test_errors_never_leak_internals(client, monkeypatch, fake_youtube):
    def boom(video):
        raise RuntimeError("/home/secret/path/app.py line 42: KeyError('token')")

    monkeypatch.setattr(youtube, "fetch_metadata", boom)
    detail = client.post("/api/jobs", json={"url": VALID_URL}).json()["detail"]
    assert "/home/secret" not in detail["message"]
    assert "KeyError" not in detail["message"]
