# Business model

**Owner:** Atlas

## What we sell

Follow-up as a service for high-ticket residential trades, with an auditable
report of what it recovered. Not software they operate — a service we operate,
increasingly software-driven.

## Who we sell to

Roofing, HVAC replacement, and remodeling contractors doing **$50k–$500k/month**
with an average job over **$5,000**, where the owner or an office manager is the
one doing follow-up (badly, and they know it). See `research/niche-analysis.md`.

## Why they buy

One recovered roof or system replacement is $8,000–$14,000. Our fee is $1,500.
The arithmetic does the selling — provided the number is credible, which is why
attribution is conservative by design.

## Pricing

| Tier | Price | Contents |
|---|---|---|
| Recovery | $750/mo | Missed call + new lead response, dashboard, ROI report, ≤150 leads |
| **Recovery + Estimates** | **$1,500/mo** | **+ unsold estimate follow-up, reminders, review requests, ≤400 leads** |
| Full pipeline | $2,500/mo | + reactivation campaigns, multi-location, integrations |

Flat monthly. No setup fee, no per-message billing, no annual lock-in. Carrier
message costs passed through at cost.

**Pricing is a hypothesis, not a decision.** It is anchored on value (one
recovered job) rather than cost (~$3/client/month), and on being clearly above
the $29–$479 commodity band so we are not compared to a missed-call texter.
It changes when 20 sales conversations say it should.

### Why not charge on performance

Tempting — "10% of recovered revenue" aligns perfectly. Rejected for now:

- Requires trusting our attribution before we have any track record. Backwards.
- Unpredictable revenue makes the business unplannable at this size.
- Invites arguments about every marginal job.

Revisit once we have three clients with six months of clean attribution data.

## Path to $10k MRR

| Mix | Clients | MRR |
|---|---|---|
| 7 × $1,500 | 7 | $10,500 |
| 5 × $2,000 | 5 | $10,000 |
| 4 × $1,500 + 2 × $2,500 | 6 | $11,000 |

**Seven customers.** That is the whole target. It is a small number of
conversations, which is what makes 120 days plausible — and it means every
single client relationship matters enormously.

## Unit economics

| Line | Amount | Note |
|---|---|---|
| Revenue per client | $1,500/mo | Growth tier |
| Twilio number | ~$1.15/mo | |
| SMS (≈400 segments) | ~$3.20/mo | at $0.0079/segment |
| AI classification | $0 | rule-based default; ~$0.50/mo if Anthropic enabled |
| Hosting (shared) | ~$1/mo | one $5 VPS across all clients |
| **Direct cost** | **≈$5/mo** | |
| **Gross margin** | **>99%** | |

The real cost is **founder time**, not infrastructure.

| Phase | Hours/client/month |
|---|---|
| First client (manual) | 8–12 |
| After onboarding automation | 3–4 |
| Target by client 7 | **<2** |

At 2–3 hours/day, seven clients at 2 hours each is ~14 hours/month of delivery,
leaving the rest for sales. **This is the constraint that decides whether the
business works** — not infrastructure cost, not features.

## Costs to actually start

| Item | Cost | When |
|---|---|---|
| Domain | ~$12/yr | now |
| Hosting | $0–5/mo | at first client |
| Twilio number | ~$1.15/mo | at first LIVE client |
| Everything else | $0 | |

**Under $30 to get to first revenue.** Against ~$100 of capital, the constraint
is time, not money — so spend money to save time wherever the trade is available,
and don't spend it on anything else.

## Why attribution is deliberately conservative

The commercial argument, not the ethical one (though both point the same way):

A client who catches us over-claiming once discounts **everything** we report
forever, and churns. A client who notices we *declined* to claim a job they
thought was ours trusts every number we produce. In a business that lives or
dies on seven relationships, the second is worth vastly more than the inflated
number.

So the report shows attributed and unattributed jobs side by side, with the
reason for each. It is a trust-building artefact disguised as a metrics report.

## Kill criteria

Atlas recommends a pivot if, after 40 qualified conversations:

- <15% take a free audit → message or premise is wrong
- <3 audits convert → value isn't believed
- Owners already follow up systematically → premise is wrong
- CAC > $1,500 with no path down
- Delivery time per client stays above 6 hours/month → doesn't scale to 7

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Commodity vendors add estimate follow-up | high | move faster; own the attribution report, which they have no reason to build |
| Field-service platforms (ServiceTitan, Jobber) bundle it | high | serve contractors too small for those platforms |
| Attribution disputed by a client | medium | evidence trail per job; conservative rule |
| SMS deliverability / 10DLC | medium | register early; email fallback in every sequence |
| Founder time cap at ~7 clients | **certain** | automation is a revenue requirement, not polish |
| Seasonality (roofing/HVAC) | medium | mix trades; reactivation campaigns fill troughs |
