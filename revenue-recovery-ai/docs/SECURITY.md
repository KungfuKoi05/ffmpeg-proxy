# Security

## Tenant isolation

This is the property most worth protecting: one HVAC company must never see
another's leads.

Three independent layers:

1. **Row Level Security** (`supabase/migrations/0002_rls.sql`). Every
   tenant table has policies keyed on `business_members`. Even a SQL injection
   or a wrong `.eq()` in application code returns zero rows rather than another
   tenant's.
2. **Server-side tenant resolution.** `requireBusiness()` derives the business
   from the session cookie. A `business_id` in a request body is never trusted;
   when one is supplied in a URL, membership is verified before use.
3. **Webhook tenant mapping.** Twilio webhooks resolve the tenant by looking up
   the *called* number in `phone_numbers`, which has a unique constraint on
   `phone_number`. Nothing in the request payload chooses the tenant.

The RLS helper functions are `SECURITY DEFINER` so a policy on
`business_members` can read `business_members` without infinite recursion.

## Roles

`owner` > `admin` > `staff`, plus a platform-level `super_admin` flag on
`users`. Configuration changes (services, FAQs, phone numbers, billing,
settings) require `admin`. Lead work is open to any member. `assertRole()`
enforces this server-side; the UI hiding a control is a convenience, not a
control.

## What the service role can do, and where it is allowed

`supabaseAdmin()` bypasses RLS. It is used only where there is no user session
to scope by — Twilio and Stripe webhooks, cron jobs, usage metering, audit
writes, and the seed script. Each of those resolves its tenant explicitly before
touching data.

`ai_actions`, `usage_events`, `audit_logs` and `subscriptions` are **read-only to
tenants**: only the service role writes them, so a compromised browser session
cannot forge an audit trail or grant itself a paid plan.

## Webhook verification

- **Twilio**: `twilio.validateRequest` over the reconstructed public URL and the
  sorted POST body. Missing or mismatched signature throws before any work
  happens. Covered by five tests including tampered params and a swapped host.
- **Stripe**: `stripe.webhooks.constructEvent` on the **raw** body. Parsing the
  body first would break verification, so the handler reads `req.text()`.

Client-supplied subscription state is never trusted; the webhook is the only
writer of `subscriptions`.

## Input validation

Every route body is parsed with Zod before use. The settings endpoint accepts an
explicit allow-list of fields, so a crafted request cannot flip
`onboarding_completed` or reassign `owner_id`.

## Error handling

`toPublicError()` returns a fixed message per error code. Internal detail —
business IDs, upstream messages, stack traces — is logged server-side and never
serialised to the client. Tested.

## Secrets

No secret is read at module scope; `lib/env.ts` reads lazily so a missing
variable fails the specific feature rather than the build. `.env` is
gitignored. `/admin` reports whether an integration is *configured*, never a
value. `/api/health` does the same.

## Rate limiting

`lib/security/rate-limit.ts` is an in-memory fixed-window limiter. **Known
limitation:** it is per serverless instance, so effective capacity scales with
instance count. It stops accidental floods and casual abuse, not a distributed
attack. Move it to a shared store (Upstash Redis has a free tier) before relying
on it for the latter.

## AI-specific risks

- The receptionist may only assert facts from the tenant's own knowledge base.
  Pricing, availability and policy invention are each forbidden explicitly.
- It cannot claim a booking succeeded unless `create_appointment` returned
  SUCCESS — tool results are fed back verbatim, including failures.
- Prompt-injection surface is small: caller text never becomes system
  instructions, and tools take structured arguments validated with Zod.
- Sentinel re-reads transcripts and flags hallucinations, biased toward
  escalation.
- `AI_PROVIDER=mock` is refused in production so a misconfigured deploy cannot
  answer real calls with canned text.

## Not done yet

- No MFA (Supabase supports it; not wired up).
- No CAPTCHA on signup.
- Rate limiting is not distributed (above).
- Call recordings are not encrypted at rest beyond Twilio's own storage, and
  recording is off by default.
- No automated PII redaction in transcripts.
