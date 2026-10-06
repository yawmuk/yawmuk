// Spoken languages for voice in/out (browser speech recognition, server TTS, browser speechSynthesis fallback)
// and for the guide's conversation language. Shared by the browser and the server: pure ESM, no DOM.
//
// Adding a language = ONE entry below. `script` (optional) is a regex for a script that identifies the language
// (used to pick the voice from the text itself); Latin-script languages leave it out and follow the fallback.
// `name` is the English name used in model prompts ("write the answer in …").
export const SPEECH_LANGS = [
  { code: 'ar', bcp47: 'ar-SA', label: 'العربية', name: 'Arabic', dir: 'rtl', script: /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g },
  { code: 'en', bcp47: 'en-US', label: 'English', name: 'English', dir: 'ltr' },
  { code: 'es', bcp47: 'es-US', label: 'Español', name: 'Spanish', dir: 'ltr' },
  { code: 'zh', bcp47: 'zh-CN', label: '中文', name: 'Chinese (Simplified Mandarin)', dir: 'ltr', script: /[㐀-䶿一-鿿豈-﫿]/g },
  { code: 'hi', bcp47: 'hi-IN', label: 'हिन्दी', name: 'Hindi', dir: 'ltr', script: /[ऀ-ॿ]/g }
];

export const LANG_CODES = SPEECH_LANGS.map((l) => l.code);
const BY_CODE = new Map(SPEECH_LANGS.map((l) => [l.code, l]));
// Codes people/browsers send for the same language (ISO 639-2/3, legacy tags).
const ALIASES = { ara: 'ar', eng: 'en', spa: 'es', zho: 'zh', chi: 'zh', cmn: 'zh', hin: 'hi' };

/** 'es', 'es-MX', 'ES_us', 'zh-Hans-CN', 'cmn' -> 'es' / 'zh' …; anything unsupported -> `fallback` (default null). */
export function normalizeLang(code, fallback = null) {
  if (typeof code !== 'string') return fallback;
  const tag = code.trim().toLowerCase();
  if (!/^[a-z]{2,3}([-_][a-z0-9]{1,8})*$/.test(tag)) return fallback; // a well-formed BCP-47-ish tag only
  const primary = tag.split(/[-_]/)[0];
  const c = ALIASES[primary] || primary;
  return BY_CODE.has(c) ? c : fallback;
}

/** Table entry for a code (normalized); unknown -> English. */
export const speechLang = (code) => BY_CODE.get(normalizeLang(code, 'en'));
export const bcp47Of = (code) => speechLang(code).bcp47;
export const langName = (code) => speechLang(code).name;
export const langDir = (code) => speechLang(code).dir;

/**
 * The language to SPEAK `text` in, from its script: Arabic letters -> ar, Devanagari -> hi, Han -> zh (the script
 * with the most characters wins). Latin-only text follows `fallback` when that is a Latin-script language
 * (en, es …), otherwise English (an English passage in the Arabic UI is still read in English). Text with no
 * letters at all (digits, punctuation) follows `fallback`.
 */
export function detectSpeechLang(text, fallback = 'en') {
  const s = String(text ?? '');
  const fb = normalizeLang(fallback, 'en');
  let best = null, bestN = 0;
  for (const l of SPEECH_LANGS) {
    if (!l.script) continue;
    const n = (s.match(l.script) || []).length;
    if (n > bestN) { best = l.code; bestN = n; }
  }
  if (best) return best;
  if (/\p{Script=Latin}/u.test(s)) return BY_CODE.get(fb).script ? 'en' : fb;
  return fb;
}

const HAN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
/** Rough spoken length in "Latin characters": a Han character is about one syllable, so it counts as 3. */
export const speechWeight = (text) => { const s = String(text ?? ''); return s.length + 2 * (s.match(HAN) || []).length; };

/**
 * Split text into speakable chunks at sentence ends (then commas, then spaces; CJK is cut hard), so server TTS
 * can start playing the first sentence while the rest is generated (synthesis time grows with audio length).
 * The first chunk is kept short for a fast start. -> ['…', '…']
 */
export function splitSpeech(text, { first = 140, max = 220 } = {}) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  if (speechWeight(s) > s.length * 2) { first = Math.round(first / 3); max = Math.round(max / 3); } // mostly Han
  const sentences = (s.match(/[^.!?…؟。！？।॥]+(?:[.!?…؟。！？।॥]+["'”’»)\]]*|$)\s*/g) || [s]).map((x) => x.trim()).filter(Boolean);
  const cut = (x, lim) => { // -> pieces of x, each <= lim
    const out = [];
    while (x.length > lim) {
      const head = x.slice(0, lim);
      let at = Math.max(...[...'،,，、;；:：'].map((c) => head.lastIndexOf(c)));
      if (at < lim * 0.4) at = head.lastIndexOf(' ');
      if (at < lim * 0.4) at = lim - 1;
      out.push(x.slice(0, at + 1).trim());
      x = x.slice(at + 1).trim();
    }
    if (x) out.push(x);
    return out;
  };
  const pieces = sentences.flatMap((x) => cut(x, max));
  if (pieces.length && pieces[0].length > first) pieces.splice(0, 1, ...cut(pieces[0], first));
  const out = [];
  for (const p of pieces) { // chunk 0 stays <= first (fast start); later chunks pack sentences up to max
    const last = out.length - 1;
    const sep = last >= 0 && /[　-鿿＀-￯]$/.test(out[last]) ? '' : ' ';
    if (last >= 0 && out[last].length + sep.length + p.length <= (last === 0 ? first : max)) out[last] += `${sep}${p}`;
    else out.push(p);
  }
  return out;
}

/** Server TTS time budget for one chunk (synthesis takes roughly 1/3 of the audio's duration, plus overhead). */
export const ttsBudgetMs = (text) => Math.min(20000, Math.max(8000, 4000 + 35 * speechWeight(text)));
