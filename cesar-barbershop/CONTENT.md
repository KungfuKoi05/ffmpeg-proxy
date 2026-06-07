# Content to confirm / replace

The source links (Setmore booking page and the Google Maps listing) could **not
be fetched from the build environment** — its network policy blocks
`setmore.com` and `google.com/maps` (`x-deny-reason: host_not_allowed`). So the
text below uses realistic, professional **placeholder** content. The booking and
directions links, however, are the **real** ones you provided and work for
visitors.

Swap these out with the shop's real details (search `index.html` for each item):

## Real links already wired in ✅
- **Booking** → `https://cesarbarbershop.setmore.com/` (every "Book" button)
- **Directions / Reviews** → `https://maps.app.goo.gl/sLoc4hKyQqMyccCq6?g_st=ic`

## Replace with real info 🔧
| Where | Placeholder | Replace with |
|-------|-------------|--------------|
| Visit → Contact | "Add your street address here" | Real street address |
| Visit → Contact | "Add your phone number" (`tel:+10000000000`) | Real phone (update both text and `href="tel:"`) |
| Hours (Visit + Footer) | Tue–Fri 9–7, Sat 8–5 | Real opening hours |
| Services & Pricing | 6 sample services & prices | Real service menu from Setmore |
| Reviews | 3 sample testimonials | Real Google review quotes + names |
| `<script type="application/ld+json">` (in `<head>`) | empty address/phone | Fill in for SEO |
| Map embed | `?q=Cesar%20Barbershop` | Paste the official "Embed a map" iframe from the Google listing for an exact pin |

## Photos 📸
Drop real shop photos into `assets/` with these exact names and the page will
use them automatically (otherwise it shows tasteful styled placeholders):

- `assets/barber-at-work.jpg` — About section (portrait, ~4:5)
- `assets/gallery-1.jpg` … `assets/gallery-6.jpg` — Gallery grid (landscape/square)

Recommended: real photos of the shop, barbers, and finished cuts — they're the
single biggest upgrade to this page.
