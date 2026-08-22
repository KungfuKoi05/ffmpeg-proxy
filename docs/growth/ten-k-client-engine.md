# Ten-K Client Engine

A replication plan for the "Lab" funnel pattern — a free, recurring resource hub
that builds a targeted list and converts it into **$10,000/month** of consulting
retainers.

Published as an artifact: https://claude.ai/code/artifact/094e8915-4b6b-4faf-be11-ae83d1e23244
Source HTML: `docs/growth/ten-k-client-engine.html`

---

## 00 — What could and couldn't be verified

`go.aiconsultingclients.com` is denied by the session's network egress policy
(proxy returned `403` to the CONNECT). **The source page was not read**, and the
policy was not routed around.

This plan therefore replicates the *archetype*, not the artifact. A URL ending in
`/lab/` on a client-acquisition domain is, with high consistency, a free resource
hub gated by an email address: a library of playbooks, prompts, teardowns and
templates added to on a schedule, positioned as an ongoing subscription of value
rather than a one-shot lead magnet, feeding a high-ticket done-for-you or
coaching offer.

### Assumptions made explicit

- The Lab is **free and email-gated**, not paid.
- Money is made **downstream** of the Lab, in a high-ticket offer sold by
  application and call — not self-serve checkout.
- Traffic is **bought or borrowed** (paid ads, affiliates, podcast placement)
  rather than purely organic. A `go.` subdomain is typically a funnel/ad-landing
  host.
- Starting near zero: no meaningful list, no ad budget to burn, time is the main
  input.

---

## 01 — Define what $10k/month means

| Shape | Structure | Trade-off |
|---|---|---|
| A | 1 × $10k | Fastest to the number, worst risk. One churn = zero. Needs an enterprise sales motion. |
| **B — recommended** | **2 × $5k** | **Reachable in 90 days from cold, survivable if one churns, deliverable by a solo operator or pair.** |
| C | 4 × $2.5k | Most stable revenue, most delivery load. Only if delivery is genuinely productised. |

Take Shape B, with a **$2.5k entry tier** as a landing pad — not a discount, a
scoped 30-day paid pilot that converts to $5k/mo on completion. It gives a
hesitant buyer a way to say yes that isn't "no", and produces a proof asset
within a month.

**Commitment:** two $5k/month retainers signed within 90 days, with a third in
pipeline.

---

## 02 — The offer that carries the number

Most attempts fail here, not at traffic. A generic "AI consulting" offer converts
at a fraction of a specific one, and no amount of list-building rescues it.

### The three locks

**One ICP.** Pick a vertical that passes all three tests:
- **Budget** — they already spend >$5k/mo on the problem, in salary or tools.
- **A repeatable AI-shaped pain** — the same expensive manual workflow exists at
  every company in the vertical.
- **Findability** — you can build a list of 3,000 named contacts from public
  sources.

Fail any one and move on. Do not serve two ICPs in the first 90 days. Bias toward
a vertical where you already have adjacent credibility or artifacts — that
collapses the proof problem.

**One outcome.** Price the result, never the hours. "We cut your *[named
workflow]* from *[N hours/week]* to under *[M]*, and you see the number in a
weekly report" is sellable at $5k. "AI consulting and automation services,
hourly" is not.

**One proof asset.** A free, specific, effortful teardown producible in 60–90
minutes for any prospect — a workflow audit that quantifies their cost of the
problem *in their own numbers*. This is the entire sales mechanism. It doubles as
the Lab's headline offer and the CTA of every cold email.

**The price conversation.** $5k/mo only holds if the buyer's cost of the problem
is visibly north of $15k/mo. That's the audit's job: put a defensible dollar
figure on their status quo. Once that number is agreed, $5k is arithmetic, not
negotiation.

---

## 03 — Build the Lab

What makes a "Lab" different from an ordinary lead magnet is the **recurring
drop**. A one-time PDF gets filed and forgotten. A Lab promises something new on
a schedule, which does three things a PDF can't: gives people a reason to keep
opening, keeps deliverability healthy through sustained engagement, and
**self-segments** — which resource someone opens tells you which problem they
have.

### Page spec, in order

