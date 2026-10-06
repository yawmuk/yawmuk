// «يومك» prayer feature: live prayer-times HUD + adhan at prayer time + full details panel.
// Contract: open({ lang, onClose }) -> close();  startPrayerHud({ lang, container }) -> { stop, setLang, el }.
// Everything is computed locally (adhan-js). The only network request is the bundled adhan mp3 file.
import './prayer.css';
import { LOCATIONS, DEFAULT_LOCATION, METHODS, ALL_TIMES, PRAYERS, computeTimes, nextPrayer, currentPrayer, duePrayers, dayKey, roundCoord, methodForTz, formatTime, formatClock, formatCountdown, formatHijri } from './times.js';
import { S, tr, NAMES, EXPLAIN, DORAR, ADHAN_CREDIT } from './strings.js';

const STORE_KEY = 'yk-prayer-settings';
const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
const ADHAN_SRC = `${BASE}audio/adhan/adhan.mp3`;

// ---------- settings (localStorage only; wrapped because storage can throw) ----------
const defaults = { loc: DEFAULT_LOCATION, method: null, muted: false, geo: null };
function loadSettings() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; } catch { return { ...defaults }; }
}
let settings = loadSettings();
const listeners = new Set();
function saveSettings(patch) {
  settings = { ...settings, ...patch };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}
export function activeLocation() {
  let base;
  if (settings.loc === 'geo' && settings.geo) {
    base = { id: 'geo', lat: settings.geo.lat, lng: settings.geo.lng, tz: settings.geo.tz, method: methodForTz(settings.geo.tz), name: { ar: S.myLocation.ar, en: S.myLocation.en } };
  } else base = LOCATIONS[settings.loc] || LOCATIONS[DEFAULT_LOCATION];
  return settings.method && METHODS[settings.method] ? { ...base, method: settings.method } : base;
}

// ---------- tiny DOM helper ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const dirOf = (lang) => (lang === 'ar' ? 'rtl' : 'ltr');
const ltr = (txt) => h('bdi', { dir: 'ltr', class: 'yk-prayer-ltr' }, txt);

function icon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'yk-prayer-icon');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M12 2.5c.6 1.6 2 2.4 2 4a2 2 0 0 1-4 0c0-1.6 1.4-2.4 2-4ZM5 21V12.5a7 7 0 0 1 14 0V21h-2.5v-4a2.5 2.5 0 0 0-5 0v4H5Z');
  p.setAttribute('fill', 'currentColor');
  svg.append(p);
  return svg;
}

function speaker(muted) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'yk-prayer-icon');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', muted ? 'M3 9v6h4l5 4V5L7 9H3Zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7Z' : 'M3 9v6h4l5 4V5L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z');
  p.setAttribute('fill', 'currentColor');
  svg.append(p);
  return svg;
}

// ---------- audio (lazy, unlocked by the first user gesture) ----------
let audio = null;
let unlocked = false;
// 0.2 s of 8-bit silence, built at runtime: playing it inside a gesture unlocks the element on iOS.
function silentWav() {
  const n = 1600, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(0x80, 44);
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return `data:audio/wav;base64,${btoa(s)}`;
}
function getAudio() {
  if (!audio && typeof Audio !== 'undefined') {
    audio = new Audio();
    audio.preload = 'none';
  }
  return audio;
}
function unlockAudio() {
  if (unlocked) return;
  const a = getAudio();
  if (!a) return;
  unlocked = true;
  try {
    a.src = silentWav();
    const p = a.play();
    if (p && p.catch) p.then(() => { if (a.src.startsWith('data:')) a.pause(); }).catch(() => { unlocked = false; });
  } catch { unlocked = false; }
}
/** Play the adhan. Resolves true if playing, false if blocked/failed. */
export async function playAdhan() {
  const a = getAudio();
  if (!a) return false;
  try {
    if (!a.src.endsWith('adhan.mp3')) a.src = ADHAN_SRC;
    a.currentTime = 0;
    await a.play();
    unlocked = true;
    return true;
  } catch { return false; }
}
export function stopAdhan() { if (audio && !audio.paused) { audio.pause(); try { audio.currentTime = 0; } catch { /* ignore */ } } }

