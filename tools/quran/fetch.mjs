#!/usr/bin/env node
// Fetches the offline Quran bundle from approved sources. Never hand-type Quran text.
//   node tools/quran/fetch.mjs
// Writes content/quran/surahs.json (114 surah names/counts) and content/quran/offline.json
// (surahs 1, 112, 113, 114: QPC Hafs text + english_saheeh + arabic_moyassar).
// Aborts without writing if any ayah of api.quran.com (text_qpc_hafs) differs from quranenc.com's arabic_text,
// or if an ayah count disagrees with /chapters.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFLINE_SURAHS, textUrl, translationUrl, chaptersUrl, stripVerseNumber, sameAyah } from '../../src/features/quran/lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'content/quran');
const KEYS = ['english_saheeh', 'arabic_moyassar'];
// Translations are stored exactly as published (quranenc.com terms: no modification).

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === 2) throw new Error(`${url}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 800 * (i + 1)));
    }
  }
}

const fetchedAt = new Date().toISOString();
const [en, ar] = await Promise.all([getJson(chaptersUrl('en')), getJson(chaptersUrl('ar'))]);
const arName = new Map(ar.chapters.map((c) => [c.id, c.translated_name?.name]));
const surahs = en.chapters.map((c) => ({
  n: c.id,
  ar: c.name_arabic,
  en: c.name_simple,
  meaningEn: c.translated_name?.name || '',
  meaningAr: arName.get(c.id) || '',
  ayahs: c.verses_count,
  place: c.revelation_place,
  bismillahPre: !!c.bismillah_pre
}));
if (surahs.length !== 114) throw new Error(`expected 114 chapters, got ${surahs.length}`);
const total = surahs.reduce((s, x) => s + x.ayahs, 0);
if (total !== 6236) throw new Error(`expected 6236 ayahs, got ${total}`);

const versions = {};
try {
  const list = await getJson('https://quranenc.com/api/v1/translations/list');
  for (const t of list.translations || []) if ([...KEYS, 'english_hilali_khan'].includes(t.key)) versions[t.key] = { version: t.version, title: t.title, lastUpdate: t.last_update };
} catch (e) { console.warn('translation list:', e.message); }

const out = [];
for (const n of OFFLINE_SURAHS) {
  const meta = surahs[n - 1];
  const qpc = await getJson(textUrl(n));
  const verses = qpc.verses;
  if (verses.length !== meta.ayahs) throw new Error(`surah ${n}: ${verses.length} != ${meta.ayahs}`);
  const tr = {};
  for (const k of KEYS) {
    const rows = (await getJson(translationUrl(k, n))).result;
    if (rows.length !== meta.ayahs) throw new Error(`surah ${n} ${k}: ${rows.length} rows`);
    rows.forEach((r, i) => {
      if (Number(r.aya) !== i + 1) throw new Error(`surah ${n} ${k}: aya order`);
      if (!sameAyah(verses[i].text_qpc_hafs, r.arabic_text)) throw new Error(`MISMATCH ${n}:${i + 1} (${k})`);
    });
    tr[k] = rows.map((r) => ({ text: String(r.translation ?? '').trim(), footnotes: String(r.footnotes ?? '').trim() }));
  }
  out.push({
    n,
    ar: meta.ar,
    en: meta.en,
    ayahs: verses.map((v, i) => ({
      n: v.verse_number,
      key: v.verse_key,
      ar: stripVerseNumber(v.text_qpc_hafs),
      english_saheeh: tr.english_saheeh[i].text,
      english_saheeh_footnotes: tr.english_saheeh[i].footnotes,
      arabic_moyassar: tr.arabic_moyassar[i].text,
      arabic_moyassar_footnotes: tr.arabic_moyassar[i].footnotes
    })),
    sources: {
      text: textUrl(n),
      english_saheeh: translationUrl('english_saheeh', n),
      arabic_moyassar: translationUrl('arabic_moyassar', n)
    }
  });
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'surahs.json'), JSON.stringify({
  source: chaptersUrl('en'), sourceAr: chaptersUrl('ar'), fetchedAt, surahs
}, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'offline.json'), JSON.stringify({
  fetchedAt,
  textEdition: 'QPC Hafs (King Fahd Glorious Quran Printing Complex), api.quran.com field text_qpc_hafs',
  crossCheck: 'Every ayah matched quranenc.com arabic_text (whitespace and verse number ignored) at fetch time',
  translations: versions,
  surahs: out
}, null, 1) + '\n');
console.log(`ok: ${surahs.length} surahs, offline ${out.map((s) => `${s.n}(${s.ayahs.length})`).join(' ')}; all ayahs cross-verified`);
