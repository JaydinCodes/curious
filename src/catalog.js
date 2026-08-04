import {
  sections,
  topics,
} from './data/catalog.js';
import {
  formatLabel,
  formatMinutes,
  getResourceType,
  getTotalMinutes,
} from './curation-model.js';
import { getCuration } from './curation-data.js';
import { filterTopics } from './learning-state.js';
import { store } from './storage.js';
import { topicHref } from './topic-url.js';
import { trackAnalytics } from './analytics.js';

const watchHref = query =>
  'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
const readHref = query =>
  'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(query);

let done = store.load();

const main = document.getElementById('main');
const nav = document.getElementById('nav');

sections.forEach(section => {
  const link = document.createElement('a');
  link.href = '#' + section.k;
  link.dataset.key = section.k;
  link.textContent = section.n + ' · ' + section.l;
  nav.appendChild(link);

  const items = topics.filter(topic => topic.c === section.k);
  const shelf = document.createElement('section');
  shelf.className = 'shelf';
  shelf.id = section.k;
  shelf.innerHTML = `
    <div class="shelf-head">
      <span class="shelf-numeral">${section.n}</span>
      <h2 class="shelf-name">${section.name}</h2>
      <span class="shelf-count">${items.length} entries</span>
      <span class="shelf-rule"></span>
    </div>
    <p class="shelf-blurb">${section.b}</p>
    <div class="shelf-grid"></div>`;
  main.appendChild(shelf);

  const grid = shelf.querySelector('.shelf-grid');

  items.forEach(topic => {
    const card = document.createElement('article');
    card.className = 'card' + (done[topic.code] ? ' done' : '');
    card.style.setProperty('--cat', `var(--${section.k})`);
    card.dataset.code = topic.code;
    card.dataset.section = topic.c;
    card.dataset.search = (
      topic.t + ' ' +
      topic.h + ' ' +
      section.name + ' ' +
      section.l
    ).toLowerCase();

    card.innerHTML = `
      <span class="card-dot"></span>
      <div class="card-code">${topic.code}</div>
      <h3 class="card-title"><a class="card-title-link" href="${topicHref(topic)}">${topic.t}</a></h3>
      <p class="card-hook">${topic.h}</p>
      <div class="card-links">
        <a class="chip chip-watch" data-resource-slot="video" data-resource-type="video" href="${watchHref(topic.w)}" target="_blank" rel="noopener"><span class="chip-mark" aria-hidden="true"></span>Watch &#9656;</a>
        <a class="chip chip-read" data-resource-slot="article" data-resource-type="reference" href="${readHref(topic.r)}" target="_blank" rel="noopener"><span class="chip-mark" aria-hidden="true"></span>Read &#9656;</a>
        <a class="chip chip-details" href="${topicHref(topic)}">Details &#9656;</a>
        <button class="mark" type="button" aria-pressed="${String(!!done[topic.code])}" aria-label="Mark ${topic.t} as done">&#10003;</button>
      </div>`;

    grid.appendChild(card);
  });
});

document.getElementById('metaLine').textContent =
  `${topics.length} entries · ${sections.length} sections · no prerequisites`;

const intersectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      intersectionObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.card').forEach(card =>
  intersectionObserver.observe(card),
);

const navLinks = Object.fromEntries(
  [...nav.querySelectorAll('a')].map(link => [link.dataset.key, link]),
);
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function centerInNav(link) {
  const target =
    link.offsetLeft -
    nav.clientWidth / 2 +
    link.clientWidth / 2;

  nav.scrollTo({
    left: Math.max(0, target),
    behavior: prefersReduced ? 'auto' : 'smooth',
  });
}

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    Object.values(navLinks).forEach(link =>
      link.classList.remove('active'),
    );

    const link = navLinks[entry.target.id];
    if (link) {
      link.classList.add('active');
      centerInNav(link);
    }
  });
}, { rootMargin: '-50px 0px -70% 0px' });

document.querySelectorAll('.shelf').forEach(shelf =>
  sectionObserver.observe(shelf),
);

const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

function updateProgress() {
  const completed = topics.filter(topic => done[topic.code]).length;
  progressBar.style.width = `${completed / topics.length * 100}%`;
  progressText.textContent = `${completed} of ${topics.length} marked off`;
}

updateProgress();

