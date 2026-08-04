# Growth Architecture

Phase 3 adds shareable discovery, social metadata, curated landing pages and first-party aggregate analytics without turning the catalogue into an account-based product.

## Shareable topic URLs

Production topic URLs use a stable code-first path:

```text
/topics/comp-01-how-the-internet-actually-works
```

The topic code is authoritative. The descriptive suffix may change without breaking resolution.

Local static servers and Codespaces previews fall back to:

```text
/topic.html?code=COMP.01
```

Vercel rewrites production topic paths to `api/topic-page.js`, which returns the existing learning-page HTML with server-rendered canonical, Open Graph, Twitter and JSON-LD metadata.

## Social preview cards

`api/og.js` generates 1200 × 630 PNG cards for topics and collections:

```text
/api/og?code=COMP.01
/api/og?collection=best-computing-topics
```

Topic and collection HTML reference these images in their Open Graph and Twitter metadata.

## Topic of the day

`/today` redirects to one deterministic topic per UTC calendar day. The homepage uses the same pure selection function, so every visitor sees the same daily topic.

The selection is not personalised and does not require storage or analytics.

## Curated collections

Collections are configured in `src/data/collections.js` and served at clean URLs such as:

```text
/collections/best-computing-topics
/collections/best-topics-for-developers
```

Each collection is an explicit ordered list of stable topic codes. Tests fail when a collection references a missing topic.

## Privacy-conscious analytics

The browser sends four aggregate product events:

- `search`
- `draw`
- `complete`
- `resource_click`

The application does **not** send or store:

- raw search text
- notes or reflections
- resource URLs
- sync codes
- names or email addresses
- cookies or user identifiers
- session identifiers
- IP addresses or user agents in the analytics record

Searches are reduced to broad query-length and result-count buckets. Resource clicks are reduced to topic code, resource slot and resource type.

Global Privacy Control and Do Not Track disable analytics automatically. Users can also disable analytics for their browser at `/privacy`.

The endpoint increments aggregate Redis counters only. It is deliberately best-effort: analytics failures never block catalogue features.

## Analytics report

With the Upstash environment variables available locally:

```bash
npm run analytics:report
```

The report prints all-time event totals and the most common aggregate dimensions.

## Search discovery

Dynamic endpoints provide:

```text
/sitemap.xml
/robots.txt
```

The sitemap contains the homepage, every curated collection and all topic URLs.

## Local development

Use Vercel's development server when testing clean routes and server functions:

```bash
npm install
npm run curation:build
npm run check
npm run dev
```

A plain static server still works for catalogue and learning-page development:

```bash
npm run serve
```

Static previews use query-string fallback URLs because they cannot execute Vercel rewrites or server functions.

## Deployment checklist

- Open and refresh a clean `/topics/...` URL directly.
- Open both `/collections/...` landing pages.
- Confirm `/today` redirects consistently during the same UTC day.
- Open `/api/og?code=COMP.01` and confirm a 1200 × 630 PNG response.
- Inspect topic HTML without running JavaScript and confirm canonical and Open Graph tags are present.
- Validate `/sitemap.xml` and `/robots.txt`.
- Test search, draw, completion and resource-click counters with `npm run analytics:report`.
- Disable analytics on `/privacy` and confirm counters stop changing for that browser.
- Re-test notes, progress import/export, pins and cloud sync.

## Lockfile

Phase 3 adds `@vercel/og` and `react`. Run `npm install` and commit the regenerated `package-lock.json` before merging.
