import {
  sections,
  topics,
  store,
  main,
  done,
  last,
  slipWatch,
  slipRead,
  updateProgress,
  applyFilters,
} from './catalog.js';

/* ---------------------------------------------------------------------------
   progress+ : pins, last-touched, streak, neglected-drawer hint, device sync.
   A separate enhancement layer: if anything in here throws, the catalog above
   keeps working untouched. Script 1 reaches in only through window.CC, and
   only when it exists.

   Sync model: localStorage stays the source of truth and the site never
   blocks on the network. The KV record is a carbon copy that devices
   union-merge through: done unions, lastTouched takes the newer timestamp
   per topic, pins union capped at three (most recent win), streak follows
   the newer day. The server is last-write-wins on the whole record;
   merging BEFORE pushing is what stops one device from erasing another's
   marks. The accepted cost: removals (un-marking, "clear all") don't
   propagate reliably — a device that still holds a mark locally will
   re-contribute it on its next sync. For a personal tracker, resurrecting
   a mark beats silently losing one. updatedAt is display-only.
--------------------------------------------------------------------------- */
(() => {
'use strict';

/* ---- pure logic (DOM-free; also exercised by tests) CC:PURE ---- */
const P = {
  todayStr(d = new Date()){
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },
  yesterdayStr(d = new Date()){
    return P.todayStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
  },
  /* advance streak state for one mark-done action happening now */
  streakMark(s, now = new Date()){
    const today = P.todayStr(now);
    const current = s && s.lastDay === today ? s.current
      : s && s.lastDay === P.yesterdayStr(now) ? s.current + 1
      : 1;
    return { current, best: Math.max(current, (s && s.best) || 0), lastDay: today };
  },
  /* what to display; a lapsed streak just reads as 0, nothing louder */
  streakNow(s, now = new Date()){
    if (!s) return { current: 0, best: 0 };
    const live = s.lastDay === P.todayStr(now) || s.lastDay === P.yesterdayStr(now);
    return { current: live ? s.current : 0, best: s.best || 0 };
  },
  mergeStreak(a, b){
    if (!a) return b || null;
    if (!b) return a;
    const base = a.lastDay > b.lastDay ? a
      : b.lastDay > a.lastDay ? b
      : { current: Math.max(a.current, b.current), lastDay: a.lastDay };
    return { current: base.current, best: Math.max(a.best || 0, b.best || 0, base.current), lastDay: base.lastDay };
  },
  mergePins(a, b){
    const m = {};
    for (const k of Object.keys(a || {})) m[k] = a[k];
    for (const k of Object.keys(b || {})) m[k] = Math.max(m[k] || 0, b[k]);
    const keep = Object.keys(m).sort((x, y) => m[y] - m[x]).slice(0, 3);
    const out = {};
    keep.sort((x, y) => m[x] - m[y]).forEach(k => { out[k] = m[k]; });
    return out;
  },
  /* canonical JSON of a flat map, for change detection */
  cj(o){ return o == null ? 'null' : JSON.stringify(o, Object.keys(o).sort()); },
  mergeRecords(local, remote){
    const doneM = Object.assign({}, remote.done || {}, local.done || {});
    const touchedM = {};
    for (const k of Object.keys(local.touched || {})) touchedM[k] = local.touched[k];
    for (const k of Object.keys(remote.touched || {})) touchedM[k] = Math.max(touchedM[k] || 0, remote.touched[k]);
    const rec = {
      done: doneM,
      touched: touchedM,
      pins: P.mergePins(local.pins, remote.pins),
      streak: P.mergeStreak(local.streak || null, remote.streak || null)
    };
    const parts = ['done', 'touched', 'pins', 'streak'];
    const differs = base => parts.some(f => P.cj(rec[f]) !== P.cj(f === 'streak' ? base[f] || null : base[f] || {}));
    return { rec, changedLocal: differs(local), changedRemote: differs(remote) };
  },
  /* lowest done-ratio drawer; ties broken by fewest touched; finished drawers skipped */
  neglected(sectionList, topicList, doneMap, touchedMap){
    let best = null;
    for (const sec of sectionList){
      const items = topicList.filter(t => t.c === sec.k);
      if (!items.length) continue;
      const d = items.filter(t => doneMap[t.code]).length;
      if (d === items.length) continue;
      const touch = items.filter(t => touchedMap[t.code]).length;
      const ratio = d / items.length;
      if (!best || ratio < best.ratio || (ratio === best.ratio && touch < best.touch)){
        best = { sec, ratio, done: d, total: items.length, touch };
      }
    }
    return best;
  },
  normalizeCode(raw){
    if (typeof raw !== 'string') return null;
    const c = raw.trim().toLowerCase().replace(/[-\s]/g, '');
    return /^[a-f0-9]{32}$/.test(c) ? c : null;
  },
  groupCode(code){ return code.replace(/(.{4})(?=.)/g, '$1-'); }
};
/* ---- CC:END-PURE ---- */

try {

  const touched = store.get('touched', {});
  const pins = store.get('pins', {});
  let streak = store.get('streak', null);
  const syncCfg = store.get('sync', null) || {};

  const el = html => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };

  /* ---------------- pins ---------------- */

  const cardByCode = {};
  document.querySelectorAll('.card').forEach(c => { cardByCode[c.dataset.code] = c; });

  Object.values(cardByCode).forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pin';
    b.textContent = '⚑';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', 'Pin ' + c.querySelector('.card-title').textContent + ' as currently exploring');
    c.querySelector('.card-links').appendChild(b);
  });

  const pinnedShelf = el(`<section class="shelf hidden" id="pinned">
    <div class="shelf-head">
      <span class="shelf-numeral">NOW</span>
      <h2 class="shelf-name">Currently exploring</h2>
      <span class="shelf-count" data-el="count"></span>
      <span class="shelf-rule"></span>
    </div>
    <p class="shelf-blurb" data-el="note"></p>
    <div class="shelf-grid" data-el="grid"></div>
  </section>`);
  main.insertBefore(pinnedShelf, main.firstChild);
  const pinGrid = pinnedShelf.querySelector('[data-el="grid"]');
  const pinCount = pinnedShelf.querySelector('[data-el="count"]');
  const pinNote = pinnedShelf.querySelector('[data-el="note"]');
  const defaultPinNote = 'Up to three drawers open at once. Pin a fourth and the oldest goes back.';
  pinNote.textContent = defaultPinNote;
  let bumpTimer = 0;

  function renderPins(){
    document.querySelectorAll('.card').forEach(c => {
      const on = !!pins[c.dataset.code];
      c.classList.toggle('pinned', on);
      const b = c.querySelector('.pin');
      if (b) b.setAttribute('aria-pressed', String(on));
    });
    const codes = Object.keys(pins).sort((a, b) => pins[a] - pins[b]);
    pinGrid.innerHTML = '';
    codes.forEach(code => {
      const orig = cardByCode[code];
      if (!orig) return;
      const clone = orig.cloneNode(true);
      clone.classList.add('in');
      clone.classList.remove('hidden');
      pinGrid.appendChild(clone);
    });
    pinCount.textContent = codes.length ? codes.length + ' of 3 slots' : '';
    applyFilters(); /* re-evaluates visibility for clones; hides the shelf when empty */
  }

  function showBump(code){
    const t = topics.find(x => x.code === code);
    pinNote.textContent = 'Returned “' + (t ? t.t : code) + '” to its drawer to make room.';
    clearTimeout(bumpTimer);
    bumpTimer = setTimeout(() => { pinNote.textContent = defaultPinNote; }, 5000);
  }

  main.addEventListener('click', e => {
    const b = e.target.closest('.pin');
    if (!b) return;
    const code = b.closest('.card').dataset.code;
    let bumped = null;
    if (pins[code]){
      delete pins[code];
    } else {
      pins[code] = Date.now();
      const order = Object.keys(pins).sort((x, y) => pins[x] - pins[y]);
      if (order.length > 3){ bumped = order[0]; delete pins[bumped]; }
    }
    store.set('pins', pins);
    renderPins();
    if (bumped) showBump(bumped);
    schedulePush();
  });

  /* ---------------- last touched ---------------- */

  function touch(code){
    touched[code] = Date.now();
    store.set('touched', touched);
    schedulePush();
  }
  main.addEventListener('click', e => {
    const a = e.target.closest('a.chip');
    if (!a) return;
    const card = a.closest('.card');
    if (card) touch(card.dataset.code);
  });
  [slipWatch, slipRead].forEach(a =>
    a.addEventListener('click', () => { if (last) touch(last.code); }));

  /* ---------------- streak + sync line ---------------- */

  const statLine = el(`<div class="stat-line">
    <span id="streakText"></span>
    <button class="btn-reset" id="syncToggle" type="button">sync: off</button>
  </div>`);
  document.querySelector('.progress-wrap').appendChild(statLine);
  const streakText = statLine.querySelector('#streakText');
  const syncToggle = statLine.querySelector('#syncToggle');

  function renderStreak(){
    const s = P.streakNow(streak);
    streakText.textContent = s.best === 0 ? ''
      : s.current > 0 ? 'streak ' + s.current + 'd · best ' + s.best + 'd'
      : 'best streak ' + s.best + 'd';
  }

  /* ---------------- sync ---------------- */

  const panel = el(`<div class="sync-panel">
    <div data-sync="off">
      <p class="sync-note">Marks live in this browser. Sync copies them to a small cloud record so another device can pick them up &mdash; no account, just a code.</p>
      <div class="sync-row">
        <button class="sync-btn" data-act="start" type="button">Start syncing</button>
        <span class="sync-note">or pair with a code from another device:</span>
      </div>
      <div class="sync-row">
        <input class="sync-input" data-el="input" type="text" placeholder="paste sync code" aria-label="Sync code from another device" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="sync-btn" data-act="pair" type="button">Pair</button>
      </div>
      <p class="sync-note" data-el="err" hidden></p>
    </div>
    <div data-sync="on" hidden>
      <p class="sync-note">Your sync code. Paste it on another device to share one set of marks:</p>
      <div class="sync-row">
        <span class="sync-code" data-el="code"></span>
        <button class="sync-btn" data-act="copy" type="button">Copy</button>
      </div>
      <div class="sync-row">
        <button class="sync-btn" data-act="now" type="button">Sync now</button>
        <button class="sync-btn" data-act="off" type="button">Turn off</button>
      </div>
      <p class="sync-note">Anyone with this code can read or change these marks &mdash; it is a reading list, not a vault. Turning sync off here leaves the cloud copy; pasting the code again reconnects it.</p>
    </div>
  </div>`);
  document.querySelector('.progress-wrap').appendChild(panel);
  const errEl = panel.querySelector('[data-el="err"]');
  const codeEl = panel.querySelector('[data-el="code"]');
  const inputEl = panel.querySelector('[data-el="input"]');

  let dirty = false, inflight = false, pushTimer = 0, retryDelay = 0;
  let syncUnavailable = false;
  const setStatus = s => { syncToggle.textContent = 'sync: ' + s; };
  const fmtTime = ms => {
    const d = new Date(ms);
    return P.todayStr(d) === P.todayStr()
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  const record = () => ({ code: syncCfg.code, done, touched, pins, streak, updatedAt: Date.now() });

  function api(url, opts){
    const o = Object.assign({}, opts);
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) o.signal = AbortSignal.timeout(8000);
    return fetch(url, o);
  }

  function responseError(response){
    const error = new Error('http ' + response.status);
    error.status = response.status;
    return error
  }

  function markSynced(){
    syncCfg.lastSyncAt = Date.now();
    store.set('sync', syncCfg);
    setStatus('synced ' + fmtTime(syncCfg.lastSyncAt));
  }

  /* debounced so a run of clicks becomes one write, never one per click */
  function schedulePush(delay = 2000){
    if (!syncCfg.code) return;
    dirty = true;

    if (syncUnavailable) {
      setStatus('unavailable');
      return;
    }

    clearTimeout(pushTimer);
    pushTimer = setTimeout(flush, delay);
  }

  async function flush(){
    if (!syncCfg.code || !dirty || inflight) return;
    inflight = true; dirty = false; retryDelay = 0;
    setStatus('syncing…');
    try {
      const response = await api('/api/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json'},
        body: JSON.stringify(record()),
      });

      if (!response.ok) throw responseError(response);

      syncUnavailable = false;
      markSynced();
    } catch (error) {
      dirty = true;
      syncUnavailable = error.status === 503;

      if(syncUnavailable){
        setStatus('unavailable');
        showErr(
          'Cloud sync is unavailable. Connect Upstash Redis in Vercel, then use "Sync now".',
        );
      } else {
        retryDelay = 30000;
        setStatus('offline');
      } 
      }
      finally {
        inflight = false;

        if (dirty && retryDelay > 0){
          clearTimeout(pushTimer);
          pushTimer = setTimeout(flush, retryDelay);
        }
    }
  }

  /* apply merged remote state to the page */
  function applyAll(){
    document.querySelectorAll('.card').forEach(c => {
      const code = c.dataset.code;
      c.classList.toggle('done', !!done[code]);
      const m = c.querySelector('.mark');
      if (m) m.setAttribute('aria-pressed', String(!!done[code]));
    });
    updateProgress();
    renderStreak();
    renderPins(); /* also runs applyFilters() */
  }

  async function pull(){
    if (!syncCfg.code) return;
    setStatus('syncing…');
    let remote;
    try {
      const response = await api('/api/progress?code=' + syncCfg.code);
      if (!response.ok) throw responseError(response);
      remote = await response.json();
    } catch (err) {
      syncUnavailable = err.status === 503;
      setStatus(syncUnavailable ? 'unavailable' : 'offline');

      if (syncUnavailable) {
        showErr(
          'Cloud sync is unavailable. Connect Upstash Redis in Vercel, then use “Sync now”.',
        );
      }

      return;
    }
    const { rec, changedLocal, changedRemote } = P.mergeRecords({ done, touched, pins, streak }, remote);
    if (changedLocal){
      Object.assign(done, rec.done);
      Object.assign(touched, rec.touched);
      for (const k of Object.keys(pins)) delete pins[k]; /* the 3-pin cap can drop a local pin */
      Object.assign(pins, rec.pins);
      streak = rec.streak;
      store.save(done);
      store.set('touched', touched);
      store.set('pins', pins);
      store.set('streak', streak);
      applyAll();
    }
    if (changedRemote){ dirty = true; flush(); } else { markSynced(); }
  }

  function renderSyncUI(){
    const on = !!syncCfg.code;
    panel.querySelector('[data-sync="off"]').hidden = on;
    panel.querySelector('[data-sync="on"]').hidden = !on;
    if (on) codeEl.textContent = P.groupCode(syncCfg.code);
    if (!on) setStatus('off');
    else if (syncUnavailable) setStatus('unavailable');
    else if (syncCfg.lastSyncAt) setStatus('synced ' + fmtTime(syncCfg.lastSyncAt));
    else setStatus('on');
  }

  const showErr = msg => { errEl.textContent = msg; errEl.hidden = false; };

  syncToggle.addEventListener('click', () => panel.classList.toggle('show'));
  panel.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'start'){
      if (!window.crypto || !crypto.getRandomValues){ showErr('This browser cannot generate a secure code.'); return; }
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      syncCfg.code = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      delete syncCfg.lastSyncAt;
      syncUnavailable = false;
      store.set('sync', syncCfg);
      errEl.hidden = true;
      renderSyncUI();
      schedulePush(0);
    } else if (act === 'pair'){
      const code = P.normalizeCode(inputEl.value);
      if (!code){ showErr('That does not look like a sync code (32 letters and digits).'); return; }
      syncCfg.code = code;
      delete syncCfg.lastSyncAt;
      syncUnavailable = false;
      store.set('sync', syncCfg);
      inputEl.value = '';
      errEl.hidden = true;
      renderSyncUI();
      pull();
    } else if (act === 'copy'){
      const grouped = P.groupCode(syncCfg.code);
      const flash = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(grouped).then(flash, () => {});
      } else {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else if (act === 'now'){
      syncUnavailable = false;
      pull();
    } else if (act === 'off'){
      clearTimeout(pushTimer);
      dirty = false;
      delete syncCfg.code;
      delete syncCfg.lastSyncAt;
      store.set('sync', syncCfg);
      renderSyncUI();
    }
  });

  /* flush pending changes when the tab goes away; keepalive lets it finish */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty && syncCfg.code){
      try {
        fetch('/api/progress', {
          method: 'POST',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(record())
        });
      } catch (err) {}
    }
  });
  window.addEventListener('online', () => { if (syncCfg.code && !syncUnavailable) pull(); });

  /* ---------------- neglected-drawer hint ---------------- */

  let hintSec = null, hintUsed = false, hintLine = null;
  function initHint(){
    if (ssGet('cc-hint-dismissed')) return;
    if (!Object.keys(done).length) return; /* untouched catalog: nothing is neglected yet */
    const n = P.neglected(sections, topics, done, touched);
    if (!n) return;
    hintSec = n.sec.k;
    const msg = n.done === 0 && n.touch === 0
      ? 'Haven’t touched ' + n.sec.name + ' yet — next draw pulls from there.'
      : 'Least explored: ' + n.sec.name + ' (' + n.done + ' of ' + n.total + ' done) — next draw pulls from there.';
    hintLine = el('<p class="hint-line"><span></span><button class="hint-x" type="button" aria-label="Dismiss hint">&times;</button></p>');
    hintLine.querySelector('span').textContent = msg;
    hintLine.querySelector('.hint-x').addEventListener('click', () => {
      hintLine.remove();
      hintSec = null;
      ssSet('cc-hint-dismissed', '1');
    });
    document.querySelector('.controls').insertAdjacentElement('afterend', hintLine);
  }

  /* ---------------- wire-up ---------------- */

  renderSyncUI();
  renderStreak();
  renderPins();
  initHint();
  if (syncCfg.code) pull();

  window.CC = {
    onMark(code, isDone){
      if (isDone){
        touched[code] = Date.now();
        store.set('touched', touched);
        streak = P.streakMark(streak);
        store.set('streak', streak);
        renderStreak();
      }
      schedulePush();
    },
    onReset(){
      /* the cleared state pushes as-is; a device still holding marks locally
         will union them back on its next sync — see README */
      schedulePush(0);
    },
    drawPool(){
      if (!hintSec || hintUsed) return null;
      const pool = topics.filter(t => t.c === hintSec && !done[t.code]);
      if (!pool.length) return null;
      hintUsed = true; /* one biased draw, then back to normal */
      if (hintLine){
        hintLine.style.opacity = '0';
        setTimeout(() => hintLine.remove(), 700);
      }
      return pool;
    }
  };

} catch (err) {
  /* the enhancement layer failing must never take the catalog with it */
  console.warn('progress+ disabled:', err);
}
})();
