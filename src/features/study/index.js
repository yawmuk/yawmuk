// «يومك» opt-in micro-study: consent -> pre-test -> alternate arm (AI-personalised vs fixed journey) -> play ->
// post-test + 3 Likert items + optional comment -> thanks (with the correct answers and their ruling cards).
// Contract: open({ lang, onClose }) -> close().  open() is stateful: with an active session it shows the study hub /
// post-test instead of the consent screen, so the same entry point works at both ends of the day.
// boot({ lang }) — call once per page load: opens the consent screen when the URL has ?study=1 and no session exists,
// and shows the floating "Finish study" button while a session is active. Also polls the game's saved progress to
// send anonymous situation_done / journey_done counts (only while enrolled).
// track(event, data) — telemetry helper for the engine (e.g. ask-panel outcomes); a no-op unless enrolled.
import './study.css';
import { S, tr } from './strings.js';
import { ITEMS, DONT_KNOW, PRE_ORDER, POST_ORDER } from './questions.js';
import { loadSession, saveSession, clearSession, readProgress, testedSeen, studyUrl, orderItems, PROGRESS_KEY } from './session.js';

const API = '/.netlify/functions/study';
const METRICS = '/.netlify/functions/metrics';
const ls = () => { try { return window.localStorage; } catch { return null; } };
const params = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const pickLang = (lang) => (lang === 'ar' || lang === 'en' ? lang
  : params().get('lang') === 'en' ? 'en' : params().get('lang') === 'ar' ? 'ar'
    : (document.documentElement.lang || '').startsWith('en') ? 'en' : 'ar');

async function post(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal, keepalive: true });
    const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
    return r.ok ? data : { error: data.error || `http_${r.status}` };
  } catch { return { error: 'network' }; } finally { clearTimeout(timer); }
}

/** Anonymous telemetry, only while a study session is active. event: session_start|situation_done|journey_done|ask. */
export function track(event, data = {}) {
  const s = loadSession(ls());
  if (!s || s.stage !== 'playing') return Promise.resolve(false);
  const body = { event, arm: s.arm };
  if (event === 'ask') body.outcome = data.outcome;
  return post(METRICS, body).then((r) => !r.error);
}

// ------------------------------------------------------------------ question widgets
function itemField(it, idx, lang, answers, name) {
  const opts = [...it.options.map((o, i) => ({ label: tr(o, lang), value: i })), { label: tr(DONT_KNOW, lang), value: -1 }];
  return h('fieldset', { class: 'yk-study-item' },
    h('legend', {}, `${idx + 1}. `, tr(it.q, lang)),
    opts.map((o) => h('label', { class: 'yk-study-opt' },
      h('input', { type: 'radio', name: `${name}-${it.id}`, value: String(o.value), checked: answers[it.id] === o.value, onchange: () => { answers[it.id] = o.value; } }),
      h('span', {}, o.label))));
}
function likertField(key, lang, likert) {
  return h('fieldset', { class: 'yk-study-likert' },
    h('legend', {}, tr(S.likert[key], lang)),
    h('div', { class: 'yk-study-scale' },
      h('span', { class: 'yk-study-end', 'aria-hidden': 'true' }, tr(S.low, lang)),
      [1, 2, 3, 4, 5].map((n) => h('label', { class: 'yk-study-pt' },
        h('input', { type: 'radio', name: `lk-${key}`, value: String(n), 'aria-label': `${n} / 5`, checked: likert[key] === n, onchange: () => { likert[key] = n; } }),
        h('span', { 'aria-hidden': 'true' }, String(n)))),
      h('span', { class: 'yk-study-end', 'aria-hidden': 'true' }, tr(S.high, lang))));
}

// ------------------------------------------------------------------ the panel
let current = null; // one study panel at a time

