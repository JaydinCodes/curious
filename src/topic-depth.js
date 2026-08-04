import {
  getResources,
  getTotalMinutes,
} from './curation-model.js';

export function getTopicPosition(topic, topics) {
  const sectionTopics = topics.filter(item => item.c === topic.c);
  const index = sectionTopics.findIndex(item => item.code === topic.code);

  return {
    index: index >= 0 ? index + 1 : 0,
    total: sectionTopics.length,
  };
}

export function getLearningStats(entry) {
  const resources = getResources(entry);
  const exerciseMinutes = Number.isInteger(entry?.exercise?.minutes)
    ? entry.exercise.minutes
    : 0;

  return {
    resourceCount: resources.length,
    totalMinutes: getTotalMinutes(entry),
    exerciseMinutes,
    hasExercise: Boolean(entry?.exercise?.prompt?.trim()),
  };
}

export function buildStudyPrompts(topic) {
  const title = topic?.t || topic?.title || 'this topic';

  return [
    {
      title: 'Explain it simply',
      prompt: `Explain ${title} in plain language without relying on specialist vocabulary.`,
    },
    {
      title: 'Make it concrete',
      prompt: `Find one real example, case, experiment, system, artwork, event, or application that makes ${title} easier to see.`,
    },
    {
      title: 'Test the edges',
      prompt: `Identify one limitation, criticism, uncertainty, trade-off, or open question connected to ${title}.`,
    },
  ];
}

export function getRelatedTopics(topic, topics, limit = 4) {
  const sectionTopics = topics.filter(item => item.c === topic.c);
  const index = sectionTopics.findIndex(item => item.code === topic.code);

  if (index < 0 || limit <= 0) return [];

  const candidates = sectionTopics
    .map((item, itemIndex) => ({
      item,
      distance: Math.abs(itemIndex - index),
      itemIndex,
    }))
    .filter(candidate => candidate.item.code !== topic.code)
    .sort((left, right) =>
      left.distance - right.distance ||
      left.itemIndex - right.itemIndex,
    );

  return candidates
    .slice(0, limit)
    .map(candidate => candidate.item);
}

export function getCollectionMembership(topicCode, collections) {
  return collections.filter(collection =>
    collection.codes.includes(topicCode),
  );
}
