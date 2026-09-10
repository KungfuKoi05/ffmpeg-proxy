# Architecture

## Shape of the thing

```
┌────────────────────────────────────────────────────────────────┐
│  Browser — React 18 + TypeScript + Tailwind 4                  │
│  Paste → poll /api/jobs/{id} → preview → download              │
└───────────────────────────┬────────────────────────────────────┘
                            │ HTTP (JSON + ranged media)
┌───────────────────────────▼────────────────────────────────────┐
│  FastAPI                                                       │
│    /api/jobs      create · poll · clips · cancel · zip · delete │
│    /api/clips     metadata · stream · download · subs · thumb   │
│    /api/system    dependency + capability report                │
└───────────────────────────┬────────────────────────────────────┘
                            │ submit(job_id)
┌───────────────────────────▼────────────────────────────────────┐
│  JobManager — ThreadPoolExecutor (MAX_CONCURRENT_JOBS)          │
│  Pipeline: download → transcript → audio → select → render      │
└───────┬──────────────────────────────────────────┬─────────────┘
        │                                          │
   ┌────▼─────┐  ┌──────────────┐  ┌───────────────▼───────────┐
   │  yt-dlp  │  │ SQLite (WAL) │  │ FFmpeg / FFprobe          │
   └──────────┘  └──────────────┘  └───────────────────────────┘
```

**Why threads, not processes.** Every expensive step releases the GIL: yt-dlp
waits on the network, FFmpeg is a subprocess, Whisper's inference is C++. A
thread pool gets full parallelism with none of the pickling and IPC complexity
of `multiprocessing`, and SQLite in WAL mode lets the API read while a worker
writes.

**Why FastAPI over the Node service already in this repo.** yt-dlp is a Python
library. Importing it directly yields structured exceptions and progress hooks;
shelling out to a binary means parsing stderr to find out what went wrong. The
legacy `server.js` FFmpeg proxy at the repo root is untouched and unrelated.

---

## The pipeline

`backend/app/workers/pipeline.py` runs five stages. The percentages are the
real cost of each, and progress inside them comes from byte counters and
FFmpeg's own `-progress` output — nothing is on a timer.

| Stage | Bar | What happens |
|---|---|---|
| `DOWNLOADING` | 2 → 40 | one copy of the source, plus caption tracks |
| `ANALYZING` | 40 → 64 | transcript, then `silencedetect` over the audio |
| `SELECTING_CLIPS` | 64 → 70 | candidates → scores → selection → snapping |
| `PROCESSING` | 70 → 97 | one FFmpeg render per clip, plus thumbnails |
| finalize | 97 → 100 | persist rows, delete the source media |

A job is never downloaded twice: one `source.mp4` in `temp/<job_id>/` feeds
every clip, and it is deleted the moment the last one is rendered.

---

## Clip selection

This is the part that makes the product, so it is built as a chain of small
pieces that can each be replaced.

```
words → segments → candidates → scored candidates → selection → snapped ranges
```

### 1. Segmentation — `analyzers/segmentation.py`

Word-level timings become sentence-like units. If the transcript has real
punctuation (manual captions, Whisper), we split on `.!?`. YouTube's automatic
captions have **no punctuation at all**, so we fall back to prosody: a gap of
≥0.55 s between words is a clause break, ≥1.0 s is a sentence break. Each
segment records the silence before and after it, and whether it completes a
thought.

### 2. Candidate generation — `analyzers/candidate_generator.py`

Every window of consecutive segments whose duration lands in [30 s, 60 s].
Because windows are built *from* segments, a candidate can never start or end
mid-sentence — that constraint is structural, not a scoring penalty.

For a video with no transcript at all, a separate generator lays out cuts on
detected silences instead, so even the fallback avoids blind equal slicing.

### 3. Scoring — `analyzers/candidate_scorer.py`

Nine signals, each returning 0–1, combined as a weighted sum:

| Signal | Weight | Measured from |
|---|---:|---|
| `hook` | 0.20 | opening line: hook phrases, questions, numbers, direct address; penalised for dangling conjunctions |
| `completeness` | 0.16 | starts a sentence, ends one, doesn't trail off on "and" |
| `density` | 0.13 | words/second against a 2.7 wps ideal, content-word ratio, explanation markers |
| `coherence` | 0.12 | cosine similarity of each sentence to the window's overall term vector |
| `duration_fit` | 0.12 | flat preference for 45–60 s, tapering to the 30 s floor |
| `boundary` | 0.10 | pause length before and after, plus speech-vs-silence coverage |
| `payoff` | 0.07 | conclusion markers, laughter, a completed final sentence |
| `emotion` | 0.05 | intensity lexicon rate, exclamations |
| `question_answer` | 0.05 | a question early with substantial content after it |

Each clip stores its full breakdown, which the UI exposes behind **Why this
clip?**. There is no model in this path and no claim of one.

### 4. Selection — `analyzers/clip_selector.py`

Greedy maximal marginal relevance:

```
adjusted = score − 0.45 × (max similarity to anything already picked)
                 + 0.10 × (distance from picks in the timeline)
```

Overlapping windows are rejected outright, and any candidate more than 62%
similar to an existing pick is dropped as a near-duplicate. Target count scales
with video length (5 at four minutes, 8 past thirty). If quality runs out, it
returns fewer clips rather than padding the set.

### 5. Boundary snapping

Selected ranges are nudged to the nearest detected pause within ±0.9 s, given
0.2 s of lead-in and 0.35 s of tail, and re-clamped to [30 s, 60 s]. That
lead-in is why clips sound edited rather than chopped.

