"""Generate a short title for each clip.

This is honest extraction, not generation: we take the clip's own opening
line, strip filler, and trim it to something readable. When an LLM key is
configured the ranker can replace these with generated titles instead.
"""
from __future__ import annotations

import re

from .text import tokenize
from .types import Candidate

_FILLER_PREFIX = re.compile(
    r"^(?:so|and|but|okay|ok|now|well|right|um|uh|yeah|like|you know|i mean|anyway)[,\s]+",
    re.I,
)
_MULTISPACE = re.compile(r"\s+")


def _clean(text: str) -> str:
    cleaned = _MULTISPACE.sub(" ", text).strip()
    previous = None
    while previous != cleaned:
        previous = cleaned
        cleaned = _FILLER_PREFIX.sub("", cleaned).strip()
    return cleaned


def title_for(cand: Candidate, *, index: int, max_chars: int = 62) -> str:
    source = cand.segments[0].text if cand.segments and cand.segments[0].text else cand.text
    cleaned = _clean(source)

    if not cleaned or len(tokenize(cleaned)) < 3:
        # Nothing usable to quote - fall back to a neutral label.
        return f"Clip {index:02d}"

    # Prefer to end at a natural break rather than mid-phrase.
    if len(cleaned) > max_chars:
        cut = cleaned[:max_chars]
        for sep in (" - ", ", ", " and ", " but ", " because ", " that ", " which "):
            pos = cut.rfind(sep)
            if pos > max_chars * 0.5:
                cut = cut[:pos]
                break
        else:
            pos = cut.rfind(" ")
            if pos > max_chars * 0.5:
                cut = cut[:pos]
        cleaned = cut.rstrip(" ,;:-") + "…"

    cleaned = cleaned.rstrip(" ,;:")
    if cleaned and cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned or f"Clip {index:02d}"


def titles_for(candidates: list[Candidate]) -> list[str]:
    return [title_for(c, index=i + 1) for i, c in enumerate(candidates)]
