// AI safety core: pure functions shared by the browser (planner.js, ui/askPanel.js), the Netlify functions
// (netlify/functions/*.mjs) and the unit tests (tests/ai.test.mjs). No DOM, no network, no import.meta.
//
// The model only ever ARRANGES reviewed material (journey planner) or ANSWERS FROM retrieved, reviewed passages
// (ask panel). Everything it returns goes through the validators below; anything that fails is dropped and the
// game falls back to deterministic, pre-authored behaviour.
import { LOCATIONS, TOPICS, DAY_TYPES } from './config.js';

// ------------------------------------------------------------------ scripture / citation detectors
// Same patterns as tests/safety.test.mjs ("Scripts never contain Quran or hadith text"), re-implemented here
// because the test file does not export them.
export const SCRIPTURE_PATTERNS = [
  [/[﴿﴾]/, 'Quran ornate brackets'],
  [/قال\s+(رسول\s+الله|النبي|الرسول)/, 'qala rasul allah'],
  [/(قال|يقول)\s+(الله\s+)?تعالى/, 'qala ta3ala'],
  [/قال\s+الله/, 'qala allah'],
  [/قال\s+رسول/, 'qala rasul'],
  [/صلى\s+الله\s+عليه\s+وسلم|ﷺ/, 'salawat formula'],
  [/عن\s+\S+\s+(رضي\s+الله\s+عنه|رضي\s+الله\s+عنها)/, 'isnad'],
  [/\bthe\s+prophet\b[^.]{0,40}\bsaid\b/i, 'the Prophet said'],
  [/\b(messenger\s+of\s+allah|rasul\s*allah)\b[^.]{0,40}\bsaid\b/i, 'the Messenger said'],
  [/\ballah\s+(says|said)\b/i, 'Allah says'],
  [/\b(qur'?an|koran)\s+says\b/i, 'the Quran says'],
  [/\b(sahih\s+)?(bukhari|muslim)\s*(#|no\.?|number)?\s*\d{2,}/i, 'hadith reference number'],
  [/\b\d{1,3}:\d{1,3}\b/, 'surah:ayah reference'],
  [/\b(surah|sura|ayah|ayat|verse)\s*\d+/i, 'verse reference'],
  [/(سورة|الآية|آية)\s+\S*\s*\d+/, 'Arabic verse reference'],
  [/(رواه|أخرجه)\s+(البخاري|مسلم|أبو\s+داود|الترمذي|النسائي|ابن\s+ماجه|أحمد)/, 'hadith attribution'],
  [/\bnarrated\b|\bsahih\s+(muslim|bukhari|al-bukhari)\b|(^|\s)(رواه|أخرجه|يروى|روي)(\s|$)/i, 'narration claim']
];

const HARAKAT = /[ً-ْٰ]/g;
/** Heavily vocalised Arabic (lots of tashkeel) is almost always a quoted ayah/hadith: deny it. */
const tooVocalised = (s) => (String(s).match(HARAKAT) || []).length > 12;

/** First matching scripture/citation pattern label, or null. */
export function scriptureHit(text) {
  const s = String(text ?? '');
  for (const [re, what] of SCRIPTURE_PATTERNS) if (re.test(s)) return what;
  if (tooVocalised(s)) return 'vocalised Arabic (quoted text)';
  return null;
}

// Extra words forbidden in the short planner "why" lines (they must explain the ORDER, never cite evidence).
const WHY_FORBIDDEN = /qur'?an|koran|hadith|hadeeth|sunnah|القرآن|قرآن|حديث|الحديث|السنة\s+النبوية|آية|قال\s+الله|قال\s+رسول|fatwa|فتوى/i;
const QUOTES = /["“”«»„‟﴿﴾]/;
export const WHY_MAX = 160;

/** A planner "why" must be {ar,en}, each non-empty, <= 160 chars, no quote marks, no scripture-like text. */
export function validWhy(why) {
  if (!why || typeof why !== 'object') return false;
  for (const l of ['ar', 'en']) {
    const s = why[l];
    if (typeof s !== 'string' || !s.trim() || s.length > WHY_MAX) return false;
    if (QUOTES.test(s) || WHY_FORBIDDEN.test(s) || scriptureHit(s)) return false;
  }
  return true;
}

// ------------------------------------------------------------------ citations resolve to content/sources.json
/**
 * Build a checker: id -> true when the situation has a ruling, every Quran citation of that ruling has a record
 * in sources.json, and sources.json lists at least one record used by it.
 */
export function makeCitationChecker(rulingsById, sources) {
  const list = Array.isArray(sources) ? sources : [];
  const ids = new Set(list.map((s) => s && s.id));
  const usedBy = new Set(list.flatMap((s) => (Array.isArray(s?.used_in) ? s.used_in : [])));
  return (id) => {
    const r = rulingsById?.[id];
    if (!r) return false;
    if (!usedBy.has(id)) return false;
    for (const q of Array.isArray(r.quran) ? r.quran : []) if (!ids.has(`quran:${q.surah}:${String(q.ayah).trim()}`)) return false;
    return true;
  };
}

// ------------------------------------------------------------------ journey planner
/**
 * Validate a model plan. raw = {journey:[{situation_id, why:{ar,en}}], followup}.
 * Drops: ids not in the catalog, duplicates, invalid "why", situations whose citations do not resolve.
 * Returns { ok, journey:[{id, why}], followup, dropped:[{id, reason}] }. ok requires >= 1 kept item.
 */
export function validatePlan(raw, { catalogIds, citationsOk = () => true } = {}) {
  const known = catalogIds instanceof Set ? catalogIds : new Set(catalogIds || []);
  const out = { ok: false, journey: [], followup: null, dropped: [] };
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.journey)) return out;
  const seen = new Set();
  for (const item of raw.journey.slice(0, 40)) {
    const id = item && typeof item.situation_id === 'string' ? item.situation_id : null;
    if (!id || !known.has(id)) { out.dropped.push({ id, reason: 'unknown id' }); continue; }
    if (seen.has(id)) { out.dropped.push({ id, reason: 'duplicate' }); continue; }
    if (!validWhy(item.why)) { out.dropped.push({ id, reason: 'invalid why' }); continue; }
    if (!citationsOk(id)) { out.dropped.push({ id, reason: 'citations do not resolve' }); continue; }
    seen.add(id);
    out.journey.push({ id, why: { ar: item.why.ar.trim(), en: item.why.en.trim() } });
  }
  if (typeof raw.followup === 'string' && known.has(raw.followup) && citationsOk(raw.followup)) out.followup = raw.followup;
  out.ok = out.journey.length >= 1;
  return out;
}

const DEFAULT_WHY = { ar: 'جزء من يوم آدم المعتاد', en: "Part of Adam's usual day" };

/**
 * Deterministic rule-based planner. situations = [{id, location}] in the default play order.
 * Sort key: number of chosen topics that include the situation (desc), then day-type location match (desc), then
 * default order. With no topics and no day type the result is exactly the default order.
 */
export function fallbackPlan({ dayType = null, topics = [] } = {}, situations = []) {
  const tps = (Array.isArray(topics) ? topics : []).filter((t) => TOPICS[t]);
  const day = DAY_TYPES[dayType] || null;
  const scored = situations.map((s, i) => {
    const hits = tps.filter((t) => TOPICS[t].ids.includes(s.id));
    const dayRank = day ? day.locations.indexOf(s.location) : -1;
    return { s, i, topic: hits.length, day: dayRank < 0 ? 0 : day.locations.length - dayRank, hits };
  });
  scored.sort((a, b) => b.topic - a.topic || b.day - a.day || a.i - b.i);
  const journey = scored.map(({ s, hits, day: d }) => {
    if (hits.length) {
      const t = TOPICS[hits[0]];
      return { id: s.id, why: { ar: `يناسب اهتمامك: ${t.ar}`, en: `Matches your interest: ${t.en}` } };
    }
    if (d) return { id: s.id, why: { ar: `يناسب نوع يومك: ${DAY_TYPES[dayType].ar}`, en: `Fits your kind of day: ${DAY_TYPES[dayType].en}` } };
    return { id: s.id, why: { ...DEFAULT_WHY } };
  });
  const followup = tps.length ? (scored.find((x) => x.topic === 0)?.s.id ?? null) : null;
  return { journey, followup };
}

/** Location order from a journey: locations in order of first appearance, then every missing location (default order). */
export function orderLocations(journeyIds, locations = LOCATIONS, locOf = (id) => String(id).split('.')[0]) {
  const order = [];
  for (const id of journeyIds || []) { const l = locOf(id); if (locations.includes(l) && !order.includes(l)) order.push(l); }
  for (const l of locations) if (!order.includes(l)) order.push(l);
  return order;
}

/** True when `order` is a permutation of `locations`. */
export function isValidOrder(order, locations = LOCATIONS) {
  return Array.isArray(order) && order.length === locations.length && locations.every((l) => order.includes(l));
}

// ------------------------------------------------------------------ ask panel: personal-fatwa pre-filter
// Level D (reference package p.2): a question about the asker's own case is referred, never answered as a ruling.
// Arabic patterns run on a normalised copy (no harakat/tatweel, unified alef/ya) so «أنا» = «انا», «لي» = «لى».
const FATWA_PATTERNS_AR = [
  /هل\s+يجوز\s+لي/, /يجوز\s+لي/, /هل\s+يحل\s+لي/, /هل\s+يحق\s+لي/, /حالتي/, /وضعي/, /ظروفي/, /مشكلتي/,
  /(^|\s)(و|ف)?(زوجتي|زوجي|امي|ابي(?!\s+(بكر|هريره|هريرة|طالب|ذر|سفيان|داود|حنيفه|حنيفة|موسي|ايوب|سعيد|الدرداء|عبيده|عبيدة|لهب|جهل))|والدي|والدتي|ابني|ابنتي|اخي|اختي|مديري|خطيبتي|خطيبي)(\s|$|[،؟?.!])/,
  // the asker's own acts and belongings: «صلاتي»، «قرضي»، «عندي…»، «حلفت…»، «ماذا علي»
  /(^|\s)(و|ف|ب|ل)?(صلاتي|صيامي|زكاتي|راتبي|قرضي|عقدي|بيتي|زواجي|طلاقي|حجي|وضويي|وضوءي|وضوئي)(\s|$|[،؟?.!])/,
  /(^|\s)(عندي|لدي)(\s|$|[،؟?.!])/,
  /(^|\s)(حلفت|طلقت|صليت|اشتريت|اخذت|اقترضت|وقعت|نذرت|افطرت)(\s|$)/,
  /ماذا\s+علي(\s|$|[؟?])/,
  /هل\s+(علي|يجب\s+علي|يلزمني)/, /هل\s+(استطيع|يمكنني|اقدر|اقدر\s+ان)/,
  /(^|\s)(انا|نحن|احنا)\s+(في|ف|مقيم|مقيمه|اعيش|نعيش|اعمل|نعمل|ادرس|طالب|طالبه|متزوج|متزوجه)(\s|$)/,
  /(^|\s)(اعيش|نعيش|اعمل|نعمل|اسكن|نسكن)\s+في(\s|$)/,
  /(اريد|اود|انوي|نريد|ننوي)\s+(ان|أن)\s+[^؟?]*(ما\s+رايكم|ما\s+رايك|هل\s+يجوز|فهل|ما\s+الحكم|هل\s+هذا)/,
  /ماذا\s+(افعل|نفعل)/
];
const FATWA_PATTERNS_EN = [
  /\bmy\s+(wife|husband|case|situation|family|son|daughter|mother|mom|father|dad|parents|brother|sister|boss|manager|fianc[eé]e?|loan|mortgage|job|debt|marriage|employer)\b/i,
  /\bshould\s+i\b/i, /\bcan\s+i\b/i, /\bmay\s+i\b/i, /\b(am\s+i|are\s+we)\s+allowed\b/i, /\bdo\s+(i|we)\s+have\s+to\b/i, /\bmust\s+(i|we)\b/i,
  /\bis\s+it\s+(ok|okay|halal|haram|allowed|permissible|fine|permitted|sinful)\s+for\s+(me|us)\b/i, /\bin\s+my\s+case\b/i,
  /\b(i|we)\s+(live|work|study|reside)\s+in\b/i, /\b([Ii]\s+am|[Ii]'m|[Ww]e\s+are|[Ww]e're)\s+in\s+(the\s+)?[A-Z]/, /\b(i'm|i\s+am|we're|we\s+are)\s+(living|working|studying|based|staying)\b/i,
  // "is it okay to take THIS mortgage?" — a deictic object makes it the asker's own case; "is it halal to eat shrimp?" stays general.
  /\bis\s+it\s+(ok|okay|halal|haram|allowed|permissible|fine|permitted)\s+(for\s+(me|us)\s+)?to\s+\w+(\s+\w+)?\s+(this|that|these|those|my|our)\b/i,
  /\bwhat\s+should\s+(i|we)\s+do\b/i,
  /\bam\s+i\b/i, /\bwhere\s+(i|we)\s+(live|work|study)\b/i,
  /\b(i|we)\s+(took|bought|signed|borrowed|missed|swore|divorced|owe)\b/i,
  /\b(i|we)\s+(have|got|had)\s+(a|an|some|this|that)?\s*(loan|mortgage|debt|credit\s+card|student\s+loan|contract|job\s+offer|offer)\b/i,
  /\bmy\s+(prayer|prayers|fast|fasting|wudu|zakat|salary|income|savings|contract|account|house|car|business|brother|sister)\b/i,
  // "Mortgage in Texas with no alternative — halal?": a named place + "no alternative / no choice" is a personal case
  /\b(no|without)\s+(other\s+)?(alternative|choice|option)s?\b/i, /\b(i|we)\s+(want|plan|intend|need)\s+to\b[^?]*\b(allowed|halal|haram|permissible|ok|okay|what\s+do\s+you\s+think)\b/i
];
const normAr = (s) => s.replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
export function isPersonalFatwa(q) {
  const s = String(q ?? '');
  const ar = normAr(s);
  return FATWA_PATTERNS_AR.some((re) => re.test(ar)) || FATWA_PATTERNS_EN.some((re) => re.test(s));
}
export const ASK_MAX = 300;

// ------------------------------------------------------------------ retrieval (BM25 over short passages)
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'of', 'to', 'in', 'on', 'and', 'or', 'for', 'it', 'be', 'do', 'does', 'what', 'why', 'how', 'can', 'i', 'you', 'with', 'this', 'that', 'about', 'at', 'as', 'if', 'from', 'by', 'was', 'they', 'their',
  'في', 'من', 'على', 'إلى', 'الى', 'عن', 'ما', 'ماذا', 'هل', 'لماذا', 'كيف', 'أن', 'ان', 'هو', 'هي', 'مع', 'او', 'أو', 'ثم', 'لا', 'هذا', 'هذه', 'التي', 'الذي']);
export function tokenize(text) {
  return String(text ?? '').toLowerCase()
    .replace(HARAKAT, '').replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => (/^(وال|بال|فال|كال|لل)/.test(w) && w.length > 5 ? w.slice(3) : /^ال/.test(w) && w.length > 4 ? w.slice(2) : w))
    .map((w) => (/^[a-z]+s$/.test(w) && w.length > 4 ? w.slice(0, -1) : w))
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** passages = [{id, text}] -> top k [{id, text, score}] with score > 0 (BM25, k1=1.2, b=0.75). */
export function retrieve(query, passages, k = 5) {
  const q = [...new Set(tokenize(query))];
  if (!q.length || !Array.isArray(passages) || !passages.length) return [];
  const docs = passages.map((p) => ({ p, toks: tokenize(p.text) }));
  const N = docs.length, avg = docs.reduce((a, d) => a + d.toks.length, 0) / N || 1;
  const df = Object.fromEntries(q.map((t) => [t, docs.filter((d) => d.toks.includes(t)).length]));
  const scored = docs.map(({ p, toks }) => {
    let score = 0;
    for (const t of q) {
      const tf = toks.filter((x) => x === t).length;
      if (!tf) continue;
      const idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
      score += idf * (tf * 2.2) / (tf + 1.2 * (1 - 0.75 + 0.75 * toks.length / avg));
    }
    return { id: p.id, text: p.text, score: score + (p.boost || 0) * (score > 0 ? 1 : 0) };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

// ------------------------------------------------------------------ ask panel: model answer validator
export const ANSWER_MAX = 900;
/**
 * raw = {answer: string | {ar|en}, used_ids:[...], refer:bool, abstain:bool}; retrievedIds = ids actually sent.
 * Returns { abstain, refer, answer, used_ids, reason }. Abstains when the model abstained, cited nothing, cited an
 * id it was not given, returned scripture-like text / claimed citations, or the answer is empty/too long.
 */
export function validateAnswer(raw, retrievedIds, lang = 'en') {
  const abstain = (reason) => ({ abstain: true, refer: true, answer: null, used_ids: [], reason });
  if (!raw || typeof raw !== 'object') return abstain('no object');
  if (raw.abstain === true) return abstain('model abstained');
  const allowed = new Set(retrievedIds || []);
  const used = Array.isArray(raw.used_ids) ? [...new Set(raw.used_ids.filter((x) => typeof x === 'string'))] : [];
  if (!used.length) return abstain('no used_ids');
  if (!used.every((id) => allowed.has(id))) return abstain('used_ids not retrieved');
  let text = raw.answer;
  if (text && typeof text === 'object') text = text[lang] ?? text.en ?? text.ar ?? Object.values(text).find((v) => typeof v === 'string');
  if (typeof text !== 'string' || !text.trim()) return abstain('empty answer');
  text = text.trim();
  if (text.length > ANSWER_MAX) return abstain('answer too long');
  const hit = scriptureHit(text);
  if (hit) return abstain(`scripture/citation: ${hit}`);
  if (/[﴿﴾]|\bhttps?:\/\//i.test(text)) return abstain('claimed citation');
  return { abstain: false, refer: raw.refer === true, answer: text, used_ids: used, reason: null };
}

// ------------------------------------------------------------------ pre/post understanding check
/** First n situations of the journey that have a usable check_question. sitsById: id -> situation. */
export function pickChecks(journeyIds, sitsById, n = 3) {
  const out = [];
  for (const id of journeyIds || []) {
    const cq = sitsById[id]?.check_question;
    if (cq && Array.isArray(cq.options) && cq.options.some((o) => o.correct)) out.push(id);
    if (out.length >= n) break;
  }
  return out;
}

// ------------------------------------------------------------------ metrics payload (consented, anonymous)
export function metricsPayload({ arm, completed, pre, post, clarity }) {
  const n = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  return { arm: arm === 'ai' ? 'ai' : 'fixed', completed: completed === true, pre: n(pre, 0, 3), post: n(post, 0, 3), clarity: n(clarity, 1, 5) };
}
