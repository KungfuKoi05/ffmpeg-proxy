# Taking a customer live

## Before the call
- Deployment is green: `/api/health` reports `healthy`.
- You have a spare Twilio number to assign them.

## 1. Account (5 min, them)
They sign up at `/signup`, then complete `/onboarding`:
business name, escalation phone, services and average job values, hours, service
area, emergency rules, FAQs, appointment length, and the Twilio number you
assigned.

**Activation is gated.** The wizard will not activate until name, escalation
phone, at least one service with a value, service area and a connected number
are all present. A half-configured assistant cannot go live.

## 2. Subscribe (2 min, them)
`/billing` → choose a plan → Stripe Checkout. Confirm the subscription shows
`active` on return. If it does not, check the Stripe webhook log — that is the
only writer of subscription state.

## 3. Wire the phone (10 min, you)
Configure the number's four webhooks per DEPLOYMENT.md, then have them forward
their existing business line to it — on no-answer and busy at minimum. Their
published number never changes.

## 4. End-to-end test (10 min, together) — do not skip
Call the number and run this script:

1. "My AC isn't cooling and it's 85 degrees inside."
2. Answer the assistant's follow-up.
3. Give a name and address.
4. Accept an offered appointment time.

Then confirm, in the dashboard:
- a lead exists with the right service and urgency
- an appointment exists at the time offered
- a confirmation SMS arrived on the caller's phone
- the conversation transcript reads correctly
- AI activity lists the tool calls
- estimated revenue reflects their configured job value

Then test the escalation path: call back and ask "how much does a new system
cost?" The assistant must **not** quote a price. It should capture details and
escalate, and the owner should receive an SMS.

**If either test fails, do not leave the forwarding in place.**

## 5. First week
- Day 1: check `/conversations` for anything Sentinel marked `NEEDS_HUMAN` or
  `RISK`. Every one is either a real gap in their FAQs or a prompt problem.
- Day 3: add FAQs for the questions the assistant escalated.
- Day 7: review estimated vs actual revenue with them, and ask them to start
  entering actual values on completed jobs — that is what makes the ROI real
  rather than projected.

## Things to say plainly
- Estimated revenue is a projection from their own average job values, not money
  received.
- The assistant will never quote a price. That is deliberate.
- It escalates when unsure, so they will get some calls a human could have
  handled. That is the correct failure direction.
