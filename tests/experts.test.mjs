// Human scholarly review loop: store, public questions API, scholar API (auth, CSRF, answer, triage, reviews), core helpers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileStore, setStore } from '../netlify/lib/store.mjs';
import questions from '../netlify/functions/questions.mjs';
import experts, { ruleTriage, makeSession, verifySession, loadRulings } from '../netlify/functions/experts.mjs';
import {
  validateQuestion, newTicket, normalizeTicket, formatTicket, addTicket, loadTickets, removeTicket, validateAnswerForm,
  validateReviewForm, latestReviews, toPassages, limiter, cleanText, TICKET_RE
} from '../src/features/experts/core.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yk-experts-'));
const BASE = 'http://localhost:8080/.netlify/functions';
const saved = { ...process.env };
let n = 0;
const ip = () => `10.0.0.${++n}`; // fresh rate-limit key per request group

before(() => {
  setStore(fileStore(dir));
  process.env.EXPERTS_PASSCODE = 'correct horse battery staple';
  process.env.SESSION_SECRET = 'test-secret-0123456789abcdef';
  delete process.env.ANTHROPIC_API_KEY; // AI triage must degrade cleanly without a key
});
after(() => { setStore(null); process.env = saved; fs.rmSync(dir, { recursive: true, force: true }); });

const post = (fn, body, { client = ip(), cookie, headers = {} } = {}) => fn(new Request(`${BASE}/x`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-yk-client': client, ...(cookie ? { cookie } : {}), ...headers }, body: JSON.stringify(body)
}));
const get = (fn, query, { cookie, client = ip() } = {}) => fn(new Request(`${BASE}/x${query}`, { headers: { 'x-yk-client': client, ...(cookie ? { cookie } : {}) } }));
async function login() {
  const r = await post(experts, { action: 'login', passcode: process.env.EXPERTS_PASSCODE });
  assert.equal(r.status, 200);
  const sc = r.headers.get('set-cookie');
  assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Strict/); assert.match(sc, /Path=\/\.netlify\/functions\/experts/);
  return sc.split(';')[0];
}

// ---------------------------------------------------------------- core
test('core: question validation, cleaning and limits', () => {
  assert.equal(validateQuestion({ question: 'short' }).error, 'too_short');
  assert.equal(validateQuestion({ question: 'x'.repeat(1001) }).error, 'too_long');
  const v = validateQuestion({ question: '  ما حكم ‮الربا\u0000 في البنوك؟  ', lang: 'xx', nickname: '  أبو   علي  ' });
  assert.ok(v.ok);
  assert.equal(v.value.question, 'ما حكم الربا في البنوك؟');
  assert.equal(v.value.lang, 'other');
  assert.equal(v.value.nickname, 'أبو علي');
  assert.equal(cleanText('a\n\n\n\nb'), 'a\n\nb');
});

test('core: tickets have 60 bits, normalise, format, and live in storage', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) { const t = newTicket(); assert.match(t, TICKET_RE); seen.add(t); }
  assert.equal(seen.size, 200);
  const t = newTicket();
  assert.equal(normalizeTicket(formatTicket(t).toLowerCase()), t);
  assert.equal(normalizeTicket('ABC'), null);
  assert.equal(normalizeTicket('OOOO-OOOO-OOOO'), null); // O is not in the alphabet
  const mem = new Map(); const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  addTicket(st, t); addTicket(st, t); addTicket(st, 'bad');
  assert.deepEqual(loadTickets(st), [t]);
  assert.deepEqual(removeTicket(st, t), []);
  assert.deepEqual(loadTickets(null), []);
  assert.deepEqual(loadTickets({ getItem: () => '{nope' }), []);
});

test('core: answer form rules (https sources only, publish never for level D / non-answered)', () => {
  const ok = { status: 'answered', answer: 'إجابة كافية الطول هنا', sources: ['https://dorar.net/hadith/sharh/1'], level: 'B', reviewer: 'د. فلان', publish: true, public_question: 'ما حكم كذا وكذا؟' };
  assert.ok(validateAnswerForm(ok).ok);
  assert.equal(validateAnswerForm({ ...ok, sources: ['javascript:alert(1)'] }).error, 'bad_source_url');
  assert.equal(validateAnswerForm({ ...ok, sources: ['http://dorar.net/x'] }).error, 'bad_source_url');
  assert.equal(validateAnswerForm({ ...ok, sources: Array(11).fill('https://dorar.net/x') }).error, 'too_many_sources');
  assert.equal(validateAnswerForm({ ...ok, reviewer: '' }).error, 'reviewer_required');
  assert.equal(validateAnswerForm({ ...ok, level: 'Z' }).error, 'bad_level');
  assert.equal(validateAnswerForm({ ...ok, status: 'new' }).error, 'bad_status');
  assert.equal(validateAnswerForm({ ...ok, answer: 'x'.repeat(3001) }).error, 'answer_too_long');
  assert.equal(validateAnswerForm({ ...ok, level: 'D' }).value.publish, false);
  assert.equal(validateAnswerForm({ ...ok, status: 'referred' }).value.publish, false);
  assert.ok(validateAnswerForm({ ...ok, status: 'referred', answer: '' }).ok); // a referral needs no answer text
});

