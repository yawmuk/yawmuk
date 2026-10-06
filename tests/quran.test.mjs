// Quran panel: bundled data integrity, attribution, URL builders, text helpers.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './helpers/content.mjs';
import {
  OFFLINE_SURAHS, RECITERS, TRANSLATIONS, DEFAULT_TRANSLATION, ATTRIBUTION,
  audioUrl, textUrl, translationUrl, splitFootnotes, stripVerseNumber, sameAyah, mergeVerses
} from '../src/features/quran/lib.js';

const surahs = readJson('content/quran/surahs.json');
const offline = readJson('content/quran/offline.json');

describe('quran: surah index', () => {
  test('114 surahs, 6236 ayahs, ordered and bilingual', () => {
    assert.equal(surahs.surahs.length, 114);
    assert.equal(surahs.surahs.reduce((s, x) => s + x.ayahs, 0), 6236);
    surahs.surahs.forEach((s, i) => {
      assert.equal(s.n, i + 1);
      assert.ok(/[؀-ۿ]/.test(s.ar), `surah ${s.n} arabic name`);
      assert.ok(/[A-Za-z]/.test(s.en), `surah ${s.n} english name`);
    });
    assert.equal(surahs.surahs[0].bismillahPre, false, 'Al-Fatiha carries the basmala as ayah 1');
    assert.equal(surahs.surahs[8].bismillahPre, false, 'At-Tawbah has no basmala');
    assert.match(surahs.source, /^https:\/\/api\.quran\.com\//);
  });
});

describe('quran: offline bundle', () => {
  const EXPECTED = { 1: 7, 112: 4, 113: 5, 114: 6 };
  test('contains exactly Al-Fatiha, Al-Ikhlas, Al-Falaq, An-Nas with correct ayah counts', () => {
    assert.deepEqual(offline.surahs.map((s) => s.n), OFFLINE_SURAHS);
    for (const s of offline.surahs) {
      assert.equal(s.ayahs.length, EXPECTED[s.n], `surah ${s.n}`);
      assert.equal(s.ayahs.length, surahs.surahs[s.n - 1].ayahs);
      s.ayahs.forEach((a, i) => {
        assert.equal(a.n, i + 1);
        assert.equal(a.key, `${s.n}:${i + 1}`);
      });
    }
  });
  test('every ayah has Arabic text, English translation and concise tafsir', () => {
    for (const s of offline.surahs) for (const a of s.ayahs) {
      assert.ok(a.ar && /[؀-ۿ]/.test(a.ar), `${a.key} ar`);
      assert.ok(!/[A-Za-z0-9٠-٩]/.test(a.ar), `${a.key} ar must not contain latin letters or verse digits`);
      assert.ok(a.english_saheeh && /[A-Za-z]/.test(a.english_saheeh), `${a.key} english`);
      for (const m of a.english_saheeh.match(/\[\d+\]/g) || []) {
        assert.ok(a.english_saheeh_footnotes.includes(m), `${a.key}: footnote ${m} kept with the unmodified translation`);
      }
      assert.ok(a.arabic_moyassar && /[؀-ۿ]/.test(a.arabic_moyassar), `${a.key} moyassar`);
    }
  });
  test('records provenance (fetch time, edition, source URLs)', () => {
    assert.ok(!Number.isNaN(Date.parse(offline.fetchedAt)));
    assert.match(offline.textEdition, /QPC Hafs/);
    assert.match(offline.crossCheck, /quranenc/);
    for (const s of offline.surahs) {
      assert.equal(s.sources.text, textUrl(s.n));
      assert.equal(s.sources.english_saheeh, translationUrl('english_saheeh', s.n));
      assert.equal(s.sources.arabic_moyassar, translationUrl('arabic_moyassar', s.n));
    }
  });
  test('Al-Fatiha 1:1 is the basmala used as header for other surahs (same source text)', () => {
    const b = offline.surahs[0].ayahs[0].ar;
    assert.equal(b.split(/\s+/).length, 4);
    assert.ok(/^[\u0600-\u06FF\s]+$/.test(b));
  });
});

describe('quran: URL builders', () => {
  test('everyayah per-ayah paths are zero padded', () => {
    assert.equal(audioUrl('alafasy', 1, 1), 'https://everyayah.com/data/Alafasy_128kbps/001001.mp3');
    assert.equal(audioUrl('husary', 114, 6), 'https://everyayah.com/data/Husary_128kbps/114006.mp3');
    assert.equal(audioUrl('alafasy', 2, 286), 'https://everyayah.com/data/Alafasy_128kbps/002286.mp3');
    assert.match(audioUrl('nope', 2, 5), /Alafasy_128kbps\/002005\.mp3$/, 'unknown reciter falls back');
  });
  test('rejects out-of-range references', () => {
    assert.throws(() => audioUrl('alafasy', 0, 1), RangeError);
    assert.throws(() => audioUrl('alafasy', 115, 1), RangeError);
    assert.throws(() => audioUrl('alafasy', 1, 0), RangeError);
    assert.throws(() => textUrl(115), RangeError);
    assert.throws(() => translationUrl('made_up', 1));
  });
  test('text uses QPC Hafs and one page for the longest surah', () => {
    assert.equal(textUrl(2), 'https://api.quran.com/api/v4/verses/by_chapter/2?fields=text_qpc_hafs&per_page=300&page=1');
    assert.equal(translationUrl('english_saheeh', 112), 'https://quranenc.com/api/v1/translation/sura/english_saheeh/112');
  });
  test('3-4 reciters with bilingual names; translations default per UI language', () => {
    assert.ok(RECITERS.length >= 3 && RECITERS.length <= 4);
    for (const r of RECITERS) assert.ok(r.name.ar && r.name.en && r.dir);
    assert.equal(DEFAULT_TRANSLATION.ar, 'arabic_moyassar');
    assert.equal(DEFAULT_TRANSLATION.en, 'english_saheeh');
    for (const k of ['english_saheeh', 'english_hilali_khan']) {
      assert.ok(!/KFGQPC|King Fahd|مجمع/.test(TRANSLATIONS[k].label.en + TRANSLATIONS[k].label.ar),
        `${k}: publisher not stated by quranenc.com as King Fahd Complex — must not be labelled so`);
    }
  });
});

describe('quran: attribution', () => {
  test('names text, translation and audio sources in both languages', () => {
    assert.match(ATTRIBUTION.ar.text, /مجمع الملك فهد/);
    assert.match(ATTRIBUTION.ar.translation, /quranenc\.com/);
    assert.match(ATTRIBUTION.ar.translation, /موسوعة القرآن الكريم/);
    assert.match(ATTRIBUTION.en.text, /King Fahd/);
    assert.match(ATTRIBUTION.en.translation, /quranenc\.com/);
    assert.match(ATTRIBUTION.ar.audio + ATTRIBUTION.en.audio, /everyayah\.com/);
    assert.match(ATTRIBUTION.ar.note, /ليست قرآنًا/);
    for (const l of ATTRIBUTION.links) assert.match(l.href, /^https:\/\//);
  });
  test('panel source renders the attribution footer and approved sources doc exists', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/features/quran/index.js'), 'utf8');
    assert.match(src, /ATTRIBUTION\[L\]/);
    assert.match(src, /export function open\(/);
    const doc = fs.readFileSync(path.join(ROOT, 'docs/QURAN_SOURCES.md'), 'utf8');
    for (const u of ['api.quran.com', 'quranenc.com', 'everyayah.com', 'text_qpc_hafs']) assert.ok(doc.includes(u), u);
  });
});

describe('quran: text helpers', () => {
  test('footnotes split one per line; empty input gives none', () => {
    assert.deepEqual(splitFootnotes('[2] a\n[3] b\n'), ['[2] a', '[3] b']);
    assert.deepEqual(splitFootnotes(''), []);
    assert.deepEqual(splitFootnotes(undefined), []);
  });
  test('verse number and whitespace ignored when cross-checking', () => {
    assert.equal(stripVerseNumber('abc ١٢'), 'abc');
    assert.ok(sameAyah(' x  y ٤', 'x y'));
    assert.ok(!sameAyah('xٌ', 'xُ'));
  });
  test('mergeVerses flags mismatches and keeps QPC text', () => {
    const rows = mergeVerses(
      [{ verse_number: 1, text_qpc_hafs: 'A ١' }, { verse_number: 2, text_qpc_hafs: 'B ٢' }],
      [{ aya: '1', arabic_text: 'A', translation: 'one[1]', footnotes: '[1] note' }, { aya: '2', arabic_text: 'C', translation: 'two' }]
    );
    assert.deepEqual(rows, [
      { n: 1, ar: 'A', tr: 'one[1]', fn: ['[1] note'], verified: true },
      { n: 2, ar: 'B', tr: 'two', fn: [], verified: false }
    ]);
  });
});
