# Architecture

## Shape

One Node.js process. One SQLite file. No build step, no runtime dependencies.

```
                    ┌──────────────────────────────────────┐
  missed call ──┐   │  src/server.js                       │
  web form   ───┼──▶│    routes/webhooks.js  (public)      │
  SMS reply  ───┘   │    routes/public.js    (ROI calc)    │
                    │    routes/api.js       (session)     │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │  domain/                             │
                    │    leads  clients  pipeline          │
                    │    sequences  classify  roi          │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────┐
                    │  engine/                             │
                    │    scheduler.js  — ticks every 60s   │
                    │    outbox.js     — THE ONLY WAY OUT  │
                    └───────────────┬──────────────────────┘
                                    │  (gated by automation mode)
                    ┌───────────────▼──────────────────────┐
                    │  providers/  sms · email · ai        │
                    │  mock (default, free) │ twilio/smtp/ │
                    │                       │ anthropic    │
                    └──────────────────────────────────────┘
```

## The one rule that shapes everything

**No message reaches a human except through `engine/outbox.js`.**

Every guard — opt-out, consent, quiet hours, rate limits, unrendered templates,
missing addresses, automation mode — lives in that one file. New callers cannot
forget a check, because there is no other path. `providers/index.js` then
enforces the spend gate a second time as defence in depth.

## Automation modes

A ladder, not a switch. The **global** mode (`AUTOMATION_MODE`) is a ceiling; a
client's own mode can be stricter but never looser. Effective mode is the
minimum of the two.

| Mode | Renders | Stores | Human approval | Transmits |
|---|---|---|---|---|
| `OFF` | no | suppressed | — | no |
| `TEST` *(default)* | yes | yes, as `simulated` | — | **no** |
| `ASSISTED` | yes | yes, as `pending_approval` | **required** | only after approval |
| `LIVE` | yes | yes | — | yes |

Every client starts in `TEST`. Reaching `LIVE` is a deliberate act with a
confirmation dialog.

## Data model

| Table | Purpose |
|---|---|
| `clients` | tenant boundary; economics; automation mode; quiet hours |
| `client_config` | onboarding answers, brand voice, FAQs (JSON tail) |
| `leads` | the person + their opportunity; consent and opt-out state |
| `estimates` | the wedge: quoted work, open/won/lost |
| `appointments`, `jobs` | scheduled visits, won work |
| `sequences` / `sequence_steps` | editable per-client cadences |
| `enrollments` | a lead's progress through one sequence |
| `messages` | the outbox; every inbound and outbound, including blocked ones |
| `events` | append-only audit trail |
| `system_log` | engine and provider failures |
| `prospects` / `prospect_events` | **our** sales pipeline |

All timestamps are ISO-8601 UTC **strings**. `node:sqlite` returns large
integers as `BigInt`, which breaks `JSON.stringify`; text timestamps sort
correctly in SQLite and serialise cleanly.

## Scheduler

Wakes every 60 seconds. Follow-ups are scheduled in hours and days, so a
one-minute resolution is ample.

Each tick:
1. Find enrollments where `next_run_at <= now` and `status = 'active'`.
2. Render the step's template against live lead/client/estimate data.
3. Hand it to the outbox.
4. Advance to the next step **regardless of the send outcome** — a suppressed
   SMS must not wedge a sequence whose next step is an email that would succeed.
5. Release messages that quiet hours parked earlier.

Re-entrant-safe via a module-level `running` flag. `tick()` is exported so tests
drive it directly instead of waiting on wall-clock time.

## Attribution

Deliberately conservative, and the same rule the client sees in their report. A
job counts as recovered only when all three hold:

1. We delivered an outbound message to that lead, **and**
2. the lead sent an inbound message **after** it, **and**
3. the job was won **at or after** that reply.

Anything else is stored with an explicit reason and reported as *not* attributed.
Both numbers appear side by side in the ROI report. See `docs/business-model.md`
for why under-claiming is the commercially correct choice.

## Why no framework

Express, Prisma and a React build step would add ~300 transitive dependencies to
an app with roughly 40 routes and 12 tables. The router in `lib/http.js` is 60
lines. The trade — a little more code we own, versus a dependency tree we don't
— is clearly right at this scale. Revisit if the routing surface triples.

## Where this breaks

Known ceilings, and what to do at each:

| Limit | Roughly | Fix |
|---|---|---|
| Single process | ~50 clients | move SQLite → Postgres (`src/db/index.js` only) |
| SQLite writes | ~1k writes/sec | same |
| In-process scheduler | one instance only | extract to a worker with a leader lock |
| Sessions reset on restart | always | set `SESSION_SECRET` |

None of these bind before ~$25k MRR. Solving them now would be premature.
