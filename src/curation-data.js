const CODE_RE = /^[A-Z]{2,6}\.\d{2,3}$/;

let cache = null;
let pending = null;

export async function loadCurationData() {
  if (cache) return cache;

  if (!pending) {
    pending = fetch(
      new URL('../curated-links.json', import.meta.url),
      { cache: 'no-cache' },
    )
      .then(response => {
        if (!response.ok) {
          throw new Error(`Could not load curation data: HTTP ${response.status}`);
        }

        return response.json();
      })
      .then(data => {
        const map = {};

        if (data && typeof data === 'object') {
          for (const [code, entry] of Object.entries(data)) {
            if (
              CODE_RE.test(code) &&
              entry &&
              typeof entry === 'object' &&
              !Array.isArray(entry)
            ) {
              map[code] = entry;
            }
          }
        }

        cache = Object.freeze(map);
        window.CURATED = cache;

        return cache;
      })
      .catch(error => {
        console.warn('Curation data unavailable:', error);
        cache = Object.freeze({});
        window.CURATED = cache;

        return cache;
      });
  }

  return pending;
}

export function getCuration(code) {
  return cache?.[code] ?? null;
}
