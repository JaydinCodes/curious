const CODE_RE = /^[a-f0-9]{32}$/;

export function todayStr(date = new Date()) {
  const pad = number => String(number).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
}

export function yesterdayStr(date = new Date()) {
  return todayStr(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() - 1,
    ),
  );
}

export function streakMark(streak, now = new Date()) {
  const today = todayStr(now);

  const current =
    streak?.lastDay === today
      ? streak.current
      : streak?.lastDay === yesterdayStr(now)
        ? streak.current + 1
        : 1;

  return {
    current,
    best: Math.max(current, streak?.best ?? 0),
    lastDay: today,
  };
}

export function streakNow(streak, now = new Date()) {
  if (!streak) {
    return {
      current: 0,
      best: 0,
    };
  }

  const live =
    streak.lastDay === todayStr(now) ||
    streak.lastDay === yesterdayStr(now);

  return {
    current: live ? streak.current : 0,
    best: streak.best ?? 0,
  };
}

export function mergeStreak(local, remote) {
  if (!local) return remote ?? null;
  if (!remote) return local;

  let base;

  if (local.lastDay > remote.lastDay) {
    base = local;
  } else if (remote.lastDay > local.lastDay) {
    base = remote;
  } else {
    base = {
      current: Math.max(local.current, remote.current),
      lastDay: local.lastDay,
    };
  }

  return {
    current: base.current,
    best: Math.max(
      local.best ?? 0,
      remote.best ?? 0,
      base.current,
    ),
    lastDay: base.lastDay,
  };
}

export function mergePins(local = {}, remote = {}) {
  const merged = { ...local };

  for (const [code, timestamp] of Object.entries(remote)) {
    merged[code] = Math.max(merged[code] ?? 0, timestamp);
  }

  const newestCodes = Object.keys(merged)
    .sort((left, right) => merged[right] - merged[left])
    .slice(0, 3);

  return Object.fromEntries(
    newestCodes
      .sort((left, right) => merged[left] - merged[right])
      .map(code => [code, merged[code]]),
  );
}

function canonicalJson(value) {
  if (value == null) return 'null';

  return JSON.stringify(
    value,
    Object.keys(value).sort(),
  );
}

export function mergeRecords(local, remote) {
  const mergedDone = {
    ...(remote.done ?? {}),
    ...(local.done ?? {}),
  };

  const mergedTouched = {
    ...(local.touched ?? {}),
  };

  for (const [code, timestamp] of Object.entries(
    remote.touched ?? {},
  )) {
    mergedTouched[code] = Math.max(
      mergedTouched[code] ?? 0,
      timestamp,
    );
  }

  const record = {
    done: mergedDone,
    touched: mergedTouched,
    pins: mergePins(local.pins, remote.pins),
    streak: mergeStreak(
      local.streak ?? null,
      remote.streak ?? null,
    ),
  };

  const fields = ['done', 'touched', 'pins', 'streak'];

  const differsFrom = base =>
    fields.some(field => {
      const fallback = field === 'streak' ? null : {};

      return (
        canonicalJson(record[field]) !==
        canonicalJson(base[field] ?? fallback)
      );
    });

  return {
    rec: record,
    changedLocal: differsFrom(local),
    changedRemote: differsFrom(remote),
  };
}

export function neglected(
  sections,
  topics,
  done = {},
  touched = {},
) {
  let leastExplored = null;

  for (const section of sections) {
    const sectionTopics = topics.filter(
      topic => topic.c === section.k,
    );

    if (sectionTopics.length === 0) continue;

    const completed = sectionTopics.filter(
      topic => done[topic.code],
    ).length;

    if (completed === sectionTopics.length) continue;

    const touchedCount = sectionTopics.filter(
      topic => touched[topic.code],
    ).length;

    const ratio = completed / sectionTopics.length;

    const shouldReplace =
      !leastExplored ||
      ratio < leastExplored.ratio ||
      (
        ratio === leastExplored.ratio &&
        touchedCount < leastExplored.touch
      );

    if (shouldReplace) {
      leastExplored = {
        sec: section,
        ratio,
        done: completed,
        total: sectionTopics.length,
        touch: touchedCount,
      };
    }
  }

  return leastExplored;
}

export function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, '');

  return CODE_RE.test(normalized)
    ? normalized
    : null;
}

export function groupCode(code) {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}