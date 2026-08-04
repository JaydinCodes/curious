export const PROGRESS_EXPORT_KIND = 'curiosity-catalog-progress';
export const PROGRESS_EXPORT_VERSION = 1;

function allowedCodeSet(validCodes) {
  return validCodes instanceof Set
    ? validCodes
    : new Set(validCodes || []);
}

function isAllowed(code, allowed) {
  return allowed.size === 0 || allowed.has(code);
}

function cleanFlagMap(input, allowed) {
  const output = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return output;
  }

  for (const [code, value] of Object.entries(input)) {
    if (isAllowed(code, allowed) && value) output[code] = 1;
  }

  return output;
}

function cleanTimestampMap(input, allowed) {
  const output = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return output;
  }

  for (const [code, value] of Object.entries(input)) {
    if (
      isAllowed(code, allowed) &&
      Number.isFinite(value) &&
      value > 0
    ) {
      output[code] = Math.trunc(value);
    }
  }

  return output;
}

function cleanNotes(input, allowed) {
  const output = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return output;
  }

  for (const [code, value] of Object.entries(input)) {
    if (!isAllowed(code, allowed) || typeof value !== 'string') continue;

    const note = value.slice(0, 20_000);
    if (note.trim()) output[code] = note;
  }

  return output;
}

function cleanPins(input, allowed) {
  const pins = cleanTimestampMap(input, allowed);

  return Object.fromEntries(
    Object.entries(pins)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 3)
      .sort(([, left], [, right]) => left - right),
  );
}

function cleanStreak(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const current = Number.isInteger(input.current) && input.current >= 0
    ? input.current
    : 0;
  const best = Number.isInteger(input.best) && input.best >= current
    ? input.best
    : current;
  const lastDay = /^\d{4}-\d{2}-\d{2}$/.test(input.lastDay || '')
    ? input.lastDay
    : null;

  return lastDay ? { current, best, lastDay } : null;
}

export function getTopicStatus(code, done = {}, started = {}) {
  if (done[code]) return 'done';
  if (started[code]) return 'in-progress';
  return 'not-started';
}

export function filterTopics({
  topics,
  curation = {},
  done = {},
  started = {},
  section = 'all',
  difficulty = 'all',
  status = 'all',
}) {
  return topics.filter(topic => {
    if (section !== 'all' && topic.c !== section) return false;

    const entry = curation[topic.code] || null;
    if (
      difficulty !== 'all' &&
      entry?.difficulty !== difficulty
    ) {
      return false;
    }

    const topicStatus = getTopicStatus(topic.code, done, started);

    if (status === 'all') return true;
    if (status === 'todo') return topicStatus !== 'done';

    return topicStatus === status;
  });
}

export function createProgressExport(
  state,
  {
    now = Date.now(),
    validCodes = [],
  } = {},
) {
  const allowed = allowedCodeSet(validCodes);

  return {
    kind: PROGRESS_EXPORT_KIND,
    version: PROGRESS_EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    state: {
      done: cleanFlagMap(state.done, allowed),
      started: cleanTimestampMap(state.started, allowed),
      notes: cleanNotes(state.notes, allowed),
      touched: cleanTimestampMap(state.touched, allowed),
      pins: cleanPins(state.pins, allowed),
      streak: cleanStreak(state.streak),
    },
  };
}

export function parseProgressImport(raw, validCodes = []) {
  let payload;

  try {
    payload = typeof raw === 'string'
      ? JSON.parse(raw)
      : raw;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The selected file does not contain a progress export.');
  }

  if (payload.kind !== PROGRESS_EXPORT_KIND) {
    throw new Error('This is not a Curiosity Catalog progress export.');
  }

  if (payload.version !== PROGRESS_EXPORT_VERSION) {
    throw new Error(`Unsupported progress export version: ${payload.version}.`);
  }

  const allowed = allowedCodeSet(validCodes);
  const state = payload.state || {};

  return {
    done: cleanFlagMap(state.done, allowed),
    started: cleanTimestampMap(state.started, allowed),
    notes: cleanNotes(state.notes, allowed),
    touched: cleanTimestampMap(state.touched, allowed),
    pins: cleanPins(state.pins, allowed),
    streak: cleanStreak(state.streak),
  };
}
