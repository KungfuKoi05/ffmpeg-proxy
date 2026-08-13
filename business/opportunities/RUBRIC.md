# Opportunity Scoring Rubric v1.0

Every opportunity is scored 0–100. Each factor is scored `0.0`–`1.0` and multiplied by its weight.
**Every factor score carries an evidence tag.** A score without evidence is not a score.

| # | Factor | Weight | 1.0 looks like | 0.0 looks like |
|---|---|---|---|---|
| 1 | **Pain intensity** | 15 | Someone is paid a salary to do this manually, and complains about it publicly | Mild inconvenience nobody has tried to solve |
| 2 | **Recurrence** | 10 | Happens weekly or monthly, forever | One-off, project-based, unpredictable |
| 3 | **Proven willingness to pay** | 15 | Competitors publish prices and have customers; agencies sell it today | No one currently pays for any version of this |
| 4 | **Deal size** | 10 | $10K/mo reachable with ≤20 customers | Needs 200+ customers at consumer prices |
| 5 | **Buyer reachability** | 10 | Public directory or licensing registry lists thousands of them, with contact paths | Buyer hides behind procurement, or needs a paid database |
| 6 | **AI automation potential** | 10 | 80%+ of the work is language, extraction, or document assembly | Needs physical presence, or judgment we cannot QA |
| 7 | **Speed to first dollar** | 10 | Could be sold and delivered manually within 30 days | Months of build before anyone can buy |
| 8 | **$0 startup feasibility** | 5 | Deliverable with free tiers and the founder's existing accounts | Needs paid data, paid infra, or inventory |
| 9 | **Competitive whitespace** | 10 | Incumbents are expensive, enterprise-focused, or badly reviewed | Well-funded competitor owns exactly this wedge for this buyer |
| 10 | **Low regulatory risk** | 5 | No license, no protected data | Requires credentials, HIPAA, or handling of regulated records |

**Total: 100**

## Kill threshold

**Below 60 → killed.** Not parked, not "revisit later." Killed, with the reason logged.

## Automatic disqualifiers

An opportunity is killed outright, regardless of score, if it:

- Requires a professional license or credential the founder does not hold
- Requires more than $100 to reach the first dollar of revenue
- Requires write-integration into a system we cannot access (a customer's ERP, EHR, or accounting platform)
- Requires a paid lead database to find buyers
- Produces work the founder cannot quality-check inside 6–10 hrs/week
- Depends on a viral audience, a large ad budget, or a channel we cannot run at $0

## The integrity cap

If more than **40%** of an opportunity's earned points come from `[ASSUMPTION]`, its total is
capped at **70** and it is flagged `research-needed`.

This exists because the most dangerous opportunity is not the badly-scored one — it is the one that
scores 92 on ten confident guesses. The cap forces research to precede enthusiasm.

## Evidence tags

| Tag | Meaning | Required payload |
|---|---|---|
| `FACT` | Externally verifiable | A URL |
| `ESTIMATE` | Derived from stated inputs | The derivation |
| `ASSUMPTION` | Believed, unverified | Nothing — but it counts against the cap |
| `EXPERIMENT` | Measured by us | An experiment ID from `EXPERIMENT_LOG.md` |

`node tools/validate.js` fails the build if a `[FACT]` has no URL.
