// «Ask Omar» guide — pure helpers shared by the browser panel (index.js), the server function
// (netlify/functions/guide.mjs) and the unit tests (tests/voice.test.mjs). No DOM, no network, no import.meta.
//
// Safety model (same as the Ask panel, widened to the whole reviewed library):
//   personal case  -> fixed referral, the model is never called
//   injection-like -> fixed "outside my scope" reply, the model is never called
//   no retrieval   -> fixed "outside my scope" reply
//   otherwise      -> the model sees ONLY the retrieved, reviewed passages; its JSON is validated twice
//                     (server + browser); anything that fails becomes abstain + referral, never a guess.
import { validateAnswer, isPersonalFatwa, retrieve, tokenize, ASK_MAX } from '../../engine/aiCore.js';
import { normalizeLang } from '../../engine/speechLangs.js';

export { isPersonalFatwa, retrieve, ASK_MAX };

export const GUIDE_TOP_K = 6;
export const PASSAGE_MAX = 1000; // characters per passage on the wire
export const WIRE_MAX_BYTES = 12000; // server.mjs rejects bodies > 16 KB (bytes, and Arabic is 2 bytes/char)
export const PASSAGE_ID = /^[a-z]:[\w.:-]{1,80}$/i;
// Share (IDF-weighted) of the question's words a passage must contain. Measured on the real library: on-topic
// questions mostly score 0.3-1.0, off-topic ones 0-0.36, so lexical retrieval alone cannot separate them.
// Hence: >= MIN_COVERAGE goes to the model (which may still answer off_topic/abstain); without a model, passages
// are shown verbatim only when the best one reaches FALLBACK_COVERAGE.
export const MIN_COVERAGE = 0.2;
export const FALLBACK_COVERAGE = 0.5;

