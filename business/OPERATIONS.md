# Operations

**Owner:** Ops | **Last updated:** 2026-08-13 | **Stage:** pre-delivery

---

## The constraint everything is designed around

The founder has **6–10 hours per week**. At $10,000/month across 8 customers and ~130 meetings, that
is roughly **20 minutes per meeting for everything** — delivery, QA, support, and admin combined.

Every process here is measured against that number. A process that cannot fit is not a process that
needs more discipline; it is the wrong process.

## SOPs

| ID | Process | Time budget | Measured |
|---|---|---|---|
| [SOP-001](sops/SOP-001-minutes-delivery.md) | Minutes delivery | 90 → 45 → 20 min | not yet measured |
| [SOP-002](sops/SOP-002-onboarding.md) | Customer onboarding | 30 min one-time | not yet measured |

## The automation ladder

**Manual → semi-automated → automated.** No rung is skipped.

| Customers | Stage | What is automated | Founder time/meeting |
|---|---|---|---|
| 1–2 | Manual | Nothing. Every step done by hand and timed | 90 min |
| 3–5 | Scripted | Transcription and template assembly | 45 min |
| 6+ | Tuned | Motion and vote extraction; QA against a checklist | 20 min |
| 8+ | Delegated | Contractor does QA; founder audits a sample | 0–5 min |

The first ten deliveries are deliberately manual. That is not inefficiency — it is where the product
design comes from. Automating a process nobody has performed produces a fast implementation of the
wrong thing.

## Quality control

Every deliverable passes the checklist in SOP-001 before it leaves, and **a human reads every
document start to finish.** That rule survives all automation.

One wrong vote count in a statutory record costs more trust than fifty on-time deliveries earn.
Minutes are the association's legal record of what was decided — a fabricated or misheard motion is
the single worst failure this business can produce.

Defects reaching a customer are logged in `operations/defects.md` with root cause and the checklist
change that prevents recurrence. Defects are data, not blame.

## Current bottleneck

**No validated demand.** Not a delivery problem — there is nothing to deliver. The gating action is
A-001: the founder sending batch 1.

The bottleneck will move predictably: *no leads → no replies → no conversion → delivery capacity →
churn.* Ops owns naming it, and naming exactly one.

## Margin watch

Gross margin per customer is reported monthly once revenue exists. Below 60%, the response is to
raise the price, narrow the scope, or automate one step — and Ops states which one it recommends.

The number to watch obsessively is **minutes per delivery**. It is the difference between a business
and a job, and it is why step 9 of SOP-001 requires timing every step. An untimed process cannot be
improved.

## The end state

At $10,000/month the founder should spend **under 5 hours a week**: reviewing a QA sample, handling
escalations, and talking to customers. Everything else is either scripted or delegated.

If founder hours rise as revenue rises, the business is failing at its actual purpose regardless of
what the revenue line says.
