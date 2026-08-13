# Master Plan

**Company:** Board-ready HOA meeting minutes, delivered as a service to community association
management companies.
**Stage:** Validation — pre-revenue, pre-build.
**Autonomy:** Level 2. **Capital:** $100 intact, $0 authorized until first revenue.
**Last updated:** 2026-08-13

---

## The business in one paragraph

Community association management companies run board meetings for the HOAs they manage. Minutes are a
statutory record, so they must be written, accurately, every time. Today a portfolio manager writes
them after hours, days later, from notes — for 8–12 associations each. We take the meeting recording
and return finished, board-ready minutes within 48 hours: attendance, motions, seconds, votes, and an
action-item list, formatted to the association's template. We charge per meeting. The management
company keeps its managers doing work that actually requires a manager.

## Current bottleneck

**No validated demand.** Every conversion number in this workspace is `[ASSUMPTION]`. The single
gating action is A-001: the founder sending the first 40 emails. Nothing downstream can be measured
until real messages reach real people, and no product should be built before they do.

## The $10,000/month ladder

Pricing: **$79/meeting** standard, **$70/meeting** on the 25+/month portfolio plan, first two
meetings free.

| Rung | MRR | Customers | Meetings/mo | How it is reached | Founder hrs/wk |
|---|---|---|---|---|---|
| **$0 → $1K** | $1,000 | 1 | ~13 | 80 hand-sent emails → ~6 replies → ~3 free samples → 1 close. Fully manual delivery, timed at every step. | 8 (mostly outreach) |
| **$1K → $3K** | $3,000 | 2–3 | ~40 | Another 160 sends plus the first referral. Transcription and template assembly scripted; QA still 100% human. | 8–10 |
| **$3K → $5K** | $5,000 | 4–5 | ~65 | Referrals now outperform cold. Add-on offers (action-item tracking, violation letters) raise revenue per customer without new logos. | 8–10 |
| **$5K → $10K** | $10,000 | 7–9 | ~130 | Requires the QA step to drop to ~20 min/meeting **or** a part-time contractor doing QA at ~$20/hr. This is a hard gate, not a hope. | 5–8 |

**The honest constraint:** 130 meetings a month at 90 manual minutes each is 195 hours — impossible.
The ladder only reaches $10K if per-meeting QA falls to roughly 20 minutes, or a contractor absorbs
it. Both paths are funded by revenue that exists by then; neither requires capital now. This is
stated up front because a plan whose top rung is arithmetically impossible is not a plan.

## Acquisition model

At assumed rates — 8% reply, 50% to conversation, 80% to proposal, 40% close — **625 prospects
produce 8 customers in about 16 weeks** at 40 hand-sent touches per week. Full derivation and
sensitivity: `analytics/acquisition-model.md`. Every one of those rates is a guess until E-001 reads out.

## Validation gate

**No product code ships until:** ≥1 booked conversation per 10 prospects contacted, **or** one paid
engagement. Until then the Builder writes specs only. Gate status: **not passed.**

## Agent assignments

| Agent | Current work | Output |
|---|---|---|
| CEO | Selection complete; monitoring E-001 kill criteria | `DECISION_LOG.md` |
| Scout | Research complete; on call to verify prospects and re-score if E-001 fails | `MARKET_RESEARCH.md` |
| Growth | Offer, sequence, scripts, 40-row prospect list — **hand-off ready** | `GROWTH.md`, `sales/`, `customers/leads.csv` |
| Builder | MVP spec only, gate not passed | `PRODUCT.md` |
| Ops | Fulfillment SOP + QA checklist, sized to 90 minutes | `sops/` |
| CFO | Unit economics and the $10K model | `analytics/` |

## Next five actions

1. **[FOUNDER]** Send batch 1 — 40 emails from `customers/leads.csv` using `sales/sequence.md` (~90 min)
2. **[FOUNDER]** Log replies in `data/pipeline.json`, then run `node tools/kpi.js`
3. **[FOUNDER]** Deliver the first free sample; time every step against the 90-minute budget
4. **[Growth]** Rewrite the message from real reply data, not from theory
5. **[CEO]** Read out E-001 against its pre-set criteria and either continue or promote OPP-01

## Fallback

If E-001 fails its criteria, the next business is **OPP-01, certified payroll / prevailing wage
reporting** (scored 81.5, managed-tier pricing $1,000–5,000/mo already validated). It is researched
and ready — no restart required.
