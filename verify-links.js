#!/usr/bin/env node
// verify-links.js — liveness check for curated-links.json.
//
// The whole point of curation is that a link was actually checked once. Links
// rot, so this is a reusable gate, not a one-off: run it whenever curation
// grows and periodically to catch decay.
//
//   node verify-links.js            # check every URL, print a report
//   npm run verify-links
//   node verify-links.js MIND       # only codes starting "MIND"
//
// No dependencies — uses Node's built-in fetch (Node 18+). Exit code is 0 only
// when nothing FAILed, so it can gate a commit hook or CI later.
//
// Why not just check the HTTP status? For most hosts, 2xx == alive is fine.
// YouTube is the exception: a deleted or private video still returns HTTP 200
// with an "unavailable" page, so the status is a false pass. For youtube.com /
// youtu.be we instead hit the oEmbed endpoint, which returns non-200 when the
// video is genuinely gone and hands back the real title as an identity check.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, 'curated-links.json');
const CODE_RE = /^[A-Z]{2,6}\.\d{2,3}$/;
const TIMEOUT_MS = 15000;
// Present as a real browser: we're checking links a human will open in one, and
// many reputable hosts (Britannica, NIH, publishers) 403 a bot-looking UA while
// serving browsers fine. A realistic UA cuts false "bot-blocked" warnings.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const ACCEPT_LANG = 'en-US,en;q=0.9';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const filter = (process.argv[2] || '').toUpperCase();

const C = process.stdout.isTTY
  ? { g: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m` }
  : { g: s => s, r: s => s, y: s => s, dim: s => s };

function ytId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if (u.hostname.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
      if (m) return m[1];
    }
  } catch { /* not a url */ }
  return null;
}

function withTimeout() {
  // AbortSignal.timeout isn't in every Node 18.x; build one that always works.
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  return { signal: ac.signal, done: () => clearTimeout(t) };
}

// -> { state: 'PASS'|'WARN'|'FAIL', detail: string }
async function checkOne(url) {
  const id = ytId(url);
  if (id) {
    const oembed = 'https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + id);
    const t = withTimeout();
    try {
      const res = await fetch(oembed, { headers: { 'user-agent': UA }, signal: t.signal });
      if (res.ok) {
        let title = '';
        try { title = (await res.json()).title || ''; } catch { /* ignore */ }
        return { state: 'PASS', detail: 'youtube ok' + (title ? ` — “${title}”` : '') };
      }
      if (res.status === 401 || res.status === 403) return { state: 'FAIL', detail: 'youtube video private/unavailable' };
      if (res.status === 404) return { state: 'FAIL', detail: 'youtube video not found' };
      return { state: 'FAIL', detail: 'youtube oembed HTTP ' + res.status };
    } catch (e) {
      return { state: 'FAIL', detail: 'youtube oembed ' + (e.name === 'AbortError' ? 'timeout' : e.message) };
    } finally { t.done(); }
  }

  // Generic host: prefer GET (many servers reject HEAD), follow redirects.
  // Retry once on a rate-limit — 429 means "throttled", not "dead".
  for (let attempt = 0; ; attempt++) {
    const t = withTimeout();
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': UA,
          'accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
          'accept-language': ACCEPT_LANG,
        },
        signal: t.signal,
      });
      const moved = res.url && res.url !== url;
      let host = '';
      try { host = new URL(res.url || url).host; } catch { /* ignore */ }
      const via = moved ? ` (→ ${host})` : '';
      if (res.ok) return { state: 'PASS', detail: `HTTP ${res.status}${via}` };
      if (res.status === 429) {
        if (attempt === 0) { t.done(); await sleep(2000); continue; }
        return { state: 'WARN', detail: `HTTP 429 — rate-limited, reachable; retry later${via}` };
      }
      if (res.status === 401 || res.status === 403) return { state: 'WARN', detail: `HTTP ${res.status} — likely bot-blocked, check by hand${via}` };
      if (res.status >= 300 && res.status < 400) return { state: 'WARN', detail: `HTTP ${res.status} — unresolved redirect${via}` };
      return { state: 'FAIL', detail: `HTTP ${res.status}${via}` };
    } catch (e) {
      return { state: 'FAIL', detail: e.name === 'AbortError' ? 'timeout' : e.message };
    } finally {
      t.done();
    }
  }
}

function collect(data) {
  const jobs = [];
  for (const code of Object.keys(data)) {
    if (!CODE_RE.test(code)) continue;              // ignore _meta and friends
    if (filter && !code.startsWith(filter)) continue;
    const entry = data[code] || {};
    for (const field of ['video', 'article', 'deeper']) {
      const res = entry[field];
      if (res && typeof res.url === 'string') jobs.push({ code, field, url: res.url });
    }
  }
  return jobs;
}

async function main() {
  let raw;
  try {
    raw = JSON.parse(await readFile(FILE, 'utf8'));
  } catch (e) {
    console.error(C.r('Cannot read curated-links.json: ') + e.message);
    process.exit(2);
  }

  const jobs = collect(raw);
  if (!jobs.length) {
    console.log(C.dim(filter ? `No URLs for codes starting "${filter}".` : 'No curated URLs to check yet.'));
    return;
  }

  console.log(C.dim(`Checking ${jobs.length} URL(s)${filter ? ` under ${filter}` : ''}…\n`));

  // Small concurrency pool — polite, and fast enough for hundreds of links.
  const results = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await checkOne(jobs[i].url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, jobs.length) }, worker));

  const tally = { PASS: 0, WARN: 0, FAIL: 0 };
  jobs.forEach((job, i) => {
    const { state, detail } = results[i];
    tally[state]++;
    const tag = state === 'PASS' ? C.g('PASS') : state === 'WARN' ? C.y('WARN') : C.r('FAIL');
    console.log(`${tag}  ${job.code} ${job.field.padEnd(7)}  ${job.url}`);
    if (state !== 'PASS') console.log(`      ${C.dim(detail)}`);
  });

  console.log('\n' + `${C.g(tally.PASS + ' pass')}, ${C.y(tally.WARN + ' warn')}, ${C.r(tally.FAIL + ' fail')} of ${jobs.length}.`);
  if (tally.WARN) console.log(C.dim('WARN = reachable but needs a human glance (bot-wall or redirect). Not a failure.'));
  process.exit(tally.FAIL ? 1 : 0);
}

main();
