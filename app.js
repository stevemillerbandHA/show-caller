'use strict';

// Show Caller: offline contest run sheet. Data comes from a Google Sheet on demand (Sync),
// then lives in localStorage so the app works with no signal. The app never plays sound.

// No sheet link in the code: the repo is public, so the link is entered once in Settings on the phone.
const DEFAULT_SHEET = '';
const KEY = 'showcaller.v1';
const TYPES = ['Chorus', 'Quartet'];
const WARN_SECONDS = 5;
// Raise when parseSheet changes what it stores, so data synced by an older version is re-synced.
const DATA_VERSION = 2;

const $ = (sel) => document.querySelector(sel);
const main = $('#songs');

let S = load();

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* fall through to defaults */ }
  s = s || {};
  s.sheetUrl = s.sheetUrl || DEFAULT_SHEET;
  s.type = TYPES.includes(s.type) ? s.type : 'Chorus';
  s.data = s.data || { Chorus: [], Quartet: [] };
  s.syncedAt = s.syncedAt || null;
  s.idx = Number.isInteger(s.idx) ? s.idx : 0;
  s.cues = Array.isArray(s.cues) ? s.cues : [false, false, false, false];
  s.timers = s.timers || {};
  return s;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
}

const list = () => S.data[S.type] || [];
const current = () => list()[S.idx];

// ---------- formatting ----------

