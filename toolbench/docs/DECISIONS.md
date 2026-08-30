# Decisions

Each entry: what was decided, why, and what would reverse it.

## D1 — Every tool runs in the browser
**Decided:** no server-side processing for any launch tool.
**Why:** makes marginal cost zero, makes the privacy claim verifiable rather
than a promise, removes the entire upload attack surface, and means a traffic
spike costs nothing. This single choice is what makes a $100 budget realistic.
**Reverses if:** a tool with real demand is genuinely impossible client-side
(OCR at scale, PDF→Word). Then that *one* tool gets a server path and says so
on its own page — the default does not change.

## D2 — Launch 25 verified tools, not 80 shaky ones
**Decided:** ship text, developer and calculator tools; defer PDF→Word, OCR,
HEIC.
**Why:** a wrong answer from a calculator or a mangled conversion destroys the
trust that the whole traffic model depends on. Every launched tool is one we
can prove correct with a unit test.
**Reverses if:** never as a principle. Individual deferred tools ship when they
can be made reliable.

## D3 — A registry, not per-tool pages
**Decided:** one `TOOLS` array drives routes, metadata, sitemap, breadcrumbs,
structured data and internal links.
**Why:** the alternative is seven places to update per tool and guaranteed
drift. Tests fail the build if the registry and components disagree.
**Reverses if:** tools become so heterogeneous that shared metadata stops
fitting. Not foreseeable.

## D4 — No database at launch
**Decided:** schema written, driver not wired; events counted in memory.
**Why:** the app deploys today for $0 with no provisioning. Writing an
untestable Postgres path against a database that does not exist is how bugs
ship.
**Reverses if:** we need persistence across restarts — which is the moment real
traffic arrives. `lib/storage.ts` is the single seam to change.

## D5 — Self-hosted, cookieless analytics
**Decided:** own event pipeline; no third-party script.
**Why:** free, no consent banner, no third-party JS slowing the page, and it
lets us guarantee content never reaches an event. A privacy claim while loading
someone else's tracker would be dishonest.
**Reverses if:** we need funnel analysis beyond counts. Even then, self-hosted
first.

## D6 — Free tier is genuinely unlimited
**Decided:** nothing in the launch set is paywalled or capped (except a 500-UUID
batch, which is a performance guard).
**Why:** free usage *is* the acquisition channel. Crippling it to sell Pro
destroys the traffic the business is built on. Paid tiers will sell batch,
history and API — things a casual visitor genuinely does not need.
**Reverses if:** a specific tool proves expensive to serve. None currently are.

## D7 — No billing yet
**Decided:** plans defined in the schema; no Stripe integration.
**Why:** optimising checkout before there is traffic is optimising the wrong end
of the funnel. There is nobody to convert.
**Reverses if:** meaningful traffic appears. Then Pro, priced at $9 to start.

## D8 — No domain purchased
**Decided:** `toolbench.app` used as a placeholder in config; nothing bought.
**Why:** spending money is your decision, not ours. Cost is roughly $12/yr.
**Needs:** your approval. `NEXT_PUBLIC_SITE_URL` is the only thing to change.

## D9 — /admin ships unauthenticated, and says so
**Decided:** build the dashboard now; gate it before any public deploy.
**Why:** there is no account system yet, so password-gating would be theatre.
The page shows only aggregate counts and no user content, and it warns in red
that it is unprotected.
**Reverses:** immediately, when auth exists. This is the first pre-deploy task.

## D10 — PDF compression rasterises, warns first, and refuses a worse result
**Decided:** `compress-pdf` renders every page to a JPEG and rebuilds the
document. It assesses the input *before* the click and blocks the download when
the output came out bigger.

**Why:** measured, not assumed. A spike (`/spike`, since deleted) ran three
approaches against real files in Chromium:

| Input | Structural re-save | Rasterise |
|---|---|---|
| `real-scan.pdf` — 4,411,610 B, 4 pages of 300 dpi images | 0.0% | @2.0×/q0.75 → 595,644 B (**86.5% smaller**)<br>@1.5×/q0.70 → 430,444 B (**90.2%**)<br>@1.0×/q0.60 → 259,157 B (**94.1%**)<br>@0.75×/q0.50 → 166,610 B (**96.2%**) |
| `text-heavy.pdf` — 4,025 B, 6 pages of vector text | 4.5% | @1.5×/q0.70 → 910,766 B (**22,527% LARGER**) |
| `scanned.pdf` — 315,668 B, one JPEG ×8 | 0.0% | −207% (bigger) |

Structural re-save — dropping metadata and using object streams, which is all
pdf-lib can do — is worthless: 0.0% on the file people actually want to shrink.
Rasterisation is the only thing that works, and it is catastrophic on the wrong
input. So the tool cannot just be "a compressor"; it has to know which kind of
document it is looking at.

Hence two guards, both in `lib/tools/pdf-render.ts` and unit-tested against
these exact numbers:
- **Before:** `assessDocument()` samples up to 10 pages of `getTextContent()`.
  Above 40 text items per page it warns that the file will probably get larger;
  a scan yields 0.0 items per page and gets no warning. Measured on the
  fixtures: scan 0.0/page, text document 79.0/page.
- **After:** `judgeResult()` treats output ≥ input as a failure. That result is
  not offered as a download; the panel explains what happened, with the file
  still reachable behind a second explicit click. Other sites hand the larger
  file over silently.

**Reverses if:** a browser-side path to true PDF image re-encoding (recompress
the embedded images, keep the text layer) becomes practical. That would be
strictly better and is the natural v2.

## D11 — pdfjs-dist pinned to v4, not v5
**Decided:** `pdfjs-dist@4.10.38`.
**Why:** 5.7.284 throws `this[#rP].getOrInsertComputed is not a function` on
every render in Chromium 141. `Map.prototype.getOrInsertComputed` is a stage-3
proposal that is still `undefined` there, so v5 simply does not run on a
current browser. Found by driving the spike in a real browser; the package
installs and typechecks cleanly either way.
**Reverses if:** `getOrInsertComputed` ships in stable Chrome and Safari. Until
then v5 is unshippable regardless of what its release notes say.
**Cost:** pdf.js is ~344 KB plus a 1,343 KB worker, so it is dynamically
imported. Only the two rasterising tools pay for it; the first-load JS of every
other page is unchanged at ~103 KB.
