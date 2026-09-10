"""Turn a flat list of timed words into sentence-like segments.

YouTube's automatic captions have no punctuation at all, so we cannot just
split on full stops. The fallback is prosody: people pause between thoughts.
A gap of ~0.55s between words is a comma; ~1.0s is usually a full stop.
"""
from __future__ import annotations

from .text import TERMINAL_PUNCT, ends_sentence
from .types import Segment, Transcript, Word

SOFT_PAUSE = 0.55       # likely clause break
HARD_PAUSE = 1.00       # likely sentence break
MAX_WORDS_NO_PUNCT = 16  # never let a pause-built segment run away
MAX_SEGMENT_SECONDS = 14.0


def _punctuation_ratio(words: list[Word]) -> float:
    if not words:
        return 0.0
    terminal = sum(1 for w in words if w.text.strip().endswith(tuple(TERMINAL_PUNCT)))
    return terminal / len(words)


def segment_words(words: list[Word], *, language: str = "en", source: str = "none") -> Transcript:
    """Group words into segments and annotate their boundaries."""
    words = [w for w in words if w.text.strip()]
    if not words:
        return Transcript(words=[], segments=[], language=language, source=source)

    # If at least 1 in 40 words ends a sentence, punctuation is real and usable.
    has_punct = _punctuation_ratio(words) >= 0.025

    groups: list[list[Word]] = []
    current: list[Word] = []

    for i, word in enumerate(words):
        current.append(word)
        next_word = words[i + 1] if i + 1 < len(words) else None
        if next_word is None:
            break

        gap = max(0.0, next_word.start - word.end)
        span = word.end - current[0].start

        should_split = False
        if has_punct:
            if ends_sentence(word.text):
                should_split = True
            # Even with punctuation, a very long pause is a break.
            elif gap >= HARD_PAUSE * 1.5:
                should_split = True
            elif span >= MAX_SEGMENT_SECONDS and gap >= 0.25:
                should_split = True
        else:
            if gap >= HARD_PAUSE:
                should_split = True
            elif gap >= SOFT_PAUSE and len(current) >= 6:
                should_split = True
            elif len(current) >= MAX_WORDS_NO_PUNCT and gap >= 0.15:
                should_split = True
            elif span >= MAX_SEGMENT_SECONDS:
                should_split = True

        if should_split:
            groups.append(current)
            current = []

    if current:
        groups.append(current)

    segments: list[Segment] = []
    for idx, group in enumerate(groups):
        text = " ".join(w.text.strip() for w in group).strip()
        text = " ".join(text.split())
        if not text:
            continue
        segments.append(
            Segment(
                index=len(segments),
                text=text,
                start=group[0].start,
                end=group[-1].end,
                words=group,
            )
        )

    # Second pass: boundary annotations need neighbours.
    for i, seg in enumerate(segments):
        prev_seg = segments[i - 1] if i > 0 else None
        next_seg = segments[i + 1] if i + 1 < len(segments) else None
        seg.gap_before = max(0.0, seg.start - prev_seg.end) if prev_seg else 2.0
        seg.gap_after = max(0.0, next_seg.start - seg.end) if next_seg else 2.0
        seg.ends_sentence = ends_sentence(seg.text) or seg.gap_after >= HARD_PAUSE
        seg.starts_sentence = (
            prev_seg is None
            or prev_seg.ends_sentence
            or seg.gap_before >= SOFT_PAUSE
            or seg.text[:1].isupper()
        )

    return Transcript(
        words=words,
        segments=segments,
        language=language,
        source=source,
        has_punctuation=has_punct,
    )
