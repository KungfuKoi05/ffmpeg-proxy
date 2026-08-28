# Revenue Recovery AI

Multi-tenant SaaS that answers missed calls for HVAC companies, qualifies the
caller, books the job, and shows the owner what it recovered.

**Status: builds, typechecks, lints clean, 62 tests pass. Not yet run against
live Twilio, Stripe, Supabase or Anthropic credentials** — see
[Remaining blockers](#remaining-blockers).

## What it does

A caller rings the business. Twilio posts to `/api/twilio/voice/incoming`. The
receptionist greets them, captures name, phone, service and urgency, answers
questions from the business's own knowledge base, offers real conflict-checked
appointment slots, books one, texts a confirmation, and escalates to a human
whenever it is unsure. If the call is missed instead, `/api/twilio/voice/missed`
opens an SMS conversation and the same assistant continues by text.

Everything lands in a dashboard with leads, conversations, calls, appointments,
revenue and AI activity.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth +
RLS) · Anthropic API · Twilio Voice/SMS · Stripe Billing · Vitest

## Quick start

```bash
cd revenue-recovery-ai
npm install
cp .env.example .env.local     # fill in Supabase at minimum
npm run dev
```

Without credentials you can still run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`AI_PROVIDER=mock` runs the assistant against a deterministic local adapter.
`/demo` works with no keys and no database at all.

Full setup: [docs/SETUP.md](docs/SETUP.md).

## Documentation

| Doc | Covers |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit, and the known limitations |
| [SETUP.md](docs/SETUP.md) | Local development from zero |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Supabase, Vercel, Stripe and Twilio wiring |
| [ENVIRONMENT.md](docs/ENVIRONMENT.md) | Every environment variable |
| [COST_CONTROL.md](docs/COST_CONTROL.md) | Real cost projections and the levers |
| [API.md](docs/API.md) | Every route |
| [SECURITY.md](docs/SECURITY.md) | Tenant isolation, webhooks, what is not done |
| [AGENTS.md](docs/AGENTS.md) | The five agents |
| [TESTING.md](docs/TESTING.md) | What is covered and what is not |
| [CUSTOMER_ONBOARDING.md](docs/CUSTOMER_ONBOARDING.md) | Taking a customer live |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | Pre-launch gate |

Sales material lives in [`sales/`](sales/).

## Remaining blockers

The code is complete and verified as far as it can be without credentials. To
take a first paying customer you must:

1. Create a Supabase project and run both migrations.
2. Add an Anthropic API key.
3. Buy a Twilio number and point its webhooks at your deployment.
4. Create three Stripe products and add the price IDs.
5. Run the end-to-end test in
   [CUSTOMER_ONBOARDING.md](docs/CUSTOMER_ONBOARDING.md) — place a real call and
   confirm a lead, an appointment and an SMS all appear.

Nothing in this repo has spoken to a real phone call yet. Treat step 5 as the
gate on calling it production-ready.
