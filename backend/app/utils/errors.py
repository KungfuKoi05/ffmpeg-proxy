"""Turning ugly failures into sentences a normal person can act on.

Nothing in here ever leaks a stack trace or a subprocess command line to the
browser. The raw detail is logged server-side; the user gets a plain sentence
and, where useful, a hint about what to do next.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class UserFacingError(Exception):
    """An error we are happy to show verbatim in the UI."""

    code: str
    message: str
    hint: str = ""

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.message

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message, "hint": self.hint}


# Ordered most-specific first. Each entry: (pattern, code, message, hint)
_PATTERNS: tuple[tuple[re.Pattern, str, str, str], ...] = (
    (
        re.compile(r"age[- ]restricted|confirm your age|inappropriate for some users", re.I),
        "video_age_restricted",
        "This video is age-restricted and can't be processed.",
        "Pick a video without an age gate.",
    ),
    (
        re.compile(r"private video|sign in.*confirm|login required|members[- ]only", re.I),
        "video_private",
        "This video is private or restricted to members, so we can't access it.",
        "Try a public video you have permission to use.",
    ),
    (
        re.compile(r"available in your country|blocked it in your country|geo[- ]?restrict|not available from your location", re.I),
        "video_region_blocked",
        "This video isn't available in your region.",
        "",
    ),
    (
        re.compile(r"video unavailable|has been removed|no longer available|does not exist|removed by the uploader", re.I),
        "video_unavailable",
        "We couldn't access this video. Make sure the URL is valid and that the video is still online.",
        "Double-check the link in a browser first.",
    ),
    (
        re.compile(r"is a live event|live stream|premieres in|this live event will begin", re.I),
        "video_is_live",
        "This is a live stream. We can only process videos that have finished.",
        "Wait until the stream ends, then try the recording.",
    ),
    (
        re.compile(r"sign in to confirm.*not a bot|bot|captcha|429|too many requests", re.I),
        "youtube_rate_limited",
        "YouTube is temporarily refusing our requests for this video.",
        "Wait a few minutes and try again.",
    ),
    (
        # Connection-level failures. Checked before download_failed because
        # yt-dlp reports a blocked proxy as "Unable to download API page:
        # <urlopen error Tunnel connection failed>" - telling someone to
        # retry that would waste their time; the network is the problem.
        re.compile(
            r"urlopen error|tunnel connection failed|proxyerror|proxy error|"
            r"name or service not known|temporary failure in name resolution|"
            r"connection reset|connection refused|connection aborted|timed out|ssl",
            re.I,
        ),
        "network_error",
        "We couldn't reach YouTube. This looks like a network problem on this machine.",
        "Check your internet connection or proxy settings, then try again.",
    ),
    (
        re.compile(r"unable to download|http error 4\d\d|http error 5\d\d|fragment.*not found", re.I),
        "download_failed",
        "The download failed partway through.",
        "Check your internet connection and try again.",
    ),
    (
        re.compile(r"no space left on device|errno 28", re.I),
        "disk_full",
        "This machine ran out of disk space while processing.",
        "Free up some space and try again.",
    ),
    (
        re.compile(r"requested format( is)? not available|no video formats found", re.I),
        "format_unavailable",
        "We couldn't find a downloadable video stream for this video.",
        "",
    ),
    (
        re.compile(r"invalid data found|moov atom not found|corrupt|decoder error", re.I),
        "corrupt_media",
        "The downloaded video file looks damaged and couldn't be processed.",
        "Try again - a re-download usually fixes this.",
    ),
    (
        re.compile(r"ffmpeg|ffprobe", re.I),
        "processing_failed",
        "Something went wrong while cutting the video.",
        "See the server log for the exact ffmpeg error.",
    ),
)

_GENERIC = (
    "processing_failed",
    "Something went wrong while processing this video.",
    "Try again, or try a different video.",
)


def to_user_error(exc: BaseException) -> UserFacingError:
    """Map any exception to a message that is safe and useful to display."""
    if isinstance(exc, UserFacingError):
        return exc

    if isinstance(exc, TimeoutError):
        return UserFacingError(
            code="timeout",
            message="Processing took too long and was stopped.",
            hint="Try a shorter video.",
        )

    text = f"{type(exc).__name__}: {exc}"
    for pattern, code, message, hint in _PATTERNS:
        if pattern.search(text):
            return UserFacingError(code=code, message=message, hint=hint)

    code, message, hint = _GENERIC
    return UserFacingError(code=code, message=message, hint=hint)
