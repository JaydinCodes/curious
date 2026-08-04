export const RESOURCE_SLOTS = Object.freeze([
  'video',
  'article',
  'deeper',
]);

export const DIFFICULTIES = Object.freeze([
  'introductory',
  'intermediate',
  'advanced',
]);

export const RESOURCE_TYPES = Object.freeze([
  'video',
  'article',
  'reference',
  'book',
  'paper',
  'documentary',
  'course',
]);

export function getResources(entry) {
  if (!entry || typeof entry !== 'object') return [];

  return RESOURCE_SLOTS.flatMap(slot => {
    const resource = entry[slot];

    if (
      !resource ||
      typeof resource !== 'object' ||
      typeof resource.url !== 'string'
    ) {
      return [];
    }

    return [{ slot, resource }];
  });
}

export function getResourceType(slot, resource) {
  if (resource?.type) return resource.type;
  if (slot === 'video') return 'video';
  if (slot === 'article') return 'article';

  return 'reference';
}

export function formatLabel(value) {
  if (typeof value !== 'string' || !value) return '';

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatMinutes(minutes) {
  if (!Number.isInteger(minutes) || minutes <= 0) return '';

  return minutes === 1
    ? '1 min'
    : `${minutes} min`;
}

export function getTotalMinutes(entry) {
  const resourceMinutes = getResources(entry).reduce(
    (total, { resource }) =>
      total +
      (
        Number.isInteger(resource.minutes) &&
        resource.minutes > 0
          ? resource.minutes
          : 0
      ),
    0,
  );

  const exerciseMinutes =
    Number.isInteger(entry?.exercise?.minutes) &&
    entry.exercise.minutes > 0
      ? entry.exercise.minutes
      : 0;

  return resourceMinutes + exerciseMinutes;
}

export function isFullyEnriched(entry) {
  const resources = getResources(entry);

  if (
    !DIFFICULTIES.includes(entry?.difficulty) ||
    resources.length === 0
  ) {
    return false;
  }

  return resources.every(({ resource }) =>
    typeof resource.title === 'string' &&
    resource.title.trim() &&
    typeof resource.source === 'string' &&
    resource.source.trim() &&
    RESOURCE_TYPES.includes(resource.type) &&
    Number.isInteger(resource.minutes) &&
    resource.minutes > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(resource.verifiedAt ?? ''),
  );
}