"""Using subtitle tracks carried inside an uploaded video file.

Plenty of real exports ship subtitles in the container. Reading them costs one
cheap ffmpeg call and is the difference between transcript-driven clip
selection and falling back to audio-only segmentation.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from backend.app.services import media

pytestmark = pytest.mark.e2e

SAMPLE_SRT = """1
00:00:01,000 --> 00:00:04,500
Most people think learning a language takes years of study.

2
00:00:05,200 --> 00:00:08,000
That is not what the research actually shows.

3
00:00:08,700 --> 00:00:12,500
The single biggest predictor is how many hours you spend listening.
"""


def _mux(source: Path, dest: Path, srt: Path, *, language: str = "eng") -> Path:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(source), "-i", str(srt),
         "-map", "0", "-map", "1", "-c", "copy", "-c:s", "mov_text",
         "-metadata:s:s:0", f"language={language}", str(dest)],
        check=True, capture_output=True, timeout=600,
    )
    return dest


def test_a_file_with_no_subtitles_reports_none(test_video):
    assert media.subtitle_streams(test_video["video"]) == []
    assert media.extract_embedded_subtitles(test_video["video"], test_video["dir"] / "none") == []


def test_an_embedded_track_is_found_and_extracted(test_video, tmp_path):
    srt = tmp_path / "subs.srt"
    srt.write_text(SAMPLE_SRT)
    muxed = _mux(test_video["video"], tmp_path / "with-subs.mp4", srt)

    assert len(media.subtitle_streams(muxed)) == 1

    extracted = media.extract_embedded_subtitles(muxed, tmp_path / "out")
    assert len(extracted) == 1
    assert extracted[0].suffix == ".srt"
    body = extracted[0].read_text()
    assert "learning a language" in body
    assert "-->" in body


def test_the_extracted_track_becomes_a_real_transcript(test_video, tmp_path):
    from backend.app.services.transcript import transcript_from_subtitles

    srt = tmp_path / "subs.srt"
    srt.write_text(SAMPLE_SRT)
    muxed = _mux(test_video["video"], tmp_path / "m.mp4", srt)
    extracted = media.extract_embedded_subtitles(muxed, tmp_path / "out")

    transcript = transcript_from_subtitles(extracted, source="embedded_subtitles")
    assert transcript.available
    assert transcript.source == "embedded_subtitles"
    assert len(transcript.segments) == 3
    assert transcript.segments[0].text.startswith("Most people think")


def test_english_is_preferred_when_several_tracks_exist(test_video, tmp_path):
    srt_en = tmp_path / "en.srt"
    srt_en.write_text(SAMPLE_SRT)
    srt_de = tmp_path / "de.srt"
    srt_de.write_text(SAMPLE_SRT.replace("Most people", "Die meisten Leute"))

    muxed = tmp_path / "multi.mp4"
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(test_video["video"]), "-i", str(srt_de), "-i", str(srt_en),
         "-map", "0", "-map", "1", "-map", "2", "-c", "copy", "-c:s", "mov_text",
         "-metadata:s:s:0", "language=deu", "-metadata:s:s:1", "language=eng",
         str(muxed)],
        check=True, capture_output=True, timeout=600,
    )
    assert len(media.subtitle_streams(muxed)) == 2

    extracted = media.extract_embedded_subtitles(muxed, tmp_path / "out")
    assert len(extracted) == 1
    assert "eng" in extracted[0].name
    assert "Most people" in extracted[0].read_text()


def test_a_damaged_file_does_not_raise(tmp_path):
    """Probing must degrade to 'no subtitles', never blow up a job."""
    broken = tmp_path / "broken.mp4"
    broken.write_bytes(b"not a video at all" * 100)
    assert media.subtitle_streams(broken) == []
    assert media.extract_embedded_subtitles(broken, tmp_path / "out") == []


def test_uploading_a_file_with_subtitles_uses_them(client, test_video, tmp_path):
    """End to end: the demo path, and the reason its clips have real titles."""
    import time

    srt = tmp_path / "subs.srt"
    srt.write_text(test_video["dir"].joinpath("script.json").exists() and SAMPLE_SRT or SAMPLE_SRT)

    # A longer track so selection has real material to work with.
    lines, cursor, index = [], 1.0, 1
    for entry in test_video["script"]["sentences"]:
        def clock(value: float) -> str:
            h, rem = divmod(int(value), 3600)
            m, sec = divmod(rem, 60)
            ms = int(round((value - int(value)) * 1000))
            return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"

        lines.append(f"{index}\n{clock(entry['start'])} --> {clock(entry['end'])}\n{entry['text']}\n")
        index += 1
        cursor = entry["end"]
    srt.write_text("\n".join(lines))

    muxed = _mux(test_video["video"], tmp_path / "talk.mp4", srt)

    with open(muxed, "rb") as handle:
        response = client.post(
            "/api/jobs/upload",
            files={"file": ("Conference Talk.mp4", handle, "video/mp4")},
            data={"aspect_ratio": "9:16", "clip_count": "5"},
        )
    assert response.status_code == 201, response.text
    job_id = response.json()["job"]["id"]

    deadline = time.time() + 900
    while time.time() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in {"COMPLETED", "FAILED"}:
            break
        time.sleep(0.6)

    assert job["status"] == "COMPLETED", job.get("error")
    # The whole point: a transcript was found inside the file.
    assert job["transcript_source"] == "embedded_subtitles"
    assert job["analysis"]["selection_method"] == "heuristic"

    clips = client.get(f"/api/jobs/{job_id}/clips").json()
    assert len(clips) == 5
    # Titles come from the clip's own opening line, not a placeholder.
    generic = [c for c in clips if c["title"].startswith("Clip ")]
    assert not generic, [c["title"] for c in clips]
    assert len({c["title"] for c in clips}) == len(clips)
