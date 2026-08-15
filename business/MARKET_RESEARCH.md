# Market Research

**Owner:** Scout | **Last updated:** 2026-08-13

25 opportunities generated across the four industries where the founder has working knowledge, scored
against `opportunities/RUBRIC.md`, and narrowed to one. Full ranking: `opportunities/RANKED.md`.
Raw scores and per-factor evidence: `data/opportunities.json`.

---

## What the funnel eliminated, and why

The rubric earned its keep by killing things that looked good.

**Six opportunities were killed on disqualifiers, not on demand.** The healthcare cluster —
dental insurance verification, claim-denial AR recovery, prior authorization — contains the
strongest pain and the clearest ROI story in the entire set. Dental verification alone replaces a
role costing roughly **$3,600/month fully loaded** and sells for **$300–800/month**
[FACT: https://www.cecomputech.com/guides/dental-billing-services-costs/],
[FACT: https://dentalbilling.com/pricing-dental-insurance-verification/]. We killed all three
anyway: every one requires PHI handling under a business associate agreement plus login credentials
to the customer's payer portals and practice management system. That is access we cannot obtain on
acceptable terms with $0 and no legal review.

**This is the rubric working correctly.** The best problem is not the same thing as the best problem
*for us, right now, with these constraints*.

Three more died on structure rather than substance: missed-call answering for home services
(needs paid telephony and 24/7 coverage), property maintenance triage (needs real-time response
during business hours), and delivery-platform reconciliation (needs merchant-portal credentials
whose terms of service restrict third-party access).

**Two more were killed by competition arriving first.** Medical record chronology for personal injury
firms is textbook boring, painful, document-heavy work — a 1,200-page file costs about **$3,400** in
paralegal hours in-house and roughly **$4,500** outsourced
[FACT: https://medicalrecordsreviewforattorneys.com/medical-record-review-cost-attorneys/]. But at
least eight AI chronology products already compete and prices have fallen to **$28 per chronology**
[FACT: https://www.tavrn.ai/blog/medical-chronology-software]. Similarly, inbound order entry for
distributors is real and expensive — 6 to 15 minutes per order, multiple full-time roles at 100
orders/day [FACT: https://blog.stackcube.io/ai-order-entry-software-for-distributors] — but several
venture-funded companies own that wedge [FACT: https://www.ycombinator.com/companies/comena], and
the hard part is ERP write-access we cannot get.

Entering a commoditizing market late, with no capital, against funded competitors, is not a
contrarian bet. It is just a bad one.

---

## Top 3 — deep validation

### 1. OPP-08 — HOA board meeting minutes + post-meeting package · **87.3**

**Buyer:** community association management companies, not individual associations. This distinction
is the whole business — it converts a $75 transaction into a four-figure monthly account.

**Market size is large and reachable.** Approximately **377,000 community associations** operate in
the US, and **8,000–9,000 management companies manage 60–70% of them**
[FACT: https://www.avidxchange.com/blog/2026-community-manager-trends/]. Portfolio managers each
carry **8–12 associations**, with the industry average at 10 or more
[FACT: https://accuinc.com/how-many-hoas-does-your-community-manager-manage/].

**The pain is structural and worsening.** Managers are "asked to do significantly more with the same
bandwidth they had three years ago," and manager burnout and turnover are rising
[FACT: https://managecasa.com/articles/state-of-hoa-community-association-management]. Minutes are a
statutory record that must be produced accurately, and they are written after hours, days later,
from memory and scribbled notes.

**Budget is proven by incumbents.** MinuteSmith prices by portfolio at **$149–$699/month**, with
enterprise from **$12,000/year**; BoardBreeze runs **$29.99–$499/month**
[FACT: https://minutesmith.com/blog/board-meeting-minutes-software],
[FACT: https://appboardbreeze.com/hoa]. Money already moves for exactly this outcome.

**The whitespace:** incumbents sell *self-serve software to the manager*, who must still upload,
review, correct, and format. We sell *the finished document to the management company* — replacing
labor, not adding a tool to learn. Different buyer, different unit of value, priced against a
manager's hours rather than against a software subscription.

**Unit math:** a firm with 30 associations runs roughly 25–30 board meetings a month. At $75/meeting
that is **$1,875–$2,250/month from one customer** [ESTIMATE: derived from the 8–12 associations per
manager figure above and a monthly meeting cadence]. **$10,000/month needs 4–6 customers.**

**The real risk, stated plainly:** this depends entirely on meetings being recorded. California,
Florida, and Pennsylvania are two-party consent states, and HOAs may prohibit recording in their
governing documents [FACT: https://thehoahandbook.com/is-it-legal-to-record-hoa-meetings-state-laws-explained/].
The mitigation is industry standard — the board announces recording, minutes are produced, the audio
is deleted, which is exactly what BoardBreeze already does
[FACT: https://appboardbreeze.com/hoa]. But adoption friction is real and **this is the first thing
outreach must measure, not assume.**

### 2. OPP-01 — Certified payroll / prevailing wage reporting · **81.5**

Upgraded sharply during validation. The initial score assumed software-tier pricing of $50–175/month;
research found a **fully managed tier at $1,000–$5,000/month for mid-sized contractors**
[FACT: https://www.certifiedpayrollpro.com/certified-payroll-services]. Providers including Points
North, eBacon's managed tier, and CPWIS already sell exactly this
[FACT: https://contractorsprevailingwage.com/certified-payroll-reporting/certified-payroll-how-we-help/].

Weekly WH-347 filing is legally mandatory on federally funded work and errors withhold payment
[FACT: https://quickbooks.intuit.com/r/payroll/what-is-certified-payroll/]. Buyers are trivially
findable through public bid awards and state license boards.

**Why it is second, not first:** the cadence is weekly rather than monthly, so ten customers means
roughly 40 legally-consequential deliverables a month. Errors do not produce an awkward email — they
withhold a contractor's payment and can trigger DOL penalties. Correct delivery requires
prevailing-wage and wage-determination expertise the founder does not yet have, and we would be
holding employee SSNs and wage data from day one. High-liability, high-expertise work is the wrong
place to learn a business in 6–10 hours a week.

**Designated fallback.** If OPP-08 fails its kill criteria, this is next, and it does not need
re-research to start.

### 3. OPP-05 — Government bid monitoring + proposal drafting · **74.8**

Best raw deal size in the set at $750–2,000/month, so $10K needs only 5–13 customers. Opportunity
data is free at SAM.gov, and an established consulting category proves firms pay for this
[FACT: https://usfcr.com/services/federal-proposal-writing-consulting/].

**Why it is third:** the value proposition is speculative — the customer pays now to *maybe* win
later, which lengthens the sales cycle and invites churn after any losing bid. Proposal QA is
expensive in founder hours and unpredictable in timing, since bid deadlines arrive without regard to
a 6–10 hour week.

---

## Sources

- [CAI / FCAR industry figures via AvidXchange](https://www.avidxchange.com/blog/2026-community-manager-trends/)
- [Portfolio manager load](https://accuinc.com/how-many-hoas-does-your-community-manager-manage/)
- [State of HOA management 2026](https://managecasa.com/articles/state-of-hoa-community-association-management)
- [MinuteSmith pricing](https://minutesmith.com/blog/board-meeting-minutes-software) · [BoardBreeze pricing](https://appboardbreeze.com/hoa)
- [HOA recording law by state](https://thehoahandbook.com/is-it-legal-to-record-hoa-meetings-state-laws-explained/)
- [Certified payroll managed services](https://www.certifiedpayrollpro.com/certified-payroll-services) · [CPWIS](https://contractorsprevailingwage.com/certified-payroll-reporting/certified-payroll-how-we-help/)
- [Medical record review cost](https://medicalrecordsreviewforattorneys.com/medical-record-review-cost-attorneys/) · [AI chronology competitors](https://www.tavrn.ai/blog/medical-chronology-software)
- [Distributor order entry cost](https://blog.stackcube.io/ai-order-entry-software-for-distributors) · [Funded competitor](https://www.ycombinator.com/companies/comena)
- [Dental billing costs](https://www.cecomputech.com/guides/dental-billing-services-costs/) · [Verification pricing](https://dentalbilling.com/pricing-dental-insurance-verification/)
- [COI tracking pricing](https://www.vertikalrms.com/article/how-much-does-coi-tracking-software-cost-2026-pricing-guide/)
- [Transaction coordinator pricing](https://www.agentup.com/blog/real-estate-transaction-coordinator-pricing)

## What is still unknown

1. What share of HOA boards already record meetings — **the single most important unknown**
2. Whether management companies buy centrally, or each portfolio manager decides
3. Whether minutes are already billed to the association as a separate line item (if so, we expand
   their margin rather than adding a cost — a materially better pitch)
4. Actual turnaround expectation: is 48 hours valuable, or is one week fine?

Questions 1–4 are answered by outreach, not by more searching. Research has hit diminishing returns.
