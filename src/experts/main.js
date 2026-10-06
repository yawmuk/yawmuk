// Scholar dashboard (/experts): passcode login, question queue with AI/rule pre-triage, answer editor, ruling review.
// All server data is rendered with textContent (never innerHTML), links only when https.
import './dashboard.css';
import { LEVELS, LIMITS, REVIEW_VERDICTS, formatTicket } from '../features/experts/core.js';

const API = '/.netlify/functions/experts';
const app = document.getElementById('experts-app');
let lang = (() => { try { return localStorage.getItem('yawmuk.experts.lang') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; } })();

const S = {
  ar: {
    title: 'لوحة المراجعة الشرعية', sub: 'يومك — أسئلة اللاعبين ومراجعة بطاقات الأحكام', pass: 'رمز الدخول', login: 'دخول', logout: 'خروج',
    notConfigured: 'اللوحة غير مفعّلة على الخادم (EXPERTS_PASSCODE / SESSION_SECRET).', badPass: 'رمز غير صحيح.', limited: 'محاولات كثيرة؛ انتظر قليلاً.',
    tabQ: 'أسئلة اللاعبين', tabR: 'مراجعة الأحكام', st: { new: 'جديدة', answered: 'مُجابة', referred: 'مُحالة', out_of_scope: 'خارج النطاق', all: 'الكل' },
    empty: 'لا توجد أسئلة هنا.', pick: 'اختر سؤالاً من القائمة.', asked: 'السؤال', nick: 'الاسم المستعار', lang: 'اللغة', at: 'وصل في',
    triage: 'اقتراح آلي يحتاج مراجعة', ruleT: 'فرز القواعد (بدون نموذج)', aiT: 'فرز الذكاء الاصطناعي', runAi: 'تشغيل الفرز بالذكاء الاصطناعي', aiErr: 'تعذّر الفرز الآلي',
    personal: 'يبدو حالة شخصية — يُحال', oos: 'قد يكون خارج النطاق', related: 'بطاقات أحكام ذات صلة', level: 'مستوى المحتوى',
    status: 'الحالة', stOpt: { answered: 'أُجيب', referred: 'أُحيل إلى عالم محلي', out_of_scope: 'خارج النطاق' },
    answer: 'نص الإجابة', sources: 'المصادر (رابط https في كل سطر — من المصادر المعتمدة: الدرر السنية، قرآنبيديا، الشاملة، بينات، الجمهرة…)',
    reviewer: 'اسم المراجع', rtitle: 'الصفة العلمية', publish: 'اعتماد للنشر: يصبح مرجعاً يجيب منه المرشد داخل اللعبة', pubQ: 'صياغة السؤال للنشر (احذف أي تفاصيل شخصية)',
    save: 'حفظ', saved: 'حُفظ.', del: 'حذف السؤال', delC: 'حذف السؤال نهائياً؟', err: 'خطأ', ruling: 'الحكم', verdict: 'النتيجة',
    rv: { reviewed: 'رُوجع وأُقرّ', reviewed_with_notes: 'رُوجع مع ملاحظات', needs_changes: 'يحتاج تعديلاً' }, notes: 'الملاحظات', submitR: 'تسجيل المراجعة',
    contentStatus: 'حالة المحتوى في الملف', publicBadge: 'يظهر في اللعبة', noReview: 'لا مراجعة بشرية مسجّلة', history: 'سجل المراجعات', forReviewer: 'ملاحظات للمراجع',
    store: 'التخزين', langBtn: 'English'
  },
  en: {
    title: 'Scholarly review dashboard', sub: 'Yawmuk — player questions and ruling-card review', pass: 'Passcode', login: 'Sign in', logout: 'Sign out',
    notConfigured: 'Dashboard is not enabled on the server (EXPERTS_PASSCODE / SESSION_SECRET).', badPass: 'Wrong passcode.', limited: 'Too many attempts; please wait.',
    tabQ: 'Player questions', tabR: 'Ruling review', st: { new: 'New', answered: 'Answered', referred: 'Referred', out_of_scope: 'Out of scope', all: 'All' },
    empty: 'No questions here.', pick: 'Pick a question from the list.', asked: 'Question', nick: 'Nickname', lang: 'Language', at: 'Received',
    triage: 'Automatic suggestion — needs review', ruleT: 'Rule triage (no model)', aiT: 'AI triage', runAi: 'Run AI triage', aiErr: 'AI triage unavailable',
    personal: 'Looks like a personal case — refer', oos: 'May be out of scope', related: 'Related ruling cards', level: 'Content level',
    status: 'Status', stOpt: { answered: 'Answered', referred: 'Referred to a local scholar', out_of_scope: 'Out of scope' },
    answer: 'Answer text', sources: 'Sources (one https URL per line — from approved sources: dorar.net, quranpedia, shamela, dawa.center, islamic-content…)',
    reviewer: 'Reviewer name', rtitle: 'Scholarly title', publish: 'Approve for publishing: becomes a passage the in-game guide may answer from', pubQ: 'Question wording for publishing (remove personal details)',
    save: 'Save', saved: 'Saved.', del: 'Delete question', delC: 'Delete this question permanently?', err: 'Error', ruling: 'Ruling', verdict: 'Verdict',
    rv: { reviewed: 'Reviewed and approved', reviewed_with_notes: 'Reviewed with notes', needs_changes: 'Needs changes' }, notes: 'Notes', submitR: 'Record review',
    contentStatus: 'Content file status', publicBadge: 'Shown in game', noReview: 'No human review recorded', history: 'Review history', forReviewer: 'Notes for reviewer',
    store: 'Storage', langBtn: 'العربية'
  }
};
const L = () => S[lang];
// Server error codes -> readable messages (the raw code is kept in brackets for support).
const ERRORS = {
  answer_required: ['اكتب نص الإجابة.', 'Write the answer text.'],
  answer_too_long: ['الإجابة أطول من المسموح.', 'The answer is too long.'],
  bad_source_url: ['رابط المصدر غير صالح؛ يجب أن يبدأ بـ https://', 'A source link is not valid; it must start with https://'],
  too_many_sources: ['عدد المصادر أكثر من المسموح.', 'Too many sources.'],
  bad_level: ['اختر مستوى المحتوى.', 'Choose the content level.'],
  bad_status: ['الحالة غير صالحة.', 'Invalid status.'],
  bad_verdict: ['النتيجة غير صالحة.', 'Invalid verdict.'],
  bad_ruling: ['البطاقة غير موجودة.', 'Unknown ruling card.'],
  reviewer_required: ['اكتب اسم المراجع.', 'Enter the reviewer name.'],
  public_question_required: ['اكتب صيغة السؤال المنشورة قبل النشر.', 'Write the public wording of the question before publishing.'],
  notes_required: ['اكتب ملاحظات المراجعة.', 'Write the review notes.'],
  too_short: ['النص قصير جداً.', 'The text is too short.'],
  too_long: ['النص طويل جداً.', 'The text is too long.'],
  not_found: ['السؤال غير موجود (ربما حُذف).', 'Question not found (it may have been deleted).'],
  unauthorized: ['انتهت الجلسة؛ سجّل الدخول مجدداً.', 'Session expired; please log in again.'],
  rate_limited: ['محاولات كثيرة؛ انتظر قليلاً.', 'Too many attempts; please wait a little.'],
  bad_origin: ['طلب من مصدر غير مسموح.', 'Request from a disallowed origin.'],
  offline: ['تعذّر الاتصال بالخادم.', 'Could not reach the server.']
};
const errText = (code) => { const e = ERRORS[code]; return e ? `${e[lang === 'en' ? 1 : 0]} (${code})` : String(code); };
const tr = (o) => (o && typeof o === 'object' ? o[lang] || o.ar || o.en || '' : String(o ?? ''));

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return e;
}
const fmtDate = (s) => { try { return new Date(s).toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return s; } };
const levelLabel = (k) => (LEVELS[k] ? `${LEVELS[k].ar} (${k}) — ${LEVELS[k].name[lang]}` : '—');
const remembered = (k) => { try { return localStorage.getItem(`yawmuk.experts.${k}`) || ''; } catch { return ''; } };
const remember = (k, v) => { try { localStorage.setItem(`yawmuk.experts.${k}`, v); } catch { /* ignore */ } };