main.addEventListener('click', event => {
  const button = event.target.closest('.mark');
  if (!button) return;

  const code = button.closest('.card').dataset.code;
  const wasDone = Boolean(done[code]);

  if (wasDone) delete done[code];
  else done[code] = 1;

  document
    .querySelectorAll(`.card[data-code="${code}"]`)
    .forEach(card => {
      card.classList.toggle('done', !!done[code]);
      card
        .querySelector('.mark')
        ?.setAttribute('aria-pressed', String(!!done[code]));
    });

  store.save(done);
  updateProgress();
  applyFilters();

  if (!wasDone) {
    trackAnalytics('complete', { topicCode: code });
  }

  window.CC?.onMark(code, !!done[code]);
});

main.addEventListener('click', event => {
  const resource = event.target.closest('a[data-resource-slot]');
  const card = resource?.closest('.card');

  if (!resource || !card) return;

  trackAnalytics('resource_click', {
    topicCode: card.dataset.code,
    slot: resource.dataset.resourceSlot,
    type: resource.dataset.resourceType,
  });
});

document.getElementById('resetBtn').addEventListener('click', () => {
  done = {};
  store.save(done);

  document.querySelectorAll('.card').forEach(card => {
    card.classList.remove('done');
    card
      .querySelector('.mark')
      ?.setAttribute('aria-pressed', 'false');
  });

  updateProgress();
  applyFilters();
  window.CC?.onReset();
});

const search = document.getElementById('search');
const noResults = document.getElementById('noResults');
let view = 'all';
let visibleTopicCount = topics.length;
let searchAnalyticsTimer = 0;

function applyFilters() {
  const query = search.value.trim().toLowerCase();
  let total = 0;

  document.querySelectorAll('.shelf').forEach(shelf => {
    let shown = 0;

    shelf.querySelectorAll('.card').forEach(card => {
      const isDone = card.classList.contains('done');
      const textHit = !query || card.dataset.search.includes(query);
      const viewHit =
        view === 'all' ||
        (view === 'done' ? isDone : !isDone);
      const hit = textHit && viewHit;

      card.classList.toggle('hidden', !hit);

      if (hit) {
        card.classList.add('in');
        shown++;
      }
    });

    shelf.classList.toggle('hidden', shown === 0);
    total += shown;
  });

  visibleTopicCount = total;
  noResults.classList.toggle('show', total === 0);
  return total;
}

search.addEventListener('input', () => {
  applyFilters();
  clearTimeout(searchAnalyticsTimer);

  const queryLength = search.value.trim().length;
  if (queryLength === 0) return;

  searchAnalyticsTimer = window.setTimeout(() => {
    trackAnalytics('search', {
      queryLength,
      results: visibleTopicCount,
    });
  }, 700);
});

document.querySelectorAll('.seg button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.seg button').forEach(item => {
      item.classList.remove('on');
      item.setAttribute('aria-pressed', 'false');
    });

    button.classList.add('on');
    button.setAttribute('aria-pressed', 'true');
    view = button.dataset.view;
    applyFilters();
  });
});

const drawButton = document.getElementById('drawBtn');
const slip = document.getElementById('drawSlip');
const slipCode = document.getElementById('slipCode');
const slipTitle = document.getElementById('slipTitle');
const slipHook = document.getElementById('slipHook');
const slipMeta = document.getElementById('slipMeta');
const slipWatch = document.getElementById('slipWatch');
const slipRead = document.getElementById('slipRead');
const slipDeeper = document.getElementById('slipDeeper');
const slipStart = document.getElementById('slipStart');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function slipChip(
  anchor,
  resource,
  fallbackHref,
  slot,
  fallbackType,
) {
  anchor.hidden = false;
  anchor.dataset.resourceSlot = slot;
  anchor.dataset.resourceType = resource
    ? getResourceType(slot, resource)
    : fallbackType;

  if (resource?.url) {
    anchor.href = resource.url;
    anchor.classList.add('is-curated');
    anchor.title = resource.title
      ? resource.title + (resource.source ? ` — ${resource.source}` : '')
      : '';
  } else {
    anchor.href = fallbackHref;
    anchor.classList.remove('is-curated');
    anchor.removeAttribute('title');
  }
}

