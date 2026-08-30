# Roadmap

Ordered by `Impact × Confidence ÷ Effort`, not by what is interesting.

## Done since launch set

- ~~Auth on `/admin`~~ — HTTP Basic via `ADMIN_PASSWORD`, fails closed with 503
  when unset. Verified across all four states.
- ~~Image tools~~ — compressor, resizer, JPG↔PNG, WebP converter. Verified on a
  real image: 577 KB → 64 KB.
- ~~PDF tools~~ — merge, split, delete pages, rotate. Verified on real PDFs:
  3 + 2 pages merged to 5.

## Now — before any public deploy

| Task | Why it blocks |
|---|---|
| **Set `ADMIN_PASSWORD`** | `/admin` returns 503 until it exists. |
| **Set `NEXT_PUBLIC_SITE_URL`** | Canonicals and the sitemap point at a placeholder until this is real. |
| **Point the domain at the deployment** | In progress on your side. |

## Next — highest expected return

1. **Deploy, then Search Console.** 34 tools is well past the 10–15 launch bar.
   Everything after this should be driven by impression data rather than
   judgment — that is the single biggest change in decision quality available.
2. **PDF compress and PDF → JPG.** The two most-wanted PDF tools we do not have.
   Compression is feasible via image re-encoding inside the PDF; page rendering
   needs `pdf.js`, a real but justified dependency.
3. **Image crop, and image → PDF.** Both Canvas-only, both natural companions to
   what now exists.

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
