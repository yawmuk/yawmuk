// Unit tests for the AI safety core (src/engine/aiCore.js): validators, fallback planner, retrieval, pre-filter.
// Pure functions only — no network, no API key needed.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS, loadRulings, loadScripts, readJson } from './helpers/content.mjs';
import {
  validatePlan, validWhy, fallbackPlan, orderLocations, isValidOrder, makeCitationChecker,
  isPersonalFatwa, retrieve, validateAnswer, scriptureHit, pickChecks, metricsPayload, tokenize
} from '../src/engine/aiCore.js';
import { CATALOG, TOPICS, DAY_TYPES } from '../src/engine/config.js';

const IDS = new Set(CATALOG.map((c) => c.id));
const scripts = loadScripts();
const SITS = LOCATIONS.flatMap((l) => scripts[l].situations.map((s) => ({ id: s.ruling_id, location: l })));
const rulings = Object.fromEntries(loadRulings().map((x) => [x.ruling.id, x.ruling]));
const sources = readJson('content/sources.json');
const WHY = { ar: 'يناسب اهتمامك بالمال', en: 'Fits your interest in money' };

describe('journey plan validator', () => {
  test('drops ids not in the catalog and duplicates; keeps valid items in order', () => {
    const v = validatePlan({ journey: [
      { situation_id: 'home.purity_mosque', why: WHY },
      { situation_id: 'home.made_up', why: WHY },
      { situation_id: 'home.purity_mosque', why: WHY },
      { situation_id: 'street.lottery', why: WHY },
      { situation_id: 42, why: WHY }
    ], followup: 'work.amulet' }, { catalogIds: IDS });
    assert.equal(v.ok, true);
    assert.deepEqual(v.journey.map((j) => j.id), ['home.purity_mosque', 'street.lottery']);
    assert.equal(v.followup, 'work.amulet');
    assert.deepEqual(v.dropped.map((d) => d.reason), ['unknown id', 'duplicate', 'unknown id']);
  });

  test('requires at least one valid item; rejects non-objects', () => {
    assert.equal(validatePlan(null, { catalogIds: IDS }).ok, false);
    assert.equal(validatePlan({ journey: 'x' }, { catalogIds: IDS }).ok, false);
    assert.equal(validatePlan({ journey: [{ situation_id: 'nope.nope', why: WHY }] }, { catalogIds: IDS }).ok, false);
    assert.equal(validatePlan({ journey: [] }, { catalogIds: IDS }).ok, false);
  });

  test('unknown followup is dropped (plan still ok)', () => {
    const v = validatePlan({ journey: [{ situation_id: 'work.hijab', why: WHY }], followup: 'x.y' }, { catalogIds: IDS });
    assert.equal(v.ok, true);
    assert.equal(v.followup, null);
  });

  test('scripture, quotes, forbidden words and over-long text in "why" are rejected', () => {
    const bad = [
      { ar: 'قال الله تعالى في كتابه', en: 'ok' },
      { ar: 'جيد', en: 'Allah says this is forbidden' },
      { ar: 'جيد', en: 'See Quran 2:275 for the rule' },
      { ar: 'جيد', en: 'The Prophet said to be honest' },
      { ar: 'قال رسول الله', en: 'ok' },
      { ar: '﴿وَأَحَلَّ اللَّهُ الْبَيْعَ﴾', en: 'ok' },
      { ar: 'جيد', en: 'As the hadith teaches' },
      { ar: 'جيد', en: 'He said "do not" here' },
      { ar: 'كما في «الحديث»', en: 'ok' },
      { ar: 'جيد', en: 'Sahih Bukhari 2083 explains' },
      { ar: 'جيد', en: 'x'.repeat(161) },
      { ar: '', en: 'ok' },
      { en: 'missing ar' },
      'a string'
    ];
    for (const why of bad) assert.equal(validWhy(why), false, JSON.stringify(why));
    assert.equal(validWhy(WHY), true);
    const v = validatePlan({ journey: [{ situation_id: 'home.purity_mosque', why: bad[0] }, { situation_id: 'street.lottery', why: WHY }] }, { catalogIds: IDS });
    assert.deepEqual(v.journey.map((j) => j.id), ['street.lottery']);
    assert.equal(v.dropped[0].reason, 'invalid why');
  });

  test('every situation must have citations resolving to content/sources.json', () => {
    const ok = makeCitationChecker(rulings, sources);
    for (const id of IDS) assert.equal(ok(id), true, `${id} citations do not resolve`);
    const fake = { ...rulings, 'home.purity_mosque': { ...rulings['home.purity_mosque'], quran: [{ surah: 2, ayah: '999' }] } };
    const ok2 = makeCitationChecker(fake, sources);
    assert.equal(ok2('home.purity_mosque'), false);
    assert.equal(ok2('nope.nope'), false);
    const v = validatePlan({ journey: [{ situation_id: 'home.purity_mosque', why: WHY }, { situation_id: 'street.lottery', why: WHY }] }, { catalogIds: IDS, citationsOk: ok2 });
    assert.deepEqual(v.journey.map((j) => j.id), ['street.lottery']);
  });
});

