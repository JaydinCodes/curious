import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectionPath,
  resolveTopicFromLocation,
  slugify,
  topicCodeFromSlug,
  topicHref,
  topicPath,
} from '../src/topic-url.js';

const topic = {
  code: 'MATH.01',
  t: 'Gödel’s Incompleteness Theorems',
};

test('slugify normalizes punctuation and accents', () => {
  assert.equal(
    slugify('Gödel’s Incompleteness Theorems'),
    'godels-incompleteness-theorems',
  );
});

test('topicPath creates a stable code-first URL', () => {
  assert.equal(
    topicPath(topic),
    '/topics/math-01-godels-incompleteness-theorems',
  );
});

test('topicCodeFromSlug ignores the descriptive suffix', () => {
  assert.equal(
    topicCodeFromSlug('math-01-an-old-or-new-title'),
    'MATH.01',
  );
});

test('resolveTopicFromLocation supports clean and fallback URLs', () => {
  assert.equal(
    resolveTopicFromLocation([topic], {
      pathname: '/topics/math-01-godels-incompleteness-theorems',
      search: '',
    }),
    topic,
  );

  assert.equal(
    resolveTopicFromLocation([topic], {
      pathname: '/topic.html',
      search: '?code=MATH.01',
    }),
    topic,
  );
});

test('topicHref keeps localhost compatible with a static server', () => {
  assert.equal(
    topicHref(topic, {
      locationLike: { hostname: 'localhost' },
    }),
    '/topic.html?code=MATH.01',
  );
});

test('collectionPath creates a clean landing-page URL', () => {
  assert.equal(
    collectionPath({ slug: 'best-computing-topics' }),
    '/collections/best-computing-topics',
  );
});
