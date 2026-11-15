# Staging: FULL OVERWRITE of GOROman.github.io with the new Space site

Status: PREP ONLY (revised 2026-11-15, MDX amendment same day). Do NOT push yet.
Waiting for: final frozen export of the Space page (fixes still in progress:
NESBot-mini re-survey, MRFamicom via X posts, PremaidAIHack sheet links, etc.).

## Decision (user, 2026-11-15)

- Original wording: "全部このサイトで上書きして" (overwrite everything with this site).
- This supersedes the earlier plans (add /works/, then replace portfolio only).
- The ENTIRE GitHub Pages site is replaced by the new Space-built GOROman.org
  (works timeline + tsukuttemita stream, year cross-fade, permalinks, tags).
- **Amendment (user, 2026-11-15): "mdxは残して" (keep MDX).** The /mdx/ MDX
  player is EXEMPT from the overwrite: it stays in the deploy output and
  keeps working as before. Everything in this document reflects that.
- Push target is goroman.github.io ONLY. goroman.org itself is served elsewhere
  (no CNAME in this repo; DNS is Cloudflare; live goroman.org differs).
  That unresolved delivery question is unchanged by this overwrite.

## What gets overwritten (deploy output, current -> after)

Current deploy/ (built by .github/workflows/deploy.yml):
- /index.html        <- renewal/index.html (scroll-through-web-history top)
- /portfolio.html    <- renewal/portfolio.html (tag-filter card portfolio)
- /media/            <- renewal/media/
- /old.html          <- index.old.html (retro page)
- /irc.html          <- irc.html
- /mdx/              <- Vite build of src/ (MDX player web app)

