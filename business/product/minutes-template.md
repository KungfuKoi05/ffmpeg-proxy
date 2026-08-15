# Minutes Template — The Deliverable

**This is the product.** Everything else in this repo exists to sell it or to produce it faster.

Governing principle, from `../research/state-minutes-requirements.md`:
**minutes record decisions, not discussion.** When in doubt, cut. A short accurate record beats a
long one every time, and a transcript is a defect, not a bonus.

---

## Structure

```
[ASSOCIATION NAME]
Board of Directors Meeting — Minutes
[Day, Month DD, YYYY] · [Location or "Held via [platform]"]

CALL TO ORDER
The meeting was called to order at [time] by [name], [title].

ATTENDANCE
Directors present:  [names and titles]
Directors absent:   [names]
Also present:       [manager, counsel, guests — role stated]
A quorum was [present / not present].

APPROVAL OF PRIOR MINUTES
The minutes of the [date] meeting were presented.
MOTION: [name] moved to approve the minutes of [date] [as presented / as amended: describe].
Seconded by [name]. Motion [carried / failed] [vote count].

[AGENDA ITEM — use the association's own agenda headings and order]
[One or two sentences of context, only where a motion cannot be understood without it.]
MOTION: [name] moved that [exact wording of the motion, including dollar amounts,
vendor names, and dates].
Seconded by [name]. Motion [carried / failed] by a vote of [X in favor, Y opposed,
Z abstaining].

REPORTS
[Title] Report — presented by [name]. [Topic only. No summary.]

EXECUTIVE SESSION
[See the state-specific rules below — this section's wording is not optional in CO or NV.]

ADJOURNMENT
There being no further business, the meeting adjourned at [time].

Minutes prepared by [preparer]. Submitted for board approval on [date].

────────────────────────────────────────────────────────────────
ACTION ITEMS
| # | Action | Owner | Due |
```

The action-item table is a **separate section, always**. It is frequently the part a manager
actually uses day to day, and pulling it out of the narrative is a large part of the perceived value.

---

## Rules that produce a correct record

**Motions get exact wording.** Not "the board approved the landscaping bid" but "moved to approve
the proposal from [vendor] for [scope] in the amount of $[X], to commence [date]." Dollar figures,
vendor names, and dates are transcribed from the audio, **never inferred**. If a number is
inaudible, it is flagged, not guessed.

**Failed motions stay in.** They are evidence the board considered and rejected something — often the
most legally useful line in the document.

**Vote counts must reconcile.** In favor + opposed + abstaining must equal directors present. If it
does not, something was misheard; flag it rather than balancing it by assumption.

**Reports get a presenter and a topic.** Not a summary. "Treasurer's Report — presented by [name]"
is a complete entry.

**Discussion is included only where a motion is unintelligible without it.** One or two sentences,
neutral, attributed to no one. Never "Mr. [name] argued forcefully that…"

**Names are checked against the prior minutes or the roster**, never spelled phonetically from audio.

**Nothing is characterized.** No "heated," "lengthy," "contentious," "productive." The record states
what was decided.

---

## State-specific requirements

Full detail and sources in `../research/state-minutes-requirements.md`.
**All of it awaits primary-source verification** — see the warning at the top of that file.

| State | What changes in this template |
|---|---|
| **Nevada** | Executive session section is **mandatory** — note the action taken without the confidential detail. Executive session itself must not be recorded. A **separate summary of the minutes** is also required, and is produced as a second deliverable. Retention is effectively permanent. |
| **Colorado** | If an executive session was held, the minutes **must** state that it was held **and its general subject matter**. Model wording: *"At 8:15 p.m. the board went into executive session to discuss a covenant enforcement lawsuit with the Association's attorney."* |
| **Florida** | Capture quorum, motions, votes, action items. Official record, 7-year retention, produced within 10 business days on request. |
| **Arizona** | As Florida, plus explicitly note **approved expenditures**. |
| **Georgia / North Carolina** | Statutes are permissive; **the association's bylaws are the specification.** Ask for them at onboarding — this is the intake question that matters most for these two states. |

---

## Executive session handling

The most sensitive part of the job. Boards discuss delinquencies, litigation, and personnel there.

1. **Confirm the customer's instruction in writing at onboarding** (SOP-002) — included or excluded.
2. **If audio of an executive session arrives when it should not have,** stop, do not transcribe it,
   and tell the customer immediately. In Nevada, recording executive session appears to be
   prohibited outright.
3. **If included,** record only what the state requires: that it occurred, its general subject
   matter, and any action taken. Never the substance of the discussion.

---

## Per-association customization

Each customer's associations get a file at `templates/<association-slug>.md` capturing their
headings, their agenda order, their numbering, and their preferred phrasing.

**This is the retention mechanism.** After six months across a customer's portfolio, we hold fifty
associations' formats and a competitor holds none. Switching means retraining someone on all fifty.
The moat is accumulated context, not a contract.
