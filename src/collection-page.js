import {
  sections,
  topics,
} from './data/catalog.js';
import {
  getCollection,
} from './data/collections.js';
import { loadCurationData } from './curation-data.js';
import {
  formatLabel,
  formatMinutes,
  getTotalMinutes,
} from './curation-model.js';
import {
  collectionPath,
  resolveCollectionSlug,
  topicHref,
} from './topic-url.js';

const slug = resolveCollectionSlug(window.location);
const collection = getCollection(slug);
const loading = document.getElementById('collectionLoading');
const page = document.getElementById('collectionPage');
const errorPanel = document.getElementById('collectionError');

if (!collection) {
  loading.hidden = true;
  errorPanel.hidden = false;
} else {
  const curation = await loadCurationData();
  const collectionTopics = collection.codes
    .map(code => topics.find(topic => topic.code === code))
    .filter(Boolean);

  document.title = `${collection.title} · The Curiosity Catalog`;
  document.getElementById('collectionEyebrow').textContent =
    collection.eyebrow;
  document.getElementById('collectionTitle').textContent =
    collection.title;
  document.getElementById('collectionDescription').textContent =
    collection.description;
  document.getElementById('collectionCount').textContent =
    `${collectionTopics.length} topics`;

  const grid = document.getElementById('collectionGrid');

  collectionTopics.forEach((topic, index) => {
    const section = sections.find(item => item.k === topic.c);
    const entry = curation[topic.code] || null;
    const minutes = getTotalMinutes(entry);
    const card = document.createElement('article');

    card.className = 'collection-topic';
    card.style.setProperty('--cat', `var(--${topic.c})`);

    const code = document.createElement('div');
    code.className = 'collection-topic-code';
    code.textContent = `${String(index + 1).padStart(2, '0')} · ${topic.code}`;

    const heading = document.createElement('h3');
    const titleLink = document.createElement('a');
    titleLink.href = topicHref(topic);
    titleLink.textContent = topic.t;
    heading.appendChild(titleLink);

    const hook = document.createElement('p');
    hook.className = 'collection-topic-hook';
    hook.textContent = topic.h;

    const meta = document.createElement('p');
    meta.className = 'collection-topic-meta';
    meta.textContent = [
      section?.name,
      formatLabel(entry?.difficulty || 'unrated'),
      minutes > 0 ? formatMinutes(minutes) : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const start = document.createElement('a');
    start.className = 'collection-topic-start';
    start.href = topicHref(topic, { start: true });
    start.textContent = 'Start learning →';

    card.append(code, heading, hook, meta, start);
    grid.appendChild(card);
  });

  const shareButton = document.getElementById('shareCollection');
  const shareStatus = document.getElementById('collectionShareStatus');
  const canonicalUrl = new URL(
    collectionPath(collection),
    window.location.origin,
  ).href;

  shareButton.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: collection.title,
          text: collection.description,
          url: canonicalUrl,
        });
        shareStatus.textContent = 'Shared.';
      } else {
        await navigator.clipboard.writeText(canonicalUrl);
        shareStatus.textContent = 'Link copied.';
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        shareStatus.textContent = 'Copy the URL from your address bar.';
      }
    }
  });

  loading.hidden = true;
  page.hidden = false;
}
