# SOP-001 — Minutes Delivery

**Trigger:** a customer sends a board meeting recording
**Owner:** Founder (stages 1–2) → Contractor (stage 4)
**Time budget:** 90 min manual · 45 min scripted · **20 min tuned (target)**
**Actual measured:** _not yet measured — fill this in after the first delivery_

---

## Inputs required before starting

- [ ] Audio or video recording of the meeting
- [ ] The association's name and the meeting date
- [ ] The association's minutes template, or a prior set of approved minutes to match
- [ ] The agenda, if one exists — it makes everything downstream faster
- [ ] Signed NDA on file for this customer
- [ ] Confirmation of whether executive session is included or excluded

**Do not start without the template.** Producing correctly-formatted minutes on the first attempt is
what makes the free sample convert; a technically accurate document in the wrong format reads as
generic and does not.

## Steps

1. **Log receipt** — record the arrival time in `data/customers.json`. The 48-hour clock starts now.
2. **Extract audio** — if given video, use the existing `/extract-audio` endpoint in `server.js`.
   Costs nothing and is already built.
3. **Transcribe** — produce a timestamped transcript with speaker separation where possible.
4. **Identify the skeleton** — call to order, attendance and quorum, approval of prior minutes, each
   agenda item, each motion, adjournment.
5. **Draft the minutes** to the association's template. Record **decisions, not discussion.** Discussion
   is included only where a motion turned on it.
6. **Extract action items** into a separate list: what, who owns it, by when.
7. **Run the quality checklist** below. Every item, every time.
8. **Send** with a short note naming anything uncertain: *"I couldn't make out the seconder on the
   landscaping motion — can you confirm?"* Flagging a gap builds more trust than guessing.
9. **Log delivery** — time taken per step, in `data/customers.json`. **This is how the 90 minutes
   becomes 20.** Skipping it means never finding the bottleneck.
10. **On approval, delete the audio.** Confirm deletion to the customer in writing.

## Quality checklist — nothing leaves without this

- [ ] Every name spelled correctly, checked against the prior minutes or the association roster
- [ ] Attendance and quorum stated explicitly
- [ ] Every motion: exact wording, who moved, who seconded, and the vote count
- [ ] Vote counts add up to the number of directors present
- [ ] Dollar amounts, dates, and vendor names verified against the audio — **never inferred**
- [ ] Executive session handled per the customer's instruction
- [ ] No discussion content included that no motion turned on
- [ ] Action items each have an owner and a date
- [ ] Formatting matches the template exactly — headings, order, numbering
- [ ] Uncertainties flagged in the covering note rather than guessed
- [ ] A human has read the whole document start to finish

**The last item is not negotiable.** We never send a customer something no person has read.

## Failure modes

| Failure | Response |
|---|---|
| Audio inaudible in places | Flag the timestamp and ask. Never fabricate what was said |
| Speakers unidentifiable | Use roles ("a director moved") and ask the customer to confirm |
| Motion wording unclear | Quote what was audible verbatim and flag it |
| Recording includes executive session when it should not | Stop. Do not transcribe it. Tell the customer immediately |
| Delivery will miss 48 hours | Tell them **before** the deadline, not after. A known delay is forgivable; a silent one is not |
| Customer disputes accuracy | Correct it same-day, do not invoice for that meeting, log it in `operations/defects.md` |

## Automation candidates, in order

1. **Transcription** — script first, it is the most mechanical step. *Not yet automated because it has not been done manually enough times to know what breaks.*
2. **Template assembly** — after five deliveries have revealed the common structure.
3. **Motion and vote extraction** — the highest-value and highest-risk step. Automate last, and never remove the human check.
4. **Never automate:** the final read-through, and the decision to flag an uncertainty.

## Escalate to the founder

Any legal question from a board. Any request to change what the minutes say about what happened. Any
executive session content received in error. Any accuracy dispute. Any request to certify or attest
to the record — **we produce a document, we do not certify it.**
