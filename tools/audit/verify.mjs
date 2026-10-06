#!/usr/bin/env node
// «يومك» — Automated verification of Qur'an & hadith texts in content/rulings/*.json,
// plus a guard that no Bible/Torah/Gospel text or reference appears anywhere (decision 2026-10-06).
//
// Usage:   node tools/audit/verify.mjs [--json] [--no-cache] [--quiet]
// Exit:    0 = all checks passed, 1 = at least one FAIL, 2 = network/setup error
//
// Qur'an:  every quran[] entry is re-fetched from quranenc.com (King Fahd Glorious Qur'an Printing Complex —
//          the source required by the hackathon's scientific reference package):
//          https://quranenc.com/api/v1/translation/aya/english_saheeh/{sura}/{aya} returns the Madinah-Mushaf
//          Uthmani text (arabic_text) and the Complex-reviewed Saheeh International translation.
//          text_ar must equal arabic_text EXACTLY (NFC; only surrounding whitespace trimmed) = FAIL otherwise.
//          translation_en must equal the english_saheeh translation with footnote markers "[n]" removed
//          (punctuation/diacritics-insensitive) = FAIL otherwise. source_url must be quranenc.com/…/english_saheeh/{sura}#{aya}.
//          Cross-check: the letters (skeleton, no marks) are compared with Tanzil quran-uthmani (api.alquran.cloud);
//          a mismatch there is a FAIL too (two independent copies of the Mushaf must agree on every letter).
// Hadith:  six books are checked against fawazahmed0/hadith-api (jsDelivr; same Arabic text as sunnah.com).
//          - the number must exist in the stated book (Muslim uses the Fuad Abd al-Baqi number)
//          - text_ar (split on "…"/"...") must be found inside that hadith's text. Two levels:
//            DIACRITIZED (exact incl. harakat) and SKELETON (letters only). Either miss = FAIL
//            (the message tells which level failed).
//          - if the grade/grader string cites al-Albani, his grade in hadith-api must appear in it (FAIL otherwise)
//          - Bukhari/Muslim entries must be graded صحيح
//          - sunnah.com link (sunnah_url, or source_url) must point to the same book/number
//          - EVERY shown hadith (any book): grade must be صحيح/حسن (+ variants such as «حسن صحيح», «صحيح لغيره»),
//            with no ضعيف/منكر/موضوع/مختلف/«رجاله…» wording, and a non-empty grader. Hadith outside the Sahihayn
//            must carry dorar_url (https://dorar.net/h/…) + dorar_ref (the dorar record: المحدث/المصدر/الرقم/الحكم).
//          - hadeethenc_url (if present) is re-fetched from the HadeethEnc API: its grade must be صحيح/حسن.
//          Hadiths outside the six books cannot be checked automatically: they PASS only if listed in
//          tools/audit/manual_verifications.json with how they were verified by hand; otherwise FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const RULINGS_DIR = process.env.YAWMAK_RULINGS_DIR || path.join(ROOT, 'content', 'rulings');
const CACHE_DIR = path.join(HERE, '.cache');
const MANUAL = path.join(HERE, 'manual_verifications.json');
const args = new Set(process.argv.slice(2));
const USE_CACHE = !args.has('--no-cache');
const QUIET = args.has('--quiet');

const BOOKS = {
  'صحيح البخاري': 'bukhari', 'صحيح مسلم': 'muslim', 'سنن أبي داود': 'abudawud',
  'جامع الترمذي': 'tirmidhi', 'سنن الترمذي': 'tirmidhi', 'سنن النسائي': 'nasai', 'سنن ابن ماجه': 'ibnmajah',
};
const SUNNAH_SLUG = { bukhari: 'bukhari', muslim: 'muslim', abudawud: 'abudawud', tirmidhi: 'tirmidhi', nasai: 'nasai', ibnmajah: 'ibnmajah' };

