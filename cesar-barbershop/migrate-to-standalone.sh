#!/usr/bin/env bash
# ============================================================
# Migrate the Cesar Barber Shop landing page into its own
# standalone GitHub repo and turn on free GitHub Pages hosting.
#
# Run this ON YOUR OWN MACHINE (not the cloud session), where you
# have `git` and the GitHub CLI `gh` installed and authenticated:
#     gh auth login        # one-time, if you haven't already
#
# Usage:
#     ./migrate-to-standalone.sh [repo-name]   # default: cesar-barbershop
# ============================================================
set -euo pipefail

REPO="${1:-cesar-barbershop}"
SRC="$(cd "$(dirname "$0")" && pwd)"   # this folder (the site)

command -v git >/dev/null || { echo "git is required"; exit 1; }
command -v gh  >/dev/null || { echo "GitHub CLI (gh) is required: https://cli.github.com"; exit 1; }

OWNER="$(gh api user -q .login)"
echo "→ Creating repo '$OWNER/$REPO' from the site in: $SRC"

# Build a clean copy that becomes the repo root (site at top level).
TMP="$(mktemp -d)"
cp -R "$SRC"/. "$TMP"/
rm -f "$TMP/migrate-to-standalone.sh"   # don't ship the migrator itself

cd "$TMP"
git init -q
git add .
git commit -qm "Initial commit: Cesar Barber Shop landing page"
git branch -M main

# Create the repo and push (prompts only if the name already exists).
gh repo create "$OWNER/$REPO" --public --source=. --remote=origin --push

# Turn on GitHub Pages: serve main branch at the root.
echo "→ Enabling GitHub Pages…"
if gh api -X POST "repos/$OWNER/$REPO/pages" \
     -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1; then
  echo "✓ Pages enabled."
else
  echo "  (Could not auto-enable — turn it on once at:"
  echo "   https://github.com/$OWNER/$REPO/settings/pages  → Source: main / root)"
fi

echo ""
echo "✅ Done!"
echo "   Repo:  https://github.com/$OWNER/$REPO"
echo "   Site:  https://$OWNER.github.io/$REPO/   (live in ~1 min after Pages builds)"
