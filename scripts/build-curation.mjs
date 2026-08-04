import {
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  sections,
  isCatalogTopicCode,
} from '../src/data/catalog.js';

const root = new URL('../', import.meta.url);

const metaPath = new URL(
  'curation/meta.json',
  root,
);

const sectionDirectory = new URL(
  'curation/sections/',
  root,
);

const outputPath = new URL(
  'curated-links.json',
  root,
);

const meta = JSON.parse(
  await readFile(metaPath, 'utf8'),
);

const output = {
  _meta: {
    ...meta,
    schemaVersion: 2,
    curatedSections: [],
  },
};

const seenCodes = new Set();

for (const section of sections) {
  const path = new URL(
    `${section.k}.json`,
    sectionDirectory,
  );

  let entries;

  try {
    entries = JSON.parse(
      await readFile(path, 'utf8'),
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      entries = {};
    } else {
      throw error;
    }
  }

  if (
    !entries ||
    typeof entries !== 'object' ||
    Array.isArray(entries)
  ) {
    throw new Error(
      `${section.k}.json must contain an object.`,
    );
  }

  const sortedEntries = Object.entries(entries)
    .sort(([left], [right]) =>
      left.localeCompare(
        right,
        undefined,
        { numeric: true },
      ),
    );

  for (const [code, entry] of sortedEntries) {
    if (!code.startsWith(`${section.l}.`)) {
      throw new Error(
        `${code} belongs in another section file.`,
      );
    }

    if (!isCatalogTopicCode(code)) {
      throw new Error(
        `Unknown topic code: ${code}`,
      );
    }

    if (seenCodes.has(code)) {
      throw new Error(
        `Duplicate topic code: ${code}`,
      );
    }

    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry)
    ) {
      throw new Error(
        `${code} must contain an object.`,
      );
    }

    seenCodes.add(code);
    output[code] = entry;
  }

  if (sortedEntries.length > 0) {
    output._meta.curatedSections.push(
      section.l,
    );
  }
}

await writeFile(
  outputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
);

console.log(
  `Built curated-links.json with ${seenCodes.size} topics.`,
);