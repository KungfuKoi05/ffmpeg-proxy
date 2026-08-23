# Environment audit

**Date:** 2026-08-23 · **Owner:** Forge

## Machine

| | |
|---|---|
| OS | Ubuntu 24.04.4 LTS (x86_64, kernel 6.18) |
| Node | v22.22.2 |
| npm | 10.9.7 |
| Python | 3.11.15 |
| Go | 1.24.7 |
| Git | 2.43.0 |
| Disk | 30 GB available |
| Memory | 15 GB |

## Decisive finding

**`node:sqlite` works unflagged on Node 22.22.** That makes a genuinely
zero-dependency stack viable: Node's built-in `http`, `sqlite`, `crypto` and
`test` modules cover everything this product needs at its current scale.

Consequences:
- `npm install` installs nothing. There is no `node_modules`.
- No supply-chain surface, no lockfile drift, no build step.
- Deploys anywhere Node 22 runs, including a $5 VPS or a free container tier.
- Runs entirely offline for development.

`node:sqlite` prints an `ExperimentalWarning` on startup. It is stable enough
for this workload (single process, single-digit clients). The `src/db/index.js`
module is the only place that touches it, so moving to Postgres later is one
file, not a rewrite.

## Network

| | |
|---|---|
| Outbound HTTPS | Available via agent proxy |
| npm registry | Reachable (not needed at runtime) |
| GitHub | Reachable via git proxy |

## Credentials present

| Credential | Status |
|---|---|
| `GITHUB_TOKEN` | set (used for repo access) |
| `ANTHROPIC_API_KEY` | **not set** |
| `OPENAI_API_KEY` | **not set** |
| Supabase | **not set** |
| Twilio | **not set** |
| Vercel | **not set** |
| Email/SMTP | **not set** |

**No secrets are printed anywhere in this repo or in logs.** Presence is checked
by name only.

## What this means for the build

Because no paid credential exists, every paid capability ships behind a mock
implementation that is the default. Nothing in this codebase can spend money
until an operator both supplies a credential *and* moves the automation mode to
`LIVE`. See `security.md`.

## MCP integrations available in the build environment

Canva, Supabase, Vercel, Slack, Gmail, Google Drive/Calendar, GitHub, Make,
Zapier, PostHog, Shopify, Metricool.

**None are runtime dependencies.** They are useful to the founder for operating
the business (Canva for assets, Vercel/Supabase if hosting is ever needed) but
Closeloop itself talks to none of them. That is intentional: a productized
service with five clients should not have twelve integration points.

## Cost position

| Item | Cost |
|---|---|
| Runtime dependencies | $0 |
| Database | $0 (SQLite file) |
| Hosting (local / self-hosted) | $0 |
| Hosting (small VPS, when needed) | ~$5/mo |
| AI classification | $0 (rule-based default) |
| SMS | $0 until `LIVE` + Twilio credentials |

**Total to run today: $0.** Against the ~$100 starting capital, the first real
spend will be a domain (~$12/yr) and a Twilio number (~$1.15/mo) at first live
client — not before.