test('core: review form, latest public review per ruling, needs_changes withdraws the badge', () => {
  const ids = ['home.mortgage', 'street.lottery'];
  assert.equal(validateReviewForm({ ruling_id: 'x', verdict: 'reviewed', reviewer: 'ab' }, ids).error, 'bad_ruling');
  assert.equal(validateReviewForm({ ruling_id: 'home.mortgage', verdict: 'reviewed_with_notes', reviewer: 'ab' }, ids).error, 'notes_required');
  const recs = [
    { ruling_id: 'home.mortgage', verdict: 'reviewed', reviewer: 'A', at: '2026-10-06T10:00:00Z' },
    { ruling_id: 'home.mortgage', verdict: 'needs_changes', reviewer: 'B', at: '2026-10-06T11:00:00Z' },
    { ruling_id: 'street.lottery', verdict: 'reviewed', reviewer: 'C', at: '2026-10-06T09:00:00Z' },
    { ruling_id: 'street.lottery', verdict: 'reviewed_with_notes', reviewer: 'D', title: 'Dr', at: '2026-10-06T12:00:00Z' }
  ];
  const l = latestReviews(recs);
  assert.equal(l['home.mortgage'], undefined);
  assert.equal(l['street.lottery'].reviewer, 'D');
  assert.equal('notes' in l['street.lottery'], false); // scholar notes stay private
});

test('core: published answers become passages with ids the ask function accepts', () => {
  const t = newTicket();
  const p = toPassages([
    { id: t, publish: true, status: 'answered', answer: 'A', public_question: 'Q?', sources: [], level: 'B' },
    { id: newTicket(), publish: false, status: 'answered', answer: 'A' },
    { id: newTicket(), publish: true, status: 'referred', answer: 'A' }
  ]);
  assert.equal(p.length, 1);
  assert.match(p[0].id, /^[a-z]:[\w.:-]{1,80}$/i);
  assert.equal(p[0].id, `x:${t}`);
});

test('core: limiter is a fixed window', () => {
  let now = 0; const lim = limiter({ max: 2, windowMs: 1000, now: () => now });
  assert.ok(lim('a')); assert.ok(lim('a')); assert.equal(lim('a'), false); assert.ok(lim('b'));
  now = 1000; assert.ok(lim('a'));
});

// ---------------------------------------------------------------- store
test('store: file adapter round-trips, isolates copies, rejects path tricks, survives a new instance', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'yk-store-'));
  const s = fileStore(d);
  await Promise.all(Array.from({ length: 20 }, (_, i) => s.put('c', `id${i}`, { i })));
  const doc = await s.get('c', 'id3'); doc.i = 999;
  assert.equal((await s.get('c', 'id3')).i, 3);
  assert.equal((await s.list('c')).length, 20);
  assert.equal(await s.del('c', 'id3'), true);
  assert.equal(await s.del('c', 'id3'), false);
  await assert.rejects(() => s.get('../etc', 'x'));
  await assert.rejects(() => s.put('c', '../../x', {}));
  assert.equal((await fileStore(d).list('c')).length, 19);
  fs.rmSync(d, { recursive: true, force: true });
});

// ---------------------------------------------------------------- triage
test('triage: personal case -> level D; topical question -> related ruling cards', () => {
  assert.ok(loadRulings().length >= 7);
  const p = ruleTriage('I live in Ohio, can I take this mortgage for my family?');
  assert.equal(p.level, 'D'); assert.equal(p.personal, true);
  const t = ruleTriage('ما حكم القرض العقاري بفائدة لشراء بيت في أمريكا؟');
  assert.equal(t.related[0].id, 'home.mortgage');
  assert.match(t.note, /اقتراح آلي يحتاج مراجعة/);
});