async function api(method, { query = '', body } = {}) {
  try {
    const r = await fetch(`${API}${query}`, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, data: { error: 'offline' } }; }
}

const state = { tab: 'q', filter: 'new', items: [], counts: {}, sel: null, rulings: [], store: '' };

function setLang(l) {
  lang = l; remember('lang', l);
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  document.title = `${L().title} · Yawmuk`;
}

async function boot() {
  setLang(lang);
  const me = await api('GET', { query: '?view=me' });
  state.store = me.data.store || '';
  if (me.data.authed) return renderApp();
  renderLogin(me.data.configured === false ? L().notConfigured : '');
}

function renderLogin(message = '') {
  const input = el('input', { type: 'password', id: 'pc', autocomplete: 'current-password', required: true, maxlength: 200 });
  const msg = el('p', { class: 'yk-dash-msg', role: 'alert' }, message);
  const form = el('form', { class: 'yk-dash-login' },
    el('h1', {}, L().title), el('p', { class: 'yk-dash-muted' }, L().sub),
    el('label', { for: 'pc' }, L().pass), input, el('button', { type: 'submit', class: 'yk-dash-primary' }, L().login), msg,
    el('button', { type: 'button', class: 'yk-dash-ghost', onclick: () => { setLang(lang === 'ar' ? 'en' : 'ar'); renderLogin(); } }, L().langBtn));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await api('POST', { body: { action: 'login', passcode: input.value } });
    if (r.ok) return renderApp();
    msg.textContent = r.data.error === 'not_configured' ? L().notConfigured : r.status === 429 ? L().limited : L().badPass;
  });
  app.replaceChildren(form);
  input.focus();
}

