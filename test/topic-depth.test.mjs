import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStudyPrompts,
  getCollectionMembership,
  getLearningStats,
  getRelatedTopics,
  getTopicPosition,
} from '../src/topic-depth.js';

const topics = [
  { code: 'COMP.01', c: 'comp', t: 'Internet' },
  { code: 'COMP.02', c: 'comp', t: 'DNS' },
  { code: 'COMP.03', c: 'comp', t: 'BGP' },
  { code: 'COMP.04', c: 'comp', t: 'Cryptography' },
  { code: 'MATH.01', c: 'math', t: 'Proof' },
];

test('getTopicPosition reports position inside its section', () => {
  assert.deepEqual(
    getTopicPosition(topics[2], topics),
    { index: 3, total: 4 },
  );
});

test('getLearningStats counts resources and exercise time', () => {
  const entry = {
    video: {
      url: 'https://example.com/video',
      minutes: 10,
    },
    article: {
      url: 'https://example.com/article',
      minutes: 20,
    },
    exercise: {
      prompt: 'Try it.',
      minutes: 15,
    },
  };

  assert.deepEqual(
    getLearningStats(entry),
    {
      resourceCount: 2,
      totalMinutes: 45,
      exerciseMinutes: 15,
      hasExercise: true,
    },
  );
});

test('buildStudyPrompts creates three concrete prompts', () => {
  const prompts = buildStudyPrompts(topics[1]);

  assert.equal(prompts.length, 3);
  assert.match(prompts[0].prompt, /DNS/);
  assert.match(prompts[2].prompt, /limitation|criticism|uncertainty/);
});

test('getRelatedTopics prefers nearest neighbours in the same section', () => {
  assert.deepEqual(
    getRelatedTopics(topics[1], topics, 3).map(topic => topic.code),
    ['COMP.01', 'COMP.03', 'COMP.04'],
  );
});

test('getCollectionMembership returns collections containing the topic', () => {
  const collections = [
    {
      slug: 'developers',
      codes: ['COMP.01', 'COMP.02'],
    },
    {
      slug: 'maths',
      codes: ['MATH.01'],
    },
  ];

  assert.deepEqual(
    getCollectionMembership('COMP.02', collections)
      .map(collection => collection.slug),
    ['developers'],
  );
});
