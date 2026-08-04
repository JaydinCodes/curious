import {
  sections,
  topics,
} from './data/catalog.js';
import { collections } from './data/collections.js';
import { loadCurationData } from './curation-data.js';
import {
  formatLabel,
  formatMinutes,
  getTotalMinutes,
} from './curation-model.js';
import { getTopicOfDay } from './topic-of-day.js';
import {
  collectionHref,
  topicHref,
} from './topic-url.js';

const todayCard = document.getElementById('topicOfDay');
const collectionGrid = document.getElementById('curatedCollections');

if (todayCard) {
  const curation = await loadCurationData();
  const topic = getTopicOfDay(topics);

  if (topic) {
    const section = sections.find(item => item.k === topic.c);
    const entry = curation[topic.code] || null;
    const minutes = getTotalMinutes(entry);

    todayCard.style.setProperty('--cat', `var(--${topic.c})`);
    document.getElementById('todayCode').textContent = topic.code;
    document.getElementById('todayTitle').textContent = topic.t;
    document.getElementById('todayHook').textContent = topic.h;
    document.getElementById('todayMeta').textContent = [
      section?.name,
      formatLabel(entry?.difficulty || 'unrated'),
      minutes > 0 ? formatMinutes(minutes) : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const dateLabel = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date());

    document.getElementById('todayDate').textContent = dateLabel;
    const link = document.getElementById('todayLink');
    link.href = topicHref(topic, { start: true });
  }
}

if (collectionGrid) {
  for (const collection of collections) {
    const link = document.createElement('a');
    link.className = 'collection-teaser';
    link.href = collectionHref(collection);

    const eyebrow = document.createElement('span');
    eyebrow.textContent = collection.eyebrow;

    const title = document.createElement('strong');
    title.textContent = collection.title;

    const description = document.createElement('p');
    description.textContent = collection.description;

    const count = document.createElement('small');
    count.textContent = `${collection.codes.length} topics →`;

    link.append(eyebrow, title, description, count);
    collectionGrid.appendChild(link);
  }
}
