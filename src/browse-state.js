export const BROWSE_MODES = Object.freeze([
  'focus',
  'all',
]);

export function normalizeBrowseState(input, sections) {
  const sectionKeys = sections.map(section => section.k);
  const fallbackSection = sectionKeys[0] || '';
  const source = input && typeof input === 'object' ? input : {};

  return {
    mode: BROWSE_MODES.includes(source.mode)
      ? source.mode
      : 'focus',
    section: sectionKeys.includes(source.section)
      ? source.section
      : fallbackSection,
  };
}

export function stepSection(sections, current, direction = 1) {
  const keys = sections.map(section => section.k);
  if (keys.length === 0) return '';

  const currentIndex = Math.max(0, keys.indexOf(current));
  const offset = direction < 0 ? -1 : 1;
  const nextIndex = (currentIndex + offset + keys.length) % keys.length;

  return keys[nextIndex];
}

export function shouldShowShelf({
  shelfId,
  mode,
  activeSection,
  query,
  matches,
}) {
  if (!matches) return false;
  if (shelfId === 'pinned') return true;
  if (String(query || '').trim()) return true;
  if (mode === 'all') return true;

  return shelfId === activeSection;
}