// ---------------------------------------------------------------- public API end to end
test('questions API: submit -> status -> scholar answers + publishes -> public passages -> delete', async () => {
  const bad = await post(questions, { action: 'submit', question: 'hi' });
  assert.equal(bad.status, 400);
  const form = await questions(new Request(`${BASE}/questions`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'action=submit&question=xxxxxxxxxxxxxxxx' }));
  assert.equal(form.status, 415); // cross-site forms cannot post here

  const r = await post(questions, { action: 'submit', question: 'لماذا يتجه المسلمون إلى الكعبة في الصلاة؟', lang: 'ar', nickname: 'زائر', email: 'x@y.z' });
  assert.equal(r.status, 201);
  const { ticket } = await r.json();
  assert.match(ticket, TICKET_RE);
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'questions.json'), 'utf8'))[ticket];
  assert.equal(raw.email, undefined); // unknown fields are never stored
  assert.equal(raw.status, 'new');
  assert.ok(raw.triage.rule.level);

  let s = await (await get(questions, `?tickets=${formatTicket(ticket)},NOPE,${newTicket()}`)).json();
  assert.equal(s.items.length, 2);
  assert.equal(s.items[0].status, 'new'); assert.equal(s.items[0].answer, null);
  assert.equal(s.items[0].nickname, undefined);
  assert.equal(s.items[1].status, 'not_found');

  // scholar side
  assert.equal((await get(experts, '?view=queue')).status, 401);
  const cookie = await login();
  const q = await (await get(experts, '?view=queue&status=new', { cookie })).json();
  assert.ok(q.items.some((x) => x.id === ticket));
  assert.equal(q.counts.new >= 1, true);

  const tri = await (await post(experts, { action: 'triage', id: ticket }, { cookie })).json();
  assert.equal(tri.ai_error, 'no_key'); // no key: rule triage still there, AI clearly unavailable
  assert.ok(tri.item.triage.rule);

  const xss = '<img src=x onerror=alert(1)>';
  const ans = await post(experts, {
    action: 'answer', id: ticket, status: 'answered', level: 'A', answer: `الكعبة قبلة يتجه إليها المسلمون والعبادة لله وحده. ${xss}`,
    sources: ['https://dorar.net/aqadia/1'], reviewer: 'د. مراجع', title: 'عضو اللجنة', publish: true, public_question: 'لماذا يتجه المسلمون إلى الكعبة؟'
  }, { cookie });
  assert.equal(ans.status, 200);

  s = await (await get(questions, `?tickets=${ticket}`)).json();
  assert.equal(s.items[0].status, 'answered'); assert.equal(s.items[0].reviewer, 'د. مراجع');
  assert.ok(s.items[0].answer.includes(xss)); // stored verbatim, rendered with textContent by both UIs

  const pub = await (await get(questions, '?public=1')).json();
  const mine = pub.passages.find((p) => p.id === `x:${ticket}`);
  assert.ok(mine); assert.equal(mine.question, 'لماذا يتجه المسلمون إلى الكعبة؟');
  assert.equal(JSON.stringify(pub).includes('زائر'), false); // nickname never public

  const del = await (await post(questions, { action: 'delete', ticket })).json();
  assert.equal(del.deleted, true);
  s = await (await get(questions, `?tickets=${ticket}`)).json();
  assert.equal(s.items[0].status, 'not_found');
});

test('questions API: per-client rate limit', async () => {
  const client = '203.0.113.9';
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await post(questions, { action: 'submit', question: `سؤال تجريبي رقم ${i} عن الصلاة` }, { client })).status);
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 429]);
});

// ---------------------------------------------------------------- auth & CSRF
test('experts API: passcode, signed session, CSRF guards, ruling review records', async () => {
  assert.equal((await post(experts, { action: 'login', passcode: 'wrong' })).status, 401);
  const forged = `yk_experts=${Date.now() + 1e7}.AAAAAAAAAAAAAAAA.${'A'.repeat(43)}`;
  assert.equal((await get(experts, '?view=queue', { cookie: forged })).status, 401);
  const T = 1_790_000_000_000;
  assert.equal(verifySession('s', makeSession('s', T), T + 10), true);
  assert.equal(verifySession('s', makeSession('s', T), T + 9 * 3600_000), false); // expired after 8h
  assert.equal(verifySession('other', makeSession('s')), false);

  const cookie = await login();
  const cross = await post(experts, { action: 'delete', id: newTicket() }, { cookie, headers: { origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
  const formPost = await experts(new Request(`${BASE}/experts`, { method: 'POST', headers: { 'content-type': 'text/plain', cookie }, body: '{"action":"delete"}' }));
  assert.equal(formPost.status, 415);

  assert.equal((await post(experts, { action: 'review', ruling_id: 'home.mortgage', verdict: 'reviewed', reviewer: 'x' })).status, 401);
  const rv = await post(experts, { action: 'review', ruling_id: 'home.mortgage', verdict: 'reviewed_with_notes', reviewer: 'الشيخ فلان', title: 'عضو هيئة', notes: 'صياغة الخلاف جيدة' }, { cookie });
  assert.equal(rv.status, 200);
  const pub = await (await get(experts, '?view=reviews')).json();
  assert.equal(pub.reviews['home.mortgage'].reviewer, 'الشيخ فلان');
  assert.equal(pub.reviews['home.mortgage'].notes, undefined);
  const rl = await (await get(experts, '?view=rulings', { cookie })).json();
  assert.equal(rl.items.length, loadRulings().length);
  assert.equal(rl.items.find((x) => x.id === 'home.mortgage').records.length, 1);

  const out = await post(experts, { action: 'logout' }, { cookie });
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
});

test('experts API: not configured -> 503, never logs in', async () => {
  const pc = process.env.EXPERTS_PASSCODE;
  delete process.env.EXPERTS_PASSCODE;
  try {
    assert.equal((await post(experts, { action: 'login', passcode: '' })).status, 503);
    assert.equal((await (await get(experts, '?view=me')).json()).authed, false);
  } finally { process.env.EXPERTS_PASSCODE = pc; }
});
