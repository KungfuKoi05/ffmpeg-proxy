# Cesar Barbershop — Landing Page

A premium, fully responsive, single-page marketing site for **Cesar Barbershop**,
with online booking and directions wired straight to the shop's real links.

> **Note on location:** this site was staged inside the `ffmpeg-proxy` repo
> because the build environment's GitHub access is scoped to that repo and could
> not create a new one. It lives in this self-contained `cesar-barbershop/`
> folder so it can be lifted into its own repository at any time — just copy the
> folder's contents to a new repo root.

## What's inside
```
cesar-barbershop/
├── index.html     # markup + SEO meta + JSON-LD business schema
├── styles.css     # all styling (no framework, no build step)
├── script.js      # sticky header, mobile nav, scroll reveals, image fallbacks
├── assets/        # drop real shop photos here (see CONTENT.md)
├── CONTENT.md     # the exact text/photos to swap in for real data
└── README.md
```

## Highlights
- **Real CTAs:** every "Book" button → the Setmore page; "Directions"/"Reviews" → the Google Maps listing.
- **No build step / no dependencies** — pure HTML/CSS/JS. Loads fast, hosts anywhere.
- Responsive down to mobile, with a slide-in nav and a floating "Book" button.
- Accessible: semantic landmarks, skip link, focus states, `prefers-reduced-motion` support, alt fallbacks.
- SEO-ready: meta + Open Graph + `BarberShop` structured data for rich Google results.
- Graceful image handling: real photos appear automatically when added; otherwise styled placeholders show (never a broken-image icon).

## Run locally
It's static — just open `index.html`, or serve it:
```bash
cd cesar-barbershop
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy (pick one)
- **GitHub Pages:** move this folder to a repo root (or set Pages source to it) → Settings → Pages.
- **Netlify / Vercel / Cloudflare Pages:** drag-and-drop the folder, or point it at the repo. No build command; publish directory = this folder.

## Before going live
See **`CONTENT.md`** for the short checklist of real details (address, phone,
hours, service prices, review quotes, photos) to drop in.
