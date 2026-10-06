// Ruling Card renderer. Renders ONLY what is in content/rulings (never invents religious text).
// Any missing field is omitted or marked "not documented yet"; a missing ruling renders a "content pending" card.
// Layout: header (verdict seal + review status) -> "in plain words" callout -> collapsible sections (accordion).
import { h, link } from '../dom.js';
import { t, tr, trField, getLang, STRINGS } from '../i18n.js';
import { VERDICTS, CATALOG } from '../config.js';
import './strings.js';

// Strings for the scientific-reference-package compliance badges (content levels A–D, explanatory notes,
// pending references). Merged without overriding anything already defined (i18n.js / strings.js / ui_strings.json).
const CARD_STRINGS = {
  contentLevel: { ar: 'مستوى المحتوى', en: 'Content level' },
  level_A: { ar: 'أ: معلومة أصلية مستقرة', en: 'A: stable core information' },
  level_B: { ar: 'ب: شرح واستدلال', en: 'B: explanation & reasoning' },
  level_C: { ar: 'ج: مسألة خلافية أو حساسة', en: 'C: disputed or sensitive' },
  level_D: { ar: 'د: حالة شخصية — لا فتوى', en: 'D: personal case — no fatwa' },
  level_A_tip: { ar: 'إجابة مباشرة موثقة بالمصدر في معلومة مستقرة.', en: 'A direct, sourced answer on stable, settled information.' },
  level_B_tip: { ar: 'شرح من المادة المعتمدة مع إظهار المرجع، دون قطع فيما يحتمل الخلاف.', en: 'An explanation from approved material with its reference, without certainty where scholars may differ.' },
  level_C_tip: { ar: 'مسألة فيها خلاف فقهي أو حساسية: نعرض الأقوال المعتمدة ونبيّن الخلاف، ونحيل إلى المختص.', en: 'A matter of scholarly difference or sensitivity: we show the recognised views, state the disagreement and refer you to a specialist.' },
  level_D_tip: { ar: 'واقعة شخصية: لا نصدر حكماً، بل نعرض معلومات عامة ونحيلك إلى جهة مؤهلة.', en: 'A personal case: we give no ruling, only general information, and refer you to a qualified authority.' },
  verdictScope: { ar: 'نطاق الحكم', en: 'Scope of this ruling' },
  explanatory: { ar: 'شرح توضيحي — ليس نصاً شرعياً', en: 'Explanatory note — not a scriptural text' },
  consensusSources: { ar: 'مصادر نقل الإجماع', en: 'Sources reporting consensus' },
  refPending: { ar: 'المرجع قيد التحقق', en: 'Reference pending verification' },
  aiPrepared: { ar: 'أعدّه الذكاء الاصطناعي — لم يراجعه عالم', en: 'AI-prepared, not scholar-reviewed' },
  verdictLevelC: { ar: 'قول جمهور العلماء', en: 'Majority scholarly view' },
  verdictDisputed: { ar: 'مسألة خلافية', en: 'Scholars differ' },
  verdictDepends: { ar: 'يختلف بحسب الحال', en: 'Depends on the case' },
  reviewedBy: { ar: 'راجعه', en: 'Reviewed by' }
};
for (const [k, v] of Object.entries(CARD_STRINGS)) if (!(k in STRINGS)) STRINGS[k] = v;
const LEVELS = ['A', 'B', 'C', 'D'];

/** Content level badge (A–D) with an explanatory tooltip (title + accessible label). */
export function levelBadge(level) {
  if (!LEVELS.includes(level)) return null;
  const tip = t(`level_${level}_tip`);
  return h('span', { class: 'badge level', 'data-level': level, title: tip, tabindex: '0', 'aria-label': `${t('contentLevel')}: ${t(`level_${level}`)} — ${tip}` },
    h('span', { class: 'lv-k' }, `${t('contentLevel')}: `), h('span', { class: 'lv-v' }, t(`level_${level}`)));
}

