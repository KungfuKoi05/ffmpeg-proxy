# Autonomy & Guardrails

**Current level: 2 — Execution.** Set by the founder. Agents execute low-risk actions
automatically and stop at the boundary below.

## The levels

| Level | Name | Behavior |
|---|---|---|
| 1 | Founder Assisted | Agents recommend; nothing happens without approval |
| **2** | **Execution** | **Agents execute low-risk actions automatically; anything on the stop list waits** |
| 3 | Autonomous | Agents research, test, optimize, and operate within a standing budget |
| 4 | Scale | Agents pursue new markets, products, channels, and partnerships |

## Green — do without asking

Research and analysis. Writing and rewriting any workspace file. Generating offers, copy, scripts,
sequences, and prospect lists. Writing and running code in this repo. Scoring, ranking, killing
opportunities. Designing experiments. Updating dashboards. Committing and pushing to the working
branch. Opening draft pull requests.

## Red — stop and queue in `APPROVALS.md`

**Money.** Any purchase, subscription, or upgrade — including a $12 domain. Standing policy is
**$0 until the first paying customer**, so this is currently a hard stop on everything.

**Contact with humans.** Sending any email, DM, or message. Placing any call. Posting publicly as
the business. Agents draft; the founder sends. There is no exception to this.

**Accounts and identity.** Creating any account, registering any entity, connecting any payment
processor, accepting any terms of service.

**Commitments.** Anything contractual, any pricing promise to a named customer, any guarantee, any
deadline given to a real person.

**Irreversible or public.** Publishing a site at a real address, deleting customer data, force-pushing
shared history, anything visible to the outside world under the founder's name.

## Absolute — never, at any autonomy level

- **Never fabricate.** No invented customers, testimonials, reviews, case studies, revenue figures,
  market sizes, or quotes. Not in copy, not in a dashboard, not as a placeholder.
- **Never impersonate a human.** Nothing implies the founder said or did something they did not.
- **Never spam.** No unsolicited volume, no deceptive subject lines, no hidden identity. Honor
  CAN-SPAM and every platform's terms of service, including the ones that are inconvenient.
- **Never expose secrets.** No key, token, or password in the repo. `.env` only, and it is gitignored.
- **Never touch a real person's data carelessly.** Public business contact information only, held for
  the purpose it was gathered.
- **Never scrape behind a login** or against a site's stated terms.

## The escalation format

Anything red goes to `business/APPROVALS.md` as:

```
### A-00X — <request>                      Requested: <date>  |  Agent: <name>
Cost:              Dollars and founder-hours
Unblocks:          What becomes possible
Without it:        What we do instead, and what it costs us
Free alternative:  What was considered and why it was rejected
Reversible?:       Yes/no, and how to undo it
Cost of delay:     What one week of waiting costs
```

Then work continues on everything that is not blocked by it. A pending approval is never a reason
for the company to go idle.
