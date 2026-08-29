# Changelog

## 0.1.0 — initial build

**Added**
- 25 tools across three categories, all browser-side:
  - Text (11): word counter, character counter, case converter, remove
    duplicate lines, remove empty lines, remove extra spaces, sort lines,
    reverse text, find and replace, extract emails, extract URLs
  - Developer (6): JSON formatter, Base64, URL encoder, UUID generator,
    timestamp converter, regex tester
  - Calculators (8): percentage, discount, profit margin, loan, compound
    interest, hourly-to-salary, paint, concrete
- Registry-driven routing, metadata, sitemap, robots, JSON-LD, breadcrumbs and
  internal linking
- Privacy-first analytics with a content-leak filter, and a hardened ingest
  endpoint
- Admin dashboard (unauthenticated — see DECISIONS D9)
- Postgres schema (not applied)
- 121 tests

**Fixed during the build**
- `findReplace` used a function replacement, which made JS treat `$1` as literal
  text — regex capture groups never worked despite the FAQ documenting them.
  Caught by a test written before the UI existed.
- Shuffle used a `useMemo` dependency the linter correctly flagged as unused;
  replaced with a genuinely seeded generator, which also made shuffles
  reproducible.

**Verified**
- typecheck clean · lint clean · 121 tests pass · production build succeeds
  (36 pages) · driven in a real browser: word counter, JSON formatter (including
  error positions), loan calculator (matches hand-checked $1,199.10), case
  converter, full SEO surface, and analytics confirmed not to leak content

**Not done**
- Not deployed · no domain · no accounts · no billing · `/admin` unauthenticated
- No image or PDF tools yet