// ---------- helpers ----------
async function fetchText(url, tries = 6) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'yawmak-audit/1.0' } });
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} for ${url}`), { status: r.status });
      return await r.text();
    } catch (e) { last = e; await new Promise(res => setTimeout(res, (e.status === 429 ? 8000 : 800) * (i + 1))); }
  }
  throw last;
}
async function cachedJSON(key, url) {
  const f = path.join(CACHE_DIR, key.replace(/[^a-z0-9._-]/gi, '_'));
  if (USE_CACHE && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const txt = await fetchText(url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(f, txt);
  return JSON.parse(txt);
}

const HARAKAT = /[ً-ٰٟۖ-ۭ࣓-ࣿ]/g;
const QURAN_MARKS = /[ـۖ-ۜ۞ۢۥۦ۩۪-ۭ]/g; // tatweel, waqf signs, small meem/waw/yeh, sajda/hizb marks
const PUNCT = /[‌-‏‪-‮؟،؛۔"'«»“”‘’().,:;!?\-–—\[\]{} *_]/g;

function nfc(s) { return (s || '').normalize('NFC'); }
function normQuranOrtho(s) { return nfc(s).replace(QURAN_MARKS, '').replace(/\s+/g, ' ').trim(); }
function normDiacritized(s) {
  return nfc(s).replace(/ـ/g, '').replace(PUNCT, ' ').replace(/\s+/g, ' ').trim();
}
function normSkeleton(s) {
  return nfc(s).replace(HARAKAT, '').replace(/ـ/g, '').replace(PUNCT, ' ')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/صلى الله عليه وسلم|صلي الله عليه وسلم|ﷺ/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function normEn(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function segments(text) {
  return nfc(text).split(/\.\.\.|…|\s\.\s\.\s\./).map(s => s.trim()).filter(s => normSkeleton(s).length >= 6);
}
function firstDiff(a, b) {
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return { at: i, ours: a.slice(Math.max(0, i - 8), i + 12), theirs: b.slice(Math.max(0, i - 8), i + 12) };
}
const ALBANI_MAP = {
  'sahih': ['صحيح'], 'hasan': ['حسن'], 'hasan sahih': ['حسن صحيح'], 'daif': ['ضعيف'],
  'sahih lighairihi': ['صحيح لغيره', 'صحيح بشواهده', 'صحيح'], 'hasan lighairihi': ['حسن لغيره'],
  'daif jiddan': ['ضعيف جدا', 'ضعيف جداً'], 'munkar': ['منكر'], 'mawdu': ['موضوع'],
  'sahih in chain': ['صحيح الإسناد', 'صحيح'], 'hasan in chain': ['حسن الإسناد', 'حسن'],
};

// ---------- load ----------
const results = []; // {level: PASS|WARN|FAIL, kind, ruling, ref, msg}
const add = (level, kind, ruling, ref, msg) => results.push({ level, kind, ruling, ref, msg });

const files = fs.readdirSync(RULINGS_DIR).filter(f => f.endsWith('.json')).sort();
const rulings = [];
for (const f of files) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(RULINGS_DIR, f), 'utf8')); }
  catch (e) { add('FAIL', 'json', f, '-', `invalid JSON: ${e.message}`); continue; }
  for (const r of arr) rulings.push({ file: f, r });
}
const manual = fs.existsSync(MANUAL) ? JSON.parse(fs.readFileSync(MANUAL, 'utf8')) : [];

// ---------- Qur'an ----------
const QURANENC_URL = (s, a) => `https://quranenc.com/en/browse/english_saheeh/${s}#${a}`;
const stripFootnotes = t => (t || '').replace(/\[\d+\]/g, '').replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
async function checkQuran() {
  const keys = new Map();
  for (const { r } of rulings) for (const q of r.quran || []) {
    const k = `${q.surah}:${q.ayah}`;
    if (!keys.has(k)) keys.set(k, []);
    keys.get(k).push({ id: r.id, q });
  }
  for (const [k, uses] of keys) {
    const [sura, aya] = k.split(':');
    let qe, tz;
    try {
      qe = await cachedJSON(`qe_${sura}_${aya}.json`, `https://quranenc.com/api/v1/translation/aya/english_saheeh/${sura}/${aya}`);
      tz = await cachedJSON(`tz_${k}.json`, `https://api.alquran.cloud/v1/ayah/${k}/quran-uthmani`);
    } catch (e) { for (const u of uses) add('FAIL', 'quran-net', u.id, k, `could not fetch: ${e.message}`); continue; }
    const qeText = nfc(qe.result?.arabic_text || '').trim();
    const qeTr = stripFootnotes(qe.result?.translation);
    const tzText = tz.data?.text || '';
    const tzSurahName = tz.data?.surah?.name || '';
    for (const { id, q } of uses) {
      const ours = nfc(q.text_ar).trim();
      if (!ours) { add('FAIL', 'quran-text', id, k, 'text_ar empty'); continue; }
      if (ours === qeText) add('PASS', 'quran-text', id, k, 'matches quranenc.com (King Fahd Complex Madinah Mushaf text) exactly');
      else {
        const d = firstDiff(ours, qeText);
        add('FAIL', 'quran-text', id, k, `text differs from quranenc.com at char ${d.at}: ours «${d.ours}» vs «${d.theirs}»`);
      }
      // Tanzil spells hamza+alif «ءا» where the Madinah Mushaf has «آ», and api.alquran.cloud prefixes the basmala to ayah 1.
      const crossSk = t => normSkeleton(t).replace(/ءا/g, 'ا').replace(/^بسم الله الرحمن الرحيم /, '');
      if (crossSk(ours) === crossSk(tzText)) add('PASS', 'quran-crosscheck', id, k, 'letters match Tanzil quran-uthmani');
      else add('FAIL', 'quran-crosscheck', id, k, 'letters differ from Tanzil quran-uthmani');
      if (q.source_url !== QURANENC_URL(q.surah, q.ayah))
        add('FAIL', 'quran-url', id, k, `source_url ${q.source_url} must be ${QURANENC_URL(q.surah, q.ayah)}`);
      if (q.surah_name_ar && normSkeleton(tzSurahName).replace(/^سورة\s*/, '') !== normSkeleton(q.surah_name_ar).replace(/^سورة\s*/, ''))
        add('FAIL', 'quran-surah-name', id, k, `surah_name_ar «${q.surah_name_ar}» vs «${tzSurahName}»`);
      if (q.translation_en) {
        if (normEn(q.translation_en) !== normEn(qeTr))
          add('FAIL', 'quran-translation', id, k, `translation_en differs from quranenc english_saheeh:\n      ours:     ${q.translation_en}\n      quranenc: ${qeTr}`);
        else add('PASS', 'quran-translation', id, k, 'Saheeh International as published by quranenc.com (King Fahd Complex)');
      } else add('WARN', 'quran-translation', id, k, 'translation_en empty');
    }
  }
}

