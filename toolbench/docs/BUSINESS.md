# Business

## The model in one line

Free browser-based utilities acquire search traffic at near-zero marginal cost;
a small share of heavy users pay for batch, history and API.

## Why browser-side processing decides everything

This is the load-bearing decision. Every tool runs as JavaScript on the
visitor's device. The consequences compound:

| | Server-side conversion | Browser-side (what we built) |
|---|---|---|
| Cost per use | CPU, memory, bandwidth, storage | **$0** |
| Cost of a traffic spike | Scales linearly, can bankrupt you | **$0** |
| Upload wait | Seconds to minutes | **None** |
| Privacy claim | "We delete after an hour" (trust us) | **Nothing is sent** (verifiable) |
| Attack surface | Malicious uploads, path traversal, malware | **No upload endpoint exists** |
| Free tier viability | Must be limited or it loses money | **Genuinely unlimited** |

A competitor running conversions on servers has a variable cost that rises with
every visitor. Ours does not. That is the whole reason a $100 budget is a
realistic starting point rather than a fantasy.

## Tool selection

**A caveat that matters: we have no keyword data.** No Search Console (the site
isn't live), no keyword tool, and no reliable public search-volume source in
this environment. The prompt was explicit about not manufacturing those numbers,
so nothing below claims a monthly search volume.

What we *can* assess honestly is everything else. Tools were scored on:

| Factor | How it was judged |
|---|---|
| Feasibility | Can it run entirely client-side, correctly, today? |
| Operating cost | Anything above $0 per use was disqualified for launch |
| Implementation risk | How likely is a wrong answer a user won't notice? |
| Repeat usage | Would the same person come back weekly? |
| Category breadth | Does it open a category we can expand into? |

### The launch set (25 tools, now 34)

**Text (11)** — word counter, character counter, case converter, remove
duplicate lines, remove empty lines, remove extra spaces, sort lines, reverse
text, find and replace, extract emails, extract URLs.

*Why first:* pure string manipulation, trivially correct, instant, and the
category has obvious everyday demand. Zero risk of a wrong answer.

**Developer (6)** — JSON formatter, Base64, URL encoder, UUID generator,
timestamp converter, regex tester.

*Why:* developers are repeat users with high tolerance for a plain interface
and low tolerance for uploads — the privacy story lands hardest here. All six
are pure functions already in the browser's own runtime.

**Calculators (8)** — percentage, discount, profit margin, loan, compound
interest, hourly-to-salary, paint, concrete.

*Why:* the highest commercial intent of the three categories. Someone
calculating concrete for a slab is mid-purchase. These are also the most
*embeddable* — a contractor's site can host our concrete calculator, which is a
separate acquisition channel (see ROADMAP).

### What we deliberately did NOT build

Honesty about the hard cases matters more than a longer tool list:

| Tool | Why not |
|---|---|
| **PDF → Word** | Genuinely hard. Faithful layout reconstruction is not reliably solvable client-side. A bad converter is worse than none — it burns the trust the whole site depends on. |
| **OCR** | Needs Tesseract WASM (several MB). Viable later behind an explicit "loading the engine" state; not for launch. |
| **HEIC → JPG** | Needs a heavy WASM decoder. High demand, real work, sequenced next. |
| **Invoice / receipt generators** | Not hard — but they want saved history and templates, which means accounts. That is the *second* phase, when there is a reason to sign up. |
| ~~Image compressor / resizer~~ | **Built in 0.2.0.** Canvas-based, verified on a real image at 89% reduction. |

Building tools we can prove correct beats a longer list we cannot. The five
image and four PDF tools added in 0.2.0 cleared that bar — each was driven with
a real file in a real browser before being called done.

## Monetisation

Free stays genuinely useful — that is the acquisition channel, and crippling it
would destroy the traffic that makes the business work. Nothing in the launch
set is paywalled.

Pricing is defined in `db/schema.sql` and not yet wired to Stripe:

- **Pro — $9/mo or $79/yr.** Batch processing, no ads, saved history, priority.
- **Business — $29/mo.** API access, team seats, higher limits.

$9 sits mid-range of the $7–$12 target and is the price to A/B first.

**Nothing is charged yet.** There is no Stripe integration, no checkout, no
account system. Adding billing before there is traffic optimises the wrong end
of the funnel.

## Costs

| Item | Now | At scale |
|---|---|---|
| Hosting (Vercel Hobby) | $0 | $20/mo on Pro |
| Database | $0 (not used yet) | $0 on Supabase free |
| Analytics | $0 (self-hosted) | $0 |
| Conversion compute | **$0 — runs on the visitor's device** | **$0** |
| Domain | **Not purchased** | ~$12/yr |

**Spent so far: $0.** The only thing needing approval is a domain, because
spending money is a decision reserved for you.

## Honest revenue assessment

The $10k/month target needs roughly 1,000 Pro subscribers. At a 1% free-to-paid
conversion — optimistic for a utility site — that implies around 100,000 monthly
active users, which for this category means high hundreds of thousands of
sessions.

That is a real, achievable number for a utility site, and it takes 12–24 months
of consistent SEO compounding. Anyone promising it in three months is selling
something. The first honest milestone is not revenue — it is **a single tool
ranking on page one for one query.**
