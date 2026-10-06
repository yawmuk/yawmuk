// Micro-study: instrument integrity (items copied verbatim from reviewed content), statistics, the study API
// (enrol/alternate arms/pre/post/withdraw/aggregate/CSV), metrics persistence and the client session helpers.
// Fixture participants below exist only inside this test; nothing is written outside a temp dir.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ITEMS, scoreAnswers, cleanAnswers, PRE_ORDER, POST_ORDER } from '../src/features/study/questions.js';
import { tInterval, welchDiff, tCrit95, aggregate, toCsv, realizedArm, MIN_N } from '../src/features/study/stats.js';
import { miniFileStore, setStudyStore } from '../src/features/study/store-node.js';
import { loadSession, saveSession, readProgress, testedSeen, studyUrl, SESSION_KEY, PROGRESS_KEY } from '../src/features/study/session.js';
import study, { cleanComment } from '../netlify/functions/study.mjs';
import metrics, { normalizeMetric } from '../netlify/functions/metrics.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('study instrument', () => {
  const sits = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'content/script')).filter((x) => x.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/script', f), 'utf8'));
    for (const s of d.situations || []) sits[s.ruling_id] = s;
  }
  const rulingIds = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, 'content/rulings'))) for (const r of JSON.parse(fs.readFileSync(path.join(ROOT, 'content/rulings', f), 'utf8'))) rulingIds.add(r.id);

  it('has 5 distinct concepts, each citing an existing ruling', () => {
    assert.equal(ITEMS.length, 5);
    assert.equal(new Set(ITEMS.map((i) => i.id)).size, 5);
    for (const it of ITEMS) assert.ok(rulingIds.has(it.ruling_id), it.ruling_id);
  });
  it('copies each item verbatim from the reviewed check_question (no invented text)', () => {
    for (const it of ITEMS) {
      const cq = sits[it.ruling_id]?.check_question;
      assert.ok(cq, `no check_question for ${it.ruling_id}`);
      assert.deepEqual(it.q, { ar: cq.q.ar, en: cq.q.en });
      assert.deepEqual(it.options, cq.options.map((o) => ({ ar: o.ar, en: o.en })));
      assert.equal(cq.options[it.correct].correct, true);
      assert.equal(cq.options.filter((o) => o.correct).length, 1);
    }
  });
  it('post order is a reordering of the same items', () => {
    assert.deepEqual([...POST_ORDER].sort(), [...PRE_ORDER].sort());
    assert.notDeepEqual(POST_ORDER, PRE_ORDER);
  });
  it('scores and validates answers', () => {
    const all = Object.fromEntries(ITEMS.map((i) => [i.id, i.correct]));
    assert.equal(scoreAnswers(all), 5);
    assert.equal(scoreAnswers(Object.fromEntries(ITEMS.map((i) => [i.id, -1]))), 0);
    assert.deepEqual(cleanAnswers({ ...all, extra: 1 }), all);
    assert.equal(cleanAnswers({ ...all, maysir: 9 }), null);
    assert.equal(cleanAnswers({ maysir: 1 }), null);
    assert.equal(cleanAnswers([1, 2]), null);
  });
});