export function open({ lang, onClose } = {}) {
  if (current) current.close();
  lang = pickLang(lang);
  const storage = ls();
  const pilot = params().get('pilot') === '1';
  const prevFocus = document.activeElement;
  const titleId = `yk-study-t-${Date.now().toString(36)}`;
  const body = h('div', { class: 'yk-study-body' });
  const closeBtn = h('button', { type: 'button', class: 'yk-study-x', 'aria-label': tr(S.close, lang), onclick: () => close() }, '×');
  const heading = h('h2', { id: titleId, class: 'yk-study-h' }, tr(S.title, lang));
  const panel = h('div', { class: 'yk-study-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    h('header', { class: 'yk-study-head' }, heading, closeBtn),
    pilot ? h('p', { class: 'yk-study-pilot' }, tr(S.pilot, lang)) : null,
    body);
  const root = h('div', { class: 'yk-study-overlay', dir: lang === 'ar' ? 'rtl' : 'ltr', lang }, panel);
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });

  const focusables = () => [...panel.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) { e.preventDefault(); panel.focus(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { e.preventDefault(); e.stopPropagation(); first.focus(); }
  };
  // stop the game's keyboard controls from reacting while the panel is open
  const swallow = (e) => { if (root.contains(e.target)) e.stopPropagation(); };
  document.addEventListener('keydown', onKey, true);
  root.addEventListener('keydown', swallow);
  root.addEventListener('keyup', swallow);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    current = null;
    refreshPill();
    try { prevFocus?.focus?.(); } catch { /* ignore */ }
    onClose?.();
  }
  const show = (title, ...nodes) => {
    heading.textContent = title;
    body.replaceChildren(...nodes.flat().filter(Boolean));
    body.scrollTop = 0;
    (panel.querySelector('[data-autofocus]') || panel.querySelector('input, button:not(.yk-study-x)') || panel).focus();
  };
  const status = () => h('p', { class: 'yk-study-status', role: 'status', 'aria-live': 'polite' });
  const btn = (label, onclick, kind = 'primary', extra = {}) => h('button', { type: 'button', class: `yk-study-btn ${kind}`, onclick, ...extra }, label);

  // ---------- screens
  function errorScreen(retry) {
    show(tr(S.errTitle, lang), h('p', {}, tr(S.errNote, lang)),
      h('div', { class: 'yk-study-row' }, btn(tr(S.close, lang), close, 'ghost'), retry ? btn(tr(S.retry, lang), retry, 'primary', { 'data-autofocus': true }) : null));
  }

  function consent() {
    const box = h('input', { type: 'checkbox', id: 'yk-study-agree' });
    const st = status();
    const go = async (e) => {
      if (!box.checked) { st.textContent = tr(S.needAge, lang); box.focus(); return; }
      e.target.disabled = true; st.textContent = tr(S.sending, lang);
      const r = await post(API, { action: 'enroll', lang, pilot });
      if (r.error || !r.id) { errorScreen(consent); return; }
      const s = { id: r.id, arm: r.arm, lang, stage: 'enrolled', pilot, started: new Date().toISOString(), doneSeen: 0 };
      saveSession(storage, s);
      preTest(s);
    };
    show(tr(S.title, lang),
      h('p', { class: 'yk-study-lead' }, tr(S.consentLead, lang)),
      h('h3', {}, tr(S.consentWhat, lang)), h('ol', {}, S.consentSteps[lang].map((x) => h('li', {}, x))),
      h('h3', {}, tr(S.consentPrivacy, lang)), h('ul', {}, S.consentPrivacyItems[lang].map((x) => h('li', {}, x))),
      h('p', { class: 'yk-study-note' }, tr(S.consentAi, lang)),
      h('label', { class: 'yk-study-check', for: 'yk-study-agree' }, box, h('span', {}, tr(S.consentAge, lang))),
      st,
      h('div', { class: 'yk-study-row' }, btn(tr(S.decline, lang), close, 'ghost'), btn(tr(S.agree, lang), go)));
  }

  function preTest(s) {
    const answers = {};
    const st = status();
    const go = async (e) => {
      if (ITEMS.some((it) => answers[it.id] === undefined)) { st.textContent = tr(S.answerAll, lang); return; }
      e.target.disabled = true; st.textContent = tr(S.sending, lang);
      const r = await post(API, { action: 'pre', id: s.id, answers });
      if (r.error) { e.target.disabled = false; errorScreen(() => preTest(s)); return; }
      armScreen(s);
    };
    show(tr(S.preTitle, lang), h('p', { class: 'yk-study-note' }, tr(S.preNote, lang)),
      orderItems(PRE_ORDER).map((it, i) => itemField(it, i, lang, answers, 'pre')), st,
      h('div', { class: 'yk-study-row' }, btn(tr(S.next, lang), go)));
  }

  function codeBox(s) {
    return h('div', { class: 'yk-study-code' }, h('span', {}, tr(S.yourCode, lang)),
      h('bdi', { dir: 'ltr' }, `${s.id.slice(0, 5)}-${s.id.slice(5)}`), h('small', {}, tr(S.codeNote, lang)));
  }

  function armScreen(s) {
    show(tr(S.armTitle, lang), h('p', {}, tr(S.armNote, lang)), h('ol', {}, S.armSteps[lang].map((x) => h('li', {}, x))), codeBox(s),
      h('div', { class: 'yk-study-row' }, btn(tr(S.startPlaying, lang), () => {
        saveSession(storage, { ...s, stage: 'playing', doneSeen: 0, needsStart: true });
        try { storage?.removeItem(PROGRESS_KEY); } catch { /* fresh day for every participant */ }
        location.href = studyUrl(location.href, s.arm, lang);
      }, 'primary', { 'data-autofocus': true })));
  }

  function hub(s) {
    const prog = readProgress(storage);
    show(tr(S.hubTitle, lang), codeBox(s),
      h('p', {}, `${tr(S.hubNote, lang)}: `, h('strong', {}, h('bdi', { dir: 'ltr' }, String(prog.doneIds.length)))),
      prog.doneIds.length < 3 ? h('p', { class: 'yk-study-note' }, tr(S.hubFew, lang)) : null,
      h('div', { class: 'yk-study-row wrap' },
        btn(tr(S.leave, lang), async () => {
          if (!window.confirm(tr(S.leaveConfirm, lang))) return;
          await post(API, { action: 'withdraw', id: s.id });
          clearSession(storage);
          show(tr(S.title, lang), h('p', {}, tr(S.left, lang)), h('div', { class: 'yk-study-row' }, btn(tr(S.close, lang), close)));
        }, 'ghost danger'),
        btn(tr(S.keepPlaying, lang), close, 'ghost'),
        btn(tr(S.toPost, lang), () => postTest(s), 'primary', { 'data-autofocus': true })));
  }

  function postTest(s) {
    const answers = {};
    const likert = {};
    const comment = h('textarea', { id: 'yk-study-comment', maxlength: '300', rows: '3', 'aria-describedby': 'yk-study-comment-hint' });
    const st = status();
    const go = async (e) => {
      if (ITEMS.some((it) => answers[it.id] === undefined) || ['clarity', 'respect', 'next_step'].some((k) => !likert[k])) { st.textContent = tr(S.answerAll, lang); return; }
      e.target.disabled = true; st.textContent = tr(S.sending, lang);
      const prog = readProgress(storage);
      const r = await post(API, {
        action: 'post', id: s.id, answers, likert, comment: comment.value.trim() || null,
        plan_source: prog.planSource, situations_done: prog.doneIds.length, tested_seen: testedSeen(prog.doneIds)
      });
      if (r.error) { e.target.disabled = false; st.textContent = ''; errorScreen(() => postTest(s)); return; }
      clearSession(storage);
      doneScreen(r, answers);
    };
    show(tr(S.postTitle, lang),
      orderItems(POST_ORDER).map((it, i) => itemField(it, i, lang, answers, 'post')),
      h('h3', {}, tr(S.likertTitle, lang)),
      ['clarity', 'respect', 'next_step'].map((k) => likertField(k, lang, likert)),
      h('label', { class: 'yk-study-label', for: 'yk-study-comment' }, tr(S.commentLabel, lang)), comment,
      h('small', { id: 'yk-study-comment-hint', class: 'yk-study-note' }, tr(S.commentHint, lang)),
      st, h('div', { class: 'yk-study-row' }, btn(tr(S.submit, lang), go)));
  }

  function doneScreen(r, answers) {
    show(tr(S.doneTitle, lang),
      h('div', { class: 'yk-study-scores' },
        h('div', {}, h('span', {}, tr(S.before, lang)), h('bdi', { dir: 'ltr' }, `${r.pre}/${r.of}`)),
        h('div', {}, h('span', {}, tr(S.after, lang)), h('bdi', { dir: 'ltr' }, `${r.post}/${r.of}`))),
      h('h3', {}, tr(S.reviewTitle, lang)),
      h('ol', { class: 'yk-study-key' }, ITEMS.map((it) => h('li', { class: answers[it.id] === it.correct ? 'ok' : 'miss' },
        h('strong', {}, tr(it.q, lang)), h('br'), tr(it.options[it.correct], lang), ' ',
        h('small', {}, `(${tr(S.cardRef, lang)}: `, h('bdi', { dir: 'ltr' }, it.ruling_id), ')')))),
      h('div', { class: 'yk-study-row wrap' },
        h('a', { class: 'yk-study-btn ghost', href: './results.html', target: '_blank', rel: 'noopener' }, tr(S.results, lang)),
        btn(tr(S.finish, lang), close, 'primary', { 'data-autofocus': true })));
  }

  // ---------- entry: route by session state
  const s = loadSession(storage);
  document.body.append(root);
  current = { close };
  refreshPill();
  if (!s) consent();
  else if (s.stage === 'enrolled') preTest(s);
  else hub(s);
  // The start screen may open (and grab focus) right after us: pull focus into the panel once the page settles.
  const grab = () => { if (!closed && !panel.contains(document.activeElement)) (panel.querySelector('[data-autofocus]') || panel.querySelector('input, button:not(.yk-study-x)') || panel).focus(); };
  requestAnimationFrame(grab);
  setTimeout(grab, 300);
  setTimeout(grab, 1200);
  return close;
}

