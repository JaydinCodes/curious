import {
  sections,
  topics,
} from './data/catalog.js';

const watchHref = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
const readHref  = q => 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(q);

/* safe storage: falls back to memory if the browser blocks it.
   generic get/set added for the progress+ layer; 'done' keeps its
   original key so existing installs keep their marks. */
const store = (() => {
  const NS = 'curiosity-catalog:';
  const mem = {};
  let ok = true;
  try {
    const probe = '__cc__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch (e) { ok = false; }

  const get = (key, fallback) => {
    if (!ok) return (key in mem) ? mem[key] : fallback;
    try {
      const raw = window.localStorage.getItem(NS + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  };
  const set = (key, value) => {
    mem[key] = value;
    if (!ok) return;
    try { window.localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) { /* quota or blocked */ }
  };

  return {
    get, set,
    load(){ return get('done', {}); },
    save(state){ set('done', state); }
  };
})();

let done = store.load();

const main = document.getElementById('main');
const nav = document.getElementById('nav');

sections.forEach(sec => {
  const a = document.createElement('a');
  a.href = '#' + sec.k;
  a.dataset.key = sec.k;
  a.textContent = sec.n + ' \u00b7 ' + sec.l;
  nav.appendChild(a);

  const items = topics.filter(t => t.c === sec.k);
  const shelf = document.createElement('section');
  shelf.className = 'shelf';
  shelf.id = sec.k;
  shelf.innerHTML = `
    <div class="shelf-head">
      <span class="shelf-numeral">${sec.n}</span>
      <h2 class="shelf-name">${sec.name}</h2>
      <span class="shelf-count">${items.length} entries</span>
      <span class="shelf-rule"></span>
    </div>
    <p class="shelf-blurb">${sec.b}</p>
    <div class="shelf-grid"></div>`;
  main.appendChild(shelf);

  const grid = shelf.querySelector('.shelf-grid');
  items.forEach(t => {
const card = document.createElement('article');
    card.className = 'card' + (done[t.code] ? ' done' : '');
    card.style.setProperty('--cat', `var(--${sec.k})`);
    card.dataset.code = t.code;
    card.dataset.search = (t.t + ' ' + t.h + ' ' + sec.name + ' ' + sec.l).toLowerCase();
    card.innerHTML = `
      <span class="card-dot"></span>
      <div class="card-code">${t.code}</div>
      <h3 class="card-title">${t.t}</h3>
      <p class="card-hook">${t.h}</p>
      <div class="card-links">
        <a class="chip chip-watch" href="${watchHref(t.w)}" target="_blank" rel="noopener"><span class="chip-mark" aria-hidden="true"></span>Watch &#9656;</a>
        <a class="chip chip-read" href="${readHref(t.r)}" target="_blank" rel="noopener"><span class="chip-mark" aria-hidden="true"></span>Read &#9656;</a>
        <button class="mark" type="button" aria-pressed="${!!done[t.code]}" aria-label="Mark ${t.t} as done">&#10003;</button>
      </div>`;
    grid.appendChild(card);
  });
});

document.getElementById('metaLine').textContent =
  `${topics.length} entries \u00b7 ${sections.length} sections \u00b7 no prerequisites`;

/* reveal on scroll */
const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.08 });
document.querySelectorAll('.card').forEach(c => io.observe(c));

/* active section in nav */
const navLinks = Object.fromEntries([...nav.querySelectorAll('a')].map(a => [a.dataset.key, a]));
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* keeps the current drawer visible in the scrolling nav strip, without moving the page */
function centerInNav(link){
  const target = link.offsetLeft - (nav.clientWidth / 2) + (link.clientWidth / 2);
  nav.scrollTo({ left: Math.max(0, target), behavior: prefersReduced ? 'auto' : 'smooth' });
}

const spy = new IntersectionObserver(es => {
  es.forEach(e => {
    if (e.isIntersecting) {
      Object.values(navLinks).forEach(a => a.classList.remove('active'));
      const link = navLinks[e.target.id];
      if (link) { link.classList.add('active'); centerInNav(link); }
    }
  });
}, { rootMargin: '-50px 0px -70% 0px' });
document.querySelectorAll('.shelf').forEach(s => spy.observe(s));

/* progress */
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
function updateProgress(){
  const n = Object.values(done).filter(Boolean).length;
  progressBar.style.width = (n / topics.length * 100) + '%';
  progressText.textContent = `${n} of ${topics.length} marked off`;
}
updateProgress();

/* mark done — a topic can render twice (its shelf + the pinned shelf),
   so update every instance of the card, not just the one clicked */
main.addEventListener('click', e => {
  const btn = e.target.closest('.mark');
  if (!btn) return;
  const code = btn.closest('.card').dataset.code;
  if (done[code]) { delete done[code]; } else { done[code] = 1; }
  document.querySelectorAll(`.card[data-code="${code}"]`).forEach(c => {
    c.classList.toggle('done', !!done[code]);
    c.querySelector('.mark').setAttribute('aria-pressed', !!done[code]);
  });
  store.save(done);
  updateProgress();
  applyFilters();
  if (window.CC) CC.onMark(code, !!done[code]);
});

document.getElementById('resetBtn').addEventListener('click', () => {
  done = {};
  store.save(done);
  document.querySelectorAll('.card').forEach(c => {
    c.classList.remove('done');
    c.querySelector('.mark').setAttribute('aria-pressed', 'false');
  });
  updateProgress();
  applyFilters();
  if (window.CC) CC.onReset();
});

/* filters */
const search = document.getElementById('search');
const noResults = document.getElementById('noResults');
let view = 'all';

function applyFilters(){
  const q = search.value.trim().toLowerCase();
  let total = 0;
  document.querySelectorAll('.shelf').forEach(shelf => {
    let shown = 0;
    shelf.querySelectorAll('.card').forEach(card => {
      const isDone = card.classList.contains('done');
      const textHit = !q || card.dataset.search.includes(q);
      const viewHit = view === 'all' || (view === 'done' ? isDone : !isDone);
      const hit = textHit && viewHit;
      card.classList.toggle('hidden', !hit);
      if (hit) { card.classList.add('in'); shown++; }
    });
    shelf.classList.toggle('hidden', shown === 0);
    total += shown;
  });
  noResults.classList.toggle('show', total === 0);
}

search.addEventListener('input', applyFilters);
document.querySelectorAll('.seg button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg button').forEach(b => {
      b.classList.remove('on');
      b.setAttribute('aria-pressed', 'false');
    });

    btn.classList.add('on');
    btn.setAttribute('aria-pressed', 'true');

    view = btn.dataset.view;
    applyFilters();
  });
});
/* draw a card */
const drawBtn = document.getElementById('drawBtn');
const slip = document.getElementById('drawSlip');
const slipCode = document.getElementById('slipCode');
const slipTitle = document.getElementById('slipTitle');
const slipHook = document.getElementById('slipHook');
const slipWatch = document.getElementById('slipWatch');
const slipRead = document.getElementById('slipRead');
const slipDeeper = document.getElementById('slipDeeper');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* point a slip chip at a curated resource when one exists, else the search
   fallback. window.CURATED is populated async by the curated module; until
   then (or if the file never loads) every branch here degrades to search. */
