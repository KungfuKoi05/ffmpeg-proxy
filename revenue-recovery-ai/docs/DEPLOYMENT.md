# Deployment

## 1. Supabase
1. Create a project. Note the region — put Vercel in the same one.
2. SQL editor: run `supabase/migrations/0001_init.sql`, then `0002_rls.sql`.
3. Confirm every table shows RLS enabled.
4. Authentication → Providers: enable Email. Turn on email confirmation for
   production.
5. Copy URL, anon key and service role key.

## 2. Vercel
1. Import the repo. **Set the root directory to `revenue-recovery-ai`.**
2. Add every variable from `.env.example` to Production and Preview.
3. Deploy. Note the production URL and set `NEXT_PUBLIC_APP_URL` to it, then
   redeploy — Twilio signature verification rebuilds the signed URL from this
   value, so a stale one fails every webhook.

## 3. Stripe
1. Create three products with monthly recurring prices: $499, $799, $1299.
2. Copy the **price** IDs (`price_...`, not `prod_...`) into
   `STRIPE_STARTER_PRICE_ID`, `STRIPE_GROWTH_PRICE_ID`, `STRIPE_PRO_PRICE_ID`.
3. Developers → Webhooks → add endpoint:
   `https://YOUR_DOMAIN/api/stripe/webhook`
   Events: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`.
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`. Test and live mode have
   different secrets.
5. Enable the billing portal in Settings → Billing → Customer portal.

## 4. Twilio
1. Buy a number with Voice and SMS.
2. Configure the number:
   - **Voice** — A call comes in: Webhook, POST →
     `https://YOUR_DOMAIN/api/twilio/voice/incoming`
   - **Call status changes**: POST →
     `https://YOUR_DOMAIN/api/twilio/voice/status`
   - **Messaging** — A message comes in: POST →
     `https://YOUR_DOMAIN/api/twilio/sms/incoming`
   - **Status callback**: POST → `https://YOUR_DOMAIN/api/twilio/sms/status`
3. Add the number in the app's onboarding step 9. It must match exactly,
   E.164 (`+15125550199`) — tenant resolution is an exact string match.
4. For missed-call recovery, point the customer's no-answer / busy handler at
   `/api/twilio/voice/missed`.
5. US A2P 10DLC registration is required before SMS delivers reliably. Start it
   early; it takes days, not minutes.

## 5. Verify
```bash
curl https://YOUR_DOMAIN/api/health
```
Expect `"status":"healthy"` with all four integrations `ok`. Then run the
end-to-end test in CUSTOMER_ONBOARDING.md.

## Checklist
See [PRODUCTION_CHECKLIST.md](../PRODUCTION_CHECKLIST.md).
