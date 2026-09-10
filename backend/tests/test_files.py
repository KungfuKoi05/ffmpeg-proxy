"""Filename sanitising and path containment."""
from __future__ import annotations

import pytest

from backend.app.utils.files import format_timestamp, safe_join, sanitize_filename


@pytest.mark.parametrize(
    "raw,expected_absent",
    [
        ("../../etc/passwd", "/"),
        ("clip\x00name", "\x00"),
        ("my/video\\name", "/"),
        ("a:b*c?d", ":"),
    ],
)
def test_sanitize_strips_dangerous_characters(raw, expected_absent):
    assert expected_absent not in sanitize_filename(raw)


def test_sanitize_keeps_something_readable():
    assert sanitize_filename("How to Bake Bread! (2024)") == "How_to_Bake_Bread_2024"


def test_sanitize_handles_unicode_and_emoji():
    result = sanitize_filename("Café ☕ Tutorial 日本語")
    assert result and result.isascii()


def test_sanitize_falls_back_when_nothing_survives():
    assert sanitize_filename("🎬🎬🎬") == "file"
    assert sanitize_filename("") == "file"


def test_sanitize_avoids_windows_reserved_names():
    assert sanitize_filename("CON").upper() != "CON"


def test_sanitize_truncates():
    assert len(sanitize_filename("a" * 500)) <= 80


def test_safe_join_allows_children(tmp_path):
    assert safe_join(tmp_path, "jobs", "abc.mp4").is_relative_to(tmp_path)


@pytest.mark.parametrize("parts", [("..",), ("..", "..", "etc"), ("/etc/passwd",), ("a", "..", "..")])
def test_safe_join_refuses_escapes(tmp_path, parts):
    with pytest.raises(ValueError):
        safe_join(tmp_path, *parts)


@pytest.mark.parametrize(
    "seconds,expected",
    [(0, "0:00"), (48, "0:48"), (59.6, "1:00"), (61, "1:01"), (3723, "1:02:03")],
)
def test_format_timestamp(seconds, expected):
    assert format_timestamp(seconds) == expected
