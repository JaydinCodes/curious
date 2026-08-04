import { topics } from './data/catalog.js';

import {
  formatLabel,
  formatMinutes,
  getResources,
  getResourceType,
  getTotalMinutes,
  isFullyEnriched,
} from './curation-model.js';

const CODE_RE = /^[A-Z]{2,6}\.\d{2,3}$/;

const DEEPER_LABELS = Object.freeze({
  book: 'Book',
  paper: 'Paper',
  documentary: 'Doc',
  course: 'Course',
  reference: 'Deeper',
});

function setCuratedLink(anchor, resource, fallbackLabel) {
  anchor.href = resource.url;
  anchor.classList.add('is-curated');

  const title = resource.title || fallbackLabel;
  const source = resource.source
    ? ` — ${resource.source}`
    : '';

  anchor.title = `${title}${source}`;
  anchor.setAttribute(
    'aria-label',
    `${fallbackLabel}: ${title}${source}`,
  );
}

function createResourceEntry(slot, resource) {
  const anchor = document.createElement('a');

  anchor.className = 'resource-entry';
  anchor.href = resource.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener';

  const title = document.createElement('span');
  title.className = 'resource-title';
  title.textContent =
    resource.title || 'Curated resource';

  const metadata = document.createElement('span');
  metadata.className = 'resource-meta';

  const parts = [];

  if (resource.source) {
    parts.push(resource.source);
  }

  parts.push(
    formatLabel(getResourceType(slot, resource)),
  );

  const time = formatMinutes(resource.minutes);

  if (time) {
    parts.push(time);
  }

  if (resource.paywalled) {
    parts.push('Paywalled');
  }

  metadata.textContent = parts.join(' · ');

  anchor.append(title, metadata);

  return anchor;
}

function createResourcePanel(entry) {
  const resources = getResources(entry);

  if (resources.length === 0) return null;

  const panel = document.createElement('div');
  panel.className = 'resource-panel';

  const summaryParts = [];
  const totalMinutes = getTotalMinutes(entry);

  if (entry.difficulty) {
    summaryParts.push(formatLabel(entry.difficulty));
  }

  if (totalMinutes > 0) {
    summaryParts.push(
      `${formatMinutes(totalMinutes)} learning path`,
    );
  }

  if (summaryParts.length > 0) {
    const summary = document.createElement('div');
    summary.className = 'resource-summary';
    summary.textContent = summaryParts.join(' · ');
    panel.appendChild(summary);
  }

  for (const { slot, resource } of resources) {
    panel.appendChild(
      createResourceEntry(slot, resource),
    );
  }

  const exercise = entry.exercise;

  if (
    exercise &&
    typeof exercise.prompt === 'string' &&
    exercise.prompt.trim()
  ) {
    const exerciseElement =
      document.createElement('div');

    exerciseElement.className = 'resource-exercise';

    const label = document.createElement('span');
    label.className = 'exercise-label';
    label.textContent = 'Try';

    const prompt = document.createElement('span');
    prompt.textContent = exercise.prompt.trim();

    exerciseElement.append(label, prompt);

    const time = formatMinutes(exercise.minutes);

    if (time) {
      const duration = document.createElement('span');
      duration.className = 'exercise-time';
      duration.textContent = time;

      exerciseElement.appendChild(duration);
    }

    panel.appendChild(exerciseElement);
  }

  return panel;
}

function upgradeInstance(card, entry) {
  if (card.dataset.curated === '1') return;

  const links = card.querySelector('.card-links');

  if (!links) return;

  if (entry.video?.url) {
    const watchLink =
      links.querySelector('.chip-watch');

    if (watchLink) {
      setCuratedLink(
        watchLink,
        entry.video,
        'Watch',
      );
    }
  }

  if (entry.article?.url) {
    const readLink =
      links.querySelector('.chip-read');

    if (readLink) {
      setCuratedLink(
        readLink,
        entry.article,
        'Read',
      );
    }
  }

  if (entry.deeper?.url) {
    const deeperLink =
      document.createElement('a');

    deeperLink.className =
      'chip chip-deeper is-curated';
    deeperLink.target = '_blank';
    deeperLink.rel = 'noopener';

    setCuratedLink(
      deeperLink,
      entry.deeper,
      'Deeper',
    );

    const label =
      DEEPER_LABELS[entry.deeper.type] ??
      'Deeper';

    const marker = document.createElement('span');
    marker.className = 'chip-mark';
    marker.setAttribute('aria-hidden', 'true');

    deeperLink.append(
      marker,
      document.createTextNode(`${label} ▸`),
    );

    const markButton =
      links.querySelector('.mark');

    links.insertBefore(
      deeperLink,
      markButton || null,
    );
  }

  const resourcePanel =
    createResourcePanel(entry);

  if (resourcePanel) {
    card.insertBefore(resourcePanel, links);
  }

  const searchableMetadata = getResources(entry)
    .flatMap(({ resource }) => [
      resource.title,
      resource.source,
      resource.type,
    ])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  card.dataset.search = [
    card.dataset.search,
    searchableMetadata,
    entry.difficulty,
    entry.exercise?.prompt,
  ]
    .filter(Boolean)
    .join(' ');

  card.dataset.curated = '1';
  card.dataset.enriched =
    isFullyEnriched(entry) ? '1' : '0';
}

async function loadCuration() {
  let data;

  try {
    const response = await fetch(
      './curated-links.json',
      { cache: 'no-cache' },
    );

    if (!response.ok) return;

    data = await response.json();
  } catch {
    return;
  }

  if (!data || typeof data !== 'object') return;

  const map = {};

  for (const [code, entry] of Object.entries(data)) {
    if (
      CODE_RE.test(code) &&
      entry &&
      typeof entry === 'object'
    ) {
      map[code] = entry;
    }
  }

  window.CURATED = map;

  let curatedCount = 0;
  let enrichedCount = 0;

  for (const [code, entry] of Object.entries(map)) {
    const instances = document.querySelectorAll(
      `.card[data-code="${code}"]`,
    );

    if (instances.length === 0) continue;

    instances.forEach(card =>
      upgradeInstance(card, entry),
    );

    curatedCount++;

    if (isFullyEnriched(entry)) {
      enrichedCount++;
    }
  }

  const meta =
    document.getElementById('metaLine');

  if (meta && !meta.dataset.curationAdded) {
    meta.textContent +=
      ` · ${curatedCount}/${topics.length} curated`;

    if (enrichedCount > 0) {
      meta.textContent +=
        ` · ${enrichedCount} enriched`;
    }

    meta.dataset.curationAdded = '1';
  }
}

loadCuration();