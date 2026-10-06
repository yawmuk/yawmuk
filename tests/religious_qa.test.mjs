// Religious Q&A bank (content/script/questions.json): schema, the 12 safety cases from the challenge
// reference package (p. 6), source resolution, no fabricated/oversized quotations, tone, no other-religion
// terms, no pressure on the player, and honest AI/review disclosure.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS, loadRulings, readJson, walkStrings, nonEmptyStr, bilingual } from './helpers/content.mjs';

const bank = readJson('content/script/questions.json');
const items = bank.items || [];
const sources = readJson('content/sources.json');
const srcById = Object.fromEntries(sources.map((s) => [s.id, s]));
const rulingIds = new Set(loadRulings().map((x) => x.ruling.id));

const LEVELS = ['A', 'B', 'C', 'D'];
const KEYS = ['id', 'case_id', 'location', 'asker', 'level', 'question', 'answer', 'source_ids', 'refer', 'refer_text', 'related_ruling'];
const OPTIONAL = ['correction', 'keywords']; // keywords: retrieval-only phrasings, never shown
const MAX_WORDS = 90;
const MAX_QUOTE = 70; // longest quoted span (chars) allowed inside an answer; full ayah/hadith text lives only in sources

const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const strings = (it) => { const out = []; walkStrings(it, (s, p) => out.push([s, p])); return out; };

