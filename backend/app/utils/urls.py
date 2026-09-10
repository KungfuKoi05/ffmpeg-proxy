"""YouTube URL validation.

Security note: we never hand a user-supplied URL to yt-dlp. We extract the
11-character video ID, validate its character set, and rebuild a canonical
URL ourselves. That removes every class of injection or redirect trick that
could be smuggled in through the original string.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import parse_qs, unquote, urlparse

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

_ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}

# /watch?v=ID handled separately; these are path-shaped forms.
_PATH_PATTERNS = (
    re.compile(r"^/shorts/(?P<id>[A-Za-z0-9_-]{11})"),
    re.compile(r"^/embed/(?P<id>[A-Za-z0-9_-]{11})"),
    re.compile(r"^/live/(?P<id>[A-Za-z0-9_-]{11})"),
    re.compile(r"^/v/(?P<id>[A-Za-z0-9_-]{11})"),
)


class InvalidYouTubeURL(ValueError):
    """Raised when a string is not a usable YouTube video link."""


@dataclass(frozen=True)
class ParsedVideo:
    video_id: str

    @property
    def canonical_url(self) -> str:
        return f"https://www.youtube.com/watch?v={self.video_id}"

    @property
    def thumbnail_url(self) -> str:
        return f"https://i.ytimg.com/vi/{self.video_id}/hqdefault.jpg"


def parse_youtube_url(raw: str) -> ParsedVideo:
    """Return the video ID for a YouTube link, or raise InvalidYouTubeURL."""
    if not isinstance(raw, str):
        raise InvalidYouTubeURL("Please paste a YouTube link.")

    candidate = unquote(raw.strip())
    if not candidate:
        raise InvalidYouTubeURL("Please paste a YouTube link.")
    if len(candidate) > 2048:
        raise InvalidYouTubeURL("That link is too long to be a YouTube URL.")
    if any(ch in candidate for ch in "\n\r\t\x00"):
        raise InvalidYouTubeURL("That link contains characters we can't accept.")

    # A bare video ID is a convenience we accept.
    if VIDEO_ID_RE.match(candidate):
        return ParsedVideo(candidate)

    if "://" not in candidate:
        candidate = "https://" + candidate

    try:
        parsed = urlparse(candidate)
    except ValueError as exc:  # malformed IPv6 literals etc.
        raise InvalidYouTubeURL("That doesn't look like a valid web address.") from exc

    if parsed.scheme not in {"http", "https"}:
        raise InvalidYouTubeURL("Only http and https links are supported.")

    host = (parsed.hostname or "").lower()
    if host not in _ALLOWED_HOSTS:
        raise InvalidYouTubeURL(
            "That's not a YouTube link. Paste a youtube.com or youtu.be URL."
        )

    path = parsed.path or "/"

    # youtu.be/<id>
    if host.endswith("youtu.be"):
        video_id = path.lstrip("/").split("/")[0]
        if VIDEO_ID_RE.match(video_id):
            return ParsedVideo(video_id)
        raise InvalidYouTubeURL("That short link doesn't contain a valid video ID.")

    # youtube.com/watch?v=<id>
    if path in {"/watch", "/watch/"}:
        values = parse_qs(parsed.query).get("v", [])
        if values and VIDEO_ID_RE.match(values[0]):
            return ParsedVideo(values[0])
        raise InvalidYouTubeURL("That watch link is missing a valid video ID.")

    for pattern in _PATH_PATTERNS:
        match = pattern.match(path)
        if match:
            return ParsedVideo(match.group("id"))

    # Playlist / channel / search pages are valid YouTube URLs but not videos.
    if path.startswith(("/playlist", "/channel", "/c/", "/user/", "/@", "/results")):
        raise InvalidYouTubeURL(
            "That's a channel or playlist link. Paste a link to a single video."
        )

    raise InvalidYouTubeURL("We couldn't find a video ID in that link.")


def is_valid_youtube_url(raw: str) -> bool:
    try:
        parse_youtube_url(raw)
    except InvalidYouTubeURL:
        return False
    return True