// ---------- adhan banner ----------
let bannerEl = null;
function showBanner(prayer, lang, { blocked = false } = {}) {
  hideBanner();
  const loc = activeLocation();
  const pName = NAMES[prayer][lang] || NAMES[prayer].en;
  const msg = h('div', { class: 'yk-prayer-banner-msg' },
    h('strong', {}, tr('adhanNow', lang, { p: pName })),
    h('span', { class: 'yk-prayer-banner-sub' }, tr('adhanWhere', lang, { c: loc.name[lang] || loc.name.en })),
    prayer === 'fajr' ? h('span', { class: 'yk-prayer-banner-sub' }, tr('fajrNote', lang)) : null,
    blocked ? h('span', { class: 'yk-prayer-banner-sub' }, tr('audioBlocked', lang)) : null);
  const playBtn = h('button', { type: 'button', class: 'yk-prayer-btn', onclick: async () => { if (!(await playAdhan())) playBtn.textContent = tr('audioError', lang); } }, tr('preview', lang));
  const stopBtn = h('button', { type: 'button', class: 'yk-prayer-btn', onclick: () => stopAdhan() }, tr('stop', lang));
  const okBtn = h('button', { type: 'button', class: 'yk-prayer-btn yk-prayer-btn-primary', onclick: () => { stopAdhan(); hideBanner(); } }, tr('dismiss', lang));
  bannerEl = h('div', { class: 'yk-prayer-banner', role: 'status', 'aria-live': 'polite', dir: dirOf(lang), lang },
    icon(), msg, h('div', { class: 'yk-prayer-banner-actions' }, blocked || settings.muted ? playBtn : stopBtn, okBtn));
  document.body.append(bannerEl);
  setTimeout(() => { if (bannerEl && audio && audio.paused) hideBanner(); }, 3 * 60 * 1000);
}
function hideBanner() { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }

async function announce(prayer, lang) {
  let blocked = false;
  if (!settings.muted) blocked = !(await playAdhan());
  showBanner(prayer, lang, { blocked });
  try { window.dispatchEvent(new CustomEvent('yk:adhan', { detail: { prayer, muted: settings.muted, playing: !settings.muted && !blocked } })); } catch { /* ignore */ }
}

// ---------- HUD ----------
/**
 * Compact always-on widget: clock, next prayer + countdown, mute toggle. Fires the adhan at prayer time.
 * Call after the player's first interaction (e.g. the game's start button) so audio is allowed.
 */
