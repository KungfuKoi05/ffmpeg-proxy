#!/usr/bin/env python3
"""Build a synthetic 'talk' video plus a matching YouTube-style caption file.

This exists because an end-to-end test needs a real media file with real
speech-shaped audio, real pauses and a real transcript - without depending on
the network or on anyone's copyright.

Output:
    <out>/source.mp4        1080p H.264 + AAC, speech-like audio with pauses
    <out>/source.en.json3   YouTube json3 captions with per-word timings
    <out>/script.json       the ground truth, for assertions

Usage:
    python scripts/make_test_video.py --out /tmp/testvideo --minutes 8
"""
from __future__ import annotations

import argparse
import json
import math
import struct
import subprocess
import sys
import wave
from pathlib import Path

SAMPLE_RATE = 22050

# Twelve distinct topics so clip-diversity selection has something real to do.
TOPICS: list[list[str]] = [
    [
        "Most people think learning a language takes years of study.",
        "That is not what the research actually shows.",
        "The single biggest predictor is how many hours you spend listening.",
        "One student I worked with listened for two hours every single day.",
        "In eleven months she was holding real conversations.",
        "The grammar came later, almost by itself.",
    ],
    [
        "Here is the mistake almost every new runner makes.",
        "They run every session as hard as they possibly can.",
        "Your body adapts during recovery, not during the workout.",
        "So eighty percent of your running should feel easy.",
        "That is the whole secret, and nobody wants to hear it.",
        "Slow down and you will get faster.",
    ],
    [
        "Why does bread rise at all?",
        "Yeast eats the sugar in the flour and releases carbon dioxide.",
        "That gas gets trapped by the gluten network you built when kneading.",
        "If you skip the kneading the gas escapes and the loaf stays flat.",
        "It is a structural problem, not a chemistry problem.",
        "Understanding that changed how I bake everything.",
    ],
    [
        "I lost forty thousand dollars in my first year of business.",
        "The painful part is that I saw it coming and did nothing.",
        "I had built a product nobody had asked me for.",
        "Every customer conversation told me the same thing.",
        "I heard the words but I did not listen to them.",
        "Now I refuse to write a line of code before ten interviews.",
    ],
    [
        "The city of Venice is sinking about two millimetres a year.",
        "But the sea is also rising, which doubles the effective rate.",
        "Engineers built seventy eight mobile flood barriers to hold it back.",
        "They cost more than six billion euros.",
        "And they buy the city maybe another hundred years.",
        "It is the most expensive pause button ever built.",
    ],
    [
        "What actually happens when you cannot sleep?",
        "Your brain does not simply switch off the way a computer does.",
        "It cycles through stages, and each stage does a different job.",
        "Deep sleep repairs the body and clears waste from the brain.",
        "Dream sleep is where memory gets sorted and stored.",
        "Lose either one and you feel it the next day.",
    ],
    [
        "Nobody talks about how boring good investing is.",
        "You pick a low cost index fund and you buy it every month.",
        "Then you do absolutely nothing for thirty years.",
        "The people who beat the market usually beat it by accident.",
        "The people who lose money almost always traded too often.",
        "Boring is the entire strategy.",
    ],
    [
        "There is a reason old buildings feel better to stand in.",
        "The proportions follow rules that match how our eyes move.",
        "Windows are taller than they are wide, and repeat at a human scale.",
        "Modern glass towers break every one of those rules.",
        "That is why they photograph well and feel cold in person.",
        "Scale is not decoration, it is the whole experience.",
    ],
    [
        "The first computer bug was a literal moth.",
        "It was found inside a relay in nineteen forty seven.",
        "The operators taped it into the logbook and wrote bug found.",
        "The word had been used for faults since Edison, though.",
        "So the moth did not invent the term, it just made it famous.",
        "History is full of stories that are almost true.",
    ],
    [
        "How do you know when to quit something?",
        "Most advice tells you to never give up, which is useless.",
        "The better question is whether you are still learning.",
        "If every week teaches you something new, stay.",
        "If the last six months all looked the same, leave.",
        "Persistence without information is just stubbornness.",
    ],
    [
        "Salt does not only make food taste salty.",
        "It suppresses bitterness and makes sweetness read as stronger.",
        "That is why a pinch of salt improves chocolate and coffee.",
        "Professional kitchens salt in layers, at every stage.",
        "Home cooks salt once, at the end, and wonder why it tastes flat.",
        "Season early and season often.",
    ],
    [
        "My grandfather never threw anything away.",
        "He grew up when a broken chair meant you fixed the chair.",
        "I used to think it was stubbornness about money.",
        "It was actually a completely different relationship with objects.",
        "He knew how everything he owned was put together.",
        "I own more than he did and understand almost none of it.",
    ],
]

SENTENCE_GAP = 0.65
TOPIC_GAP = 1.6
WORDS_PER_SECOND = 2.9


