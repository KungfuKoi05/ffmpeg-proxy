"""Score candidate clips on explainable, measurable signals.

Every component below is computed from something real in the transcript or the
audio track. There is no model here and no pretend intelligence - the score is
a weighted sum of measurable properties, and each clip carries its breakdown
so the UI can show exactly why it was picked.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from ..config import settings
from .text import (
    DANGLING_STARTERS,
    EMOTION_WORDS,
    HOOK_STARTERS,
    INSIGHT_WORDS,
    LAUGH_RE,
    NUMBER_RE,
    bell,
    clamp,
    content_words,
    cosine,
    first_word,
    is_question,
    starts_with_any,
    term_vector,
    tokenize,
)
from .types import Candidate, SceneAnalysis, Transcript

WEIGHTS: dict[str, float] = {
    "hook": 0.20,
    "completeness": 0.16,
    "density": 0.13,
    "coherence": 0.12,
    "duration_fit": 0.12,
    "boundary": 0.10,
    "payoff": 0.07,
    "emotion": 0.05,
    "question_answer": 0.05,
}


@dataclass
class ScoringContext:
    transcript: Transcript
    scene: SceneAnalysis
    video_duration: float


def _hook_score(cand: Candidate) -> float:
    if not cand.segments or not cand.text:
        return 0.5
    opener = cand.segments[0].text
    tokens = tokenize(opener)
    if not tokens:
        return 0.3

    score = 0.35

    if starts_with_any(opener, HOOK_STARTERS):
        score += 0.30
    if is_question(opener):
        score += 0.18
    if NUMBER_RE.search(opener):
        score += 0.10
    # "you"/"your" in the opening line is direct address - strong hook.
    if any(t in {"you", "your", "you're", "youre"} for t in tokens[:8]):
        score += 0.12
    # A statement that sets up tension.
    if any(t in {"never", "always", "nobody", "everyone", "most", "biggest", "worst", "best", "secret", "mistake", "wrong"} for t in tokens[:10]):
        score += 0.12

    # Continuing a previous thought is a weak opening.
    if first_word(opener) in DANGLING_STARTERS and cand.segments[0].gap_before < 0.5:
        score -= 0.28
    # A very short opener carries no idea.
    if len(tokens) < 4:
        score -= 0.15

    return clamp(score)


def _completeness_score(cand: Candidate) -> float:
    if not cand.segments or not cand.text:
        return 0.5
    first, last = cand.segments[0], cand.segments[-1]
    score = 0.3
    if first.starts_sentence:
        score += 0.25
    if last.ends_sentence:
        score += 0.35
    # Ending on a trailing conjunction means the thought is cut off.
    trailing = tokenize(last.text)[-1:] or [""]
    if trailing[0] in {"and", "but", "so", "because", "that", "the", "a", "to", "of", "or", "with"}:
        score -= 0.30
    if last.gap_after >= 0.7:
        score += 0.10
    return clamp(score)


def _density_score(cand: Candidate) -> float:
    """Information per second: not too sparse, not a firehose."""
    if not cand.text or cand.duration <= 0:
        return 0.4
    tokens = tokenize(cand.text)
    if not tokens:
        return 0.2
    words_per_second = len(tokens) / cand.duration
    # Natural speech is ~2.2-3.2 words/sec. Below 1.5 means lots of dead air.
    pace = bell(words_per_second, center=2.7, width=1.1)

    content = content_words(cand.text)
    content_ratio = len(content) / len(tokens)
    # 0.35-0.55 is normal; higher means dense explanation.
    richness = clamp((content_ratio - 0.20) / 0.35)

    unique_ratio = len(set(content)) / max(1, len(content))
    insight = sum(1 for t in tokens if t in INSIGHT_WORDS) / max(1, len(tokens))
    insight_score = clamp(insight / 0.06)

    return clamp(0.40 * pace + 0.25 * richness + 0.15 * unique_ratio + 0.20 * insight_score)


def _coherence_score(cand: Candidate) -> float:
    """Do the sentences in this window talk about the same thing?"""
    segments = [s for s in cand.segments if s.text]
    if len(segments) < 2:
        return 0.5
    vectors = [term_vector(s.text) for s in segments]
    overall = Counter()
    for vec in vectors:
        overall.update(vec)

    # How much each sentence shares with the window as a whole.
    similarities = [cosine(vec, overall) for vec in vectors if vec]
    if not similarities:
        return 0.4
    mean_sim = sum(similarities) / len(similarities)
    # Empirically 0.25-0.6 for on-topic speech.
    return clamp((mean_sim - 0.10) / 0.45)


def _duration_score(cand: Candidate, min_s: float, max_s: float) -> float:
    duration = cand.duration
    if duration < min_s or duration > max_s:
        return 0.0
    ideal = min(max_s, max(min_s, settings.target_clip_seconds))
    # Flat-topped preference for 45-60s, tapering toward the minimum.
    if duration >= ideal - 7:
        return 1.0
    return clamp(0.45 + 0.55 * bell(duration, center=ideal, width=12.0))


def _boundary_score(cand: Candidate, ctx: ScoringContext) -> float:
    if not cand.segments:
        return 0.5
    first, last = cand.segments[0], cand.segments[-1]
    # Long silence before the first word and after the last = clean edges.
    lead = clamp(first.gap_before / 0.9)
    tail = clamp(last.gap_after / 0.9)
    speech = ctx.scene.speech_ratio(cand.start, cand.end) if ctx.scene.silences else 0.75
    # Penalise windows that are mostly silence or music.
    speech_score = clamp((speech - 0.35) / 0.5)
    return clamp(0.35 * lead + 0.30 * tail + 0.35 * speech_score)


def _payoff_score(cand: Candidate) -> float:
    """Does the clip land somewhere - a conclusion, a punchline, a result?"""
    if not cand.segments or not cand.text:
        return 0.45
    tail_text = " ".join(s.text for s in cand.segments[-2:]).lower()
    score = 0.35
    payoff_markers = (
        "that's why", "thats why", "so that's", "the point is", "in the end",
        "turns out", "the result", "and that", "which is why", "the lesson",
        "bottom line", "at the end of the day", "that's the", "and it worked",
        "and now", "finally", "ever since",
    )
    if any(m in tail_text for m in payoff_markers):
        score += 0.30
    if LAUGH_RE.search(tail_text):
        score += 0.20
    if cand.segments[-1].ends_sentence:
        score += 0.15
    if NUMBER_RE.search(tail_text):
        score += 0.08
    return clamp(score)


def _emotion_score(cand: Candidate) -> float:
    tokens = tokenize(cand.text)
    if not tokens:
        return 0.3
    hits = sum(1 for t in tokens if t in EMOTION_WORDS)
    rate = hits / len(tokens)
    laughs = len(LAUGH_RE.findall(cand.text))
    exclaims = cand.text.count("!")
    return clamp(rate / 0.035 * 0.7 + min(0.2, laughs * 0.1) + min(0.15, exclaims * 0.05))


def _question_answer_score(cand: Candidate) -> float:
    segments = [s for s in cand.segments if s.text]
    if len(segments) < 3:
        return 0.3
    head = segments[: max(1, len(segments) // 3)]
    if any(is_question(s.text) for s in head):
        # A question up front with substantial content after it is a great clip.
        remaining_words = sum(len(tokenize(s.text)) for s in segments[len(head):])
        return clamp(0.55 + min(0.45, remaining_words / 120))
    return 0.25


def score_candidate(cand: Candidate, ctx: ScoringContext) -> Candidate:
    min_s = settings.min_clip_seconds
    max_s = settings.max_clip_seconds

    breakdown = {
        "hook": _hook_score(cand),
        "completeness": _completeness_score(cand),
        "density": _density_score(cand),
        "coherence": _coherence_score(cand),
        "duration_fit": _duration_score(cand, min_s, max_s),
        "boundary": _boundary_score(cand, ctx),
        "payoff": _payoff_score(cand),
        "emotion": _emotion_score(cand),
        "question_answer": _question_answer_score(cand),
    }
    total = sum(WEIGHTS[k] * v for k, v in breakdown.items())

    cand.breakdown = {k: round(v, 4) for k, v in breakdown.items()}
    cand.score = round(clamp(total), 4)
    return cand


def score_candidates(candidates: list[Candidate], ctx: ScoringContext) -> list[Candidate]:
    return [score_candidate(c, ctx) for c in candidates]
