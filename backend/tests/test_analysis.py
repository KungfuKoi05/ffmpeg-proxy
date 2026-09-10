"""Transcript segmentation, candidate generation, scoring and selection."""
from __future__ import annotations

import pytest

from backend.app.analyzers import candidate_generator, clip_selector, titles
from backend.app.analyzers.candidate_scorer import ScoringContext, score_candidates
from backend.app.analyzers.segmentation import segment_words
from backend.app.analyzers.text import cosine, term_vector
from backend.app.analyzers.types import SceneAnalysis, SilenceInterval, Word
from backend.app.config import settings

from .conftest import make_words


# --------------------------------------------------------------------- segments
def test_segments_split_on_punctuation(sample_words):
    transcript = segment_words(sample_words)
    assert transcript.has_punctuation
    assert len(transcript.segments) == 18
    assert transcript.segments[0].text.endswith("study.")


def test_segments_split_on_pauses_when_there_is_no_punctuation():
    """YouTube auto-captions have no full stops - prosody has to carry it."""
    words = [
        Word("word", start=i * 0.35, end=i * 0.35 + 0.3) for i in range(12)
    ]
    # A 1.4s pause after word 5 is a sentence break.
    tail = [Word("next", start=6.0 + i * 0.35, end=6.0 + i * 0.35 + 0.3) for i in range(10)]
    transcript = segment_words(words + tail)
    assert not transcript.has_punctuation
    assert len(transcript.segments) >= 2
    assert transcript.segments[1].gap_before > 1.0


def test_segments_annotate_boundaries(sample_words):
    transcript = segment_words(sample_words)
    first = transcript.segments[0]
    assert first.gap_before == pytest.approx(2.0)
    assert first.ends_sentence is True
    assert transcript.segments[6].gap_before > 1.0  # topic change


def test_empty_input_is_handled():
    transcript = segment_words([])
    assert transcript.available is False
    assert transcript.segments == []


# ------------------------------------------------------------------ candidates
def test_every_candidate_respects_the_duration_limits(sample_words):
    transcript = segment_words(sample_words)
    candidates = candidate_generator.generate_candidates(transcript)
    assert candidates
    for candidate in candidates:
        assert settings.min_clip_seconds <= candidate.duration <= settings.max_clip_seconds


def test_candidates_never_start_or_end_mid_sentence(sample_words):
    transcript = segment_words(sample_words)
    starts = {round(s.start, 3) for s in transcript.segments}
    ends = {round(s.end, 3) for s in transcript.segments}
    for candidate in candidate_generator.generate_candidates(transcript):
        assert round(candidate.start, 3) in starts
        assert round(candidate.end, 3) in ends


def test_custom_duration_bounds_are_honoured(sample_words):
    transcript = segment_words(sample_words)
    candidates = candidate_generator.generate_candidates(
        transcript, min_seconds=15, max_seconds=25
    )
    assert candidates
    assert all(15 <= c.duration <= 25 for c in candidates)


def test_fallback_candidates_are_bounded_by_silence():
    """With no transcript, speech runs between pauses act as the segments."""
    silences = [(45.0, 46.5), (95.0, 96.2), (150.0, 151.0)]
    candidates = candidate_generator.generate_fallback_candidates(200.0, silences=silences)
    assert candidates
    assert all(30 <= c.duration <= 60 for c in candidates)
    # Cuts land exactly on the pause, not on a fixed 45-second grid.
    assert candidates[0].start == 0.0
    assert candidates[0].end == pytest.approx(45.0, abs=0.01)
    assert candidates[1].start == pytest.approx(46.5, abs=0.01)


def test_fallback_gives_the_selector_more_than_a_fixed_partition():
    """A contiguous partition would let the selector take only every other piece.

    The separation rule between chosen clips rejects back-to-back candidates,
    so the fallback must produce overlapping windows or it silently halves the
    clip count.
    """
    silences = [(i * 5.0 + 4.2, i * 5.0 + 4.85) for i in range(72)]
    candidates = candidate_generator.generate_fallback_candidates(364.0, silences=silences)
    assert len(candidates) > 50, "a fixed partition would give roughly seven"

    starts = sorted(c.start for c in candidates)
    assert len(set(starts)) > 10, "windows must slide, not tile"


def test_fallback_without_any_pauses_still_returns_usable_windows():
    """Continuous music or noise: an even split is the honest last resort."""
    candidates = candidate_generator.generate_fallback_candidates(364.0, silences=[])
    assert candidates
    assert all(30 <= c.duration <= 60 for c in candidates)
    # Consecutive pieces must be separated enough for the selector to take both.
    for a, b in zip(candidates, candidates[1:]):
        assert b.start - a.end >= 1.5


# ---------------------------------------------------------------------- scoring
def _ctx(transcript, duration=80.0):
    scene = SceneAnalysis(
        silences=[SilenceInterval(start=24.0, end=25.3)], duration=duration
    )
    return ScoringContext(transcript=transcript, scene=scene, video_duration=duration)


def test_scores_are_bounded_and_explained(sample_words):
    transcript = segment_words(sample_words)
    candidates = score_candidates(candidate_generator.generate_candidates(transcript), _ctx(transcript))
    for candidate in candidates:
        assert 0.0 <= candidate.score <= 1.0
        assert set(candidate.breakdown) == {
            "hook", "completeness", "density", "coherence", "duration_fit",
            "boundary", "payoff", "emotion", "question_answer",
        }


