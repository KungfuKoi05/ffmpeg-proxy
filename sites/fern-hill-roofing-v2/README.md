# Fern Hill Roofing, draft 2 (sample site)

A second, from-scratch draft of the sample site for a **made-up** Tacoma roofer. It uses a different design
direction and real-looking photos instead of drawings. The first draft lives in `sites/fern-hill-roofing`
on the `claude/example-roofing-site` branch, in case you want to compare them.

Plain HTML, CSS and JavaScript in `public/`. No build step. A phone downloads about 260 KB on the first screen, plus about 46 KB (compressed) of GSAP if the visitor scrolls to the zoom section.

## The idea

The company is named after the Fern Hill neighbourhood, and the first thing a roofer finds in a neglected gutter is a fern.
The hero sets a photo of exactly that between the words **Fern** and **Hill**.

The rest of the page carries one promise: **tear-offs only on dry days.**

- A sentence about it stays on screen while photos of a dry-day tear-off, a rainy street and a storm tarp scroll past.
- The price table's middle column is "dry days needed."
- The third step of the job ("We wait for dry days") is the only line in the warm accent colour.

**Interactive part:** a roof-size slider. It updates the price range and dry days for all three roof types, and the booking emails pick up the size.

## The one GSAP moment

In the "Every layer / in writing" section, the house photo zooms with your scroll, from the whole house to the chimney flashing to the ridge. It pauses on each, and scrolling back up reverses it. This uses [GSAP](https://gsap.com) 3.15.0 with its ScrollTrigger plugin.

- **Self-hosted** in `public/vendor/`, so the security policy still allows only this site's own files.
- **Loaded only when the section is about a screen and a half away.** It adds about 46 KB compressed, and keeping it off the first screen keeps the first screen just as fast. Loading it up front had dropped Lighthouse phone performance from 100 to 96 and pushed the main image from 1.6 s to 2.8 s.
- **Fallback.** Without GSAP, in browsers that can't crop with `object-view-box`, or when the visitor prefers reduced motion, the zoom falls back to three fixed steps. Reduced-motion visitors never download GSAP at all.
- **License.** GSAP uses its "Standard no-charge license": free for commercial sites, including client sites, but not OSI open source. See https://gsap.com/standard-license. The license header stays in the files.

## Everything that is fake and must be replaced

- **The company.** Fern Hill Roofing does not exist.
- **Phone** `(253) 555-0147` (a number reserved for fiction) and **email** `estimates@fernhill-roofing.example`, which can't receive mail.
- **Licence number** `SAMPLE-000000`.
- **Prices and job lengths.** Set in `public/app.js` (`MATERIALS`) and repeated for 22 squares in `public/index.html`. `audit.mjs` checks that the two match.
- **Hours, reply times, warranty and insurance wording.**
- **All seven photos are AI-generated** with Higgsfield (GPT Image 2.5, about 2 credits). They are placeholders. A real site needs the company's own job photos. Never present generated photos as a real business's work or crew.

## Audit results

All of these were run on this exact code.

| Check | Result |
| --- | --- |
| Lighthouse 12.8, phone | Performance 100 · Accessibility 100 · Best practices 100 · SEO 63 |
| Lighthouse 12.8, desktop | Performance 100 · Accessibility 100 · Best practices 100 · SEO 63 |
| `audit.mjs` (5 widths, under the real `_headers` security policy) | 61 / 61 pass |
| taste-skill `inspect.mjs` | 0 failures, 1 warning (no video) |

SEO is low on purpose: the page tells search engines not to list it. For a real client, remove `<meta name="robots">` from `public/index.html` and the `X-Robots-Tag` line from `public/_headers`.

`audit.mjs` checks:

- no console errors or failed requests, and every photo loads
- no sideways scroll, nothing past the screen edge, tap targets at least 44 px
- price rows match the formula, and the slider (mouse and keyboard) updates every row, the screen-reader caption and the booking links
- GSAP stays off the first screen, loads near the zoom section, and scrubs the zoom smoothly (start, between, chimney, ridge, and back again). The three-step fallback works with GSAP blocked, and reduced-motion visitors never download it.
- one FAQ answer opens at a time
- the page reads fully with JavaScript off, and nothing animates under "reduce motion"
- axe-core finds no accessibility violations

**Problems found and fixed while building:**

- Two nearly empty screens around the pinned sentence. The photos are now larger and closer together.
- Open FAQ boxes ran 8 px past a tablet screen.
- The zoom made the house photo's box grow past its frame. It now crops the image instead (CSS `object-view-box`), with the old scaling kept as a fallback for browsers that don't support that.
- "in writing" overlapped the bottom of the house photo.
- Phones downloaded full-size photos. They now get WebP files sized to the screen, which cut the page weight from 547 KB to 258 KB.

## What to improve before showing this to a real prospect

1. **Their own photos.** The page is built around seven picture slots; swapping them in changes no layout.
2. **Real prices**, or keep only the "dry days" column.
3. **A booking form with a backend.** Right now the links open the visitor's email app, which many phone users don't have set up.
4. **Reviews.** Only real ones, with permission.
5. **A video.** The design checker wants one moving picture. A short real clip of a tear-off would fit.

## Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy sites/fern-hill-roofing-v2/public --project-name fern-hill-draft-2
```

## Run the audit

```bash
cd sites/fern-hill-roofing-v2 && npm install
CHROME_PATH=/path/to/chrome node audit.mjs public
```

## Design notes

Built with the `design-taste-frontend` skill (taste-skill v2):

- **Direction:** "The sentence is the layout", seed 1117600312.
- **Type:** Bodoni Moda and Jost (SIL Open Font License), self-hosted.
- **Colours** come from the subject instead of the dealt navy-and-pink: wet-evening navy, rain-white text, and one dry-day amber for actions.
- **No sections were redrawn.**
