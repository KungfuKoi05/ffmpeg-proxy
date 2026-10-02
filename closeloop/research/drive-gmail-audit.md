# What's actually in your Gmail and Drive on building an AI business to $5k/month

**Searched:** 2026-10-02 · Gmail (`digitaldesignsbykoi@gmail.com`) and Drive (`akoispringette@gmail.com`)

---

## The short version

The information is there. Three complete playbooks, one of your own
engineering specs, and a pile of supporting prompt packs.

**But you don't have an information problem.** You have four different
business models started and none finished — and there are two finished,
sellable products sitting in your Drive right now that nobody can buy.

---

## Gmail: nothing useful

~201 threads in the past year. The breakdown:

- Pinterest recipe recommendations (the clear majority)
- shopluxium.com promos ("FALL SALE", "Account Balance Expires Tonight")
- Zapier marketing (ZapConnect, newsletters)
- Base44 product emails

No courses, no coaching, no client correspondence, no invoices, no payments.
Searches for `stripe OR invoice OR payment OR proposal OR contract OR client`
returned **one** result, and it was a Zapier newsletter.

Two emails worth opening:

| Date | From | Why |
|---|---|---|
| Sep 15 | Zapier | "New: Claude for Small Business" |
| Sep 24 | Base44 | "Your Superagent can now make phone calls" — relevant to Closeloop's missed-call piece |

Also: Drive's full-text search isn't enabled on this connection. I had to
query by owner instead. Worth knowing if you expect me to find things by content.

---

## Drive: the real material

### Playbook 1 — Etsy digital products ★ most recent, most actionable

**`How to Make $15K a Month With Claude and Etsy.pdf`** (saved Sep 27)
Source: Ray CFU, funnels to `skool.com/raycfu`

The most operationally specific thing in your Drive. Three Claude prompts:

1. **Research** — read the top 20 Etsy listings in a niche, sort reviews
   lowest-first, group every 1–3 star complaint into themes
2. **Build** — design a product that fixes the top 3 complaint themes
3. **Market** — 10 short-form video scripts, each hooked on a real complaint
   in the buyer's own words, ending "Comment [KEYWORD] and I'll send the link"

Plus a ManyChat comment-to-DM funnel and the Etsy AI-disclosure rules
(set attribution to **Designed by a seller**, keep the disclosure line — Etsy
has pulled thousands of undisclosed AI listings).

The stated math: 20 listings × 2 sales/day × $15 = ~$18k/mo before fees.
**Reality check:** $15k/mo is 1,000 sales a month, ~33/day. The guide admits
this needs 10–30 listings in one niche plus your own video traffic. For **$5k**
you need roughly 11 sales/day — call it 8–12 listings performing.

Costs: $0.20/listing, ~10% Etsy fees, ManyChat free then $15/mo.

### Playbook 2 — AI recommendation / Bing SEO

**`AIRecommendationBlueprint.pdf`** (May 29, saved twice)
Source: Jimmy Reilly / JVO Ventures

Generate "Top 10 [category]" review articles that place your product at #1 with
9 real competitors below it, then rank them **on Bing** — because ChatGPT,
Claude and Copilot pull web results largely from Bing's index. Includes the full
article-generation prompt, a Bing indexing checklist, and a 90-day plan
(1 article week 1 → 5 by day 30 → 10–15 by day 90).

**My honest read:** the Bing-over-Google insight is legitimate and the prompt is
usable. But the core move is publishing articles that rank your own product #1
while presenting them as neutral editorial. If you do this, disclose that it's
your product. Otherwise it's exactly the kind of thing that works until it
doesn't, and it's the same trust problem Closeloop's attribution model was
built to avoid.

### Playbook 3 — Amazon KDP digital books

**`Copy of How To Sell Digital Books on Amazon KDP | Free Guide`** (May 29)
Source: Drew Huibregtse / thedigitalmillionaire.co

A getting-started checklist, not a method. It's a lead magnet: read guide →
join Discord → follow IG → then $27 starter pack / course / mentorship.

Tool stack it pushes: Amazon KDP (free), Book Bolt ($10/mo), Fiverr,
Helium 10 ($40–99/mo), Stan Store ($29–99/mo), CapCut (free).
Most of those links are affiliate links.