const list = (arr) => (Array.isArray(arr) && arr.length ? h('ul', { class: 'rc-list' }, arr.map((x) => h('li', {}, String(x)))) : null);
// Content values (Arabic book titles, narrators, references with URLs) are often in the other script than the
// UI: isolate them with <bdi dir=auto> so the bidi algorithm does not scramble their punctuation and order.
const iso = (v) => (v == null || v === '' ? null : h('bdi', { dir: 'auto' }, String(v)));
const nonEmpty = (v) => v != null && v !== '' && !(Array.isArray(v) && !v.length);

/** Source link, visibly marked as external (icon via CSS) and announced as such. */
function srcLink(url) {
  const a = link(url, t('source'));
  if (!a) return null;
  try { a.setAttribute('title', `${new URL(a.getAttribute('href')).hostname} — ${t('externalLink')}`); } catch { /* */ }
  a.setAttribute('aria-label', `${t('source')} (${t('externalLink')})`);
  return a;
}

// Sections collapsed by default on narrow screens (long, secondary lists). Everything else starts open.
const COLLAPSED_ON_MOBILE = new Set(['contemporary', 'guidance', 'alternatives', 'consensusSources']);
const isNarrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
let secSeq = 0;

/** A collapsible section: <section class="rc-section rc-<key>"><h3 class="rc-h"><button aria-expanded>…</button></h3><div class="rc-body">…</div></section> */
function section(titleKey, ...children) {
  const kids = children.flat().filter(Boolean);
  if (!kids.length) return null;
  return collapsible(`rc-section rc-${titleKey}`, t(titleKey), kids, COLLAPSED_ON_MOBILE.has(titleKey) && isNarrow());
}

function collapsible(cls, title, kids, collapsed = false, attrs = {}) {
  const id = `rcs${++secSeq}`;
  const body = h('div', { class: 'rc-body', id }, kids);
  const btn = h('button', { type: 'button', class: 'rc-toggle', 'aria-expanded': collapsed ? 'false' : 'true', 'aria-controls': id },
    h('span', { class: 'rc-h-text' }, title), h('span', { class: 'rc-chev', 'aria-hidden': 'true' }));
  const sec = h('section', { class: `${cls}${collapsed ? ' collapsed' : ''}`, ...attrs }, h('h3', { class: 'rc-h' }, btn), body);
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    sec.classList.toggle('collapsed', !open);
  });
  return sec;
}

// Verdict glyphs: shape + text always accompany the colour (never colour alone).
const VERDICT_ICON = { haram: '✕', makruh: '!', mubah: '✓', halal: '✓', mustahab: '★', wajib: '◆', disputed: '⇄', depends: '⋯', unknown: '…' };

export function verdictBadge(verdict) {
  const key = VERDICTS[verdict] ? verdict : 'unknown';
  const v = VERDICTS[key];
  return h('span', { class: 'badge verdict', style: { '--c': v.color }, 'data-verdict': verdict || 'unknown' },
    h('span', { class: 'v-icon', 'aria-hidden': 'true' }, VERDICT_ICON[key] || '•'), h('span', { class: 'v-text' }, v[getLang()]));
}

/** Big verdict seal for the card header: icon in an 8-point star + "Overall ruling" label + verdict. */
function verdictSeal(verdict, label = t('verdictLabel')) {
  const key = VERDICTS[verdict] ? verdict : 'unknown';
  const v = VERDICTS[key];
  return h('div', { class: 'rc-seal', style: { '--c': v.color }, 'data-verdict': verdict || 'unknown' },
    h('span', { class: 'seal-star', 'aria-hidden': 'true' }, h('span', { class: 'seal-icon' }, VERDICT_ICON[key] || '•')),
    h('span', { class: 'seal-text' }, h('span', { class: 'seal-label' }, label), verdictBadge(verdict)));
}

