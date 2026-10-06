// «اسأل أهل العلم» — player side of the human scholarly review loop.
// open({ lang, onClose, prefill }) -> close()
// A question the guide could not (or must not) answer goes to Islamic-studies reviewers approved by the project. No email/phone, no
// account: the player gets a ticket code (kept in this browser's localStorage) to read the answer later or delete it.
import './experts.css';
import {
  LIMITS, LEVELS, validateQuestion, normalizeTicket, formatTicket, loadTickets, addTicket, removeTicket
} from './core.js';

const API = '/.netlify/functions/questions';
const S = {
  ar: {
    title: 'اسأل أهل العلم', tabAsk: 'سؤال جديد', tabMine: 'أسئلتي', close: 'إغلاق',
    intro: 'يصل سؤالك إلى مراجعين شرعيين يعتمدهم المشروع، يجيبون عنه بأنفسهم مع ذكر المصادر؛ وقد يتأخر الرد بحسب توفرهم. الإجابة معلومة عامة؛ الحالات الشخصية تُحال إلى عالم أو إمام محلي.',
    q: 'سؤالك', qHint: `من ${LIMITS.QUESTION_MIN} إلى ${LIMITS.QUESTION_MAX} حرف. لا تكتب اسمك الكامل أو أي بيانات شخصية.`,
    lang: 'لغة الإجابة المفضلة', langs: { ar: 'العربية', en: 'English', other: 'أخرى' },
    nick: 'اسم مستعار (اختياري)', send: 'إرسال إلى المختصين', sending: 'جارٍ الإرسال…',
    privacy: 'الخصوصية: لا نطلب بريداً ولا هاتفاً ولا نحفظ عنوانك. يُحفظ نص السؤال والاسم المستعار إن كتبته، ليُجاب عنه. قد يُرسَل نص السؤال إلى خدمة ذكاء اصطناعي (Gemini من Google عبر Vertex AI) لفرزه مبدئياً للمراجع، ولا يُجيب عنه إلا مراجع بشري. احتفظ برمز المتابعة: به تقرأ الإجابة أو تحذف سؤالك متى شئت.',
    sent: 'تم إرسال سؤالك. رمز المتابعة:', copy: 'نسخ الرمز', copied: 'نُسخ', keep: 'حُفظ الرمز في هذا المتصفح، وتجد الإجابة في «أسئلتي».',
    none: 'لا توجد أسئلة محفوظة في هذا المتصفح.', refresh: 'تحديث', add: 'إضافة رمز', addPh: 'XXXX-XXXX-XXXX', del: 'حذف السؤال',
    delConfirm: 'حذف السؤال نهائياً من الخادم؟', status: { new: 'بانتظار المراجعة', answered: 'أُجيب', referred: 'أُحيل إلى عالم محلي', out_of_scope: 'خارج النطاق', not_found: 'غير موجود (ربما حُذف)' },
    reviewer: 'أجاب', sources: 'المصادر', level: 'مستوى المحتوى', offline: 'تعذّر الاتصال بالخادم. حاول لاحقاً.',
    errors: { too_short: 'السؤال قصير جداً.', too_long: 'السؤال طويل جداً.', rate_limited: 'أرسلت أسئلة كثيرة؛ حاول بعد قليل.', queue_full: 'قائمة الانتظار ممتلئة الآن؛ حاول لاحقاً.', bad_ticket: 'رمز غير صحيح.' },
    referNote: 'هذه حالة تحتاج إلى من يسمع تفاصيلها: تواصل مع عالم موثوق أو إمام مسجدك.', general: 'معلومة عامة وليست فتوى شخصية.'
  },
  en: {
    title: 'Ask the scholars', tabAsk: 'New question', tabMine: 'My questions', close: 'Close',
    intro: 'Your question goes to Islamic-studies reviewers approved by the project, who answer it themselves, with sources; replies may take time depending on their availability. Answers are general information; personal cases are referred to a local scholar or imam.',
    q: 'Your question', qHint: `${LIMITS.QUESTION_MIN}–${LIMITS.QUESTION_MAX} characters. Do not include your full name or any personal details.`,
    lang: 'Preferred answer language', langs: { ar: 'Arabic', en: 'English', other: 'Other' },
    nick: 'Nickname (optional)', send: 'Send to the scholars', sending: 'Sending…',
    privacy: 'Privacy: no email, no phone, and we do not keep your address. The question text and the optional nickname are stored so it can be answered. The question may be sent to an AI service (Google Gemini on Vertex AI) to pre-sort it for the reviewer; only a human reviewer answers it. Keep your ticket code: it lets you read the answer or delete your question at any time.',
    sent: 'Your question was sent. Ticket code:', copy: 'Copy code', copied: 'Copied', keep: 'The code is saved in this browser; find the answer under “My questions”.',
    none: 'No questions saved in this browser.', refresh: 'Refresh', add: 'Add code', addPh: 'XXXX-XXXX-XXXX', del: 'Delete question',
    delConfirm: 'Permanently delete this question from the server?', status: { new: 'Awaiting review', answered: 'Answered', referred: 'Referred to a local scholar', out_of_scope: 'Out of scope', not_found: 'Not found (maybe deleted)' },
    reviewer: 'Answered by', sources: 'Sources', level: 'Content level', offline: 'Could not reach the server. Please try later.',
    errors: { too_short: 'The question is too short.', too_long: 'The question is too long.', rate_limited: 'Too many questions; please wait a little.', queue_full: 'The queue is full right now; please try later.', bad_ticket: 'Invalid code.' },
    referNote: 'This case needs someone who can hear its details: contact a trusted scholar or your mosque imam.', general: 'General information, not a personal fatwa.'
  }
};

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return e;
}
const storage = () => { try { return window.localStorage; } catch { return null; } };

