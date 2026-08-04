import {
  analyticsAllowed,
  setAnalyticsOptOut,
} from './analytics.js';

const button = document.getElementById('analyticsChoice');
const status = document.getElementById('analyticsChoiceStatus');

function browserPrivacySignal() {
  const doNotTrack =
    navigator.doNotTrack ||
    window.doNotTrack ||
    navigator.msDoNotTrack;

  if (navigator.globalPrivacyControl === true) {
    return 'Global Privacy Control is enabled, so analytics stays off.';
  }

  if (doNotTrack === '1' || doNotTrack === 'yes') {
    return 'Do Not Track is enabled, so analytics stays off.';
  }

  return null;
}

function render() {
  const signal = browserPrivacySignal();
  const enabled = analyticsAllowed();

  button.textContent = enabled
    ? 'Disable aggregate analytics'
    : 'Enable aggregate analytics';
  button.disabled = Boolean(signal);
  status.textContent = signal || (
    enabled
      ? 'Anonymous aggregate analytics is enabled in this browser.'
      : 'Aggregate analytics is disabled in this browser.'
  );
}

button.addEventListener('click', () => {
  setAnalyticsOptOut(analyticsAllowed());
  render();
});

render();
