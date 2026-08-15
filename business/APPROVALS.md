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

### A-002 — Founder action: publish the landing page
**Requested:** 2026-08-15 | **Agent:** Builder | **Cost:** $0, ~5 minutes

`site/index.html` is built and committed but **not published**. Enabling GitHub Pages requires the
repo settings, which is a founder action. Free subdomain — no domain purchase, so the $100 stays intact.

Before publishing, fill the footer placeholders: `[Business name]`, `[postal address]`, `[phone]`.
The page currently carries no fabricated proof of any kind and must stay that way — no testimonials,
logos, or customer counts until they are real and permission has been given to name them.

- **Unblocks:** a link to include when a prospect asks who we are
- **Without it:** the sample document is still the stronger proof; nothing is actually blocked
- **Reversible?:** Yes, entirely — Pages can be disabled at any time
- **Cost of delay:** minimal until replies start arriving

### A-003 — Founder action: verify NRS 116.31083 before using the Nevada claim
**Requested:** 2026-08-15 | **Agent:** Scout | **Cost:** $0, ~5 minutes | **Priority: do this first**

The touch-3 Nevada line states that board meetings must be audio recorded under NRS 116. If true it
removes the largest risk in the business (D-006). It is **search-sourced only** — Justia, the Nevada
Legislature, and every other primary source are blocked by this environment's egress proxy.

Read the statute: https://law.justia.com/codes/nevada/chapter-116/statute-116-31083/

- **Confirms →** un-hedge the line, rebuild the prospect list Nevada-first, promote D-006 to active
- **Does not confirm →** delete the Nevada line from touch 3 entirely. **Do not soften it and send.**
- **Cost of delay:** three Nevada prospects sit at the top of the send order; touch 3 lands day 8

---

## Approved

_None yet._

## Rejected

_None yet._
