"""Pick the final 5-8 clips from thousands of scored candidates.

Two things matter beyond raw score:
  1. No overlap - two clips sharing 40 seconds of footage is one clip.
  2. Diversity - eight clips about the same paragraph is a worse product than
     six clips about six different ideas.

We use maximal marginal relevance: each pick is scored as
    quality - lambda * (similarity to what we already picked)
plus a small bonus for being far away in the timeline from existing picks.
"""
from __future__ import annotations

from ..config import settings
from .text import cosine, term_vector
from .types import Candidate, SceneAnalysis, Transcript

DIVERSITY_LAMBDA = 0.45
NEAR_DUPLICATE_SIMILARITY = 0.62
MIN_GAP_BETWEEN_CLIPS = 1.5   # seconds of separation required
SPREAD_BONUS = 0.10
MIN_ACCEPTABLE_SCORE = 0.30   # below this we would rather return fewer clips


def target_clip_count(video_duration: float, requested: int | None = None) -> int:
    """More content -> more clips, bounded by the configured 5-8 range."""
    low, high = settings.min_clips, settings.max_clips
    if requested:
        return max(1, min(high, requested))
    minutes = video_duration / 60.0
    if minutes < 4:
        return max(1, low - 2)
    if minutes < 8:
        return low
    if minutes < 15:
        return min(high, low + 1)
    if minutes < 30:
        return min(high, low + 2)
    return high


def select_clips(
    candidates: list[Candidate],
    *,
    video_duration: float,
    target_count: int,
    min_gap: float = MIN_GAP_BETWEEN_CLIPS,
) -> list[Candidate]:
    if not candidates:
        return []

    pool = sorted(candidates, key=lambda c: c.score, reverse=True)
    vectors = {id(c): term_vector(c.text) for c in pool}

    selected: list[Candidate] = []

    while len(selected) < target_count:
        best: Candidate | None = None
        best_adjusted = -1.0

        for cand in pool:
            if cand in selected:
                continue
            if any(cand.overlaps(s, min_gap=min_gap) for s in selected):
                continue

            similarity = 0.0
            for chosen in selected:
                similarity = max(similarity, cosine(vectors[id(cand)], vectors[id(chosen)]))
            if similarity >= NEAR_DUPLICATE_SIMILARITY:
                continue

            # Reward clips drawn from a part of the video we have not used.
            if selected and video_duration > 0:
                nearest = min(
                    abs(cand.start - s.start) for s in selected
                )
                spread = min(1.0, nearest / max(60.0, video_duration / 6))
            else:
                spread = 1.0

            adjusted = cand.score - DIVERSITY_LAMBDA * similarity + SPREAD_BONUS * spread
            if adjusted > best_adjusted:
                best_adjusted = adjusted
                best = cand

        if best is None:
            break
        # Better to hand back five good clips than eight with three duds.
        if best.score < MIN_ACCEPTABLE_SCORE and len(selected) >= 1:
            break
        selected.append(best)

    selected.sort(key=lambda c: c.start)
    return selected


def snap_to_silence(
    candidates: list[Candidate],
    scene: SceneAnalysis,
    transcript: Transcript,
    *,
    video_duration: float,
    lead_in: float = 0.20,
    tail_out: float = 0.35,
    search_window: float = 0.9,
) -> list[Candidate]:
    """Nudge each clip's edges into the nearest pause and add breathing room.

    Cutting exactly on the first phoneme sounds clipped; a fifth of a second of
    lead-in makes a clip feel professionally edited.
    """
    min_s, max_s = settings.min_clip_seconds, settings.max_clip_seconds
    silences = scene.silences

    for cand in candidates:
        start, end = cand.start, cand.end

        best_start = start - lead_in
        best_end = end + tail_out

        if silences:
            # Prefer to begin just as a silence ends (the speaker starts talking).
            for silence in silences:
                if abs(silence.end - start) <= search_window and silence.end <= start + 0.15:
                    best_start = max(best_start, silence.end - 0.08)
                    break
            # Prefer to end just as a silence begins (the speaker stopped).
            for silence in silences:
                if abs(silence.start - end) <= search_window and silence.start >= end - 0.15:
                    best_end = min(silence.start + 0.15, end + search_window)
                    break

        best_start = max(0.0, best_start)
        best_end = min(video_duration, best_end)

        duration = best_end - best_start
        if duration > max_s:
            best_end = best_start + max_s
        elif duration < min_s:
            # Grow toward whichever side has room, without exceeding the source.
            deficit = min_s - duration
            grow_back = min(deficit / 2, best_start)
            best_start -= grow_back
            best_end = min(video_duration, best_end + (deficit - grow_back))

        cand.start = round(max(0.0, best_start), 3)
        cand.end = round(min(video_duration, best_end), 3)

    return candidates
