// Loading screen (boot) + transition veil progress.
// The markup lives in index.html (#loader, #fade .veil) so it shows before any JS runs. This module fills in the
// localized title/tips and listens to the engine's loading hook:
//   window.yawmuk.events  emits  'load:progress' {loaded, total, label}  and  'load:done'
// Both an emitter with .on(type, fn) and an EventTarget (CustomEvent.detail) are supported. If the hook is
// absent, the bar stays indeterminate and the loader leaves when the engine marks <body class="ready">.
import { t, onLangChange } from '../i18n.js';
import './strings.js';

let booted = false;
let gone = false;
let tipTimer = 0;
let tipIdx = 0;
const $ = (id) => document.getElementById(id);

function tips() { const v = t('loadingTips'); return Array.isArray(v) ? v.filter(Boolean) : []; }

function renderText() {
  const title = $('loader-title'), tipLbl = $('loader-tip-label');
  if (title) title.textContent = t('loadingTitle');
  if (tipLbl) tipLbl.textContent = t('tipLabel');
  showTip();
}

function showTip() {
  const el = $('loader-tip');
  const list = tips();
  if (!el || !list.length) return;
  el.classList.remove('in');
  void el.offsetWidth;
  el.textContent = list[tipIdx % list.length];
  el.classList.add('in');
}

function setBar(barEl, p, label, labelEl) {
  if (!barEl) return;
  const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
  barEl.closest('[role=progressbar]')?.setAttribute('aria-valuenow', String(pct));
  barEl.closest('.lbar')?.classList.remove('indeterminate');
  barEl.style.setProperty('--p', `${pct}%`);
  if (labelEl && label) labelEl.textContent = String(label);
}

function onProgress(d) {
  const p = d && d.total > 0 ? d.loaded / d.total : 0;
  if (!gone) setBar($('loader-bar'), p, d?.label, $('loader-label'));
  const fade = $('fade');
  // the veil (bar) only appears once the door transition has lasted > 1.5 s (game.js adds .busy); keep its bar current
  if (fade && fade.classList.contains('on')) { if (!fade.classList.contains('door')) fade.classList.add('busy'); setBar($('veil-bar'), p, null, null); }
}

function onDone() {
  const fade = $('fade');
  if (fade) { setBar($('veil-bar'), 1); setTimeout(() => fade.classList.remove('busy'), 300); }
  hideLoader();
}

/** Fade the boot loader out (idempotent). */
export function hideLoader() {
  if (gone) return;
  const el = $('loader');
  gone = true;
  clearInterval(tipTimer);
  if (!el) return;
  setBar($('loader-bar'), 1);
  el.classList.add('done');
  setTimeout(() => el.remove(), 700);
}

function subscribe(ev) {
  const prog = (x) => onProgress(x && x.detail !== undefined ? x.detail : x);
  if (typeof ev.on === 'function') { ev.on('load:progress', prog); ev.on('load:done', onDone); return true; }
  if (typeof ev.addEventListener === 'function') { ev.addEventListener('load:progress', prog); ev.addEventListener('load:done', onDone); return true; }
  return false;
}

export function initLoader() {
  if (booted || typeof document === 'undefined') return;
  booted = true;
  // strings come from ui_strings.json, which is applied while the other modules evaluate: render on the next tick
  setTimeout(renderText, 0);
  tipTimer = setInterval(() => { tipIdx++; showTip(); }, 4200);
  onLangChange(renderText);
  // hook: wait for window.yawmuk.events (the engine assigns window.yawmuk during boot)
  let tries = 0;
  const poll = setInterval(() => {
    const ev = window.yawmuk?.events;
    if ((ev && subscribe(ev)) || ++tries > 1200) clearInterval(poll);
  }, 50);
  // fallback: the engine marks the body ready once the first scene is up
  const mo = new MutationObserver(() => { if (document.body.classList.contains('ready')) { mo.disconnect(); setTimeout(hideLoader, 250); } });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
