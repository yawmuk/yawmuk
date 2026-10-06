// Adhkar feature: content integrity (offline, against the saved source snapshot) + pure UI logic.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_GRADES, TABS, defaultTab, itemsForTab, keyedForTab, tap, remaining, isDone, progress, segmentAt, digits, dayKey } from '../src/features/adhkar/core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/adhkar/adhkar.json'), 'utf8'));
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/adhkar/source_snapshot.json'), 'utf8'));
const items = data.items;
const ws = (s) => String(s).normalize('NFC').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const SIX = ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'ibnmajah', 'nasai'];
const gradeOk = (g) => ALLOWED_GRADES.includes(g);
// dorar grade wording: must be an acceptance grade, never weak/fabricated wording
const dorarOk = (g) => /^\[?(صحيح|حسن)/.test(g) && !/ضعيف|منكر|موضوع|باطل|لا يصح/.test(g);

describe('adhkar content', () => {
  test('enough items in each section', () => {
    assert.ok(items.filter((i) => i.tab !== 'daily').length >= 11, 'morning/evening');
    assert.ok(itemsForTab(items, 'morning').length >= 9, 'morning');
    assert.ok(itemsForTab(items, 'evening').length >= 9, 'evening');
    assert.ok(itemsForTab(items, 'daily').length >= 10, 'daily');
  });

  test('ids are unique and well formed', () => {
    const ids = items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9_]+$/);
  });

  test('every item has text, translation label, occasion and a valid counter', () => {
    for (const it of items) {
      assert.ok(['morning', 'evening', 'both', 'daily'].includes(it.tab), it.id);
      assert.ok(it.text_ar && it.text_ar.length > 3, `${it.id} text_ar`);
      assert.ok(it.text_en && it.text_en.length > 3, `${it.id} text_en`);
      assert.ok(it.occasion && it.occasion.ar && it.occasion.en, `${it.id} occasion`);
      assert.ok(it.translation_label && /ترجمة/.test(it.translation_label.ar) && /[Tt]ranslation/.test(it.translation_label.en), `${it.id} translation label`);
      assert.ok(Number.isInteger(it.repeat) && it.repeat >= 1 && it.repeat <= 100, `${it.id} repeat`);
      if (it.segments) assert.equal(it.segments.reduce((a, s) => a + s.count, 0), it.repeat, `${it.id} segments sum`);
      assert.match(it.checked_at, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('every item has a source URL (Hisn al-Muslim API) and https audio only', () => {
    for (const it of items) {
      assert.match(it.hisn.source_url_ar, /^https:\/\/www\.hisnmuslim\.com\/api\/ar\/\d+\.json$/, it.id);
      assert.match(it.hisn.source_url_en, /^https:\/\/www\.hisnmuslim\.com\/api\/en\/\d+\.json$/, it.id);
      if (it.hisn.audio_url) assert.match(it.hisn.audio_url, /^https:\/\//, `${it.id} audio must be https`);
      assert.ok(snap.hisnmuslim[String(it.hisn.item_id)], `${it.id}: Hisn item ${it.hisn.item_id} missing from snapshot`);
    }
  });

  test('Arabic text is quoted verbatim from the Hisn al-Muslim source (not retyped)', () => {
    for (const it of items) {
      if (it.kind === 'quran') continue;
      const src = snap.hisnmuslim[String(it.hisn.item_id)].ARABIC_TEXT.normalize('NFC');
      for (const part of it.text_ar.split(' … ')) assert.ok(src.includes(part.normalize('NFC')), `${it.id}: «${part}» not in source`);
      if (it.evening) for (const part of it.evening.ar.split(' — ')) assert.ok(src.includes(part), `${it.id}: evening «${part}» not in source`);
    }
  });

  test('English is the source translation of meaning (or a documented erratum)', () => {
    for (const it of items) {
      if (it.kind === 'quran' || it.erratum) continue;
      const src = ws(snap.hisnmuslim[String(it.hisn.item_id)].TRANSLATED_TEXT);
      for (const part of it.text_en.split(' … ')) assert.ok(src.includes(ws(part)), `${it.id}: EN «${part}» not in source`);
    }
    for (const it of items.filter((i) => i.erratum)) assert.ok(it.erratum.length > 20, `${it.id}: erratum must explain the correction`);
  });

  test("Qur'an items carry QuranEnc text per aya, never Hisn's retyped text", () => {
    const q = items.filter((i) => i.kind === 'quran');
    assert.ok(q.length >= 1);
    for (const it of q) {
      for (const s of it.quran) {
        assert.match(s.source_url, /^https:\/\/quranenc\.com\//);
        assert.ok(s.ayat.length > 0);
        for (const a of s.ayat) {
          assert.ok(a.text_ar && a.text_en && Number.isInteger(a.aya));
          assert.doesNotMatch(a.text_en, /\[\d+\]/, 'footnote markers removed');
        }
        assert.equal(s.ayat.map((a) => a.aya).join(','), s.ayat.map((_, i) => i + 1).join(','), `${it.id} sura ${s.sura} complete & ordered`);
      }
      assert.match(it.text_ar, /ٱ/, `${it.id}: Madinah-Mushaf orthography expected (alif wasla)`);
    }
  });

  test('every item has at least one reference with book, number, allowed grade and named grader', () => {
    for (const it of items) {
      assert.ok(Array.isArray(it.refs) && it.refs.length >= 1, it.id);
      for (const r of it.refs) {
        assert.ok(SIX.includes(r.book), `${it.id} book ${r.book}`);
        assert.ok(Number.isInteger(r.number) && r.number > 0, `${it.id} number`);
        assert.ok(gradeOk(r.grade), `${it.id} grade «${r.grade}»`);
        assert.ok(r.grader && r.grader.length > 2, `${it.id} grader`);
        assert.ok(r.book_ar && r.book_en, `${it.id} book names`);
        assert.equal(r.sunnah_url, `https://sunnah.com/${r.book}:${r.number}`, `${it.id} sunnah link`);
        assert.match(r.dorar ? r.dorar.search_url : r.dorar_search_url, /^https:\/\/dorar\.net\/hadith\/search\?q=/);
        assert.ok(r.matn_fragment && r.matn_fragment.length >= 4, `${it.id} matn fragment`);
        if (r.book === 'bukhari' || r.book === 'muslim') assert.equal(r.grade, 'صحيح');
        else assert.equal(r.grader, 'الألباني', `${it.id}: Sunan grades are al-Albani's`);
      }
    }
  });

  test('items resting on Sunan hadith carry a dorar.net record that is in the fetched snapshot', () => {
    for (const it of items) {
      const sunanOnly = it.refs.every((r) => r.book !== 'bukhari' && r.book !== 'muslim');
      const recs = [...it.refs.filter((r) => r.dorar).map((r) => r.dorar), ...(it.dorar_extra ? [it.dorar_extra] : [])];
      if (sunanOnly) assert.ok(recs.length >= 1, `${it.id}: needs a dorar record`);
      for (const d of recs) {
        assert.ok(d.muhaddith && d.source && d.number, `${it.id} dorar fields`);
        assert.ok(dorarOk(d.grade), `${it.id} dorar grade «${d.grade}»`);
        const fetched = snap.dorar_queries[d.api_query];
        assert.ok(fetched, `${it.id}: dorar query not in snapshot`);
        assert.ok(fetched.some((x) => x.muhaddith.trim() === d.muhaddith && x.number.trim() === d.number), `${it.id}: dorar record not in fetched results`);
      }
    }
  });

  test('items graded weak by al-Albani are excluded, and the exclusions are documented', () => {
    const banned = new Set(['abudawud:5096', 'abudawud:5069', 'abudawud:5073', 'abudawud:5072', 'abudawud:5084', 'tirmidhi:3389']);
    for (const it of items) for (const r of it.refs) assert.ok(!banned.has(`${r.book}:${r.number}`), `${it.id} cites excluded ${r.book} ${r.number}`);
    assert.ok(data.meta.excluded.length >= 5);
    assert.ok(data.meta.excluded.some((x) => /5096/.test(x.reason)));
    for (const x of data.meta.excluded) assert.ok(x.reason && Number.isInteger(x.hisn_item));
    const usedHisn = new Set(items.map((i) => i.hisn.item_id));
    for (const x of data.meta.excluded) assert.ok(!usedHisn.has(x.hisn_item), `excluded Hisn item ${x.hisn_item} is also used`);
  });

  test('virtue lines only appear with a reference, and carry both languages', () => {
    for (const it of items.filter((i) => i.virtue)) {
      assert.ok(it.virtue.ar && it.virtue.en, it.id);
      assert.ok(it.refs.length >= 1);
    }
  });

  test('AI disclosure: content declares it is quoted, not generated', () => {
    assert.match(data.meta.disclosure.ar, /الذكاء الاصطناعي/);
    assert.match(data.meta.disclosure.en, /not AI-generated/);
  });
});

describe('adhkar logic', () => {
  const at = (h, m = 0) => new Date(2026, 9, 6, h, m);
  test('default tab without prayer times', () => {
    assert.equal(defaultTab(at(6)), 'morning');
    assert.equal(defaultTab(at(11, 59)), 'morning');
    assert.equal(defaultTab(at(13)), 'daily');
    assert.equal(defaultTab(at(15)), 'evening');
    assert.equal(defaultTab(at(22)), 'evening');
    assert.equal(defaultTab(at(2)), 'evening');
  });
  test('default tab follows Fajr / Dhuhr / Asr when given', () => {
    const times = { fajr: at(5, 10), dhuhr: at(12, 40), asr: at(16, 5) };
    assert.equal(defaultTab(at(4), times), 'evening');
    assert.equal(defaultTab(at(5, 30), times), 'morning');
    assert.equal(defaultTab(at(12, 50), times), 'daily');
    assert.equal(defaultTab(at(16, 10), times), 'evening');
  });
  test("'both' items show in morning and evening, not daily", () => {
    const both = items.filter((i) => i.tab === 'both');
    assert.ok(both.length > 0);
    for (const b of both) {
      assert.ok(itemsForTab(items, 'morning').includes(b));
      assert.ok(itemsForTab(items, 'evening').includes(b));
      assert.ok(!itemsForTab(items, 'daily').includes(b));
    }
    assert.deepEqual(TABS, ['morning', 'evening', 'daily']);
  });
  test('counter counts down and stops at zero', () => {
    const it = { id: 'x', repeat: 3 };
    let s = {};
    assert.equal(remaining(s, it), 3);
    s = tap(s, it); s = tap(s, it);
    assert.equal(remaining(s, it), 1);
    s = tap(s, it); s = tap(s, it);
    assert.equal(remaining(s, it), 0);
    assert.ok(isDone(s, it));
    assert.deepEqual(progress(s, [it, { id: 'y', repeat: 1 }]), { done: 1, total: 2 });
  });
  test('a morning+evening item is counted separately in each tab', () => {
    const m = keyedForTab(items, 'morning').find((i) => i.tab === 'both');
    const e = keyedForTab(items, 'evening').find((i) => i.id === m.id);
    let s = {};
    for (let k = 0; k < m.repeat; k++) s = tap(s, m);
    assert.ok(isDone(s, m));
    assert.equal(remaining(s, e), e.repeat);
    const d = keyedForTab(items, 'daily')[0];
    assert.equal(d.key, d.id);
  });
  test('33/33/34 segments advance with the count', () => {
    const it = items.find((i) => i.segments);
    assert.ok(it);
    assert.equal(segmentAt(it, 0).index, 0);
    assert.equal(segmentAt(it, 33).index, 1);
    assert.equal(segmentAt(it, 66).index, 2);
    assert.equal(segmentAt(it, 99).index, 2);
    assert.equal(segmentAt({ repeat: 3 }, 1), null);
  });
  test('helpers', () => {
    assert.equal(digits(33, 'ar'), '٣٣');
    assert.equal(digits(33, 'en'), '33');
    assert.equal(dayKey(at(9)), '2026-10-06');
  });
});

describe('adhkar module contract', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/features/adhkar/index.js'), 'utf8');
  test('exports open({ lang, onClose }) and handles Escape + focus trap + RTL', () => {
    assert.match(src, /export function open\(\{ lang = 'ar', onClose \} = \{\}\)/);
    assert.match(src, /'Escape'/);
    assert.match(src, /'Tab'/);
    assert.match(src, /'aria-modal': 'true'/);
    assert.match(src, /lang === 'ar' \? 'rtl' : 'ltr'/);
  });
  test('CSS classes are prefixed yk-adhkar-', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/features/adhkar/adhkar.css'), 'utf8');
    const classes = [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^(is-|yk-adhkar-)/.test(c));
    assert.deepEqual([...new Set(classes)], []);
  });
});
