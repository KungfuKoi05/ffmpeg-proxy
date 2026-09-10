"""Every failure mode becomes a sentence a non-technical user can act on."""
from __future__ import annotations

import pytest

from backend.app.utils.errors import UserFacingError, to_user_error


@pytest.mark.parametrize(
    "raw,expected_code",
    [
        ("ERROR: Private video. Sign in if you've been granted access", "video_private"),
        ("ERROR: Video unavailable. This video has been removed", "video_unavailable"),
        ("Sign in to confirm your age. This video may be inappropriate for some users.", "video_age_restricted"),
        ("The uploader has not made this video available in your country", "video_region_blocked"),
        ("ERROR: This live event will begin in 3 hours", "video_is_live"),
        ("HTTP Error 429: Too Many Requests", "youtube_rate_limited"),
        ("ERROR: unable to download video data: HTTP Error 403", "download_failed"),
        ("<urlopen error [Errno -3] Temporary failure in name resolution>", "network_error"),
        ("OSError: [Errno 28] No space left on device", "disk_full"),
        ("ERROR: requested format is not available", "format_unavailable"),
        ("moov atom not found", "corrupt_media"),
        ("ffmpeg failed (1): Conversion failed", "processing_failed"),
    ],
)
def test_known_failures_map_to_specific_codes(raw, expected_code):
    assert to_user_error(RuntimeError(raw)).code == expected_code


def test_unknown_failures_get_a_safe_generic_message():
    error = to_user_error(ValueError("some internal detail at 0x7f00"))
    assert error.code == "processing_failed"
    assert "0x7f00" not in error.message


def test_timeouts_are_recognised():
    assert to_user_error(TimeoutError("ffmpeg timed out")).code == "timeout"


def test_user_facing_errors_pass_through_untouched():
    original = UserFacingError(code="custom", message="A specific thing happened.", hint="Do X.")
    assert to_user_error(original) is original


def test_messages_are_complete_sentences():
    for raw in ["Private video", "Video unavailable", "No space left on device"]:
        message = to_user_error(RuntimeError(raw)).message
        assert message[0].isupper()
        assert message.endswith((".", "!"))
