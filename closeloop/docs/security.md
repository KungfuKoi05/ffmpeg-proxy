# Security and safety

**Owner:** Forge + Sentinel

This document states promises. Each is enforced by code and covered by a test in
`tests/safety.test.js` or `tests/api.test.js`. If a promise here has no test,
treat it as a bug.

---

## Spending money

**Promise: this software cannot spend money without an explicit, deliberate act.**

Enforcement — three independent layers:

1. **Defaults.** `SMS_PROVIDER`, `EMAIL_PROVIDER` and `AI_PROVIDER` all default
   to `mock`. A fresh checkout transmits nothing.
2. **Configuration gate.** A paid provider that is selected but missing
   credentials degrades to `mock` with a warning rather than failing.
   (`providers/index.js: resolve`)
3. **The spend gate.** `resolveForSend()` swaps any provider where
   `costsMoney === true` for its mock unless the effective automation mode is
   `LIVE`. There is no call path to a paid provider that bypasses it.

*Tested:* "a paid provider is downgraded to mock outside LIVE mode",
"an unconfigured paid provider falls back to mock rather than failing".

## Messaging real people

**Promise: nothing reaches a real person until a human puts the system in a mode
that allows it.**

- Default global mode is `TEST`. Default client mode is `TEST`.
- The global mode is a **ceiling**: a client set to `LIVE` under a global `TEST`
  is still `TEST`.
- `ASSISTED` requires a human to approve each message. `outbox.dispatch()`
  **refuses** any message not in `approved` state — there is no path from
  `pending_approval` to a provider that skips a person.
- Moving a client to `LIVE` in the UI requires confirming a dialog that names
  the consequence.

*Tested:* "dispatch REFUSES a message that has not been approved", "the global
mode is a ceiling a client cannot exceed", "ASSISTED mode parks the message".

## Consent and opt-out

**Promise: we do not send marketing SMS without a consent record, and STOP is
honoured immediately and permanently.**

- `LIVE` SMS to a lead without `consent_sms` is **suppressed**, not sent.
- `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` (any case, with
  trailing text) set `opted_out`, force status to `dnc`, and halt every active
  sequence — **before** any other processing touches the lead.
- Opt-out is re-checked at dispatch time, so a STOP arriving between approval
  and send still blocks the send.
- Every marketing SMS sequence carries an opt-out notice in its **first**
  message. (Transactional appointment reminders are exempt, by design.)
- Quiet hours are enforced in the client's local timezone and **defer** rather
  than drop — the follow-up still happens, just not at 3am.

*Tested:* "an opted-out lead is never messaged again", "opting out between
approval and dispatch still blocks the send", "LIVE SMS is blocked without
recorded consent", "every SMS sequence opens with an opt-out notice".

> **Not legal advice.** TCPA, CTIA and carrier rules apply to US SMS and change.
> Before going `LIVE`, confirm your consent language and registration (10DLC)
> with counsel. The controls above are engineering enforcement, not compliance
> certification.

## Honesty of reporting

**Promise: we never claim revenue we cannot trace.**

Attribution requires the full chain (message delivered → reply after it → job
won after that). Suppressed and failed messages do not count as contact. Jobs we
cannot trace appear in the report in their own section with the reason.

*Tested:* the whole of `tests/attribution.test.js` (8 cases, most of which assert
we do **not** claim credit).

## Things the system will never do

Enforced by absence — there is no code to do them, and no configuration enables
them:

- Fabricate reviews, or filter review requests by predicted sentiment.
- Impersonate a named individual. Messages are sent as the *business*.
- Contact a past-customer list without an explicit opt-in — the reactivation
  sequence ships **disabled**.
- Send a message containing an unrendered `{{token}}`; those are suppressed.
- Exceed the per-client daily send cap (default 200).

## Application security

| Control | Implementation |
|---|---|
| Password storage | `scrypt`, 16-byte per-user salt, 64-byte key |
| Password comparison | `crypto.timingSafeEqual`, with length check first |
| User enumeration | equivalent scrypt work performed for unknown emails |
| Sessions | HMAC-SHA256 signed cookie, `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS, 12h TTL |
| Session tampering | signature verified before the payload is parsed |
| Tenant isolation | client-role sessions are pinned to their `client_id`; a supplied `client_id` cannot widen scope |
| Privilege separation | operator-only routes reject the `client` role |
| API enumeration | unknown `/api/*` paths return 401 unauthenticated, identical to real routes |
| Path traversal | `path.resolve` then prefix check against the static root |
| Request size | 1 MB default, 10 KB on public endpoints → 413 |
| SQL injection | parameterised statements only; no string-concatenated SQL |
| XSS | UI builds DOM via `createElement`/`textContent`; no `innerHTML` anywhere |
| CSP | `default-src 'self'; script-src 'self'`; no inline handlers |
| Clickjacking | `X-Frame-Options: DENY`, `frame-ancestors 'none'` |
| Webhook auth | optional shared secret, compared in constant time |
| Error leakage | 500s return `{"error":"internal error"}`; stacks go to logs only |

*Tested:* "a forged session cookie is rejected", "a session with a tampered
payload is rejected", "a client user cannot read another client's data", "a
client user cannot reach operator-only endpoints", "static file serving refuses
directory traversal", "malformed JSON returns 400, not a stack trace".

## Secrets

- All secrets come from environment variables. `.env` is git-ignored.
- No secret is logged, returned by an API, or rendered in the UI.
- `/api/me` reports provider **names and whether they cost money** — never keys.

## Known gaps

Honest list of what is *not* done, and why that is acceptable today:

| Gap | Risk | When to fix |
|---|---|---|
| No rate limiting on `/login` | brute force | before public internet exposure |
| No CSRF token | limited by `SameSite=Lax` + JSON-only bodies | if cookie auth is ever used cross-site |
| Webhook secret optional | forged leads | **set `WEBHOOK_SECRET` before production** |
| No encryption at rest | disk access = data access | first client with a compliance requirement |
| Single operator account | no per-user audit trail | second employee |
| No automated backups | data loss | **before first paying client** (see `deployment.md`) |
