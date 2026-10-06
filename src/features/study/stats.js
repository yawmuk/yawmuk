// Pure statistics + aggregation for the micro-study (no DOM, no I/O). Used by netlify/functions/study.mjs to build
// the /results.html dashboard and the CSV export, and by tests/study.test.mjs. Nothing here invents data: every
// number is computed from stored submissions, and any estimate with fewer than MIN_N observations is reported as
// insufficient instead of being shown.
import { ITEMS } from './questions.js';

export const MIN_N = 5;
export const ARMS = ['ai', 'fixed'];

// Two-sided 95% critical values of Student's t, df = 1..30.
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export function tCrit95(df) {
  const d = Math.floor(df);
  if (!Number.isFinite(d) || d < 1) return NaN;
  if (d <= 30) return T95[d - 1];
  if (d <= 40) return 2.021;
  if (d <= 60) return 2.0;
  if (d <= 120) return 1.98;
  return 1.96;
}

const nums = (xs) => (xs || []).filter((x) => typeof x === 'number' && Number.isFinite(x));
export function mean(xs) { const v = nums(xs); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
export function sd(xs) {
  const v = nums(xs);
  if (v.length < 2) return null;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

/** Mean with a 95% t-interval. Fewer than minN values -> { n, mean, insufficient: true } (no interval). */
export function tInterval(xs, minN = MIN_N) {
  const v = nums(xs);
  const n = v.length;
  const m = mean(v);
  if (n < minN) return { n, mean: r2(m), insufficient: true };
  const s = sd(v);
  const half = tCrit95(n - 1) * s / Math.sqrt(n);
  return { n, mean: r2(m), sd: r2(s), lo: r2(m - half), hi: r2(m + half), insufficient: false };
}

/** Welch two-sample difference of means (a - b) with a 95% interval; insufficient if either group < minN. */
export function welchDiff(a, b, minN = MIN_N) {
  const x = nums(a), y = nums(b);
  if (x.length < minN || y.length < minN) return { na: x.length, nb: y.length, insufficient: true };
  const va = sd(x) ** 2 / x.length, vb = sd(y) ** 2 / y.length;
  const diff = mean(x) - mean(y);
  const se = Math.sqrt(va + vb);
  if (se === 0) return { na: x.length, nb: y.length, diff: r2(diff), lo: r2(diff), hi: r2(diff), df: null, insufficient: false };
  const df = (va + vb) ** 2 / ((va ** 2) / (x.length - 1) + (vb ** 2) / (y.length - 1));
  const half = tCrit95(df) * se;
  return { na: x.length, nb: y.length, diff: r2(diff), lo: r2(diff - half), hi: r2(diff + half), df: r2(df), insufficient: false };
}

/** Which journey the participant actually got: the planner's plan.source 'ai' = personalised; 'default'/'fallback' = fixed order. */
export function realizedArm(planSource) {
  if (planSource === 'ai') return 'ai';
  if (planSource === 'default' || planSource === 'fallback') return 'fixed';
  return 'unknown';
}

const LIKERT = ['clarity', 'respect', 'next_step'];

function armBlock(ps) {
  const done = ps.filter((p) => p.post);
  return {
    enrolled: ps.length,
    completed: done.length,
    pre: tInterval(done.map((p) => p.pre?.score)),
    post: tInterval(done.map((p) => p.post.score)),
    gain: tInterval(done.map((p) => p.post.score - (p.pre?.score ?? 0))),
    likert: Object.fromEntries(LIKERT.map((k) => [k, tInterval(done.map((p) => p.post.likert?.[k]))])),
    situations_done: tInterval(done.map((p) => p.post.situations_done))
  };
}

/**
 * participants: stored study docs; events: stored metrics docs ({ kind:'event'|'session', ... }).
 * Pilot/dry-run participants (pilot: true) are counted but excluded from every estimate.
 */
export function aggregate(participants = [], events = [], now = new Date()) {
  const all = participants.filter((p) => p && typeof p === 'object');
  const ps = all.filter((p) => !p.pilot);
  const withPre = ps.filter((p) => p.pre);
  const completed = ps.filter((p) => p.pre && p.post);
  const byAssigned = Object.fromEntries(ARMS.map((a) => [a, armBlock(ps.filter((p) => p.assigned === a && p.pre))]));
  const byRealized = Object.fromEntries(ARMS.map((a) => [a, armBlock(completed.filter((p) => p.post.realized === a))]));
  const gainOf = (arr) => arr.map((p) => p.post.score - p.pre.score);
  const perItem = ITEMS.map((it) => {
    const pre = completed.map((p) => p.pre.answers?.[it.id] === it.correct ? 1 : 0);
    const post = completed.map((p) => p.post.answers?.[it.id] === it.correct ? 1 : 0);
    return { id: it.id, ruling_id: it.ruling_id, n: completed.length, pre_correct: r2(mean(pre)), post_correct: r2(mean(post)) };
  });

  const ev = { session_start: 0, situation_done: 0, journey_done: 0, ask: { answered: 0, abstain: 0, refer: 0, error: 0 } };
  const legacy = [];
  for (const e of events || []) {
    if (!e || typeof e !== 'object') continue;
    if (e.kind === 'session') legacy.push(e);
    else if (e.kind === 'event') {
      if (e.event === 'ask' && Object.hasOwn(ev.ask, e.outcome)) ev.ask[e.outcome] += 1;
      else if (typeof ev[e.event] === 'number') ev[e.event] += 1;
    }
  }
  const asks = ev.ask.answered + ev.ask.abstain + ev.ask.refer + ev.ask.error;
  const legacyBlock = Object.fromEntries(ARMS.map((a) => {
    const xs = legacy.filter((s) => s.arm === a);
    const both = xs.filter((s) => Number.isInteger(s.pre) && Number.isInteger(s.post));
    return [a, { n: xs.length, completed_day: xs.filter((s) => s.completed).length, gain: tInterval(both.map((s) => s.post - s.pre)), clarity: tInterval(xs.map((s) => s.clarity)) }];
  }));

  return {
    generated_at: now.toISOString(),
    min_n: MIN_N,
    items: ITEMS.map((it) => ({ id: it.id, ruling_id: it.ruling_id, q: it.q })),
    participants: {
      enrolled: ps.length,
      pilot_excluded: all.length - ps.length,
      pre_done: withPre.length,
      completed: completed.length,
      completion_rate: withPre.length ? r2(completed.length / withPre.length) : null,
      arm_mismatch: completed.filter((p) => p.assigned !== p.post.realized).length
    },
    overall: armBlock(completed),
    by_assigned: byAssigned,
    by_realized: byRealized,
    gain_diff_ai_minus_fixed: welchDiff(gainOf(completed.filter((p) => p.post.realized === 'ai')), gainOf(completed.filter((p) => p.post.realized === 'fixed'))),
    per_item: perItem,
    telemetry: {
      ...ev,
      ask_total: asks,
      abstain_or_refer_rate: asks ? r2((ev.ask.abstain + ev.ask.refer) / asks) : null,
      journey_completion_rate: ev.session_start ? r2(ev.journey_done / ev.session_start) : null
    },
    in_game_measure: legacyBlock,
    limitations: [
      { en: 'Small convenience sample recruited on the night of submission; results are a pilot signal, not proof of effect.', ar: 'عينة صغيرة ميسّرة جُمعت ليلة التسليم؛ النتائج مؤشر أولي وليست دليلاً قاطعاً على الأثر.' },
      { en: 'Pre and post use the same five items (reordered), so part of any gain can be a testing effect.', ar: 'الاختبار القبلي والبعدي يستخدمان الأسئلة الخمسة نفسها (بترتيب مختلف)، فقد يكون جزء من التحسن أثراً لتكرار الاختبار.' },
      { en: 'Arms alternate by enrolment order (not randomised); the realized arm can differ from the assigned one when the AI planner is unavailable or no day context is chosen.', ar: 'تُوزَّع المجموعات بالتناوب حسب ترتيب التسجيل (لا عشوائياً)، وقد تختلف المجموعة الفعلية عن المخصصة إذا تعذّر المخطط الذكي أو لم يُختر سياق اليوم.' },
      { en: `Means are shown with 95% t-intervals only when an arm has at least ${MIN_N} completed participants.`, ar: `لا تُعرض المتوسطات بفترات ثقة 95% إلا إذا اكتمل في المجموعة ${MIN_N} مشاركين على الأقل.` },
      { en: 'Data is anonymous: no name, contact, location, religion or belief is collected; free-text comments are never published here.', ar: 'البيانات مجهولة الهوية: لا اسم ولا وسيلة تواصل ولا موقع ولا ديانة ولا معتقد؛ ولا تُنشر التعليقات الحرة هنا.' }
    ]
  };
}

const CSV_COLS = ['participant', 'day', 'lang', 'assigned_arm', 'realized_arm', 'plan_source', 'pre_score', 'post_score', 'gain',
  ...ITEMS.flatMap((it) => [`pre_${it.id}`, `post_${it.id}`]), 'likert_clarity', 'likert_respect', 'likert_next_step',
  'situations_done', 'tested_situations_seen', 'minutes_in_study', 'has_comment'];

const cell = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of non-pilot participants. Free-text comments are excluded unless includeComments (admin key) is set. */
export function toCsv(participants = [], { includeComments = false } = {}) {
  const cols = includeComments ? [...CSV_COLS, 'comment'] : CSV_COLS;
  const rows = [cols.join(',')];
  for (const p of participants.filter((x) => x && !x.pilot && x.pre)) {
    const post = p.post || null;
    const ok = (a, it) => (a ? (a[it.id] === it.correct ? 1 : 0) : '');
    const mins = post?.at && p.created ? Math.round((Date.parse(post.at) - Date.parse(p.created)) / 60000) : '';
    const r = {
      participant: p.code || p.id, day: String(p.created || '').slice(0, 10), lang: p.lang, assigned_arm: p.assigned,
      realized_arm: post?.realized ?? '', plan_source: post?.plan_source ?? '', pre_score: p.pre.score, post_score: post?.score ?? '',
      gain: post ? post.score - p.pre.score : '',
      ...Object.fromEntries(ITEMS.flatMap((it) => [[`pre_${it.id}`, ok(p.pre.answers, it)], [`post_${it.id}`, ok(post?.answers, it)]])),
      likert_clarity: post?.likert?.clarity, likert_respect: post?.likert?.respect, likert_next_step: post?.likert?.next_step,
      situations_done: post?.situations_done, tested_situations_seen: post?.tested_seen, minutes_in_study: mins,
      has_comment: post ? (post.comment ? 1 : 0) : '', comment: String(post?.comment ?? '').replace(/^[=+\-@\t]/, "'$&") // no spreadsheet formulas
    };
    rows.push(cols.map((c) => cell(r[c])).join(','));
  }
  return rows.join('\r\n') + '\r\n';
}
