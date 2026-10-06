// Reliability fixes for the devil's-advocate report (findings 6, 7, 8, 10, 11) and the package eval suite.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadRulings, readJson, bilingual } from './helpers/content.mjs';
import { isPersonalFatwa } from '../src/engine/aiCore.js';
import { tierOf, APPROVED_HOSTS } from '../tools/eval/source_tiers.mjs';
import { runOffline, CASES, noFabrication, renderReport } from '../tools/eval/run_package_eval.mjs';

const rulings = loadRulings().map((x) => x.ruling);
const sources = readJson('content/sources.json');
const srcById = Object.fromEntries(sources.map((s) => [s.id, s]));
const bank = readJson('content/script/questions.json');
const items = bank.items;
const ui = readJson('content/script/ui_strings.json');

describe('finding 6 — no automated tarjih on level C (ج)', () => {
  test('every ruling has an explicit content_level A–D, and ui_strings label every level', () => {
    for (const r of rulings) assert.ok(['A', 'B', 'C', 'D'].includes(r.content_level), r.id);
    for (const l of ['A', 'B', 'C', 'D']) assert.ok(bilingual(ui.ruling_card.content_levels[l]), `ui level ${l}`);
    assert.match(ui.ruling_card.content_levels.C.ar, /^ج/);
    assert.ok(bilingual(ui.ruling_card.verdict_level_c));
  });
  for (const r of rulings.filter((x) => x.content_level === 'C')) {
    test(`${r.id}: level C has a bilingual verdict_scope and never "high" confidence`, () => {
      assert.ok(bilingual(r.verdict_scope), 'verdict_scope {ar,en}');
      assert.notEqual(r.confidence, 'high');
    });
    if (!['disputed', 'depends'].includes(r.verdict)) {
      test(`${r.id}: a definite verdict on a level-C question is attributed (majority view + named bodies) and names the other view`, () => {
        assert.match(r.verdict_scope.ar, /الجمهور|جمهور/);
        assert.match(r.verdict_scope.en, /majority/i);
        assert.match(r.verdict_scope.ar, /الأقل|أجاز|خلاف/);
      });
    }
  }
  test('the previously empty scopes are filled (credit card, holidays, food, wedding, gifts, handshake, alcohol job, 401k, lost wallet)', () => {
    const ids = ['home.credit_card', 'public_events.holiday_greetings', 'home.food_ingredients', 'private_events.wedding', 'private_events.gifts_birthday', 'school.mixed_social', 'work.alcohol_pork_job', 'work.retirement_401k', 'street.lost_wallet'];
    for (const id of ids) assert.ok(bilingual(rulings.find((r) => r.id === id)?.verdict_scope), id);
  });
});

describe('finding 11 — sensitive phrasing', () => {
  const R = (id) => rulings.find((r) => r.id === id);
  test('holiday greetings: majority (four schools, Ibn al-Qayyim, Standing Committee) first; ECFR named as the minority', () => {
    const r = R('public_events.holiday_greetings');
    assert.match(r.verdict_scope.ar, /^قول جمهور العلماء/);
    assert.match(r.verdict_scope.ar, /ابن القيم/); assert.match(r.verdict_scope.ar, /اللجنة الدائمة/);
    assert.match(r.verdict_scope.ar, /المجلس الأوروبي[^.]*قول الأقل/);
    assert.match(r.summary.en, /^The majority of scholars/);
    assert.match(r.contemporary[0].body, /اللجنة الدائمة/);
    assert.ok(r.consensus_sources.some((s) => /ابن القيم/.test(s)), "Ibn al-Qayyim's report stays attributed to him");
  });
  test('handshake: the individual permissive fatwa is not featured — no name in summary/scope, listed last', () => {
    const r = R('school.mixed_social');
    assert.doesNotMatch(`${r.summary.ar} ${r.summary.en} ${r.verdict_scope.ar} ${r.verdict_scope.en}`, /القرضاوي|Qaradawi/i);
    assert.match(r.contemporary.at(-1).body, /القرضاوي/);
    assert.match(r.verdict_scope.ar, /^قول جمهور العلماء/);
  });
  test('lost wallet: "obligatory" is scoped to safeguarding/announcing after pick-up; picking up varies', () => {
    const r = R('street.lost_wallet');
    assert.match(r.verdict_scope.ar, /بعد الالتقاط/); assert.match(r.verdict_scope.ar, /يختلف/);
    assert.match(r.verdict_scope.en, /once it has been picked up/); assert.match(r.verdict_scope.en, /varies/);
  });
  test('no newspaper sources anywhere', () => {
    const all = JSON.stringify(rulings) + JSON.stringify(sources);
    assert.doesNotMatch(all, /peninsulaqatar/i);
  });
});

