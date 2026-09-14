# Production checklist

Work top to bottom. Do not skip the end-to-end section — everything above it is
necessary but not sufficient.

## Environment
- [ ] Every variable in `.env.example` set in Vercel Production
- [ ] `NEXT_PUBLIC_APP_URL` matches the real domain exactly (Twilio signatures depend on it)
- [ ] `AI_PROVIDER` is unset or `anthropic` (mock is refused in production, but check)
- [ ] `AI_MODEL` / `AI_MODEL_FAST` set deliberately — see COST_CONTROL.md
- [ ] No secret committed: `git log -p | grep -iE "sk-ant|sk_live|SG\.|AC[0-9a-f]{32}"` is empty

## Database
- [ ] `0001_init.sql` applied
- [ ] `0002_rls.sql` applied
- [ ] Every table shows **RLS enabled**
- [ ] Service role key is only in server-side env, never `NEXT_PUBLIC_*`
- [ ] Supabase daily backups on (Pro plan) or a documented export routine

## Authentication
- [ ] Email confirmation enabled
- [ ] Password minimum length enforced
- [ ] `/dashboard` redirects to `/login` when signed out
- [ ] A second test account cannot see the first account's leads

## Twilio
- [ ] Number purchased, Voice + SMS enabled
- [ ] Four webhooks configured (voice incoming, voice status, SMS incoming, SMS status)
- [ ] Number added to the tenant in onboarding, E.164, exact match
- [ ] Signature verification confirmed — an unsigned POST returns 403
- [ ] A2P 10DLC registration submitted
- [ ] Balance alert set

## Stripe
- [ ] Three products with monthly prices
- [ ] Price IDs in env (not product IDs)
- [ ] Webhook endpoint added with the five events
- [ ] Live-mode signing secret in production env
- [ ] Billing portal enabled
- [ ] Test checkout completes and writes an `active` subscription row

## AI
- [ ] Anthropic key valid
- [ ] Hard spend cap set in the Anthropic console
- [ ] A test call produces `ai_actions` rows with token counts and costs

## Security
- [ ] `/api/health` returns no secrets
- [ ] An error response contains no stack trace or internal id
- [ ] `/admin` is reachable only with `is_super_admin = true`
- [ ] Rate limiting reviewed — see the per-instance caveat in SECURITY.md

## Billing and limits
- [ ] Plan limits reviewed against expected usage
- [ ] Exceeding a limit shows "Usage limit reached. Upgrade or contact support."
- [ ] `usage_events` rows appear after a call

## Observability
- [ ] `/api/health` returns `healthy`
- [ ] Vercel log drain or alerting configured
- [ ] `/admin` shows businesses, MRR, API cost, recent failures

## End-to-end — the actual gate
- [ ] Real inbound call answered by the assistant
- [ ] Lead created with correct service and urgency
- [ ] Appointment created at an offered time, no double-booking
- [ ] Confirmation SMS received
- [ ] Missed call triggers SMS recovery, and a reply continues the conversation
- [ ] Asking for a price does **not** produce a price, and escalates
- [ ] Owner receives the escalation SMS
- [ ] Everything appears correctly in the dashboard
- [ ] Cancel a subscription and confirm the webhook updates the row

## Demo
- [ ] `/demo` loads with no keys and is labelled as simulated data