// Scholar sign-offs recorded in the experts dashboard (GET experts?view=reviews -> { reviews: { [rulingId]: { reviewer, title } } }).
// Fetched once per page; any failure (dev server, offline, Node tests) simply shows nothing.
let reviewsPromise = null;
export function scholarReviews() {
  if (!reviewsPromise) {
    const ok = typeof fetch === 'function' && typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
    reviewsPromise = ok
      ? fetch('/.netlify/functions/experts?view=reviews', { headers: { accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null)).then((j) => (j && typeof j.reviews === 'object' ? j.reviews : {})).catch(() => ({}))
      : Promise.resolve({});
  }
  return reviewsPromise;
}

/** "Reviewed by: <name> — <title>" slot; filled only when a scholar review exists for this ruling. */
function reviewedBySlot(rulingId) {
  const slot = h('span', { class: 'badge reviewed-by', hidden: true });
  scholarReviews().then((all) => {
    const rv = all?.[rulingId];
    if (!rv?.reviewer) return;
    slot.textContent = `${t('reviewedBy')}: ${String(rv.reviewer).slice(0, 80)}${rv.title ? ` — ${String(rv.title).slice(0, 80)}` : ''}`;
    slot.hidden = false;
  }).catch(() => {});
  return slot;
}

/** { reviewed, label } for a review_status. Only an explicit HUMAN/scholar review counts as reviewed. */
export function statusInfo(status) {
  const s = String(status || 'ai_draft');
  const reviewed = /scholar|human/i.test(s) && /review|approved|verified/i.test(s) && !/pending|^ai/i.test(s);
  const label = reviewed ? t('status_reviewed') : s === 'ai_verified' ? t('status_ai_verified') : t('status_ai_draft');
  return { reviewed, label, raw: s };
}

export function statusBadge(status, extraClass = '') {
  const { reviewed, label, raw } = statusInfo(status);
  return h('span', { class: `badge status ${reviewed ? 'ok' : 'draft'}${extraClass ? ` ${extraClass}` : ''}`, title: raw },
    h('span', { class: 'st-icon', 'aria-hidden': 'true' }, reviewed ? '✓' : '◷'), h('span', {}, label));
}

function quranBlock(q) {
  const ref = [q.surah_name_ar, nonEmpty(q.surah) ? `${q.surah}:${q.ayah ?? ''}` : null].filter(Boolean).join(' · ');
  return h('figure', { class: 'ayah' },
    q.text_ar ? h('blockquote', { class: 'quran-text', lang: 'ar', dir: 'rtl' }, /[﴾﴿]/.test(q.text_ar) ? q.text_ar : `﴿${q.text_ar}﴾`) : h('p', { class: 'muted' }, t('notProvided')),
    getLang() === 'en' && q.translation_en ? h('p', { class: 'translation', lang: 'en', dir: 'ltr' }, q.translation_en) : null,
    h('figcaption', { class: 'ref' }, h('span', { class: 'ref-meta' }, iso(ref)), srcLink(q.source_url))
  );
}

function gradeClass(g) {
  const s = String(g || '');
  if (/ضعيف|da['ʿ’]?if|weak/i.test(s)) return 'weak';
  if (/حسن|hasan/i.test(s) && !/صحيح|sahih/i.test(s)) return 'good';
  if (/صحيح|sahih|متفق|agreed/i.test(s)) return 'strong';
  return 'neutral';
}

function hadithBlock(d) {
  const meta = [d.collection, d.number ? `#${d.number}` : null].filter(Boolean).join(' ');
  return h('figure', { class: 'hadith' },
    d.text_ar ? h('blockquote', { class: 'hadith-text', lang: 'ar', dir: 'rtl' }, /^[«"“]/.test(d.text_ar.trim()) ? d.text_ar : `«${d.text_ar}»`) : h('p', { class: 'muted' }, t('notProvided')),
    getLang() === 'en' && d.translation_en ? h('p', { class: 'translation', lang: 'en', dir: 'ltr' }, d.translation_en) : null,
    h('figcaption', { class: 'ref' },
      h('span', { class: 'ref-meta' }, iso(meta), d.narrator ? h('span', {}, ` · ${t('narrator')}: `, iso(d.narrator)) : null),
      d.grade ? h('span', { class: `grade chip g-${gradeClass(d.grade)}` }, h('span', { class: 'chip-k' }, `${t('grade')}: `), iso(`${d.grade}${d.grader ? ` (${d.grader})` : ''}`)) : null,
      srcLink(d.source_url))
  );
}

let tabSeq = 0;
function madhahibBlock(m) {
  const keys = ['hanafi', 'maliki', 'shafii', 'hanbali'];
  const uid = `mt${++tabSeq}`;
  const tabs = [], panels = [];
  keys.forEach((k, i) => {
    const d = m?.[k] || {};
    const pos = trField(d, 'position');
    const tab = h('button', { type: 'button', role: 'tab', id: `${uid}-t-${k}`, 'aria-controls': `${uid}-p-${k}`, 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1', class: 'tab' }, t(k));
    const panel = h('div', { role: 'tabpanel', id: `${uid}-p-${k}`, 'aria-labelledby': tab.id, class: `tabpanel${i === 0 ? ' active' : ''}`, tabindex: '0' },
      h('h4', { class: 'madhhab-name' }, t(k)),
      pos ? h('p', {}, pos) : h('p', { class: 'muted' }, t('notProvided')),
      d.reference ? h('p', { class: 'ref' }, `${t('reference')}: `, iso(d.reference),
        d.reference_status === 'pending_verification' ? h('span', { class: 'badge ref-pending' }, ' ', t('refPending')) : null) : null);
    tabs.push(tab); panels.push(panel);
  });
  const select = (i) => {
    tabs.forEach((tb, j) => { tb.setAttribute('aria-selected', j === i ? 'true' : 'false'); tb.tabIndex = j === i ? 0 : -1; panels[j].classList.toggle('active', j === i); });
    tabs[i].focus();
  };
  tabs.forEach((tb, i) => {
    tb.addEventListener('click', () => select(i));
    tb.addEventListener('keydown', (e) => {
      const rtl = document.documentElement.dir === 'rtl';
      const fwd = rtl ? 'ArrowLeft' : 'ArrowRight', back = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd) { e.preventDefault(); select((i + 1) % 4); }
      if (e.key === back) { e.preventDefault(); select((i + 3) % 4); }
      if (e.key === 'Home') { e.preventDefault(); select(0); }
      if (e.key === 'End') { e.preventDefault(); select(3); }
    });
  });
  return h('div', { class: 'madhahib' }, h('div', { class: 'tablist', role: 'tablist', 'aria-label': t('madhahib') }, tabs), h('div', { class: 'tabpanels' }, panels));
}

function contemporaryBlock(c) {
  return h('div', { class: 'council' },
    h('div', { class: 'council-head' }, h('strong', {}, iso(c.body || '—')), c.decision_ref ? h('span', { class: 'ref' }, ' · ', iso(c.decision_ref)) : null),
    trField(c, 'position') ? h('p', {}, trField(c, 'position')) : null,
    srcLink(c.source_url));
}

/** "In plain words" — newcomer_explainer {ar,en}. Hidden when absent. Always open (the heart of the card). */
function plainWordsBlock(r) {
  const txt = tr(r.newcomer_explainer);
  if (!nonEmpty(txt)) return null;
  return h('section', { class: 'rc-section rc-plain' }, h('h3', { class: 'rc-h' }, h('span', { class: 'rc-h-text' }, t('plainWords'))), h('p', { class: 'plain' }, txt));
}

/** Build the ruling card element. ruling may be null -> "content pending". */
export function renderRulingCard(ruling, rulingId) {
  if (!ruling) {
    const cat = CATALOG.find((c) => c.id === rulingId);
    return h('article', { class: 'ruling-card pending' },
      h('header', { class: 'rc-header' },
        h('p', { class: 'eyebrow' }, t('ruling')),
        h('h2', { class: 'rc-title' }, cat ? tr(cat.title) : rulingId || '—'),
        h('div', { class: 'rc-head-row' }, verdictSeal('unknown'), h('div', { class: 'badges' }, statusBadge('ai_draft')))),
      h('section', { class: 'rc-section' }, h('h3', { class: 'rc-h' }, h('span', { class: 'rc-h-text' }, t('pendingTitle'))), h('p', {}, t('pendingBody'))));
  }
  const r = ruling;
  const guidance = tr(r.practical_guidance);
  const alts = tr(r.halal_alternatives);
  const { reviewed } = statusInfo(r.review_status);
  // "High confidence" is only ever shown next to an explicit "AI-prepared, not scholar-reviewed" badge.
  // Level C (disputed) never shows a confidence badge: the card attributes the view, it does not weigh it.
  const levelC = r.content_level === 'C';
  const conf = r.confidence && !levelC ? h('span', { class: 'badge conf' }, `${t('confidence')}: ${t(`conf_${r.confidence}`)}`) : null;
  const aiBadge = r.confidence === 'high' && !reviewed ? h('span', { class: 'badge ai-prepared' }, t('aiPrepared')) : null;
  const scope = tr(r.verdict_scope);
  const notes = tr(r.explanatory_notes);
  const notesList = Array.isArray(notes) ? notes : notes ? [notes] : [];
  return h('article', { class: `ruling-card${r._fixture ? ' fixture' : ''}`, 'data-ruling': r.id, 'data-level': LEVELS.includes(r.content_level) ? r.content_level : null },
    h('header', { class: 'rc-header' },
      h('p', { class: 'eyebrow' }, t('ruling')),
      h('h2', { class: 'rc-title' }, tr(r.title) || r.id),
      h('div', { class: 'rc-head-row' },
        // Level C: "majority view" only when the card states a definite verdict; a disputed / case-dependent verdict
        // is labelled as such, never credited to a majority no source names.
        verdictSeal(r.verdict, !levelC ? t('verdictLabel') : r.verdict === 'disputed' ? t('verdictDisputed') : r.verdict === 'depends' ? t('verdictDepends') : t('verdictLevelC')),
        h('div', { class: 'badges' }, statusBadge(r.review_status), reviewedBySlot(r.id), levelBadge(r.content_level), conf, aiBadge,
          r._fixture ? h('span', { class: 'badge fixture' }, t('fixtureBadge')) : null)),
      nonEmpty(scope) ? h('p', { class: 'rc-scope' }, h('strong', {}, `${t('verdictScope')}: `), scope) : null),
    plainWordsBlock(r),
    nonEmpty(tr(r.question)) ? section('question', h('p', { class: 'question' }, tr(r.question))) : null,
    nonEmpty(tr(r.summary)) ? section('summary', h('p', { class: 'summary' }, tr(r.summary))) : null,
    notesList.length ? collapsible('rc-section rc-explanatory', t('explanatory'), [list(notesList)]) : null,
    section('consensusSources', list((r.consensus_sources || []).filter(Boolean))),
    section('quran', (r.quran || []).filter(Boolean).map(quranBlock)),
    section('hadith', (r.hadith || []).filter(Boolean).map(hadithBlock)),
    r.madhahib ? section('madhahib', madhahibBlock(r.madhahib)) : null,
    section('contemporary', (r.contemporary || []).filter(Boolean).map(contemporaryBlock)),
    section('guidance', list(Array.isArray(guidance) ? guidance : guidance ? [guidance] : [])),
    section('alternatives', list(Array.isArray(alts) ? alts : alts ? [alts] : [])),
    nonEmpty(tr(r.refer_to_scholar_when)) ? collapsible('rc-section rc-scholar', t('referScholar'), [h('p', {}, tr(r.refer_to_scholar_when))]) : null,
    h('div', { class: 'rc-foot' }, h('p', {}, t('disc_general')), h('p', {}, t('disc_ai')))
  );
}
