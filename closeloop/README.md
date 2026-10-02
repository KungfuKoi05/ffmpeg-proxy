# Closeloop

Follow-up and revenue recovery for high-ticket residential trades — roofing,
HVAC replacement, remodeling.

It captures leads (missed calls, web forms, SMS), classifies them, works them
through editable follow-up sequences, and produces a client ROI report that only
claims revenue it can trace back to a message it actually sent.

**Zero runtime dependencies.** Node 22 built-ins only — `node:http`,
`node:sqlite`, `node:crypto`, `node:test`. No `npm install`, no build step, no
`node_modules`.

---

## Run it

```bash
node --version    # needs >= 22.5
npm run seed      # demo client with 34 leads, 7 estimates, 3 won jobs
npm start         # http://localhost:3000
npm test          # 77 tests
```

| URL | |
|---|---|
| `/` | marketing site + live ROI calculator |
| `/dashboard` | operator console |
| `/health` | health check |

Login: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults `owner@example.com` /
`change-me-now`). Seed also creates `demo-client@example.test` /
`demo-client-pw` for the client-side view.

**It ships in `TEST` mode: messages are written and stored, but nothing is
transmitted and nothing can cost money.**

---

## Automation modes

The global `AUTOMATION_MODE` is a ceiling; each client's mode can be stricter,
never looser.

| Mode | Renders | Human approval | Transmits |
|---|---|---|---|
| `OFF` | no | — | no |
| **`TEST`** *(default)* | yes | — | **no** |
| `ASSISTED` | yes | **required** | after approval only |
| `LIVE` | yes | — | yes |

A paid provider (Twilio, SMTP, Anthropic) is swapped for its mock unless the
effective mode is `LIVE`. There is no code path around it.

---

## Layout

```
src/
  server.js          HTTP server, security headers, auth-before-routing
  config.js          env loading, mode ceiling logic
  db/                schema.sql, connection, seed
  lib/               http router, auth (scrypt + signed cookies), ids, logger
  domain/            clients leads pipeline sequences classify roi prospects
  engine/
    outbox.js        THE ONLY WAY A MESSAGE REACHES A PERSON
    scheduler.js     60s tick, advances enrollments
  providers/         sms/ email/ ai/ — mock by default
  routes/            api (session) · webhooks (public) · public (ROI calc)
public/              operator console (vanilla JS, CSP-safe)
web/                 marketing site (static, deployable separately)
tests/               77 tests
docs/                architecture, security, deployment, business model, ...
research/            niche analysis, customer discovery
sales/ marketing/    playbook, templates, Canva specs
```

---

## Where to read next

| You want | Read |
|---|---|
| Why this vertical, with data | `research/niche-analysis.md` |
| How it's built and why | `docs/architecture.md` |
| What it promises never to do | `docs/security.md` |
| How to put it online | `docs/deployment.md` |
| Pricing and unit economics | `docs/business-model.md` |
| How to sell it | `docs/sales-playbook.md` |
| Who the agents are | `docs/agent-handbook.md` |

---

## Costs

$0 to run. First real spend is a domain (~$12/yr) and a Twilio number
(~$1.15/mo) at your first live client — not before.
