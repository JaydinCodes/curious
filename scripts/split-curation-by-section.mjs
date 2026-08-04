import {
  access,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  sections,
  isCatalogTopicCode,
} from '../src/data/catalog.js';

const root = new URL('../', import.meta.url);

const sourcePath = new URL(
  'curated-links.json',
  root,
);

const sectionDirectory = new URL(
  'curation/sections/',
  root,
);

const metaPath = new URL(
  'curation/meta.json',
  root,
);

const force = process.argv.includes('--force');

const source = JSON.parse(
  await readFile(sourcePath, 'utf8'),
);

if (!source?._meta) {
  throw new Error(
    'curated-links.json does not contain _meta.',
  );
}

const topicEntries = Object.entries(source).filter(
  ([code]) => !code.startsWith('_'),
);

for (const [code] of topicEntries) {
  if (!isCatalogTopicCode(code)) {
    throw new Error(
      `Unknown topic code in curated-links.json: ${code}`,
    );
  }
}

async function assertWritable(path) {
  if (force) return;

  try {
    await access(path);

    throw new Error(
      `${path.pathname} already exists. ` +
      'Use --force to overwrite section files.',
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

await mkdir(sectionDirectory, {
  recursive: true,
});

await assertWritable(metaPath);

await writeFile(
  metaPath,
  `${JSON.stringify(source._meta, null, 2)}\n`,
  'utf8',
);

for (const section of sections) {
  const filename =
    `${section.k}.json`;

  const path = new URL(
    filename,
    sectionDirectory,
  );

  await assertWritable(path);

  const entries = Object.fromEntries(
    topicEntries
      .filter(([code]) =>
        code.startsWith(`${section.l}.`),
      )
      .sort(([left], [right]) =>
        left.localeCompare(
          right,
          undefined,
          { numeric: true },
        ),
      ),
  );

  await writeFile(
    path,
    `${JSON.stringify(entries, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `${section.l.padEnd(4)} ${Object.keys(entries).length} entries`,
  );
}

console.log(
  '\nCuration split into curation/sections/.',
);