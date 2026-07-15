# Curating resources

The catalog ships with search-based Watch/Read links: they always work, but a
search is a coin flip. Curation replaces that coin flip, one topic at a time,
with a link someone actually checked. This file is the runbook so a future
session (yours or Claude Code's) can extend coverage without re-deriving the
rules.

## The golden rule

**Never put a URL in `curated-links.json` that you have not fetched and
confirmed resolves to the thing you claim it is.** A dead or wrong link is
strictly worse than the honest search fallback. If you can't find a resource
that clears the bar below, leave the topic out — it keeps its search links,
and that is a correct outcome, not a gap.

## How it fits together

- **`curated-links.json`** — a flat map keyed by topic code (`MIND.01`). Sidecar
  data; the `topics` array in `index.html` is never hand-edited. A code with no
  entry, or a file that fails to load, falls through to search.
- **`index.html`** — fetches the JSON at runtime and upgrades matching chips
  (filled marker = curated, outline = search), adds a "deeper" chip when
  present, and appends `· N curated` to the header meta line. All additive.
- **`verify-links.js`** — the machine gate. Run it after every change.

## Schema

Every field is optional. Include what you have; omit the rest.

```jsonc
{
  "MIND.01": {
    "note": "one line, for future-you — why this pick, not shown in the UI",
    "video": {
      "title": "Exact title of the video",
      "url": "https://www.youtube.com/watch?v=...",
      "source": "Channel name",
      "verifiedAt": "2026-07-16"          // ISO date you confirmed it
    },
    "article": {
      "title": "Article title",
      "url": "https://...",
      "source": "Publisher",
      "verifiedAt": "2026-07-16",
      "paywalled": false                  // true if it hits a hard paywall
    },
    "deeper": {
      "title": "Book / paper / doc / course title",
      "url": "https://...",
      "type": "book"                      // book | paper | documentary | course
    }
  }
}
```

Notes:
- `video`, `article`, `deeper` are each independent — curate whichever you can
  verify. One good article beats a padded pair.
- `video.url` should be a real `youtube.com/watch?v=` or `youtu.be/` link
  (playlists/channels aren't liveness-checkable the same way). Non-YouTube
  video hosts are fine too; they're checked by HTTP status.
- Keys that aren't topic codes (like `_meta`) are ignored by both the site and
  the verifier, so leave `_meta` in place.

## The quality bar (per domain, not one generic rubric)

Use judgment for the section you're curating. Find who *currently* holds the
bar — don't assume a name from memory is still the right pick; channels decline,
papers get retracted or superseded. Verify recency where it matters.

- **Physics / maths / engineering** — explainers with a real accuracy track
  record over view-count winners. Primary/established institutions for the
  article.
- **Philosophy / theology** — Stanford Encyclopedia of Philosophy (SEP),
  Internet Encyclopedia of Philosophy (IEP), or serious academic overviews
  over pop-philosophy channels.
- **History** — resources that *debunk or contextualize* fringe claims, not
  credulous retellings. This matters most for entries the catalog already
  frames as false-but-instructive (e.g. the Phantom Time Hypothesis): the link
  should explain why it's wrong and how we know.
- **Psychology / mind** — prefer the primary study or a rigorous secondary
  source, especially for effects with a contested pop version (Dunning-Kruger's
  statistical critique, the Kitty Genovese/bystander myth, mirror-neuron
  overclaiming, oversold sleep claims). Link the correction, not the myth.
- **Craft / food** — educators known for rigor (the science, tested method)
  over lifestyle-content volume.

Always, regardless of domain:
- **Link out only.** Never scrape or embed article text/transcripts.
- No pirated scans, no sketchy re-uploads, no SEO content farms, no low-effort
  AI-summary sites. Prefer primary sources and track-record publishers/creators.
- Prefer a non-paywalled article where an equally good one exists; if the best
  source is paywalled, use it and set `paywalled: true`.

## Verifying

```bash
npm run verify-links          # check every URL
node verify-links.js MIND     # only codes starting MIND
```

- **PASS** — 2xx (or, for YouTube, the oEmbed endpoint confirms the video is
  live; a deleted YouTube video returns HTTP 200 on the page, so status alone
  lies — the verifier checks oEmbed instead).
- **WARN** — reachable but needs a human glance: a bot-wall (401/403) or an
  unresolved redirect. Not a failure; open it yourself and confirm.
- **FAIL** — 4xx/5xx, network error, or a dead YouTube video. Fix or remove
  before committing. The script exits non-zero if anything FAILs.

## Extending coverage (the exact ask)

To curate a section, tell Claude Code:

> Curate the **Mathematics** section (MATH.01–MATH.12) using CURATING.md's
> rubric. Research current best-in-class resources, fetch every candidate to
> confirm it resolves and is what you claim, then add entries to
> curated-links.json. Run `npm run verify-links MATH` and show me the report
> before committing. Leave anything you can't verify on the search fallback.

Then review the `note` fields and the verifier report before committing. Done a
few sections in, re-run the full `npm run verify-links` occasionally to catch
rot in older entries.
