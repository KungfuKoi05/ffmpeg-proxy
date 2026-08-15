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

---

## D-004 — Build the landing page now, ahead of the D-003 trigger
**2026-08-15** | Owner: Founder (override) | Status: **active**

**Hypothesis**
Having a page to point at is worth more than the discipline of waiting for the trigger.

**Evidence**
D-003 set the build trigger at "a prospect asks for a link twice," on the reasoning that the sample
document is stronger proof than a website and nobody had asked. That reasoning still holds. The
founder weighed it and decided the page is worth having before the first reply arrives — a cold
prospect who receives an email from an unknown sender will often look for a website before replying,
and finding nothing is itself a signal.

**Recorded as an override, not a silently moved goalpost.** The agent recommendation was to hold;
the founder decided to build. Cost is $0 and roughly an hour, so the downside is bounded.

**Experiment** None. This is a judgment call, not a test.

**Cost** $0. No domain purchased — GitHub Pages free subdomain if published.

**Success criteria** A prospect references the page, or it removes a stall in a reply thread.

**Failure criteria** None meaningful — the page is static and costs nothing to keep. If it goes
unvisited, we learned the trigger was right and lost an hour.

**Next action** Built at `site/index.html` and committed. **Publishing is deliberately not done** —
enabling GitHub Pages is a founder action, queued as A-002.

---

## D-005 — Position on state-specific compliance, not generic formatting
**2026-08-15** | Owner: CEO | Status: **active**

**Hypothesis**
"Formatted to your state's requirements" beats "formatted to your template" as positioning, and is
defensible against generic AI transcription tools.

**Evidence**
Minutes requirements are genuinely non-uniform. Colorado CRS 38-33.3-308(7) requires minutes to state
that an executive session was held and its general subject matter
[FACT: https://dre.colorado.gov/hoa-meetings]. Florida §720.303 sets 7-year retention and a
10-business-day inspection window
[FACT: https://minutesmith.com/blog/florida-hoa-meeting-minutes-requirements]. Georgia and North
Carolina are permissive, so bylaws control
[FACT: https://minutesmith.com/blog/hoa-minutes-requirements-by-state]. A general-purpose summarizer
gets executive session wrong in exactly the states where it is specified.

**Experiment** Carried inside E-001 — the touch-3 state line varies by state and its effect on reply
quality is observable.

**Cost** $0. Research complete; encoded in `product/minutes-template.md`.

**Success criteria** Prospects engage with the compliance framing rather than treating us as a
transcription vendor.

**Failure criteria** Nobody cares, and price becomes the only conversation. Then the differentiator
is turnaround, not compliance.

**Next action** Encoded in the template and the runbook. Hedged in outreach until verified.

---

## D-006 — Prioritize Nevada, pending verification
**2026-08-15** | Owner: CEO | Status: **provisional — blocked on verification**

**Hypothesis**
Nevada is the highest-priority market because the input we depend on may be legally mandatory there.

**Evidence**
NRS 116.31083 reportedly requires the secretary to "cause each meeting of the executive board to be
audio recorded," prohibits recording executive session, and requires the audio, the minutes, and a
summary of the minutes to be available to owners within 30 days
[FACT: https://law.justia.com/codes/nevada/chapter-116/statute-116-31083/].

If accurate, this removes the single largest risk in the entire business. D-001's kill criterion is
"≥50% say their boards do not record." In Nevada that objection may not exist, because the recording
is already required. The statutory "summary of the minutes" is also a second deliverable we can
produce at no extra cost.

**Why this is provisional.** The finding is search-sourced. Justia, the Nevada Legislature, and every
other primary source are blocked by this environment's egress proxy — attempted and confirmed. A
false statement of law to a prospect would be worse than saying nothing.

**Experiment** Founder reads NRS 116.31083 directly. Five minutes.

**Cost** $0.

**Success criteria** Statute confirms mandatory recording → Nevada becomes the lead market, the
prospect list is rebuilt Nevada-first, and the touch-3 state line is un-hedged.

**Failure criteria** Statute does not say this → delete the Nevada line from touch 3 entirely, revert
to standard prioritization. **Do not soften and send anyway.**

**Next action** Queued as A-003. The touch-3 Nevada line stays hedged and unsent until then.
