// Study session state + game-progress reading. Pure functions with injected storage (testable in node).
// The session lives in the participant's own browser (localStorage 'yk-study'); it holds only the anonymous code,
// the assigned arm and the stage. Game progress is READ from the engine's own key (never modified here, except
// cleared once when the participant starts their study day so everyone starts from a fresh "new day").
import { ITEMS } from './questions.js';

export const SESSION_KEY = 'yk-study';
export const PROGRESS_KEY = 'yawmuk.progress.v1'; // = STORAGE_KEY in src/engine/config.js
export const STAGES = ['enrolled', 'playing'];

export function loadSession(storage) {
  try {
    const s = JSON.parse(storage?.getItem(SESSION_KEY) || 'null');
    if (s && typeof s.id === 'string' && /^[A-Z2-9]{10}$/.test(s.id) && STAGES.includes(s.stage) && (s.arm === 'ai' || s.arm === 'fixed')) return s;
  } catch { /* storage blocked or corrupt */ }
  return null;
}
export function saveSession(storage, s) {
  try { storage?.setItem(SESSION_KEY, JSON.stringify(s)); return true; } catch { return false; }
}
export function clearSession(storage) {
  try { storage?.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

/** { planSource, doneIds[], finished } from the game's saved progress (all fields safe defaults). */
export function readProgress(storage) {
  try {
    const p = JSON.parse(storage?.getItem(PROGRESS_KEY) || 'null');
    const sits = p && typeof p.situations === 'object' && p.situations ? p.situations : {};
    const doneIds = Object.entries(sits).filter(([, r]) => r && r.done).map(([k]) => k);
    const src = p?.plan?.source;
    return { planSource: ['ai', 'default', 'fallback'].includes(src) ? src : null, doneIds, finished: !!p?.finished };
  } catch { return { planSource: null, doneIds: [], finished: false }; }
}

/** How many of the 5 tested situations the participant actually played (exposure). */
export function testedSeen(doneIds) {
  const set = new Set(doneIds || []);
  return ITEMS.filter((it) => set.has(it.ruling_id)).length;
}

/** URL for the study day: keeps unrelated params, sets study=1, arm=fixed|ai, lang; drops scene jumps. */
export function studyUrl(href, arm, lang) {
  const u = new URL(href);
  for (const k of ['arm', 'scene', 'nointro', 'study']) u.searchParams.delete(k);
  u.searchParams.set('study', '1');
  u.searchParams.set('arm', arm === 'fixed' ? 'fixed' : 'ai');
  if (lang === 'ar' || lang === 'en') u.searchParams.set('lang', lang);
  return u.toString();
}

/** Post-test display order (same concepts, rotated). */
export function orderItems(order) { return order.map((i) => ITEMS[i]).filter(Boolean); }
