// DOM-free logic shared by the player panel, the scholar dashboard and the server functions
// (questions.mjs / experts.mjs). No imports, so it runs in the browser, in Node functions and in node:test.

export const LIMITS = {
  QUESTION_MIN: 8, QUESTION_MAX: 1000, NICK_MAX: 40,
  ANSWER_MIN: 10, ANSWER_MAX: 3000, SOURCES_MAX: 10, URL_MAX: 300,
  REVIEWER_MAX: 80, TITLE_MAX: 120, NOTES_MAX: 1500, TICKETS_MAX: 20
};
export const STATUSES = ['new', 'answered', 'referred', 'out_of_scope'];
export const ANSWER_STATUSES = ['answered', 'referred', 'out_of_scope'];
export const REVIEW_VERDICTS = ['reviewed', 'reviewed_with_notes', 'needs_changes'];
/** Content levels of the challenge's scientific reference package (أ/ب/ج/د). */
export const LEVELS = {
  A: { ar: 'أ', name: { ar: 'معلومات أصلية مستقرة', en: 'Settled core information' } },
  B: { ar: 'ب', name: { ar: 'شرح وتعريف واستدلال', en: 'Explanation and reasoning' } },
  C: { ar: 'ج', name: { ar: 'مسألة خلافية أو عالية الحساسية', en: 'Differing views / high sensitivity' } },
  D: { ar: 'د', name: { ar: 'فتوى أو حالة شخصية — إحالة', en: 'Personal case / fatwa — refer' } }
};
export const LANGS = ['ar', 'en', 'other'];