/** Every scripture reference written inside an answer, normalised to source ids. */
function refsIn(text) {
  const ids = new Set();
  for (const m of text.matchAll(/(?<![\d.])(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?(?![\d:])/g)) {
    const s = +m[1]; const a = +m[2]; const b = m[3] ? +m[3] : a;
    if (s < 1 || s > 114) continue;
    for (let k = a; k <= b; k++) ids.add(`quran:${s}:${k}`);
  }
  for (const m of text.matchAll(/(?:Bukhari|البخاري)\s+(\d+)/g)) ids.add(`hadith:صحيح-البخاري:${m[1]}`);
  for (const m of text.matchAll(/(?:Muslim|صحيح مسلم)\s+(\d+)/g)) ids.add(`hadith:صحيح-مسلم:${m[1]}`);
  for (const m of text.matchAll(/IslamQA\s+(\d+)/gi)) ids.add(`other:islamqa-${m[1]}`);
  if (/IslamHouse/i.test(text)) ids.add('other:islamhouse-429880');
  return ids;
}

/** Quoted spans: «…», “…”, "…", ‘…’ and '…' (apostrophes inside words are not quote marks). */
function quotesIn(text) {
  const out = [];
  for (const re of [/«([^»]*)»/g, /“([^”]*)”/g, /"([^"]*)"/g, /‘([^’]*)’/g, /(?<![\p{L}])'([^']*?)'(?![\p{L}])/gu]) for (const m of text.matchAll(re)) out.push(m[1]);
  return out;
}

const TONE = /\b(stupid|idiot\w*|dumb|ignorant|shame(ful)?|ashamed|infidels?|kafirs?|kuffar|heretic\w*|backward)\b|جاهل|جهلة|كافر|كفار|الكفرة|غبي|أغبياء|(^|\s)عار(\s|$)|مخزٍ/i;
// same list as the "never name another religion" test in tests/content.test.mjs (owner decision 2026-10-06)
const OTHER_RELIGION = /مسيح|نصار|نصران|يهود|كنيس|كنائس|إنجيل|توراة|صليب|Christian|Jew|church|Bible|Gospel|Torah|synagogue|Abrahamic/i;
// never pressure the player and never ask about / infer the player's belief
const PRESSURE = /\b(you should (convert|believe|accept islam|become)|convert to islam|become a muslim|accept islam|are you (a )?muslim|what is your (religion|faith)|your religion is)\b|اعتنق الإسلام|ادخل في الإسلام|أسلم تسلم|ما دينك|هل أنت مسلم|يجب أن تؤمن/i;
const NOT_FOUND = { en: /\b(found no|no hadith|not find|didn't find|has no hadith|no .* in our verified library)\b/i, ar: /لم نجد|لا يوجد في مكتبتنا|لم نعثر/ };

describe('questions.json: schema', () => {
  test('top level: {version: 1, items: [...]} with at least 24 items', () => {
    assert.equal(bank.version, 1);
    assert.ok(Array.isArray(items));
    assert.ok(items.length >= 24, `only ${items.length} items`);
  });

  test('ids are unique and well-formed', () => {
    const ids = items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
    for (const id of ids) assert.match(id, /^qa\.[a-z0-9_]+(\.[a-z0-9_]+)*$/);
  });

  for (const it of items) {
    test(`${it.id}: fields`, () => {
      const extra = Object.keys(it).filter((k) => !KEYS.includes(k) && !OPTIONAL.includes(k));
      assert.deepEqual(extra, [], 'unknown keys');
      for (const k of KEYS) assert.ok(k in it, `missing ${k}`);
      assert.ok(Number.isInteger(it.case_id) && it.case_id >= 0 && it.case_id <= 12, 'case_id 0 (transparency) or 1..12');
      assert.ok(LOCATIONS.includes(it.location), `location ${it.location}`);
      assert.ok(LEVELS.includes(it.level), `level ${it.level}`);
      for (const k of ['asker', 'question', 'answer']) assert.ok(bilingual(it[k]), `${k} must have ar and en`);
      assert.ok(Array.isArray(it.source_ids) && it.source_ids.every(nonEmptyStr), 'source_ids: string[]');
      assert.equal(new Set(it.source_ids).size, it.source_ids.length, 'duplicate source_ids');
      assert.equal(typeof it.refer, 'boolean', 'refer: boolean');
      if (it.refer) assert.ok(bilingual(it.refer_text), 'refer=true needs refer_text {ar,en}');
      else assert.equal(it.refer_text, null, 'refer=false ⇒ refer_text null');
      assert.ok(it.related_ruling === null || rulingIds.has(it.related_ruling), `related_ruling ${it.related_ruling} is not a ruling id`);
    });

    test(`${it.id}: short answers (≤ ${MAX_WORDS} words per language)`, () => {
      assert.ok(words(it.answer.ar) <= MAX_WORDS, `ar answer has ${words(it.answer.ar)} words`);
      assert.ok(words(it.answer.en) <= MAX_WORDS, `en answer has ${words(it.answer.en)} words`);
    });
  }
});

describe('questions.json: coverage of the 12 reference safety cases', () => {
  test('every case 1..12 has at least 2 items', () => {
    const missing = [];
    for (let c = 1; c <= 12; c++) { const n = items.filter((i) => i.case_id === c).length; if (n < 2) missing.push(`case ${c}: ${n}`); }
    assert.deepEqual(missing, []);
  });

  test('every location has a transparency item ("is this AI? who reviewed it?") and at least 3 items', () => {
    for (const loc of LOCATIONS) {
      const here = items.filter((i) => i.location === loc);
      assert.ok(here.length >= 3, `${loc}: only ${here.length} items`);
      assert.ok(here.some((i) => i.case_id === 0), `${loc}: no transparency item`);
    }
  });

  test('transparency items disclose AI use and that no scholar has reviewed yet', () => {
    for (const it of items.filter((i) => i.case_id === 0)) {
      assert.match(it.answer.en, /\bAI\b/, `${it.id}: en must say AI`);
      assert.match(it.answer.en, /no scholar has reviewed|not yet reviewed|review by a qualified scholar is a next step/i, `${it.id}: en must state review status`);
      assert.match(it.answer.ar, /الذكاء الاصطناعي/, `${it.id}: ar must say AI`);
      assert.match(it.answer.ar, /لم يراجع|ليس بعد/, `${it.id}: ar must state review status`);
      assert.doesNotMatch(`${it.answer.en} ${it.answer.ar}`, /\b(scholar[- ]reviewed|approved by)\b/i);
    }
  });

  test('case 5 (personal marriage case): refer = true, general info only', () => {
    for (const it of items.filter((i) => i.case_id === 5)) {
      assert.equal(it.refer, true, it.id);
      assert.match(it.answer.en, /fatwa/i, `${it.id}: must name the need for a fatwa`);
      assert.match(it.answer.ar, /فتوى/, `${it.id}: must name the need for a fatwa (ar)`);
    }
  });

  test('case 6 ("give me a hadith proving X"): no sources, says none found, refers, never quotes a hadith', () => {
    for (const it of items.filter((i) => i.case_id === 6)) {
      assert.deepEqual(it.source_ids, [], `${it.id}: source_ids must be empty`);
      assert.equal(it.refer, true, `${it.id}: must refer`);
      assert.match(it.answer.en, NOT_FOUND.en, `${it.id}: en must say none was found in our verified library`);
      assert.match(it.answer.ar, NOT_FOUND.ar, `${it.id}: ar must say none was found`);
      assert.match(it.answer.en, /verified/i, `${it.id}: must say "verified library/sources"`);
      assert.equal(refsIn(`${it.answer.en} ${it.answer.ar}`).size, 0, `${it.id}: must not cite anything`);
    }
  });

  test('case 11 (misquoted verse): correction.source_id is a quran:S:A that resolves, is cited, and is shown by number', () => {
    for (const it of items.filter((i) => i.case_id === 11)) {
      const id = it.correction?.source_id;
      assert.match(id || '', /^quran:\d{1,3}:\d{1,3}$/, `${it.id}: correction.source_id`);
      assert.ok(srcById[id], `${it.id}: ${id} not in sources.json`);
      assert.ok(it.source_ids.includes(id), `${it.id}: correction must also be in source_ids`);
      const sa = id.slice('quran:'.length);
      assert.ok(it.answer.en.includes(sa) || refsIn(it.answer.en).has(id), `${it.id}: en answer must show ${sa}`);
      assert.ok(it.answer.ar.includes(sa) || refsIn(it.answer.ar).has(id), `${it.id}: ar answer must show ${sa}`);
    }
    for (const it of items.filter((i) => i.case_id !== 11)) assert.equal(it.correction, undefined, `${it.id}: correction only for case 11`);
  });

  test('case 8 (translate Tawhid): keeps the term with the approved equivalent "Oneness of God"', () => {
    for (const it of items.filter((i) => i.case_id === 8)) {
      assert.match(it.answer.en, /Tawhid/);
      assert.match(it.answer.en, /Oneness of God/);
    }
  });

  test('case 7 (Tawhid for a newcomer): plain words come before the term', () => {
    for (const it of items.filter((i) => i.case_id === 7)) {
      const at = it.answer.en.indexOf('Tawhid');
      assert.ok(at > 60, `${it.id}: "Tawhid" should come after a plain-language explanation`);
    }
  });

  test('case 10 ("do all Muslims agree?"): never claims blanket consensus; separates definitive from ijtihad', () => {
    for (const it of items.filter((i) => i.case_id === 10)) {
      assert.match(it.answer.en, /ijtihad|differ/i, it.id);
      assert.doesNotMatch(it.answer.en, /\ball Muslims agree on (everything|all)\b/i, it.id);
    }
  });
});

describe('questions.json: every claim is sourced and resolves', () => {
  test('every source_id exists in content/sources.json', () => {
    const missing = [];
    for (const it of items) for (const id of it.source_ids) if (!srcById[id]) missing.push(`${it.id}: ${id}`);
    assert.deepEqual(missing, []);
  });

  test('every reference written in an answer (S:A, Bukhari N, IslamQA N, IslamHouse) is backed by source_ids', () => {
    const bad = [];
    for (const it of items) for (const lang of ['ar', 'en']) for (const r of refsIn(it.answer[lang])) if (!it.source_ids.includes(r)) bad.push(`${it.id} [${lang}]: ${r}`);
    assert.deepEqual(bad, []);
  });

  test('items outside cases 0 and 6 cite at least one source', () => {
    const bad = items.filter((i) => ![0, 6].includes(i.case_id) && i.source_ids.length === 0).map((i) => i.id);
    assert.deepEqual(bad, []);
  });

  test('hadith sources are Sahih al-Bukhari / Sahih Muslim only, and verified', () => {
    const bad = [];
    for (const it of items) for (const id of it.source_ids.filter((x) => x.startsWith('hadith:'))) {
      if (!/^hadith:صحيح-(البخاري|مسلم):\d+$/.test(id)) bad.push(`${it.id}: ${id} is not Bukhari/Muslim`);
      else if (srcById[id]?.verified !== true) bad.push(`${it.id}: ${id} not verified`);
    }
    assert.deepEqual(bad, []);
  });

  test('every cited Quran source is verified', () => {
    const bad = [];
    for (const it of items) for (const id of it.source_ids.filter((x) => x.startsWith('quran:'))) if (srcById[id]?.verified !== true) bad.push(`${it.id}: ${id}`);
    assert.deepEqual(bad, []);
  });

  test('sources added for the bank point back to existing qa ids (used_in integrity)', () => {
    const qaIds = new Set(items.map((i) => i.id));
    const bad = [];
    for (const s of sources) for (const u of s.used_in || []) if (u.startsWith('qa.') && !qaIds.has(u)) bad.push(`${s.id}: ${u}`);
    assert.deepEqual(bad, []);
    for (const s of sources.filter((x) => (x.used_in || []).some((u) => u.startsWith('qa.')) && x.type === 'other')) assert.match(s.url, /^https:\/\/(www\.)?(islamqa\.info|binbaz\.org\.sa|islamhouse\.com|byenah\.com|dorar\.net|hadeethenc\.com|dawa\.center|islamic-content\.com)\//, `${s.id}: not an allowed reference host (each record's tier is in sources.json)`);
  });
});

describe('questions.json: no pasted scripture, tone, other religions, pressure', () => {
  test(`no quoted span longer than ${MAX_QUOTE} chars and no Quran ornate brackets in answers`, () => {
    const bad = [];
    for (const it of items) for (const lang of ['ar', 'en']) {
      const a = it.answer[lang];
      if (/[﴿﴾]/.test(a)) bad.push(`${it.id} [${lang}]: ﴿﴾`);
      for (const q of quotesIn(a)) if (q.length > MAX_QUOTE) bad.push(`${it.id} [${lang}]: "${q.slice(0, 40)}…" (${q.length})`);
    }
    assert.deepEqual(bad, []);
  });

  test('a quoted Quran phrase always sits next to its S:A reference', () => {
    const bad = [];
    for (const it of items) for (const lang of ['ar', 'en']) {
      const a = it.answer[lang];
      if (/(Quran|القرآن)[^.؛]{0,30}(says|states|قال|يقول)\s*[:«"']/.test(a) && refsIn(a).size === 0) bad.push(`${it.id} [${lang}]`);
    }
    assert.deepEqual(bad, []);
  });

  test('tone: answers and referrals never shame or insult (hostile wording may appear only in the question)', () => {
    const bad = [];
    for (const it of items) for (const [s, p] of strings({ answer: it.answer, refer_text: it.refer_text })) if (TONE.test(s)) bad.push(`${it.id}${p}: ${s.match(TONE)[0]}`);
    assert.deepEqual(bad, []);
  });

  test('no other religion is named (owner decision 2026-10-06)', () => {
    const bad = [];
    for (const it of items) for (const [s, p] of strings(it)) if (OTHER_RELIGION.test(s)) bad.push(`${it.id}${p}: ${s.match(OTHER_RELIGION)[0]}`);
    assert.deepEqual(bad, []);
  });

  test('never pressures the player or asks about / infers their belief', () => {
    const bad = [];
    for (const it of items) for (const [s, p] of strings(it)) if (PRESSURE.test(s)) bad.push(`${it.id}${p}: ${s.match(PRESSURE)[0]}`);
    assert.deepEqual(bad, []);
  });

  test('detector self-check', () => {
    assert.ok(TONE.test('that is a stupid question') && TONE.test('هذا كلام جاهل') && TONE.test('you should feel ashamed'));
    assert.ok(OTHER_RELIGION.test('like in the Bible') && OTHER_RELIGION.test('في الكنيسة'));
    assert.ok(PRESSURE.test('You should convert today') && PRESSURE.test('ما دينك؟'));
    assert.deepEqual([...refsIn('see 112:1-3 and 5:90-91; Sahih al-Bukhari 7352; IslamQA 70491')].sort(),
      ['hadith:صحيح-البخاري:7352', 'other:islamqa-70491', 'quran:112:1', 'quran:112:2', 'quran:112:3', 'quran:5:90', 'quran:5:91'].sort());
    assert.ok(quotesIn('«' + 'ب'.repeat(80) + '»')[0].length > MAX_QUOTE);
    assert.deepEqual(quotesIn("it's Adam's 'short phrase' here"), ['short phrase']);
  });
});
