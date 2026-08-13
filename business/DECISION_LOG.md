# Decision Log

Append-only. Superseded decisions are marked, never deleted. Failure criteria are set **before**
results are seen — deciding what counts as failure after the fact is how companies talk themselves
into dead ends.

---

## D-001 — Select OPP-08 as the primary business
**2026-08-13** | Owner: CEO | Status: **active**

**Hypothesis**
Community association management companies will pay $60–90 per board meeting for finished,
board-ready minutes delivered within 48 hours, because it removes 2–3 hours of after-hours work per
meeting from a portfolio manager who is already over capacity.

**Evidence**
- 8,000–9,000 management companies manage 60–70% of ~377,000 US associations
  [FACT: https://www.avidxchange.com/blog/2026-community-manager-trends/]
- Portfolio managers carry 8–12 associations each
  [FACT: https://accuinc.com/how-many-hoas-does-your-community-manager-manage/]
- Manager burnout and turnover are rising; managers are doing more with the same bandwidth
  [FACT: https://managecasa.com/articles/state-of-hoa-community-association-management]
- Budget for this exact outcome is proven: MinuteSmith $149–699/mo, enterprise from $12,000/yr;
  BoardBreeze $29.99–499/mo [FACT: https://minutesmith.com/blog/board-meeting-minutes-software],
  [FACT: https://appboardbreeze.com/hoa]
- Minutes are a statutory record, so the work cannot simply be skipped
  [FACT: https://www.hoamanagement.com/board-meeting-minutes/]
- Scored 87.3 against the rubric, 5.8 points clear of the runner-up — see `opportunities/RANKED.md`

**Why this one over the alternatives**
Every rejected finalist failed on a constraint rather than on demand. Healthcare needs PHI and
customer credentials. Order entry and chronology are owned by funded competitors. Certified payroll
(OPP-01, 81.5) is genuinely strong but weekly and legally consequential — the wrong place to learn a
business part-time. OPP-08 is the only finalist where we can produce a **complete, free, genuinely
useful sample within 24 hours at zero cost**, which is the entire acquisition strategy on a $0 budget.

**Experiment**
E-001: hand-send 40 personalized emails to management company owners offering free minutes from one
recent board recording. Measure reply rate, sample acceptance, and — critically — how many say their
boards do not record.

**Cost**
$0. Approximately 6–8 founder hours across two weeks.

**Success criteria** (decided in advance)
- ≥4 replies from 40 sends (10%)
- ≥2 accept the free sample
- ≥1 paid engagement within 30 days of first send

**Failure criteria** (decided in advance)
- <2 replies from 40 sends → the message or the buyer is wrong; revise once, resend to 40 more
- ≥50% of respondents say their boards do not record meetings → **the delivery model is broken**,
  not the message. Kill and promote OPP-01.
- 0 paid engagements after 80 sends and 2 message revisions → kill, promote OPP-01
- Any sample taking >90 minutes of founder time to reach deliverable quality → margin does not
  exist at $75/meeting; reprice or kill

**Next action**
Growth builds the ICP, offer, sequence, and a 40-row verified prospect list. Founder sends.

---

## D-002 — Sell to management companies, not to individual associations
**2026-08-13** | Owner: CEO | Status: **active**

**Hypothesis**
The buyer is the management company, not the HOA board.

**Evidence**
A single association generates one meeting a month — a $75 account not worth acquiring. A management
company with 30 associations generates 25–30 meetings a month, or $1,875–$2,250/mo
[ESTIMATE: 8–12 associations per manager × typical firm staffing, monthly cadence]. Volunteer boards
also decide by committee and turn over annually; management company owners decide alone and stay.

**Experiment** Covered by E-001 — all 40 prospects are management companies.

**Cost** $0.

**Success criteria** Owner-level replies engage with portfolio-wide volume, not a single meeting.

**Failure criteria** Replies consistently defer to individual boards for the decision. That would
mean the buying unit is the association after all, which collapses deal size and forces a rethink of
the whole model.

**Next action** Prospect list is filtered to firms managing 10+ associations.

---

## D-003 — No product code until the validation gate passes
**2026-08-13** | Owner: CEO | Status: **active**

**Hypothesis**
Fulfillment for the first ten customers needs no software beyond what this repo already contains.

**Evidence**
Delivery is: receive a recording → extract audio (`server.js` `/extract-audio`, already built and
free) → transcribe → draft minutes against a template → human QA → send a document. Every step is
manual-capable today. The incumbents' own turnaround is 15–20 minutes of machine time
[FACT: https://appboardbreeze.com/hoa], so speed is not a differentiator worth pre-building for.

**Experiment** Deliver the first samples entirely by hand and time every step.

**Cost** $0.

**Success criteria** A sample is delivered at acceptable quality in under 90 minutes of founder time.

**Failure criteria** Manual delivery exceeds 90 minutes per meeting, which breaks the margin at
$75/meeting before automation exists.

**Next action** Builder produces a spec only. Code waits for a paying customer.