// ------------------------------------------------------------------ floating "Finish study" button + progress polling
let pill = null;
let pollTimer = null;
let pillLang = 'ar';

function refreshPill() {
  const s = loadSession(ls());
  if (!s || s.stage !== 'playing') { pill?.remove(); pill = null; return; }
  const fin = readProgress(ls()).finished;
  if (!pill) {
    pill = h('button', { type: 'button', class: 'yk-study-pill', onclick: () => open({ lang: pillLang }) });
    document.body.append(pill);
  }
  pill.dir = pillLang === 'ar' ? 'rtl' : 'ltr';
  pill.textContent = fin ? tr(S.pillDone, pillLang) : tr(S.pill, pillLang);
  pill.classList.toggle('pulse', fin);
  pill.hidden = !!current;
}

function poll() {
  const storage = ls();
  const s = loadSession(storage);
  if (!s || s.stage !== 'playing') { clearInterval(pollTimer); pollTimer = null; refreshPill(); return; }
  const prog = readProgress(storage);
  const n = prog.doneIds.length;
  const seen = Number.isInteger(s.doneSeen) ? s.doneSeen : 0;
  if (n > seen) {
    for (let i = seen; i < n; i++) track('situation_done');
    s.doneSeen = n;
  }
  if (prog.finished && !s.journeySent) { track('journey_done'); s.journeySent = true; }
  saveSession(storage, s);
  refreshPill();
}

/** Call once per page load (cheap no-op unless ?study=1 or an active session). */
let booted = false;
export function boot({ lang } = {}) {
  if (typeof document === 'undefined') return;
  pillLang = pickLang(lang);
  if (booted) { refreshPill(); return; }
  booted = true;
  const storage = ls();
  const s = loadSession(storage);
  if (!s) {
    if (params().get('study') === '1') open({ lang: pillLang });
    return;
  }
  if (s.stage === 'enrolled') { open({ lang: pillLang }); return; }
  if (s.needsStart) { s.needsStart = false; saveSession(storage, s); track('session_start'); }
  refreshPill();
  if (!pollTimer) pollTimer = setInterval(poll, 4000);
}

/** Start-screen entry link element (optional helper for the engine owner). */
export function entryButton({ lang } = {}) {
  lang = pickLang(lang);
  return h('button', { type: 'button', class: 'yk-study-entry', onclick: () => open({ lang }) }, tr(S.entry, lang));
}

// auto-boot when loaded with ?study=1 (so a bare dynamic import is enough)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const run = () => boot({});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true }); else run();
}