### Optional LLM re-ranking — `analyzers/llm_ranker.py`

Off unless `LLM_RANKING_ENABLED=1` **and** a key is set. It sends only a
numbered list of already-validated candidates with short excerpts. Returned
indices are checked against that list, durations are re-verified, and the
result is run back through the overlap and diversity filter. Anything
unrecognised is discarded; any failure falls back to the heuristic ranking
silently. The model can never widen a clip or invent a timestamp.

---

## Rendering — `render/renderer.py`

Deliberate quality decisions:

* **Re-encode, don't stream-copy.** Stream copy can only cut on keyframes,
  which is how you get clips that start two seconds late. CRF 18 with x264 is
  visually near-lossless and costs one generation.
* **Never upscale.** A 9:16 crop of 1920×1080 is 606×1080 of real pixels, and
  that is what gets written. Sources above the quality cap are downscaled to
  fit 1920 on the long edge; nothing is ever enlarged and relabelled.
* **Audio is preserved** at AAC 192 kbps / 48 kHz, or the clip is rendered
  silent only if the source genuinely has no audio track.
* **No watermark, no branding, no overlay** other than captions you asked for.

### Reframing — `render/reframe.py`

`ReframeStrategy` is a two-method interface with two implementations:

* `CenterCrop` — geometric, always available.
* `ContentAwareCrop` — decodes ~12 grayscale samples of the clip at 160×90,
  sums the horizontal gradient (detail: faces, text, objects) and the
  frame-to-frame difference (motion: the person talking), then slides the crop
  window to the highest-scoring position with a mild centre prior. Falls back
  to `CenterCrop` if sampling fails.

A face or speaker tracker slots in as a third implementation without the
renderer changing.

### Captions — `render/captions.py`

Words are grouped into cues of ≤7 words / ≤3.2 s / ≤2 lines, written as ASS and
burned in with libass *after* scaling, so font size matches output resolution.
Styles are dictionary entries (`clean`, `boxed`, `bold-yellow`), and captions
sit above the bottom 16% so platform UI doesn't cover them. An `.srt` sidecar
is always written when a transcript exists, whether or not you burn captions in.

---

## Data model

```
Job  1 ──── n  Clip
```

`Job` carries the source metadata, the requested options, live status and
progress, the transcript source, an analysis summary, structured error fields,
and `expires_at`. States: `QUEUED → DOWNLOADING → ANALYZING → SELECTING_CLIPS
→ PROCESSING → COMPLETED`, plus `FAILED`, `CANCELLED`, `EXPIRED`.

`Clip` carries its index, title, in/out points, real rendered dimensions, file
size, paths, score and full score breakdown, and its transcript excerpt.

---

## Security

| Risk | What stops it |
|---|---|
| Command injection | Every subprocess takes an argument list. No shell, anywhere. |
| Malicious URLs | The user's string is never passed on. We extract an 11-character video ID, validate its charset, and rebuild a canonical URL ourselves. |
| Path traversal | `safe_join` resolves and asserts containment; stored paths are re-checked against the storage roots before any file is served. |
| Hostile filenames | Video titles come from strangers. `sanitize_filename` reduces them to ASCII word characters, handles Windows reserved names, and truncates. |
| Subtitle injection | Transcript text is escaped before it reaches ASS, so `{\an8}` in a caption cannot become a positioning override. |
| Cross-job access | Each job carries a capability token, accepted via header, query parameter or cookie. A mismatch returns 404, not 403 — a stranger learns nothing. |
| Runaway jobs | Timeouts on every subprocess, a max source duration, a max concurrent job count, and a free-disk check before work starts. |
| Information leaks | `utils/errors.py` maps every exception to a vetted sentence. Stack traces, paths and command lines never reach the browser. |
| Unbounded storage | Every job expires (`JOB_TTL_HOURS`); a daemon sweeps expired jobs and orphaned directories. |

---

## Layout

```
backend/app/
  main.py           FastAPI app, CORS, error handlers, static hosting
  config.py         env-driven settings
  models.py         Job, Clip
  api/              jobs · clips · system · deps (ownership, range serving)
  services/         youtube (yt-dlp) · transcript · media (ffmpeg) · storage
  analyzers/        segmentation · candidates · scorer · selector · titles · llm
  render/           renderer · reframe · captions
  workers/          job_worker · pipeline · progress · cleanup
  utils/            urls · files · errors · logging
frontend/src/       App · api · components
scripts/            setup · start · dev · make_test_video
```

---

## Deploying this

The app is built to run locally, which is the honest shape for it: the source
video never leaves the machine, and a public deployment's IP gets blocked by
YouTube quickly. If you deploy anyway, these are the pieces that must change —
they are gaps by design, not oversights:

1. **Authentication.** The capability token isolates jobs from each other; it
   is not a login. Add real accounts and scope `Job.owner_token` to a user ID.
2. **Job queue.** The in-process thread pool dies with the server. Move to
   Redis + RQ or Celery; `pipeline.run_job(job_id)` is already the whole task.
3. **Storage.** Local disk becomes S3 or equivalent, with signed URLs replacing
   the file-serving endpoints in `api/clips.py`.
4. **Rate limits.** Per-user job quotas, and a global cap well under what your
   CPU can sustain.
5. **CORS and cookies.** `CORS_ORIGINS` must list real origins, and the
   ownership cookie needs `secure=True` behind HTTPS.

The seams for the roadmap features — TikTok/Reels export presets, face
tracking, animated caption styles, AI ranking, batch processing — are the
`ReframeStrategy` interface, the `STYLES` caption registry, the scorer's weight
table, and the analyzer chain. Each is replaceable in isolation.