describe('study statistics', () => {
  it('t critical values', () => {
    assert.equal(tCrit95(4), 2.776);
    assert.equal(tCrit95(30), 2.042);
    assert.equal(tCrit95(1000), 1.96);
  });
  it('reports insufficient data below MIN_N', () => {
    const r = tInterval([1, 2, 3, 4]);
    assert.equal(MIN_N, 5);
    assert.equal(r.insufficient, true);
    assert.equal(r.lo, undefined);
  });
  it('computes a t-interval', () => {
    // mean 3, sd sqrt(2.5)=1.5811, se=0.7071, t(4)=2.776 -> half 1.963
    const r = tInterval([1, 2, 3, 4, 5]);
    assert.equal(r.mean, 3);
    assert.equal(r.lo, 1.04);
    assert.equal(r.hi, 4.96);
  });
  it('welch difference', () => {
    assert.equal(welchDiff([1, 2], [1, 2, 3, 4, 5]).insufficient, true);
    const d = welchDiff([2, 3, 4, 5, 6], [1, 2, 3, 4, 5]);
    assert.equal(d.diff, 1);
    assert.ok(d.lo < 1 && d.hi > 1);
  });
  it('realized arm from plan source', () => {
    assert.equal(realizedArm('ai'), 'ai');
    assert.equal(realizedArm('fallback'), 'fixed');
    assert.equal(realizedArm('default'), 'fixed');
    assert.equal(realizedArm(undefined), 'unknown');
  });
  it('aggregates, excludes pilots, keeps comments out of the public CSV', () => {
    const correct = Object.fromEntries(ITEMS.map((i) => [i.id, i.correct]));
    const none = Object.fromEntries(ITEMS.map((i) => [i.id, -1]));
    const mk = (code, assigned, src, extra = {}) => ({ id: code, code, created: '2026-10-06T16:00:00Z', lang: 'en', assigned,
      pre: { answers: none, score: 0 }, post: { answers: correct, score: 5, likert: { clarity: 5, respect: 4, next_step: 3 }, comment: '=HYPERLINK("x")', plan_source: src, realized: realizedArm(src), situations_done: 4, at: '2026-10-06T16:20:00Z' }, ...extra });
    const ps = [mk('A', 'ai', 'ai'), mk('B', 'fixed', 'default'), mk('C', 'ai', 'fallback'), mk('P', 'ai', 'ai', { pilot: true }), { id: 'D', assigned: 'fixed', pre: { answers: none, score: 0 }, post: null }];
    const ev = [{ kind: 'event', event: 'ask', outcome: 'refer' }, { kind: 'event', event: 'ask', outcome: 'answered' }, { kind: 'event', event: 'session_start' }, { kind: 'session', arm: 'ai', completed: true, pre: 1, post: 3, clarity: 4 }, { kind: 'event', event: 'bogus' }];
    const a = aggregate(ps, ev);
    assert.equal(a.participants.pilot_excluded, 1);
    assert.equal(a.participants.pre_done, 4);
    assert.equal(a.participants.completed, 3);
    assert.equal(a.participants.arm_mismatch, 1); // C assigned ai, realized fixed
    assert.equal(a.by_realized.ai.completed, 1);
    assert.equal(a.by_realized.fixed.completed, 2);
    assert.equal(a.by_realized.ai.gain.insufficient, true);
    assert.equal(a.gain_diff_ai_minus_fixed.insufficient, true);
    assert.equal(a.telemetry.ask.refer, 1);
    assert.equal(a.telemetry.abstain_or_refer_rate, 0.5);
    assert.equal(a.in_game_measure.ai.n, 1);
    assert.ok(!JSON.stringify(a).includes('HYPERLINK'));
    const csv = toCsv(ps);
    assert.ok(!csv.includes('HYPERLINK'));
    assert.equal(csv.trim().split('\r\n').length, 1 + 4); // header + non-pilot with pre
    const admin = toCsv(ps, { includeComments: true });
    assert.ok(admin.includes(`"'=HYPERLINK(""x"")"`), 'formula neutralised');
  });
});

describe('study API', () => {
  let dir;
  before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yk-study-')); setStudyStore(miniFileStore(dir)); });
  after(() => { setStudyStore(null); fs.rmSync(dir, { recursive: true, force: true }); });
  const call = async (body, { method = 'POST', qs = '', ct = 'application/json' } = {}) => {
    const req = new Request(`http://x/.netlify/functions/study${qs}`, { method, headers: { 'content-type': ct, 'x-yk-client': 't' }, body: method === 'POST' ? JSON.stringify(body) : undefined });
    const res = await study(req);
    const text = await res.text();
    let j = null; try { j = JSON.parse(text); } catch { /* csv */ }
    return { status: res.status, j, text, res };
  };
  const answers = (fn) => Object.fromEntries(ITEMS.map((i) => [i.id, fn(i)]));

  it('alternates arms by enrolment order and ignores pilots for alternation', async () => {
    const a = await call({ action: 'enroll', lang: 'ar' });
    const p = await call({ action: 'enroll', lang: 'en', pilot: true });
    const b = await call({ action: 'enroll', lang: 'en' });
    const c = await call({ action: 'enroll', lang: 'en' });
    assert.equal(a.status, 200);
    assert.match(a.j.id, /^[A-HJ-NP-Z2-9]{10}$/);
    assert.deepEqual([a.j.arm, b.j.arm, c.j.arm], ['ai', 'fixed', 'ai']);
    assert.equal(p.j.pilot, true);
  });
  it('runs pre -> post with server-side scoring and stores the realized arm', async () => {
    const e = await call({ action: 'enroll', lang: 'en' });
    const id = e.j.id;
    assert.equal((await call({ action: 'post', id, answers: answers((i) => i.correct), likert: { clarity: 5, respect: 5, next_step: 5 } })).status, 409, 'post before pre');
    const pre = await call({ action: 'pre', id, answers: answers(() => -1) });
    assert.deepEqual(pre.j, { score: 0, of: 5 });
    assert.equal((await call({ action: 'post', id, answers: answers((i) => i.correct), likert: { clarity: 9, respect: 5, next_step: 5 } })).status, 400, 'likert out of range');
    const post = await call({ action: 'post', id, answers: answers((i) => i.correct), likert: { clarity: 4, respect: 5, next_step: 3 }, comment: 'mail me at a@b.co or +1 555 123 4567', plan_source: 'fallback', situations_done: 4, tested_seen: 2 });
    assert.deepEqual(post.j, { pre: 0, post: 5, gain: 5, of: 5 });
    assert.equal((await call({ action: 'post', id, answers: answers((i) => i.correct), likert: { clarity: 4, respect: 5, next_step: 3 } })).status, 409, 'no double submit');
    const stored = JSON.parse(fs.readFileSync(path.join(dir, 'study_fallback_study.json'), 'utf8'))[id];
    assert.equal(stored.post.realized, 'fixed');
    assert.ok(!stored.post.comment.includes('a@b.co') && !stored.post.comment.includes('555'));
    const agg = await call(null, { method: 'GET', qs: '?view=aggregate' });
    assert.equal(agg.j.participants.completed, 1);
    assert.ok(!agg.text.includes('mail me'));
    const csv = await call(null, { method: 'GET', qs: '?view=csv' });
    assert.match(csv.res.headers.get('content-type'), /text\/csv/);
    assert.ok(!csv.text.includes('mail me'));
    const w = await call({ action: 'withdraw', code: `${id.slice(0, 5)}-${id.slice(5)}` });
    assert.equal(w.j.deleted, true);
    assert.equal((await call({ action: 'pre', id, answers: answers(() => 0) })).status, 404);
  });
  it('rejects bad input', async () => {
    assert.equal((await call({ action: 'enroll' }, { ct: 'text/plain' })).status, 415);
    assert.equal((await call({ action: 'nope' })).status, 400);
    assert.equal((await call({ action: 'pre', id: '../../etc', answers: {} })).status, 400);
    assert.equal((await call(null, { method: 'GET', qs: '?view=secret' })).status, 400);
    assert.equal(cleanComment('   '), null);
    assert.equal(cleanComment('x'.repeat(500)).length, 300);
  });
});