After overwrite, deploy/ contains the new site PLUS the kept MDX player:
- /index.html        <- new site (single page: works + stream + #profile view)
- /assets/           <- new site assets (photos, avatars, yt thumbs, posts/)
- /portfolio.html    <- small redirect page to / (keeps old inbound links alive)
- /mdx/              <- Vite build of src/ (MDX player web app) — **KEPT, unchanged**
    /mdx/index.html, /mdx/assets/ (hashed JS/CSS), /mdx/ds02.mdx, /mdx/mdx.wasm.js
- Hash permalinks (#w-001 / #p-001) and the copy-link canonical domain
  (https://goroman.org/) work unchanged on the single root page.

## !! Functionality that will be LOST (MDX is NOT among it) !!

- **/mdx/ MDX player is kept** per the user's "mdxは残して" decision: it is
  still built from src/ by Vite and deployed to /mdx/ exactly as today.
  Do NOT remove the Vite build, and do NOT treat a 404 on /mdx/ as expected
  (see checklist) — that would be a regression, not an accepted loss.
- /old.html (retro page) and /irc.html stop being served.
- The scroll-through-web-history top (renewal/index.html) and the current
  tag-filter portfolio are replaced by the new site.

## Preservation of the old site (recovery path)

Git history alone keeps every old file (master history up to 9e8a963 stays
reachable), and on top of that, explicit local markers were created 2026-11-15:

- Branch: `archive/site-before-2026-11-15`  -> 9e8a963 (local only, not pushed)
- Tag:    `pre-overwrite-2026-11-15`        -> 9e8a963 (local only, not pushed)

Execution-time steps (do together with the overwrite, before pushing master):
1. Push the archive branch and the tag to origin, so preservation does not
   depend on this local clone:
     git push origin archive/site-before-2026-11-15
     git push origin pre-overwrite-2026-11-15
2. (Belt and braces) Export a static copy of the current live site files
   (renewal/, index.old.html, irc.html, src/, mdx/) into
   ~/workspace/goroman-org-renewal/stale-local-backup-2026-11-15/ style backup
   folder outside the repo, e.g. site-archive-before-overwrite-2026-11-15/.

Rollback at any time:
- `git revert` the overwrite commit on master and push, or
- restore deploy config + files from the archive branch/tag, or
- check out 9e8a963 into a hotfix branch and push that to master.

## File layout in the repo (new site source of truth)

- Put the frozen Space export in a new top-level folder:
    site/index.html
    site/assets/...
- Keep the old sources (renewal/, src/, mdx/, index.old.html, irc.html) in the
  repo for the first overwrite commit; deleting them from the repo tree is a
  separate later cleanup, NOT part of the first overwrite. Only the DEPLOY
  output changes. (This keeps the diff reviewable and rollback trivial.)
- **MDX build inputs are NOT old sources — they stay live:** src/, mdx/,
  public/, vite.config.ts, package.json and package-lock.json must remain
  in the repo and keep building, because deploy.yml runs the Vite build
  from them on every push. Never delete or "clean up" these in this
  overwrite.

## deploy.yml changes (keep the Vite/MDX build; replace only the prepare step)

File: .github/workflows/deploy.yml

- **Keep unchanged:** Checkout (submodules: recursive), Setup Node.js,
  `npm ci`, and the "Build Vite app" step (`npm run build`). The MDX player
  still needs all of them — do NOT remove `npm run build` or `npm ci`.
- **Replace only** the "Prepare deploy directory" step with:
    mkdir -p deploy
    # 1) New site at the root
    cp site/index.html deploy/
    cp -r site/assets deploy/
    # 2) Redirect so existing /portfolio.html links do not 404
    printf '<!doctype html><meta http-equiv="refresh" content="0; url=/"><link rel="canonical" href="/"><title>GOROman.org</title><a href="/">GOROman.org</a>' > deploy/portfolio.html
    # 3) MDX player, kept: Vite output goes under deploy/mdx/ (as today)
    mkdir -p deploy/mdx
    cp -r dist/* deploy/mdx/
- Do NOT copy renewal/*, index.old.html or irc.html anymore.
  (dist/* is still copied — but ONLY into deploy/mdx/, never to the root.)

### Why site/ and the MDX build do not collide

Verified against vite.config.ts / package.json on 2026-11-15:

- Vite is configured `base: '/mdx/'` (build), `build.outDir: 'dist'`,
  `assetsDir: 'assets'`. So `npm run build` produces a self-contained tree
  in dist/ (dist/index.html, dist/assets/<hashed js/css>, plus the public/
  files dist/ds02.mdx and dist/mdx.wasm.js at its root) whose asset URLs
  are already prefixed /mdx/.
- The new site occupies the deploy ROOT (deploy/index.html +
  deploy/assets/...); the MDX app occupies the deploy/mdx/ SUBTREE
  (deploy/mdx/index.html + deploy/mdx/assets/...). Different directories,
  so the two index.html files and the two assets/ folders never overwrite
  each other, and the hashed Vite asset names cannot clash with the new
  site's asset names.
- Rules that keep it collision-free:
  1. Copy in the order above; `cp -r dist/*` targets deploy/mdx/ ONLY.
  2. The Space export placed in site/ must contain ONLY index.html and
     assets/ at its top level. If an export ever contains a top-level
     `mdx` entry, STOP — rename/relocate it before deploying, or it will
     shadow the player.
  3. The new site's own asset URLs must stay relative (or root-based
     without the /mdx/ prefix) so nothing under /mdx/ is requested by the
     root page, and vice versa.
  4. Local dry-runs must serve deploy/ from the server root (not from a
     subpath or file://), because the MDX app's asset URLs are absolute
     /mdx/... paths — the same condition it already runs under today.

## Execution order (when the Space final version is frozen)

1. Confirm the Space export is final (all in-flight fixes landed) and export it.
2. Place export into site/ on branch works-space-2026-11-15, and confirm
   site/ contains only index.html + assets/ at the top level (no mdx entry).
3. Push archive branch + tag (Preservation step 1) and take the folder backup.
4. Apply the deploy.yml changes above (keep npm ci + Vite build; replace
   only the "Prepare deploy directory" step).
5. Dry-run locally: run `npm ci` and `npm run build` first (MDX -> dist/),
   then assemble deploy/ by hand with the same commands as deploy.yml and
   serve deploy/ from the server root. Sanity-check BOTH the new site at /
   and the MDX player at /mdx/ from that single deploy/ tree.
6. Pre-commit checks: total asset size (stream photos ~22MB / 271 files at
   last count; every single file well under GitHub's 100MB limit),
   no absolute paths that break on github.io, dark mode, mobile layout,
   Vite build succeeds and dist/ output is complete (index.html, assets/,
   ds02.mdx, mdx.wasm.js).
7. Commit on the works branch, review the diff, then merge to master and push
   (this is the step that publishes; do it only on the user's final go).
8. Verify live on goroman.github.io (checklist below).

## Post-overwrite verification checklist

- [ ] https://goroman.github.io/ shows the NEW site at the root
- [ ] Works timeline, year sections and background cross-fade work
- [ ] Permalink #w-001 and #p-001 open, auto-scroll and highlight
- [ ] #profile separate view opens
- [ ] Search/tags unlock behaviour and tag filtering work
- [ ] X embeds load (facade -> embed), fallbacks show on failure
- [ ] /portfolio.html redirects to /
- [ ] /mdx/ serves the MDX player as before (user decision "mdxは残して"):
      the player UI loads from /mdx/index.html + /mdx/assets/, and a sample
      MDX file (ds02.mdx, with mdx.wasm.js) actually plays — a 404 or a
      broken/blank player here is a REGRESSION, not an expected loss
- [ ] New site at / and MDX at /mdx/ do not shadow each other: root page
      assets load from /assets/ (not /mdx/assets/) and vice versa
- [ ] /old.html and /irc.html return 404 (expected)
- [ ] Mobile: no horizontal scroll, margins OK; dark mode OK
- [ ] Archive branch + tag exist on origin (preservation pushed)
- [ ] Rollback path understood: revert overwrite commit restores old site

## Unresolved (unchanged)

- goroman.org itself is NOT served from this repo. Pushing here updates
  goroman.github.io only. Reflecting the new site on goroman.org needs its
  delivery source identified separately.
