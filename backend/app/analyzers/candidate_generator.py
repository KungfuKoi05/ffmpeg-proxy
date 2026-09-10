"""Propose every plausible clip range, then hand them to the scorer.

We only ever cut on segment boundaries, so by construction a candidate never
starts or ends halfway through a sentence.
"""
from __future__ import annotations

from ..config import settings
from .types import Candidate, Segment, Transcript

# For a 3-hour video the naive O(n*k) sweep is still only a few thousand
# candidates, but we cap it anyway so pathological inputs stay fast.
MAX_CANDIDATES = 6000

# Separation the selector requires between two chosen clips; the even-split
# last resort must leave at least this much or consecutive pieces are unusable.
SELECTION_GAP = 2.0


def generate_candidates(
    transcript: Transcript,
    *,
    min_seconds: float | None = None,
    max_seconds: float | None = None,
) -> list[Candidate]:
    min_seconds = settings.min_clip_seconds if min_seconds is None else min_seconds
    max_seconds = settings.max_clip_seconds if max_seconds is None else max_seconds

    segments = transcript.segments
    if not segments:
        return []

    candidates: list[Candidate] = []
    n = len(segments)

    # If the transcript is enormous, step the start index so we still cover the
    # whole video but do not build a million windows.
    stride = max(1, n // 1200)

    for i in range(0, n, stride):
        start_seg = segments[i]
        for j in range(i, n):
            end_seg = segments[j]
            duration = end_seg.end - start_seg.start
            if duration < min_seconds:
                continue
            if duration > max_seconds:
                break
            window = segments[i : j + 1]
            candidates.append(
                Candidate(
                    start=start_seg.start,
                    end=end_seg.end,
                    start_index=i,
                    end_index=j,
                    text=" ".join(s.text for s in window),
                    segments=window,
                )
            )
            if len(candidates) >= MAX_CANDIDATES:
                return candidates

    return candidates


def segments_from_silences(
    silences: list[tuple[float, float]],
    duration: float,
    *,
    min_speech: float = 0.8,
) -> list[Segment]:
    """Treat each run of speech between two pauses as a segment.

    With no transcript, a pause is the best available proxy for "a thought
    ended here". That makes the silence map play exactly the role sentences
    play elsewhere, so the same windowing code works unchanged.
    """
    runs: list[tuple[float, float]] = []
    cursor = 0.0
    for start, end in sorted(silences):
        if start > cursor + min_speech:
            runs.append((cursor, start))
        cursor = max(cursor, end)
    if duration > cursor + min_speech:
        runs.append((cursor, duration))

    segments = [
        Segment(index=i, text="", start=round(a, 3), end=round(b, 3), words=[])
        for i, (a, b) in enumerate(runs)
    ]
    for i, seg in enumerate(segments):
        previous = segments[i - 1] if i > 0 else None
        following = segments[i + 1] if i + 1 < len(segments) else None
        seg.gap_before = round(seg.start - previous.end, 3) if previous else 2.0
        seg.gap_after = round(following.start - seg.end, 3) if following else 2.0
        # A pause is our only evidence of a boundary, so we trust it as one.
        seg.ends_sentence = True
        seg.starts_sentence = True
    return segments


def generate_fallback_candidates(
    duration: float,
    *,
    silences: list[tuple[float, float]] | None = None,
    min_seconds: float | None = None,
    max_seconds: float | None = None,
) -> list[Candidate]:
    """Used when there is no transcript at all.

    We still avoid blind equal slicing. Speech runs between detected pauses
    become segments, and we then build the same sliding set of windows we
    would build from sentences - which is what gives the selector genuine
    choice instead of a fixed partition it can only take every other piece of.
    """
    min_seconds = settings.min_clip_seconds if min_seconds is None else min_seconds
    max_seconds = settings.max_clip_seconds if max_seconds is None else max_seconds

    segments = segments_from_silences(silences or [], duration)
    if len(segments) >= 2:
        candidates = generate_candidates(
            Transcript(segments=segments, source="audio_only"),
            min_seconds=min_seconds,
            max_seconds=max_seconds,
        )
        if candidates:
            return candidates

    # No usable pauses at all (continuous music, say). Only now do we fall
    # back to an even split, which is the honest last resort.
    return _even_split(duration, min_seconds=min_seconds, max_seconds=max_seconds)


def _even_split(
    duration: float, *, min_seconds: float, max_seconds: float
) -> list[Candidate]:
    target = min(max_seconds, max(min_seconds, settings.target_clip_seconds))
    # Leave a gap between pieces so the selector can take consecutive ones.
    stride = target + SELECTION_GAP

    candidates: list[Candidate] = []
    cursor = 0.0
    index = 0
    while cursor + min_seconds <= duration:
        end = min(cursor + target, duration)
        if end - cursor >= min_seconds:
            candidates.append(
                Candidate(
                    start=round(cursor, 3),
                    end=round(end, 3),
                    start_index=index,
                    end_index=index,
                    text="",
                    segments=[Segment(index=index, text="", start=cursor, end=end, words=[])],
                )
            )
            index += 1
        cursor += stride
    return candidates
