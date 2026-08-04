const NAMESPACE = 'curiosity-catalog:';
const memory = {};
let available = true;

try {
  const probe = '__cc__';
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
} catch {
  available = false;
}

function get(key, fallback) {
  if (!available) {
    return key in memory ? memory[key] : fallback;
  }

  try {
    const raw = window.localStorage.getItem(NAMESPACE + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function set(key, value) {
  memory[key] = value;

  if (!available) return;

  try {
    window.localStorage.setItem(
      NAMESPACE + key,
      JSON.stringify(value),
    );
  } catch {
    // Storage can be blocked or full. The in-memory copy still works.
  }
}

export const store = Object.freeze({
  get,
  set,
  load() {
    return get('done', {});
  },
  save(state) {
    set('done', state);
  },
  isPersistent() {
    return available;
  },
});
