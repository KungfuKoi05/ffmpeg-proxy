# YouTube Clip Generator

Paste a YouTube link — **or drop in a video file you already have** — and get
5–8 share-ready short clips. Runs entirely on your own machine: no account, no
cloud, no watermark.

```
Paste (or drop a file)  →  Generate  →  Preview  →  Download
```

---

## What it actually does

It does **not** slice the video into equal pieces. It reads what is being said,
finds sections that stand on their own, and cuts on sentence boundaries:

1. **Downloads** the source once, at up to 1080p (`yt-dlp`).
2. **Gets a transcript** — the video's own captions if it has them, otherwise
   local Whisper if you installed it.
3. **Listens to the audio** for pauses (`ffmpeg silencedetect`), so cuts land on
   real breaks in speech rather than mid-word.
4. **Builds every legal 30–60s window** that starts and ends on a sentence.
5. **Scores each one** on nine measurable signals — opening strength, whether
   the thought completes, information density, topic coherence, clean edges,
   payoff, emotional intensity, question-and-answer shape, and duration fit.
6. **Picks the best 5–8**, rejecting overlaps and near-duplicates so you get
   different ideas rather than the same point eight times.
7. **Renders** each clip with FFmpeg, reframed to your chosen aspect ratio.

Every clip carries its own score breakdown — click **Why this clip?** on any
card to see which signals earned it a place. There is no hidden AI here; the
scoring is arithmetic you can read in
[`candidate_scorer.py`](backend/app/analyzers/candidate_scorer.py).

An optional LLM re-ranking mode exists and is **off by default**. The app is
fully functional without any API key.

---

## Requirements

| Tool | Version | Needed for |
|---|---|---|
| **FFmpeg** + **FFprobe** | 5.0+ | all video processing |
| **Python** | 3.10+ | the backend |
| **Node.js** | 18+ | building the web UI (once) |

`yt-dlp` installs automatically with the Python dependencies.

**Installing FFmpeg**

```bash
# macOS
brew install ffmpeg

# Debian / Ubuntu
sudo apt update && sudo apt install ffmpeg

# Fedora
sudo dnf install ffmpeg

# Windows
winget install Gyan.FFmpeg
```

The app checks for these on startup and tells you in the UI exactly what is
missing and how to install it — it never fails halfway through a job because a
tool was absent.

---

## Install and run

```bash
git clone <this repo>
cd ffmpeg-proxy

./scripts/setup.sh        # checks tools, installs deps, builds the UI
./scripts/doctor.sh       # confirms it can actually run — including YouTube
./scripts/start.sh        # starts the app
```

Then open **http://127.0.0.1:8000**.

`doctor.sh` is the one to run when something isn't working. It checks every
dependency, your disk, the built UI, and then asks YouTube for the metadata of
a Creative Commons video — so you find out in ten seconds whether downloads
work from your machine, and get the exact fix if they don't.

<details>
<summary>Manual setup, if you prefer</summary>

