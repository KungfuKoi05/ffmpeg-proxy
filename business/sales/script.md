# Discovery & Close Script

For the call that happens after a reply. Keep it to 15 minutes — the buyer is an owner between
meetings, and a short call that ends in a sample beats a long one that ends in "let me think."

**The goal of the call is not to close. It is to leave with a recording.**

---

## Opening (30 seconds)

> Thanks for making time. I'll keep this short — I mostly want to understand how minutes work at
> [Company] today, and if it makes sense, get one recording from you so you can see the output on
> your own meeting rather than a demo.

---

## Discovery — six questions, in this order

1. **"How many associations are you managing right now?"**
   *Sizes the account. Under 15 is a poor fit; say so honestly.*

2. **"How many board meetings does that work out to in a month?"**
   *This is the revenue number. Meetings, not associations.*

3. **"Walk me through what happens after a board meeting ends today — who writes the minutes and when?"**
   *The most important question on the call. Let them talk. Do not interrupt.*

4. **"How long does that take, realistically, per meeting?"**
   *Their number, not ours. Whatever they say becomes the anchor for pricing.*

5. **"Do your boards record meetings?"**
   *The gating question. If no, go straight to the recording objection in `objections.md`.*

6. **"What happens when minutes are late — does anyone notice?"**
   *Finds the real pain. "The board chair chases me" or "we had an audit issue" is a buying signal.
   "Nobody notices" means low urgency — qualify out politely.*

**Then stop talking.** The founder should be listening for roughly two-thirds of this call.

---

## Reflecting back

> So it's about [N] meetings a month, each taking a manager [their number] hours, usually finished
> [their timeline] after the meeting. Is that fair?

Wait for confirmation before saying anything about the offer. Agreement on the problem has to come
before any description of the solution.

---

## The offer (60 seconds, no more)

> Here's what I do. You send the recording — phone, Zoom, whatever you've got. I send back finished
> minutes in 48 hours: attendance, motions, seconds, votes, and the action items pulled out
> separately, formatted to your template.
>
> It's $79 a meeting, billed monthly on what you actually use. No minimum, no contract.
>
> **The first two are free.** I'd rather you judge it on your own meeting than take my word for it.

---

## The ask

> Do you have a recording from a recent meeting you could send me today?

Then be quiet. Whoever speaks first loses.

**If yes:** get the file before the call ends. Confirm the association's template, the turnaround
date, and who receives the draft. **Deliver in 24 hours, not 48** — the first delivery sets every
expectation that follows.

**If no recording exists:** the next step is not a sample, it is a decision. Ask which board is most
likely to agree to recording, and offer to write the two sentences the chair reads at the top of the
meeting. Book a specific follow-up date.

---

## Converting the pilot to paid

After the second free set of minutes:

> That's the two. Want me to keep going on the rest of the portfolio?
>
> [If yes] I'll invoice monthly for whatever comes through — [N] meetings would be about $[N × 79].
> Nothing to sign, and you can stop any month.

---

## Qualifying out — do it early and cleanly

Walk away when: fewer than 15 associations, no board will record, minutes are already fast and
nobody is bothered, or the buyer needs a committee to approve $79.

> Honestly, it doesn't sound like this is a problem worth paying to solve for you right now. If that
> changes, you know where I am. Do you know anyone in [market] where minutes *are* a headache?

A clean disqualification is a good outcome. It costs one call and often returns a referral, and it
protects the founder's limited hours for prospects who can actually buy.

---

## After every call

Log in `data/pipeline.json`: prospect, date, meetings/month, whether they record, the pain named in
their own words, outcome, next step. Then run `node tools/kpi.js`.

The verbatim language from question 3 is the most valuable output of any call — it becomes the next
version of the outreach email. Real buyer phrasing beats anything written from theory.
