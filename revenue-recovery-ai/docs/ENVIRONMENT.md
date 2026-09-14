# Environment variables

Read lazily (`lib/env.ts`) so a missing variable fails the feature that needs
it, not the build.

## Required to run

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Subject to RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | webhooks, cron, seed | **Bypasses RLS. Server only.** |
| `NEXT_PUBLIC_APP_URL` | Stripe redirects, Twilio signature | Must match the public URL exactly |

## AI

| Variable | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required unless `AI_PROVIDER=mock` |
| `AI_MODEL` | `claude-opus-5` | Receptionist, Atlas, Mercury, Nova |
| `AI_MODEL_FAST` | falls back to `AI_MODEL` | Sentinel, Forge, extraction |
| `AI_PROVIDER` | `anthropic` | `mock` for offline dev; refused in production |

## Twilio

| Variable | Notes |
|---|---|
| `TWILIO_ACCOUNT_SID` | Console |
| `TWILIO_AUTH_TOKEN` | Also used to verify webhook signatures |
| `TWILIO_PHONE_NUMBER` | Fallback sender when a tenant has no number row |

## Stripe

| Variable | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | Server only |
| `STRIPE_PUBLISHABLE_KEY` | Not currently used — checkout is redirect-based |
| `STRIPE_WEBHOOK_SECRET` | From the webhook endpoint, per environment |
| `STRIPE_STARTER_PRICE_ID` / `STRIPE_GROWTH_PRICE_ID` / `STRIPE_PRO_PRICE_ID` | Price IDs, not product IDs |

## Optional

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | Unused in the MVP; notifications go by SMS |
| `AI_ENABLED`, `VOICE_ENABLED`, `SMS_ENABLED`, `BOOKING_ENABLED`, `OUTBOUND_FOLLOWUP_ENABLED`, `PROSPECTING_ENABLED` | Set to `false` to disable platform-wide. Default on. |
| `SEED_OWNER_EMAIL` | Seed script only |
