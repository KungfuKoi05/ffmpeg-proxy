"""Shared data structures for the clip-selection pipeline.

The pipeline is deliberately a chain of small, testable pieces:

    words -> segments -> candidates -> scored candidates -> selected clips

Each stage has one job and can be swapped out without touching the others.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Word:
    """One spoken word with its own timing, when the source provides it."""

    text: str
    start: float
    end: float

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


@dataclass
class Segment:
    """A sentence-ish unit: the smallest thing we will cut on."""

    index: int
    text: str
    start: float
    end: float
    words: list[Word] = field(default_factory=list)
    gap_before: float = 0.0  # silence before this segment starts
    gap_after: float = 0.0  # silence after this segment ends
    ends_sentence: bool = False  # ends with . ! ? (or a long pause)
    starts_sentence: bool = True

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)

    @property
    def word_count(self) -> int:
        return len(self.words) or len(self.text.split())


@dataclass
class Transcript:
    """Everything we know about what is said in the video."""

    words: list[Word] = field(default_factory=list)
    segments: list[Segment] = field(default_factory=list)
    language: str = "en"
    source: str = "none"  # youtube_manual | youtube_auto | whisper | none
    has_punctuation: bool = False

    @property
    def available(self) -> bool:
        return bool(self.segments)

    @property
    def speech_duration(self) -> float:
        return sum(s.duration for s in self.segments)


@dataclass
class SilenceInterval:
    start: float
    end: float

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)

    @property
    def midpoint(self) -> float:
        return (self.start + self.end) / 2


@dataclass
class SceneAnalysis:
    """What the audio/video track tells us, independent of the transcript."""

    silences: list[SilenceInterval] = field(default_factory=list)
    scene_cuts: list[float] = field(default_factory=list)
    duration: float = 0.0

    def speech_ratio(self, start: float, end: float) -> float:
        """Fraction of [start, end] that is NOT silence."""
        span = max(1e-6, end - start)
        silent = 0.0
        for silence in self.silences:
            overlap = min(end, silence.end) - max(start, silence.start)
            if overlap > 0:
                silent += overlap
        return max(0.0, min(1.0, 1.0 - silent / span))


@dataclass
class Candidate:
    """A proposed clip range, before scoring."""

    start: float
    end: float
    start_index: int
    end_index: int
    text: str
    segments: list[Segment] = field(default_factory=list)
    score: float = 0.0
    breakdown: dict[str, float] = field(default_factory=dict)

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)

    def overlaps(self, other: "Candidate", *, min_gap: float = 0.0) -> bool:
        return self.start < other.end + min_gap and other.start < self.end + min_gap
