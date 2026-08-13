# Outreach Sequence

**Five touches over 18 days.** Sent by the founder, from the founder's own mailbox, one at a time.
Most prospects will not reply to the first message — persistence without nuisance is the whole craft.

**Before sending anything:** open the company's site, find the owner's name, and find one true,
specific detail. The bracketed fields below are not optional. A message that could have been sent to
any of the 28 companies will be treated as if it were.

**Rules.** Real identity, real signature, plain text, no tracking pixels, no images, no attachments on
the first touch. If someone says stop, stop — remove them from the list that day and mark
`status=do_not_contact`. Send 20–40 per day maximum from a personal mailbox; more than that risks the
founder's own email reputation, and the whole plan depends on it.

---

## Touch 1 — Day 0 · The offer

**Subject:** minutes for [Company]'s board meetings

> Hi [First name],
>
> Quick question — when your managers finish a board meeting, who writes the minutes?
>
> I ask because with [8–12 associations per manager / N associations from their site], that's usually
> a couple of hours per meeting, done at night, days after anyone remembers what was actually said.
>
> I turn a board meeting recording into finished minutes — attendance, motions, seconds, votes, and an
> action-item list — formatted to your template, back in 48 hours.
>
> **Happy to do your next two meetings free so you can see the quality.** Just forward a recording,
> nothing else needed. If it's not better than what you're doing now, no harm done.
>
> Worth a try?
>
> [Founder name]
> [phone] · [reply address]

**Why it works:** opens with a question about their process rather than a claim about ours; names a
specific number from their own site; the ask is forwarding a file, not booking a call.

---

## Touch 2 — Day 3 · The proof

**Subject:** re: minutes for [Company]'s board meetings

> Hi [First name],
>
> Following up with something concrete rather than another email — here's a sample of what comes back:
>
> [Link to the sample minutes document]
>
> That's from a recording, no notes, no interview. Motions and votes captured verbatim, action items
> pulled out separately so the board packet writes itself.
>
> Two free meetings still stands if you want to test it on your own recording.
>
> [Founder name]

---

## Touch 3 — Day 7 · The objection, answered before it is raised

**Subject:** re: minutes for [Company]'s board meetings

> Hi [First name],
>
> One thing that usually comes up: most boards don't record meetings today.
>
> It's a two-minute change — the chair notes at the top of the meeting that it's being recorded for
> minutes, someone hits record on a phone or the Zoom session, and the audio gets deleted once the
> minutes are approved. That's how the software vendors in this space handle it too.
>
> If your boards already record, we can start this week. If not, that conversation with one board is
> the only setup involved.
>
> [Founder name]

**Note for two-party consent states (CA, FL, PA):** the announcement at the top of the meeting is
what makes this lawful [FACT: https://thehoahandbook.com/is-it-legal-to-record-hoa-meetings-state-laws-explained/].
Say so plainly if asked — it is a selling point, not a liability.

---

## Touch 4 — Day 12 · The economics

**Subject:** the math on minutes

> Hi [First name],
>
> Last useful thing I'll send.
>
> If a manager spends 2 hours per set of minutes and handles 10 associations, that's roughly 20 hours
> a month per manager on work no owner ever thanks them for — and it's usually the thing that slips
> when they're busy or about to quit.
>
> We're $79 a meeting. Cheaper than the hours, and it comes back in 48 hours instead of two weeks.
>
> Still happy to do two free.
>
> [Founder name]

---

## Touch 5 — Day 18 · The close-out

**Subject:** closing the loop

> Hi [First name],
>
> I'll stop here so I'm not cluttering your inbox.
>
> If minutes ever become the bottleneck — a manager leaves, a board starts complaining about the
> record — the offer stands: two free, 48-hour turnaround.
>
> Good luck with the season.
>
> [Founder name]

**Why close out rather than escalate:** in an industry this networked, a graceful exit preserves the
option. Several of the eventual customers will come from this email months later.

---

## After a reply

| Reply | Action |
|---|---|
| "Send me a sample" | Send the sample, ask for one of their recordings the same message |
| "Sure, here's a recording" | **Deliver in 24 hours, not 48.** Beat the promise on the first one |
| "How much?" | $79/meeting, first two free, no minimum — then ask for the recording |
| "We use [software]" | See `objections.md` — do not argue, ask what their managers still do by hand |
| "Not interested" | Mark `closed_lost`, note the reason, stop. The reason is the valuable part |
| No reply after touch 5 | Mark `nurture`, revisit in 90 days |

## Logging — every day, not weekly

Update `data/pipeline.json` after each batch, then run `node tools/kpi.js`. Unlogged sends make the
conversion rates meaningless, and those rates are the only thing this phase is actually producing.
