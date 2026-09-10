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

# How far a fallback cut may move from the ideal length to reach a pause.
SNAP_SEARCH_SECONDS = 10.0


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


def generate_fallback_candidates(
    duration: float,
    *,
    silences: list[tuple[float, float]] | None = None,
    min_seconds: float | None = None,
    max_seconds: float | None = None,
) -> list[Candidate]:
    """Used when there is no transcript at all.

    We still avoid blind equal slicing: cut points are snapped to detected
    silences so clips at least start and end on a pause rather than mid-word.
    """
    min_seconds = settings.min_clip_seconds if min_seconds is None else min_seconds
    max_seconds = settings.max_clip_seconds if max_seconds is None else max_seconds
    target = min(max_seconds, max(min_seconds, settings.target_clip_seconds))

    boundaries: list[float] = [0.0]
    silence_mids = sorted((s + e) / 2 for s, e in (silences or []))

    cursor = 0.0
    while cursor + min_seconds < duration:
        ideal = cursor + target
        snapped = ideal
        # Any boundary inside [min, max] is legal, so we can travel a fair way
        # to land on a real pause instead of slicing mid-word.
        best_delta = SNAP_SEARCH_SECONDS
        for mid in silence_mids:
            if mid <= cursor + min_seconds:
                continue
            if mid > cursor + max_seconds:
                break
            delta = abs(mid - ideal)
            if delta < best_delta:
                best_delta = delta
                snapped = mid
        snapped = min(snapped, duration)
        if snapped - cursor < min_seconds:
            snapped = min(cursor + target, duration)
        boundaries.append(snapped)
        cursor = snapped

    if boundaries[-1] < duration:
        boundaries.append(duration)

    candidates: list[Candidate] = []
    for idx in range(len(boundaries) - 1):
        start, end = boundaries[idx], boundaries[idx + 1]
        if end - start < min_seconds:
            continue
        end = min(end, start + max_seconds)
        candidates.append(
            Candidate(
                start=start,
                end=end,
                start_index=idx,
                end_index=idx,
                text="",
                segments=[
                    Segment(index=idx, text="", start=start, end=end, words=[])
                ],
            )
        )
    return candidates
