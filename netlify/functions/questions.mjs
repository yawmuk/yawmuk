// Public side of the human scholarly review loop ("اسأل أهل العلم").
//   POST {action:'submit', question, lang?, nickname?}   -> 201 { ticket }      (no email/phone/IP is stored)
//   POST {action:'delete', ticket}                       -> { deleted }        (delete-on-request, ticket is the bearer)
//   GET  ?tickets=CODE1,CODE2                            -> { items:[{ticket,status,answer,sources,reviewer,title,level,answered_at}] }
//   GET  ?public=1                                       -> { passages:[...] } scholar answers the scholar marked publishable
// The question text is never logged. A rule-based triage (level + related ruling cards) is computed at submission so
// the scholar sees it immediately; the AI triage runs later, on demand, from the dashboard (experts.mjs).
import { getStore } from '../lib/store.mjs';
import { json, readBody } from '../lib/claude.mjs';
import { validateQuestion, newTicket, normalizeTicket, toPassages, limiter, clientKey, LIMITS } from '../../src/features/experts/core.js';
import { ruleTriage } from './experts.mjs';

const perClient = limiter({ max: 5, windowMs: 10 * 60_000 });
const globalLimit = limiter({ max: 300, windowMs: 60 * 60_000 });
const readLimit = limiter({ max: 120, windowMs: 60_000 });
const MAX_OPEN = 3000; // refuse new questions when the unanswered queue is this long (abuse guard)

function publicItem(q) {
  return {
    ticket: q.id,
    question: q.question,
    status: q.status,
    answer: q.status === 'new' ? null : q.answer || '',
    sources: q.status === 'new' ? [] : q.sources || [],
    reviewer: q.status === 'new' ? null : q.reviewer || null,
    title: q.status === 'new' ? null : q.title || null,
    level: q.status === 'new' ? null : q.level || null,
    created_at: q.created_at,
    answered_at: q.answered_at || null
  };
}

export default async (req) => {
  const store = getStore();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    if (!readLimit(clientKey(req))) return json({ error: 'rate_limited' }, 429);
    if (url.searchParams.get('public') === '1') {
      const items = await store.list('questions');
      const passages = toPassages(items).sort((a, b) => String(b.answered_at).localeCompare(String(a.answered_at)));
      return new Response(JSON.stringify({ passages }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' }
      });
    }
    const codes = [...new Set(String(url.searchParams.get('tickets') || '').split(',').map(normalizeTicket).filter(Boolean))].slice(0, LIMITS.TICKETS_MAX);
    if (!codes.length) return json({ error: 'no_tickets' }, 400);
    const items = [];
    for (const c of codes) {
      const q = await store.get('questions', c);
      items.push(q ? publicItem(q) : { ticket: c, status: 'not_found' });
    }
    return json({ items });
  }

  const ct = req.headers.get('content-type') || '';
  if (req.method === 'POST' && !ct.toLowerCase().startsWith('application/json')) return json({ error: 'json_required' }, 415);
  const body = await readBody(req);
  if (body instanceof Response) return body;

  if (body.action === 'delete') {
    const t = normalizeTicket(body.ticket);
    if (!t) return json({ error: 'bad_ticket' }, 400);
    if (!perClient(`del:${clientKey(req)}`)) return json({ error: 'rate_limited' }, 429);
    return json({ deleted: await store.del('questions', t) });
  }

  if (body.action !== 'submit') return json({ error: 'bad_action' }, 400);
  const v = validateQuestion(body);
  if (!v.ok) return json({ error: v.error }, 400);
  if (!perClient(clientKey(req)) || !globalLimit('all')) return json({ error: 'rate_limited' }, 429);
  const all = await store.list('questions');
  if (all.filter((q) => q.status === 'new').length >= MAX_OPEN) return json({ error: 'queue_full' }, 503);

  let id = newTicket();
  while (await store.get('questions', id)) id = newTicket();
  const now = new Date().toISOString();
  await store.put('questions', id, {
    id, ...v.value, status: 'new', created_at: now, updated_at: now,
    triage: { rule: ruleTriage(v.value.question), ai: null },
    answer: '', sources: [], level: null, reviewer: '', title: '', publish: false, public_question: '', answered_at: null
  });
  return json({ ticket: id }, 201);
};