function renderSlip(topic) {
  const entry = getCuration(topic.code);
  const totalMinutes = getTotalMinutes(entry);

  slipCode.textContent = topic.code;
  slipTitle.textContent = topic.t;
  slipHook.textContent = topic.h;
  slipMeta.textContent = [
    formatLabel(entry?.difficulty || 'unrated'),
    totalMinutes > 0 ? `${formatMinutes(totalMinutes)} total` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  slipChip(
    slipWatch,
    entry?.video,
    watchHref(topic.w),
    'video',
    'video',
  );
  slipChip(
    slipRead,
    entry?.article,
    readHref(topic.r),
    'article',
    'reference',
  );

  if (entry?.deeper?.url) {
    slipDeeper.href = entry.deeper.url;
    slipDeeper.title = entry.deeper.title || '';
    slipDeeper.dataset.resourceSlot = 'deeper';
    slipDeeper.dataset.resourceType = getResourceType(
      'deeper',
      entry.deeper,
    );
    slipDeeper.hidden = false;
  } else {
    slipDeeper.hidden = true;
  }

  slipStart.href = topicHref(topic, { start: true });
  slipStart.hidden = false;
  slip.classList.add('show');
}

function renderEmptySlip() {
  slipCode.textContent = 'NO MATCH';
  slipTitle.textContent = 'No topics match these draw filters';
  slipHook.textContent = 'Broaden the section, difficulty, or completion selection and draw again.';
  slipMeta.textContent = '';
  [slipWatch, slipRead, slipDeeper, slipStart].forEach(link => {
    link.hidden = true;
  });
  slip.classList.add('show');
}

function currentDrawFilters() {
  return {
    section: document.getElementById('drawSection')?.value || 'all',
    difficulty: document.getElementById('drawDifficulty')?.value || 'all',
    status: document.getElementById('drawStatus')?.value || 'todo',
  };
}

let last = null;

function trackDraw(topic, filters) {
  trackAnalytics('draw', {
    topicCode: topic.code,
    section: filters.section,
    difficulty: filters.difficulty,
    status: filters.status,
  });
}

function draw() {
  const filters = currentDrawFilters();
  const started = store.get('started', {});
  const filtered = filterTopics({
    topics,
    curation: window.CURATED || {},
    done,
    started,
    ...filters,
  });

  if (filtered.length === 0) {
    renderEmptySlip();
    revealSlip();
    return;
  }

  const filtersAreDefault =
    filters.section === 'all' &&
    filters.difficulty === 'all' &&
    (filters.status === 'todo' || filters.status === 'all');
  const biasedPool = filtersAreDefault
    ? window.CC?.drawPool()
    : null;
  const allowedCodes = new Set(filtered.map(topic => topic.code));
  const usableBias = biasedPool?.filter(topic => allowedCodes.has(topic.code));
  const pool = usableBias?.length ? usableBias : filtered;

  let pick = pool[Math.floor(Math.random() * pool.length)];

  if (pool.length > 1) {
    while (pick === last) {
      pick = pool[Math.floor(Math.random() * pool.length)];
    }
  }

  last = pick;
  trackDraw(pick, filters);

  if (reduceMotion) {
    renderSlip(pick);
    revealSlip();
    return;
  }

  let iteration = 0;
  const timer = setInterval(() => {
    renderSlip(pool[Math.floor(Math.random() * pool.length)]);

    if (++iteration >= 7) {
      clearInterval(timer);
      renderSlip(pick);
      revealSlip();
    }
  }, 60);
}

function revealSlip() {
  if (window.innerWidth <= 620) {
    slip.scrollIntoView({
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }
}

drawButton.addEventListener('click', draw);

[slipWatch, slipRead, slipDeeper].forEach(link => {
  link.addEventListener('click', () => {
    if (!last || link.hidden) return;

    trackAnalytics('resource_click', {
      topicCode: last.code,
      slot: link.dataset.resourceSlot,
      type: link.dataset.resourceType,
    });
  });
});

const toTop = document.getElementById('toTop');
window.addEventListener('scroll', () => {
  toTop.classList.toggle('show', window.scrollY > 700);
}, { passive: true });

toTop.addEventListener('click', () =>
  window.scrollTo({
    top: 0,
    behavior: reduceMotion ? 'auto' : 'smooth',
  }),
);

document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
    document.activeElement.tagName,
  );

  if (event.key === '/' && !typing) {
    event.preventDefault();
    search.focus();
  } else if (event.key === 'Escape' && typing) {
    search.value = '';
    applyFilters();
    search.blur();
  } else if ((event.key === 'r' || event.key === 'R') && !typing) {
    draw();
  }
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
