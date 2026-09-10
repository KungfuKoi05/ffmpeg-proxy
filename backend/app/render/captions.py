"""Caption generation: SRT sidecars and burned-in ASS subtitles.

Styles are data, not code, so adding "bold yellow TikTok style" later is a
dictionary entry rather than a rewrite.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ..analyzers.types import Word

MAX_CHARS_PER_LINE = 30
MAX_WORDS_PER_CUE = 7
MAX_CUE_SECONDS = 3.2
MAX_LINES = 2


@dataclass(frozen=True)
class CaptionStyle:
    name: str
    font: str = "DejaVu Sans"
    # Font size as a fraction of video height - keeps captions readable at any
    # resolution without hard-coding pixel sizes.
    size_ratio: float = 0.052
    primary: str = "&H00FFFFFF"      # white  (ASS colours are &HAABBGGRR)
    outline_colour: str = "&H00000000"
    back_colour: str = "&HA0000000"   # 60% black box
    bold: int = -1                    # -1 is "on" in ASS
    outline: float = 2.6
    shadow: float = 0.8
    border_style: int = 1             # 1 = outline+shadow, 3 = opaque box
    # Distance from the bottom edge as a fraction of height (safe margin for
    # platform UI overlays, which eat roughly the bottom 12%).
    margin_v_ratio: float = 0.16
    margin_h_ratio: float = 0.07


STYLES: dict[str, CaptionStyle] = {
    "clean": CaptionStyle(name="clean"),
    "boxed": CaptionStyle(name="boxed", border_style=3, outline=1.2, back_colour="&HB0000000"),
    "bold-yellow": CaptionStyle(
        name="bold-yellow", primary="&H0000E5FF", size_ratio=0.058, outline=3.0
    ),
}
DEFAULT_STYLE = "clean"


@dataclass
class Cue:
    start: float
    end: float
    text: str


def words_in_range(words: list[Word], start: float, end: float) -> list[Word]:
    """Words whose midpoint falls inside the clip, rebased to 0."""
    selected: list[Word] = []
    for word in words:
        mid = (word.start + word.end) / 2
        if start <= mid <= end:
            selected.append(
                Word(
                    text=word.text,
                    start=round(max(0.0, word.start - start), 3),
                    end=round(max(0.05, word.end - start), 3),
                )
            )
    return selected


def build_cues(words: list[Word]) -> list[Cue]:
    """Group words into short, readable cues."""
    cues: list[Cue] = []
    current: list[Word] = []

    def flush() -> None:
        if not current:
            return
        text = " ".join(w.text.strip() for w in current).strip()
        if text:
            cues.append(Cue(start=current[0].start, end=max(current[-1].end, current[0].start + 0.4), text=text))

    for word in words:
        candidate = current + [word]
        text_length = len(" ".join(w.text for w in candidate))
        span = candidate[-1].end - candidate[0].start
        too_long = (
            len(candidate) > MAX_WORDS_PER_CUE
            or text_length > MAX_CHARS_PER_LINE * MAX_LINES
            or span > MAX_CUE_SECONDS
        )
        if too_long and current:
            flush()
            current = [word]
            continue
        current = candidate
        if word.text.strip().endswith((".", "!", "?")):
            flush()
            current = []

    flush()

    # Never let two cues overlap - libass renders that as a mess.
    for i in range(len(cues) - 1):
        if cues[i].end > cues[i + 1].start:
            cues[i].end = max(cues[i].start + 0.3, cues[i + 1].start - 0.02)
    return cues


def wrap_text(text: str, width: int = MAX_CHARS_PER_LINE, max_lines: int = MAX_LINES) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    if len(lines) > max_lines:
        head = lines[: max_lines - 1]
        head.append(" ".join(lines[max_lines - 1 :]))
        lines = head
    return lines


def _srt_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    hours, rem = divmod(int(seconds), 3600)
    minutes, secs = divmod(rem, 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def _ass_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    hours, rem = divmod(int(seconds), 3600)
    minutes, secs = divmod(rem, 60)
    centis = int(round((seconds - int(seconds)) * 100))
    if centis >= 100:
        centis, secs = 0, secs + 1
    return f"{hours:d}:{minutes:02d}:{secs:02d}.{centis:02d}"


def write_srt(cues: list[Cue], dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    blocks = []
    for i, cue in enumerate(cues, start=1):
        text = "\n".join(wrap_text(cue.text))
        blocks.append(f"{i}\n{_srt_time(cue.start)} --> {_srt_time(cue.end)}\n{text}\n")
    dest.write_text("\n".join(blocks), encoding="utf-8")
    return dest


def _escape_ass(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", "\\N")


def write_ass(
    cues: list[Cue],
    dest: Path,
    *,
    width: int,
    height: int,
    style_name: str = DEFAULT_STYLE,
) -> Path:
    style = STYLES.get(style_name, STYLES[DEFAULT_STYLE])
    dest.parent.mkdir(parents=True, exist_ok=True)

    font_size = max(16, int(round(height * style.size_ratio)))
    margin_v = max(20, int(round(height * style.margin_v_ratio)))
    margin_h = max(20, int(round(width * style.margin_h_ratio)))

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{style.font},{font_size},{style.primary},{style.primary},{style.outline_colour},{style.back_colour},{style.bold},0,0,0,100,100,0,0,{style.border_style},{style.outline},{style.shadow},2,{margin_h},{margin_h},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    lines = [header]
    for cue in cues:
        text = _escape_ass("\\N".join(wrap_text(cue.text)))
        lines.append(
            f"Dialogue: 0,{_ass_time(cue.start)},{_ass_time(cue.end)},Default,,0,0,0,,{text}"
        )

    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return dest


def available_styles() -> list[str]:
    return sorted(STYLES)