async function api(method, { query = '', body } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`${API}${query}`, { method, signal: ctl.signal, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch { return { ok: false, status: 0, data: {} }; } finally { clearTimeout(timer); }
}

export function open({ lang = 'ar', onClose, prefill = '' } = {}) {
  const L = S[lang === 'en' ? 'en' : 'ar'];
  const prevFocus = document.activeElement;
  const titleId = `yk-experts-title-${Math.random().toString(36).slice(2, 8)}`;
  const body = el('div', { class: 'yk-experts-body' });
  const tabAsk = el('button', { type: 'button', role: 'tab', class: 'yk-experts-tab', 'aria-selected': 'true' }, L.tabAsk);
  const tabMine = el('button', { type: 'button', role: 'tab', class: 'yk-experts-tab', 'aria-selected': 'false' }, L.tabMine);
  const closeBtn = el('button', { type: 'button', class: 'yk-experts-close', 'aria-label': L.close }, '×');
  const panel = el('div', { class: 'yk-experts-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, dir: lang === 'en' ? 'ltr' : 'rtl', lang: lang === 'en' ? 'en' : 'ar' },
    el('header', { class: 'yk-experts-head' }, el('h2', { id: titleId }, L.title), closeBtn),
    el('div', { class: 'yk-experts-tabs', role: 'tablist' }, tabAsk, tabMine),
    body);
  const root = el('div', { class: 'yk-experts-backdrop' }, panel);
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    try { prevFocus?.focus?.(); } catch { /* ignore */ }
    onClose?.();
  }
  function focusables() {
    return [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    e.stopPropagation(); // keep game controls from reacting while typing
  }
  function select(which) {
    tabAsk.setAttribute('aria-selected', String(which === 'ask'));
    tabMine.setAttribute('aria-selected', String(which === 'mine'));
    body.replaceChildren(which === 'ask' ? askView() : mineView());
  }

  function askView() {
    const ta = el('textarea', { id: 'yk-experts-q', rows: 5, maxlength: LIMITS.QUESTION_MAX, required: true, 'aria-describedby': 'yk-experts-qhint' });
    ta.value = String(prefill || '').slice(0, LIMITS.QUESTION_MAX);
    const sel = el('select', { id: 'yk-experts-lang' }, ...['ar', 'en', 'other'].map((k) => el('option', { value: k, selected: k === (lang === 'en' ? 'en' : 'ar') }, L.langs[k])));
    const nick = el('input', { id: 'yk-experts-nick', type: 'text', maxlength: LIMITS.NICK_MAX, autocomplete: 'off' });
    const msg = el('p', { class: 'yk-experts-msg', role: 'status', 'aria-live': 'polite' });
    const send = el('button', { type: 'submit', class: 'yk-experts-primary' }, L.send);
    const form = el('form', { class: 'yk-experts-form', novalidate: true },
      el('p', { class: 'yk-experts-intro' }, L.intro),
      el('label', { for: 'yk-experts-q' }, L.q), ta, el('small', { id: 'yk-experts-qhint' }, L.qHint),
      el('div', { class: 'yk-experts-row' },
        el('div', {}, el('label', { for: 'yk-experts-lang' }, L.lang), sel),
        el('div', {}, el('label', { for: 'yk-experts-nick' }, L.nick), nick)),
      el('p', { class: 'yk-experts-privacy' }, L.privacy),
      send, msg);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = validateQuestion({ question: ta.value, lang: sel.value, nickname: nick.value });
      if (!v.ok) { msg.textContent = L.errors[v.error] || v.error; msg.dataset.kind = 'error'; ta.focus(); return; }
      send.disabled = true; send.textContent = L.sending; msg.textContent = '';
      const r = await api('POST', { body: { action: 'submit', ...v.value } });
      send.disabled = false; send.textContent = L.send;
      if (!r.ok || !normalizeTicket(r.data.ticket)) { msg.textContent = r.status ? (L.errors[r.data.error] || L.offline) : L.offline; msg.dataset.kind = 'error'; return; }
      addTicket(storage(), r.data.ticket);
      const code = formatTicket(r.data.ticket);
      const copy = el('button', { type: 'button', class: 'yk-experts-secondary' }, L.copy);
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(code); copy.textContent = L.copied; } catch { /* clipboard blocked: code is visible */ } });
      body.replaceChildren(el('div', { class: 'yk-experts-done', role: 'status' },
        el('p', {}, L.sent), el('p', { class: 'yk-experts-code', dir: 'ltr' }, code), copy, el('p', { class: 'yk-experts-muted' }, L.keep)));
      copy.focus();
    });
    queueMicrotask(() => ta.focus());
    return form;
  }

  function answerBlock(it) {
    const box = el('div', { class: 'yk-experts-answer' });
    if (it.answer) box.append(el('p', { dir: 'auto', class: 'yk-experts-answer-text' }, it.answer));
    if (it.status === 'referred') box.append(el('p', { class: 'yk-experts-muted' }, L.referNote));
    if (it.sources?.length) {
      box.append(el('h4', {}, L.sources), el('ul', {}, it.sources.map((u) => {
        let safe = null; try { const x = new URL(u); if (x.protocol === 'https:') safe = x.href; } catch { /* drop */ }
        return safe ? el('li', {}, el('a', { href: safe, target: '_blank', rel: 'noopener noreferrer', dir: 'ltr' }, safe)) : null;
      })));
    }
    if (it.reviewer) box.append(el('p', { class: 'yk-experts-by' }, `${L.reviewer}: `, el('bdi', {}, it.reviewer), it.title ? ` — ${it.title}` : ''));
    if (it.level && LEVELS[it.level]) box.append(el('p', { class: 'yk-experts-muted' }, `${L.level}: ${LEVELS[it.level].ar} · ${LEVELS[it.level].name[lang === 'en' ? 'en' : 'ar']}`));
    if (it.status === 'answered') box.append(el('p', { class: 'yk-experts-muted' }, L.general));
    return box;
  }

  function mineView() {
    const wrap = el('div', { class: 'yk-experts-mine' });
    const list = el('div', { class: 'yk-experts-list', 'aria-live': 'polite' });
    const codeIn = el('input', { type: 'text', placeholder: L.addPh, dir: 'ltr', 'aria-label': L.add, maxlength: 20, autocomplete: 'off' });
    const addBtn = el('button', { type: 'button', class: 'yk-experts-secondary' }, L.add);
    const refresh = el('button', { type: 'button', class: 'yk-experts-secondary' }, L.refresh);
    const msg = el('p', { class: 'yk-experts-msg', role: 'status' });
    addBtn.addEventListener('click', () => {
      const t = normalizeTicket(codeIn.value);
      if (!t) { msg.textContent = L.errors.bad_ticket; return; }
      addTicket(storage(), t); codeIn.value = ''; msg.textContent = ''; load();
    });
    refresh.addEventListener('click', () => load());
    async function load() {
      const tickets = loadTickets(storage());
      if (!tickets.length) { list.replaceChildren(el('p', { class: 'yk-experts-muted' }, L.none)); return; }
      list.setAttribute('aria-busy', 'true');
      const r = await api('GET', { query: `?tickets=${tickets.join(',')}` });
      list.removeAttribute('aria-busy');
      if (!r.ok || !Array.isArray(r.data.items)) { list.replaceChildren(el('p', { class: 'yk-experts-msg', 'data-kind': 'error' }, L.offline)); return; }
      list.replaceChildren(...(r.data.items || []).map((it) => {
        const del = el('button', { type: 'button', class: 'yk-experts-link' }, L.del);
        del.addEventListener('click', async () => {
          if (!window.confirm(L.delConfirm)) return;
          const d = await api('POST', { body: { action: 'delete', ticket: it.ticket } });
          if (d.ok || it.status === 'not_found') { removeTicket(storage(), it.ticket); load(); } else msg.textContent = L.offline;
        });
        return el('article', { class: 'yk-experts-item', 'data-status': it.status },
          el('div', { class: 'yk-experts-item-head' },
            el('span', { class: 'yk-experts-code-sm', dir: 'ltr' }, formatTicket(it.ticket)),
            el('span', { class: 'yk-experts-badge' }, L.status[it.status] || it.status)),
          it.question ? el('p', { dir: 'auto', class: 'yk-experts-qtext' }, it.question) : null,
          it.status !== 'new' && it.status !== 'not_found' ? answerBlock(it) : null,
          del);
      }));
    }
    wrap.append(el('div', { class: 'yk-experts-row yk-experts-tools' }, codeIn, addBtn, refresh), msg, list);
    load();
    return wrap;
  }

  tabAsk.addEventListener('click', () => select('ask'));
  tabMine.addEventListener('click', () => select('mine'));
  closeBtn.addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.append(root);
  select(loadTickets(storage()).length && !prefill ? 'mine' : 'ask');
  return close;
}

export default { open };
