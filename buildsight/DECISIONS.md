# Engineering decisions

Where the brief allowed several reasonable implementations, the simplest
production-ready option was chosen. Each entry records what was picked and why.

## Placement in the repository

BuildSight lives in `buildsight/` rather than at the repository root, which
already holds an unrelated ffmpeg proxy service (`server.js`, its own
`package.json`). Keeping the app in its own directory leaves that service
untouched and gives BuildSight an independent dependency tree and build.

## Framework and data layer

- **Next.js 15 App Router + React 19 + TypeScript.** One deployable unit for
  pages and the REST API, with server components for data-heavy views.
- **Prisma + PostgreSQL.** Explicit migrations, generated types and a schema
  that reads as documentation. Pinned to Prisma 6 (stable) rather than the 8
  release candidate npm resolves by default.
- **Tailwind CSS v4** with hand-written primitives in `src/components/ui`
  instead of pulling in a component library. The product needs about a dozen
  primitives, all dark-first; a dependency would have cost more than it saved.

## Canonical units

Millimetres, grams and minor currency units are stored as integers or fixed
decimals, and every conversion goes through `src/lib/units.ts`. Storing display
units would have made arithmetic lossy and locked the UI into one measurement
system.

## Engines are pure

`compatibility`, `dimensions`, `build/*` and `quality` import nothing from
Prisma or React. Consequences:

- they are unit-tested without a database;
- the Build Studio recomputes locally on every component swap, so the panels
  update instantly and the network round trip only persists;
- the API and the client cannot disagree, because they run the same code.

## Compatibility is data, not inference

Results come only from `CompatibilityRule` rows. No rule means `UNKNOWN`, and
`UNKNOWN` outranks `COMPATIBLE` in the severity ordering so it can never be
masked by neighbouring green results. Rules carry their own verification level;
a finding is reported at the weakest level among the rule and the two products
it compared.

`parameters.skipIfCategoryPresent` was added so a fallback rule can stand down
when a more specific component is present — an optic clamping straight to a
rail unless a mount is installed, or a direct-thread suppressor rule that does
not apply once a muzzle device occupies the threads.

## Authentication

Stateless signed JWTs (`jose`) in an httpOnly, SameSite=Lax cookie, with
bcrypt password hashing. Chosen over an external auth service so the app runs
from a clean checkout with no third-party keys, and over a session table
because it needs no extra query per request. The cookie's `Secure` flag is
decided from the request scheme rather than `NODE_ENV`, so a production build
served over loopback http still authenticates.

Trade-off: revocation waits for the 7-day expiry. A `tokenVersion` column on
`User` is the natural upgrade if immediate revocation becomes a requirement.

## The LLM never decides compatibility

SCOPE parses requests with a deterministic parser first
(`src/lib/scope/intent.ts`). When `ANTHROPIC_API_KEY` is set, the model may only
*refine the same structured filter object*, and its output is validated against
a schema and the controlled vocabulary before use. Any failure falls back to
the deterministic result. Compatibility for every candidate comes from the rules
engine run against the open configuration.

## Policy layer is deterministic

Restricted-topic classification is keyword and pattern matching, not a model
call, so the product boundary cannot drift with a prompt and is unit-testable.
Restricted matches beat allowed hints: a request mixing a catalog topic with a
restricted one is refused.

## Visual approximation, not CAD

Without a manufacturer CAD asset the viewer draws primitives sized from
published dimensions, labelled VISUAL APPROXIMATION, with a dashed outline when
the primary dimension was substituted. The app deliberately produces no
machining or CAD output.

## PDF export without a rendering dependency

`src/lib/export/pdf.ts` is a small PDF 1.4 writer using the standard Helvetica
faces. A build sheet is text and rules; pulling in a headless browser or a full
PDF toolkit to draw it would have added tens of megabytes to the deployment.
The generated xref table is verified byte-for-byte in the test suite.

## Search

PostgreSQL full-text search over a denormalised `searchText` column with a GIN
index, plus a substring fallback for partial part numbers. The haystack emits
lengths in both systems so `11.5 barrel` and `15 inch handguard` both hit. The
search layer is isolated in `src/server/products.ts` so Algolia, Typesense or
Meilisearch can replace it without touching call sites.

## Rate limiting

A fixed-window in-process limiter. It protects a single instance with no extra
infrastructure; the interface is narrow enough that a Redis store can replace
the map without touching the call sites.

## Optional integrations degrade visibly

Stripe, the LLM, email delivery and the scheduled job token are all optional.
With no key configured, the UI says so plainly instead of failing or silently
appearing to work.

## Images

The catalog ships no product photography. Product pages draw a schematic
outline generated from the record's own dimensions — honest about what is
known, where a stock image would imply a likeness the data does not support.

## Demo data

Four synthetic manufacturers and 36 products, labelled DEMO throughout and
flagged with `isDemo`. The set is deliberately shaped to exercise every path:
manufacturer-verified and user-submitted records, missing measurements, an
interface mismatch, a dimensional conflict, a conditional rule, an explicit
product pair and an unknown clearance.
