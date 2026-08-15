# Fulfillment Runbook — Recording to Delivered Minutes

The working method. A human executes this today; `tools/minutes.js` implements it later, once five
manual runs have shown where the time actually goes.

**This is the manual rung of the automation ladder** (`../OPERATIONS.md`), not a shortcut past it.
`DECISION_LOG.md` D-003 still bars product code, and this does not breach it — it is the process
written down so the first delivery is measurable instead of improvised.

**Read first:** `../product/minutes-template.md` · `../research/state-minutes-requirements.md` ·
`../sops/SOP-001-minutes-delivery.md`

---

## Timing log — fill this in on every delivery

**This table is the single most valuable output of the first ten deliveries**, more than the minutes
themselves. It is the instrument for experiment E-003 and it decides whether this business has a
margin. An untimed delivery is a wasted delivery.

| Step | Budget | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|
| 1. Intake and setup | 5 min | | | |
| 2. Audio extraction | 2 min | | | |
| 3. Transcription | 10 min | | | |
| 4. Skeleton pass | 10 min | | | |
| 5. Motion extraction | 20 min | | | |
| 6. Draft assembly | 20 min | | | |
| 7. State compliance check | 5 min | | | |
| 8. QA checklist | 15 min | | | |
| 9. Send and log | 3 min | | | |
| **Total** | **90 min** | | | |

Record actuals in `../data/customers.json`. At customer three the total must be under 45 minutes or
the price rises to $120–150 — that trigger is written into `../analytics/unit-economics.md` and is a
decision, not a discussion.

---

## Step 1 — Intake and setup

Confirm present before starting anything: recording, association name, meeting date, **the
association's template or prior approved minutes**, executive session instruction in writing, signed
NDA. Log the arrival time — the 48-hour clock starts now.

**Do not start without the template.** Correct content in the wrong format reads as generic and does
not convert a pilot.

## Step 2 — Audio extraction

If the file is video, use the existing `/extract-audio` endpoint in `server.js` — already built,
$0, no new infrastructure. Audio files pass straight through.

## Step 3 — Transcription

Produce a timestamped transcript with speaker separation where the audio allows.

**Rule that overrides everything else here: never resolve an ambiguity by guessing.** An inaudible
dollar amount, an unclear seconder, a name that could be two people — each gets a timestamp and a
flag. Flagging a gap builds more trust than filling it, and a fabricated motion is the one defect
this business cannot survive.

## Step 4 — Skeleton pass

Locate and mark: call to order, attendance and quorum, approval of prior minutes, each agenda item
in order, every motion, executive session boundaries, adjournment. Match the association's agenda
headings, not generic ones.

## Step 5 — Motion extraction

The highest-value and highest-risk step. For each motion capture: exact wording, mover, seconder,
vote count, and outcome.

- Dollar amounts, vendor names, dates — **transcribed, never inferred**
- **Failed motions are captured** with the same care as passed ones
- Vote counts must reconcile against directors present; if they do not, flag rather than balance
- Never smooth informal phrasing into something more official-sounding than what was said

## Step 6 — Draft assembly

Assemble to `../product/minutes-template.md` in the association's format. Decisions, not discussion.
Reports get presenter and topic. Extract action items into the separate table with an owner and a
date on each.

## Step 7 — State compliance check

Against `../research/state-minutes-requirements.md`:

- **Nevada** — executive session section present, action noted without confidential detail; produce
  the separate **summary of the minutes** the statute appears to require
- **Colorado** — if an executive session was held, minutes state that it occurred **and its general
  subject matter**
- **Florida / Arizona** — quorum, motions, votes, action items all present; Arizona notes approved
  expenditures
- **Georgia / North Carolina** — check against the association's **bylaws**, not the statute

## Step 8 — QA checklist

Run the full checklist in `../sops/SOP-001-minutes-delivery.md`. Every item, every time.

**A human reads the entire document start to finish before it leaves.** This rule survives all
future automation. We do not send a customer something no person has read.

## Step 9 — Send and log

Send with a short covering note naming every flagged uncertainty:
*"I couldn't make out the seconder on the landscaping motion — can you confirm?"*

Log delivery time, per-step actuals, and any flags in `../data/customers.json`.

**On approval, delete the audio and confirm deletion in writing.**

---

## Automation order — and what is never automated

Steps become code only after five manual runs prove where the time goes.

1. **Transcription** (step 3) — most mechanical, automate first
2. **Draft assembly** (step 6) — after five deliveries reveal the common structure
3. **Motion extraction** (step 5) — highest value, highest risk; automate last, and the human check
   over it is never removed

**Never automated:** the final read-through, and the decision to flag an uncertainty rather than
resolve it. Those two are the product.

## Escalate to the founder

Any legal question from a board · any request to change what the minutes say happened · executive
session audio received in error · any accuracy dispute · any request to certify or attest the record.

**We produce a document. We do not certify it.**
