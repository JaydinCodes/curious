import test from 'node:test';
import assert from 'node:assert/strict';

import { topics } from '../src/data/catalog.js';
import {
  collections,
  getCollection,
} from '../src/data/collections.js';

test('collection slugs are unique', () => {
  assert.equal(
    new Set(collections.map(collection => collection.slug)).size,
    collections.length,
  );
});

test('every collection topic code exists in the catalogue', () => {
  const validCodes = new Set(topics.map(topic => topic.code));

  for (const collection of collections) {
    for (const code of collection.codes) {
      assert.equal(
        validCodes.has(code),
        true,
        `${collection.slug} contains unknown topic ${code}`,
      );
    }
  }
});

test('getCollection finds a configured landing page', () => {
  assert.equal(
    getCollection('best-computing-topics')?.title,
    'Best Computing Topics',
  );
});
