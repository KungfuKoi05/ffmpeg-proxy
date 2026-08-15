# SOP-002 — Customer Onboarding

**Trigger:** a prospect agrees to the free pilot
**Owner:** Founder
**Time budget:** 30 minutes, one time
**Actual measured:** _not yet measured_

Onboarding is where retention is won. The first delivery must land fast and be visibly better than
what they did before — that is the moment a pilot becomes a subscription.

## Inputs

- [ ] Company name, owner name, reply address
- [ ] Number of associations and meetings per month
- [ ] The association template or a prior set of approved minutes
- [ ] Preferred delivery format (Word, Google Doc, PDF)
- [ ] Executive session instruction, in writing
- [ ] NDA signed

## Steps

1. **Confirm in writing** what they will send, what comes back, and when. One short email, no contract.
2. **Collect the template.** If they have none, offer ours and let them adjust it — this quietly makes
   us the standard for their portfolio.
3. **Get the executive session instruction in writing.** Never assume.
4. **Send the NDA** before the first recording arrives.
5. **Create the customer record** in `data/customers.json`: name, meetings/month, template location,
   preferences, start date.
6. **Deliver the first set in 24 hours, not 48.** Beat the promise once, deliberately.
7. **Ask for feedback within 48 hours of delivery**: *"Anything you'd change in how this is
   formatted?"* Every answer improves the template for every future customer.
8. **After the second free set, ask for the business** using the conversion language in `sales/script.md`.

## Quality checks

- [ ] They know exactly what to send and where
- [ ] The template is on file and has been read before the first delivery
- [ ] Executive session handling is documented in writing
- [ ] NDA is signed and stored
- [ ] The first delivery beat the promised turnaround

## Failure modes

| Failure | Response |
|---|---|
| No recording arrives within 10 days | One friendly nudge. If a board has not agreed to record, that is the real blocker — go help solve it |
| They cannot find a template | Send ours. Do not let this stall the pilot |
| First delivery came back with heavy edits | Good — that is the template being calibrated. Update it and say thank you |
| They go quiet after the free two | One direct ask, then mark `nurture`. Do not chase repeatedly |

## Churn signals to watch from day one

Recordings arriving later each month · replies getting shorter · a new manager appearing in the
thread · an invoice unpaid past 15 days · two consecutive deliveries with heavy edits.

Any one of these gets flagged in `customers/` with a proposed intervention **before** the
cancellation email arrives, not after.