### Your own spec — YouTube Shorts automation

**`youtube-shorts-pipeline-prd.md`** (May 27)

This one is yours, not a course. A genuinely detailed PRD: Python service on
Railway that finds trending AI/automation videos, uses Claude to pick the best
30–59s clip, reformats to 9:16 with ffmpeg and burned captions, and auto-uploads
3×/day. FastAPI dashboard, SQLite, seen-video registry, 80% coverage gate.

It's well specified and unbuilt. Note it reposts other people's clips —
check YouTube's reuse rules before this goes live.

### Supporting assets

| File | Date |
|---|---|
| `HeadlinePrompts.pdf`, `ResearchPrompts.pdf` | May 29 |
| `Affiliate+Emails.pdf`, `Subscription+email+template.pdf` | May 29 |
| `YouTube+Review+Script+Template.pdf` | May 29 |
| `Claude Code Skills.pdf`, `Claude_Code_Complete_Workbook.pdf` | May 27 |
| `Instagram UGC — Affiliate Links` (sheet), `Affiliate Links for Viktor` | May–Jun |
| `i-corps-blue-book-jan2026.pdf` | Feb 12 |

I didn't open the prompt packs individually — they're dated the same day as the
AI Recommendation Blueprint and look like its companion files.

**The I-Corps Blue Book is the most credible document in your Drive** and the
only one not selling you something. It's the NSF's customer-discovery
methodology — the real version of "talk to people before you build."

---

## The thing you already own

Two **finished** products are sitting in your Drive:

- **`CEO Dashboard Budget Planner`** — 7 tabs: CEO dashboard, monthly budget,
  sinking funds, debt tracker, net worth, annual goals, spending journal
- **`ClearMind Budget Planner — ADHD-Friendly`**

These are *precisely* the product category the Etsy guide tells you to build.
Budget trackers and planners are its first named example. You built two, five
months ago, and never listed either.

Two caveats before listing:
1. **The CEO Dashboard has broken formulas.** `NET (Income – Expenses)` shows
   `-500000.0%`, SAVINGS RATE shows a dollar amount, and several cells read
   `#VALUE!`. The Etsy guide's whole thesis is that one-star reviews come from
   broken templates. Fix these first.
2. The sample data has placeholder debts (Credit Card A $3,000, Student Loan
   $15,000, Car Loan $8,000) and $5,000 monthly income. Decide whether that's
   your real data before it ships.

---

## What I'd actually do

You now have four live paths: Closeloop, Etsy, KDP, YouTube Shorts. That's the
problem, not the shortage of plans.

**Fastest credible route to $5k/month, in order:**

1. **This week — fix and list the two planners.** Repair the formulas, test cold
   on your phone, run the Etsy research prompt on "budget planner" and
   "ADHD planner" to see what the one-star reviews complain about, then list
   both with correct AI disclosure. You are days from a live product, not weeks.
2. **Weeks 2–4 — 8 more listings in that one niche.** Neighboring products and
   bundles. Bundles are the cheapest win: three things you already made, one
   listing, roughly double the single price.
3. **Alongside — 10 videos per listing**, scripts built from real complaints,
   ManyChat keyword → DM → listing.
4. **Closeloop stays alive on a separate track** — it's the higher-ceiling
   business ($1,500/mo per client; four clients is $6k). But it needs
   conversations, and you're 2 of 10 mystery-shop forms in.
5. **Shelve the KDP guide and the Shorts pipeline.** The KDP doc is a funnel,
   not a method. The Shorts pipeline is weeks of engineering for a channel with
   no audience and a content-reuse risk.

**One honest note on all three playbooks:** every one ends in a Skool, a
Discord, or a course upsell. The Etsy guide is the only one specific enough to
execute from as written. Treat the other two as idea sources, not instructions.

**The math for $5k:** Etsy digital products at $15 needs ~333 sales/month.
Closeloop at $1,500 needs ~3.3 clients. Same target, 100x difference in
transaction count. The Etsy path is faster to first dollar; Closeloop is faster
to $5k. Running both is defensible *only* because the Etsy work is product work
and Closeloop is conversation work — they don't compete for the same hours.
