# API reference

All routes run on the Node runtime. Customer-facing routes require a session and
resolve the tenant server-side; webhooks verify signatures.

## Webhooks (no session, signature required)

| Route | Method | Purpose |
|---|---|---|
| `/api/twilio/voice/incoming` | POST | Answers the call; also handles each `<Gather>` turn |
| `/api/twilio/voice/status` | POST | Duration, outcome, voice-minute metering |
| `/api/twilio/voice/missed` | POST | Missed-call recovery: creates the lead, opens SMS |
| `/api/twilio/sms/incoming` | POST | Continues the conversation by text |
| `/api/twilio/sms/status` | POST | Delivery receipts; logs failures |
| `/api/stripe/webhook` | POST | The only writer of `subscriptions` |

Twilio routes return TwiML on success. A signature failure returns `403` JSON,
never TwiML.

Stripe events handled: `checkout.session.completed`,
`customer.subscription.created|updated|deleted`, `invoice.payment_failed`.
A handler error returns `500` so Stripe retries.

## Authenticated

| Route | Method | Role | Purpose |
|---|---|---|---|
| `/api/leads/[id]` | PATCH | member | Status, human-entered actual revenue, notes |
| `/api/settings` | PATCH | admin | Per-business kill switches, emergency config |
| `/api/onboarding` | POST | user | Creates or updates the business, services, FAQs, number |
| `/api/prospects/import` | POST | admin | CSV import, deduplicate, score |
| `/api/stripe/create-checkout` | POST | admin | Checkout session |
| `/api/stripe/portal` | POST | admin | Billing portal |
| `/api/auth/signout` | GET | user | Clears the session |

## Public

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | `{status, database, ai, twilio, stripe}`. Never returns secrets. `503` when the database is unreachable. |

## Errors

```json
{ "error": { "code": "TENANT_MISMATCH", "message": "You do not have access to this resource." } }
```

Codes: `UNAUTHENTICATED` 401 · `FORBIDDEN`/`TENANT_MISMATCH`/`WEBHOOK_SIGNATURE_INVALID` 403 ·
`NOT_FOUND` 404 · `USAGE_LIMIT_REACHED` 402 · `FEATURE_DISABLED`/`APPOINTMENT_CONFLICT` 409 ·
`VALIDATION_FAILED` 422 · `RATE_LIMITED` 429 · `INTERNAL`/`CONFIG_MISSING` 500 ·
`UPSTREAM_FAILURE`/`AI_FAILURE` 502 · `UPSTREAM_TIMEOUT` 504.

Messages are fixed per code. Internal detail is logged, never returned.
