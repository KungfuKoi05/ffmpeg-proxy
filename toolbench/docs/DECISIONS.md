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
