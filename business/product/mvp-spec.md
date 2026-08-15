# MVP Specification

**Status: specification only. Gate not passed. Nothing here is built.**

Each component lists the trigger that authorizes building it. Building ahead of the trigger is the
failure this system exists to prevent.

---

## 1. Landing page — *trigger: a prospect asks for a link twice*

Single static HTML file, GitHub Pages, free `github.io` subdomain. No purchased domain until revenue
exists.

- One page, one action: a `mailto:` link that opens a pre-filled email
- Copy verbatim from `marketing/landing-copy.md`
- No forms, no JavaScript, no analytics script, no cookie banner needed
- Mobile-first; owners read email on phones
- No testimonials, logos, or customer counts until they are real

**Deliberately excluded:** a booking widget. The offer is "forward a recording," not "book a call" —
a calendar link would raise the cost of saying yes.

## 2. Intake — *trigger: customer 1*

Email. A customer forwards a recording to the founder's address.

Upgrade to a Google Form or Tally form only when email breaks down, which will be around customer 5
and may never happen. Both are free.

Required fields whenever it becomes a form: association name, meeting date, template, executive
session instruction.

## 3. Fulfillment pipeline — *trigger: customer 3, after 5+ manual deliveries*

`tools/minutes.js`, Node stdlib only, consistent with the rest of `tools/`.

```
input:  recording file + association config
  ├─ extract audio        → existing server.js /extract-audio
  ├─ transcribe           → timestamped, speaker-separated
  ├─ segment              → agenda items, motions, votes
  ├─ draft                → association template
  ├─ extract action items → owner + due date
  └─ output               → draft document + QA checklist + per-step timings
```

**The QA checklist is generated with every draft**, not offered as an option. The human read-through
in SOP-001 is a hard requirement of the pipeline, not a step the pipeline can skip.

**Per-step timing output is a requirement, not a nice-to-have.** It is how 90 minutes becomes 20, and
without it the automation ladder has no data to climb.

**Why not sooner:** five manual runs are needed to learn where the work actually goes. Every hour
spent building this before then is an hour spent guessing.

## 4. Template library — *trigger: customer 3*

`business/product/templates/<association-slug>.md` — one per association, in git, versioned.

Real customer templates only. No invented formats. This becomes a genuine moat: after fifty
associations, we have their formats and a competitor does not.

## 5. Delivery tracker — *trigger: customer 5*

Extend `data/customers.json`:

```json
{ "customer": "", "association": "", "meeting_date": "",
  "received_at": "", "delivered_at": "", "minutes_spent": 0,
  "revisions": 0, "invoiced": false, "audio_deleted": true }
```

Rendered by extending `tools/kpi.js` — no new tool, no new dependency.

`audio_deleted` is tracked because we promised it in writing and a promise we cannot verify is one we
should not have made.

## 6. Payment — *trigger: first paid customer*

Stripe payment link, monthly invoice by email. Free to create, fees only on revenue. **Requires
founder action** (account creation and identity) — queue in `APPROVALS.md` when the moment arrives.

No subscription billing until 10+ customers. Manual invoicing at this scale takes ten minutes a month
and keeps the founder in contact with every customer, which is worth more than the time it costs.

---

## Explicitly not built, and why

| Not building | Why |
|---|---|
| Customer portal | Email is not the bottleneck. It solves a problem nobody has reported |
| Live meeting transcription | A different, harder product. No evidence anyone wants it from us |
| Management-platform integrations | Needs partnerships and credentials. Revisit above $5K MRR |
| Self-serve signup | A consultative sale under 20 customers; the conversation *is* the product research |
| Database | JSON in git is inspectable, diffable, free, and sufficient |
| Auth / multi-user | One owner, one inbox |
| Dashboard for customers | They want a document in their inbox, not a login |

Every one of these becomes worth building at some scale. None of them is worth building at zero
customers, and the trigger column above is what keeps that honest.
