// The game's single speech-output engine.
//   speakText(text, { lang, onEnd, onStop }) — natural server voice first (POST /.netlify/functions/tts -> WAV,
//   Gemini TTS, any language in speechLangs.js), long text split into sentences so the first one plays while the
//   rest is generated; on any failure the browser's speechSynthesis takes over with the best voice for the language.
//   A server voice needs no OS voices, which is what makes Hindi/Chinese work on machines without them.
// One thing speaks at a time: stopSpeaking() stops the audio element AND speechSynthesis.
// Nothing is ever spoken automatically by this module: read-aloud buttons speak only when pressed. Only the text
// shown on screen is sent to the server (never audio from the player); nothing is stored.
import { h } from './dom.js';
import { t, getLang } from './i18n.js';
import { detectSpeechLang, normalizeLang, bcp47Of, splitSpeech, ttsBudgetMs } from './speechLangs.js';

export const TTS_ENDPOINT = '/.netlify/functions/tts';
const win = typeof window !== 'undefined' ? window : null;
export const browserTtsSupported = () => !!win && 'speechSynthesis' in win && typeof win.SpeechSynthesisUtterance === 'function';
const audioPossible = () => !!win && typeof win.Audio === 'function' && typeof fetch === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
export const ttsSupported = () => browserTtsSupported() || audioPossible();

// ------------------------------------------------------------------ server voice
// 404/405 or a non-audio reply (static host, dev server) turns server TTS off for this page; 5xx/429/network
// errors pause it for a minute. Either way the browser voice is used meanwhile.
let serverOffUntil = 0;
const serverOn = () => audioPossible() && Date.now() >= serverOffUntil;

const blobs = new Map(); // `${lang}|${text}` -> object URL (most recent last)
const BLOB_MAX = 60;
let player = null;
const SILENT = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
let unlocked = false;

function getPlayer() {
  if (!player && audioPossible()) { player = new win.Audio(); player.preload = 'auto'; }
  return player;
}
/** Call inside a user gesture (click): lets the shared audio element play later without one (Safari/iOS). */
export function unlockAudio() {
  const p = getPlayer();
  if (!p || unlocked) return;
  unlocked = true;
  try {
    p.muted = true; p.src = SILENT;
    const r = p.play();
    const after = (ok) => { if (p.src === SILENT) { try { p.pause(); } catch { /* */ } } p.muted = false; if (!ok) unlocked = false; };
    if (r && typeof r.then === 'function') r.then(() => after(true), () => after(false)); else after(true);
  } catch { p.muted = false; unlocked = false; }
}

function remember(key, url) {
  blobs.delete(key); blobs.set(key, url);
  while (blobs.size > BLOB_MAX) {
    const [k, u] = blobs.entries().next().value;
    blobs.delete(k);
    if (!player || player.src !== u) { try { URL.revokeObjectURL(u); } catch { /* */ } }
  }
}

/** One chunk -> object URL of its audio, or null (caller falls back). */
async function fetchChunk(text, lang, signal) {
  const key = `${lang}|${text}`;
  if (blobs.has(key)) { const u = blobs.get(key); remember(key, u); return u; }
  if (!serverOn() || signal.aborted) return null;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ctrl.abort(), ttsBudgetMs(text) + 1500);
  try {
    const res = await fetch(TTS_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang }), signal: ctrl.signal });
    if (!res.ok) {
      if (res.status === 404 || res.status === 405) serverOffUntil = Infinity;
      else if (res.status >= 500 || res.status === 429) serverOffUntil = Date.now() + 60_000;
      return null;
    }
    if (!/^audio\//i.test(res.headers.get('content-type') || '')) { serverOffUntil = Infinity; return null; }
    const blob = await res.blob();
    if (!blob.size) return null;
    const url = URL.createObjectURL(blob);
    remember(key, url);
    return url;
  } catch {
    if (!signal.aborted) serverOffUntil = Date.now() + 30_000; // timeout / network: browser voice for a while
    return null;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
}

// ------------------------------------------------------------------ browser voice
/** Best installed voice for a BCP-47 tag: exact tag, then the same language. */
export function pickVoice(tag) {
  try {
    const voices = win.speechSynthesis.getVoices() || [];
    const want = String(tag).toLowerCase();
    const norm = (v) => String(v.lang || '').toLowerCase().replace(/_/g, '-');
    return voices.find((v) => norm(v) === want) || voices.find((v) => norm(v).split('-')[0] === want.split('-')[0]) || null;
  } catch { return null; }
}

function browserSpeak(j, chunks, lang, finish) {
  if (job !== j) return;
  if (!browserTtsSupported() || !chunks.length) { finish('error'); return; }
  try {
    const tag = bcp47Of(lang);
    const voice = pickVoice(tag);
    chunks.forEach((c, i) => { // one utterance per sentence group: long utterances get cut off in some browsers
      const u = new win.SpeechSynthesisUtterance(c);
      u.lang = tag;
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onerror = () => finish('error');
      if (i === chunks.length - 1) u.onend = () => finish('end');
      win.speechSynthesis.speak(u);
    });
  } catch { finish('error'); }
}

