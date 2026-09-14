# Toolbench

A multi-tool utility platform. 36 tools live, all running in the browser.

**State:** builds, typechecks, lints clean, 180 tests pass, verified in a real
browser against real image and PDF files. **Not deployed. No domain. No
revenue.**

## Run it

```bash
cd toolbench
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## What exists

| Area | State |
|---|---|
| 36 tools across PDF, image, text, developer, calculators | Working, browser-side, tested |
| Tool registry driving pages/sitemap/linking | Working |
| SEO: metadata, canonicals, JSON-LD, sitemap, robots | Working, verified in rendered HTML |
| Analytics (privacy-first, no cookies) | Working; in-memory storage |
| Admin dashboard | Working; HTTP Basic auth, fails closed |
| Database schema | Written, **not applied** |
| Billing | **Not built** |
| Accounts | **Not built** |

## Layout

```
app/            routes: home, /tools, /tools/[category], /[slug], /privacy, /admin
lib/tools/      pure logic (text, dev, calc) + the registry
lib/            analytics, storage, site config
components/     UI primitives and the tool components
db/schema.sql   Postgres schema (not applied)
tests/          180 tests
docs/           this
```

## The one thing to understand

`lib/tools/registry.ts` is the source of truth. Adding a tool is one registry
entry plus one component; pages, sitemap, breadcrumbs, related links and
structured data follow automatically. `tests/registry.test.ts` and
`tests/tools.test.ts` fail the build if the two drift.

## Docs

`BUSINESS.md` (model, tool selection, costs) · `ARCHITECTURE.md` (how and why) ·
`SEO.md` · `ROADMAP.md` · `DECISIONS.md` · `AGENTS.md` · `CHANGELOG.md`
