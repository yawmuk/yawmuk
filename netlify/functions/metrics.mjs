// POST /.netlify/functions/metrics  ->  204. Consented, anonymous measurement; two accepted shapes only:
//  1) end-of-day measure (game end screen, after the player switched the consent toggle on):
//       { arm:'ai'|'fixed', completed, pre, post, clarity }  — re-normalised to exactly these five fields
//  2) study telemetry (sent by src/features/study/track.js only while a study participant is enrolled):
//       { event:'session_start'|'situation_done'|'journey_done'|'ask', outcome?:'answered'|'abstain'|'refer'|'error', arm?:'ai'|'fixed' }
// No ids, no IP, no user agent, no belief, no question text. Every accepted record is logged and, when a store is
// available, persisted in the "metrics" collection (aggregated on /results.html). Anything else -> 400.
import crypto from 'node:crypto';
import { metricsPayload } from '../../src/engine/aiCore.js';
import { readBody } from '../lib/claude.mjs';
import { studyStore } from '../../src/features/study/store-node.js';

const SESSION_KEYS = ['arm', 'completed', 'pre', 'post', 'clarity'];
const EVENT_KEYS = ['event', 'outcome', 'arm'];
export const EVENTS = ['session_start', 'situation_done', 'journey_done', 'ask'];
export const OUTCOMES = ['answered', 'abstain', 'refer', 'error'];

/** Normalise a body to one of the two shapes, or null. */
export function normalizeMetric(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if ('event' in body) {
    if (!keys.every((k) => EVENT_KEYS.includes(k)) || !EVENTS.includes(body.event)) return null;
    const rec = { kind: 'event', event: body.event };
    if (body.event === 'ask') {
      if (!OUTCOMES.includes(body.outcome)) return null;
      rec.outcome = body.outcome;
    }
    if (body.arm === 'ai' || body.arm === 'fixed') rec.arm = body.arm;
    return rec;
  }
  if (!keys.every((k) => SESSION_KEYS.includes(k))) return null;
  return { kind: 'session', ...metricsPayload(body) };
}

export default async (req) => {
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const rec = normalizeMetric(body);
  if (!rec) return new Response(null, { status: 400 });
  console.log(JSON.stringify({ yawmuk_metric: rec }));
  try {
    const store = await studyStore();
    const id = `m${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`;
    await store.put('metrics', id, { ...rec, day: new Date().toISOString().slice(0, 10) });
  } catch (e) {
    console.error('metrics: not persisted', e?.message); // the log line above is still the record
  }
  return new Response(null, { status: 204 });
};
