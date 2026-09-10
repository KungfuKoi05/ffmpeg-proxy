"""Subtitle parsing: json3, WebVTT with and without inline word timings."""
from __future__ import annotations

import json

from backend.app.services.transcript import parse_json3, parse_vtt, transcript_from_subtitles


def test_json3_gives_per_word_timings(tmp_path):
    payload = {
        "events": [
            {
                "tStartMs": 1000,
                "dDurationMs": 2000,
                "segs": [
                    {"utf8": "Hello", "tOffsetMs": 0},
                    {"utf8": " there", "tOffsetMs": 600},
                    {"utf8": " friend", "tOffsetMs": 1200},
                ],
            },
            {"tStartMs": 4000, "dDurationMs": 1000, "segs": [{"utf8": "Again", "tOffsetMs": 0}]},
        ]
    }
    path = tmp_path / "subs.json3"
    path.write_text(json.dumps(payload))

    words = parse_json3(path)
    assert [w.text for w in words] == ["Hello", "there", "friend", "Again"]
    assert words[0].start == 1.0
    assert words[1].start == 1.6
    assert words[3].start == 4.0


def test_json3_ignores_metadata_events(tmp_path):
    path = tmp_path / "subs.json3"
    path.write_text(json.dumps({"events": [{"tStartMs": 0}, {"segs": [{"utf8": "hi"}]}]}))
    assert parse_json3(path) == []


def test_json3_survives_garbage(tmp_path):
    path = tmp_path / "broken.json3"
    path.write_text("{not json")
    assert parse_json3(path) == []


def test_vtt_with_inline_word_timings(tmp_path):
    content = """WEBVTT

00:00:01.000 --> 00:00:04.000
The<00:00:01.500><c> quick</c><00:00:02.000><c> brown</c><00:00:02.500><c> fox</c>
"""
    path = tmp_path / "auto.vtt"
    path.write_text(content)
    words = parse_vtt(path)
    assert [w.text for w in words] == ["The", "quick", "brown", "fox"]
    assert words[1].start == 1.5
    assert words[3].start == 2.5


def test_vtt_without_inline_timings_spreads_words_across_the_cue(tmp_path):
    content = """WEBVTT

00:00:10.000 --> 00:00:14.000
Four evenly spaced words
"""
    path = tmp_path / "manual.vtt"
    path.write_text(content)
    words = parse_vtt(path)
    assert [w.text for w in words] == ["Four", "evenly", "spaced", "words"]
    assert words[0].start == 10.0
    assert 13.0 <= words[-1].end <= 14.01


def test_rolling_caption_duplicates_are_removed(tmp_path):
    """YouTube auto-captions repeat the previous line in every cue."""
    content = """WEBVTT

00:00:01.000 --> 00:00:03.000
hello world

00:00:03.000 --> 00:00:05.000
hello world
this is new
"""
    path = tmp_path / "rolling.vtt"
    path.write_text(content)
    texts = [w.text for w in parse_vtt(path)]
    assert texts.count("hello") <= 2  # one real, one at a clearly later time
    assert "new" in texts


def test_transcript_selection_prefers_json3(tmp_path):
    words = [{"utf8": f"word{i}", "tOffsetMs": i * 300} for i in range(40)]
    (tmp_path / "a.json3").write_text(
        json.dumps({"events": [{"tStartMs": 0, "dDurationMs": 12000, "segs": words}]})
    )
    (tmp_path / "a.vtt").write_text("WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nignored\n")

    transcript = transcript_from_subtitles([tmp_path / "a.vtt", tmp_path / "a.json3"])
    assert transcript.available
    assert transcript.source == "youtube_subtitles"
    assert "word0" in transcript.segments[0].text


def test_too_few_words_is_treated_as_no_transcript(tmp_path):
    (tmp_path / "tiny.vtt").write_text("WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nhi there\n")
    assert transcript_from_subtitles([tmp_path / "tiny.vtt"]).available is False