describe('metrics function', () => {
  let dir;
  before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yk-metrics-')); setStudyStore(miniFileStore(dir)); });
  after(() => { setStudyStore(null); fs.rmSync(dir, { recursive: true, force: true }); });
  it('normalises only the two whitelisted shapes', () => {
    assert.deepEqual(normalizeMetric({ event: 'ask', outcome: 'abstain', arm: 'ai' }), { kind: 'event', event: 'ask', outcome: 'abstain', arm: 'ai' });
    assert.equal(normalizeMetric({ event: 'ask', outcome: 'what is riba?' }), null);
    assert.equal(normalizeMetric({ event: 'ask', outcome: 'refer', question: 'x' }), null);
    assert.equal(normalizeMetric({ event: 'hack' }), null);
    assert.deepEqual(normalizeMetric({ arm: 'ai', completed: true, pre: 1, post: 3, clarity: 5 }), { kind: 'session', arm: 'ai', completed: true, pre: 1, post: 3, clarity: 5 });
    assert.equal(normalizeMetric({ arm: 'ai', name: 'x' }), null);
  });
  it('persists accepted records and rejects others', async () => {
    const send = (b) => metrics(new Request('http://x/m', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }));
    assert.equal((await send({ event: 'situation_done', arm: 'fixed' })).status, 204);
    assert.equal((await send({ event: 'ask', outcome: 'refer' })).status, 204);
    assert.equal((await send({ name: 'x' })).status, 400);
    const stored = Object.values(JSON.parse(fs.readFileSync(path.join(dir, 'study_fallback_metrics.json'), 'utf8')));
    assert.equal(stored.length, 2);
    assert.ok(stored.every((r) => r.kind === 'event' && /^\d{4}-\d{2}-\d{2}$/.test(r.day)));
  });
});

describe('study session helpers', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  it('validates the stored session', () => {
    const s = mem();
    assert.equal(loadSession(s), null);
    s.setItem(SESSION_KEY, '{bad');
    assert.equal(loadSession(s), null);
    saveSession(s, { id: 'ABCDE23456', arm: 'fixed', stage: 'playing' });
    assert.equal(loadSession(s).arm, 'fixed');
    saveSession(s, { id: 'abc', arm: 'fixed', stage: 'playing' });
    assert.equal(loadSession(s), null);
    assert.equal(loadSession({ getItem() { throw new Error('blocked'); } }), null);
  });
  it('reads game progress and exposure to tested situations', () => {
    const s = mem();
    assert.deepEqual(readProgress(s), { planSource: null, doneIds: [], finished: false });
    s.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, plan: { source: 'ai' }, finished: true, situations: { 'street.lottery': { done: true }, 'home.mortgage': { done: true }, 'school.cheating': { done: false } } }));
    const p = readProgress(s);
    assert.equal(p.planSource, 'ai');
    assert.equal(p.finished, true);
    assert.equal(p.doneIds.length, 2);
    assert.equal(testedSeen(p.doneIds), 1);
  });
  it('builds the study URL for each arm', () => {
    const u = new URL(studyUrl('https://x.app/?scene=bank&arm=ai&foo=1&study=1', 'fixed', 'ar'));
    assert.equal(u.searchParams.get('arm'), 'fixed');
    assert.equal(u.searchParams.get('study'), '1');
    assert.equal(u.searchParams.get('lang'), 'ar');
    assert.equal(u.searchParams.get('foo'), '1');
    assert.equal(u.searchParams.get('scene'), null);
    assert.equal(new URL(studyUrl('https://x.app/', 'ai', 'en')).searchParams.get('arm'), 'ai');
  });
});
