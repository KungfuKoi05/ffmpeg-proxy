# CleanCSV

**Upload your messy spreadsheet. Find the problems. Fix them. Download a clean file.**

CleanCSV is a CSV cleaner for people who don't write code: small business owners, online
sellers, recruiters, assistants, marketing and operations teams. It runs entirely in the web
browser. Files are never uploaded anywhere.

It is a static web app (React + TypeScript + Vite). There is no server, no account, no paid
API and no AI service.

---

## What works

Every item below is implemented and covered by automated tests (see [Testing](#testing)).

**1. Upload**
- Drag and drop, or a file picker. A **Try a sample file** button loads a made-up customer list with planted problems. It works offline.
- Detects comma, semicolon, tab and pipe separators. You can override the choice.
- Detects UTF-8, UTF-8 with BOM and UTF-16. Falls back to Windows-1252 with a warning. You can also choose from 11 encodings by hand.
- Handles quoted commas, quoted line breaks and escaped quotes (`""`).
- **Never throws data away.** Rows with too many values get extra columns. Short rows are padded. Every change is reported.
- An unclosed quote is flagged, and you must confirm before continuing.
- Rejects with a plain-English message:
  - empty files
  - files with column names but no rows
  - Excel/zip, old `.xls` and PDF files (with "save as CSV" instructions)
  - binary data
  - files over the size limits

**2. Find problems.** A report that says "Your file has N things worth checking". Each finding shows:
- what is wrong
- how many rows or cells it affects
- why it matters
- a suggested fix
- a **Preview fix** button and a **Show these rows** filter

Each finding is labelled **Confirmed**, **Our guess: please check** or **Your check**. Severity is **Important**, **Worth checking** or **Good to know**.

What it finds:
- Exact duplicate rows, and near-duplicates that differ only in capitals or spaces.
- Empty rows and empty columns.
- Extra spaces in cells and in column names.
- Column names in mixed styles.
- Placeholder text that may mean "empty" (N/A, NULL…). "None", "NA" and "Unknown" are shown but never pre-selected.
- Ordinary blank cells. These are labelled "Good to know", not errors.
- Invalid or suspicious email addresses (missing @, `gmial.com`, `.con`…), and emails with capital letters.
- Dates:
  - in mixed formats
  - impossible dates (Feb 30)
  - text that can't be read as a date
  - **ambiguous** dates like 03/04/2026
- Numbers containing currency symbols or thousands separators, and text in number columns.
- Phone numbers written in several styles, and values too short or long to be phone numbers.
- Category values written several ways ("Electronics" / "electronics" / "Electroncs", "USA" / "United States").
- Mixed capitalization in name-like columns.
- Values that repeat in a column that looks like it should be unique (IDs, emails, phones).
- Cells that a spreadsheet could run as a **formula** (`=`, `+`, `-`, `@`): a security risk.
- **Your own checks**: a column must not be empty, must be unique, must be email/number/date, or may only contain certain values.

A **column overview** shows each column's fill rate, number of different values, invalid-looking entries, and a guessed type, labelled as a guess.

**3. Clean.** Each recommended fix is a card with **Preview**, **Apply fix** and **Cancel**.
- The preview shows real before/after values, the rows that would be removed and why ("same as row 1"), and the values that would be left unchanged.
- The preview is computed by the same code that applies the fix, so what you see is what you get.
- Fixes that remove rows or columns, and fixes that need a decision, always open the preview first.
- **Dates:** if nothing in the column proves month-first or day-first, the Apply button stays disabled until you choose. The preview shows both readings ("Mar 4, 2026 if month first, or Apr 3, 2026 if day first").
- **Similar values:** groups that differ only in capitals or spaces start ticked. Synonym and spelling groups start unticked, and you can untick single values or change the target name.

More tools:
- find and replace (literal text, optional whole-cell and match-case)
- remove duplicates by chosen columns (keep first or last, ignore case and spaces)
- remove extra spaces
- change capitalization
- fill empty cells
- format dates (5 output formats)
- clean numbers (dot or comma decimals, done on the text with no rounding, keeps leading zeros)
- format phone numbers (17 countries, 3 formats; uses Google's libphonenumber rules)
- add a "check" column that marks problems instead of changing values
- standardize column names
- rename or remove a column
- apply a saved recipe

**Undo, redo, reset:**
- Undo and redo buttons, plus Ctrl/Cmd+Z and Ctrl+Shift+Z or Ctrl+Y.
- **Reset to original** restores the exact parsed file, and can itself be redone.
- The cells changed by the last step are highlighted.

**4. Download**
- Shows original rows, final rows, changes applied and unresolved warnings.
- An editable file name (default `cleaned-<name>.csv`, sanitized).
- Choice of separator, and an optional byte-order mark so Excel shows accents correctly.
- **Protect against spreadsheet formulas**: on by default. It adds an apostrophe before risky cells and leaves plain numbers like `-5` and phone numbers like `+1 555…` alone.
- Before saving, the exported text is **parsed back and compared cell by cell** with the table on screen. If they differ, the download is stopped.
- **Change report** (`.txt`). It lists:
  - every changed cell, before and after
  - every removed row with its contents and the reason
  - renamed, added and removed columns
  - values left unchanged
  - formula protection
  - warnings still open
  - the undo/redo history

**Saved recipes**
- Save the applied steps (and your checks) under a name. Rename, view steps, delete (with confirmation), and export/import as a JSON file to move between devices.
- **Applying a recipe** tries every step on the new file first and shows what each would do. Steps that need a missing column are explained ("needs 'Category', which this file does not have") instead of run blindly. You can then apply all steps, or only the ones that fit.

**Cleaning History.** A log of the current session (applied, undone, redone, reset). Past downloads are recorded with file names, row counts and step names, never contents. Clear it any time.

**Help.** A plain-English FAQ and a **Clear all saved data** button.

---

## Privacy and security

- **Files never leave the device.** The production build sets `Content-Security-Policy: connect-src 'self'`, so the page cannot send data to any other server. The main end-to-end test fails if the app makes any request to another origin.
- No analytics, no error reporting, no console logging of data.
- Cell values are always rendered as text (no `innerHTML`). Download names are sanitized.
- Spreadsheet formula injection is detected and neutralized on export by default, and the change is explained.
- Local storage holds only recipes (steps and their settings) and history metadata. Opened files live in memory and disappear when the tab closes. Storage failures (private windows, blocked storage) are handled, and the app says when something could not be saved.
- Imported recipe files are validated strictly, so a hand-edited file can't crash the app.

---

## Install and run

Requires Node.js 20 or newer (developed with Node 22) and npm.

```bash
cd cleancsv
npm ci          # install exact dependency versions from package-lock.json
npm run dev     # http://localhost:5173
```

Production build and local preview:

```bash
npm run build   # type-checks, then writes the static site to dist/
npm run preview # serves dist/ at http://localhost:4173
```

## Testing

```bash
npm test               # 149 unit + component tests (Vitest, React Testing Library, jsdom)
npm run typecheck      # TypeScript, strict mode
npx playwright install chromium   # once, if Playwright has no browser yet
npm run test:e2e       # 11 browser tests (Playwright) against the production build
npm run perf           # optional: timing on 10k / 100k / 500k-row synthetic files
LARGE_ROWS=300000 npx playwright test e2e/large.spec.ts   # optional: bigger browser test
```

What the tests cover:

| Area | Where |
|---|---|
| Valid import, empty-file rejection, quoted commas, quoted newlines, escaped quotes, separators, encodings (Windows-1252, UTF-16, BOM), Excel/binary rejection, malformed rows, unclosed quotes, unique header naming, Unicode, size and cell limits, 50k-row import | `src/engine/parse.test.ts` |
| Duplicates (all / selected columns, keep first/last, case and space options), whitespace, empty rows and columns, header styles, missing values, case changes, merging, ambiguous dates, numbers, phones, emails, find and replace, structural sharing, immutability | `src/engine/actions.test.ts` |
| Email, placeholder, formula-risk, date, number, phone and cluster helpers | `src/engine/values.test.ts` |
| Every finding (incl. user rules and the sample file), undo/redo, reset, preview equals apply, export round-trip, formula protection, export verification, file names, recipe save/replay/mismatch/validation, change report | `src/engine/session.test.ts` |
| Background problem check never shows a previous file's results; small files are checked instantly | `src/lib/useAnalysis.test.tsx` |
| UI: upload without a Web Worker, error display, apply/undo by keyboard, destructive confirmation, reset confirmation, recipe storage (and no file data in storage), blocked storage, download summary | `src/App.test.tsx` |
| Browser: full workflow with real downloads checked line by line, reset, uploads, broken files, broken quotes, ambiguous dates, recipe replay and mismatch, phone layout with no sideways scrolling, axe WCAG 2.1 AA scan of every screen, keyboard-only use, 100,000-row file | `e2e/*.spec.ts` |

## Performance

Measured in the development container (headless Chromium 141 and Node 22), with synthetic 10-column files. Your device will differ.

| File | Read | First problem check | Apply a fix | Undo |
|---|---|---|---|---|
| 10,000 rows (0.9 MB) | <0.1 s | ~0.3 s | instant | instant |
| 100,000 rows (9 MB) | ~3 s in browser (incl. test upload) | ~2–3 s, in the background | ~0.2–0.3 s | ~0.3 s |
| 300,000 rows (28 MB) | ~9 s | ~7 s, in the background | ~1 s | ~0.6 s |

- File reading always runs in a Web Worker.
- For tables over 150,000 cells the problem check also runs in a Web Worker, so the page keeps responding. An "Updating the list of problems…" note shows while it runs.
- At 500,000 rows the check used about 1.9 GB of memory in Node, which is too much for many browser tabs.

The limits are therefore:
- **files up to 50 MB and 3.5 million cells**, with a "may be slow" note above 10 MB
- anything larger is refused with a clear message, before the tab can run out of memory

The comfortable range is up to about 100,000 rows.

## Deployment (free)

The build output is plain static files, and all asset paths are relative, so `dist/` works at a domain root or in a sub-folder.

**Cloudflare Pages (simplest, free):**
1. Push this repository to GitHub.
2. In the Cloudflare dashboard, open **Workers & Pages → Create → Pages → Connect to Git**, and pick the repository.
3. Use these settings:
   - Root directory: `cleancsv`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variable: `NODE_VERSION=22`
4. Deploy. Every push to the chosen branch redeploys.

Or, from your machine: `npm run build && npx wrangler pages deploy dist --project-name cleancsv`. This needs a free Cloudflare account and logs you in on first use.

**GitHub Pages:**
- Run `npm run build` and publish the contents of `cleancsv/dist`, for example with the official `actions/upload-pages-artifact` + `actions/deploy-pages` workflow, with Pages set to "GitHub Actions" in the repository settings.

**Not deployed yet.** No live URL exists until one of the steps above is done.

## Project layout

```
cleancsv/
  index.html                 page shell (CSP is added at build time by vite.config.ts)
  src/
    engine/                  all data logic: pure TypeScript, no React, fully unit-tested
      parse.ts               bytes -> table: encodings, separators, malformed rows, limits
      analyze.ts             finds problems and explains them
      profile.ts             per-column stats and type guesses
      actions.ts             the cleaning steps (pure functions that never modify their input)
      history.ts             undo / redo / reset (keeps each step's result, sharing unchanged rows)
      export.ts              CSV writing, formula protection, export verification, safe file names
      recipes.ts             recipe dry-run, mismatch explanation, validation
      report.ts              change report
      dates.ts numbers.ts phones.ts clusters.ts values.ts cached.ts describe.ts sample.ts limits.ts
      parse.worker.ts analyze.worker.ts   Web Workers
    components/              UI (Tailwind, shadcn-style components on Radix Dialog, Lucide icons)
      steps/                 Upload, Find problems, Clean, Download
    pages/                   Clean a File, Cleaning History, Saved Recipes, Help
    lib/                     file reading, background analysis, local storage, downloads
    state.tsx                app state (session, recipes, history)
  e2e/                       Playwright tests
```

**How undo is exact:**
- Every step is a pure function that returns a new table and a list of exactly what changed. Rows it didn't touch are shared with the previous table, not copied.
- History keeps each step's result. Undo, redo and reset just move a pointer, and the original parsed table is never modified.
- The change report is built from the recorded changes, not from what the step intended to do.

## Known limitations

- **No Excel (.xlsx) import.** SheetJS Community Edition on npm is version 0.18.5, which has known security advisories; fixed builds are only published on SheetJS's own CDN. Users save as CSV first, and the app detects `.xlsx`/`.xls` files and says so.
- **Not tested on real Safari or Firefox**, only Chromium (desktop and Pixel 7 emulation). The code uses only standard APIs, with fallbacks for missing `File.arrayBuffer` and `Worker`.
- **Type guesses are heuristics.** A column of 8-digit order numbers can look like dates, and short codes can look like categories. All guesses are labelled as guesses, and nothing changes without a click.
- **Name capitalization is simple:** "mcdonald" becomes "Mcdonald", not "McDonald". The fix card says so.
- **Phone validation checks shape and possible length, not whether a number exists.** Formatting uses the country you pick for numbers without a `+` code.
- **Data stays in memory.** Undo history for very large files with many steps can use a lot of memory, and closing the tab loses unsaved work.
- **Recipes and history are per-browser.** Use Export/Import to move recipes.
- **No accounts, payments or batch processing** (deliberately; see the brief's monetization section).
- **The bundle is ~175 KB gzipped**, mostly React and libphonenumber-js metadata.

## Licenses of dependencies

All runtime dependencies use permissive open-source licenses:

| Package | License |
|---|---|
| React | MIT |
| Papa Parse | MIT |
| libphonenumber-js | MIT |
| lucide-react | ISC |
| @radix-ui/react-dialog | MIT |

The development tools are also open source: Vite, Tailwind CSS, Vitest and Testing Library (MIT), and Playwright (Apache-2.0).