async function renderApp() {
  const main = el('main', { class: 'yk-dash-main', id: 'main' });
  const tabs = el('nav', { class: 'yk-dash-tabs', 'aria-label': L().title },
    ['q', 'r'].map((t) => el('button', { type: 'button', 'aria-current': state.tab === t ? 'page' : null, onclick: () => { state.tab = t; renderApp(); } }, t === 'q' ? L().tabQ : L().tabR)));
  const head = el('header', { class: 'yk-dash-head' },
    el('div', {}, el('h1', {}, L().title), el('p', { class: 'yk-dash-muted' }, `${L().sub} · ${L().store}: ${state.store || '?'}`)),
    el('div', { class: 'yk-dash-headtools' },
      el('button', { type: 'button', class: 'yk-dash-ghost', onclick: () => { setLang(lang === 'ar' ? 'en' : 'ar'); renderApp(); } }, L().langBtn),
      el('button', { type: 'button', class: 'yk-dash-ghost', onclick: async () => { await api('POST', { body: { action: 'logout' } }); renderLogin(); } }, L().logout)));
  app.replaceChildren(head, tabs, main);
  if (state.tab === 'q') await renderQueue(main); else await renderRulings(main);
}

// ---------------------------------------------------------------- questions
async function loadQueue() {
  const r = await api('GET', { query: `?view=queue&status=${state.filter}` });
  if (r.status === 401) { renderLogin(); return false; }
  state.items = r.data.items || []; state.counts = r.data.counts || {};
  return true;
}

async function renderQueue(main) {
  if (!(await loadQueue())) return;
  const filters = el('div', { class: 'yk-dash-filters', role: 'group' },
    ['new', 'answered', 'referred', 'out_of_scope', 'all'].map((f) => el('button', {
      type: 'button', 'aria-pressed': String(state.filter === f), onclick: () => { state.filter = f; state.sel = null; renderApp(); }
    }, `${L().st[f]}${f === 'all' ? '' : ` (${state.counts[f] ?? 0})`}`)));
  const list = el('ul', { class: 'yk-dash-list' });
  if (!state.items.length) list.append(el('li', { class: 'yk-dash-muted' }, L().empty));
  for (const q of state.items) {
    list.append(el('li', {}, el('button', {
      type: 'button', class: 'yk-dash-qbtn', 'aria-current': state.sel === q.id ? 'true' : null,
      onclick: () => { state.sel = q.id; renderApp(); }
    },
    el('span', { class: 'yk-dash-qmeta' }, el('bdi', { dir: 'ltr' }, formatTicket(q.id)), ' · ', fmtDate(q.created_at),
      q.triage?.rule?.level ? el('span', { class: `yk-dash-lvl yk-dash-lvl-${q.triage.rule.level}` }, LEVELS[q.triage.rule.level]?.ar) : null),
    el('span', { class: 'yk-dash-qtext', dir: 'auto' }, q.question.length > 140 ? `${q.question.slice(0, 140)}…` : q.question))));
  }
  const detail = el('section', { class: 'yk-dash-detail', 'aria-live': 'polite' });
  const q = state.items.find((x) => x.id === state.sel);
  if (q) renderDetail(detail, q); else detail.append(el('p', { class: 'yk-dash-muted' }, L().pick));
  main.append(filters, el('div', { class: 'yk-dash-split' }, list, detail));
}

