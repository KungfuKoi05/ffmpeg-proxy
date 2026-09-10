"""Caption cue building and subtitle file generation."""
from __future__ import annotations

from backend.app.render import captions
from backend.app.analyzers.types import Word

from .conftest import make_words


def _words():
    return make_words([
        ("This is the first sentence of the clip.", 10.0, 13.0),
        ("And here is a second one that follows it.", 13.5, 17.0),
        ("A third sentence lands the point.", 17.5, 20.5),
    ])


def test_words_are_rebased_to_the_clip_start():
    clip_words = captions.words_in_range(_words(), 10.0, 20.5)
    assert clip_words[0].start == 0.0
    assert all(w.start >= 0 for w in clip_words)


def test_words_outside_the_clip_are_dropped():
    clip_words = captions.words_in_range(_words(), 13.5, 17.0)
    joined = " ".join(w.text for w in clip_words)
    assert "first" not in joined
    assert "second" in joined


def test_cues_are_short_and_never_overlap():
    cues = captions.build_cues(captions.words_in_range(_words(), 10.0, 20.5))
    assert cues
    for cue in cues:
        assert cue.end > cue.start
        assert len(cue.text) <= captions.MAX_CHARS_PER_LINE * captions.MAX_LINES + 12
    for a, b in zip(cues, cues[1:]):
        assert a.end <= b.start + 0.001


def test_srt_is_written_in_the_right_shape(tmp_path):
    cues = captions.build_cues(captions.words_in_range(_words(), 10.0, 20.5))
    path = captions.write_srt(cues, tmp_path / "clip.srt")
    body = path.read_text()
    assert body.startswith("1\n")
    assert "-->" in body
    assert "00:00:0" in body


def test_ass_scales_with_video_height(tmp_path):
    cues = captions.build_cues(captions.words_in_range(_words(), 10.0, 20.5))
    small = captions.write_ass(cues, tmp_path / "s.ass", width=608, height=1080).read_text()
    large = captions.write_ass(cues, tmp_path / "l.ass", width=1080, height=1920).read_text()
    assert "PlayResY: 1080" in small
    assert "PlayResY: 1920" in large

    def font_size(text):
        line = next(l for l in text.splitlines() if l.startswith("Style: Default"))
        return int(line.split(",")[2])

    assert font_size(large) > font_size(small)


def test_ass_escapes_braces_so_override_tags_cannot_be_injected(tmp_path):
    """A transcript containing {\\an8} must not become a positioning command."""
    words = [Word(r"{\an8}evil", 0.0, 1.0), Word("text", 1.0, 2.0)]
    cues = captions.build_cues(words)
    body = captions.write_ass(cues, tmp_path / "x.ass", width=608, height=1080).read_text()
    dialogue = [l for l in body.splitlines() if l.startswith("Dialogue:")]
    assert dialogue
    assert "{" not in dialogue[0]
    assert "}" not in dialogue[0]


def test_captions_sit_inside_the_safe_margin(tmp_path):
    cues = captions.build_cues(captions.words_in_range(_words(), 10.0, 20.5))
    body = captions.write_ass(cues, tmp_path / "m.ass", width=1080, height=1920).read_text()
    style = next(l for l in body.splitlines() if l.startswith("Style: Default"))
    margin_v = int(style.split(",")[-2])
    # Platform UI eats roughly the bottom 12% - captions must clear it.
    assert margin_v >= 1920 * 0.12


def test_multiple_styles_are_available():
    assert "clean" in captions.available_styles()
    assert len(captions.available_styles()) >= 2


def test_wrapping_respects_the_line_limit():
    lines = captions.wrap_text("one two three four five six seven eight nine ten eleven twelve")
    assert len(lines) <= captions.MAX_LINES