// Control chars (except newline/tab), bidi overrides and zero-width chars are stripped from every free text.
// eslint-disable-next-line no-control-regex
const STRIP = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩​⁠﻿]/g;
export function cleanText(s, max) {
  if (typeof s !== 'string') return '';
  const t = s.replace(STRIP, '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return max ? t.slice(0, max) : t;
}

/** Player submission -> { ok:true, value:{question, lang, nickname} } | { ok:false, error } */
export function validateQuestion(input = {}) {
  const raw = typeof input.question === 'string' ? input.question : '';
  if (cleanText(raw).length > LIMITS.QUESTION_MAX) return { ok: false, error: 'too_long' };
  const question = cleanText(raw, LIMITS.QUESTION_MAX);
  if (question.length < LIMITS.QUESTION_MIN) return { ok: false, error: 'too_short' };
  const lang = LANGS.includes(input.lang) ? input.lang : 'other';
  const nickname = cleanText(input.nickname, LIMITS.NICK_MAX).replace(/\s+/g, ' ');
  return { ok: true, value: { question, lang, nickname } };
}

// ---------------------------------------------------------------- ticket codes (bearer: view + delete)
// 12 chars from a 32-symbol alphabet (no 0/O/1/I) = 60 bits of entropy.
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TICKET_RE = /^[A-HJ-NP-Z2-9]{12}$/;
export function newTicket(rand = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  return [...rand(12)].map((b) => ALPHA[b & 31]).join('');
}
export function normalizeTicket(s) {
  const t = String(s ?? '').toUpperCase().replace(/[\s-]/g, '');
  return TICKET_RE.test(t) ? t : null;
}
export const formatTicket = (t) => `${t.slice(0, 4)}-${t.slice(4, 8)}-${t.slice(8, 12)}`;

// ---------------------------------------------------------------- player's ticket list (localStorage)
const KEY = 'yawmuk.experts.tickets.v1';
export function loadTickets(storage) {
  try {
    const v = JSON.parse(storage?.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.map(normalizeTicket).filter(Boolean).slice(0, LIMITS.TICKETS_MAX) : [];
  } catch { return []; }
}
export function addTicket(storage, code) {
  const t = normalizeTicket(code);
  if (!t) return loadTickets(storage);
  const list = [t, ...loadTickets(storage).filter((x) => x !== t)].slice(0, LIMITS.TICKETS_MAX);
  try { storage?.setItem(KEY, JSON.stringify(list)); } catch { /* private mode: list lives for this session only */ }
  return list;
}
export function removeTicket(storage, code) {
  const t = normalizeTicket(code);
  const list = loadTickets(storage).filter((x) => x !== t);
  try { storage?.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

// ---------------------------------------------------------------- scholar answer validation
export function validUrl(u) {
  if (typeof u !== 'string' || u.length > LIMITS.URL_MAX) return null;
  try {
    const x = new URL(u.trim());
    return x.protocol === 'https:' && x.hostname.includes('.') && !x.username && !x.password ? x.href : null;
  } catch { return null; }
}
/** Scholar's answer form -> { ok, value | error }. Publishing is only possible for an answered, non-personal (level != D) item. */
export function validateAnswerForm(input = {}) {
  const status = ANSWER_STATUSES.includes(input.status) ? input.status : null;
  if (!status) return { ok: false, error: 'bad_status' };
  const answer = cleanText(input.answer, LIMITS.ANSWER_MAX + 1);
  if (answer.length > LIMITS.ANSWER_MAX) return { ok: false, error: 'answer_too_long' };
  if (status === 'answered' && answer.length < LIMITS.ANSWER_MIN) return { ok: false, error: 'answer_required' };
  const rawSources = Array.isArray(input.sources) ? input.sources : String(input.sources ?? '').split(/\s*\n\s*/);
  const nonEmpty = rawSources.filter((s) => typeof s === 'string' && s.trim());
  if (nonEmpty.length > LIMITS.SOURCES_MAX) return { ok: false, error: 'too_many_sources' };
  const sources = nonEmpty.map(validUrl);
  if (sources.some((s) => !s)) return { ok: false, error: 'bad_source_url' };
  const level = Object.hasOwn(LEVELS, input.level) ? input.level : null;
  if (!level) return { ok: false, error: 'bad_level' };
  const reviewer = cleanText(input.reviewer, LIMITS.REVIEWER_MAX).replace(/\s+/g, ' ');
  if (reviewer.length < 2) return { ok: false, error: 'reviewer_required' };
  const title = cleanText(input.title, LIMITS.TITLE_MAX).replace(/\s+/g, ' ');
  const publish = input.publish === true && status === 'answered' && level !== 'D';
  const public_question = publish ? cleanText(input.public_question, LIMITS.QUESTION_MAX) : '';
  if (publish && public_question.length < LIMITS.QUESTION_MIN) return { ok: false, error: 'public_question_required' };
  return { ok: true, value: { status, answer, sources: [...new Set(sources)], level, reviewer, title, publish, public_question } };
}

export function validateReviewForm(input = {}, rulingIds = []) {
  const ruling_id = typeof input.ruling_id === 'string' && rulingIds.includes(input.ruling_id) ? input.ruling_id : null;
  if (!ruling_id) return { ok: false, error: 'bad_ruling' };
  const verdict = REVIEW_VERDICTS.includes(input.verdict) ? input.verdict : null;
  if (!verdict) return { ok: false, error: 'bad_verdict' };
  const reviewer = cleanText(input.reviewer, LIMITS.REVIEWER_MAX).replace(/\s+/g, ' ');
  if (reviewer.length < 2) return { ok: false, error: 'reviewer_required' };
  const title = cleanText(input.title, LIMITS.TITLE_MAX).replace(/\s+/g, ' ');
  const notes = cleanText(input.notes, LIMITS.NOTES_MAX);
  if (verdict !== 'reviewed' && notes.length < 3) return { ok: false, error: 'notes_required' };
  return { ok: true, value: { ruling_id, verdict, reviewer, title, notes } };
}

/** Latest public review per ruling: only verdicts that mean "a scholar read it and stands behind it (with notes)". */
export function latestReviews(records = []) {
  const out = {};
  for (const r of [...records].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    if (!r?.ruling_id) continue;
    if (r.verdict === 'needs_changes') { delete out[r.ruling_id]; continue; } // a later "needs changes" withdraws the badge
    if (r.verdict === 'reviewed' || r.verdict === 'reviewed_with_notes') {
      out[r.ruling_id] = { reviewer: r.reviewer, title: r.title || '', verdict: r.verdict, at: r.at };
    }
  }
  return out;
}

/** Published scholar answers -> passages the in-game guide may answer from (ids match ask.mjs's /^[a-z]:[\w.:-]{1,80}$/i). */
export function toPassages(items = []) {
  return items.filter((q) => q && q.publish && q.status === 'answered' && q.answer && TICKET_RE.test(q.id)).map((q) => ({
    id: `x:${q.id}`,
    lang: q.lang,
    question: q.public_question,
    text: `${q.public_question}\n${q.answer}`,
    sources: q.sources || [],
    reviewer: q.reviewer,
    title: q.title || '',
    level: q.level,
    answered_at: q.answered_at
  }));
}

// ---------------------------------------------------------------- in-memory fixed-window rate limiter
export function limiter({ max, windowMs, now = () => Date.now() }) {
  const hits = new Map();
  const hit = (key = 'anon') => {
    const t = now();
    const h = hits.get(key);
    if (!h || t - h.start >= windowMs) {
      if (hits.size > 5000) hits.clear(); // bounded memory
      hits.set(key, { start: t, n: 1 });
      return true;
    }
    h.n += 1;
    return h.n <= max;
  };
  /** True while `key` is still under the limit, without counting a hit. */
  hit.peek = (key = 'anon') => {
    const h = hits.get(key);
    return !h || now() - h.start >= windowMs || h.n < max;
  };
  /** Forget `key` (e.g. after a successful login). */
  hit.reset = (key = 'anon') => { hits.delete(key); };
  return hit;
}

/** Rate-limit key for a Web Request. server.mjs sets x-yk-client (overwriting any client value); Netlify sets its own header. Never stored. */
export const clientKey = (req) => req.headers.get('x-yk-client') || req.headers.get('x-nf-client-connection-ip') || 'anon';
