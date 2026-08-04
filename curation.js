/* ---------------------------------------------------------------------------
   curated links : a progressive enhancement over the search fallback.

   Cards render (script 1) with Watch/Read pointing at YouTube/Wikipedia
   searches. This layer fetches curated-links.json — a sidecar keyed by topic
   code — and, for any code with an entry, repoints those chips at a
   hand-verified resource, marks them visually (filled square vs outline), and
   adds a third "deeper" chip when present. Everything degrades cleanly: if the
   file is missing, blocked (file:// CORS in local testing), malformed, or has
   no entry for a code, that card keeps exactly today's search links.

   Curated data is read-only reference material, not user state, so it is
   deliberately NOT part of the sync payload.

   Chips are upgraded by data-code across every instance, so pinned-shelf
   clones that already exist get upgraded too; pins created later clone from
   an already-upgraded original.
--------------------------------------------------------------------------- */
(() => {
'use strict';

const CODE_RE = /^[A-Z]{2,6}\.\d{2,3}$/;
const DEEPER_LABEL = { book: 'Book', paper: 'Paper', documentary: 'Doc', course: 'Course' };

const setCurated = (a, resource) => {
  a.href = resource.url;
  a.classList.add('is-curated');
  a.title = (resource.title || '') + (resource.source ? ' — ' + resource.source : '');
};

function upgradeInstance(card, entry){
  if (card.dataset.curated === '1') return; /* idempotent: never double-inject */
  const links = card.querySelector('.card-links');
  if (!links) return;

  if (entry.video && entry.video.url){
    const w = links.querySelector('.chip-watch');
    if (w) setCurated(w, entry.video);
  }
  if (entry.article && entry.article.url){
    const r = links.querySelector('.chip-read');
    if (r) setCurated(r, entry.article);
  }
  if (entry.deeper && entry.deeper.url){
    const d = document.createElement('a');
    d.className = 'chip chip-deeper is-curated';
    d.target = '_blank';
    d.rel = 'noopener';
    d.href = entry.deeper.url;
    d.title = entry.deeper.title || '';
    const label = DEEPER_LABEL[entry.deeper.type] || 'Deeper';
    d.innerHTML = '<span class="chip-mark" aria-hidden="true"></span>' + label + ' ▸';
    const mark = links.querySelector('.mark');
    links.insertBefore(d, mark || null); /* keep [watch][read][deeper] … [mark][pin] */
  }
  card.dataset.curated = '1';
}

async function load(){
  let data;
  try {
    const res = await fetch('./curated-links.json', { cache: 'no-cache' });
    if (!res.ok) return;
    data = await res.json();
  } catch (err) {
    /* file:// CORS, offline, or missing file — stay on search, silently */
    return;
  }
  if (!data || typeof data !== 'object') return;

  const map = {};
  for (const code of Object.keys(data)){
    if (CODE_RE.test(code) && data[code] && typeof data[code] === 'object') map[code] = data[code];
  }
  window.CURATED = map;

  let n = 0;
  for (const code of Object.keys(map)){
    const instances = document.querySelectorAll('.card[data-code="' + code + '"]');
    if (!instances.length) continue; /* a code in the file with no matching topic */
    instances.forEach(card => upgradeInstance(card, map[code]));
    n++;
  }

  if (n > 0){
    const meta = document.getElementById('metaLine');
    if (meta && !/curated/.test(meta.textContent)){
      meta.textContent = meta.textContent + ' · ' + n + ' curated';
    }
  }
}

load();
})();