1. **Above the fold** — outcome headline naming the ICP and the transformation,
   one-line sub, single email field, one button. **No navigation** — every link
   is a leak.
2. **Proof strip** — logos, subscriber count, or one hard number. With none yet,
   use a specific credential sentence rather than a fake social-proof bar.
3. **What's inside** — 4–8 *named* assets, each with a one-line "what this saves
   you". Real filenames beat category labels.
4. **Who it's for / not for** — explicit disqualification. Raises list quality
   and, counter-intuitively, opt-in rate among the people you want.
5. **The recurring hook** — "New drop every Tuesday." This is what makes it a
   Lab. Name the cadence, then never miss it.
6. **Why you** — one paragraph, one photo, one concrete thing shipped. Not a
   résumé.
7. **Second CTA + side door** — repeat the capture, and add the high-intent path
   underneath: *"Or if you'd rather we just run it — request an audit."* A slice
   of traffic is ready to buy on arrival.
8. **FAQ** — 5–6 real objections answered plainly.

**Structure is copyable; copy is not.** Page architecture, funnel mechanics and
offer structure are fair game and not protectable. The actual sentences are.
Rewrite everything in your own voice against your own ICP — it also converts
better, because their words were tuned for their audience.

**Target conversion:** 25–40% cold visitor→opt-in. Below 25% the headline is
wrong — not the button colour. Fix that before spending on traffic.

---

## 04 — Build the list: five engines

"A 10k-a-month client list" has two honest readings, and both are needed: a
**named prospect list** of companies who could plausibly write a $5k/month
cheque, and a **nurtured subscriber list** producing inbound applications.
Engine A builds the first; C, D and E build the second; B converts the first into
revenue while the second compounds.

### Engine A — The named account list (weeks 1–3)

The literal client list, and an asset you own forever. Target **3,000 verified
contacts across ~1,200 accounts** in one ICP.

- **Account criteria:** headcount band, revenue proxy, tech signals, geography,
  and one trigger signal — a recent raise, a relevant job posting, a new tool
  adoption. Trigger-filtered contacts outperform static lists by a wide margin.
- **Contact criteria:** the person who *owns the pain* plus the person who *owns
  the budget*. Often not the same human. Sequence both, differently.
- **Build in layers:** data provider for the base pull → enrichment for triggers
  and firmographics → verification to strip bouncers. Never sequence an
  unverified address; bounce rate is the fastest way to destroy a sending domain.
- **Own it:** the list lives in your own CRM or warehouse, not a tool's free
  tier. Tools churn; the list is the asset.

### Engine B — Cold outbound (weeks 2–12, the cash engine)

Pays for the time the other engines need to compound. Requires infrastructure
*before* the first send:

- **Secondary domains** — two or three lookalikes, never your primary.
- **SPF, DKIM and DMARC** on all of them. Non-negotiable; major inbox providers
  enforce it for bulk senders.
- **2–3 inboxes per domain**, warmed 14–21 days before real volume. Cap at
  **25–30 sends per inbox per day, permanently**. Six inboxes ≈ 150 sends/day,
  which is what the section 07 math assumes.
- **Four-step sequence:** short specific opener referencing the trigger signal →
  value-forward follow-up that gives away something real → a case or number →
  one-line breakup.
- **The ask is the audit, not the call.** "Want the teardown?" converts several
  times better than "got 15 minutes?" because it costs the prospect nothing and
  puts you in the position of giving.

Pair each email sequence with a light LinkedIn touch — profile view and connect,
no pitch. Multi-channel lifts reply rate materially at near-zero cost.

### Engine C — Organic content into the Lab (weeks 1–12, compounding)

One flagship artifact per week — a teardown, a build log, a benchmark with real
numbers — published where the ICP already is, then cut into 4–5 short posts
across the week. Every piece ends with the same Lab link.

The rule that makes it work: **publish the actual thing, not a teaser for the
thing.** Give away the method; sell the implementation. People who can execute it
themselves were never going to pay you; people who can't now trust that you can.

Realistic yield from a standing start: **80–200 opt-ins/month by month three**,
growing.

### Engine D — Borrowed audiences (weeks 3–12, highest ROI cold-start)

