"""Crop geometry and content-aware repositioning."""
from __future__ import annotations

import pytest

from backend.app.render.reframe import CenterCrop, ContentAwareCrop, target_dimensions


@pytest.mark.parametrize(
    "width,height,aspect,expected",
    [
        (1920, 1080, "9:16", (606, 1080)),
        (1920, 1080, "1:1", (1080, 1080)),
        (1920, 1080, "16:9", (1920, 1080)),
        (1080, 1920, "9:16", (1080, 1920)),
        (1080, 1920, "16:9", (1080, 606)),
        (3840, 2160, "9:16", (1214, 2160)),
        (640, 480, "9:16", (270, 480)),
    ],
)
def test_target_dimensions(width, height, aspect, expected):
    assert target_dimensions(width, height, aspect) == expected


def test_dimensions_are_always_even():
    """Odd dimensions break yuv420p encoding."""
    for w, h in [(1921, 1081), (853, 480), (1279, 719)]:
        out_w, out_h = target_dimensions(w, h, "9:16")
        assert out_w % 2 == 0 and out_h % 2 == 0


def test_no_crop_when_the_aspect_already_matches():
    assert CenterCrop().compute(
        None, source_width=1080, source_height=1920, aspect="9:16", start=0, duration=10
    ) is None


def test_center_crop_is_centred():
    crop = CenterCrop().compute(
        None, source_width=1920, source_height=1080, aspect="9:16", start=0, duration=10
    )
    assert crop is not None
    assert crop.width == 606 and crop.height == 1080
    assert crop.x == pytest.approx((1920 - 606) / 2, abs=2)
    assert crop.to_filter() == f"crop=606:1080:{crop.x}:{crop.y}"


def test_crop_never_leaves_the_frame():
    for width, height in [(1920, 1080), (1280, 720), (640, 360), (3840, 2160)]:
        crop = CenterCrop().compute(
            None, source_width=width, source_height=height, aspect="9:16", start=0, duration=5
        )
        assert crop is not None
        assert crop.x >= 0 and crop.y >= 0
        assert crop.x + crop.width <= width
        assert crop.y + crop.height <= height


def test_content_aware_falls_back_when_sampling_fails(tmp_path):
    """A missing or unreadable file must not break rendering."""
    crop = ContentAwareCrop().compute(
        tmp_path / "nope.mp4",
        source_width=1920, source_height=1080, aspect="9:16", start=0, duration=10,
    )
    assert crop is not None
    assert crop.width == 606


@pytest.mark.e2e
def test_content_aware_crop_follows_the_subject(test_video):
    """The synthetic video puts its detail at x=200..760, left of centre."""
    crop = ContentAwareCrop().compute(
        test_video["video"],
        source_width=1920, source_height=1080, aspect="9:16", start=20.0, duration=30.0,
    )
    centre_crop = CenterCrop().compute(
        None, source_width=1920, source_height=1080, aspect="9:16", start=0, duration=1
    )
    assert crop is not None and centre_crop is not None
    # It should sit left of a plain centre crop, and still cover the subject.
    assert crop.x < centre_crop.x
    assert crop.x <= 480  # subject centre is x=480
    assert crop.x + crop.width >= 480