const pick = (obj, lang) => {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  const v = obj[lang];
  if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) return v;
  return obj[lang === 'ar' ? 'en' : 'ar'] ?? '';
};
const flat = (v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')).trim();

/**
 * Every reviewed passage in the app, in one language.
 *   rulings:   { id: ruling }   (content/rulings/*.json)
 *   questions: [qaItem]         (content/script/questions.json items)
 * Returns [{ id, kind:'ruling'|'qa', rulingId?, item?, title, part, text, search }].
 * `text` is the passage exactly as reviewed; `search` adds the title for retrieval only.
 */
export function allPassages(rulings, questions, lang = 'en') {
  const out = [];
  for (const [rid, r] of Object.entries(rulings || {})) {
    if (!r || typeof r !== 'object') continue;
    const title = flat(pick(r.title, lang)) || rid;
    const add = (part, v) => {
      const text = flat(pick(v, lang));
      if (text) out.push({ id: `r:${rid}:${part}`, kind: 'ruling', rulingId: rid, level: r.content_level || null, title, part, text, search: `${title} ${flat(pick(r.question, lang))} ${text}` });
    };
    add('plain', r.newcomer_explainer);
    add('summary', r.summary);
    add('guidance', r.practical_guidance);
    add('alternatives', r.halal_alternatives);
    add('refer', r.refer_to_scholar_when);
  }
  for (const q of Array.isArray(questions) ? questions : []) {
    if (!q || typeof q.id !== 'string') continue;
    const question = flat(pick(q.question, lang));
    const answer = flat(pick(q.answer, lang));
    if (!question || !answer) continue;
    out.push({ id: `q:${q.id}`, kind: 'qa', item: q, rulingId: q.related_ruling || null, title: question, part: 'qa', text: `${question} — ${answer}`, search: `${question} ${question} ${flat(pick(q.keywords, lang))} ${answer}` });
  }
  return out.filter((p) => PASSAGE_ID.test(p.id));
}

/**
 * Top passages for a question (BM25 from aiCore over title+text). BM25 alone happily matches "tell me a joke" to
 * some passage via one common word, so each hit must also cover enough of the question: the IDF-weighted share of
 * the question's words that appear in that passage must reach `minCoverage`.
 */
export function retrieveGuide(question, passages, k = GUIDE_TOP_K, minCoverage = MIN_COVERAGE) {
  const byId = new Map(passages.map((p) => [p.id, p]));
  const hits = retrieve(question, passages.map((p) => ({ id: p.id, text: p.search || p.text })), k);
  if (!hits.length) return [];
  const q = [...new Set(tokenize(question).map(stem))];
  const toks = new Map(passages.map((p) => [p.id, new Set(tokenize(p.search || p.text).map(stem))]));
  const N = passages.length;
  const idf = Object.fromEntries(q.map((t) => {
    let df = 0; for (const set of toks.values()) if (set.has(t)) df++;
    return [t, Math.log(1 + (N - df + 0.5) / (df + 0.5))];
  }));
  const total = q.reduce((a, t) => a + idf[t], 0) || 1;
  return hits
    .map((h) => ({ ...byId.get(h.id), score: h.score, coverage: q.filter((t) => toks.get(h.id)?.has(t)).reduce((a, t) => a + idf[t], 0) / total }))
    .filter((h) => h.coverage >= minCoverage);
}

/** Very light stemmer used only for the coverage check (Arabic verb/plural affixes, English -ing/-ed). */
export function stem(w) {
  let s = String(w);
  if (/^[\u0600-\u06FF]+$/.test(s)) {
    if (s.length > 4) s = s.replace(/^(وال|بال|فال|كال|لل|ال)/, '');
    if (s.length > 4) s = s.replace(/^[وف]/, '');
    if (s.length > 4) s = s.replace(/(ون|ين|ات|ان|ها|هم|كم|نا)$/, '');
    if (s.length > 3) s = s.replace(/^[يتنا](?=\S{3,})/, '');
    if (s.length > 3) s = s.replace(/[هي]$/, '');
    return s;
  }
  if (s.length > 5) s = s.replace(/(ing|ed|es)$/, '');
  return s;
}

// ------------------------------------------------------------------ input guards
const INJECTION = [
  /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(instructions?|prompts?|system)\b/i,
  /\b(system\s+prompt|developer\s+mode|jailbreak|you\s+are\s+now|act\s+as\s+(a|an)?\s*(mufti|dan)|pretend\s+(to\s+be|you\s+are))\b/i,
  /\breveal\b[^.]{0,30}\b(prompt|instructions|passages)\b/i,
  /(تجاهل|انس|انسَ|تخط|تجاوز)[^.]{0,30}(التعليمات|الأوامر|التوجيهات|موجه)/,
  /(أنت\s+الآن\s+(مفت|شيخ|عالم)|موجه\s+النظام|برومبت)/,
  /\bfrom\s+now\s+on\b/i,
  /\b(rules|instructions)\s+(above|before)\b/i,
  /(أنت|انت)\s+(الآن\s+|الان\s+)?(مفت|مفتي|شيخ|عالم)|مفتي\s+(الآن|الان)/,
  /(أفتني|افتني|أعطني\s+فتوى|اعطني\s+فتوى|أصدر\s+فتوى|اصدر\s+فتوى)/,
  /(انس|انسَ|تجاهل)[^.]{0,30}(ما\s+قيل|ما\s+سبق|القواعد|القيود)/
];

// Judging named people or groups (takfir, tabdi') is outside the reference package's scope: a fixed reply, no model.
const JUDGE_PEOPLE = [
  // the label is the predicate at the end of the question: «هل الشيعة كفار؟», «هل فلان مبتدع»
  /(^|\s)هل\s+[^؟?]{1,50}\s(كافر|كافرة|كفار|كفرة|مبتدع|مبتدعة|مبتدعه|مبتدعون|ضال|ضالون|زنديق|فاسق|منافق|مرتد|مشرك|مشركون)\s*[؟?!.]*\s*$/,
  /\b(is|are|was|were)\b[^?]{1,50}\b(an?\s+)?(kafirs?|kuffar|kaffirs?|disbelievers?|infidels?|deviants?|heretics?|apostates?|hypocrites?|mushriks?|innovators?)\s*[?!.]*\s*$/i,
  /(تكفير|كفّر|كفر)\s+(فلان|الشيخ|العالم|الطائفة|الجماعة|الحزب|الشيعة|السنة|الصوفية|الأشاعرة)/
];
// A ruling question that merely mentions a group («ما حكم الصلاة خلف الفاسق؟», "Is it allowed to greet disbelievers?")
// is ordinary fiqh, not a judgement on people.
const FIQH_VOCAB = /(يجوز|يحل|يحرم|حكم|حرام|حلال|جائز|خلف|تهنئة|تهنئه|ذبيحة|ذبيحه|زواج|اكل|أكل|معاملة|التعامل|السلام\s+على)|\b(allowed|okay|ok|permissible|halal|haram|permitted|sinful|should|can|may|it)\b/i;
/** True when the question asks to judge a person or a group (kufr, bid'ah, nifaq…). */
export function judgesPeople(q) {
  const s = String(q ?? '').trim();
  if (FIQH_VOCAB.test(s)) return false;
  return JUDGE_PEOPLE.some((re) => re.test(s));
}

// "Give me a hadith / verse that proves X": the model must never produce evidence on demand. The panel answers with a
// fixed line and links only the verified evidence already on the ruling cards (high-coverage hits).
const EVIDENCE_REQUEST = [
  /\b(give|show|send|tell|quote|find)\s+me\s+(a\s+|an\s+|the\s+|some\s+)?(hadith|hadeeth|verse|ayah|ayat|evidence|proof|daleel|dalil)s?\b/i,
  /\b(hadith|verse|ayah)\s+(that|which)\s+(proves?|says?|shows?)\b/i,
  /(أعطني|اعطني|هات|اذكر\s+لي|اكتب\s+لي|أريد|اريد|أعطنا|اعطنا|ألّف|الف)\s+(حديث|حديثا|حديثاً|آية|اية|دليل|دليلا|دليلاً)/,
  /\b(write|make\s+up|compose)\s+(me\s+)?(a\s+)?(hadith|verse|ayah)\b/i,
  /(حديث|آية|اية|دليل)\s+(يثبت|يدل\s+على|يبين|يقول)/
];
/** True when the question asks the assistant to produce a verse/hadith/proof. */
export function asksForEvidence(q) {
  const s = String(q ?? '');
  return EVIDENCE_REQUEST.some((re) => re.test(s));
}
/** True when the text looks like an attempt to steer the assistant instead of a question. */
export function looksLikeInjection(q) {
  const s = String(q ?? '');
  return INJECTION.some((re) => re.test(s));
}

/**
 * Decide what to do before any model call.
 * -> { route: 'empty'|'personal'|'judge'|'injection'|'evidence'|'uncovered'|'model', question, hits }
 */
export function routeQuestion(question, passages, k = GUIDE_TOP_K) {
  const q = String(question ?? '').trim().slice(0, ASK_MAX);
  if (!q) return { route: 'empty', question: q, hits: [] };
  if (isPersonalFatwa(q)) return { route: 'personal', question: q, hits: retrieveGuide(q, passages, 3) };
  if (judgesPeople(q)) return { route: 'judge', question: q, hits: [] };
  if (looksLikeInjection(q)) return { route: 'injection', question: q, hits: [] };
  if (asksForEvidence(q)) return { route: 'evidence', question: q, hits: retrieveGuide(q, passages, 3) };
  const hits = retrieveGuide(q, passages, k);
  if (!hits.length) return { route: 'uncovered', question: q, hits };
  return { route: 'model', question: q, hits };
}

/** Passages good enough to show verbatim when no model is available (best-first), or [] when none is close. */
export function fallbackPassages(hits, n = 3, min = FALLBACK_COVERAGE) {
  return (hits || []).filter((h) => h.coverage >= min).slice(0, n);
}

// ------------------------------------------------------------------ wire format
const enc = (s) => (typeof TextEncoder === 'function' ? new TextEncoder().encode(s).length : Buffer.byteLength(s));
export const byteLength = enc;

/**
 * Request body for /.netlify/functions/guide, shortened until it fits WIRE_MAX_BYTES:
 * passages are cut to PASSAGE_MAX chars, then the lowest-ranked are dropped, then the rest are shortened.
 * `lang` is the conversation language (any speechLangs.js code); `pivot` the English rendering of the question
 * (es/zh/hi … conversations), sent so the server can run its filters on it too.
 */
export function wireBody(question, lang, hits, maxBytes = WIRE_MAX_BYTES, pivot = '') {
  let passages = hits.map((p) => ({ id: p.id, text: String(p.text).slice(0, PASSAGE_MAX) }));
  const extra = pivot ? { pivot: String(pivot).slice(0, 600) } : {};
  const body = () => ({ lang: normalizeLang(lang, 'en'), question: String(question).slice(0, ASK_MAX), ...extra, passages });
  while (passages.length > 1 && enc(JSON.stringify(body())) > maxBytes) passages = passages.slice(0, -1);
  let cap = PASSAGE_MAX;
  while (enc(JSON.stringify(body())) > maxBytes && cap > 120) {
    cap = Math.floor(cap * 0.8);
    passages = passages.map((p) => ({ ...p, text: p.text.slice(0, cap) }));
  }
  return body();
}

// ------------------------------------------------------------------ answer validation
/**
 * raw = { answer, used_ids, refer, abstain, off_topic } from the model (or the server's cleaned copy).
 * -> { kind: 'answer'|'off_topic'|'abstain', answer, used_ids, refer, reason }
 */
// aiCore's scripture filter is Arabic/English; the same "the Quran says / Allah says / the Prophet said / hadith
// number" patterns for the other conversation languages (es, zh, hi).
export const SCRIPTURE_I18N = [
  [/\b(el\s+)?(al)?cor[aá]n\s+(dice|afirma|declara|ordena)\b/i, 'es: the Quran says'],
  [/\b(al[aá]|dios)\s+(dice|dijo|afirma)\b/i, 'es: Allah says'],
  [/\b(el\s+)?(profeta|mensajero\s+de\s+(al[aá]|dios))\b[^.]{0,40}\b(dijo|dice)\b/i, 'es: the Prophet said'],
  [/\b(sahih\s+)?(bujari|bukhari|muslim)\s*(#|n[º°o]\.?|n[uú]mero)?\s*\d{2,}/i, 'hadith reference number'],
  [/古兰经》?\s*(中)?(说|写道|记载|指出)/, 'zh: the Quran says'],
  [/(安拉|真主)\s*(说|说道|曾说)/, 'zh: Allah says'],
  [/(先知|使者|穆罕默德)[^。！？]{0,20}(说|说过|曾说)/, 'zh: the Prophet said'],
  [/(क़ुरान|कुरान|क़ुरआन|कुरआन)\s*(में\s*)?(कहता|कहती|कहा|लिखा)/, 'hi: the Quran says'],
  [/अल्लाह\s*(ने\s*)?(कहा|कहता|फ़रमाया|फरमाया)/, 'hi: Allah says'],
  [/(पैगंबर|पैग़ंबर|नबी|रसूल)[^।]{0,30}(ने\s*)?(कहा|फ़रमाया|फरमाया)/, 'hi: the Prophet said']
];

export function validateGuide(raw, retrievedIds, lang = 'en') {
  if (raw && typeof raw === 'object' && raw.off_topic === true) return { kind: 'off_topic', answer: null, used_ids: [], refer: false, reason: 'off topic' };
  const v = validateAnswer(raw, retrievedIds, lang);
  if (v.abstain) return { kind: 'abstain', answer: null, used_ids: [], refer: true, reason: v.reason };
  const hit = SCRIPTURE_I18N.find(([re]) => re.test(v.answer));
  if (hit) return { kind: 'abstain', answer: null, used_ids: [], refer: true, reason: `scripture/citation: ${hit[1]}` };
  return { kind: 'answer', answer: v.answer, used_ids: v.used_ids, refer: v.refer, reason: null };
}

/** Source records (content/sources.json) behind a passage: by ruling `used_in`, or the Q&A item's source_ids. */
export function sourcesFor(passage, sources) {
  const list = Array.isArray(sources) ? sources : [];
  if (!passage) return [];
  if (passage.kind === 'qa') {
    const ids = new Set([...(passage.item?.source_ids || []), ...(passage.item?.correction?.source_id ? [passage.item.correction.source_id] : [])]);
    return list.filter((s) => s && ids.has(s.id));
  }
  return list.filter((s) => s && Array.isArray(s.used_in) && s.used_in.includes(passage.rulingId));
}

// ------------------------------------------------------------------ spoken choice matching
const NUMBERS = {
  1: ['1', '١', 'one', 'first', 'واحد', 'واحده', 'اول', 'الاول', 'الاولي', 'اولا'],
  2: ['2', '٢', 'two', 'second', 'اثنين', 'اثنان', 'اتنين', 'ثاني', 'الثاني', 'الثانيه', 'ثانيا'],
  3: ['3', '٣', 'three', 'third', 'ثلاثه', 'ثلاث', 'تلاته', 'ثالث', 'الثالث', 'الثالثه', 'ثالثا'],
  4: ['4', '٤', 'four', 'fourth', 'for', 'اربعه', 'اربع', 'رابع', 'الرابع', 'الرابعه', 'رابعا'],
  5: ['5', '٥', 'five', 'fifth', 'خمسه', 'خمس', 'خامس', 'الخامس', 'الخامسه']
};
const NUM_FILLER = new Set(['option', 'choice', 'number', 'answer', 'pick', 'choose', 'select', 'خيار', 'الخيار', 'رقم', 'اختار', 'اختر', 'اخترت', 'اختيار', 'الاختيار', 'the', 'no']);
const norm = (s) => tokenize(s).map(stem);

/**
 * Map a spoken transcript to one of the choice labels. Returns the index, or -1 when unsure.
 * Short utterances may name the option by number/ordinal ("two", "الخيار الثاني", "٢");
 * otherwise the label with the best token overlap wins if it is clearly ahead of the runner-up.
 */
export function matchChoice(transcript, labels) {
  const list = Array.isArray(labels) ? labels : [];
  if (!list.length) return -1;
  const raw = String(transcript ?? '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  const words = raw.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const rest = words.filter((w) => !NUM_FILLER.has(w));
  if (rest.length >= 1 && rest.length <= 2) {
    for (const [n, forms] of Object.entries(NUMBERS)) {
      if (rest.some((w) => forms.includes(w)) && Number(n) <= list.length) return Number(n) - 1;
    }
  }
  const said = new Set(norm(transcript));
  if (!said.size) return -1;
  const scores = list.map((label) => {
    const toks = [...new Set(norm(label))];
    if (!toks.length) return 0;
    const hit = toks.filter((t) => said.has(t) || [...said].some((s) => s.length >= 4 && t.length >= 4 && (s.startsWith(t) || t.startsWith(s)))).length;
    return hit / toks.length + hit * 0.01;
  });
  let best = -1, second = 0;
  scores.forEach((s, i) => { if (best < 0 || s > scores[best]) { if (best >= 0) second = Math.max(second, scores[best]); best = i; } else second = Math.max(second, s); });
  if (best < 0 || scores[best] < 0.34 || scores[best] - second < 0.12) return -1;
  return best;
}
