import {
  sections,
  topics,
  store,
  done,
} from './catalog.js';
import { loadCurationData } from './curation-data.js';
import {
  createProgressExport,
  filterTopics,
  parseProgressImport,
} from './learning-state.js';

const sectionSelect = document.getElementById('drawSection');
const difficultySelect = document.getElementById('drawDifficulty');
const statusSelect = document.getElementById('drawStatus');
const filterSummary = document.getElementById('drawFilterSummary');
const exportButton = document.getElementById('exportProgress');
const importButton = document.getElementById('importProgress');
const importInput = document.getElementById('importProgressFile');
const transferStatus = document.getElementById('transferStatus');

const curation = await loadCurationData();
const validCodes = topics.map(topic => topic.code);

for (const section of sections) {
  const option = document.createElement('option');
  option.value = section.k;
  option.textContent = `${section.l} · ${section.name}`;
  sectionSelect.appendChild(option);
}

function currentDrawPool() {
  return filterTopics({
    topics,
    curation,
    done,
    started: store.get('started', {}),
    section: sectionSelect.value,
    difficulty: difficultySelect.value,
    status: statusSelect.value,
  });
}

function updateFilterSummary() {
  const count = currentDrawPool().length;
  filterSummary.textContent = `${count} topic${count === 1 ? '' : 's'} available`;
}

[sectionSelect, difficultySelect, statusSelect].forEach(control => {
  control.addEventListener('change', updateFilterSummary);
});

function downloadJson(filename, value) {
  const blob = new Blob(
    [`${JSON.stringify(value, null, 2)}\n`],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

exportButton.addEventListener('click', () => {
  const payload = createProgressExport(
    {
      done,
      started: store.get('started', {}),
      notes: store.get('notes', {}),
      touched: store.get('touched', {}),
      pins: store.get('pins', {}),
      streak: store.get('streak', null),
    },
    { validCodes },
  );

  downloadJson(
    `curiosity-catalog-progress-${new Date().toISOString().slice(0, 10)}.json`,
    payload,
  );

  transferStatus.textContent = 'Progress exported. The sync code was not included.';
});

importButton.addEventListener('click', () => importInput.click());

importInput.addEventListener('change', async () => {
  const [file] = importInput.files || [];
  importInput.value = '';

  if (!file) return;

  try {
    const imported = parseProgressImport(
      await file.text(),
      validCodes,
    );

    const proceed = window.confirm(
      'Importing replaces this browser’s marks, starts, notes, pins and streak. Continue?',
    );

    if (!proceed) {
      transferStatus.textContent = 'Import cancelled.';
      return;
    }

    store.save(imported.done);
    store.set('started', imported.started);
    store.set('notes', imported.notes);
    store.set('touched', imported.touched);
    store.set('pins', imported.pins);
    store.set('streak', imported.streak);

    transferStatus.textContent = 'Progress imported. Reloading…';
    window.location.reload();
  } catch (error) {
    transferStatus.textContent = error.message;
  }
});

updateFilterSummary();
