# BuildSight

A firearm component **configuration, visualization, compatibility and
purchasing-planning** platform. Assemble a virtual configuration from
commercially available components, check documented compatibility, visualize
dimensions and clearances, and watch estimated cost and unloaded weight update
as you swap parts.

## Product boundary

BuildSight works from manufacturer-published specifications. It supports:

- product visualization, comparison and dimension display
- documented compatibility and dimensional clearance checking
- price comparison, price history and watchlists
- shopping-list organisation and links to manufacturer documentation

It does **not** provide manufacturing or machining instructions, weapon
conversion (including automatic fire), safety-mechanism defeat, ammunition or
load recipes, instructions for illegal modification, or automated purchasing of
regulated products. The boundary is enforced in code by
`src/lib/policy/policy.ts`, a deterministic classifier applied to every
free-text surface — not by prompt instructions. See `/docs/policy` in the
running app.

## Three ideas the product keeps apart

| Concept | Question it answers | Source of truth |
| --- | --- | --- |
| Documented compatibility | Does an authored, sourced rule say these parts work together? | `CompatibilityRule` rows |
| Dimensional clearance | Do published dimensions say these parts physically clear? | `Product` / `Dimension` measurements |
| Functional compatibility | Will the combination actually function? | Only ever asserted by an explicit rule |

`UNKNOWN` is never rendered as compatible, and a configuration containing an
unknown connection is never reported as fully compatible.

## Quick start

```bash
cp .env.example .env          # set DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate            # apply migrations
npm run db:seed               # load the labelled demo catalog
npm run dev
```

Seeded accounts (demo data only):

- `admin@buildsight.local` / `admin12345` — administrator
- `demo@buildsight.local` / `demo123456` — two saved configurations and a watchlist

Everything in the bundled catalog is synthetic and labelled `DEMO MANUFACTURER`
/ `DEMO PRODUCT`. No real manufacturer specification is reproduced or invented.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm test` | Vitest unit, component and integration suites |
| `npm run test:e2e` | Playwright end-to-end suite (desktop and mobile) |
| `npm run db:migrate` / `db:deploy` | Prisma migrations (dev / production) |
| `npm run db:seed` / `db:reset` | Seed or reset the demo catalog |

## Architecture

```
src/
  lib/            pure domain code — no Prisma, no React
    compatibility/  rules engine
    dimensions/     clearance and layout engine
    build/          cost, weight and confidence scoring
    quality/        data-quality checks
    policy/         product boundary classifier
    scope/          NL → structured filters (+ optional LLM refinement)
    export/         PDF writer, CSV and JSON exports
    assembly/       slot graph and placement geometry
  server/         Prisma-backed data layer and server actions
  app/            Next.js App Router pages and REST API routes
  components/     UI, studio panels, admin forms
```

The engines are pure functions over plain objects, so the Build Studio runs
them **client-side** for instant recomputation on every swap while the server
stays authoritative on save — and the same code is unit-tested without a
database.

### Units

The database stores canonical integer-friendly units: millimetres, grams and
minor currency units. `src/lib/units.ts` owns every conversion and the single
phrase used for an absent value: *"Not provided by manufacturer."*

## Data ingestion

`/admin/imports` implements the workflow: import → normalise → detect
duplicates → validate units → record the source → assign a verification level →
flag missing specifications → human approval. Approving a record creates a
**draft** product; publishing is a separate, deliberate step, and a record
cannot be published without a source URL.

## Configuration

All optional integrations degrade to an explicit, visible "not configured"
state rather than failing or silently pretending to work:

| Variable | Effect when unset |
| --- | --- |
| `ANTHROPIC_API_KEY` | SCOPE uses the deterministic intent parser only |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*` | Plans display; checkout is disabled |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Notifications are in-app only; emails are logged as queued |
| `JOBS_TOKEN` | The price-check job is admin-only |
| `TEST_DATABASE_URL` | Integration tests are skipped |

`AUTH_SECRET` (32+ characters) and `DATABASE_URL` are required.

## Deployment

Designed for Vercel plus a managed Postgres (Neon or Supabase):

1. Set the environment variables above on the deployment.
2. Run `npm run db:deploy` during the release step.
3. Point a scheduler at `POST /api/jobs/price-check` with the `x-job-token`
   header to run watchlist price monitoring.
4. Configure the Stripe webhook to `POST /api/billing/webhook`.

## Testing

- **Unit** — units and parsing, compatibility engine, clearance engine, cost,
  weight, scoring, data quality, policy, intent parsing, exports, rate limiting,
  passwords and session tokens.
- **Component** — React Testing Library over the catalog card and the
  configuration inspector.
- **Integration** — a real Postgres run through create build → add component →
  validate → cost → weight → save → export, plus quota and authorization checks.
- **End-to-end** — Playwright across landing, auth, catalog, the Build Studio
  (3D canvas, 2D views, conflicts, SCOPE refusals), API authorization and a
  mobile viewport.