describe('finding 7 — source tiers and package references', () => {
  test('every source record carries a tier that matches tools/eval/source_tiers.mjs', () => {
    const bad = sources.filter((s) => !['approved_package', 'secondary'].includes(s.tier) || s.tier !== tierOf(s).tier || !s.tier_note).map((s) => s.id);
    assert.deepEqual(bad, []);
  });
  test('islamqa / islamhouse are secondary, Bayyinat and Jamhara are approved_package', () => {
    for (const s of sources.filter((x) => /islamqa\.info|islamhouse\.com/.test(x.url || ''))) assert.equal(s.tier, 'secondary', s.id);
    for (const id of ['other:bayyinat-q9', 'other:bayyinat-q27', 'other:bayyinat-q229', 'other:bayyinat-q239', 'other:jamhara-tawhid']) {
      assert.ok(srcById[id], id); assert.equal(srcById[id].tier, 'approved_package', id);
    }
    assert.ok(APPROVED_HOSTS.includes('dawa.center') && APPROVED_HOSTS.includes('islamic-content.com'));
  });
  test('Bayyinat records cite the package file and a question number + PDF page (no invented book pages)', () => {
    for (const s of sources.filter((x) => x.id.startsWith('other:bayyinat-'))) {
      assert.equal(s.url, 'https://dawa.center/file/7937');
      assert.match(s.citation, /المسألة \d+/); assert.match(s.citation, /ملف PDF/);
    }
  });
  test('shubuhat items cite Bayyinat; translation items cite the Jamhara dictionary', () => {
    const cites = (id, src) => assert.ok(items.find((i) => i.id === id).source_ids.includes(src), `${id} -> ${src}`);
    for (const id of ['qa.kaaba.home', 'qa.kaaba.school']) cites(id, 'other:bayyinat-q9');
    for (const id of ['qa.quran_author.work', 'qa.quran_author.school']) cites(id, 'other:bayyinat-q27');
    for (const id of ['qa.sword.street', 'qa.sword.public_events']) cites(id, 'other:bayyinat-q229');
    for (const id of ['qa.khilaf.school', 'qa.khilaf.private_events']) cites(id, 'other:bayyinat-q239');
    for (const id of ['qa.tawhid_translate.work', 'qa.tawhid_translate.school']) cites(id, 'other:jamhara-tawhid');
    for (const id of ['qa.tawhid_translate.work', 'qa.tawhid_translate.school']) assert.match(items.find((i) => i.id === id).answer.en, /Jamhara[^.]*Monotheism/);
  });
  test('docs/QA_BANK.md no longer calls islamqa/islamhouse package-approved', async () => {
    const fs = await import('node:fs');
    const md = fs.readFileSync(new URL('../docs/QA_BANK.md', import.meta.url), 'utf8');
    assert.doesNotMatch(md, /package-approved sites \(islamqa/i);
    assert.match(md, /dawa\.center\/file\/7937/);
  });
});

describe('finding 8 — personal-fatwa pre-filter', () => {
  const POS = [
    'I live in Ohio, is it okay to take this mortgage?', 'I work in a bar, is that haram?', "I'm living in London and want to buy a house, is it allowed?",
    'Is it okay to take this mortgage?', 'Is it halal for me to eat this?', 'My husband wants a mortgage', 'My boss gave me a gift card', 'Should I take the loan?',
    'أنا في ألمانيا، هل يجوز لي أن أتزوج بدون ولي؟', 'انا اعيش في امريكا هل اخذ القرض', 'نحن في كندا والمسجد بعيد، هل نجمع الصلاة؟',
    'أريد أن أعمل في مطعم يقدم الخمر، ما رأيكم؟', 'زوجي يرفض أن أعمل، ماذا أفعل؟', 'أمي مريضة ولا تستطيع الصوم', 'هل يجوز لي أن أشتري بالبطاقة؟'
  ];
  const NEG = [
    'What is riba?', 'Is riba haram?', 'Is it halal to eat shrimp?', 'Why does Islam forbid interest?', 'Do all Muslims agree on mortgages?',
    'How should we translate Tawhid into English?', 'Why do Muslims worship the Kaaba?', 'Did Muhammad write the Quran himself?', 'Is it okay to say inshallah?',
    'Give me a hadith that says AI homework is haram', 'ما حكم الربا؟', 'ما قصة أبي بكر الصديق؟', 'ما معنى التوحيد؟', 'هل انتشر الإسلام بالسيف؟', 'لماذا يختلف العلماء؟', 'ما معنى النبي الأمي؟'
  ];
  test('flags personal cases (ar + en)', () => { for (const q of POS) assert.equal(isPersonalFatwa(q), true, q); });
  test('lets general questions through (ar + en)', () => { for (const q of NEG) assert.equal(isPersonalFatwa(q), false, q); });
  test('every non-personal bank question stays answerable; every case-5 bank question is a referral item', () => {
    for (const it of items.filter((i) => ![5].includes(i.case_id) && i.level !== 'D')) for (const l of ['ar', 'en']) {
      if (/\b(should|can|may)\s+i\b/i.test(it.question[l])) continue; // in-story questions addressed to a character
      assert.equal(isPersonalFatwa(it.question[l]), false, `${it.id} [${l}]: ${it.question[l]}`);
    }
    for (const it of items.filter((i) => i.case_id === 5)) assert.equal(it.refer, true, it.id);
  });
});

describe('finding 10 — root before branch', () => {
  test('qa.basics.tawhid is the first bank item, level A, sourced from the Jamhara dictionary and Surah al-Ikhlas', () => {
    const it = items[0];
    assert.equal(it.id, 'qa.basics.tawhid');
    assert.equal(it.level, 'A');
    assert.ok(it.source_ids.includes('other:jamhara-tawhid'));
    for (const a of [1, 2, 3, 4]) assert.ok(it.source_ids.includes(`quran:112:${a}`));
    assert.equal(ui.start.basics_item, 'qa.basics.tawhid');
    assert.ok(bilingual(ui.start.basics));
  });
});

describe('package eval suite (12 cases, offline mode)', () => {
  test('12 cases, each with ar + en questions and an expected behaviour quoted from the package', () => {
    assert.deepEqual(CASES.map((c) => c.case), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const c of CASES) { assert.ok(bilingual(c.questions)); assert.ok(c.expected_ar.length > 10); }
  });
  const off = runOffline();
  test('every deterministic guard passes', () => { assert.deepEqual(off.guards.filter((g) => !g.pass).map((g) => g.name), []); });
  test('case 5 (personal) is routed to referral without the model in both languages', () => {
    for (const r of off.rows.filter((x) => x.case === 5)) assert.equal(r.checks.find((c) => c.name === 'route').got, 'personal');
  });
  test('at least 22 of 24 case checks pass offline (the report lists any miss honestly)', () => {
    assert.ok(off.rows.filter((r) => r.pass).length >= 22, off.rows.filter((r) => !r.pass).map((r) => `${r.case}/${r.lang}`).join(', '));
  });
  test('fabrication detector', () => {
    assert.equal(noFabrication('The Prophet said that gaming is haram (Bukhari 1234).'), false);
    assert.equal(noFabrication('قال رسول الله إن هذا حرام'), false);
    assert.equal(noFabrication('We found no hadith on this in our verified library.'), true);
  });
  test('report marks online results pending when no server was given', () => {
    assert.match(renderReport(off, null), /pending — run after deploy/);
  });
});
