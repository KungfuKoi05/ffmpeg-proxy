"""URL validation is the security boundary: nothing else sees raw user input."""
from __future__ import annotations

import pytest

from backend.app.utils.urls import InvalidYouTubeURL, is_valid_youtube_url, parse_youtube_url

VALID = [
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("http://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://youtu.be/dQw4w9WgXcQ?t=42", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("  https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx  ", "dQw4w9WgXcQ"),
    ("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
]

INVALID = [
    "",
    "   ",
    "not a url at all",
    "https://vimeo.com/12345",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/@somechannel",
    "https://www.youtube.com/results?search_query=cats",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ\nrm -rf /",
    "https://evil.example/?x=https://youtube.com/watch?v=dQw4w9WgXcQ",
]


@pytest.mark.parametrize("url,expected", VALID)
def test_accepts_real_youtube_urls(url, expected):
    assert parse_youtube_url(url).video_id == expected


@pytest.mark.parametrize("url", INVALID)
def test_rejects_everything_else(url):
    with pytest.raises(InvalidYouTubeURL):
        parse_youtube_url(url)
    assert is_valid_youtube_url(url) is False


def test_canonical_url_is_rebuilt_not_echoed():
    """The URL handed to yt-dlp is ours, not the user's string."""
    parsed = parse_youtube_url("https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL&index=9")
    assert parsed.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_rejects_absurdly_long_input():
    with pytest.raises(InvalidYouTubeURL):
        parse_youtube_url("https://youtube.com/watch?v=" + "A" * 4000)


def test_rejects_control_characters():
    with pytest.raises(InvalidYouTubeURL):
        parse_youtube_url("https://youtu.be/dQw4w9WgXcQ\x00")
