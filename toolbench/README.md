# Toolbench

Free browser-based utilities. 25 tools across text, developer and calculator
categories — every one runs on your own device, so nothing is uploaded.

**Status:** builds, typechecks, lints clean, 121 tests pass, verified working in
a real browser. **Not deployed. No domain purchased. No revenue.**

```bash
npm install
npm run dev

npm run typecheck && npm run lint && npm test && npm run build
```

## Why it's built this way

Every tool is a pure function running in the browser. That makes the marginal
cost of a visitor **$0**, makes the privacy claim verifiable instead of a
promise, and removes the upload attack surface entirely. It is the decision the
whole business model rests on — see [docs/BUSINESS.md](docs/BUSINESS.md).

## Adding a tool

1. Add the pure logic to `lib/tools/{text,dev,calc}.ts` — and a test.
2. Add an entry to `lib/tools/registry.ts`.
3. Add a component and register it in `components/tools/index.tsx`.

Routing, metadata, canonicals, JSON-LD, breadcrumbs, the sitemap and internal
links follow automatically. Tests fail the build if the registry and components
drift apart.

## Before deploying

- [ ] Add auth to `/admin` — it is currently unprotected (aggregate data only)
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the real host
- [ ] Decide on a domain (~$12/yr — needs your approval)

## Docs

[PROJECT](docs/PROJECT.md) · [BUSINESS](docs/BUSINESS.md) ·
[ARCHITECTURE](docs/ARCHITECTURE.md) · [SEO](docs/SEO.md) ·
[ROADMAP](docs/ROADMAP.md) · [DECISIONS](docs/DECISIONS.md) ·
[AGENTS](docs/AGENTS.md) · [CHANGELOG](docs/CHANGELOG.md)
