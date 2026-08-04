import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTopicOfDay,
  stableHash,
  utcDateKey,
} from '../src/topic-of-day.js';

test('utcDateKey is stable across local timezone representations', () => {
  assert.equal(
    utcDateKey(new Date('2026-08-04T23:30:00+02:00')),
    '2026-08-04',
  );
});

test('stableHash is deterministic', () => {
  assert.equal(stableHash('2026-08-04'), stableHash('2026-08-04'));
});

test('getTopicOfDay returns the same topic for the same UTC day', () => {
  const topics = [
    { code: 'A.01' },
    { code: 'B.01' },
    { code: 'C.01' },
  ];

  const morning = getTopicOfDay(
    topics,
    new Date('2026-08-04T01:00:00Z'),
  );
  const evening = getTopicOfDay(
    topics,
    new Date('2026-08-04T23:59:59Z'),
  );

  assert.equal(morning, evening);
});

test('getTopicOfDay returns null for an empty catalogue', () => {
  assert.equal(getTopicOfDay([]), null);
});
