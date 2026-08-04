import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProgressExport,
  filterTopics,
  getTopicStatus,
  parseProgressImport,
} from '../src/learning-state.js';

const topics = [
  { code: 'MATH.01', c: 'math' },
  { code: 'MATH.02', c: 'math' },
  { code: 'COMP.01', c: 'comp' },
];

const curation = {
  'MATH.01': { difficulty: 'advanced' },
  'MATH.02': { difficulty: 'introductory' },
  'COMP.01': { difficulty: 'introductory' },
};

test('getTopicStatus distinguishes not started, active and done topics', () => {
  assert.equal(getTopicStatus('MATH.01', {}, {}), 'not-started');
  assert.equal(
    getTopicStatus('MATH.01', {}, { 'MATH.01': 100 }),
    'in-progress',
  );
  assert.equal(
    getTopicStatus(
      'MATH.01',
      { 'MATH.01': 1 },
      { 'MATH.01': 100 },
    ),
    'done',
  );
});

test('filterTopics combines section, difficulty and status filters', () => {
  const result = filterTopics({
    topics,
    curation,
    done: {},
    started: { 'MATH.02': 100 },
    section: 'math',
    difficulty: 'introductory',
    status: 'in-progress',
  });

  assert.deepEqual(
    result.map(topic => topic.code),
    ['MATH.02'],
  );
});

test('todo includes both unstarted and in-progress topics', () => {
  const result = filterTopics({
    topics,
    curation,
    done: { 'MATH.01': 1 },
    started: { 'MATH.02': 100 },
    status: 'todo',
  });

  assert.deepEqual(
    result.map(topic => topic.code),
    ['MATH.02', 'COMP.01'],
  );
});

test('progress exports omit sync credentials and unknown topics', () => {
  const payload = createProgressExport(
    {
      done: { 'MATH.01': 1, 'FAKE.01': 1 },
      started: { 'MATH.02': 123 },
      notes: { 'MATH.01': 'A useful reflection.' },
      touched: { 'MATH.01': 456 },
      pins: {
        'MATH.01': 100,
        'MATH.02': 200,
        'COMP.01': 300,
        'FAKE.01': 400,
      },
      streak: {
        current: 2,
        best: 5,
        lastDay: '2026-08-04',
      },
      sync: { code: 'secret' },
    },
    {
      now: Date.UTC(2026, 7, 4),
      validCodes: topics.map(topic => topic.code),
    },
  );

  assert.equal(payload.exportedAt, '2026-08-04T00:00:00.000Z');
  assert.deepEqual(payload.state.done, { 'MATH.01': 1 });
  assert.equal('sync' in payload.state, false);
  assert.equal('FAKE.01' in payload.state.pins, false);
});

test('progress imports validate the format and sanitize state', () => {
  const imported = parseProgressImport(
    JSON.stringify({
      kind: 'curiosity-catalog-progress',
      version: 1,
      state: {
        done: { 'MATH.01': true, 'FAKE.01': true },
        started: { 'MATH.02': 123.8 },
        notes: {
          'MATH.01': 'Keep this',
          'FAKE.01': 'Drop this',
        },
        pins: {
          'MATH.01': 100,
          'MATH.02': 200,
          'COMP.01': 300,
        },
        streak: {
          current: 2,
          best: 4,
          lastDay: '2026-08-04',
        },
      },
    }),
    topics.map(topic => topic.code),
  );

  assert.deepEqual(imported.done, { 'MATH.01': 1 });
  assert.deepEqual(imported.started, { 'MATH.02': 123 });
  assert.deepEqual(imported.notes, { 'MATH.01': 'Keep this' });
  assert.deepEqual(imported.pins, {
    'MATH.01': 100,
    'MATH.02': 200,
    'COMP.01': 300,
  });
});

test('progress imports reject unrelated JSON files', () => {
  assert.throws(
    () => parseProgressImport('{"hello":"world"}'),
    /not a Curiosity Catalog progress export/,
  );
});
