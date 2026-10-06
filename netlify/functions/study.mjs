// Opt-in micro-study API (Track-3 success metric: measured understanding gain, AI-personalised vs fixed journey).
// Anonymous by design: a random participant id is the only key; no name, contact, IP, user agent, religion or belief
// is stored. The x-yk-client header is used only for in-memory rate limiting and never persisted.
//   POST {action:'enroll', lang, pilot?}                    -> { id, code, arm }   arm alternates by enrolment order
//   POST {action:'pre', id, answers}                        -> { score }           answers: itemId -> option index | -1
//   POST {action:'post', id, answers, likert{clarity,respect,next_step}, comment?, plan_source?, situations_done?, tested_seen?}
//                                                           -> { pre, post, gain }
//   POST {action:'withdraw', id | code}                     -> { deleted }         participant deletes their own record
//   GET  ?view=aggregate                                    -> live aggregates for /results.html (no free text)
//   GET  ?view=csv                                          -> per-participant CSV (no free text unless x-study-key = STUDY_ADMIN_KEY)
import crypto from 'node:crypto';
import { studyStore, rateLimiter } from '../../src/features/study/store-node.js';
import { cleanAnswers, scoreAnswers, ITEMS } from '../../src/features/study/questions.js';
import { aggregate, toCsv, realizedArm } from '../../src/features/study/stats.js';

const COLL = 'study';
const METRICS = 'metrics';
const writeLimit = rateLimiter({ max: 40, windowMs: 10 * 60_000 });
const enrollGlobal = rateLimiter({ max: 300, windowMs: 60 * 60_000 });
const MAX_BODY = 8 * 1024;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCode() { return [...crypto.randomBytes(10)].map((b) => CODE_ALPHA[b & 31]).join(''); }
const CODE_RE = /^[A-HJ-NP-Z2-9]{10}$/;
const normCode = (s) => { const c = String(s ?? '').toUpperCase().replace(/[\s-]/g, ''); return CODE_RE.test(c) ? c : null; };

// enrolment is serialised in-process so alternation by count cannot double-assign under concurrent requests
let enrollChain = Promise.resolve();
const serial = (fn) => { const p = enrollChain.then(fn, fn); enrollChain = p.catch(() => {}); return p; };

function likertOf(v) { return Number.isInteger(v) && v >= 1 && v <= 5 ? v : null; }
/** Strip obvious contact details from the optional comment; cap length. Stored only, never published. */
export function cleanComment(s) {
  if (typeof s !== 'string') return null;
  const t = s.replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')
    .trim().slice(0, 300);
  return t || null;
}

async function readJson(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try { const o = JSON.parse(text); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}

export default async (req) => {
  const url = new URL(req.url);
  let store;
  try { store = await studyStore(); } catch { return json({ error: 'store_unavailable' }, 503); }

  if (req.method === 'GET') {
    const view = url.searchParams.get('view') || 'aggregate';
    try {
      const participants = await store.list(COLL);
      if (view === 'csv') {
        const admin = process.env.STUDY_ADMIN_KEY;
        const given = req.headers.get('x-study-key') || '';
        const includeComments = !!admin && given.length === admin.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(admin));
        return new Response(toCsv(participants, { includeComments }), {
          headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="yawmuk-study.csv"', 'cache-control': 'no-store' }
        });
      }
      if (view === 'aggregate') {
        let events = [];
        try { events = await store.list(METRICS); } catch { /* telemetry optional */ }
        return json({ ...aggregate(participants, events), store: store.kind || 'unknown' });
      }
      return json({ error: 'unknown_view' }, 400);
    } catch (e) {
      console.error('study: read failed', e?.message);
      return json({ error: 'store_error' }, 500);
    }
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!String(req.headers.get('content-type') || '').includes('application/json')) return json({ error: 'json_required' }, 415);
  if (!writeLimit(req.headers.get('x-yk-client') || 'anon')) return json({ error: 'rate_limited' }, 429);
  const body = await readJson(req);
  if (!body) return json({ error: 'bad_json' }, 400);

  try {
    switch (body.action) {
      case 'enroll': {
        if (!enrollGlobal('all')) return json({ error: 'rate_limited' }, 429);
        return await serial(async () => {
          const existing = await store.list(COLL);
          const pilot = body.pilot === true;
          // alternate by enrolment order among real (non-pilot) participants: 1st -> ai, 2nd -> fixed, ...
          const n = existing.filter((p) => p && !p.pilot).length;
          const arm = pilot ? (existing.filter((p) => p?.pilot).length % 2 ? 'fixed' : 'ai') : (n % 2 === 0 ? 'ai' : 'fixed');
          const code = newCode();
          const doc = { id: code, code, created: new Date().toISOString(), lang: body.lang === 'ar' ? 'ar' : 'en', assigned: arm, pilot, pre: null, post: null };
          await store.put(COLL, code, doc);
          return json({ id: code, code, arm, pilot });
        });
      }
      case 'pre': {
        const id = normCode(body.id);
        const answers = cleanAnswers(body.answers);
        if (!id || !answers) return json({ error: 'bad_request' }, 400);
        const doc = await store.get(COLL, id);
        if (!doc) return json({ error: 'not_found' }, 404);
        if (doc.post) return json({ error: 'already_completed' }, 409);
        doc.pre = { answers, score: scoreAnswers(answers), at: new Date().toISOString() };
        await store.put(COLL, id, doc);
        return json({ score: doc.pre.score, of: ITEMS.length });
      }
      case 'post': {
        const id = normCode(body.id);
        const answers = cleanAnswers(body.answers);
        const l = body.likert || {};
        const likert = { clarity: likertOf(l.clarity), respect: likertOf(l.respect), next_step: likertOf(l.next_step) };
        if (!id || !answers || Object.values(likert).some((v) => v == null)) return json({ error: 'bad_request' }, 400);
        const doc = await store.get(COLL, id);
        if (!doc) return json({ error: 'not_found' }, 404);
        if (!doc.pre) return json({ error: 'pre_missing' }, 409);
        if (doc.post) return json({ error: 'already_completed' }, 409);
        const planSource = ['ai', 'default', 'fallback'].includes(body.plan_source) ? body.plan_source : null;
        const sitDone = Number.isInteger(body.situations_done) && body.situations_done >= 0 && body.situations_done <= 100 ? body.situations_done : null;
        const seen = Number.isInteger(body.tested_seen) && body.tested_seen >= 0 && body.tested_seen <= ITEMS.length ? body.tested_seen : null;
        doc.post = {
          answers, score: scoreAnswers(answers), likert, comment: cleanComment(body.comment),
          plan_source: planSource, realized: realizedArm(planSource), situations_done: sitDone, tested_seen: seen, at: new Date().toISOString()
        };
        await store.put(COLL, id, doc);
        return json({ pre: doc.pre.score, post: doc.post.score, gain: doc.post.score - doc.pre.score, of: ITEMS.length });
      }
      case 'withdraw': {
        const id = normCode(body.id ?? body.code);
        if (!id) return json({ error: 'bad_request' }, 400);
        return json({ deleted: await store.del(COLL, id) });
      }
      default:
        return json({ error: 'unknown_action' }, 400);
    }
  } catch (e) {
    console.error('study: write failed', e?.message);
    return json({ error: 'store_error' }, 500);
  }
};
