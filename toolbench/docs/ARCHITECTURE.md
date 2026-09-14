# Architecture

## Shape

A single Next.js app. No database, no queue, no worker, no object storage. That
is not a shortcut — it is the design. Every tool runs in the visitor's browser,
so there is no server-side work to schedule and nothing to store.

```
Search result ──► static tool page (prerendered, ~126kB JS)
                        │
                        ├─ tool runs in the browser, on the user's data
                        │  (no network call, works offline after load)
                        │
                        └─ anonymous event ──► /api/events ──► counters
```

## Layers

**`lib/tools/{text,dev,calc}.ts`** — pure functions. No DOM, no I/O, no React.
This is where correctness lives and where all the interesting tests point. They
run identically in Node (tests) and the browser (production).

**`lib/tools/registry.ts`** — the catalogue. Drives routes, `generateStaticParams`,
metadata, canonicals, JSON-LD, breadcrumbs, the sitemap, the directory, and
related-tool links. One entry, seven surfaces.

**`components/tools/*`** — the interactive layer. Thin: state, inputs, and
rendering. All real logic is delegated to the pure functions above.

**`components/tools/index.tsx`** — slug → component. Kept honest by a test.

## Decisions worth knowing

**Errors are values, not exceptions.** Every function that takes user input
returns `{ ok, value, error }`. Bad JSON, an invalid regex, a stray `%ZZ`, a
zero denominator — all normal paths that produce a message, not a stack trace.

**Bounded work.** The regex tester stops after 5,000 matches so a catastrophic
pattern cannot lock the tab. UUID batches cap at 500. The event queue caps and
the ingest endpoint rejects oversized bodies.

**`/admin` fails closed.** `middleware.ts` gates it with HTTP Basic against
`ADMIN_PASSWORD` using a constant-time comparison. If the variable is unset the
route returns 503 — a missing config must never be the thing that exposes the
dashboard.

**Analytics cannot carry content.** `lib/analytics.ts` strips any prop key
matching `text|content|value|input|output|body|email|url|file|name` before
sending. The ingest route independently allow-lists event names. Two
independent barriers, because "we promise not to log it" is not a control.
Verified by a browser test that types identifiable text and asserts it never
appears in any outbound payload.

**Downloads are never triggered after async work.** A browser only honours a
programmatic download while the user's click is still "active", and that lapses
across the awaits needed to parse and rebuild a PDF — the file silently never
arrives. Every tool that does real work hands back a result with its own
Download button instead. This was a real bug, found by driving the merge tool
with actual PDFs.

**Heavy libraries are dynamically imported.** `pdf-lib` (document surgery) and
`pdfjs-dist` (page rendering, ~344 KB plus a 1,343 KB worker) load only when a
tool that needs them is used. A visitor who came for the word counter downloads
neither; shared first-load JS stays at ~103 KB.

**A tool that cannot help says so.** `compress-pdf` samples the input's text
density before doing any work and warns when rasterising will make the file
bigger, then checks the output and withholds a result that grew. Both rules are
pure functions in `lib/tools/pdf-render.ts`, unit-tested against the byte counts
actually measured in a browser. The general principle: where a tool has a known
failure mode, encode it as logic rather than leaving the user to discover it.

**Storage degrades instead of blocking.** `lib/storage.ts` counts in memory when
`DATABASE_URL` is absent, so the app is deployable today at $0. The Postgres
schema exists; the driver is deliberately not wired up, because writing an
untestable database path against a database that does not exist is how you ship
bugs.

## Known gaps

- **No accounts, no billing.** Plans exist in the schema only.
- **Analytics counts reset on restart** until a database is attached.
- **Rate limiting on `/api/events` is per-instance**, so effective capacity
  scales with instance count. Fine for flood protection, not for a determined
  attacker.
- **No OCR or PDF→Word.** Both need heavy WASM or are not reliably solvable
  client-side. Deliberately deferred — see BUSINESS.md.
- **PDF tools skip document-level features.** Page content, text and images copy
  faithfully; bookmarks, form fields and annotations may not survive a
  split or merge. Stated in the tools' own FAQs.
- **PDF compression only helps scans.** It works by rasterising, so a document
  with a real text layer loses that layer and usually grows. The tool detects
  this and refuses rather than pretending otherwise, but the underlying
  limitation stands — see DECISIONS D10 for what a v2 would need.
- **`pdfjs-dist` is held at v4.** v5 calls `Map.prototype.getOrInsertComputed`,
  which does not exist in current Chromium, so it throws on every render.
  DECISIONS D11.
