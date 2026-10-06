// Progress persistence (localStorage, every access try/catch-wrapped; works without storage).
import { STORAGE_KEY, CHECK_BONUS } from './config.js';

function blank() {
  return { v: 1, lang: null, location: null, situations: {}, visited: [], finished: false, introSeen: false };
}

let state = blank();

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 1) state = { ...blank(), ...s, situations: s.situations || {} };
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return state;
}

export function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function resetProgress(keepLang = true) {
  const lang = state.lang;
  state = blank();
  if (keepLang) state.lang = lang;
  saveProgress();
}

export function progress() { return state; }

export function hasSave() { return !!state.location || Object.keys(state.situations).length > 0; }

export function setLocation(loc) {
  state.location = loc;
  if (!state.visited.includes(loc)) state.visited.push(loc);
  saveProgress();
}

export function sitRecord(key) { return state.situations[key] || null; }

export function isDone(key) { return !!state.situations[key]?.done; }

/** Record a choice. Score keeps the BEST points achieved for the situation (replaying never loses points). */
export function recordChoice(key, choice) {
  const r = state.situations[key] || { tried: [], best: 0, done: false, check: null };
  r.last = choice.id;
  if (!r.tried.includes(choice.id)) r.tried.push(choice.id);
  r.best = Math.max(r.best || 0, choice.points || 0);
  state.situations[key] = r;
  saveProgress();
}

export function recordCheck(key, correct) {
  const r = state.situations[key] || { tried: [], best: 0, done: false, check: null };
  if (r.check !== true) r.check = !!correct; // once correct, stays correct
  state.situations[key] = r;
  saveProgress();
}

export function markDone(key) {
  const r = state.situations[key] || { tried: [], best: 0, check: null };
  r.done = true;
  state.situations[key] = r;
  saveProgress();
}

export function totalScore() {
  return Object.values(state.situations).reduce((a, r) => a + (r.best || 0) + (r.check ? CHECK_BONUS : 0), 0);
}

export function setLangPref(l) { state.lang = l; saveProgress(); }

/** The day's journey plan { source:'ai'|'fallback'|'default', order:[loc], journey:[{id, why}], followup } (no personal data). */
export function setPlan(plan) { state.plan = plan || null; saveProgress(); }
export function getPlan() { return state.plan || null; }
/** Pre-day understanding check: { ids:[situation id], answers:[bool] } (correctness only). */
export function setPre(pre) { state.pre = pre || null; saveProgress(); }
export function getPre() { return state.pre || null; }
export function setFlag(name, val) { state[name] = val; saveProgress(); }