function triageBox(q, rerender) {
  const box = el('aside', { class: 'yk-dash-triage', 'aria-label': L().triage }, el('h3', {}, `⚠ ${L().triage}`));
  const rule = q.triage?.rule;
  if (rule) {
    box.append(el('p', {}, el('strong', {}, `${L().ruleT}: `), levelLabel(rule.level)), rule.personal ? el('p', { class: 'yk-dash-warn' }, L().personal) : null);
    if (rule.related?.length) {
      box.append(el('p', { class: 'yk-dash-muted' }, L().related), el('ul', {}, rule.related.map((r) => el('li', {}, el('bdi', {}, tr(r.title)), ` — ${r.id} · ${LEVELS[r.level]?.ar || r.level}`))));
    }
  }
  const ai = q.triage?.ai;
  if (ai) {
    box.append(el('p', {}, el('strong', {}, `${L().aiT}: `), levelLabel(ai.level)),
      ai.personal ? el('p', { class: 'yk-dash-warn' }, L().personal) : null,
      ai.out_of_scope ? el('p', { class: 'yk-dash-warn' }, L().oos) : null,
      ai.reason ? el('p', { dir: 'auto', class: 'yk-dash-muted' }, ai.reason) : null);
  } else {
    const msg = el('span', { class: 'yk-dash-muted', role: 'status' });
    const btn = el('button', { type: 'button', class: 'yk-dash-ghost' }, L().runAi);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const r = await api('POST', { body: { action: 'triage', id: q.id } });
      btn.disabled = false;
      if (r.ok && r.data.item?.triage?.ai) { Object.assign(q, r.data.item); rerender(); } else msg.textContent = `${L().aiErr} (${r.data.ai_error || r.data.error || r.status})`;
    });
    box.append(el('div', {}, btn, ' ', msg));
  }
  return box;
}

function renderDetail(detail, q) {
  const rerender = () => { detail.replaceChildren(); renderDetail(detail, q); };
  const suggested = q.level || q.triage?.ai?.level || q.triage?.rule?.level || 'B';
  const status = el('select', { id: 'f-status' }, ['answered', 'referred', 'out_of_scope'].map((s) => el('option', { value: s, selected: (q.status === 'new' ? (suggested === 'D' ? 'referred' : 'answered') : q.status) === s }, L().stOpt[s])));
  const level = el('select', { id: 'f-level' }, Object.keys(LEVELS).map((k) => el('option', { value: k, selected: k === suggested }, levelLabel(k))));
  const answer = el('textarea', { id: 'f-answer', rows: 8, maxlength: LIMITS.ANSWER_MAX, dir: 'auto' }); answer.value = q.answer || '';
  const sources = el('textarea', { id: 'f-sources', rows: 3, dir: 'ltr', placeholder: 'https://dorar.net/...' }); sources.value = (q.sources || []).join('\n');
  const reviewer = el('input', { id: 'f-reviewer', maxlength: LIMITS.REVIEWER_MAX, value: q.reviewer || remembered('reviewer') });
  const rtitle = el('input', { id: 'f-title', maxlength: LIMITS.TITLE_MAX, value: q.title || remembered('title') });
  const publish = el('input', { type: 'checkbox', id: 'f-pub', checked: q.publish });
  const pubQ = el('textarea', { id: 'f-pubq', rows: 2, maxlength: LIMITS.QUESTION_MAX, dir: 'auto' }); pubQ.value = q.public_question || q.question;
  const msg = el('p', { class: 'yk-dash-msg', role: 'status' });
  const counter = el('small', { class: 'yk-dash-muted' });
  const count = () => { counter.textContent = `${answer.value.length} / ${LIMITS.ANSWER_MAX}`; };
  answer.addEventListener('input', count); count();
  const form = el('form', { class: 'yk-dash-form' },
    el('div', { class: 'yk-dash-grid' }, el('label', {}, L().status, status), el('label', {}, L().level, level)),
    el('label', { for: 'f-answer' }, L().answer), answer, counter,
    el('label', { for: 'f-sources' }, L().sources), sources,
    el('div', { class: 'yk-dash-grid' }, el('label', {}, L().reviewer, reviewer), el('label', {}, L().rtitle, rtitle)),
    el('label', { class: 'yk-dash-check' }, publish, ' ', L().publish),
    el('label', { for: 'f-pubq' }, L().pubQ), pubQ,
    el('div', { class: 'yk-dash-actions' }, el('button', { type: 'submit', class: 'yk-dash-primary' }, L().save),
      el('button', { type: 'button', class: 'yk-dash-danger', onclick: async () => {
        if (!window.confirm(L().delC)) return;
        const r = await api('POST', { body: { action: 'delete', id: q.id } });
        if (r.ok) { state.sel = null; renderApp(); } else msg.textContent = `${L().err}: ${errText(r.data.error || r.status)}`;
      } }, L().del)), msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    remember('reviewer', reviewer.value); remember('title', rtitle.value);
    const r = await api('POST', { body: {
      action: 'answer', id: q.id, status: status.value, level: level.value, answer: answer.value,
      sources: sources.value.split('\n').map((s) => s.trim()).filter(Boolean), reviewer: reviewer.value, title: rtitle.value,
      publish: publish.checked, public_question: pubQ.value
    } });
    if (r.ok) { msg.textContent = L().saved; Object.assign(q, r.data.item); } else msg.textContent = `${L().err}: ${errText(r.data.error || r.status)}`;
  });
  detail.append(
    el('div', { class: 'yk-dash-q' },
      el('p', { class: 'yk-dash-muted' }, `${L().asked} · `, el('bdi', { dir: 'ltr' }, formatTicket(q.id)), ` · ${L().at}: ${fmtDate(q.created_at)} · ${L().lang}: ${q.lang}`, q.nickname ? ` · ${L().nick}: ` : '', q.nickname ? el('bdi', {}, q.nickname) : null),
      el('p', { class: 'yk-dash-qfull', dir: 'auto' }, q.question)),
    triageBox(q, rerender), form);
}