// ---------- Hadith ----------
const editions = {};
async function edition(book) {
  if (!editions[book]) {
    const ara = await cachedJSON(`ara-${book}.json`, `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${book}.min.json`);
    editions[book] = ara.hadiths;
  }
  return editions[book];
}
function parseNumber(n) { const m = String(n || '').match(/\d+/); return m ? Number(m[0]) : NaN; }

// Grade whitelist (hackathon reference package: no hadith without an approved source and a صحيح/حسن grade).
const GRADE_OK = /^(صحيح|حسن)( صحيح| لغيره| بشواهده| الإسناد| بطرقه)*$/;
const GRADE_BAD = /ضعيف|منكر|موضوع|مختلف|رجاله|شاذ|معلول|مرسل|لا يصح|لم يصح/;
const SAHIHAYN = c => /^صحيح (البخاري|مسلم)/.test((c || '').trim());
async function checkHadithMeta(r, h, ref) {
  const g = (h.grade || '').trim();
  if (!GRADE_OK.test(g) || GRADE_BAD.test(g)) add('FAIL', 'hadith-grade-whitelist', r.id, ref, `grade «${g}» is not in the صحيح/حسن whitelist — move the hadith to notes_for_reviewer`);
  else add('PASS', 'hadith-grade-whitelist', r.id, ref, `grade «${g}»`);
  if (!(h.grader || '').trim()) add('FAIL', 'hadith-grader', r.id, ref, 'grader empty');
  if (!SAHIHAYN(h.collection)) {
    if (!/^https:\/\/dorar\.net\/h\/[A-Za-z0-9]+$/.test(h.dorar_url || '')) add('FAIL', 'hadith-dorar', r.id, ref, `outside the Sahihayn: dorar_url (https://dorar.net/h/…) required, got «${h.dorar_url || ''}»`);
    else if (!/المحدث: .+ \| المصدر: .+ \| الرقم: .+ \| خلاصة حكم المحدث: .+/.test(h.dorar_ref || '')) add('FAIL', 'hadith-dorar', r.id, ref, 'dorar_ref must record المحدث | المصدر | الرقم | خلاصة حكم المحدث');
    else if (!(h.grader || '').includes((h.dorar_ref.match(/المحدث: ([^|]+?) \|/) || [])[1])) add('FAIL', 'hadith-dorar', r.id, ref, 'grader does not name the muhaddith of the dorar record');
    else add('PASS', 'hadith-dorar', r.id, ref, `dorar record: ${h.dorar_ref} (${h.dorar_url}) — dorar.net blocks automated clients, so the record is checked structurally; open the link to see it`);
  }
  if (h.hadeethenc_url) {
    const id = (h.hadeethenc_url.match(/^https:\/\/hadeethenc\.com\/(ar|en)\/browse\/hadith\/(\d+)$/) || [])[2];
    if (!id) { add('FAIL', 'hadith-hadeethenc', r.id, ref, `bad hadeethenc_url ${h.hadeethenc_url}`); return; }
    try {
      const he = await cachedJSON(`he_ar_${id}.json`, `https://hadeethenc.com/api/v1/hadeeths/one/?language=ar&id=${id}`);
      const heSk = normSkeleton(he.hadeeth || '');
      const words = normSkeleton(h.text_ar).split(' ').filter(w => w.length > 2);
      const overlap = words.filter(w => heSk.includes(w)).length / Math.max(1, words.length);
      if (!/^(صحيح|حسن)/.test(he.grade || '')) add('FAIL', 'hadith-hadeethenc', r.id, ref, `HadeethEnc #${id} grade «${he.grade}»`);
      else if (overlap < 0.6) add('FAIL', 'hadith-hadeethenc', r.id, ref, `HadeethEnc #${id} text does not match (word overlap ${Math.round(overlap * 100)}%)`);
      else add('PASS', 'hadith-hadeethenc', r.id, ref, `HadeethEnc #${id}: ${he.grade} — ${he.attribution} (word overlap ${Math.round(overlap * 100)}%)`);
    } catch (e) { add('FAIL', 'hadith-hadeethenc', r.id, ref, `could not fetch HadeethEnc #${id}: ${e.message}`); }
  }
}

