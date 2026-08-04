import test from 'node:test';
import assert from 'node:assert/strict';

import {
  todayStr,
  yesterdayStr,
  streakMark,
  streakNow,
  mergeStreak,
  mergePins,
  mergeRecords,
  neglected,
  normalizeCode,
  groupCode,
} from '../src/progress-logic.js';

test('todayStr uses the local calendar date', () => {
  assert.equal(
    todayStr(new Date(2026, 7, 4, 23, 30)),
    '2026-08-04',
  );
});

test('yesterdayStr handles month boundaries', () => {
  assert.equal(
    yesterdayStr(new Date(2026, 2, 1)),
    '2026-02-28',
  );
});

test('streakMark starts a new streak', () => {
  assert.deepEqual(
    streakMark(null, new Date(2026, 7, 4)),
    {
      current: 1,
      best: 1,
      lastDay: '2026-08-04',
    },
  );
});

test('streakMark does not increment twice on one day', () => {
  const streak = {
    current: 4,
    best: 7,
    lastDay: '2026-08-04',
  };

  assert.deepEqual(
    streakMark(streak, new Date(2026, 7, 4, 18)),
    {
      current: 4,
      best: 7,
      lastDay: '2026-08-04',
    },
  );
});

test('streakMark increments on the next day', () => {
  const streak = {
    current: 4,
    best: 4,
    lastDay: '2026-08-03',
  };

  assert.deepEqual(
    streakMark(streak, new Date(2026, 7, 4)),
    {
      current: 5,
      best: 5,
      lastDay: '2026-08-04',
    },
  );
});

test('streakMark resets after a gap', () => {
  const streak = {
    current: 8,
    best: 8,
    lastDay: '2026-08-01',
  };

  assert.deepEqual(
    streakMark(streak, new Date(2026, 7, 4)),
    {
      current: 1,
      best: 8,
      lastDay: '2026-08-04',
    },
  );
});

test('streakNow displays zero after a lapse', () => {
  const streak = {
    current: 8,
    best: 10,
    lastDay: '2026-08-01',
  };

  assert.deepEqual(
    streakNow(streak, new Date(2026, 7, 4)),
    {
      current: 0,
      best: 10,
    },
  );
});

test('mergeStreak keeps the newer streak and highest best', () => {
  assert.deepEqual(
    mergeStreak(
      {
        current: 3,
        best: 8,
        lastDay: '2026-08-03',
      },
      {
        current: 4,
        best: 6,
        lastDay: '2026-08-04',
      },
    ),
    {
      current: 4,
      best: 8,
      lastDay: '2026-08-04',
    },
  );
});

test('mergePins keeps the three newest pins', () => {
  assert.deepEqual(
    mergePins(
      {
        'MIND.01': 100,
        'MATH.01': 300,
      },
      {
        'MIND.01': 200,
        'COMP.01': 400,
        'THEO.01': 500,
      },
    ),
    {
      'MATH.01': 300,
      'COMP.01': 400,
      'THEO.01': 500,
    },
  );
});

test('mergeRecords unions done and keeps newest touched timestamp', () => {
  const result = mergeRecords(
    {
      done: {
        'MIND.01': 1,
      },
      touched: {
        'MIND.01': 100,
      },
      pins: {},
      streak: null,
    },
    {
      done: {
        'MATH.01': 1,
      },
      touched: {
        'MIND.01': 200,
      },
      pins: {},
      streak: null,
    },
  );

  assert.deepEqual(result.rec.done, {
    'MATH.01': 1,
    'MIND.01': 1,
  });

  assert.deepEqual(result.rec.touched, {
    'MIND.01': 200,
  });

  assert.equal(result.changedLocal, true);
  assert.equal(result.changedRemote, true);
});

test('mergeRecords detects already identical records', () => {
  const record = {
    done: {
      'MIND.01': 1,
    },
    touched: {},
    pins: {},
    streak: null,
  };

  const result = mergeRecords(record, record);

  assert.equal(result.changedLocal, false);
  assert.equal(result.changedRemote, false);
});

test('neglected selects the lowest completion ratio', () => {
  const sections = [
    {
      k: 'mind',
      name: 'Mind',
    },
    {
      k: 'math',
      name: 'Math',
    },
  ];

  const topics = [
    {
      c: 'mind',
      code: 'MIND.01',
    },
    {
      c: 'mind',
      code: 'MIND.02',
    },
    {
      c: 'math',
      code: 'MATH.01',
    },
    {
      c: 'math',
      code: 'MATH.02',
    },
  ];

  const result = neglected(
    sections,
    topics,
    {
      'MIND.01': 1,
    },
    {},
  );

  assert.equal(result.sec.k, 'math');
  assert.equal(result.done, 0);
  assert.equal(result.total, 2);
});

test('normalizeCode accepts grouped uppercase codes', () => {
  assert.equal(
    normalizeCode(
      'A1B2-C3D4-E5F6-7890-A1B2-C3D4-E5F6-7890',
    ),
    'a1b2c3d4e5f67890a1b2c3d4e5f67890',
  );
});

test('normalizeCode rejects malformed values', () => {
  assert.equal(normalizeCode('not-a-code'), null);
  assert.equal(normalizeCode('g'.repeat(32)), null);
  assert.equal(normalizeCode(null), null);
});

test('groupCode formats a normalized sync code', () => {
  assert.equal(
    groupCode('a1b2c3d4e5f67890'),
    'a1b2-c3d4-e5f6-7890',
  );
});