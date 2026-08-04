import {
  sections,
  topics,
} from './data/catalog.js';
import {
  formatLabel,
  formatMinutes,
  getResources,
  getResourceType,
  getTotalMinutes,
} from './curation-model.js';
import { loadCurationData } from './curation-data.js';
import { getTopicStatus } from './learning-state.js';
import { store } from './storage.js';

const params = new URLSearchParams(window.location.search);
const code = (params.get('code') || '').trim().toUpperCase();
const topic = topics.find(item => item.code === code) || null;
const section = topic
  ? sections.find(item => item.k === topic.c) || null
  : null;

const loading = document.getElementById('topicLoading');
const sheet = document.getElementById('topicSheet');
const errorPanel = document.getElementById('topicError');

if (!topic || !section) {
  loading.hidden = true;
  errorPanel.hidden = false;
} else {
  const curation = await loadCurationData();
  const entry = curation[topic.code] || null;
  const done = store.load();
  const started = store.get('started', {});
  const notes = store.get('notes', {});
  const touched = store.get('touched', {});

  const title = document.getElementById('topicTitle');
  const codeElement = document.getElementById('topicCode');
  const navCode = document.getElementById('topicNavCode');
  const sectionElement = document.getElementById('topicSection');
  const hook = document.getElementById('topicHook');
  const meta = document.getElementById('topicMeta');
  const resourcesElement = document.getElementById('topicResources');
  const exerciseSection = document.getElementById('exerciseSection');
  const exercisePrompt = document.getElementById('exercisePrompt');
  const exerciseTime = document.getElementById('exerciseTime');
  const notesElement = document.getElementById('topicNotes');
  const noteStatus = document.getElementById('noteStatus');
  const statusElement = document.getElementById('topicStatus');
  const startButton = document.getElementById('startLearning');
  const completeButton = document.getElementById('completeTopic');
  const finishButton = document.getElementById('finishTopic');

  document.title = `${topic.t} · The Curiosity Catalog`;
  sheet.style.setProperty('--cat', `var(--${section.k})`);
  document.body.style.setProperty('--cat', `var(--${section.k})`);

  codeElement.textContent = topic.code;
  navCode.textContent = topic.code;
  sectionElement.textContent = section.name;
  title.textContent = topic.t;
  hook.textContent = topic.h;
  notesElement.value = notes[topic.code] || '';

  function addMeta(label) {
    if (!label) return;
    const item = document.createElement('span');
    item.textContent = label;
    meta.appendChild(item);
  }

  addMeta(formatLabel(entry?.difficulty || 'unrated'));

  const totalMinutes = getTotalMinutes(entry);
  addMeta(totalMinutes > 0 ? `${formatMinutes(totalMinutes)} total` : 'Open-ended');
  addMeta(section.l);

  function fallbackResources() {
    return [
      {
        slot: 'video',
        resource: {
          title: `Search videos about ${topic.t}`,
          source: 'YouTube search',
          type: 'video',
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic.w)}`,
        },
      },
      {
        slot: 'article',
        resource: {
          title: `Search references about ${topic.t}`,
          source: 'Wikipedia search',
          type: 'reference',
          url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(topic.r)}`,
        },
      },
    ];
  }

  const resources = getResources(entry);
  const learningResources = resources.length > 0
    ? resources
    : fallbackResources();

  learningResources.forEach(({ slot, resource }, index) => {
    const link = document.createElement('a');
    link.className = 'learning-resource';
    link.href = resource.url;
    link.target = '_blank';
    link.rel = 'noopener';

    const step = document.createElement('span');
    step.className = 'resource-step';
    step.textContent = String(index + 1).padStart(2, '0');

    const copy = document.createElement('span');
    const resourceTitle = document.createElement('strong');
    resourceTitle.textContent = resource.title || 'Learning resource';

    const resourceMeta = document.createElement('small');
    resourceMeta.textContent = [
      resource.source,
      formatLabel(getResourceType(slot, resource)),
      formatMinutes(resource.minutes),
      resource.paywalled ? 'Paywalled' : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const arrow = document.createElement('span');
    arrow.className = 'resource-arrow';
    arrow.textContent = '↗';

    copy.append(resourceTitle, resourceMeta);
    link.append(step, copy, arrow);

    link.addEventListener('click', () => {
      markStarted();
      touched[topic.code] = Date.now();
      store.set('touched', touched);
    });

    resourcesElement.appendChild(link);
  });

  if (entry?.exercise?.prompt) {
    exercisePrompt.textContent = entry.exercise.prompt;
    exerciseTime.textContent = formatMinutes(entry.exercise.minutes);
    exerciseSection.hidden = false;
  }

  function markStarted() {
    if (!started[topic.code]) {
      started[topic.code] = Date.now();
      store.set('started', started);
    }

    updateStatus();
  }

  function setCompleted(value) {
    if (value) {
      markStarted();
      done[topic.code] = 1;
    } else {
      delete done[topic.code];
    }

    store.save(done);
    updateStatus();
  }

  function updateStatus() {
    const status = getTopicStatus(topic.code, done, started);

    if (status === 'done') {
      statusElement.textContent = 'Completed. Your reflection remains editable.';
      startButton.textContent = 'Review learning path';
      completeButton.textContent = 'Mark incomplete';
      finishButton.textContent = 'Mark incomplete';
      completeButton.setAttribute('aria-pressed', 'true');
      finishButton.setAttribute('aria-pressed', 'true');
    } else if (status === 'in-progress') {
      statusElement.textContent = 'In progress. Continue with the next resource or reflection.';
      startButton.textContent = 'Continue learning';
      completeButton.textContent = 'Mark complete';
      finishButton.textContent = 'Mark complete';
      completeButton.setAttribute('aria-pressed', 'false');
      finishButton.setAttribute('aria-pressed', 'false');
    } else {
      statusElement.textContent = 'Not started.';
      startButton.textContent = 'Start learning';
      completeButton.textContent = 'Mark complete';
      finishButton.textContent = 'Mark complete';
      completeButton.setAttribute('aria-pressed', 'false');
      finishButton.setAttribute('aria-pressed', 'false');
    }
  }

  function toggleCompleted() {
    setCompleted(!done[topic.code]);
  }

  startButton.addEventListener('click', () => {
    markStarted();
    const firstResource = resourcesElement.querySelector('a');
    firstResource?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstResource?.focus({ preventScroll: true });
  });

  completeButton.addEventListener('click', toggleCompleted);
  finishButton.addEventListener('click', toggleCompleted);

  let saveTimer = 0;

  notesElement.addEventListener('input', () => {
    noteStatus.textContent = 'Saving…';
    clearTimeout(saveTimer);

    saveTimer = window.setTimeout(() => {
      const value = notesElement.value.slice(0, 20_000);

      if (value.trim()) notes[topic.code] = value;
      else delete notes[topic.code];

      store.set('notes', notes);
      markStarted();
      noteStatus.textContent = store.isPersistent()
        ? 'Saved in this browser.'
        : 'Saved for this session only; browser storage is unavailable.';
    }, 400);
  });

  updateStatus();
  loading.hidden = true;
  sheet.hidden = false;

  if (params.get('start') === '1') {
    markStarted();
  }
}
