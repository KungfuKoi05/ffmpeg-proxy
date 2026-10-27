# TOONHUB hero

A full-viewport figurine carousel built with React, TypeScript, Vite, Tailwind CSS v4 and `lucide-react`. The whole component is `src/ToonhubHero.tsx`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run lint
```

## Notes

- The four figurine PNGs are hot-linked from `fifth-gentle-45902158.figma.site`. If that Figma site is unpublished or re-exported, the URLs (which contain content hashes) stop working. Copy the files into `public/` before shipping.
- Each figurine also animates `height`, `bottom` and `z-index`, on top of the specified `transform`, `filter`, `opacity` and `left`. Without them, a side figure jumps from 28% to 92% tall on the first frame of a swap, and the back figure pops in front of the outgoing centre one. To get the original behaviour, remove those three names from `ITEM_TRANSITION`.
- On desktop the centre figurine is drawn at 92% of the viewport height × `scale(1.68)`, about 155% of the screen. It only fits if the PNGs have plenty of transparent space around the figure.
