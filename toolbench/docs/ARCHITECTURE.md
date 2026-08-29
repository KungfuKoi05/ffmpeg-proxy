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

**Analytics cannot carry content.** `lib/analytics.ts` strips any prop key
matching `text|content|value|input|output|body|email|url|file|name` before
sending. The ingest route independently allow-lists event names. Two
independent barriers, because "we promise not to log it" is not a control.
Verified by a browser test that types identifiable text and asserts it never
appears in any outbound payload.

**Storage degrades instead of blocking.** `lib/storage.ts` counts in memory when
`DATABASE_URL` is absent, so the app is deployable today at $0. The Postgres
schema exists; the driver is deliberately not wired up, because writing an
untestable database path against a database that does not exist is how you ship
bugs.

## Known gaps

- **`/admin` has no authentication.** It is `Disallow`ed in robots.txt, which is
  not a security control. It exposes only aggregate counts and no user content,
  but it must be gated before any public deploy. This is stated on the page
  itself, in red.
- **No accounts, no billing.** Plans exist in the schema only.
- **Analytics counts reset on restart** until a database is attached.
- **Rate limiting on `/api/events` is per-instance**, so effective capacity
  scales with instance count. Fine for flood protection, not for a determined
  attacker.
- **No image or PDF tools yet.** Both are browser-feasible (Canvas, pdf-lib) and
  are the next build; the launch set was kept to what could be fully verified.
