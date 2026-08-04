const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export function topicSlug(topic) {
  if (!topic?.code) throw new TypeError('topicSlug requires a topic code.');

  const code = topic.code.toLowerCase().replace('.', '-');
  const title = slugify(topic.t || topic.title || 'topic');
  return title ? `${code}-${title}` : code;
}

export function topicPath(topic, { start = false } = {}) {
  const query = start ? '?start=1' : '';
  return `/topics/${topicSlug(topic)}${query}`;
}

export function topicCodeFromSlug(raw) {
  const slug = String(raw ?? '').trim().toLowerCase();
  const match = /^([a-z]{2,6})-(\d{2,3})(?:-|$)/.exec(slug);

  if (!match) return null;
  return `${match[1].toUpperCase()}.${match[2]}`;
}

export function resolveTopicFromLocation(topics, locationLike = {}) {
  const search = new URLSearchParams(locationLike.search || '');
  const queryCode = search.get('code')?.trim().toUpperCase();

  if (queryCode) {
    return topics.find(topic => topic.code === queryCode) || null;
  }

  const pathname = String(locationLike.pathname || '');
  const slug = pathname.split('/').filter(Boolean).at(-1) || '';
  const pathCode = topicCodeFromSlug(slug);

  return pathCode
    ? topics.find(topic => topic.code === pathCode) || null
    : null;
}

export function topicHref(
  topic,
  { start = false, locationLike = globalThis.location } = {},
) {
  const host = locationLike?.hostname || '';

  if (LOCAL_HOSTS.has(host)) {
    const startQuery = start ? '&start=1' : '';
    return `/topic.html?code=${encodeURIComponent(topic.code)}${startQuery}`;
  }

  return topicPath(topic, { start });
}

export function collectionPath(collection) {
  const slug = typeof collection === 'string'
    ? collection
    : collection?.slug;

  if (!slug) throw new TypeError('collectionPath requires a collection slug.');
  return `/collections/${slugify(slug)}`;
}

export function resolveCollectionSlug(locationLike = {}) {
  const search = new URLSearchParams(locationLike.search || '');
  const querySlug = search.get('slug');
  if (querySlug) return slugify(querySlug);

  const pathname = String(locationLike.pathname || '');
  return slugify(pathname.split('/').filter(Boolean).at(-1) || '');
}

export function collectionHref(
  collection,
  { locationLike = globalThis.location } = {},
) {
  const host = locationLike?.hostname || '';

  if (LOCAL_HOSTS.has(host)) {
    return `/collection.html?slug=${encodeURIComponent(collection.slug)}`;
  }

  return collectionPath(collection);
}