// ---------------------------------------------------------------- ruling review
async function renderRulings(main) {
  const r = await api('GET', { query: '?view=rulings' });
  if (r.status === 401) return renderLogin();
  const list = el('div', { class: 'yk-dash-rulings' });
  for (const it of r.data.items || []) {
    const verdict = el('select', {}, REVIEW_VERDICTS.map((v) => el('option', { value: v }, L().rv[v])));
    const reviewer = el('input', { maxlength: LIMITS.REVIEWER_MAX, value: remembered('reviewer'), 'aria-label': L().reviewer, placeholder: L().reviewer });
    const rtitle = el('input', { maxlength: LIMITS.TITLE_MAX, value: remembered('title'), 'aria-label': L().rtitle, placeholder: L().rtitle });
    const notes = el('textarea', { rows: 2, maxlength: LIMITS.NOTES_MAX, 'aria-label': L().notes, placeholder: L().notes, dir: 'auto' });
    const msg = el('p', { class: 'yk-dash-msg', role: 'status' });
    const form = el('form', { class: 'yk-dash-rform' }, el('div', { class: 'yk-dash-grid3' }, verdict, reviewer, rtitle), notes,
      el('button', { type: 'submit', class: 'yk-dash-primary' }, L().submitR), msg);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      remember('reviewer', reviewer.value); remember('title', rtitle.value);
      const x = await api('POST', { body: { action: 'review', ruling_id: it.id, verdict: verdict.value, reviewer: reviewer.value, title: rtitle.value, notes: notes.value } });
      if (x.ok) renderApp(); else msg.textContent = `${L().err}: ${errText(x.data.error || x.status)}`;
    });
    const pub = it.public_review;
    list.append(el('details', { class: 'yk-dash-ruling' },
      el('summary', {}, el('span', { class: `yk-dash-lvl yk-dash-lvl-${it.level}` }, LEVELS[it.level]?.ar || it.level), ' ', el('bdi', {}, tr(it.title)),
        el('span', { class: pub ? 'yk-dash-ok' : 'yk-dash-muted' }, pub ? ` ✓ ${L().publicBadge}: ${pub.reviewer}` : ` · ${L().noReview}`)),
      el('p', { class: 'yk-dash-muted' }, `${it.id} · ${L().verdict}: ${it.verdict} · ${L().contentStatus}: ${it.review_status} · ${it.confidence || ''}`),
      it.notes_for_reviewer ? el('p', { dir: 'auto' }, el('strong', {}, `${L().forReviewer}: `), tr(it.notes_for_reviewer)) : null,
      it.records?.length ? el('div', {}, el('h4', {}, L().history), el('ul', {}, it.records.map((x) => el('li', {}, `${fmtDate(x.at)} — ${L().rv[x.verdict] || x.verdict} — `, el('bdi', {}, x.reviewer), x.title ? ` (${x.title})` : '', x.notes ? el('div', { dir: 'auto', class: 'yk-dash-muted' }, x.notes) : null)))) : null,
      form));
  }
  main.append(list);
}

boot();
