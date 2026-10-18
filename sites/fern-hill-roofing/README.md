# Fern Hill Roofing (sample site)

A one-page website for a **made-up** Tacoma roofing company. It is an example of the "free sample site"
step in the website-agency outreach plan: what a prospect would see before they pay.

Plain HTML, CSS and JavaScript in `public/`. No build step, no framework, about 140 KB in total.

## What is on the page

| Section | What it does |
| --- | --- |
| First screen | Company name, four section links, a drawn rainy street with a tarped roof, rain facts, and a "Book a free inspection" button |
| Moving band | "Tear-offs on dry days only" scrolls sideways |
| Built for rain | Why roofs fail in Tacoma (edges, flashing, moss) and how this company builds against it |
| Prices | **The interactive part.** Pick a material, slide to your roof size, and see a price range and the number of dry days the job needs. The booking links pick up your choice. |
| How a job runs | Five stages: inspect, estimate, schedule, build, clean up |
| Every layer | One roof cross-section drawing cut across a grid of tiles |
| A small local crew | Service area, office hours, what an inspection involves |
| Questions | Seven common questions, one open at a time |
| Book an inspection | Name and address. It opens the visitor's email app with the request written out. |

## Everything that is fake and must be replaced

- **The company.** Fern Hill Roofing does not exist.
- **Phone** `(253) 555-0147`: 555-01xx numbers are reserved for fiction.
- **Email** `estimates@fernhill-roofing.example`: `.example` domains cannot receive mail.
- **Licence number** `SAMPLE-000000`.
- **Prices and job lengths.** Set in `public/app.js` (`MATERIALS`) and repeated in the price rows in `public/index.html`. Both have to change together; `tools/site-audit` checks that they match.
- **Material lifespans** on the price tabs (25–30, 40+, 25–35 years) are rough industry rules of thumb.
- **Service radius, office hours, the warranty wording and the insurance policy** in the FAQ.
- **All pictures are drawings.** A real site needs the company's own job photos (see "What to improve").

The two weather figures are real but approximate. Tacoma averages about 7 inches of rain in November and under 1 inch in July, according to [WeatherSpark](https://weatherspark.com/y/924/Average-Weather-in-Tacoma-Washington-United-States-Year-Round) and a [CoCoRaHS station near Tacoma](https://media.cocorahs.org/wys/2017-2018/WA/WA-PR-45-wys-2017-2018.html).

## Audit results

Everything below was run on this exact code.

**Lighthouse 12.8** (phone and desktop):

| | Phone | Desktop |
| --- | --- | --- |
| Performance | 100 | 100 |
| Accessibility | 100 | 100 |
| Best practices | 100 | 100 |
| SEO | 60 | 60 |

The SEO score is low on purpose. The page tells search engines not to list it, because it is a sample. Remove `<meta name="robots">` from `public/index.html` and the `X-Robots-Tag` line from `public/_headers` for a real client.

**`tools/site-audit`: 54 of 54 checks pass.** It loads the page under the real `_headers` security policy at 320, 390, 768, 1024 and 1440 px wide, and checks:

- no console errors, no failed requests, no sideways scroll
- tap targets at least 44 px on phones
- every price row matches the calculator formula
- the tabs, slider, accordions and contact form behave correctly, including arrow keys on the tabs
- the page is fully readable with JavaScript off
- moving parts stop under "reduce motion"
- axe-core finds no accessibility violations

**Bugs found and fixed.** The audit caught 1–5; 6 and 7 were caught by reading the code before the audit ran:

1. The price tabs made the page 2 px wider than a 320 px phone, so it scrolled sideways.
2. No site icon, so every visit logged a 404 error.
3. The roof-size slider was 28 px tall: too small to grab with a thumb.
4. The footer phone, email and links were 17–18 px tall and too close together to tap.
5. The "sample site" notice sat outside any page landmark, which confuses screen readers.
6. The price rows and the calculator disagreed on job length (a 15-square roof said "1–2 days" but calculated 2).
7. The first draft of the security policy would have blocked the page's own startup script and inline styles.

**The design checker (taste-skill `inspect.mjs`)** still reports one failure: **no real photographs**. Every picture is drawn in SVG, because this build environment could not reach any photo library. It also gives two warnings it accepts as deliberate:

- the four equal navigation tiles, which the layout calls for
- no video

## What to improve before showing this to a real prospect

1. **Real photos.** This is the biggest gap. Use the prospect's own job photos (only with their permission) or generated images. The drawings can stay as the "how it's built" diagrams.
2. **Real prices** from the roofer, or drop the dollar figures and keep only "dry days needed".
3. **A real form backend** (Cloudflare Pages Functions, Formspree or similar) instead of opening the visitor's email app. Many phone users have no email app set up.
4. **Reviews.** Only real ones from their Google profile, with permission. None are invented here on purpose.
5. **Local SEO**: `LocalBusiness` structured data with the real name, address and phone, once they exist.

## Deploy to Cloudflare Pages

Needs a Cloudflare account and the `wrangler` CLI logged in (`npx wrangler login`).

```bash
npx wrangler pages deploy sites/fern-hill-roofing/public --project-name fern-hill-sample
```

`public/_headers` sets the security policy, a "do not index" header, and long caching for the fonts. Cloudflare compresses HTML, CSS and JS by itself.

## Run the audit

```bash
cd tools/site-audit && npm install
CHROME_PATH=/path/to/chrome node audit.mjs ../../sites/fern-hill-roofing/public
```

## Design notes

Built with the `design-taste-frontend` skill (taste-skill v2):

- **Direction:** "The well-kept board", seed 572922207: a page of tiles fitted edge to edge, like shingles on a roof.
- **Redraw:** the "team portraits" section became "wide picture, colour tile, facts", because a made-up company has no team photos to show.
- **Colours** come from the subject instead of the dealt plum and pink: wet slate, moss green, and storm-tarp blue for the buttons.
- **Fonts:** Libre Franklin and Source Serif 4 (SIL Open Font License), self-hosted.
