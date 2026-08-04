import {
  applyFilters,
  sections,
  store,
} from './catalog.js';
import {
  normalizeBrowseState,
  stepSection,
} from './browse-state.js';

const toolbar = document.getElementById('browseToolbar');
const sectionSelect = document.getElementById('browseSection');
const summary = document.getElementById('browseSummary');
const previousButton = document.getElementById('previousBrowseSection');
const nextButton = document.getElementById('nextBrowseSection');
const search = document.getElementById('search');
const modeButtons = [
  ...document.querySelectorAll('[data-browse-mode]'),
];
const nav = document.getElementById('nav');

if (
  toolbar &&
  sectionSelect &&
  summary &&
  previousButton &&
  nextButton
) {
  let state = normalizeBrowseState(
    store.get('browse', null),
    sections,
  );

  for (const section of sections) {
    const option = document.createElement('option');
    option.value = section.k;
    option.textContent = `${section.n} · ${section.name}`;
    sectionSelect.appendChild(option);
  }

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  function activeSection() {
    return sections.find(section => section.k === state.section)
      || sections[0];
  }

  function persist() {
    store.set('browse', state);
  }

  function updateNav() {
    nav.querySelectorAll('a').forEach(link => {
      const active = link.dataset.key === state.section;
      link.classList.toggle('active', active);
      link.setAttribute(
        'aria-current',
        active ? 'location' : 'false',
      );
    });
  }

  function updateControls() {
    const section = activeSection();
    const searching = Boolean(search.value.trim());

    document.body.dataset.browseMode = state.mode;
    document.body.dataset.browseSection = state.section;
    sectionSelect.value = state.section;

    modeButtons.forEach(button => {
      const active = button.dataset.browseMode === state.mode;
      button.classList.toggle('on', active);
      button.setAttribute('aria-pressed', String(active));
    });

    previousButton.disabled = searching;
    nextButton.disabled = searching;

    if (searching) {
      summary.textContent = 'Search is checking every drawer.';
    } else if (state.mode === 'all') {
      summary.textContent = 'All 18 drawers are open. Switch to one drawer for a shorter page.';
    } else {
      const count = document.querySelectorAll(
        `.shelf#${section.k} .card`,
      ).length;

      summary.textContent = `${section.name} · ${count} topics · use Previous and Next instead of scrolling through every section.`;
    }

    updateNav();
    applyFilters();
  }

  function scrollToSection(sectionKey) {
    const target = state.mode === 'all'
      ? document.getElementById(sectionKey)
      : document.getElementById('main');

    target?.scrollIntoView({
      block: 'start',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }

  function setSection(sectionKey, { scroll = true } = {}) {
    if (!sections.some(section => section.k === sectionKey)) return;

    state = {
      ...state,
      section: sectionKey,
    };

    persist();
    updateControls();

    if (scroll) {
      scrollToSection(sectionKey);
    }
  }

  sectionSelect.addEventListener('change', () => {
    setSection(sectionSelect.value);
  });

  modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      state = normalizeBrowseState(
        {
          ...state,
          mode: button.dataset.browseMode,
        },
        sections,
      );

      persist();
      updateControls();
    });
  });

  previousButton.addEventListener('click', () => {
    setSection(stepSection(sections, state.section, -1));
  });

  nextButton.addEventListener('click', () => {
    setSection(stepSection(sections, state.section, 1));
  });

  nav.addEventListener('click', event => {
    const link = event.target.closest('a[data-key]');
    if (!link) return;

    event.preventDefault();
    setSection(link.dataset.key);
  });

  search.addEventListener('input', updateControls);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      queueMicrotask(updateControls);
    }
  });

  const hashSection = window.location.hash.replace('#', '');
  if (sections.some(section => section.k === hashSection)) {
    state = {
      ...state,
      section: hashSection,
    };
  }

  updateControls();
}
