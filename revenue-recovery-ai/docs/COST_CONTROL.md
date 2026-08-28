# Cost control

Target: **under $100 to start**. Everything below is free tier or usage-based,
and nothing is prepaid.

## Services

| Service | Purpose | Free tier | Cost model |
|---|---|---|---|
| Supabase | Postgres, auth, RLS | 500MB DB, 50k MAU | $0 until you exceed free tier, then $25/mo Pro |
| Vercel | Hosting, serverless functions | Hobby: 100GB bandwidth | $0 for hobby; $20/user/mo Pro when you need a team |
| Anthropic API | Receptionist + agents | none | Per token — see below |
| Twilio | Voice + SMS | none | ~$1.15/mo per number; usage per minute/segment |
| Stripe | Billing | none | 2.9% + $0.30 per transaction |
| GitHub | Source | free | $0 |

**Startup cost: one Twilio number (~$1.15) plus whatever you spend testing.**
The $100 ceiling is not close to being tested by this stack.

## Anthropic pricing

Per million tokens, as configured in `lib/config/models.ts`:

| Model | Input | Output |
|---|---|---|
| claude-opus-5 (default) | $5.00 | $25.00 |
| claude-sonnet-5 | $2.00 | $10.00 |
| claude-haiku-4-5 | $1.00 | $5.00 |

### The cost lever you actually have

Every AI call resolves its model from an environment variable — no model name is
hard-coded anywhere in the app. Two tiers:

- `AI_MODEL` — receptionist turns, Atlas, Mercury, Nova. Reasoning quality here
  is what customers hear and what the sales copy sounds like.
- `AI_MODEL_FAST` — Sentinel classification, Forge diagnostics, field
  extraction. Short prompts, short outputs, structured answers.

Both default to `claude-opus-5`. **Setting `AI_MODEL_FAST=claude-haiku-4-5` cuts
the cost of the classification path by roughly 5x** and is the first change to
make if spend matters more than review depth on those paths. That is a
deliberate quality tradeoff, so it is left to you rather than made by default.

### Per-conversation estimate

A receptionist turn sends the system prompt (knowledge base included, roughly
1,200–2,000 tokens), conversation history, and tool definitions, and gets back a
short reply. A 6-turn call is roughly 25k input / 2k output tokens including the
tool round-trips.

At Opus 5 rates: about **$0.17 per handled call**. On Haiku for the fast tier
plus Opus for the conversation, closer to $0.15. Sentinel review adds ~$0.02.

## Projected monthly cost

Assuming 120 handled conversations per customer per month, 3 SMS segments and
4 voice minutes per conversation:

| Customers | Anthropic | Twilio | Supabase | Vercel | Total |
|---|---|---|---|---|---|
| 1 | ~$21 | ~$8 | $0 | $0 | **~$29** |
| 10 | ~$210 | ~$75 | $0 | $0 | **~$285** |
| 25 | ~$525 | ~$185 | $25 | $20 | **~$755** |
| 50 | ~$1,050 | ~$370 | $25 | $20 | **~$1,465** |

At the $499 Starter price, gross margin is roughly 90% at one customer and holds
above 85% at 50. The dominant variable cost is Anthropic tokens, which is why
the tier split exists.

These are estimates from list prices, not measured bills. Watch the real numbers
in `/admin` (API cost, 7 days) and in `usage_events`.

## Guardrails already in the code

- **Per-plan limits** (`lib/config/plans.ts`) on AI conversations, SMS segments
  and voice minutes. `assertWithinLimits()` runs *before* the expensive call and
  raises `USAGE_LIMIT_REACHED`, which surfaces as "Usage limit reached. Upgrade
  or contact support."
- **Every billable action writes a `usage_events` row** with an estimated cost,
  so spend is attributable per tenant.
- **The receptionist tool loop is capped** at 5 iterations, so a confused model
  cannot spin.
- **`max_tokens` is capped at 1024** for receptionist turns — replies are meant
  to be one or two sentences.
- **Forge flags anomalies**: >500 SMS segments or >$25 AI spend in 24h for one
  tenant.

## Recommendations

1. Set a hard spend cap in the Anthropic console before going live.
2. Set Twilio balance alerts.
3. Keep `AI_MODEL_FAST` on a cheap model once you have confirmed Sentinel still
   catches what it should on your traffic.
4. Prompt caching is the next lever if volume grows — the system prompt is
   stable per tenant and is the largest part of every request.
