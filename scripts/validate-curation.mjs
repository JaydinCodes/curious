import { readFile } from 'node:fs/promises';

import {
  sections,
  topics,
  isCatalogTopicCode,
} from '../src/data/catalog.js';

import {
  DIFFICULTIES,
  RESOURCE_TYPES,
  getResources,
  isFullyEnriched,
} from '../src/curation-model.js';

const strict = process.argv.includes('--strict');

const raw = JSON.parse(
  await readFile(
    new URL('../curated-links.json', import.meta.url),
    'utf8',
  ),
);

const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}

function warning(message) {
  warnings.push(message);
}

function validUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' ||
      url.protocol === 'http:'
    );
  } catch {
    return false;
  }
}

if (raw?._meta?.schemaVersion !== 2) {
  error(
    'curated-links.json must use schemaVersion 2.',
  );
}

const entries = Object.entries(raw).filter(
  ([code]) => !code.startsWith('_'),
);

for (const [code, entry] of entries) {
  if (!isCatalogTopicCode(code)) {
    error(`${code}: unknown topic code.`);
    continue;
  }

  if (!entry || typeof entry !== 'object') {
    error(`${code}: entry must be an object.`);
    continue;
  }

  const resources = getResources(entry);

  if (resources.length === 0) {
    error(`${code}: must contain a resource.`);
  }

  if (!entry.difficulty) {
    warning(`${code}: missing difficulty.`);
  } else if (
    !DIFFICULTIES.includes(entry.difficulty)
  ) {
    error(
      `${code}: invalid difficulty "${entry.difficulty}".`,
    );
  }

  for (const { slot, resource } of resources) {
    const prefix = `${code}.${slot}`;

    if (!resource.title?.trim()) {
      warning(`${prefix}: missing exact title.`);
    }

    if (!resource.source?.trim()) {
      warning(`${prefix}: missing source.`);
    }

    if (!validUrl(resource.url)) {
      error(`${prefix}: invalid URL.`);
    }

    if (!resource.type) {
      warning(`${prefix}: missing type.`);
    } else if (
      !RESOURCE_TYPES.includes(resource.type)
    ) {
      error(
        `${prefix}: invalid type "${resource.type}".`,
      );
    }

    if (
      !Number.isInteger(resource.minutes) ||
      resource.minutes <= 0
    ) {
      warning(
        `${prefix}: missing positive integer minutes.`,
      );
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        resource.verifiedAt ?? '',
      )
    ) {
      warning(
        `${prefix}: missing ISO verifiedAt date.`,
      );
    }

    if (
      'paywalled' in resource &&
      typeof resource.paywalled !== 'boolean'
    ) {
      error(`${prefix}: paywalled must be boolean.`);
    }
  }

  if (entry.exercise) {
    if (!entry.exercise.prompt?.trim()) {
      error(
        `${code}.exercise: prompt is required.`,
      );
    }

    if (
      !Number.isInteger(entry.exercise.minutes) ||
      entry.exercise.minutes <= 0
    ) {
      error(
        `${code}.exercise: minutes must be positive.`,
      );
    }
  }
}

const priorityPrefixes = [
  'COMP',
  'MATH',
  'COSM',
  'THEO',
  'RSCH',
];

const report = priorityPrefixes.map(prefix => {
  const section =
    sections.find(item => item.l === prefix);

  const sectionTopics = topics.filter(
    topic => topic.code.startsWith(`${prefix}.`),
  );

  const curated = sectionTopics.filter(topic => {
    const entry = raw[topic.code];

    return getResources(entry).length > 0;
  }).length;

  const enriched = sectionTopics.filter(topic =>
    isFullyEnriched(raw[topic.code]),
  ).length;

  return {
    section: section?.name ?? prefix,
    curated: `${curated}/${sectionTopics.length}`,
    enriched: `${enriched}/${sectionTopics.length}`,
  };
});

console.table(report);

for (const message of warnings) {
  console.warn(`WARN  ${message}`);
}

for (const message of errors) {
  console.error(`ERROR ${message}`);
}

console.log(
  `\n${entries.length}/${topics.length} topic entries curated.`,
);

if (errors.length > 0) {
  process.exit(1);
}

if (strict && warnings.length > 0) {
  process.exit(1);
}