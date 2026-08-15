# Unit Economics

**Owner:** CFO | **Last updated:** 2026-08-13
**Status:** every figure below is `[ESTIMATE]` or `[ASSUMPTION]`. Nothing has been measured, because
nothing has been sold. This document exists to identify which number kills the plan, before we spend
sixteen weeks discovering it.

---

## Per-meeting economics

Notional founder rate: **$50/hour**. The founder is not paid in cash, but pricing their time at zero
is how a business quietly becomes a badly-paid job.

| Stage | Founder time | Cost | Notes |
|---|---|---|---|
| **Manual (customers 1–2)** | 90 min | $75.00 | Transcribe, draft, QA, format, send |
| **Scripted (customers 3–5)** | 45 min | $37.50 | Transcription + template assembly automated; QA fully human |
| **Tuned (customers 6+)** | 20 min | $16.67 | QA only, against a checklist |
| **Delegated (target)** | 0 min | $6.67 | Contractor QA at $20/hr × 20 min |

Machine cost per meeting: **$1–2** [ESTIMATE: a 90-minute meeting is roughly 60–90 minutes of audio;
transcription plus generation at current API rates]. Audio extraction is $0 — `server.js` already
does it.

| Stage | Price | Cost | Gross margin |
|---|---|---|---|
| Manual | $79 | $76.50 | **3%** |
| Scripted | $79 | $39.00 | **51%** |
| Tuned | $79 | $18.17 | **77%** |
| Delegated | $79 | $8.17 | **90%** |

**The finding that matters: at 90 minutes of manual work, this business has no margin.** That is
correct and expected — the first deliveries buy learning, not profit. But it makes the automation
rung a requirement, not an optimization. **If manual delivery cannot get below 45 minutes by customer
three, the price is wrong at $79 and must rise to $120–150, or the business does not work.**

This is written down now so that it is a decision later, not a surprise.

## Customer economics

| Metric | Value | Basis |
|---|---|---|
| Meetings per customer/month | 16 | [ESTIMATE: 15–75 associations, monthly cadence, mid-range firm] |
| Revenue per customer/month | $1,250 | 16 × $79 |
| Gross margin at tuned stage | ~$960/mo | 77% |
| CAC | ~$390 | [ESTIMATE: 78 prospects per customer × 6 min/touch = 7.8 hrs × $50] |
| Payback | **~0.4 months** | CAC ÷ monthly gross margin |
| LTV at 24 months | ~$23,000 | Gross margin × expected retention |

**CAC is paid in founder hours, not dollars** — which makes it feel free. It is not. 7.8 hours per
customer is the real price, and it is the reason the prospect list is qualified before anyone is
contacted.

Payback under half a month is exceptional and is the strongest argument for this business. It exists
because acquisition costs time rather than cash, and because there is no infrastructure to amortize.

## Three cases

**Base** — 8% reply, 40% close, 16 meetings/customer, 5% monthly churn
→ 8 customers, **$10,000 MRR at ~16 weeks**, ~77% margin at the tuned stage.

**Downside** — 4% reply, 20% close, 10 meetings/customer, 20% monthly churn
→ 2,500 prospects needed for 8 customers; at 40 touches/week that is **62 weeks**, and 20% churn
means roughly one customer lost per month against roughly one won. **This case never reaches $10K.**
It is escaped by raising price and narrowing the niche, never by sending more email — the founder's
hours are capped and volume is the one lever that is not available.

**Upside** — referrals carry half the pipeline from customer three onward, expansion offers lift
revenue per customer to $1,800
→ 6 customers reach $10,000, in roughly 11 weeks.

## What has to be true

Ranked by how much damage each does if false:

1. **Boards will record meetings.** If they will not, nothing else matters. Tested in week 1.
2. **Delivery gets to 45 minutes by customer three.** Otherwise margin never exists at $79.
3. **Reply rate is ≥5%.** Below that, the founder's hours cannot produce enough conversations.
4. **Churn is under 10%/month.** Above it, we are refilling a bucket rather than building one.
5. **Firms average 15+ meetings/month.** Below that, deal size collapses and the customer count doubles.

Items 1 and 3 read out from E-001. Item 2 reads out from the first delivery. Items 4 and 5 need real
customers and cannot be known yet — and are labeled `[ASSUMPTION]` accordingly rather than modeled
as if known.

## Capital

$100 starting, $0 spent, $100 remaining. Nothing in Phase 1 costs money. The first likely expense is
a domain, and only once a customer has asked for a link twice — it queues in `APPROVALS.md` and waits.