function fmt(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// "#3" for a numbered slot, the text itself for a named one such as "Swan Set".
function slot(order) {
  return /^\d+(\.\d+)?$/.test(String(order)) ? '#' + order : String(order);
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- timers ----------
// Each timer is { endAt } while running or { leftMs } while paused/finished. No entry = not started.

function timerKey(c, i) { return S.type + '|' + c.order + '|' + c.name + '|' + i; }

function leftMs(key, song) {
  const t = S.timers[key];
  if (!t) return song.len * 1000;
  if (t.endAt) return Math.max(0, t.endAt - Date.now());
  return t.leftMs;
}

function toggleTimer(i) {
  const c = current();
  const song = c.songs[i];
  const key = timerKey(c, i);
  const t = S.timers[key];
  if (t && t.endAt) {
    S.timers[key] = { leftMs: Math.max(0, t.endAt - Date.now()) };
  } else {
    const ms = leftMs(key, song);
    if (ms <= 0) return;
    S.timers[key] = { endAt: Date.now() + ms };
  }
  save();
  tick();
}

function resetTimer(i) {
  delete S.timers[timerKey(current(), i)];
  save();
  tick();
}

// Runs a few times a second: finishes expired timers and refreshes the visible cards.
function tick() {
  const now = Date.now();
  let changed = false;
  for (const key in S.timers) {
    const t = S.timers[key];
    if (t.endAt && t.endAt <= now) {
      S.timers[key] = { leftMs: 0 };
      changed = true;
    }
  }
  if (changed) save();

  const c = current();
  if (c) {
    main.querySelectorAll('.song').forEach((card) => {
      const i = Number(card.dataset.i);
      const song = c.songs[i];
      const key = timerKey(c, i);
      const t = S.timers[key];
      const secs = Math.ceil(leftMs(key, song) / 1000);
      const running = !!(t && t.endAt);
      const go = card.querySelector('.go');

      card.querySelector('.clock').textContent = song.len ? fmt(secs) : '--:--';
      card.classList.toggle('warn', !!t && secs <= WARN_SECONDS);
      go.classList.toggle('running', running);
      go.disabled = !song.len || (!!t && !running && secs <= 0);
      go.textContent = running ? 'Pause' : !t ? 'Start' : secs <= 0 ? 'Done' : 'Resume';
      card.querySelector('.reset').classList.toggle('off', !t || running);
    });
  }

  // Flag a timer still running on another competitor (for example after an accidental swipe).
  let note = '';
  for (const key in S.timers) {
    if (!S.timers[key].endAt) continue;
    const [type, order, name] = key.split('|');
    if (type !== S.type || !c || order !== String(c.order) || name !== c.name) {
      note = '▶ Timer running on ' + slot(order);
      break;
    }
  }
  $('#runningNote').textContent = note;
}

// ---------- rendering ----------

function cueLabels() {
  return [S.type + ' Backstage', S.type + ' Loaded', 'MC Ready', 'Judges Ready'];
}

// Swatches for the lighting choices on the cue sheet. Unknown names show without a swatch.
const LIGHT_COLORS = {
  red: '#e53935', lavender: '#b39ddb', blue: '#1e66f5', amber: '#ffb300', magenta: '#d81b91',
  green: '#2e9d4f', turquoise: '#1cc6c0', 'light pink': '#f8b4cc', yellow: '#ffe14d', white: '#ffffff',
};

function lightChip(name) {
  const swatch = LIGHT_COLORS[name.toLowerCase().replace(/\s+/g, ' ')];
  return '<div class="light">' + (swatch ? '<span class="swatch" style="background:' + swatch + '"></span>' : '') +
    'Lighting: ' + esc(name) + '</div>';
}

function render(anim) {
  const L = list();
  if (S.idx >= L.length) S.idx = Math.max(0, L.length - 1);
  const c = current();

  $('#oa').textContent = c ? slot(c.order) : '';
  $('#cname').textContent = c ? c.name : 'No ' + S.type.toLowerCase() + 's loaded';
  $('#pos').textContent = c
    ? (S.idx + 1) + ' of ' + L.length + ' · ' + c.songs.length + ' song' + (c.songs.length === 1 ? '' : 's')
    : '';

  if (!c) {
    main.innerHTML = '<div class="empty">Tap <b>&#9776;</b>, pick Chorus or Quartet, then tap <b>Sync from Google Sheet</b>.</div>';
  } else {
    main.innerHTML = c.songs.map((song, i) =>
      '<section class="song" data-i="' + i + '">' +
        '<div class="song-head">Song ' + (i + 1) + ' · Length ' + (song.len ? fmt(song.len) : 'not set') + '</div>' +
        '<div class="song-title">' + esc(song.title) + '</div>' +
        (song.light ? lightChip(song.light) : '') +
        '<div class="controls">' +
          '<button class="go">Start</button>' +
          '<div class="clock"></div>' +
          '<button class="reset off">Reset</button>' +
        '</div>' +
      '</section>'
    ).join('');
  }
  main.scrollTop = 0;

  const labels = cueLabels();
  document.querySelectorAll('#cues button').forEach((b, i) => {
    b.textContent = labels[i];
    b.classList.toggle('on', !!S.cues[i]);
  });

  if (anim) {
    main.classList.remove('slide-next', 'slide-prev', 'bump');
    void main.offsetWidth; // restart the animation
    main.classList.add(anim);
  }
  tick();
}

function go(dir) {
  const next = S.idx + dir;
  if (next < 0 || next >= list().length) { render('bump'); return; }
  S.idx = next;
  S.cues = [false, false, false, false];
  save();
  render(dir > 0 ? 'slide-next' : 'slide-prev');
}

function jumpTo(i) {
  if (i !== S.idx) {
    S.idx = i;
    S.cues = [false, false, false, false];
    save();
  }
  closeMenu();
  render();
}

// ---------- input ----------

main.addEventListener('click', (e) => {
  const card = e.target.closest('.song');
  if (!card) return;
  const i = Number(card.dataset.i);
  if (e.target.closest('.go')) toggleTimer(i);
  else if (e.target.closest('.reset')) resetTimer(i);
});

$('#cues').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = Number(b.dataset.cue);
  S.cues[i] = !S.cues[i];
  save();
  b.classList.toggle('on', S.cues[i]);
});

// Horizontal swipe on the main area moves between competitors; vertical drags still scroll.
let sx = null, sy = 0;
const stage = $('#stage');
stage.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) { sx = null; return; }
  sx = e.touches[0].clientX;
  sy = e.touches[0].clientY;
}, { passive: true });
stage.addEventListener('touchend', (e) => {
  if (sx === null) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - sx, dy = t.clientY - sy;
  sx = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
}, { passive: true });