def build_script(target_seconds: float) -> tuple[list[dict], float]:
    """Lay sentences out on a timeline with realistic pauses."""
    entries: list[dict] = []
    cursor = 1.2
    topic_index = 0
    while cursor < target_seconds:
        topic = TOPICS[topic_index % len(TOPICS)]
        topic_id = topic_index
        for position, sentence in enumerate(topic):
            words = sentence.split()
            duration = max(1.2, len(words) / WORDS_PER_SECOND)
            entries.append(
                {
                    "topic": topic_id,
                    "position": position,
                    "text": sentence,
                    "start": round(cursor, 3),
                    "end": round(cursor + duration, 3),
                }
            )
            cursor += duration + SENTENCE_GAP
        cursor += TOPIC_GAP
        topic_index += 1
    return entries, round(cursor + 1.5, 3)


def write_wav(entries: list[dict], duration: float, dest: Path) -> None:
    """Speech-shaped audio: amplitude-modulated tones during sentences, silence between.

    silencedetect only cares about level, so this exercises the real pause
    detection path exactly the way a podcast would.
    """
    total_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * total_samples

    for entry_index, entry in enumerate(entries):
        start = int(entry["start"] * SAMPLE_RATE)
        end = min(total_samples, int(entry["end"] * SAMPLE_RATE))
        # A different base pitch per sentence keeps it from sounding like one tone.
        base = 110 + (entry_index * 17) % 90
        for i in range(start, end):
            t = (i - start) / SAMPLE_RATE
            # Syllable envelope at ~4.5 Hz - the rhythm of speech.
            envelope = 0.5 + 0.5 * math.sin(2 * math.pi * 4.5 * t)
            # Fade the first and last 30 ms so cuts do not click.
            edge = min(1.0, (i - start) / (0.03 * SAMPLE_RATE), (end - i) / (0.03 * SAMPLE_RATE))
            value = (
                0.42 * math.sin(2 * math.pi * base * t)
                + 0.22 * math.sin(2 * math.pi * base * 2.1 * t)
                + 0.10 * math.sin(2 * math.pi * base * 3.4 * t)
            )
            samples[i] = value * envelope * max(0.0, edge)

    with wave.open(str(dest), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for value in samples:
            clipped = max(-1.0, min(1.0, value))
            frames += struct.pack("<h", int(clipped * 30000))
        handle.writeframes(bytes(frames))


def write_json3(entries: list[dict], dest: Path) -> None:
    """YouTube's json3 caption format, including per-word tOffsetMs."""
    events = []
    for entry in entries:
        words = entry["text"].split()
        span_ms = int((entry["end"] - entry["start"]) * 1000)
        step = max(120, span_ms // max(1, len(words)))
        segs = []
        for i, word in enumerate(words):
            segs.append({"utf8": word if i == 0 else f" {word}", "tOffsetMs": i * step})
        events.append(
            {
                "tStartMs": int(entry["start"] * 1000),
                "dDurationMs": span_ms,
                "segs": segs,
            }
        )
    dest.write_text(json.dumps({"wireMagic": "pb3", "events": events}), encoding="utf-8")


def render_video(audio: Path, dest: Path, duration: float) -> None:
    """1080p video with detailed, moving content offset to the left of frame.

    Off-centre on purpose: it gives the content-aware reframer something real
    to find instead of landing on the middle by default.
    """
    args = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", f"color=c=0x14161f:s=1920x1080:r=30:d={duration:.2f}",
        "-f", "lavfi", "-i", f"testsrc2=s=560x560:r=30:d={duration:.2f}",
        "-i", str(audio),
        "-filter_complex",
        "[1:v]scale=560:560[fg];[0:v][fg]overlay=x=200:y=260:shortest=1[v]",
        "-map", "[v]", "-map", "2:a",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
        "-t", f"{duration:.2f}",
        "-movflags", "+faststart",
        str(dest),
    ]
    subprocess.run(args, check=True, capture_output=True, timeout=1800)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--minutes", type=float, default=8.0)
    args = parser.parse_args()

    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    entries, duration = build_script(args.minutes * 60)
    print(f"script: {len(entries)} sentences over {duration/60:.1f} minutes")

    wav = out / "speech.wav"
    write_wav(entries, duration, wav)
    print(f"audio:  {wav} ({wav.stat().st_size/1e6:.1f} MB)")

    write_json3(entries, out / "source.en.json3")
    print(f"captions: {out / 'source.en.json3'}")

    render_video(wav, out / "source.mp4", duration)
    wav.unlink(missing_ok=True)
    print(f"video:  {out / 'source.mp4'} ({(out / 'source.mp4').stat().st_size/1e6:.1f} MB)")

    (out / "script.json").write_text(
        json.dumps({"duration": duration, "sentences": entries}, indent=2), encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
