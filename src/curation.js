import { topics } from './data/catalog.js';
import { loadCurationData } from './curation-data.js';
import {
  formatLabel,
  formatMinutes,
  getResources,
  getTotalMinutes,
  isFullyEnriched,
} from './curation-model.js';

function createCompactMeta(entry) {
  const resources = getResources(entry);
  const totalMinutes = getTotalMinutes(entry);
  const meta = document.createElement('div');
  meta.className = 'card-learning-meta';

  const values = [
    formatLabel(entry?.difficulty || 'unrated'),
    totalMinutes > 0 ? formatMinutes(totalMinutes) : 'Open-ended',
    `${resources.length} resource${resources.length === 1 ? '' : 's'}`,
  ];

  if (entry?.exercise?.prompt) {
    values.push('Exercise');
  }

  for (const value of values) {
    const badge = document.createElement('span');
    badge.textContent = value;
    meta.appendChild(badge);
  }

  return meta;
}

function upgradeInstance(card, entry) {
  if (card.dataset.curated === '1') return;

  const links = card.querySelector('.card-links');
  if (!links) return;

  card.insertBefore(createCompactMeta(entry), links);

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
  card.dataset.difficulty = entry.difficulty || 'unrated';
  card.dataset.curated = '1';
  card.dataset.enriched = isFullyEnriched(entry) ? '1' : '0';
}

const map = await loadCurationData();
let curatedCount = 0;
let enrichedCount = 0;

for (const [code, entry] of Object.entries(map)) {
  const instances = document.querySelectorAll(
    `.card[data-code="${code}"]`,
  );

  if (instances.length === 0) continue;

  instances.forEach(card => upgradeInstance(card, entry));
  curatedCount++;

  if (isFullyEnriched(entry)) enrichedCount++;
}

const meta = document.getElementById('metaLine');
if (meta && !meta.dataset.curationAdded) {
  meta.textContent += ` · ${curatedCount}/${topics.length} curated`;

  if (enrichedCount > 0) {
    meta.textContent += ` · ${enrichedCount} enriched`;
  }

  meta.dataset.curationAdded = '1';
}