document.addEventListener('keydown', (e) => {
  if (!$('#menu').hidden) return;
  if (e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowLeft') go(-1);
});

// ---------- menu ----------

function openMenu() {
  $('#sheetUrl').value = S.sheetUrl;
  renderMenu();
  $('#menu').hidden = false;
}

function closeMenu() {
  saveSettings();
  $('#menu').hidden = true;
}

function renderMenu() {
  document.querySelectorAll('#typeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.type === S.type));
  $('#jumpList').innerHTML = list().map((c, i) =>
    '<li><button data-i="' + i + '" class="' + (i === S.idx ? 'here' : '') + '">' + esc(slot(c.order)) + '  ' + esc(c.name) + '</button></li>'
  ).join('') || '<li class="muted">Nothing loaded yet.</li>';
  if (!$('#syncStatus').dataset.busy) setStatus(syncedText());
  updateWake();
}

function syncedText() {
  if (!S.syncedAt) return 'Never synced.';
  const d = new Date(S.syncedAt);
  return 'Last synced ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · ' +
    S.data.Chorus.length + ' choruses, ' + S.data.Quartet.length + ' quartets.';
}

function setStatus(text, isError) {
  const el = $('#syncStatus');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
}

$('#menuBtn').addEventListener('click', openMenu);
$('#closeMenu').addEventListener('click', () => { closeMenu(); render(); });
$('#menu').addEventListener('click', (e) => { if (e.target.id === 'menu') { closeMenu(); render(); } });
$('#jumpList').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) jumpTo(Number(b.dataset.i));
});
$('#typeSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.dataset.type === S.type) return;
  S.type = b.dataset.type;
  S.idx = 0;
  S.cues = [false, false, false, false];
  save();
  render();
  renderMenu();
});
$('#clearTimers').addEventListener('click', () => {
  S.timers = {};
  save();
  tick();
  setStatus('All song timers reset.');
});
$('#syncBtn').addEventListener('click', sync);

// ---------- sync ----------

function csvUrl() {
  const url = S.sheetUrl.trim();
  if (!url) {
    $('#menu details').open = true;
    throw new Error('Paste the Google Sheet link into Settings below first.');
  }
  // A published-to-web CSV link (or any direct CSV link) is used as is.
  if (/output=csv|format=csv|tqx=out:csv/.test(url)) return url;
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) throw new Error('The Google Sheet link in Settings does not look right.');
  // The export feed returns cells exactly as displayed. (The gviz feed guesses a type per column
  // and blanks cells that don't fit, which dropped "Swan Set" from a numbered Order column.)
  // The tab comes from the link's gid; the first tab is gid 0.
  const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || '0';
  return 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=csv&gid=' + gid;
}

async function sync() {
  saveSettings();
  const btn = $('#syncBtn');
  btn.disabled = true;
  $('#syncStatus').dataset.busy = '1';
  setStatus('Syncing…');
  try {
    let url = csvUrl();
    url += (url.includes('?') ? '&' : '?') + '_=' + Date.now();
    const ctl = new AbortController();
    const timeout = setTimeout(() => ctl.abort(), 15000);
    let res;
    try {
      res = await fetch(url, { cache: 'no-store', signal: ctl.signal });
    } catch (e) {
      throw new Error(e.name === 'AbortError'
        ? 'Timed out. The signal may be weak; try again.'
        : 'Could not reach the sheet. Check the internet connection, and that the sheet is shared as “Anyone with the link → Viewer”.');
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error('Google returned error ' + res.status + '. Check the sheet link in Settings.');
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error('Got a web page instead of data. Share the sheet as “Anyone with the link → Viewer”.');

    const parsed = parseSheet(text);
    const total = parsed.Chorus.length + parsed.Quartet.length;
    if (!total) throw new Error('No competitors found. Check the header row (Type, Order, Name, Song 1 Title, Song 1 Length…).');

    const before = current();
    S.data = parsed;
    S.dataVersion = DATA_VERSION;
    S.syncedAt = Date.now();
    // Stay on the same competitor if it is still there.
    const keep = before ? list().findIndex((c) => c.name === before.name) : -1;
    S.idx = keep >= 0 ? keep : Math.min(S.idx, Math.max(0, list().length - 1));
    save();
    delete $('#syncStatus').dataset.busy;
    render();
    renderMenu();
    setStatus('Synced. ' + syncedText().replace(/^Last synced [^·]*· /, ''));
  } catch (e) {
    delete $('#syncStatus').dataset.busy;
    setStatus('Sync failed: ' + e.message + ' Your last synced data is still loaded.', true);
  } finally {
    btn.disabled = false;
  }
}

function saveSettings() {
  const url = $('#sheetUrl').value.trim();
  if (url) S.sheetUrl = url;
  save();
}

// ---------- sheet parsing ----------

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Song lengths may arrive as "3:20", "0:03:20", or "3:20:00" (Sheets reads 3:20 as 3 hours 20 min).
function parseLen(v) {
  v = String(v || '').trim().replace(/\s*(AM|PM)$/i, '');
  if (!v) return 0;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (n < 1) return Math.round(n * 86400); // a Sheets time value as a fraction of a day
    return n <= 15 ? Math.round(n * 60) : Math.round(n); // small numbers are minutes, larger are seconds
  }
  const p = v.split(':').map(Number);
  if (p.some(isNaN)) return 0;
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) {
    if (p[0] === 0) return p[1] * 60 + p[2];
    if (p[2] === 0) return p[0] * 60 + p[1];
    return p[0] * 3600 + p[1] * 60 + p[2];
  }
  return 0;
}

