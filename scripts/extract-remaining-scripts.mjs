import {
  access,
  copyFile,
  readFile,
  writeFile,
} from 'node:fs/promises';

const root = new URL('../', import.meta.url);

const htmlPath = new URL('index.html', root);
const indexJsPath = new URL('index.js', root);
const progressPath = new URL('progress-plus.js', root);
const curationPath = new URL('curation.js', root);
const backupPath = new URL('index.before-script-extraction.html', root);

try {
  await access(indexJsPath);
} catch {
  throw new Error(
    'index.js was not found. Make sure it exists in the project root.',
  );
}

const html = await readFile(htmlPath, 'utf8');

const inlineScripts = [
  ...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi),
];

if (inlineScripts.length !== 2) {
  throw new Error(
    `Expected 2 remaining inline scripts, found ${inlineScripts.length}.`,
  );
}

let progressSource = inlineScripts[0][1].trim();
const curationSource = inlineScripts[1][1].trim();

/*
 * Fix existing sync bugs while extracting the script.
 */
progressSource = progressSource
  .replace(
    "const response = await api('api/progress', {",
    "const response = await api('/api/progress', {",
  )
  .replace(
    "if (!response.ok) throw new Error('http ' + r.status);",
    'if (!response.ok) throw responseError(response);',
  )
  .replace(
    `    } catch (err) {
      syncUnavailable = error.status === 503;`,
    `    } catch (err) {
      syncUnavailable = err.status === 503;`,
  );

await copyFile(htmlPath, backupPath);

await writeFile(
  progressPath,
  `${progressSource}\n`,
  'utf8',
);

await writeFile(
  curationPath,
  `${curationSource}\n`,
  'utf8',
);

let updatedHtml = html;

/*
 * Remove the invalid <link rel="script"> element.
 */
updatedHtml = updatedHtml.replace(
  /<link\b(?=[^>]*\brel=["']script["'])(?=[^>]*\bhref=["']\.?\/?index\.js["'])[^>]*>\s*/i,
  '',
);

/*
 * Remove both remaining inline scripts.
 */
for (const match of inlineScripts) {
  updatedHtml = updatedHtml.replace(match[0], '');
}

/*
 * Script order matters:
 * 1. index.js creates the catalog and shared variables.
 * 2. progress-plus.js enhances the rendered catalog.
 * 3. curation.js upgrades resource links.
 */
const externalScripts = `
<script src="./index.js"></script>
<script src="./progress-plus.js"></script>
<script src="./curation.js"></script>
`;

if (!updatedHtml.includes('</body>')) {
  throw new Error('Could not find </body> in index.html.');
}

updatedHtml = updatedHtml.replace(
  '</body>',
  `${externalScripts}\n</body>`,
);

await writeFile(
  htmlPath,
  updatedHtml,
  'utf8',
);

console.log('Remaining inline scripts extracted successfully.');
console.log('Created: progress-plus.js');
console.log('Created: curation.js');
console.log('Updated: index.html');
console.log('Backup: index.before-script-extraction.html');