export function startPrayerHud({ lang = 'ar', container = null } = {}) {
  let curLang = lang;
  const fired = new Set();
  // Do not replay an adhan whose time already passed before the HUD started.
  for (const d of duePrayers(activeLocation(), new Date(), fired)) fired.add(d.key);

  const clock = h('span', { class: 'yk-prayer-hud-clock' });
  const nextLbl = h('span', { class: 'yk-prayer-hud-next' });
  const count = h('bdi', { dir: 'ltr', class: 'yk-prayer-hud-count' });
  const openBtn = h('button', { type: 'button', class: 'yk-prayer-hud-main', onclick: () => open({ lang: curLang }) }, icon(), h('span', { class: 'yk-prayer-hud-text' }, clock, h('span', { class: 'yk-prayer-hud-row' }, nextLbl, count)));
  const muteBtn = h('button', { type: 'button', class: 'yk-prayer-hud-mute', onclick: () => saveSettings({ muted: !settings.muted }) });
  const el = h('div', { class: `yk-prayer-hud${container ? '' : ' yk-prayer-hud-floating'}`, role: 'group' }, openBtn, muteBtn);
  (container || document.body).append(el);

  const onGesture = () => { unlockAudio(); };
  window.addEventListener('pointerdown', onGesture, { once: true, capture: true });
  window.addEventListener('keydown', onGesture, { once: true, capture: true });
  unlockAudio(); // works when started from inside a click handler (game start)

  function render() {
    const loc = activeLocation();
    const now = new Date();
    el.setAttribute('dir', dirOf(curLang)); el.setAttribute('lang', curLang);
    el.setAttribute('aria-label', tr('title', curLang));
    openBtn.setAttribute('aria-label', tr('hudLabel', curLang));
    clock.textContent = formatTime(now, loc.tz, curLang);
    const n = nextPrayer(loc, now);
    nextLbl.textContent = `${NAMES[n.prayer][curLang]} ${tr('in', curLang)} `;
    count.textContent = formatCountdown(n.msLeft);
    muteBtn.replaceChildren(speaker(settings.muted));
    muteBtn.setAttribute('aria-pressed', settings.muted ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', settings.muted ? tr('unmute', curLang) : tr('mute', curLang));
    muteBtn.title = muteBtn.getAttribute('aria-label');
    for (const d of duePrayers(loc, now, fired)) { fired.add(d.key); announce(d.prayer, curLang); }
  }
  const onSettings = () => { if (settings.muted) stopAdhan(); render(); };
  listeners.add(onSettings);
  render();
  const timer = setInterval(render, 1000);
  return {
    el,
    setLang(l) { curLang = l; render(); },
    stop() { clearInterval(timer); listeners.delete(onSettings); window.removeEventListener('pointerdown', onGesture, { capture: true }); window.removeEventListener('keydown', onGesture, { capture: true }); el.remove(); hideBanner(); stopAdhan(); }
  };
}

// ---------- full panel ----------
let openInstance = null;
export function open({ lang = 'ar', onClose } = {}) {
  if (openInstance) openInstance();
  const prevFocus = document.activeElement;
  const titleId = 'yk-prayer-title';
  const live = h('p', { class: 'yk-prayer-live', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'yk-prayer-body' });
  const closeBtn = h('button', { type: 'button', class: 'yk-prayer-close', 'aria-label': tr('close', lang), onclick: () => close() }, '×');
  const panel = h('div', { class: 'yk-prayer-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, dir: dirOf(lang), lang },
    h('header', { class: 'yk-prayer-head' }, icon(), h('h2', { id: titleId }, tr('title', lang)), closeBtn), body, live);
  const overlay = h('div', { class: 'yk-prayer-overlay', onclick: (e) => { if (e.target === overlay) close(); } }, panel);
  let consentOpen = false;
  let tick = null;

  function timesTable(loc, now) {
    const today = computeTimes(loc, now);
    const n = nextPrayer(loc, now);
    const cur = currentPrayer(loc, now);
    return h('ol', { class: 'yk-prayer-list', 'aria-label': tr('today', lang) }, ALL_TIMES.map((k) => {
      const isNext = n.prayer === k && dayKey(n.time, loc.tz) === dayKey(now, loc.tz);
      const cls = ['yk-prayer-item', k === 'sunrise' ? 'yk-prayer-item-sun' : '', isNext ? 'yk-prayer-item-next' : '', cur === k ? 'yk-prayer-item-cur' : ''].filter(Boolean).join(' ');
      return h('li', { class: cls, 'aria-current': isNext ? 'time' : null },
        h('span', { class: 'yk-prayer-name' }, NAMES[k][lang]),
        h('span', { class: 'yk-prayer-time' }, ltr(formatTime(today[k], loc.tz, lang))));
    }));
  }

  function locationControls(loc) {
    const choices = [...Object.values(LOCATIONS).map((l) => ({ id: l.id, label: l.name[lang] })), ...(settings.geo ? [{ id: 'geo', label: S.myLocation[lang] }] : [])];
    const group = h('fieldset', { class: 'yk-prayer-field' }, h('legend', {}, tr('location', lang)),
      h('div', { class: 'yk-prayer-chips' }, choices.map((c) => h('label', { class: 'yk-prayer-chip' },
        h('input', { type: 'radio', name: 'yk-prayer-loc', value: c.id, 'data-k': `loc-${c.id}`, checked: (settings.loc === c.id) || (loc.id === c.id && settings.loc !== 'geo'), onchange: () => { saveSettings({ loc: c.id, method: null }); render(true); } }),
        h('span', {}, c.label)))));
    const geoBtn = h('button', { type: 'button', class: 'yk-prayer-btn', 'data-k': 'geo', 'aria-expanded': consentOpen ? 'true' : 'false', onclick: () => { consentOpen = !consentOpen; render(true); } }, tr('useMyLocation', lang));
    group.append(h('div', { class: 'yk-prayer-row' }, geoBtn, settings.geo ? h('button', { type: 'button', class: 'yk-prayer-btn yk-prayer-btn-ghost', onclick: () => { saveSettings({ geo: null, loc: DEFAULT_LOCATION, method: null }); render(true); } }, tr('forget', lang)) : null));
    if (consentOpen) {
      group.append(h('div', { class: 'yk-prayer-consent' }, h('p', {}, tr('consent', lang)),
        h('div', { class: 'yk-prayer-row' },
          h('button', { type: 'button', class: 'yk-prayer-btn yk-prayer-btn-primary', 'data-k': 'agree', onclick: requestGeo }, tr('agree', lang)),
          h('button', { type: 'button', class: 'yk-prayer-btn yk-prayer-btn-ghost', onclick: () => { consentOpen = false; render(true); } }, tr('cancel', lang)))));
    }
    return group;
  }

  function requestGeo() {
    consentOpen = false;
    if (!navigator.geolocation) { live.textContent = tr('geoDenied', lang); render(true); return; }
    live.textContent = tr('locating', lang);
    navigator.geolocation.getCurrentPosition((pos) => {
      let tz = 'UTC';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* ignore */ }
      saveSettings({ geo: { lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude), tz }, loc: 'geo', method: null });
      live.textContent = tr('geoOk', lang);
      render(true);
    }, () => { live.textContent = tr('geoDenied', lang); render(true); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 });
  }

  function methodControl(loc) {
    const sel = h('select', { id: 'yk-prayer-method', 'data-k': 'method', class: 'yk-prayer-select', onchange: (e) => { saveSettings({ method: e.target.value }); render(true); } },
      Object.entries(METHODS).map(([id, m]) => h('option', { value: id, selected: loc.method === id }, m[lang].split(' — ')[0])));
    return h('div', { class: 'yk-prayer-field' }, h('label', { for: 'yk-prayer-method' }, tr('method', lang)), sel,
      h('p', { class: 'yk-prayer-note' }, (METHODS[loc.method] || METHODS.MuslimWorldLeague)[lang]),
      h('p', { class: 'yk-prayer-note' }, tr('asrNote', lang)),
      loc.method === 'UmmAlQura' ? h('p', { class: 'yk-prayer-note' }, tr('ummQuraNote', lang)) : null);
  }

  function audioControls() {
    const muteBtn = h('button', { type: 'button', class: 'yk-prayer-btn', 'data-k': 'mute', 'aria-pressed': settings.muted ? 'true' : 'false', onclick: () => { saveSettings({ muted: !settings.muted }); render(true); } }, settings.muted ? tr('unmute', lang) : tr('mute', lang));
    const playBtn = h('button', { type: 'button', class: 'yk-prayer-btn yk-prayer-btn-primary', 'data-k': 'play', onclick: async () => { const ok = await playAdhan(); live.textContent = ok ? '' : tr('audioError', lang); } }, tr('preview', lang));
    const stopBtn = h('button', { type: 'button', class: 'yk-prayer-btn yk-prayer-btn-ghost', 'data-k': 'stop', onclick: () => stopAdhan() }, tr('stop', lang));
    return h('div', { class: 'yk-prayer-row' }, playBtn, stopBtn, muteBtn);
  }

  function about() {
    const link = (url) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'yk-prayer-src' }, tr('sourceLink', lang));
    return h('section', { class: 'yk-prayer-about', 'aria-labelledby': 'yk-prayer-about-h' },
      h('h3', { id: 'yk-prayer-about-h' }, tr('aboutTitle', lang)),
      h('p', {}, EXPLAIN.intro[lang], ' ', link(EXPLAIN.intro.links[0])),
      h('dl', { class: 'yk-prayer-dl' }, PRAYERS.map((p) => [h('dt', {}, NAMES[p][lang]), h('dd', {}, EXPLAIN[p][lang], ' ', link(DORAR[p]))])),
      h('p', { class: 'yk-prayer-note' }, tr('disclaimer', lang)),
      h('p', { class: 'yk-prayer-credit' }, tr('credits', lang),
        h('a', { href: ADHAN_CREDIT.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, `${ADHAN_CREDIT.author} — Wikimedia Commons`), ', ',
        h('a', { href: ADHAN_CREDIT.licenseUrl, target: '_blank', rel: 'noopener noreferrer' }, ADHAN_CREDIT.license), '.'));
  }

  const nowLine = h('p', { class: 'yk-prayer-now' });
  function updateNow() {
    const loc = activeLocation();
    const now = new Date();
    const n = nextPrayer(loc, now);
    nowLine.replaceChildren(
      h('span', {}, `${loc.name[lang]} · `, ltr(formatClock(now, loc.tz, lang))),
      h('span', { class: 'yk-prayer-hijri' }, formatHijri(now, loc.tz, lang)),
      h('strong', { class: 'yk-prayer-next' }, `${tr('next', lang)}: ${NAMES[n.prayer][lang]} — ${tr('in', lang)} `, ltr(formatCountdown(n.msLeft))));
  }
  let lastDay = '';
  function render(full) {
    const loc = activeLocation();
    const now = new Date();
    const dk = dayKey(now, loc.tz) + loc.id + loc.method;
    updateNow();
    if (!full && dk === lastDay) return;
    lastDay = dk;
    const focusedId = document.activeElement && panel.contains(document.activeElement) ? document.activeElement.getAttribute('data-k') : null;
    body.replaceChildren(nowLine, h('h3', {}, tr('today', lang)), timesTable(loc, now), audioControls(), locationControls(loc), methodControl(loc), about());
    if (focusedId) {
      const again = [...panel.querySelectorAll('[data-k]')].find((x) => x.getAttribute('data-k') === focusedId);
      (again || closeBtn).focus();
    }
  }

  function focusables() { return [...panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null || x === document.activeElement); }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    e.stopPropagation(); // keep game controls from reacting while the panel is open
  }
  overlay.addEventListener('keydown', onKey);
  const onSettings = () => render(true);
  listeners.add(onSettings);

  render(true);
  document.body.append(overlay);
  closeBtn.focus();
  tick = setInterval(() => render(false), 1000);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    clearInterval(tick);
    listeners.delete(onSettings);
    overlay.remove();
    openInstance = null;
    if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch { /* ignore */ }
    if (typeof onClose === 'function') onClose();
  }
  openInstance = close;
  return close;
}

export default { open, startPrayerHud };