function parseSheet(text) {
  const rows = parseCSV(text).filter((r) => r.some((x) => x.trim() !== ''));
  const out = { Chorus: [], Quartet: [] };
  if (rows.length < 2) return out;

  const head = rows[0].map((h) => h.trim().toLowerCase());
  let typeCol = -1, orderCol = -1, nameCol = -1;
  const songCols = {}; // song number -> { title, len }

  head.forEach((h, i) => {
    const sm = h.match(/song\s*#?\s*(\d+)/);
    if (sm) {
      const n = Number(sm[1]);
      songCols[n] = songCols[n] || {};
      if (/light/.test(h)) songCols[n].light = i;
      else if (/length|time|dur/.test(h)) songCols[n].len = i;
      else songCols[n].title = i;
    } else if (typeCol < 0 && /^(type|contest|division)/.test(h)) typeCol = i;
    else if (orderCol < 0 && /order|appearance|^#$|^oa$/.test(h)) orderCol = i;
    else if (nameCol < 0 && /name|chorus|quartet|competitor|group/.test(h)) nameCol = i;
  });
  if (nameCol < 0) return out;
  const nums = Object.keys(songCols).map(Number).sort((a, b) => a - b);

  rows.slice(1).forEach((r, ri) => {
    const name = (r[nameCol] || '').trim();
    if (!name) return;
    const tv = typeCol >= 0 ? (r[typeCol] || '') : '';
    const type = /quart/i.test(tv) ? 'Quartet' : /chor/i.test(tv) ? 'Chorus' : S.type;
    const orderRaw = orderCol >= 0 ? (r[orderCol] || '').trim() : '';
    const songs = [];
    nums.forEach((n) => {
      const col = songCols[n];
      const title = col.title !== undefined ? (r[col.title] || '').trim() : '';
      const len = col.len !== undefined ? parseLen(r[col.len]) : 0;
      const light = col.light !== undefined ? (r[col.light] || '').trim() : '';
      if (title || len) songs.push({ title: title || 'Song ' + n, len, light });
    });
    out[type].push({ order: orderRaw || String(ri + 1), name, songs });
  });

  // "Mic Tester" first, then numbered slots, then other text slots such as "Swan Set", in sheet row order.
  const rank = (c) => {
    if (/mic/i.test(c.order)) return -Infinity;
    const n = parseFloat(c.order);
    return isNaN(n) ? Infinity : n;
  };
  TYPES.forEach((t) => out[t].sort((a, b) => (rank(a) - rank(b)) || 0));
  return out;
}

// ---------- keep the screen on ----------

let wakeLock = null;

async function keepAwake() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') { updateWake(); return; }
  if (wakeLock && !wakeLock.released) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', updateWake);
  } catch (e) { /* refused; retried on the next tap */ }
  updateWake();
}

function updateWake() {
  const on = !!(wakeLock && !wakeLock.released);
  $('#wakeDot').classList.toggle('on', on);
  $('#wakeStatus').textContent = !('wakeLock' in navigator)
    ? 'This browser cannot keep the screen on. Set Settings → Display & Brightness → Auto-Lock to Never.'
    : on ? 'Screen stays on while the app is open (green dot).'
    : 'Screen may sleep. Tap anywhere to keep it on.';
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { keepAwake(); tick(); checkForUpdate(); }
});
document.addEventListener('touchend', keepAwake, { passive: true });
document.addEventListener('click', keepAwake);

// ---------- app updates ----------
// A new version takes over in the background. The app never reloads by itself (a timer may be
// running); it shows an "Update ready" button instead. Timers survive the reload.

function checkForUpdate() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update()).catch(() => { /* offline */ });
}

if ('serviceWorker' in navigator) {
  // The first takeover on a fresh install is not an update; any later one is.
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) $('#updateBtn').hidden = false;
    controlled = true;
  });
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache unavailable */ });
}
$('#updateBtn').addEventListener('click', () => location.reload());

// ---------- start ----------

render();
keepAwake();
setInterval(tick, 250);
// Data synced by an older version may be stored in an older shape; refresh it while there is signal.
if (S.syncedAt && S.dataVersion !== DATA_VERSION && S.sheetUrl) sync();