```bash
python3 -m venv .venv
./.venv/bin/pip install -r backend/requirements.txt

cd frontend && npm install && npm run build && cd ..

cp .env.example .env
./.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
</details>

<details>
<summary>Development mode (hot reload)</summary>

```bash
./scripts/dev.sh
```

Backend on `:8000` with auto-reload, Vite dev server on `:5173`. Open
**http://127.0.0.1:5173** — it proxies `/api` to the backend, so cookies and
video streaming work exactly as in production.
</details>

### Optional: transcription for videos without captions

Most YouTube videos have captions, and those are used automatically. For the
ones that don't:

```bash
WITH_WHISPER=1 ./scripts/setup.sh
# or: ./.venv/bin/pip install -r backend/requirements-whisper.txt
```

This adds `faster-whisper`, which downloads a ~150 MB model the first time it
runs and transcribes locally. Without it, captionless videos fall back to
audio-only segmentation — still pause-aligned, but noticeably less smart.

---

## When YouTube blocks the download

This is the most likely thing to go wrong, and it is not a bug in the app.
YouTube throttles and challenges automated downloads, especially from
datacenter, VPN and CI addresses. Run `./scripts/doctor.sh` to find out which
of these you're hitting.

**"YouTube is temporarily refusing our requests"** — it wants a signed-in
session. Point yt-dlp at a browser you're already logged into:

```bash
# in .env
YTDLP_COOKIES_FROM_BROWSER=chrome     # or firefox, safari, edge, brave…
```

This presents *your own* session. It does not circumvent any access control —
a video you can't watch while signed in is still refused. You can also export
a `cookies.txt` and set `YTDLP_COOKIES_FILE`, or route through a proxy with
`YTDLP_PROXY`.

**yt-dlp errors on a video that plays fine in a browser** — YouTube changed
something. Update: `./.venv/bin/pip install -U yt-dlp`.

**Nothing works, or the video isn't on YouTube at all** — use the file route
below. It needs no network whatsoever.

---

## Using a video file instead

Click **"or use a video file"** on the home screen, or drag a file anywhere
onto the form. MP4, MOV, MKV, WebM, AVI and friends all work.

Everything after that is identical — same transcript handling, same scoring,
same selection, same output. This path has no dependency on YouTube, which
makes it the reliable way to demo the app and the answer whenever the download
route is blocked.

Videos with no captions still work: the app falls back to transcribing locally
with Whisper if you installed it, and to pause-aligned audio segmentation if
you didn't.

---

## Processing a video

1. Paste any of these:
   `youtube.com/watch?v=…` · `youtu.be/…` · `youtube.com/shorts/…` ·
   `youtube.com/embed/…` · `youtube.com/live/…` · or a bare video ID.
2. Optionally open **Options** to change format, quality, clip count, clip
   length, or turn on burned-in captions.
3. Click **Generate Clips** and watch the real progress — the bar tracks
   downloaded bytes and FFmpeg's own reporting, not a timer.
4. Preview clips in the browser, download them one at a time, or take the lot
   as a ZIP with **Download All**.

### Output

* **Aspect ratios:** vertical 9:16 (default), landscape 16:9, square 1:1.
* **Resolution:** up to 1080p. **We never upscale.** A 9:16 crop of a 1080p
  source is 606×1080 of genuine pixels — not a 606-pixel-wide image stretched
  to 1080 and labelled "1080p". A 4K source is cropped and then downscaled to
  fit 1920 on the long edge.
* **Video:** H.264, CRF 18 (visually near-lossless), `+faststart`.
* **Audio:** AAC 192 kbps, 48 kHz, always preserved.
* **No watermark and no branding are added to the video. Ever.**
* Each clip ships with a matching `.srt` subtitle file when a transcript exists.

### Vertical reframing

For 9:16 output the app samples frames from each clip, measures where the
visual detail and the movement actually are, and centres the crop there — a
speaker sitting left of frame stays in shot instead of being cut in half. It
falls back to a centre crop if sampling fails. The strategy is a swappable
interface (`backend/app/render/reframe.py`), so a face or speaker tracker can
be dropped in later without touching the renderer.

---

## Configuration

Copy `.env.example` to `.env` and edit. Every value is optional.

| Variable | Default | What it does |
|---|---|---|
| `OUTPUT_DIRECTORY` | `./storage/jobs` | where finished clips live |
| `TEMP_DIRECTORY` | `./temp` | scratch space, deleted after each job |
| `MAX_VIDEO_DURATION` | `10800` | refuse videos longer than 3 hours |
| `MAX_CONCURRENT_JOBS` | `2` | how many videos process at once |
| `JOB_TTL_HOURS` | `24` | clips are deleted after this long |
| `MIN_CLIP_SECONDS` / `MAX_CLIP_SECONDS` | `30` / `60` | clip length bounds |
| `MIN_CLIPS` / `MAX_CLIPS` | `5` / `8` | how many clips to aim for |
| `VIDEO_CRF` | `18` | quality; lower is better and bigger |
| `VIDEO_PRESET` | `medium` | x264 speed/efficiency tradeoff |
| `PREFER_HARDWARE_ENCODER` | `0` | use NVENC/QSV/VideoToolbox if present |
| `WHISPER_MODEL` | `base` | `tiny`…`medium` |
| `LLM_RANKING_ENABLED` | `0` | optional AI re-ranking (needs a key) |
| `YTDLP_COOKIES_FROM_BROWSER` | — | use a signed-in browser session (`chrome`, `firefox`…) |
| `YTDLP_COOKIES_FILE` | — | path to an exported `cookies.txt` |
| `YTDLP_PROXY` | — | route yt-dlp through a proxy |
| `MAX_UPLOAD_MB` | `2048` | largest accepted video file |

Never commit `.env` — it's already in `.gitignore`.

---

## Testing

```bash
./.venv/bin/python -m pytest              # everything
./.venv/bin/python -m pytest -m "not e2e" # fast unit tests only (<1s)
```

The end-to-end suite generates a synthetic 1080p video with speech-shaped
audio and matching captions (`scripts/make_test_video.py`), then runs a real
job through the real API and asserts on the real output files: clip count,
durations, no overlaps, playable H.264+AAC streams, non-silent audio, correct
aspect ratios, HTTP range playback, downloads, ZIP integrity, ownership
isolation and temp-file cleanup.

---

## Troubleshooting

**Start here:** `./scripts/doctor.sh` diagnoses almost everything below and
prints the exact fix.

**"ffmpeg is not installed"** — install it (see above) and restart the app. The
banner in the UI shows the exact command for your platform.

**"We couldn't access this video"** — the video is private, deleted,
age-restricted or region-locked. Check it opens in a normal browser tab first.

**"YouTube is temporarily refusing our requests"** — you have been rate limited.
Wait a few minutes. Running this from a datacenter or VPN IP makes this much
more likely; YouTube blocks those aggressively.

**Clips are shorter than 45 seconds** — the video probably has short, choppy
segments. The app prefers a coherent 32-second thought over a padded 50-second
one that runs into an unrelated topic.

**Fewer than 5 clips** — there weren't enough self-contained sections. That's
deliberate: fewer good clips beat a padded set.

**Processing is slow** — encoding is CPU-bound. Set `VIDEO_PRESET=veryfast`
(slightly larger files, roughly 3× faster) or `PREFER_HARDWARE_ENCODER=1` if
your machine has NVENC, Quick Sync or VideoToolbox.

**yt-dlp errors on a video that works in a browser** — YouTube changes things
often. Update it: `./.venv/bin/pip install -U yt-dlp`. See
[When YouTube blocks the download](#when-youtube-blocks-the-download).

**Nothing about YouTube works** — use a video file instead; that route needs no
network at all.

---

## Rights and responsible use

This tool is for videos you own or otherwise have permission to download and
edit. It does not bypass DRM, authentication, paywalls, private-video controls
or any other technical protection, and it will not process videos it cannot
access legitimately. **You are responsible for having the necessary rights to
the content you process.**

---

## Deployment

The MVP is built to run locally, which is the right shape for this tool: the
source video never leaves your machine, and a public deployment gets its IP
blocked by YouTube quickly.

If you deploy it anyway, the pieces you must add are listed in
[ARCHITECTURE.md](ARCHITECTURE.md#deploying-this): real authentication, an
external job queue, object storage, and per-user rate limits. The current
ownership model is a capability token — sufficient for one person on one
machine, not for the public internet.

---

## A note on this repository

The repo is named `ffmpeg-proxy` and still contains an older, unrelated Node
FFmpeg-proxy service at the root (`server.js`, `Dockerfile`, root
`package.json`). That code is untouched and has nothing to do with this app.
Everything for the clip generator lives in `backend/`, `frontend/` and
`scripts/`.

---

## Documentation

* [SETUP.md](SETUP.md) — step-by-step installation for each platform
* [ARCHITECTURE.md](ARCHITECTURE.md) — how the pipeline works, module by module
