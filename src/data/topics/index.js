import { mindTopics } from './mind.js';
import { praxTopics } from './prax.js';
import { mathTopics } from './math.js';
import { cosmTopics } from './cosm.js';
import { vitaTopics } from './vita.js';
import { engnTopics } from './engn.js';
import { infrTopics } from './infr.js';
import { compTopics } from './comp.js';
import { lingTopics } from './ling.js';
import { theoTopics } from './theo.js';
import { artTopics } from './art.js';
import { muscTopics } from './musc.js';
import { scrnTopics } from './scrn.js';
import { makeTopics } from './make.js';
import { sprtTopics } from './sprt.js';
import { histTopics } from './hist.js';
import { rschTopics } from './rsch.js';
import { econTopics } from './econ.js';

export const topics = Object.freeze([
  ...mindTopics,
  ...praxTopics,
  ...mathTopics,
  ...cosmTopics,
  ...vitaTopics,
  ...engnTopics,
  ...infrTopics,
  ...compTopics,
  ...lingTopics,
  ...theoTopics,
  ...artTopics,
  ...muscTopics,
  ...scrnTopics,
  ...makeTopics,
  ...sprtTopics,
  ...histTopics,
  ...rschTopics,
  ...econTopics,
]);

export const topicCodes = Object.freeze(
  topics.map(topic => topic.code),
);

const topicCodeSet = new Set(topicCodes);

export function isCatalogTopicCode(value) {
  return typeof value === 'string' && topicCodeSet.has(value);
}