function slipChip(a, resource, fallbackHref, label){
  if (resource && resource.url){
    a.href = resource.url;
    a.classList.add('is-curated');
    a.title = resource.title ? resource.title + (resource.source ? ' — ' + resource.source : '') : '';
  } else {
    a.href = fallbackHref;
    a.classList.remove('is-curated');
    a.removeAttribute('title');
  }
}

function renderSlip(t){
  slipCode.textContent = t.code;
  slipTitle.textContent = t.t;
  slipHook.textContent = t.h;
  const cur = (window.CURATED && window.CURATED[t.code]) || null;
  slipChip(slipWatch, cur && cur.video, watchHref(t.w));
  slipChip(slipRead, cur && cur.article, readHref(t.r));
  if (cur && cur.deeper && cur.deeper.url){
    slipDeeper.href = cur.deeper.url;
    slipDeeper.title = cur.deeper.title ? cur.deeper.title : '';
    slipDeeper.hidden = false;
  } else {
    slipDeeper.hidden = true;
  }
  slip.classList.add('show');
}

let last = null;
function draw(){
  /* the progress+ layer may offer a biased pool (least-explored drawer) */
  const bias = window.CC ? CC.drawPool() : null;
  const pool = (bias && bias.length) ? bias : topics.filter(t => !done[t.code]);
  const from = pool.length ? pool : topics;
  let pick = from[Math.floor(Math.random() * from.length)];
  if (from.length > 1) { while (pick === last) pick = from[Math.floor(Math.random() * from.length)]; }
  last = pick;
  if (reduce) { renderSlip(pick); revealSlip(); return; }
  let i = 0;
  const timer = setInterval(() => {
    renderSlip(topics[Math.floor(Math.random() * topics.length)]);
    if (++i >= 7) { clearInterval(timer); renderSlip(pick); revealSlip(); }
  }, 60);
}
function revealSlip(){
  if (window.innerWidth <= 620) {
    slip.scrollIntoView({ block:'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }
}
drawBtn.addEventListener('click', draw);

/* back to top */
const toTop = document.getElementById('toTop');
window.addEventListener('scroll', () => {
  toTop.classList.toggle('show', window.scrollY > 700);
}, { passive:true });
toTop.addEventListener('click', () => window.scrollTo({ top:0, behavior: reduce ? 'auto' : 'smooth' }));

/* keyboard */
document.addEventListener('keydown', e => {
  const typing = ['INPUT','TEXTAREA'].includes(document.activeElement.tagName);
  if (e.key === '/' && !typing) { e.preventDefault(); search.focus(); }
  else if (e.key === 'Escape' && typing) { search.value = ''; applyFilters(); search.blur(); }
  else if ((e.key === 'r' || e.key === 'R') && !typing) { draw(); }
});

export {
  sections,
  topics,
  store,
  main,
  done,
  last,
  slipWatch,
  slipRead,
  updateProgress,
  applyFilters,
};
