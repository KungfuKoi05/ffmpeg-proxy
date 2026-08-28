# Architecture

## Shape

One Next.js app. No microservices — the whole system is server routes plus a
Postgres database, which is the right size for this problem and keeps the
infrastructure bill near zero.

```
Caller ──► Twilio ──► /api/twilio/voice/incoming
                          │  verify signature
                          │  resolve tenant by called number
                          ▼
                   receptionist engine ──► Anthropic (tools)
                          │                     │
                          │  ◄──────────────────┘
                          ▼  execute tools
                   Supabase (leads, appointments, messages,
                             revenue_events, ai_actions)
                          │
                          ▼
                   TwiML reply ──► Twilio ──► Caller
```

## Directory map

```
app/                     routes and pages
  api/twilio/            voice + SMS webhooks (signature-verified)
  api/stripe/            checkout, webhook, portal
  api/{leads,settings,onboarding,prospects}/
agents/                  atlas, mercury, forge, nova, sentinel + shared runner
lib/
  ai/                    provider abstraction, anthropic + mock adapters
  receptionist/          prompt, tools, engine
  twilio/                client, signature verification, SMS, TwiML
  stripe/                client and status mapping
  supabase/              browser, server (RLS), admin (service role) clients
  config/                plans, models, feature flags
  auth/                  session and tenant guards
  security/              rate limiting
supabase/migrations/     schema then RLS
tests/                   vitest
```

## Key decisions

**Model selection is indirect.** Call sites ask for a tier (`primary` / `fast`),
which resolves through `AI_MODEL` / `AI_MODEL_FAST`. No model name appears
outside `lib/config/models.ts`, so changing the cost/quality tradeoff is an env
change, not a deploy.

**Thinking stays on.** With thinking disabled, Opus 5 can emit a tool call as
visible text instead of a `tool_use` block — which would silently break booking.
Cost is controlled with `effort` (low for the fast tier) instead.

**Tool results are fed back verbatim, including failures.** A `create_appointment`
that hits a conflict returns `FAILED: that slot was just taken`, and the prompt
forbids claiming success the model did not observe. This is how "no fake
success" (spec §46) is actually enforced rather than merely promised.

**Conflicts are re-checked at write time.** The slot list the model was shown
may be stale by the time it books.

**Estimated revenue is never presented as earned.** `estimated_value` is derived
from configured average job values; `actual_value` is only ever written by a
human through the lead detail page. The UI labels both everywhere they appear.

**Agents share one runner** (`agents/base.ts`) that validates input, forces a
schema-checked tool response, meters usage, and writes an `ai_actions` row on
success *and* failure. An agent that skipped this would be a label, not an agent.

**Atlas and Forge are read-only by construction** — they receive a pre-computed
snapshot and return analysis. They are given no tools that write.

## Known limitations

- **Appointment timezones.** `generateSlots` derives slot boundaries in UTC from
  the availability window. A business in a non-UTC zone needs
  `booking_availability` expressed accordingly. Proper per-timezone handling
  (DST included) is not implemented.
- **Rate limiting is per-instance**, not distributed. See SECURITY.md.
- **Voice is turn-based**, using Twilio `<Gather>` speech recognition rather
  than a streaming media connection. Latency is a round trip per turn — fine for
  a receptionist, not conversational-realtime.
- **Web chat widget is not built.** The `web` channel exists in the schema and
  the engine accepts it, but no embeddable script is shipped. Spec §12 is the
  one feature area not implemented.
- **No cron jobs wired.** Spec §43's scheduled Atlas/Sentinel/Forge runs have
  runnable entry points (`buildAtlasInput` + `runAtlas`, `reviewConversation`,
  `buildForgeInput` + `runForge`) but no scheduler invoking them. Add Vercel
  Cron pointing at thin routes when you want them.
- **The knowledge base is structured retrieval**, not embeddings — a keyword
  score over the tenant's FAQs. That is the right starting point at this scale;
  add RAG only if testing shows it is needed.
