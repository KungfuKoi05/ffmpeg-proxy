# Approvals Queue

Everything on the red list in `AUTONOMY.md` waits here. Work continues on everything else —
a pending approval never idles the company.

**Standing policy:** $0 spend authorized until the first paying customer. The $100 stays intact.

## Pending

### A-001 — Founder action: collect 20 addresses, then send batch 1
**Requested:** 2026-08-13 | **Agent:** Growth | **Cost:** $0, ~30 min + ~30 min

All 20 emails are written and personalized in `business/sales/batch-1.md`. Two steps remain, both
requiring a human:

**Step 1 — collect (~30 min).** Work down `business/customers/batch-1-addresses.csv` with each
company's site open; fill in owner name, email, and the five detail slots marked `NEEDS`. The agents
cannot do this: outbound access to every company domain is blocked by the network egress proxy, so
addresses cannot be retrieved from this environment at all. Verified against four domains.

**Step 2 — send (~30 min, spread over 3 days).** 7 / 7 / 6 per the schedule in `batch-1.md`. The
Gmail connector offered `create_draft` but never a send tool, and has since disconnected — so even
with it reauthorized, a human still presses send.

- **Unblocks:** every measured conversion rate in the company; experiments E-001 and E-002; the
  decision to build or kill
- **Without it:** the funnel stays 100% `[ASSUMPTION]` and no product should be built
- **Free alternative:** none — this genuinely requires a human
- **Reversible?:** Yes. Outreach can stop at any time; nothing is committed by a first email
- **Cost of delay:** one week of delay is one week added to every milestone after it

**Set once before sending:** `[Your name]`, `[phone]`, and `[postal address]` in the signature.
The postal address and opt-out line are CAN-SPAM requirements, not decoration.

---

## Approved

_None yet._

## Rejected

_None yet._