describe('fallback planner (deterministic)', () => {
  test('no context => exactly the default order, and the default location order', () => {
    const p = fallbackPlan({}, SITS);
    assert.deepEqual(p.journey.map((j) => j.id), SITS.map((s) => s.id));
    assert.deepEqual(orderLocations(p.journey.map((j) => j.id)), LOCATIONS);
    assert.equal(p.followup, null);
  });

  test('same input => same output', () => {
    const a = fallbackPlan({ dayType: 'office', topics: ['food', 'celebrations'] }, SITS);
    const b = fallbackPlan({ dayType: 'office', topics: ['food', 'celebrations'] }, SITS);
    assert.deepEqual(a, b);
  });

  test('topic matches come first, then the default order; all situations kept', () => {
    const p = fallbackPlan({ topics: ['celebrations'] }, SITS);
    const ids = p.journey.map((j) => j.id);
    const n = TOPICS.celebrations.ids.length;
    assert.deepEqual(new Set(ids.slice(0, n)), new Set(TOPICS.celebrations.ids));
    assert.equal(ids.length, SITS.length);
    assert.equal(new Set(ids).size, SITS.length);
    assert.equal(orderLocations(ids)[0], 'public_events');
    for (const j of p.journey) assert.equal(validWhy(j.why), true, `fallback why invalid: ${JSON.stringify(j.why)}`);
  });

  test('day type moves its locations first', () => {
    const p = fallbackPlan({ dayType: 'student' }, SITS);
    assert.equal(orderLocations(p.journey.map((j) => j.id))[0], DAY_TYPES.student.locations[0]);
    const q = fallbackPlan({ dayType: 'office' }, SITS);
    assert.equal(orderLocations(q.journey.map((j) => j.id))[0], 'work');
  });

  test('unknown topics / day types are ignored', () => {
    const p = fallbackPlan({ dayType: 'party', topics: ['religion', 'belief'] }, SITS);
    assert.deepEqual(p.journey.map((j) => j.id), SITS.map((s) => s.id));
  });

  test('orderLocations keeps all 6 locations reachable', () => {
    const o = orderLocations(['street.lottery', 'home.purity_mosque', 'private_events.proposal']);
    assert.deepEqual(o.slice(0, 2), ['street', 'home']);
    assert.equal(isValidOrder(o), true);
    assert.equal(isValidOrder(['home']), false);
    assert.equal(isValidOrder([...LOCATIONS.slice(0, 5), 'home']), false);
  });

  test('pre-check picks the first 3 planned situations with a check question', () => {
    const bySit = Object.fromEntries(LOCATIONS.flatMap((l) => scripts[l].situations).map((s) => [s.ruling_id, s]));
    const ids = pickChecks(SITS.map((s) => s.id), bySit, 3);
    assert.equal(ids.length, 3);
    assert.deepEqual(ids, SITS.slice(0, 3).map((s) => s.id));
  });
});

describe('ask panel: personal-fatwa pre-filter', () => {
  test('catches personal-case questions (ar + en)', () => {
    for (const q of ['هل يجوز لي أن آخذ قرضاً بفائدة؟', 'ما الحكم في حالتي؟', 'زوجتي تعمل في مطعم، ماذا أفعل؟', 'هل علي أن أترك عملي؟',
      'Can I take this mortgage?', 'Should I quit my job?', 'my wife works at a bar', 'In my case is it allowed?', 'Is it ok for me to go?', 'Am I allowed to eat this?'])
      assert.equal(isPersonalFatwa(q), true, q);
  });
  test('lets general questions through', () => {
    for (const q of ['Why do Muslims avoid interest?', 'What is murabaha?', 'لماذا يتجنب المسلمون الفائدة؟', 'ما معنى المرابحة؟'])
      assert.equal(isPersonalFatwa(q), false, q);
  });
});

