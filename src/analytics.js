const OPT_OUT_KEY = 'curiosity-catalog:analytics-opt-out';
const ENDPOINT = '/api/analytics';

function storageOptedOut() {
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function analyticsAllowed() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  if (navigator.globalPrivacyControl === true) return false;

  const doNotTrack =
    navigator.doNotTrack ||
    window.doNotTrack ||
    navigator.msDoNotTrack;

  if (doNotTrack === '1' || doNotTrack === 'yes') return false;
  return !storageOptedOut();
}

export function setAnalyticsOptOut(value) {
  try {
    window.localStorage.setItem(OPT_OUT_KEY, value ? '1' : '0');
  } catch {
    // A blocked storage API already limits persistence and tracking surface.
  }
}

export function isAnalyticsOptedOut() {
  return !analyticsAllowed();
}

export function trackAnalytics(event, data = {}) {
  if (!analyticsAllowed()) return false;

  const body = JSON.stringify({ event, data });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return true;
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}
