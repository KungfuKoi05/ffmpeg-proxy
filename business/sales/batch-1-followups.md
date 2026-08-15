# Batch 1 — Follow-Up Touches 2 through 5

Touch 1 is in `batch-1.md`. These are the remaining four, on the **day 3 / 7 / 12 / 18** schedule
counted from each company's own touch-1 send date — not from a single calendar date, since batch 1
goes out over three days.

**Most replies will not come from touch 1.** Send all five before judging the message; a sequence cut
short after two touches has not been tested, it has been abandoned.

Stop immediately for any company that replies, and switch to `objections.md` and `script.md`.
Anyone who asks to be left alone is marked `do_not_contact` the same day.

## Schedule

| Company | Touch 1 | +3 | +7 | +12 | +18 |
|---|---|---|---|---|---|
| 1–7 (Desert Living → Douglas) | Day 1 | Day 4 | Day 8 | Day 13 | Day 19 |
| 8–14 (HOA Community Mgmt → Heywood) | Day 2 | Day 5 | Day 9 | Day 14 | Day 20 |
| 15–20 (CAP → Las Vegas CMG) | Day 3 | Day 6 | Day 10 | Day 15 | Day 21 |

Same signature block on every touch. Set `[Your name]`, `[phone]`, `[postal address]` once and reuse:

```
[Your name]
[phone] · [postal address]
Not useful? Reply "no thanks" and I won't follow up.
```

---

## TOUCH 2 — Day +3 · The format

**Subject:** `re: minutes for [Company]'s board meetings` — reply to your own touch 1 so it threads.

> Hi [First name],
>
> Following up with something concrete rather than another email — here's the format we deliver:
>
> [attach or link `business/product/sample-minutes.md`]
>
> It's a made-up association, so treat it as the structure rather than a work sample: motions with
> exact wording and vote counts, failed motions kept in the record, executive session handled to the
> state standard, and action items pulled out separately so the board packet writes itself.
>
> The two free meetings are how you see it on a real one — yours.
>
> [signature]

**Honesty note.** The sample is a labeled format demonstration, not a client deliverable. Never
describe it as "from a recording" or imply it is past work. If asked directly whether you have
clients yet, the answer is that you're starting out and the free pilot is exactly why — founders
buy from people who don't oversell.

---

## TOUCH 3 — Day +7 · The recording objection, answered first

**Subject:** `re: minutes for [Company]'s board meetings`

> Hi [First name],
>
> One thing that usually comes up: most boards don't record meetings today.
>
> It's a two-minute change — the chair notes at the top that the meeting is being recorded for
> minutes, someone hits record on a phone or the Zoom session, and the audio is deleted once the
> minutes are approved. That's how the software vendors in this space handle it too.
>
> [STATE LINE — see the table below]
>
> If your boards already record, we can start this week. If not, one conversation with one board is
> the entire setup.
>
> [signature]

### State line — use the row matching the company

| State | Companies | Line to insert |
|---|---|---|
| **NV** | Desert Living, SMG, Las Vegas CMG | *"In Nevada this may already be settled — my understanding is that NRS 116 requires board meetings to be audio recorded, with the recording and minutes made available to owners within 30 days. Worth confirming with your counsel, but if that's right, the recording already exists."* |
| **FL** | Ocean Blue, Wise Property | *"Florida's a two-party consent state, so the announcement at the top of the meeting is what makes it clean — one sentence from the chair."* |
| **CO** | ACCU, CAP Management | *"Worth noting CCIOA is specific about executive session — the minutes have to say a session was held and its general subject. That's handled in what we send back."* |
| **AZ** | Heywood, National Property Services, City Property | *"Arizona's straightforward here — one-time announcement, and the audio gets deleted once minutes are approved."* |
| **GA / NC** | the remaining nine | *"Georgia's statute is light on this, so it's really whatever your bylaws say — happy to work to those."* (swap Georgia → North Carolina as appropriate) |

> ⚠ **The Nevada line is not yet verified.** It rests on a search-sourced reading of NRS 116.31083
> — see the warning in `../research/state-minutes-requirements.md`. **Read the statute before
> sending it.** It is hedged deliberately ("my understanding," "worth confirming with your counsel")
> and must stay hedged. If verification fails, delete the line; do not soften it and send anyway.

---

## TOUCH 4 — Day +12 · The economics

**Subject:** `the math on minutes`

> Hi [First name],
>
> Last useful thing I'll send.
>
> If a manager spends 2 hours per set of minutes across 10 associations, that's roughly 20 hours a
> month per manager on work no owner ever thanks them for — and it's usually the first thing to slip
> when they're busy, or the thing they mention on the way out.
>
> We're $79 a meeting. Less than the hours cost, and it comes back in 48 hours instead of two weeks.
>
> Still happy to do two free.
>
> [signature]

---

## TOUCH 5 — Day +18 · The close-out

**Subject:** `closing the loop`

> Hi [First name],
>
> I'll stop here so I'm not cluttering your inbox.
>
> If minutes ever become the bottleneck — a manager leaves, a board starts asking about the record,
> an owner requests minutes you don't have ready — the offer stands: two free, 48-hour turnaround.
>
> Good luck with the season.
>
> [signature]

**Why close out rather than escalate.** This industry is small and densely networked. A graceful
exit keeps the door open, and some of the eventual customers will reply to this email months later.
Mark them `nurture` and revisit in 90 days.

---

## Logging

After each touch, update `../data/pipeline.json` and run `node tools/kpi.js`.

Track the **objection reason** on every reply, not just the outcome. The count of *"our boards don't
record"* is experiment E-002, and at ≥50% it kills the business model rather than the message —
which is a far more useful thing to learn than a disappointing reply rate.
