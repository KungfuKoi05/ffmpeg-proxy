"""Turn a chosen time range into a finished, playable clip file.

Quality policy (deliberate, and honest about it):

  * We never upscale. A 9:16 crop of a 1920x1080 source is 608x1080 real
    pixels, and that is what we write. Blowing it up to 1080x1920 would add
    no detail while claiming a resolution the source never had.
  * We do downscale: a 4K source cropped to 9:16 is 2160 tall, which we cap
    at 1920 so files stay sane.
  * Cuts are re-encoded rather than stream-copied, because stream copy can
    only cut on keyframes - which is how you get clips that start two seconds
    late. CRF 18 with x264 is visually near-lossless.
  * No watermark, no branding, ever.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from ..analyzers.types import Word
from ..config import settings
from ..services import media
from ..utils.logging import get_logger
from . import captions as captions_mod
from .reframe import CropWindow, ReframeStrategy, get_strategy, target_dimensions

log = get_logger(__name__)

MAX_HEIGHT_BY_QUALITY = {
    "1080p": 1920,   # applies to the long edge of the output
    "720p": 1280,
    "highest": 4320,
}


@dataclass
class RenderRequest:
    source: Path
    dest: Path
    start: float
    end: float
    aspect: str = "9:16"
    burn_captions: bool = False
    caption_style: str = captions_mod.DEFAULT_STYLE
    quality: str = "1080p"
    words: list[Word] | None = None
    work_dir: Path | None = None

    @property
    def duration(self) -> float:
        return max(0.1, self.end - self.start)


@dataclass
class RenderResult:
    path: Path
    width: int
    height: int
    duration: float
    filesize: int
    has_captions: bool
    subtitle_path: Path | None
    thumbnail_path: Path | None
    crop: CropWindow | None


class ClipRenderer:
    """Renders one clip at a time. Stateless apart from its strategy choice."""

    def __init__(self, strategy: ReframeStrategy | None = None) -> None:
        self.strategy = strategy or get_strategy("content_aware")
        self._hw_encoder = (
            media.detect_hardware_encoder() if settings.prefer_hardware_encoder else None
        )
        if self._hw_encoder:
            log.info("using hardware encoder: %s", self._hw_encoder)

    # -- geometry ---------------------------------------------------------
    def _output_size(
        self, crop: CropWindow | None, info: media.MediaInfo, request: RenderRequest
    ) -> tuple[int, int, bool]:
        if crop is not None:
            width, height = crop.width, crop.height
        else:
            width, height = target_dimensions(info.width, info.height, request.aspect)

        cap = MAX_HEIGHT_BY_QUALITY.get(request.quality, 1920)
        long_edge = max(width, height)
        if long_edge > cap:
            scale = cap / long_edge
            new_w = max(2, int(round(width * scale)) // 2 * 2)
            new_h = max(2, int(round(height * scale)) // 2 * 2)
            return new_w, new_h, True

        return max(2, width // 2 * 2), max(2, height // 2 * 2), False

    # -- ffmpeg -----------------------------------------------------------
    def _video_codec_args(self) -> list[str]:
        if self._hw_encoder:
            # Hardware encoders do not understand -crf; -cq/-q is the analogue.
            quality_flag = {
                "h264_nvenc": ["-cq", str(settings.video_crf)],
                "h264_qsv": ["-global_quality", str(settings.video_crf)],
                "h264_videotoolbox": ["-q:v", "60"],
                "h264_vaapi": ["-qp", str(settings.video_crf)],
                "h264_amf": ["-qp_i", str(settings.video_crf)],
            }.get(self._hw_encoder, [])
            return ["-c:v", self._hw_encoder, *quality_flag]
        return [
            "-c:v", "libx264",
            "-preset", settings.video_preset,
            "-crf", str(settings.video_crf),
            "-profile:v", "high",
            "-level", "4.2",
        ]

    def render(
        self,
        request: RenderRequest,
        *,
        on_progress: Callable[[float], None] | None = None,
    ) -> RenderResult:
        info = media.probe(request.source)
        work_dir = request.work_dir or request.dest.parent
        work_dir.mkdir(parents=True, exist_ok=True)
        request.dest.parent.mkdir(parents=True, exist_ok=True)

        crop = self.strategy.compute(
            request.source,
            source_width=info.width,
            source_height=info.height,
            aspect=request.aspect,
            start=request.start,
            duration=request.duration,
        )
        out_w, out_h, needs_scale = self._output_size(crop, info, request)

        filters: list[str] = []
        if crop is not None:
            filters.append(crop.to_filter())
        if needs_scale or (crop is None and (out_w, out_h) != (info.width, info.height)):
            filters.append(f"scale={out_w}:{out_h}:flags=lanczos")
        filters.append("setsar=1")

        # --- captions ----------------------------------------------------
        subtitle_path: Path | None = None
        ass_name: str | None = None
        cues: list[captions_mod.Cue] = []
        if request.words:
            clip_words = captions_mod.words_in_range(request.words, request.start, request.end)
            cues = captions_mod.build_cues(clip_words)

        if cues:
            subtitle_path = request.dest.with_suffix(".srt")
            captions_mod.write_srt(cues, subtitle_path)

        if request.burn_captions and cues:
            ass_name = f"{request.dest.stem}.ass"
            captions_mod.write_ass(
                cues,
                work_dir / ass_name,
                width=out_w,
                height=out_h,
                style_name=request.caption_style,
            )
            # Referenced by bare filename with cwd=work_dir so no path in the
            # filtergraph ever needs escaping.
            filters.append(f"ass={ass_name}")

        # --- command -----------------------------------------------------
        args = [
            media.FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{request.start:.3f}",
            "-i", str(request.source),
            "-t", f"{request.duration:.3f}",
            "-map", "0:v:0",
        ]
        if info.has_audio:
            args += ["-map", "0:a:0"]

        args += ["-vf", ",".join(filters)]
        args += self._video_codec_args()
        args += ["-pix_fmt", "yuv420p"]

        if info.has_audio:
            args += ["-c:a", "aac", "-b:a", settings.audio_bitrate, "-ar", "48000", "-ac", "2"]
        else:
            args += ["-an"]

        args += [
            "-movflags", "+faststart",
            "-avoid_negative_ts", "make_zero",
            str(request.dest),
        ]

        media.run_with_progress(
            args,
            total_seconds=request.duration,
            on_progress=on_progress,
            cwd=work_dir,
        )

        if not request.dest.exists() or request.dest.stat().st_size == 0:
            raise RuntimeError("ffmpeg produced an empty clip file")

        rendered = media.probe(request.dest)

        thumbnail_path = request.dest.with_suffix(".jpg")
        ok = media.extract_thumbnail(
            request.dest, thumbnail_path, at_seconds=min(2.0, rendered.duration * 0.15), width=540
        )

        if ass_name:
            (work_dir / ass_name).unlink(missing_ok=True)

        return RenderResult(
            path=request.dest,
            width=rendered.width,
            height=rendered.height,
            duration=rendered.duration,
            filesize=request.dest.stat().st_size,
            has_captions=bool(request.burn_captions and cues),
            subtitle_path=subtitle_path if subtitle_path and subtitle_path.exists() else None,
            thumbnail_path=thumbnail_path if ok else None,
            crop=crop,
        )
