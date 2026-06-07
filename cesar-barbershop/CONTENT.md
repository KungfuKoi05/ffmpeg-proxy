# Content status

The shop's real details are now in the page. Here's what's live vs. still optional.

## Live & real ✅
- **Name:** Cesar Barber Shop
- **Booking** → `https://cesarbarbershop.setmore.com/` (every "Book" / "Reservar" button)
- **Directions / Reviews** → `https://maps.app.goo.gl/sLoc4hKyQqMyccCq6?g_st=ic`
- **Address:** 14902 Union Ave SW D, Lakewood, WA 98498 (also drives the map embed + JSON-LD)
- **Hours (PT):** Mon 8–5 · Tue Closed · Wed–Sat 8–5 · Sun Closed
- **Services & pricing:**
  - Men's Cut — $45
  - Cut & Beard — $60
  - Full Cut + Beard + Face Mask — $65
  - Beard — $30
  - Boy's Cut — $35
  - Monday Military — $35
  - Line-Up — $21
  - Eyebrows — $15

## Still optional / placeholder 🔧
| Where | Status | To finalize |
|-------|--------|-------------|
| Phone number | Not provided | Add a `tel:` contact line if you want one shown |
| Reviews section | 3 generic testimonials | Replace with real Google review quotes + names (the "Read Reviews on Google" button already links to your listing) |
| JSON-LD `telephone` / `image` | empty | Optional: add for richer SEO |
| Map embed | uses address query | Optional: paste the official "Embed a map" iframe from your Google listing for an exact pin |

## Photos 📸
Drop real shop photos into `assets/` with these exact names and the page uses
them automatically (otherwise it shows tasteful styled placeholders):

- `assets/barber-at-work.jpg` — About section (portrait, ~4:5)
- `assets/gallery-1.jpg` … `assets/gallery-6.jpg` — Gallery grid (landscape/square)

Real photos of the shop, barbers and finished cuts are the single biggest
upgrade left.
