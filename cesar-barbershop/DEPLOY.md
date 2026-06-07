# Deploy — standalone repo + free hosting

The cloud session that built this site is locked to the `ffmpeg-proxy` repo and
can't create a new one, so the final "make it a standalone repo" step runs from
your machine (or your GitHub account). Pick whichever path you like — all three
are free.

The site uses **relative paths** for everything, so it works at any URL or
subpath without changes.

---

## ⭐ Path A — One command: standalone repo + GitHub Pages (recommended)

On your own computer, with [`gh`](https://cli.github.com) installed and logged in
(`gh auth login`):

```bash
# from inside this cesar-barbershop folder
./migrate-to-standalone.sh            # or: ./migrate-to-standalone.sh my-repo-name
```

This creates `github.com/<you>/cesar-barbershop`, pushes the site as the repo
root, and turns on Pages. Your site goes live at:

```
https://<you>.github.io/cesar-barbershop/
```

---

## Path B — Netlify drag-and-drop (cleanest URL, no git/CLI)

1. Download/copy this `cesar-barbershop/` folder.
2. Go to https://app.netlify.com/drop and drag the folder in.
3. Live instantly at `https://<random-name>.netlify.app` — rename it in
   **Site settings → Change site name** to e.g. `cesar-barbershop`.

`netlify.toml` (security headers + asset caching) is already included.
To auto-deploy on every change instead, connect the repo in Netlify with
**publish directory = `.`** (root) and no build command.

---

## Path C — GitHub Pages on the *current* repo (fastest, no new repo)

Once PR #2 is merged into `ffmpeg-proxy`'s `main`, you can serve this subfolder
via a GitHub Actions workflow. Ask and I'll add `.github/workflows` that
publishes `cesar-barbershop/` to Pages — it'd be live at
`https://<you>.github.io/ffmpeg-proxy/`. (URL isn't as clean as Path A.)

---

## Custom domain (any path)

After it's live, add a custom domain (e.g. `cesarbarbershop.com`) for free:
- **GitHub Pages:** repo → Settings → Pages → Custom domain.
- **Netlify:** Site → Domain management → Add domain.

Then point your domain's DNS at the host per their on-screen instructions.
