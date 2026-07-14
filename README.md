# The Curiosity Catalog

A static, single-file learning catalog: 217 entries across 18 sections. No build step, no dependencies, no framework. Just `index.html`.

## Deploy

### Option A: Vercel CLI (fastest)

```bash
npm i -g vercel          # once
cd curiosity-catalog
vercel                   # preview URL
vercel --prod            # production URL
```

First run asks you to log in and to confirm the project settings. Accept the defaults: framework `Other`, no build command, output directory `.`.

### Option B: drag and drop

Zip this folder, then drop it on https://vercel.com/new. Nothing else to configure.

### Option C: GitHub, for a real deploy pipeline

```bash
cd curiosity-catalog
git init && git add . && git commit -m "curiosity catalog"
gh repo create curiosity-catalog --public --source=. --push
```

Then import the repo at https://vercel.com/new. Every push to `main` redeploys.

## Notes

- `vercel.json` sets clean URLs, a few security headers, and stops `index.html` from being cached stale.
- Progress marks are stored in `localStorage` under `curiosity-catalog:done`, scoped to the deployed origin. They are per-browser, not synced.
- Adding entries: edit the `topics` array in `index.html`. Each entry is `{c: sectionKey, t: title, h: hook, w: youtubeQuery, r: wikipediaQuery}`. Codes and counts are generated at runtime, so you never renumber anything by hand.
