# SEO

## Architecture

Every tool page is generated from its registry entry and prerendered at build
time. A tool automatically gets:

- `<title>` and meta description (length-constrained by test: ≤65 and 70–165 chars)
- canonical URL
- OpenGraph and Twitter tags
- `WebApplication` + `FAQPage` + `BreadcrumbList` JSON-LD
- visible breadcrumbs
- four related-tool links
- a sitemap entry
- footer links from every other page

Verified in the rendered HTML, not assumed:

```
title:     "Word Counter — Free Online Word & Character Count | Toolbench"
canonical: https://toolbench.app/word-counter
JSON-LD:   WebApplication, FAQPage, BreadcrumbList
```

## URL structure

Flat and permanent — `/word-counter`, `/json-formatter`, `/loan-calculator`.
Short, matches how people search, and never needs restructuring as categories
change. Categories live at `/tools/text` and exist for humans and crawl paths,
not to own the query.

## The line we do not cross

The system is programmatic but **quality-controlled**, and the difference is
enforced in tests rather than in good intentions:

- Every FAQ answer must exceed 40 characters (`registry.test.ts`) — short
  answers are the signature of thin, generated filler.
- Every FAQ question must actually be a question.
- Keywords are capped at 8 per page. They inform the page; they are not sprayed
  into the copy.
- Every related link must resolve to a live tool. No dead internal links, ever.

We are not generating thousands of articles. A page exists when a tool exists.

## What each page has to earn its ranking

The tool is above the fold. Supporting copy is *below* it. A visitor from a
search result reaches a working tool in one scroll-free interaction — which is
the actual ranking factor that matters here, because it drives the engagement
signals everything else follows from.

The FAQs answer real questions people have about the task (does a 50% markup
mean a 50% margin? is Base64 encryption? how much waste for a slab?). They are
there because they are useful; the schema markup is a side effect.

## Honest position

**We have no keyword data.** The site is not live, so there is no Search
Console, and no reliable public volume source was available. Nothing in this
repo claims a search volume. Category choices were made on implementation
feasibility, cost and obvious utility — see `BUSINESS.md`.

The first real SEO work starts the day the site is live and Search Console has
data. Until then, ranking predictions would be fiction.

## First moves after launch

1. Verify in Google Search Console; submit `/sitemap.xml`.
2. Wait for impression data. **Do not guess which tools win — measure.**
3. For any query with impressions but a poor position, improve *that* page.
4. Build the next tools in the categories that show real impressions.
5. Only then consider `/guides/*` pages, and only where a guide genuinely helps
   (e.g. "how much concrete do I need" deserves an explanation the calculator
   alone cannot give).
