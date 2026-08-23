# Product roadmap

**Owner:** Atlas · Every item answers: *does this increase the probability of
reaching $10k MRR?* If not, it is not on the list.

## Shipped (day 1)

- Lead capture: missed call, web form, SMS reply, manual, with cross-format dedupe
- Rule-based lead classification (URGENT / ESTIMATE / SERVICE_REQUEST / EXISTING_CUSTOMER / GENERAL_QUESTION / OTHER)
- Six editable follow-up sequences with a scheduler
- Four-mode automation ladder with human approval
- Outbox with opt-out, consent, quiet-hours, rate-limit and template guards
- Conservative revenue attribution + client ROI report
- Operator console: dashboard, leads, approvals, messages, ROI, sequences, admin, sales, analytics, logs
- Marketing site with live ROI calculator and demo capture
- Our own sales pipeline with prospect scoring
- 77 tests

## Days 1–7 — sell, don't build

**Goal: 10 conversations, 3 audits booked.**

Only building allowed:
- [ ] Audit output the founder can hand a prospect (populate the Canva spec in `marketing/canva-specs/`)
- [ ] Deploy somewhere with a real domain
- [ ] CSV lead import (needed the moment a real client says yes)

Explicitly **not** now: integrations, AI drafting, mobile app, multi-user.

## Days 8–30 — first client, run it manually

**Goal: 1–2 paying clients, real messages sending.**

- [ ] Onboarding call script → client config in under 30 minutes
- [ ] Twilio wired, 10DLC registered, first client to ASSISTED then LIVE
- [ ] Read every message for two weeks; fix copy from what you learn
- [ ] Estimate import from the client's existing system (probably CSV first)
- [ ] Weekly ROI email to the client (manual send is fine)

Expect to do embarrassing amounts by hand. That is the point — it tells you what
to automate.

## Days 31–60 — make it repeatable

**Goal: 3–4 clients. First real case study.**

- [ ] Automate whatever consumed the most hours in the first month
- [ ] Self-serve client login (already built — start actually using it)
- [ ] Case study from client #1's real, attributed numbers
- [ ] Per-client onboarding under 2 hours
- [ ] Deliverability monitoring (bounce/failure alerting)

## Days 61–90 — automate the delivery

**Goal: 5–7 clients at under 3 hours/client/month.**

- [ ] Scheduled monthly ROI report generation + delivery
- [ ] Two-way sync with one field-service platform (whichever clients actually use)
- [ ] AI message drafting in the client's brand voice (Anthropic; opt-in, still human-approved)
- [ ] Reactivation campaigns for clients who ask
- [ ] Referral ask built into the ROI report

## Days 91–120 — scale what works

**Goal: $10k+ MRR.**

- [ ] Postgres migration if client count is nearing the single-process ceiling
- [ ] Vertical-specific copy packs (roofing vs HVAC vs remodeling)
- [ ] Price increase for new clients, grandfathering the first cohort
- [ ] Second-tier upsell to existing clients
- [ ] Decide: hire delivery help, or cap clients and raise price

## The parking lot

Real ideas, deliberately not scheduled. Each needs a client asking before it moves.

- Voice AI answering — expensive, crowded, and not our wedge
- Native mobile app — a responsive dashboard is enough
- Multi-user client accounts — nobody has asked
- White-label for agencies — a different business
- Auto repair vertical at $400–600/mo — Phase 2, once delivery is <2h/client
- Payments/invoicing — well served already

## The recurring question

Every feature request gets these four:

1. Which specific paying client asked for it?
2. What does it do to MRR or delivery hours?
3. What breaks if we don't build it?
4. What's the smallest version that tests the same thing?

Three vague answers means it goes in the parking lot.