// ------------------------------------------------------------------ engine
let job = null; // the one current utterance: { ctrl, done, onStop, wake }

function playUrl(j, url) {
  return new Promise((resolve) => {
    const p = getPlayer();
    if (!p) { resolve(false); return; }
    let settled = false;
    const done = (ok) => { if (settled) return; settled = true; p.onended = null; p.onerror = null; j.wake = null; resolve(ok); };
    j.wake = done;
    p.onended = () => done(true);
    p.onerror = () => done(false);
    try {
      p.muted = false; p.src = url;
      const r = p.play();
      if (r && typeof r.catch === 'function') r.catch(() => done(false)); // autoplay refusal -> browser voice
    } catch { done(false); }
  });
}

async function run(j, chunks, lang, finish) {
  let i = 0;
  if (serverOn() || blobs.has(`${lang}|${chunks[0]}`)) {
    // fetch ahead of playback, up to 3 chunks at a time (in order); after a failure the rest resolve to null
    const slots = chunks.map(() => { let res; const p = new Promise((r) => { res = r; }); return { p, res }; });
    let next = 0, failed = false;
    const pump = () => {
      if (failed || job !== j) { for (; next < chunks.length; next++) slots[next].res(null); return; }
      if (next >= chunks.length) return;
      const k = next++;
      fetchChunk(chunks[k], lang, j.ctrl.signal).then((u) => { slots[k].res(u); if (!u) failed = true; pump(); });
    };
    for (let n = 0; n < 3; n++) pump();
    for (; i < chunks.length; i++) {
      const url = await slots[i].p;
      if (job !== j) return;
      if (!url || !(await playUrl(j, url))) break;
      if (job !== j) return;
    }
    if (i === chunks.length) { finish('end'); return; }
  }
  browserSpeak(j, chunks.slice(i), lang, finish);
}

function halt() {
  const j = job;
  job = null;
  if (j) { try { j.ctrl.abort(); } catch { /* */ } }
  if (player) { try { player.pause(); } catch { /* */ } }
  try { if (browserTtsSupported()) win.speechSynthesis.cancel(); } catch { /* */ }
  if (j) { j.wake?.(false); if (!j.done) { j.done = true; try { j.onStop?.(); } catch { /* */ } } }
}

/**
 * Speak `text` in `lang` (any speechLangs code; default: detected from the text, falling back to the UI language).
 * onEnd(how: 'end'|'error') fires once when it finishes on its own; onStop() fires instead when it is cut off by
 * stopSpeaking() or by another speakText(). Returns false when nothing can speak.
 */
export function speakText(text, { lang, onEnd, onStop } = {}) {
  halt();
  const s = String(text ?? '').trim();
  if (!s || !ttsSupported()) return false;
  const code = normalizeLang(lang) || detectSpeechLang(s, getLang());
  const chunks = splitSpeech(s);
  const j = { ctrl: new AbortController(), done: false, onStop, wake: null };
  job = j;
  unlockAudio();
  const finish = (how) => { if (job !== j || j.done) return; j.done = true; job = null; try { onEnd?.(how); } catch { /* */ } };
  run(j, chunks, code, finish).catch(() => finish('error'));
  return true;
}

export const isSpeaking = () => !!job;

// ------------------------------------------------------------------ read-aloud buttons
let current = null; // the button currently speaking

function reset(b) { if (!b) return; b.classList.remove('speaking'); b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', t('readAloud')); b.title = t('readAloud'); }

export function stopSpeaking() {
  halt();
  reset(current); current = null;
}

/** A small "listen" button for `getText()` (string or function). Returns null when unsupported. */
export function speakButton(getText, extraClass = '') {
  if (!ttsSupported()) return null;
  const b = h('button', { type: 'button', class: `tts-btn${extraClass ? ` ${extraClass}` : ''}`, 'aria-pressed': 'false', 'aria-label': t('readAloud'), title: t('readAloud') },
    h('span', { 'aria-hidden': 'true' }, '🔊'));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudio();
    if (current === b) { stopSpeaking(); return; }
    stopSpeaking();
    const text = String(typeof getText === 'function' ? getText() : getText || '').trim();
    if (!text) return;
    const done = () => { if (current === b) { reset(b); current = null; } };
    current = b;
    b.classList.add('speaking'); b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', t('stopReading')); b.title = t('stopReading');
    // the voice follows the script of the text (an Arabic line in the English UI is still read in Arabic)
    if (!speakText(text, { lang: detectSpeechLang(text, getLang()), onEnd: done, onStop: done })) done();
  });
  return b;
}