describe('ask panel: retrieval + answer validator', () => {
  const passages = [
    { id: 'q:1', text: 'Why do Muslims avoid interest on loans? Because interest (riba) is prohibited and finance is based on trade or partnership.' },
    { id: 'q:2', text: 'Can Muslims attend a neighbor funeral? Showing condolence and kindness to neighbors is encouraged.' },
    { id: 'r:school.pork:plain', text: 'Muslims check food ingredients such as gelatin and alcohol in flavorings.' }
  ];
  test('retrieval ranks the relevant passage first and returns nothing for unrelated queries', () => {
    assert.equal(retrieve('why avoid interest loans', passages)[0].id, 'q:1');
    assert.equal(retrieve('gelatin ingredients', passages)[0].id, 'r:school.pork:plain');
    assert.deepEqual(retrieve('zzzz qqqq', passages), []);
    assert.ok(tokenize('الفائدة والقروض').includes('فائده'));
  });

  test('used_ids not in the retrieved set => abstain', () => {
    const v = validateAnswer({ answer: 'Interest is avoided.', used_ids: ['q:1', 'q:99'], refer: false, abstain: false }, ['q:1', 'q:2']);
    assert.equal(v.abstain, true);
    assert.equal(v.reason, 'used_ids not retrieved');
  });

  test('no used_ids, model abstain, empty or malformed => abstain', () => {
    assert.equal(validateAnswer({ answer: 'x', used_ids: [], refer: false, abstain: false }, ['q:1']).abstain, true);
    assert.equal(validateAnswer({ answer: 'x', used_ids: ['q:1'], refer: false, abstain: true }, ['q:1']).abstain, true);
    assert.equal(validateAnswer({ answer: '', used_ids: ['q:1'] }, ['q:1']).abstain, true);
    assert.equal(validateAnswer(null, ['q:1']).abstain, true);
    assert.equal(validateAnswer({ answer: 'x'.repeat(2000), used_ids: ['q:1'] }, ['q:1']).abstain, true);
  });

  test('scripture or claimed citations in the answer => abstain', () => {
    for (const a of ['Allah says that interest is forbidden.', 'See Quran 2:275.', 'The Prophet said: avoid it.', 'قال رسول الله: ...', 'As in Sahih Muslim 1598.', 'Read surah 2 verse 275.', '﴿وَأَحَلَّ اللَّهُ الْبَيْعَ وَحَرَّمَ الرِّبَا﴾', 'More at https://example.com'])
      assert.equal(validateAnswer({ answer: a, used_ids: ['q:1'], refer: false, abstain: false }, ['q:1']).abstain, true, a);
  });

  test('a grounded plain answer passes (string or {lang} object)', () => {
    const v = validateAnswer({ answer: 'Many Muslims avoid interest and use trade- or partnership-based finance instead.', used_ids: ['q:1'], refer: false, abstain: false }, ['q:1', 'q:2']);
    assert.equal(v.abstain, false);
    assert.deepEqual(v.used_ids, ['q:1']);
    const w = validateAnswer({ answer: { ar: 'يتجنب كثير من المسلمين الفائدة.' }, used_ids: ['q:1'], refer: true, abstain: false }, ['q:1'], 'ar');
    assert.equal(w.abstain, false);
    assert.equal(w.refer, true);
  });

  test('detector self-check matches tests/safety.test.mjs samples', () => {
    for (const s of ['﴿وَأَحَلَّ اللَّهُ الْبَيْعَ﴾', 'قال رسول الله: ...', 'The Prophet (pbuh) said that ...', 'Allah says in the Quran', 'Sahih Bukhari 2083']) assert.ok(scriptureHit(s), s);
    assert.equal(scriptureHit('Many Muslims avoid interest-based loans.'), null);
  });
});

describe('metrics payload', () => {
  test('only the five anonymous fields survive, with bounded values', () => {
    const p = metricsPayload({ arm: 'ai', completed: true, pre: 1, post: 3, clarity: 5, name: 'x', belief: 'y', question: 'z' });
    assert.deepEqual(p, { arm: 'ai', completed: true, pre: 1, post: 3, clarity: 5 });
    assert.deepEqual(metricsPayload({ arm: 'weird', pre: 9, clarity: 0 }), { arm: 'fixed', completed: false, pre: null, post: null, clarity: null });
  });
});
