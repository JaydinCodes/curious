# The Curiosity Catalog

A static, single-file learning catalog: 217 entries across 18 sections. No build step, no framework. The page is `index.html`; the only other code is one serverless function (`api/progress.js`) that powers optional cross-device sync.

## Deploy

### Option A: Vercel CLI (fastest)

```bash
npm i -g vercel          # once
vercel                   # preview URL
vercel --prod            # production URL
```

First run asks you to log in and to confirm the project settings. Accept the defaults: framework `Other`, no build command, output directory `.`. Vercel installs `@upstash/redis` from `package.json` automatically and deploys `api/progress.js` as a function.

### Option B: GitHub, for a real deploy pipeline

```bash
git init && git add . && git commit -m "curiosity catalog"
gh repo create curiosity-catalog --public --source=. --push
```

Then import the repo at https://vercel.com/new. Every push to `main` redeploys.

## Sync setup (optional)

The site works fully without this — marks just stay per-browser. To sync between devices:

1. **Create the Redis store.** Vercel KV no longer exists as a product; it became the Upstash integration on the Vercel Marketplace (Dec 2024). In your Vercel project: **Storage → Create Database → Upstash for Redis** (also listed as "Upstash KV"), pick the free plan, and connect it to this project.
2. **Env vars are injected automatically** when you connect the store. Depending on which product/prefix you picked, that's either `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` + `KV_REST_API_TOKEN`. The function accepts **either pair** — no renaming needed. (Setting them by hand under Project → Settings → Environment Variables also works; values come from the Upstash console.)
3. **Redeploy** (`vercel --prod` or push). That's it — the "sync: off" control under the progress bar can now be turned on.

Until the env vars exist, `/api/progress` answers `503 sync not configured` and the page quietly stays in local-only mode.

### How sync behaves

- **localStorage is the source of truth.** The page renders and works entirely from local data; sync is a background copy. Offline or with sync off, nothing blocks or breaks.
- **Pull on load, debounced push on change.** A burst of clicks becomes one write about 2 s later, plus a keepalive flush when the tab is hidden.
- **Merging is union, on the client, before every push.** Done-marks union; per-topic `lastTouched` takes the newer timestamp; pins union capped at 3 (most recent win); the streak follows the newer day. `updatedAt` is display-only and never used to discard marks.
- **The accepted tradeoff:** removals don't propagate reliably. If you un-mark a topic (or "Clear all marks") on one device, another device that still holds those marks locally will union them back on its next sync. To truly clear everything, clear on each device — or turn sync off, clear, and start a fresh code. Resurrecting a mark was chosen over ever silently losing one.

### Security model, plainly

- The sync code is a **bearer secret**: 128 bits of browser-generated randomness (32 hex chars). Anyone who has it can read and overwrite that one record; nobody without it can find it — unknown codes return an empty record, indistinguishable from a fresh one, so codes can't be probed or enumerated.
- There is **no account and no recovery**. Lose the code (and every paired device), and the record is orphaned; generate a new code and carry on — your local marks are still on your devices.
- What's in the record if leaked: which topics you've marked done/pinned/opened, and timestamps. That's the entire blast radius. For a personal reading tracker this is a reasonable trade for having no logins and no server to run. Don't reuse this pattern for anything sensitive.
- Server-side the function validates code format, whitelists the record shape, caps payload size (64 KB), and rate-limits per IP (100 req/min) via the same Redis. Records live under `cc:<code>` with no TTL — a full record is ~15 KB.

## Curated links

By default Watch/Read are *search* links (YouTube/Wikipedia). Curation upgrades individual topics to hand-verified resources, tracked in `curated-links.json` (a sidecar keyed by topic code) and loaded at runtime — the `topics` array is never touched. A curated chip shows a small **filled** marker; a plain search chip shows an **outline** one. Topics with no curated entry keep their search links, so curation can grow one section at a time. The **Mind & Behavior** section (MIND.01–MIND.12) is curated; the rest are on search fallback by design.

- **Extending it / the rubric:** see [CURATING.md](CURATING.md).
- **Verify links:** `npm run verify-links` (or `node verify-links.js MIND` for one section). No dependencies; run it after any change and periodically to catch link rot.
- **Local testing needs a static server, not `file://`.** The page fetches `./curated-links.json`, and browsers block `fetch` of a local file over `file://` (CORS). Opening `index.html` by double-click still works — it just silently falls back to search links. To see curated links locally, serve the folder:
  ```bash
  npx serve .            # or: npm run serve
  # or: python -m http.server
  ```
  then open the printed `http://localhost:…` URL. On Vercel this is a non-issue; the JSON is served over HTTPS.

## Notes

- `vercel.json` sets clean URLs, a few security headers, `no-store` on the API, and stops `index.html` from being cached stale.
- Curated links are read-only reference data, so they are deliberately **not** part of the sync payload — only your own progress (`done`/`touched`/`pins`/`streak`) syncs.
- Storage keys, all under the `curiosity-catalog:` prefix in localStorage: `done` (code → 1, the original key — existing installs keep their marks), `touched` (code → last-opened ms), `pins` (code → pinned-at ms, max 3), `streak` (`{current, best, lastDay}`), `sync` (`{code, lastSyncAt}`).
- The streak counts local-timezone calendar days with at least one mark-done. A lapse just resets it to 0 — deliberately no warnings, colors, or "streak broken" copy anywhere.
- The "Currently exploring" shelf, streak line, neglected-drawer hint, and sync control are all built by the second `<script>` block (`progress+`); if it ever throws, the original catalog keeps working untouched.
- Adding entries: edit the `topics` array in `index.html`. Each entry is `{c: sectionKey, t: title, h: hook, w: youtubeQuery, r: wikipediaQuery}`. Codes and counts are generated at runtime, so you never renumber anything by hand.