Most underused channel at zero list size, because it skips the compounding
period.

- **Podcast guesting** — pitch 20 shows serving the ICP, expect 3–5 bookings.
  Each is worth 50–300 opt-ins with a show-specific Lab URL.
- **Newsletter swaps** — non-competing operators writing to the same ICP. One
  well-matched swap can beat a month of posting.
- **Referral partners** — agencies, fractional CTOs, accountants adjacent to the
  ICP who see the pain but don't solve it. A standing 10–15% referral fee,
  documented.
- **Communities** — be the most useful reply in the thread. Never link-drop.

### Engine E — Paid (only after organic converts)

Do not start here. Paid amplifies whatever the funnel already does, including
failing. Turn on only once the Lab page converts above 25% cold *and* at least
one client has come through the nurture path.

Then **$50–100/day** on the single channel where the ICP is most precisely
targetable, judged on **cost per application** — never cost per opt-in. If a
client is worth $15k over its life, a $200 cost-per-application is excellent and
a $12 cost-per-opt-in tells you nothing.

---

## 05 — The nurture machine

Five welcome emails, then a weekly drop forever.

| Day | Email | Its actual job |
|---:|---|---|
| 0 | Access + the single best asset | Deliver instantly. Ask one question: *"what's your #1 bottleneck right now?"* Replies train inbox providers that you're wanted, and hand you segmentation data. |
| 2 | The mechanism | Teach how the thing actually works. No pitch. |
| 4 | Proof, with a number | One story, one metric, one named constraint worked around. Specific beats impressive. |
| 7 | The failure mode | Why doing it in-house stalls at step four. Creates the gap between knowing and having, honestly. |
| 10 | The invitation | The free audit, with the application link. The only hard CTA in the sequence — which is why it converts. |
| weekly | The drop | New Lab asset every week, same day. Every fourth issue carries the audit invitation in a footer, not a headline. |

**Segment on behaviour, not form fields.** Someone who opened three assets about
the same problem is hotter than someone who ticked a box six weeks ago. Tag on
asset opens; let a repeated-interest tag trigger a personal, plain-text,
one-to-one email from you. That email — not the automation — books calls.

**Prune ruthlessly.** No open in 90 days → one re-engagement attempt, then
suppress. Dead addresses degrade deliverability for the people who *are* reading.

---

## 06 — Application to signed

**Never send traffic straight to a calendar.** An application form between the
click and the booking kills tyre-kickers, forces the prospect to articulate their
pain in writing, and means you walk into every call already knowing the answer.

### The seven questions

1. Company, your role, and who else signs off on spend like this.
2. Describe the workflow you want fixed, in your own words.
3. How many hours a week does it consume, across how many people?
4. What have you already tried, and where did it stall?
5. What happens if this is still broken in six months?
6. When do you want it working by?
7. Budget band: *under $2k/mo · $2–5k/mo · $5–10k/mo · $10k+/mo · not sure yet*

Question 7 does most of the work. Include the bands and it self-selects; omit
them and you spend calls discovering you were never going to agree.

### The call, in 35 minutes

- **0–5 min — Context.** Confirm what they wrote. Don't re-ask what the form
  answered; showing you read it is half the trust.
- **5–20 min — Diagnosis.** Quantify the problem in *their* numbers, out loud,
  and get agreement on the figure. This is the entire call. Leave without an
  agreed number and there's nothing to price against.
- **20–30 min — The plan.** Three phases, plain language, what changes and how
  they'll know. No slides.
- **30–35 min — Price and next step.** Say the number on the call. Book the
  follow-up before hanging up.

**Proposal inside 24 hours**, three options anchored high: $10k/mo full
engagement, $5k/mo core retainer, $2.5k 30-day pilot. Most take the middle. Every
option is a real deliverable and none are priced in hours.

---

## 07 — The math: two funnels

Conversion rates below are deliberately pessimistic — roughly the bottom of the
range a well-targeted campaign hits. Plan against these.

### Funnel A — cold outbound, one quarter

| Stage | Rate | Count |
|---|---:|---:|
| Contacts sequenced | — | 2,500 |
| Positive replies | 2% | 50 |
| Calls booked | 45% | 23 |
| Calls held | 70% | 16 |
| Qualified & proposed | 55% | 9 |
| **Signed** | **22%** | **2** |

