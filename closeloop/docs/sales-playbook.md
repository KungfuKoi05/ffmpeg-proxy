# Sales playbook

**Owner:** Mercury

## The offer

> "We follow up on the estimates you sent that never closed, and the calls you
> missed. You read every message before it goes out. At the end of the month you
> get a report showing exactly which jobs came back — and we only claim the ones
> we can prove."

## Positioning against the commodity

You will be compared to a $99 missed-call texter. Don't fight it — reframe:

> "Those are good tools and I'll happily name a few. They answer your phone.
> They don't do anything about the $14,000 estimate you sent three weeks ago
> that's just sitting there. That's what we do, and that's why we cost more than
> a hundred bucks."

## Qualifying: who is worth your time

**Green:**
- Average job over $5,000
- Sends 10+ estimates/month
- Can't state their estimate close rate from memory
- Pays for leads (LSA, Angi, ads) — waste is expensive to them
- Owner is reachable and decides

**Disqualify honestly and fast:**
- Average job under $2,000 → *"Honestly, the maths doesn't work for you at our price. Here's what I'd do instead."* (This earns referrals.)
- Booked out three months, turning work away → no pain
- Already has a disciplined follow-up person and cadence
- Won't share numbers → can't prove value, can't sell

## Prospect scoring

Built into `/sales`. Signals are observable from outside without contacting them:

| Signal | Points | How to check |
|---|---|---|
| High-ticket trade | +20 | their site |
| No web form | +12 | their site |
| No online booking | +8 | their site |
| Slow/no response | +15 | mystery-shop them (below) |
| 50+ reviews | +10 | Google Maps |
| Reviews mention no callback | +15 | **read the 1–3 star reviews** |
| Owner answers the phone | +10 | call once |
| Runs paid ads | +10 | search their service + city |
| Rating ≥4.5 | +5 | Google |
| Rating <3.5 | −10 | Google |

**Tier A (70+) first.** Tier D is a waste of your 2–3 hours a day.

### The mystery shop

The single highest-value 10 minutes in this whole playbook.

1. Submit their web form (or call) as a real prospective customer with a real job.
2. Note the exact time.
3. Record when — or whether — anyone responds.

That timestamp *is* your opening line, and it is unarguable.

> "I filled in your form Tuesday at 9:40am asking about a roof replacement.
> It's Friday. I never heard back. I'm not saying that to be rude — I'd want to
> know if it were my business."

Do not exaggerate, do not use it as a gotcha, and if they responded quickly,
**tell them so and move on**. A false accusation ends the conversation.

## Outreach

Templates in `sales/templates/`. Rules:

- **Never mass-send.** 10 personalised beats 200 blasted.
- One specific, verifiable observation per message. Their business, not a generic pitch.
- Ask for 15 minutes, not 30.
- Three touches, then stop. Move on and revisit in 90 days.

## The audit call (30 min)

The whole product demo is: *their* numbers in our calculator, live.

1. **(5 min) Their numbers.** Calls/month, % missed, estimates/month, average value, close rate. Type them into the calculator while they watch.
2. **(5 min) The gap.** "That's roughly $X/month in estimates going cold. Does that feel about right, or is it high?" *Let them argue it down — a number they corrected is a number they own.*
3. **(10 min) The mechanism.** Show the dashboard, the sequences, the approval queue. Emphasise: you read everything before it sends; nothing goes out until you say so.
4. **(5 min) The report.** Show a real ROI report including the unattributed column. *"These are jobs we chose not to claim. That's the point."* **This is usually the moment they decide.**
5. **(5 min) Close.** "$1,500 a month, no setup fee, cancel with 30 days. First two weeks in review-only mode so you see every message before anything sends. Want to start Monday?"

## Objection handling

**"Too expensive."**
> "Compared to what? One roof is nine grand. If we bring back one job a quarter you're ahead. If we don't bring anything back in 60 days, I'd rather you cancelled than kept paying."

**"I already follow up."**
> "Good — most don't. Out of last month's estimates, how many got a fourth touch?" *(Almost nobody says a number. That silence is the sale.)*

**"My customers hate automated texts."**
> "So do mine. You write the messages, in your voice, and you approve each one until you're comfortable. If it sounds like a robot, that's a copy problem and we fix it."

**"I'll think about it."**
> "Fair. Can I do one thing? Let me run your last month's unsold estimates through it in review-only mode. Nothing sends. You'll see exactly what we'd have said and what it's worth. If it's not compelling, you've lost nothing."

**"What if it doesn't work?"**
> "Then you cancel. 30 days' notice, no contract. I'd rather have a short honest engagement than a long unhappy one."

**"Can you guarantee results?"**
> "No, and I'd be careful with anyone who does. What I guarantee is that you'll see every message, and that the report only counts jobs we can actually trace."

## Pipeline stages

`new → researched → contacted → replied → meeting → audit_sent → proposal → won/lost`

Tracked in `/sales`. Rule: **every prospect has a next action with a date, or it's `lost`.** A pipeline full of "maybe" is a pipeline full of nothing.

## Founding-client offer

For the first three clients only:

- $750/month for the first 3 months, then $1,500
- In exchange: a candid reference and permission to use their (real) numbers as a case study
- Explicitly time-boxed and explicitly a founding rate — never a discount you'd give anyone who pushes

Rationale: the first case study is worth more than $2,250 of early revenue.

## Weekly cadence (2–3 hrs/day)

| Day | Focus |
|---|---|
| Mon | Research + score 10 new prospects. Mystery-shop the top 5. |
| Tue | 10 personalised first-touch messages. Follow up last week's. |
| Wed | Audit calls. |
| Thu | Audit calls + follow-ups. |
| Fri | Client delivery, ROI reports, review the week's numbers with Atlas. |

**Target: 10 new conversations/week → ~3 audits → ~1 client every 2–3 weeks.**
That reaches 7 clients inside 120 days with margin for the ramp.