async function checkHadith() {
  for (const { r } of rulings) for (const h of r.hadith || []) {
    const ref = `${h.collection} ${h.number}`;
    await checkHadithMeta(r, h, ref);
    const book = BOOKS[(h.collection || '').trim()];
    const text = h.text_ar || '';
    if (!text.trim()) { add('WARN', 'hadith-text', r.id, ref, 'text_ar empty (allowed only if explained in notes_for_reviewer)'); continue; }
    if (!book) {
      const m = manual.find(x => x.ruling === r.id && normSkeleton(text).includes(normSkeleton(x.text_fragment)));
      if (m) add('PASS', 'hadith-manual', r.id, ref, `outside six books — manually verified: ${m.verified_how}`);
      else add('FAIL', 'hadith-manual', r.id, ref, 'outside six books and not in manual_verifications.json');
      continue;
    }
    let hs;
    try { hs = await edition(book); } catch (e) { add('FAIL', 'hadith-net', r.id, ref, e.message); continue; }
    const num = parseNumber(h.number);
    const cands = book === 'muslim'
      ? hs.filter(x => Math.floor(parseFloat(x.arabicnumber)) === num)
      : hs.filter(x => Number(x.hadithnumber) === num);
    if (!cands.length) { add('FAIL', 'hadith-number', r.id, ref, `number ${num} not found in ${book}`); continue; }
    const segs = segments(text);
    let best = null;
    for (const c of cands) {
      const skel = normSkeleton(c.text), dia = normDiacritized(c.text);
      const skelOk = segs.every(s => skel.includes(normSkeleton(s)));
      const diaOk = segs.every(s => dia.includes(normDiacritized(s)));
      if (skelOk) { best = { c, diaOk }; if (diaOk) break; }
    }
    if (!best) {
      const missing = segs.find(s => !cands.some(c => normSkeleton(c.text).includes(normSkeleton(s))));
      add('FAIL', 'hadith-text', r.id, ref, `text not found in ${book} #${num}: «${(missing || '').slice(0, 80)}»`);
      continue;
    }
    add(best.diaOk ? 'PASS' : 'FAIL', 'hadith-text', r.id, ref,
      best.diaOk ? `matches ${book} #${best.c.arabicnumber ?? best.c.hadithnumber} (diacritized)` : `letters match ${book} #${num} but harakat differ`);
    // grade checks
    const gradeStr = `${h.grade || ''} ${h.grader || ''}`;
    if ((book === 'bukhari' || book === 'muslim') && !/صحيح/.test(h.grade || ''))
      add('FAIL', 'hadith-grade', r.id, ref, `a hadith in ${book} graded «${h.grade}»`);
    const alb = (best.c.grades || []).find(g => /albani/i.test(g.name));
    if (/الألباني/.test(gradeStr) && alb) {
      // only the grade attributed to al-Albani for THIS number is checked
      const want = ALBANI_MAP[alb.grade.toLowerCase().replace(/\bhadith\b/g, '').replace(/\s+/g, ' ').trim()] || [];
      const ok = want.some(w => gradeStr.includes(w));
      add(ok ? 'PASS' : 'FAIL', 'hadith-grade', r.id, ref, `al-Albani (hadith-api): ${alb.grade}; file: «${h.grade}» / «${(h.grader || '').slice(0, 120)}»`);
    } else if (best.c.grades?.length) {
      add('PASS', 'hadith-grade-info', r.id, ref, 'api grades: ' + best.c.grades.map(g => `${g.name}=${g.grade}`).join('; '));
    }
    // url consistency
    const urls = String(h.sunnah_url || h.source_url || '').split(/\s*;\s*/).filter(Boolean);
    const sun = urls.find(u => u.includes('sunnah.com/'));
    if (sun) {
      const m = sun.match(/sunnah\.com\/([a-z]+):(\d+)/);
      if (!m || m[1] !== SUNNAH_SLUG[book] || Number(m[2]) !== num)
        add('FAIL', 'hadith-url', r.id, ref, `first sunnah.com url ${sun} does not match ${book}:${num}`);
    } else if (!urls.length) add('FAIL', 'hadith-url', r.id, ref, 'source_url empty');
  }
}

