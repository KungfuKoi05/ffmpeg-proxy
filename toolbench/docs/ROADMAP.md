# Roadmap

Ordered by `Impact × Confidence ÷ Effort`, not by what is interesting.

## Now — before any public deploy

| Task | Why it blocks |
|---|---|
| **Auth on `/admin`** | Currently unprotected. Aggregate data only, but it must not be public. |
| **Decide the domain** | Needs your approval — it is the only spend. |
| **Set `NEXT_PUBLIC_SITE_URL`** | Canonicals and the sitemap point at a placeholder until this is real. |

## Next — highest expected return

1. **Image tools** (compressor, resize, JPG↔PNG, WebP).
   Canvas API, fully client-side, no new dependency. Broadest demand of anything
   not yet built, and it opens a whole category. **Build this first.**
2. **PDF tools** (merge, split, rotate, delete/extract pages).
   `pdf-lib` is already a dependency and works in-browser. High commercial
   intent; the natural next category.
3. **Search Console + real measurement.** Everything after this should be driven
   by impression data rather than judgment.

## Then

4. **HEIC → JPG.** Real demand, needs a WASM decoder — the first tool with a
   meaningful download cost. Ship with an explicit loading state.
5. **Embeddable calculators.** A contractor's site embeds our concrete
   calculator with a backlink. This is a genuine second acquisition channel and
   it compounds; the calculators were partly chosen for it.
6. **Guides**, only where one genuinely helps. Not bulk content.

## Later

7. **Accounts** — when there is a reason to sign up (saved history), not before.
8. **Pro billing** — when there is traffic to convert.
9. **API tier** — when a business asks for it.
10. **OCR** — the heaviest lift; wait until demand is proven.

## Stages

| Stage | Milestone | Honest note |
|---|---|---|
| 0 | Deployed and indexed | Where we are, minus deployment |
| 1 | One tool on page one for one query | The real first milestone |
| 2 | $0 → $100/mo | Needs traffic first; billing comes later |
| 3 | $100 → $1,000/mo | Expand what measurement says is working |
| 4 | $1,000 → $10,000/mo | 12–24 months of compounding, realistically |

Anyone claiming stage 4 inside a quarter is guessing. The compounding is real
but it is slow, and the only thing that speeds it up is tools that genuinely
work.
