# Agents

The prompt defined seven roles. Rather than build seven AI wrappers that would
each need an API key and produce unverifiable output, the responsibilities were
discharged directly and encoded where they can be enforced. This is what each
role actually produced.

| Role | What it owned | Where it lives now |
|---|---|---|
| **Atlas** — strategy | Tool selection, prioritisation, what not to build | `BUSINESS.md`, `DECISIONS.md`, `ROADMAP.md` |
| **Scout** — research | Category assessment, honest gaps in the data | `BUSINESS.md` (selection criteria), `SEO.md` |
| **Forge** — engineering | The entire application | `lib/`, `components/`, `app/`, `db/` |
| **Mercury** — growth/SEO | Metadata, structured data, linking, sitemap | `lib/tools/registry.ts`, `app/[slug]`, `SEO.md` |
| **Cash** — monetisation | Plans, pricing, limits | `db/schema.sql`, `BUSINESS.md` |
| **Sentinel** — QA/security | 121 tests, input validation, abuse limits, the analytics content-leak guard | `tests/`, `lib/analytics.ts`, `app/api/events` |
| **Operator** — operations | What to measure and what to do next | `app/admin`, `ROADMAP.md` |

## Why not literal agents

An agent that reports a search volume it cannot measure produces a confident
number with nothing behind it — which is worse than no number, because it gets
acted on. The prompt was explicit that estimates must be marked as estimates.
The honest version of "Scout" is the section in `BUSINESS.md` that says plainly
what could not be measured and what the choices were based on instead.

Where a rule *can* be enforced by a machine, it is enforced by a machine rather
than delegated to a model's judgment:

- Sentinel's privacy rule → a regex filter in `lib/analytics.ts` plus a browser
  test that types identifiable text and asserts it never leaves.
- Mercury's SEO standards → assertions in `tests/registry.test.ts` on title
  length, description length, FAQ substance and link validity.
- Operator's "which tools are working" → the real counters behind `/admin`.

A test that fails the build is more reliable than an agent that files a report.

## Adding an AI layer later

If you want genuine LLM agents for ongoing research and weekly reviews, the
seam is `lib/storage.ts` (`snapshot()` already returns the operating picture an
Atlas or Operator would reason over). That work belongs after there is real
traffic data to reason about — before that, an agent has nothing to analyse.