// ---------- content/sources.json registry (also covers records cited only by the Q&A bank, used_in "qa.*") ----------
// quran records: text.ar must equal quranenc arabic_text exactly, text.en the english_saheeh translation, url the quranenc page.
// Sahihayn hadith records: text.ar (if given) must be found (letters) in that number of hadith-api's edition.
async function checkRegistry() {
  const SRC = path.join(ROOT, 'content', 'sources.json');
  if (!fs.existsSync(SRC)) return;
  for (const s of JSON.parse(fs.readFileSync(SRC, 'utf8'))) {
    if (s.type === 'quran') {
      const [, sura, aya] = s.id.split(':');
      let qe;
      try { qe = (await cachedJSON(`qe_${sura}_${aya}.json`, `https://quranenc.com/api/v1/translation/aya/english_saheeh/${sura}/${aya}`)).result; }
      catch (e) { add('FAIL', 'registry-quran', 'sources.json', s.id, `could not fetch: ${e.message}`); continue; }
      const bad = [];
      if (nfc(s.text?.ar || '').trim() !== nfc(qe.arabic_text).trim()) bad.push('text.ar differs from quranenc');
      if (s.text?.en && normEn(s.text.en) !== normEn(stripFootnotes(qe.translation))) bad.push('text.en differs from quranenc english_saheeh');
      if (s.url !== QURANENC_URL(sura, aya)) bad.push(`url must be ${QURANENC_URL(sura, aya)}`);
      add(bad.length ? 'FAIL' : 'PASS', 'registry-quran', 'sources.json', s.id, bad.join('; ') || 'matches quranenc.com (King Fahd Complex)');
    } else if (s.type === 'hadith' && /^hadith:صحيح-(البخاري|مسلم):\d+$/.test(s.id) && s.text?.ar) {
      const book = /البخاري/.test(s.id) ? 'bukhari' : 'muslim';
      const num = Number(s.id.split(':')[2]);
      let hs;
      try { hs = await edition(book); } catch (e) { add('FAIL', 'registry-hadith', 'sources.json', s.id, e.message); continue; }
      const cands = book === 'muslim' ? hs.filter(x => Math.floor(parseFloat(x.arabicnumber)) === num) : hs.filter(x => Number(x.hadithnumber) === num);
      const ok = cands.some(c => segments(s.text.ar).every(seg => normSkeleton(c.text).includes(normSkeleton(seg))));
      add(ok ? 'PASS' : 'FAIL', 'registry-hadith', 'sources.json', s.id, ok ? `text found in ${book} #${num}` : `text not found in ${book} #${num}`);
      if (!/^(صحيح|حسن)/.test(s.grade || '') || !(s.grader || '').trim()) add('FAIL', 'registry-hadith', 'sources.json', s.id, 'grade/grader missing or not صحيح/حسن');
    }
  }
}

