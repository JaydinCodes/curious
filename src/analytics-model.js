import {
  isCatalogTopicCode,
  sections,
} from './data/catalog.js';

export const ANALYTICS_EVENTS = Object.freeze([
  'search',
  'draw',
  'complete',
  'resource_click',
]);

const EVENT_SET = new Set(ANALYTICS_EVENTS);
const SECTION_SET = new Set(['all', ...sections.map(section => section.k)]);
const DIFFICULTY_SET = new Set([
  'all',
  'introductory',
  'intermediate',
  'advanced',
  'unrated',
]);
const STATUS_SET = new Set([
  'all',
  'not-started',
  'in-progress',
  'todo',
  'done',
]);
const RESOURCE_SLOT_SET = new Set([
  'video',
  'article',
  'deeper',
  'fallback',
]);
const RESOURCE_TYPE_SET = new Set([
  'video',
  'article',
  'reference',
  'book',
  'paper',
  'documentary',
  'course',
  'unknown',
]);

export function searchLengthBucket(value) {
  const length = Math.max(0, Math.floor(Number(value) || 0));

  if (length === 0) return '0';
  if (length <= 3) return '1-3';
  if (length <= 8) return '4-8';
  if (length <= 20) return '9-20';
  return '21+';
}

export function resultCountBucket(value) {
  const count = Math.max(0, Math.floor(Number(value) || 0));

  if (count === 0) return '0';
  if (count <= 10) return '1-10';
  if (count <= 50) return '11-50';
  if (count <= 200) return '51-200';
  return '201+';
}

function enumValue(value, allowed, fallback) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function topicCode(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return isCatalogTopicCode(normalized) ? normalized : null;
}

export function sanitizeAnalyticsEvent(input) {
  if (!input || typeof input !== 'object') return null;

  const name = String(input.event ?? '').trim().toLowerCase();
  if (!EVENT_SET.has(name)) return null;

  const data = input.data && typeof input.data === 'object'
    ? input.data
    : {};

  if (name === 'search') {
    return {
      name,
      dimensions: {
        query_length: searchLengthBucket(data.queryLength),
        results: resultCountBucket(data.results),
      },
    };
  }

  if (name === 'draw') {
    const code = topicCode(data.topicCode);
    if (!code) return null;

    return {
      name,
      dimensions: {
        topic: code,
        section: enumValue(data.section, SECTION_SET, 'all'),
        difficulty: enumValue(
          data.difficulty,
          DIFFICULTY_SET,
          'all',
        ),
        status: enumValue(data.status, STATUS_SET, 'all'),
      },
    };
  }

  if (name === 'complete') {
    const code = topicCode(data.topicCode);
    if (!code) return null;

    return {
      name,
      dimensions: { topic: code },
    };
  }

  const code = topicCode(data.topicCode);
  if (!code) return null;

  return {
    name,
    dimensions: {
      topic: code,
      slot: enumValue(data.slot, RESOURCE_SLOT_SET, 'fallback'),
      type: enumValue(data.type, RESOURCE_TYPE_SET, 'unknown'),
    },
  };
}

export function analyticsKeys(event, dateKey) {
  if (!event?.name || !event?.dimensions) return [];

  const prefix = 'cc:analytics:v1';
  const keys = [
    `${prefix}:all:event:${event.name}`,
    `${prefix}:day:${dateKey}:event:${event.name}`,
  ];

  for (const [dimension, value] of Object.entries(event.dimensions)) {
    const safeValue = encodeURIComponent(String(value));
    keys.push(
      `${prefix}:all:event:${event.name}:${dimension}:${safeValue}`,
      `${prefix}:day:${dateKey}:event:${event.name}:${dimension}:${safeValue}`,
    );
  }

  return keys;
}
