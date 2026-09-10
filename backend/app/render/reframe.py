"""Deciding where to crop when the output aspect ratio differs from the source.

Two strategies ship today:

  CenterCrop        - dead centre, with a safe margin. Always works.
  ContentAwareCrop  - samples a dozen frames from the clip, measures where the
                      visual detail and motion actually are, and centres the
                      crop there. A talking head sitting on the left of a
                      16:9 frame ends up centred instead of half cut off.

Both implement the same tiny interface, so a future face/speaker tracker can
be dropped in without touching the renderer.
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from ..utils.logging import get_logger

log = get_logger(__name__)

SAMPLE_WIDTH = 160
SAMPLE_HEIGHT = 90
MAX_SAMPLES = 12
CENTER_BIAS = 0.35  # how strongly to prefer the middle when detail is even


@dataclass(frozen=True)
class CropWindow:
    x: int
    y: int
    width: int
    height: int

    def to_filter(self) -> str:
        return f"crop={self.width}:{self.height}:{self.x}:{self.y}"


def _even(value: float) -> int:
    """Round a *size* down to an even number - yuv420p needs even dimensions."""
    return max(2, int(value) // 2 * 2)


def _even_offset(value: float) -> int:
    """Round an *offset* down to an even number. Unlike a size, 0 is valid."""
    return max(0, int(value) // 2 * 2)


def target_dimensions(
    source_width: int, source_height: int, aspect: str
) -> tuple[int, int]:
    """Largest region of the source matching `aspect`, in source pixels."""
    ratios = {"9:16": 9 / 16, "1:1": 1.0, "16:9": 16 / 9}
    ratio = ratios.get(aspect)
    if ratio is None or source_width <= 0 or source_height <= 0:
        return source_width, source_height

    source_ratio = source_width / source_height
    if abs(source_ratio - ratio) < 0.01:
        return source_width, source_height

    if source_ratio > ratio:
        # Source is wider than the target: crop the sides.
        height = source_height
        width = height * ratio
    else:
        # Source is taller than the target: crop top and bottom.
        width = source_width
        height = width / ratio

    return _even(min(width, source_width)), _even(min(height, source_height))


class ReframeStrategy:
    name = "base"

    def compute(
        self,
        source: Path,
        *,
        source_width: int,
        source_height: int,
        aspect: str,
        start: float,
        duration: float,
    ) -> CropWindow | None:
        raise NotImplementedError


class CenterCrop(ReframeStrategy):
    name = "center"

    def compute(self, source, *, source_width, source_height, aspect, start, duration):
        width, height = target_dimensions(source_width, source_height, aspect)
        if width >= source_width and height >= source_height:
            return None
        return CropWindow(
            x=_even_offset((source_width - width) / 2),
            y=_even_offset((source_height - height) / 2),
            width=width,
            height=height,
        )


class ContentAwareCrop(ReframeStrategy):
    """Pick the horizontal band carrying the most detail and movement.

    This is real measurement, not a model: we take grayscale samples, sum the
    horizontal gradient (edges - i.e. faces, text, objects) and the frame-to-
    frame difference (movement - i.e. the person talking), then slide the crop
    window to the highest-scoring position, with a mild pull toward centre so
    the result never looks arbitrary.
    """

    name = "content_aware"

    def __init__(self, fallback: ReframeStrategy | None = None) -> None:
        self.fallback = fallback or CenterCrop()

    def compute(self, source, *, source_width, source_height, aspect, start, duration):
        width, height = target_dimensions(source_width, source_height, aspect)
        if width >= source_width and height >= source_height:
            return None

        # Only horizontal repositioning is worth the sampling cost; vertical
        # crops of a landscape source keep full height anyway.
        if height < source_height and width >= source_width:
            return self.fallback.compute(
                source,
                source_width=source_width,
                source_height=source_height,
                aspect=aspect,
                start=start,
                duration=duration,
            )

        energy = self._column_energy(source, start=start, duration=duration)
        if energy is None:
            return self.fallback.compute(
                source,
                source_width=source_width,
                source_height=source_height,
                aspect=aspect,
                start=start,
                duration=duration,
            )

        import numpy as np

        columns = energy.shape[0]
        window = max(1, int(round(columns * width / source_width)))
        if window >= columns:
            return self.fallback.compute(
                source,
                source_width=source_width,
                source_height=source_height,
                aspect=aspect,
                start=start,
                duration=duration,
            )

        cumulative = np.concatenate([[0.0], np.cumsum(energy)])
        positions = np.arange(0, columns - window + 1)
        sums = cumulative[positions + window] - cumulative[positions]

        # Mild centre prior: a tie goes to the middle of the frame.
        centers = positions + window / 2
        middle = columns / 2
        distance = np.abs(centers - middle) / max(1.0, middle)
        peak = float(sums.max()) or 1.0
        scores = sums / peak - CENTER_BIAS * distance

        best = int(positions[int(np.argmax(scores))])
        x = int(round(best / columns * source_width))
        x = max(0, min(source_width - width, x))

        return CropWindow(
            x=_even_offset(x),
            y=_even_offset((source_height - height) / 2),
            width=width,
            height=height,
        )

    @staticmethod
    def _column_energy(source: Path, *, start: float, duration: float):
        """Return a per-column energy vector, or None if sampling failed."""
        try:
            import numpy as np
        except ImportError:  # pragma: no cover - numpy is a hard requirement
            return None

        fps = max(0.2, MAX_SAMPLES / max(1.0, duration))
        args = [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-ss", f"{max(0.0, start):.3f}",
            "-t", f"{max(0.5, duration):.3f}",
            "-i", str(source),
            "-vf", f"fps={fps:.4f},scale={SAMPLE_WIDTH}:{SAMPLE_HEIGHT},format=gray",
            "-frames:v", str(MAX_SAMPLES),
            "-f", "rawvideo", "-pix_fmt", "gray", "-",
        ]
        try:
            proc = subprocess.run(args, capture_output=True, timeout=180, check=False)
        except (OSError, subprocess.SubprocessError) as exc:
            log.debug("reframe sampling failed: %s", exc)
            return None

        frame_size = SAMPLE_WIDTH * SAMPLE_HEIGHT
        raw = proc.stdout or b""
        count = len(raw) // frame_size
        if count < 1:
            return None

        frames = np.frombuffer(raw[: count * frame_size], dtype=np.uint8).astype(np.float32)
        frames = frames.reshape(count, SAMPLE_HEIGHT, SAMPLE_WIDTH)

        # Edges: where detail lives (faces, text, objects).
        gradient = np.abs(np.diff(frames, axis=2))
        detail = gradient.sum(axis=(0, 1))
        detail = np.concatenate([detail, [detail[-1] if detail.size else 0.0]])

        # Motion: where things are actually happening.
        if count > 1:
            motion = np.abs(np.diff(frames, axis=0)).sum(axis=(0, 1))
        else:
            motion = np.zeros(SAMPLE_WIDTH, dtype=np.float32)

        def normalize(vec):
            span = float(vec.max() - vec.min())
            if span <= 0:
                return np.zeros_like(vec)
            return (vec - vec.min()) / span

        return 0.6 * normalize(detail) + 0.4 * normalize(motion)


STRATEGIES: dict[str, type[ReframeStrategy]] = {
    CenterCrop.name: CenterCrop,
    ContentAwareCrop.name: ContentAwareCrop,
}


def get_strategy(name: str = "content_aware") -> ReframeStrategy:
    return STRATEGIES.get(name, ContentAwareCrop)()
