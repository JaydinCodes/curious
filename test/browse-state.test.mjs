import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeBrowseState,
  shouldShowShelf,
  stepSection,
} from '../src/browse-state.js';

const sections = [
  { k: 'mind' },
  { k: 'math' },
  { k: 'comp' },
];

test('normalizeBrowseState defaults to focused first section', () => {
  assert.deepEqual(
    normalizeBrowseState(null, sections),
    { mode: 'focus', section: 'mind' },
  );
});

test('normalizeBrowseState rejects unknown modes and sections', () => {
  assert.deepEqual(
    normalizeBrowseState(
      { mode: 'tiles', section: 'unknown' },
      sections,
    ),
    { mode: 'focus', section: 'mind' },
  );
});

test('stepSection wraps in both directions', () => {
  assert.equal(stepSection(sections, 'comp', 1), 'mind');
  assert.equal(stepSection(sections, 'mind', -1), 'comp');
});

test('focused browsing shows only the active shelf', () => {
  assert.equal(
    shouldShowShelf({
      shelfId: 'math',
      mode: 'focus',
      activeSection: 'math',
      query: '',
      matches: 4,
    }),
    true,
  );

  assert.equal(
    shouldShowShelf({
      shelfId: 'mind',
      mode: 'focus',
      activeSection: 'math',
      query: '',
      matches: 4,
    }),
    false,
  );
});

test('search temporarily spans every matching shelf', () => {
  assert.equal(
    shouldShowShelf({
      shelfId: 'mind',
      mode: 'focus',
      activeSection: 'math',
      query: 'memory',
      matches: 1,
    }),
    true,
  );
});

test('empty shelves remain hidden in every mode', () => {
  assert.equal(
    shouldShowShelf({
      shelfId: 'math',
      mode: 'all',
      activeSection: 'math',
      query: '',
      matches: 0,
    }),
    false,
  );
});
