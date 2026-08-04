import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sections,
  topics,
  topicCodes,
  isCatalogTopicCode,
} from '../src/data/catalog.js';

test('catalog contains 18 sections and 217 topics', () => {
  assert.equal(sections.length, 18);
  assert.equal(topics.length, 217);
});

test('every topic code is unique', () => {
  assert.equal(new Set(topicCodes).size, topics.length);
});

test('every topic belongs to a real section', () => {
  const sectionKeys = new Set(sections.map(section => section.k));

  for (const topic of topics) {
    assert.equal(
      sectionKeys.has(topic.c),
      true,
      `${topic.code} has unknown section ${topic.c}`,
    );
  }
});

test('topic codes match their section', () => {
  const sectionByKey = new Map(
    sections.map(section => [section.k, section]),
  );

  for (const topic of topics) {
    const section = sectionByKey.get(topic.c);

    assert.match(
      topic.code,
      new RegExp(`^${section.l}\\.\\d{2,3}$`),
    );
  }
});

test('topic validator accepts only real topics', () => {
  assert.equal(isCatalogTopicCode('MIND.01'), true);
  assert.equal(isCatalogTopicCode('COMP.13'), true);

  assert.equal(isCatalogTopicCode('COMP.14'), false);
  assert.equal(isCatalogTopicCode('FAKE.01'), false);
});