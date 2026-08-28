# Testing

```bash
npm test          # 62 tests
npm run typecheck
npm run lint
npm run build
```

## What is covered (62 tests, 5 files)

**`revenue.test.ts` (9)** — job-value matching (exact, partial, HVAC defaults,
unknown returns 0), estimated vs actual revenue kept separate, spam excluded
from conversion, no divide-by-zero, ROI clamping.

**`appointments.test.ts` (10)** — half-open overlap so back-to-back slots do not
collide, partial overlap detected, cancelled and no-show free their slot,
blackouts, slots only on configured days, never a slot that conflicts, never one
that runs past closing, limits respected.

**`prospects.test.ts` (11)** — CSV quoting, embedded commas, escaped quotes,
empty input; rejection reasons with row numbers, deduplication, phone
normalisation; scoring determinism, ordering, 0–100 clamp, and that every point
awarded carries a reason.

**`security.test.ts` (13)** — errors never leak internals (including an unknown
throw), timeouts, retry with and without a retry predicate, rate-limit
enforcement and key scoping, and five Twilio signature cases: valid, missing,
forged, tampered params, swapped host.

**`ai.test.ts` (19)** — the receptionist prompt forbids invented pricing,
availability and policy; forbids claiming an unbooked appointment; forbids
unsafe technical guidance; requires emergency deflection; refuses to reveal
itself. The full tool surface exists with schemas. The mock provider is
deterministic, creates leads on a described fault, never quotes a price, and
routes pricing questions to a human. Mock is refused in production. Cost
accounting matches published rates and tiers resolve from env.

## What is NOT covered

Honest gaps, in rough order of risk:

- **No live integration tests.** Nothing here has called the real Anthropic,
  Twilio, Stripe or Supabase APIs. Every external call is either mocked or
  untested.
- **No RLS tests.** Tenant isolation is enforced by policies in
  `0002_rls.sql` and reviewed by reading, but not proven by a test that signs in
  as two tenants and tries to cross the boundary. **This is the most important
  missing test.** It needs a live Supabase project; write it before your second
  customer.
- **No end-to-end browser tests.** No Playwright, no signup-to-dashboard flow.
- **Stripe webhook handling is untested** — construct-event with a fixture and
  assert the subscription row would be a good next test.
- **The receptionist engine's tool loop is untested end to end.** The pieces
  (prompt, tools, mock) are covered; the loop that joins them needs a mocked
  Supabase to test properly.
- **No load testing.**

## Adding the RLS test

Roughly: create two businesses with two users, sign in as user A, attempt to
select user B's leads by id, and assert zero rows. Run it against a real
Supabase project (a free one is fine) rather than mocking, since the whole point
is to exercise the policies.