**2,500 contacts → 2 clients → $10,000/month.** At a 4-step sequence that's
~8,750 sends; at 150 sends/day from six warmed inboxes, ~58 sending days —
comfortably inside a quarter. This is why the Engine A list target is 3,000, not
500.

Miss on copy and you rewrite the sequence in an afternoon. Miss on the list and
nothing you write matters.

### Funnel B — the Lab list, one quarter

| Stage | Rate | Count |
|---|---:|---:|
| Engaged subscribers | — | 1,000 |
| Open the weekly drop | 40% | 400 |
| Click the invitation | 15% | 60 |
| Applications | 30% | 18 |
| Qualified | 55% | 10 |
| Calls held | 80% | 8 |
| **Signed** | **28%** | **2** |

**~1,000 engaged subscribers is worth about $10,000/month** in this model — and
it keeps producing quarter after quarter, at a close rate meaningfully higher
than cold. The target isn't "grow the list"; it's *a thousand of the right people
who open your email.*

### Sensitivity — what actually moves the outcome

| If this changes | From | To | Clients from the same 2,500 contacts |
|---|---:|---:|---|
| Positive reply rate (list & targeting quality) | 2% | 4% | **2 → 4** — highest-leverage variable in the system |
| Close rate (offer & price fit) | 22% | 30% | 2 → 3 |
| Show rate (booking friction, reminders) | 70% | 85% | 2 → 2.4 |
| Sequence steps (follow-up discipline) | 2 | 4 | ~1 → 2 — most replies come after the first email |

**List quality and follow-up discipline dominate.** Subject-line testing is not
where the money is.

---

## 08 — Delivery, so it survives month three

Two clients at $5k means **a single churn is a 50% revenue drop**. Four mechanics
carry retention:

- **A first-14-days plan that produces one visible win.** Ship the smallest real
  result inside two weeks. The relationship is decided early.
- **A weekly async update** — short recorded walkthrough, three bullets, one ask.
  Cheaper than a meeting and it makes your work visible, which is what actually
  prevents churn. Invisible work looks like no work.
- **A monthly number** — the same metric quantified on the sales call, reported
  against baseline. This is the renewal conversation, held every month so it's
  never a conversation.
- **90-day scoped terms that roll over** — not month-to-month (too easy to
  drift), not annual (too hard to sign). Review at day 75; that's also the
  expansion window.

Around day 60 most clients surface a second workflow with the same shape as the
first. That's a scope conversation, not a favour — and the cheapest revenue in
the plan: no list, no funnel, no call.

---

## 09 — Stack and monthly cost

| Category | What it does | $/month |
|---|---|---:|
| Sending domains | 2–3 lookalikes, annual registration amortised | ~5 |
| Inboxes | 6 mailboxes across those domains | 40–60 |
| Cold-send platform | Sequencing, warmup, rotation, reply detection | 40–100 |
| Data & enrichment | Account pull, contact discovery, trigger signals | 100–350 |
| Email verification | Bounce protection — do not skip this line | 20–40 |
| Newsletter ESP | The Lab list, sequences, segmentation | 0–50 |
| Landing page / site | The Lab page and the application form | 0–25 |
| Scheduler | Booking, reminders, no-show recovery | 0–15 |
| CRM | Pipeline, and where the list actually lives | 0–35 |
| **Total** | | **$205–680** |

Call it **$400/month realistic**. Against a $5,000/month client that's sub-
one-month payback and a CAC that rounds to nothing. **Time is the real budget
line** — expect 15–20 focused hours a week for the first six weeks, front-loaded
into list building and the Lab.

Start at the bottom of every range. Upgrade a line only when that specific thing
is provably the constraint.

---

## 10 — The 90-day calendar