def test_a_clip_starting_mid_thought_scores_below_one_that_does_not():
    good = make_words([
        ("Here is the mistake almost every new runner makes.", 0.0, 3.2),
        ("They run every session as hard as they possibly can.", 3.9, 7.1),
        ("Your body adapts during recovery, not during the workout.", 7.8, 11.2),
        ("So eighty percent of your running should feel easy.", 11.9, 15.0),
        ("That is the whole secret, and nobody wants to hear it.", 15.7, 19.1),
        ("Slow down and you will get faster.", 19.8, 22.4),
    ])
    bad = make_words([
        ("and then the other thing that happened was", 0.0, 3.2),
        ("and it kept going like that for a while", 3.4, 6.6),
        ("and so anyway the thing is that", 6.8, 10.0),
        ("and it just sort of kept on going", 10.2, 13.4),
        ("and then", 13.6, 16.8),
        ("and", 17.0, 22.4),
    ])

    def top_score(words):
        transcript = segment_words(words)
        candidates = candidate_generator.generate_candidates(
            transcript, min_seconds=15, max_seconds=30
        )
        scored = score_candidates(candidates, _ctx(transcript, 30.0))
        return max(c.score for c in scored)

    assert top_score(good) > top_score(bad) + 0.08


def test_question_openers_are_rewarded():
    question = segment_words(make_words([
        ("Why does bread rise at all?", 0.0, 2.6),
        ("Yeast eats the sugar and releases carbon dioxide.", 3.3, 6.5),
        ("That gas gets trapped by the gluten network you built.", 7.2, 10.6),
        ("If you skip the kneading the loaf stays flat.", 11.3, 14.4),
        ("It is a structural problem, not a chemistry problem.", 15.1, 18.3),
    ]))
    scored = score_candidates(
        candidate_generator.generate_candidates(question, min_seconds=15, max_seconds=25),
        _ctx(question, 20.0),
    )
    best = max(scored, key=lambda c: c.score)
    assert best.breakdown["question_answer"] > 0.5
    assert best.breakdown["hook"] > 0.5


# -------------------------------------------------------------------- selection
def test_selected_clips_never_overlap(sample_words):
    transcript = segment_words(sample_words)
    candidates = score_candidates(candidate_generator.generate_candidates(transcript), _ctx(transcript))
    selected = clip_selector.select_clips(candidates, video_duration=71.0, target_count=3)
    for a, b in zip(selected, selected[1:]):
        assert a.end <= b.start


def test_selection_avoids_near_duplicates(sample_words):
    transcript = segment_words(sample_words)
    candidates = score_candidates(candidate_generator.generate_candidates(transcript), _ctx(transcript))
    selected = clip_selector.select_clips(candidates, video_duration=71.0, target_count=3)
    for i, a in enumerate(selected):
        for b in selected[i + 1:]:
            assert cosine(term_vector(a.text), term_vector(b.text)) < clip_selector.NEAR_DUPLICATE_SIMILARITY


def test_fewer_clips_are_returned_rather_than_bad_ones(sample_words):
    """Asking for 20 clips from 70 seconds of speech must not invent them."""
    transcript = segment_words(sample_words)
    candidates = score_candidates(candidate_generator.generate_candidates(transcript), _ctx(transcript))
    selected = clip_selector.select_clips(candidates, video_duration=71.0, target_count=20)
    assert 0 < len(selected) < 20


@pytest.mark.parametrize(
    "duration,expected",
    [(120, 3), (300, 5), (600, 6), (1200, 7), (3600, 8)],
)
def test_clip_count_scales_with_video_length(duration, expected):
    assert clip_selector.target_clip_count(duration) == expected


def test_explicit_clip_count_is_respected():
    assert clip_selector.target_clip_count(3600, requested=5) == 5


def test_snapping_keeps_clips_inside_the_legal_range(sample_words):
    transcript = segment_words(sample_words)
    scene = SceneAnalysis(
        silences=[SilenceInterval(start=23.8, end=25.4), SilenceInterval(start=47.6, end=49.2)],
        duration=71.0,
    )
    candidates = score_candidates(
        candidate_generator.generate_candidates(transcript),
        ScoringContext(transcript=transcript, scene=scene, video_duration=71.0),
    )
    selected = clip_selector.select_clips(candidates, video_duration=71.0, target_count=2)
    snapped = clip_selector.snap_to_silence(selected, scene, transcript, video_duration=71.0)
    for candidate in snapped:
        assert candidate.start >= 0
        assert candidate.end <= 71.0
        assert settings.min_clip_seconds - 0.01 <= candidate.duration <= settings.max_clip_seconds + 0.01


# ----------------------------------------------------------------------- titles
def test_titles_come_from_the_clip_opening(sample_words):
    transcript = segment_words(sample_words)
    candidates = score_candidates(candidate_generator.generate_candidates(transcript), _ctx(transcript))
    selected = clip_selector.select_clips(candidates, video_duration=71.0, target_count=2)
    generated = titles.titles_for(selected)
    assert len(generated) == len(selected)
    for title in generated:
        assert 0 < len(title) <= 70
        assert "\n" not in title


def test_titles_strip_filler_openers():
    from backend.app.analyzers.types import Candidate, Segment

    candidate = Candidate(
        start=0, end=45, start_index=0, end_index=0,
        text="so anyway the real reason costs went up is regulation",
        segments=[Segment(0, "so anyway the real reason costs went up is regulation", 0, 45)],
    )
    assert titles.title_for(candidate, index=1).lower().startswith("the real reason")