// ---------- No scripture (project-owner decision 2026-10-06) ----------
// No Bible/Torah/Gospel text or reference may appear anywhere in a ruling (Qur'an/hadith excluded): no common_ground.bible
// field, no book + chapter:verse, no named Bible translations or scripture mentions. Any hit = FAIL. See tools/audit/scripture_guard.cjs.
const { scanRuling } = createRequire(import.meta.url)('./scripture_guard.cjs');
function checkNoScripture() {
  for (const { r } of rulings) {
    const hits = scanRuling(r);
    if (hits.length) for (const h of hits) add('FAIL', 'no-scripture', r.id, h.path, `scriptural reference not allowed: «${h.match}»`);
    else add('PASS', 'no-scripture', r.id, '-', 'no Bible/Torah/Gospel text or reference');
  }
}

// Quotations in newcomer_explainer / common_ground: every «…» quote in the Arabic text must be a (letters-only)
// substring of a hadith or Qur'an text_ar *in the same ruling*. Unmatched quote = WARN (manual review),
// because explainers may legitimately quote a short phrase in paraphrase.
function checkQuotes() {
  for (const { r } of rulings) {
    const pool = [...(r.hadith || []).map(h => h.text_ar), ...(r.quran || []).map(q => q.text_ar)]
      .map(normSkeleton).join(' | ');
    const texts = [r.newcomer_explainer?.ar, r.common_ground?.summary?.ar, r.common_ground?.differences?.ar].filter(Boolean).join(' ');
    for (const q of texts.matchAll(/«([^»]{6,})»/g)) {
      const parts = q[1].split(/…|\.\.\./).map(normSkeleton).filter(p => p.length >= 4);
      if (parts.every(p => pool.includes(p))) add('PASS', 'quote', r.id, `«${q[1].slice(0, 30)}»`, 'quote found in this ruling\'s verified texts');
      else add('WARN', 'quote', r.id, `«${q[1].slice(0, 40)}»`, 'quote not found verbatim in this ruling\'s hadith/Qur\'an texts — check it is a paraphrase or a sourced statement');
    }
  }
}

// ---------- run ----------
try {
  await checkQuran();
  await checkHadith();
  await checkRegistry();
  checkNoScripture();
  checkQuotes();
} catch (e) { console.error('setup/network error:', e); process.exit(2); }

const fails = results.filter(x => x.level === 'FAIL');
const warns = results.filter(x => x.level === 'WARN');
if (args.has('--json')) console.log(JSON.stringify(results, null, 2));
else {
  console.log(`\n«يومك» verify — ${new Date().toISOString()}`);
  console.log(`rulings: ${rulings.length} | checks: ${results.length} | PASS ${results.filter(x => x.level === 'PASS').length} | WARN ${warns.length} | FAIL ${fails.length}\n`);
  for (const x of results) {
    if (QUIET && x.level === 'PASS') continue;
    console.log(`[${x.level}] ${x.kind.padEnd(18)} ${x.ruling.padEnd(34)} ${x.ref}\n      ${x.msg}`);
  }
  const qn = new Set(), hn = new Set();
  for (const x of results) if (x.level === 'PASS' && x.kind === 'quran-text') qn.add(x.ref);
  for (const x of results) if (x.level !== 'FAIL' && (x.kind === 'hadith-text' || x.kind === 'hadith-manual')) hn.add(x.ruling + '|' + x.ref);
  console.log(`\nSummary: unique ayat verified ${qn.size}; hadith citations verified ${hn.size}; WARN ${warns.length}; FAIL ${fails.length}`);
}
process.exit(fails.length ? 1 : 0);