| Weeks | Build | Outbound | Lab & content | Target by end |
|---|---|---|---|---|
| 1–2 | Lock ICP, offer, price. Register domains, set SPF/DKIM/DMARC, **start inbox warmup on day one**. | Build first 800 verified contacts. Write the 4-step sequence. | Write and ship the Lab page. Produce first three assets. | Page live, warmup running, 800 contacts |
| 3–4 | Application form, scheduler, CRM stages. Build the audit template. | Warmup completes. **First sends** at ~75/day. | Welcome sequence live. First weekly drop. Pitch 20 podcasts. | First replies, first audits delivered |
| 5–8 | Refine the audit off real ones. Write the proposal template. | Full volume ~150/day. Iterate the opener against reply data. | Weekly drop holds. Podcasts record. First swap. | **First client signed.** 400+ subscribers |
| 9–12 | Onboard client one. Document delivery so client two is cheaper. | Sustain volume. Re-sequence non-responders with a new angle. | Drop holds. Turn on paid only if the page is converting. | **Second client signed — $10k/mo.** 800–1,000 subs |

**The one sequencing rule:** inbox warmup starts on day one, before the offer is
finalised, before the page is written. It's the only step with an unavoidable
14–21 day wait, and every day delayed delays first revenue by a day. Everything
else builds in parallel while it runs.

---

## 11 — Scoreboard and kill criteria

| Weekly metric | Target | If it's under, the problem is… |
|---|---:|---|
| Contacts sequenced | 250 | Capacity — add inboxes, not volume per inbox |
| Positive reply rate | ≥2% | Under 1% after 500 contacts: **the ICP or the offer is wrong**, not the copy |
| Lab opt-ins | 40 | Page under 25%: the headline. Traffic too low: distribution |
| Applications received | 2 | Invitation not prominent enough, or the free audit isn't desirable enough |
| Calls held | 3 | Show rate — add reminders, shorten booking lead time |
| Proposals out | 1 | Not diagnosing hard enough on the call to earn one |

### Decide these now, while it's cheap

- **Under 1% positive replies after 500 well-verified contacts** → change the ICP
  or the offer. Do not spend a third week rewriting subject lines.
- **Good reply rate but under 15% close after 8 held calls** → the offer or the
  price is wrong, not the traffic. Look at the diagnosis step first.
- **Lab page under 25% opt-in on cold traffic after 300 visitors** → rewrite the
  headline against a sharper outcome, not the design.
- **No client by week 10** → stop adding channels. Go back to the two or three
  held calls that got furthest and find out, directly, what stopped them.

Write these thresholds down before starting. In week seven you will be too
invested to decide fairly.

---

## 12 — Legal guardrails

- **US cold email (CAN-SPAM).** Accurate headers and subject lines, a real
  physical postal address in every message, a working opt-out honoured within 10
  business days. B2B cold email is lawful when these hold.
- **EU/UK (GDPR & PECR).** Materially stricter; legitimate-interest grounds for
  cold B2B outreach are narrow and country-dependent. Simplest safe path for a
  90-day sprint: **exclude EU and UK contacts from outbound**, reach them through
  content and inbound instead.
- **Canada (CASL).** Consent-based, with real penalties. Exclude from cold
  sequences unless you have a documented basis.
- **Data sourcing.** Use providers whose terms permit outreach use. Scraped-and-
  resold lists of unknown provenance are both a legal and a deliverability
  liability.
- **Copy.** Replicate structure and mechanics freely; don't reuse another site's
  sentences, asset names or design assets.
- **Claims.** Published results or income figures must be substantiated and
  typical — the FTC treats unsubstantiated earnings claims as deceptive, and this
  niche gets looked at. Use your own real numbers with context, or none.

*General guidance, not legal advice — run the outbound plan past a lawyer before
scaling beyond a few thousand contacts or into regulated verticals.*

---

## 13 — What would turn this into a direct replication

1. **The page copy** — the text of `/lab/`, headline through footer. Maps their
   section order and persuasion structure against the spec in section 03.
2. **What happens after opt-in** — thank-you page, first two emails, and whether
   it pushes to a call, a webinar, a paid community or a sales page. This reveals
   the actual business model and is the least guessable part.
3. **Their offer and price, if visible** — determines whether it's a high-ticket
   coaching ladder or a done-for-you services funnel: two different machines
   behind the same front page.
4. **The ICP, once chosen** — sections 02, 04 and 07 all sharpen materially once
   the vertical is named; the account criteria and audit template can then be
   built against it.
