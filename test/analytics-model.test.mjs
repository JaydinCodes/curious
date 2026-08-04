import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyticsKeys,
  resultCountBucket,
  sanitizeAnalyticsEvent,
  searchLengthBucket,
} from '../src/analytics-model.js';

test('search analytics keeps buckets but never raw search text', () => {
  const event = sanitizeAnalyticsEvent({
    event: 'search',
    data: {
      query: 'public key cryptography',
      queryLength: 23,
      results: 8,
    },
  });

  assert.deepEqual(event, {
    name: 'search',
    dimensions: {
      query_length: '21+',
      results: '1-10',
    },
  });
  assert.equal(JSON.stringify(event).includes('cryptography'), false);
});

test('draw analytics accepts only known catalogue topics', () => {
  assert.equal(
    sanitizeAnalyticsEvent({
      event: 'draw',
      data: { topicCode: 'FAKE.01' },
    }),
    null,
  );

  assert.deepEqual(
    sanitizeAnalyticsEvent({
      event: 'draw',
      data: {
        topicCode: 'COMP.01',
        section: 'comp',
        difficulty: 'intermediate',
        status: 'todo',
      },
    }),
    {
      name: 'draw',
      dimensions: {
        topic: 'COMP.01',
        section: 'comp',
        difficulty: 'intermediate',
        status: 'todo',
      },
    },
  );
});

test('resource clicks are reduced to topic, slot and type', () => {
  const event = sanitizeAnalyticsEvent({
    event: 'resource_click',
    data: {
      topicCode: 'MATH.01',
      slot: 'article',
      type: 'reference',
      url: 'https://example.com/private-query',
      source: 'Example source',
    },
  });

  assert.deepEqual(event, {
    name: 'resource_click',
    dimensions: {
      topic: 'MATH.01',
      slot: 'article',
      type: 'reference',
    },
  });
});

test('analytics keys include all-time and daily aggregate counters', () => {
  const keys = analyticsKeys(
    {
      name: 'complete',
      dimensions: { topic: 'COMP.01' },
    },
    '2026-08-04',
  );

  assert.deepEqual(keys, [
    'cc:analytics:v1:all:event:complete',
    'cc:analytics:v1:day:2026-08-04:event:complete',
    'cc:analytics:v1:all:event:complete:topic:COMP.01',
    'cc:analytics:v1:day:2026-08-04:event:complete:topic:COMP.01',
  ]);
});

test('bucket helpers cap analytics cardinality', () => {
  assert.equal(searchLengthBucket(4), '4-8');
  assert.equal(resultCountBucket(217), '201+');
});
