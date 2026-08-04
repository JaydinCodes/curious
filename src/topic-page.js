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
import { trackAnalytics } from './analytics.js';
import {
  resolveTopicFromLocation,
  topicPath,
} from './topic-url.js';

const params = new URLSearchParams(window.location.search);
const topic = resolveTopicFromLocation(topics, window.location);
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
  const shareButton = document.getElementById('shareTopic');
  const shareStatus = document.getElementById('shareTopicStatus');

  const canonicalUrl = new URL(
    topicPath(topic),
    window.location.origin,
  ).href;

  document.title = `${topic.t} · The Curiosity Catalog`;
  sheet.style.setProperty('--cat', `var(--${section.k})`);
  document.body.style.setProperty('--cat', `var(--${section.k})`);

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = canonicalUrl;

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
    const resourceType = getResourceType(slot, resource);
    const link = document.createElement('a');
    link.className = 'learning-resource';
    link.href = resource.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.dataset.resourceSlot = slot;
    link.dataset.resourceType = resourceType;

    const step = document.createElement('span');
    step.className = 'resource-step';
    step.textContent = String(index + 1).padStart(2, '0');

    const copy = document.createElement('span');
    const resourceTitle = document.createElement('strong');
    resourceTitle.textContent = resource.title || 'Learning resource';

    const resourceMeta = document.createElement('small');
    resourceMeta.textContent = [
      resource.source,
      formatLabel(resourceType),
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
      trackAnalytics('resource_click', {
        topicCode: topic.code,
        slot,
        type: resourceType,
      });
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
    const wasDone = Boolean(done[topic.code]);

    if (value) {
      markStarted();
      done[topic.code] = 1;
    } else {
      delete done[topic.code];
    }

    store.save(done);

    if (value && !wasDone) {
      trackAnalytics('complete', { topicCode: topic.code });
    }

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

  shareButton.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: topic.t,
          text: topic.h,
          url: canonicalUrl,
        });
        shareStatus.textContent = 'Shared.';
      } else {
        await navigator.clipboard.writeText(canonicalUrl);
        shareStatus.textContent = 'Link copied.';
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        shareStatus.textContent = 'Copy the URL from your address bar.';
      }
    }
  });

  let saveTimer = 0;

  function saveNotes() {
    clearTimeout(saveTimer);
    const value = notesElement.value.slice(0, 20_000);

    if (value.trim()) notes[topic.code] = value;
    else delete notes[topic.code];

    store.set('notes', notes);

    if (value.trim()) markStarted();

    noteStatus.textContent = store.isPersistent()
      ? 'Saved in this browser.'
      : 'Saved for this session only; browser storage is unavailable.';
  }

  notesElement.addEventListener('input', () => {
    noteStatus.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNotes, 400);
  });

  notesElement.addEventListener('blur', saveNotes);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNotes();
  });

  updateStatus();
  loading.hidden = true;
  sheet.hidden = false;

  if (params.get('start') === '1') {
    markStarted();
  }
}
