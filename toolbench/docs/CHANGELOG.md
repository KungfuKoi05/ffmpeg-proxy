# Changelog

## 0.3.0 — PDF compression and PDF→JPG

**Added**
- **Compress PDF.** Rasterises each page to JPEG and rebuilds the document, at
  three quality levels. Warns *before* you commit when the input is a text
  document rather than a scan, and refuses to present a result that came out
  bigger than the input.
- **PDF to JPG.** One JPEG per page at screen (150 dpi) or print (300 dpi), with
  thumbnails, per-page downloads and a download-all. Capped at 200 pages.
- `lib/tools/pdf-render.ts` — presets, the text-density assessment and the
  size verdict, with 20 tests asserting the measured numbers directly.
- 36 tools live (was 34). 200 tests (was 180).

**Changed**
- `pdfjs-dist` pinned to 4.10.38. v5.7.284 throws
  `this[#rP].getOrInsertComputed is not a function` on every render in
  Chromium 141 — see docs/DECISIONS.md D11.
- Both new tools dynamically import pdf.js, so first-load JS elsewhere is
  unchanged (~103 KB shared).

**Removed**
- The temporary `/spike` measurement route. Its findings are in DECISIONS D10.

**Verified in a browser with real files** (Chromium, production build)
- `real-scan.pdf` 4.2 MB → 420 KB, **90.2% smaller** at Balanced
- Same file → 253 KB, **94.1% smaller** at Smallest file
- Output keeps 4 pages at 612×792 pt, identical to the input
- `text-heavy.pdf` (6 pages of vector text): warning shown before the click;
  result was 226× bigger, so no download was offered — only the explanation
  and an explicit "download the larger file anyway"
- PDF→JPG: 4 valid JPEGs at 1224×1584 (screen), 6 at 2448×3168 (print)
- No console errors or page errors on any run

## 0.2.0 — image and PDF tools, admin auth

**Added**
- Image tools (5), Canvas-based, client-side: compressor, resizer, JPG→PNG,
  PNG→JPG, WebP converter. Batch capable, with drag-and-drop.
- PDF tools (4), `pdf-lib` loaded on demand: merge (with reordering), split /
  extract pages, delete pages, rotate. Page ranges accept `1-3, 5, 8-`.
- `/admin` protected by HTTP Basic auth (`middleware.ts`) with a constant-time
  comparison. **Fails closed:** 503 when `ADMIN_PASSWORD` is unset.
- 59 new tests (180 total).

**Fixed**
- PDF downloads silently never arrived. The download was triggered after several
  `await`s, by which point the browser's user activation had lapsed, so it was
  dropped with no error. Both PDF tools now return a result with its own
  Download button — the same pattern the image tools already used. Found by
  driving the merge tool with real PDFs; no unit test would have caught it.

**Verified in a browser with real files**
- Compressor: 577 KB → 64 KB (89% smaller), valid JPEG bytes on disk
- Resizer: 200×150 from a width-only input, ratio preserved
- Merge: 3-page + 2-page PDFs → one 5-page PDF, valid header
- Split: 2 pages extracted from a 3-page document
- Bad page range rejected with "Page 99 doesn't exist — the document has 3."
- Admin auth: 503 unset · 401 no credentials · 401 wrong · 200 correct

## 0.1.0 — initial build

**Added**
- 25 tools across three categories, all browser-side:
  - Text (11): word counter, character counter, case converter, remove
    duplicate lines, remove empty lines, remove extra spaces, sort lines,
    reverse text, find and replace, extract emails, extract URLs
  - Developer (6): JSON formatter, Base64, URL encoder, UUID generator,
    timestamp converter, regex tester
  - Calculators (8): percentage, discount, profit margin, loan, compound
    interest, hourly-to-salary, paint, concrete
- Registry-driven routing, metadata, sitemap, robots, JSON-LD, breadcrumbs and
  internal linking
- Privacy-first analytics with a content-leak filter, and a hardened ingest
  endpoint
- Admin dashboard (unauthenticated — see DECISIONS D9)
- Postgres schema (not applied)
- 121 tests

**Fixed during the build**
- `findReplace` used a function replacement, which made JS treat `$1` as literal
  text — regex capture groups never worked despite the FAQ documenting them.
  Caught by a test written before the UI existed.
- Shuffle used a `useMemo` dependency the linter correctly flagged as unused;
  replaced with a genuinely seeded generator, which also made shuffles
  reproducible.

**Verified**
- typecheck clean · lint clean · 121 tests pass · production build succeeds
  (36 pages) · driven in a real browser: word counter, JSON formatter (including
  error positions), loan calculator (matches hand-checked $1,199.10), case
  converter, full SEO surface, and analytics confirmed not to leak content

**Not done**
- Not deployed · no domain · no accounts · no billing · `/admin` unauthenticated
- No image or PDF tools yet (both added in 0.2.0)
