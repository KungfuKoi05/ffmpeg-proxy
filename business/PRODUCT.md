# Product

**Owner:** Builder | **Last updated:** 2026-08-13
**Validation gate: NOT PASSED. No product code is being written.**

---

## Gate status

Per `DECISION_LOG.md` D-003, product code waits for **≥1 booked conversation per 10 prospects
contacted, or one paid engagement.** Current: 0 prospects contacted.

Until then this document holds specifications only. That restraint is the point — the failure mode
this whole system exists to prevent is building before selling.

## What already exists, at $0

`server.js` in this repo is a working ffmpeg service with `/extract-audio`, `/transcode`,
`/thumbnail`, `/preview-gif`, and `/youtube-optimize`. Fulfillment needs exactly one of these:
**`/extract-audio`** turns a customer's meeting video into audio for transcription.

That is the entire infrastructure requirement for the first ten customers, and it was already built
and paid for. **This is not a coincidence worth over-reading** — it was a genuine tiebreaker in
selection, not the reason for it.

## Day-one delivery stack — all free

| Need | Tool | Cost |
|---|---|---|
| Audio extraction | `server.js` `/extract-audio` | $0 — already built |
| Transcription | Claude Code session | $0 within the founder's existing plan |
| Minutes drafting | Claude Code + template | $0 |
| QA | Human, against the SOP-001 checklist | founder time |
| Delivery | Email attachment | $0 |
| CRM | `data/` JSON + `leads.csv` in git | $0 |
| Invoicing | Stripe payment link | $0 to create, fees only on revenue |
| Landing page | GitHub Pages, free subdomain | $0 |

No database, no hosting bill, no subscription, no domain purchase.

## MVP specification

Full spec: [`product/mvp-spec.md`](product/mvp-spec.md). Summary of what gets built, and only when:

| Component | Build trigger | Why not sooner |
|---|---|---|
| Landing page | A prospect asks for a link twice | Until then the sample document is better proof than a website |
| Intake (form or email) | Customer 1 | Email works fine for one customer |
| `tools/minutes.js` pipeline | Customer 3 | Needs 5+ manual runs first to know what actually breaks |
| Template library | Customer 3 | Requires real templates from real customers |
| Delivery tracker | Customer 5 | JSON is sufficient below that |
| Customer portal | **Deferred indefinitely** | Email is not the bottleneck and probably never will be |

## Deferred — with the reason, so it is not re-proposed

- **Customer portal** — email works; a portal solves a problem nobody has reported
- **Real-time / live-meeting transcription** — a different, harder product with no evidence of demand
- **Integrations with HOA management platforms** — requires partnerships and credentials; revisit above $5K MRR
- **Mobile app** — no
- **Self-serve signup and billing** — this is a consultative sale under 20 customers; automation here removes the conversation that produces the product feedback
- **Multi-user accounts and permissions** — one owner, one inbox, until proven otherwise
- **Automated audio deletion** — done manually and confirmed in writing; a manual promise kept is worth more than a cron job at this scale

## Architecture principles

Static over dynamic. Files over databases. Node stdlib over dependencies — `tools/` has no
`node_modules` and never should. Free tiers with an exit. Boring, obvious code that a non-engineer
could reason about, because this is a business asset first and software second.

## Security

Customer recordings contain confidential association business — delinquencies, legal matters,
personnel. Handling rules:

- Recordings are **never committed to this repository.** `.gitignore` covers `business/customers/private/`
- Audio is deleted once minutes are approved, and deletion is confirmed to the customer in writing
- No API key, token, or password in the repo — `.env` only, and it is gitignored
- No customer data in any dashboard, report, or commit message
- NDA signed before the first recording is accepted
