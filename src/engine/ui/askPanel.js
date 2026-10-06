// "Ask about this" panel (constrained AI dialogue).
//  (a) chips of pre-authored, reviewed questions (content/script/questions.json) -> answer + resolved sources + referral
//  (b) a free-text box -> personal-fatwa pre-filter (fixed referral, no model) -> retrieval over reviewed passages ->
//      /.netlify/functions/ask (answers ONLY from the retrieved passages) -> client validator -> answer + cited passages.
//      No endpoint / key / valid answer -> the closest prepared answer, or abstain + referral.
// Questions are never stored or logged.
import { h, link } from '../dom.js';
import { t, tr, getLang } from '../i18n.js';
import { CATALOG } from '../config.js';
import { getQuestions, getSources, getRuling, getScript } from '../content.js';
import { openModal } from './overlay.js';
import { speakButton, stopSpeaking } from '../tts.js';
import { isPersonalFatwa, retrieve, validateAnswer, ASK_MAX } from '../aiCore.js';
import './aiStrings.js';
import { micButton, stopListening } from '../../features/voice/index.js';

export const ASK_ENDPOINT = '/.netlify/functions/ask';
const TIMEOUT_MS = 12000;
let endpointDown = false; // after one failed call, stop trying for this session (static hosting / no key)

let srcIndex = null;
const sourceById = (id) => {
  if (!srcIndex) srcIndex = new Map(getSources().map((s) => [s.id, s]));
  return srcIndex.get(id) || null;
};

/** Resolved citations as a list; ids that do not resolve in sources.json are silently left out. */
function sourceList(ids) {
  const recs = [...new Set(ids || [])].map(sourceById).filter(Boolean);
  if (!recs.length) return null;
  return h('div', { class: 'ask-sources' }, h('h4', {}, t('askSources')),
    h('ul', { class: 'rc-list' }, recs.map((s) => h('li', {}, h('bdi', { dir: 'auto' }, String(s.citation || s.id)), ' ', link(s.url, t('source'))))));
}

const titleOf = (rid) => tr(getRuling(rid)?.title) || tr(CATALOG.find((c) => c.id === rid)?.title) || rid;

// Study instrumentation: outcome counts only (never the question text); a no-op unless a participant is enrolled.
const trackAsk = (outcome) => { import('../../features/study/index.js').then((m) => m.track?.('ask', { outcome })).catch(() => {}); };

// Human review loop: "Send to the scholars" closes this panel and opens the experts panel with the question prefilled.
let closeAsk = null;
const SCHOLARS_BTN = { ar: 'أرسل سؤالك إلى أهل العلم', en: 'Send your question to the scholars' };
function scholarsButton(question = '') {
  return h('button', { type: 'button', class: 'btn ask-scholars', onclick: () => {
    const lang = getLang();
    closeAsk?.();
    const prefill = String(question || '').slice(0, 1000);
    // Through the engine (player input stays paused, no stacked panels); direct open only when the engine is absent.
    Promise.resolve(typeof window !== 'undefined' && window.yawmuk?.openFeature ? window.yawmuk.openFeature('experts', { prefill }) : false)
      .catch(() => false)
      .then((ok) => (ok ? null : import('../../features/experts/index.js').then((m) => m.open({ lang, prefill, onClose: () => {} }))))
      .catch((e) => console.error('[ask] experts panel failed', e));
  } }, tr(SCHOLARS_BTN));
}

function referBlock(rulingId, text, question = '') {
  const when = text || (rulingId ? tr(getRuling(rulingId)?.refer_to_scholar_when) : '');
  return h('div', { class: 'ask-refer' }, h('p', { class: 'ask-refer-main' }, t('askRefer')), when ? h('p', { class: 'muted' }, h('strong', {}, `${t('askReferWhen')}: `), when) : null,
    scholarsButton(question));
}

function textWithTts(cls, text) {
  return h('div', { class: 'ask-text-row' }, h('p', { class: cls }, text), speakButton(() => text));
}

/** Reviewed passages the free-text question may be answered from (current language only). */
function buildPassages({ rulingId, location }) {
  const rids = rulingId ? [rulingId] : (getScript(location)?.situations || []).map((s) => s.ruling_id);
  const out = [];
  for (const rid of rids) {
    const r = getRuling(rid);
    if (!r) continue;
    const title = titleOf(rid);
    const g = tr(r.practical_guidance);
    const add = (part, label, text) => { if (text) out.push({ id: `r:${rid}:${part}`, label: `${title} — ${label}`, text: String(text), rulingId: rid, boost: 0.3 }); };
    add('plain', t('plainWords'), tr(r.newcomer_explainer));
    add('summary', t('summary'), tr(r.summary));
    add('guidance', t('guidance'), Array.isArray(g) ? g.join(' ') : g);
    add('refer', t('referScholar'), tr(r.refer_to_scholar_when));
  }
  for (const q of getQuestions()) {
    const text = `${tr(q.question)} ${tr(q.answer)}`.trim();
    if (!text) continue;
    const near = rids.includes(q.case_id) || rids.includes(q.related_ruling) || q.location === location;
    out.push({ id: `q:${q.id}`, label: tr(q.question), text, item: q, boost: near ? 0.5 : 0 });
  }
  return out;
}

async function askModel(question, passages, lang) {
  if (endpointDown) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ASK_ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ lang, question, passages: passages.map((p) => ({ id: p.id, text: p.text.slice(0, 1200) })) })
    });
    if (!res.ok) { if (res.status === 404 || res.status === 501 || res.status === 503) endpointDown = true; return null; }
    const j = await res.json();
    if (j && j.unavailable) { endpointDown = true; return null; } // no AI key on the server: reviewed answers only
    return j;
  } catch { endpointDown = true; return null; } finally { clearTimeout(timer); }
}

/** Answer view for a pre-authored item. */
function preparedAnswer(item, label = t('askPreparedLabel')) {
  const corr = item.correction?.source_id ? h('p', { class: 'ask-correction muted' }, t('askCorrection')) : null;
  return h('div', { class: 'ask-answer prepared' },
    h('p', { class: 'eyebrow' }, label),
    h('h3', { class: 'ask-q' }, tr(item.question)),
    textWithTts('ask-a', tr(item.answer)),
    corr,
    sourceList([...(item.source_ids || []), ...(item.correction?.source_id ? [item.correction.source_id] : [])]),
    item.refer ? referBlock(item.related_ruling || item.case_id, tr(item.refer_text), tr(item.question)) : null);
}

/**
 * Open the panel. opts: { rulingId } (from a ruling card) or { location } (per-location HUD button).
 * Resolves when closed.
 */
export function openAskPanel({ rulingId = null, location = null, itemId = null } = {}) {
  return new Promise((resolve) => {
    const m = openModal({ className: 'ask-modal', label: t('askTitle') });
    const onKey = (e) => { if (e.key === 'Escape' && document.contains(m.el)) { e.stopImmediatePropagation(); e.preventDefault(); done(); } };
    window.addEventListener('keydown', onKey, true);
    m.el.addEventListener('pointerdown', (e) => { if (e.target === m.el) done(); });
    function done() { window.removeEventListener('keydown', onKey, true); stopListening(); stopSpeaking(); if (closeAsk === done) closeAsk = null; m.close(); resolve(); }
    closeAsk = done;

    const start = itemId ? getQuestions().find((q) => q.id === itemId) : null;
    const loc = location || start?.location || (rulingId ? rulingId.split('.')[0] : null);
    const items = getQuestions().filter((q) => (rulingId ? q.case_id === rulingId || q.related_ruling === rulingId : q.location === loc)).slice(0, 8);
    const out = h('div', { class: 'ask-out', 'aria-live': 'polite' });
    const show = (...nodes) => { stopSpeaking(); out.replaceChildren(...nodes.filter(Boolean)); out.scrollIntoView?.({ block: 'nearest' }); };

    const chips = items.length
      ? h('div', { class: 'ask-chips', role: 'list' }, items.map((q) => h('button', { type: 'button', class: 'ask-chip', role: 'listitem', onclick: () => { trackAsk(q.refer ? 'refer' : 'answered'); show(preparedAnswer(q)); } }, tr(q.question))))
      : h('p', { class: 'muted' }, t('askNone'));

    const box = h('textarea', { class: 'ask-input', rows: '2', maxlength: String(ASK_MAX), placeholder: t('askPlaceholder'), 'aria-label': t('askFree'), dir: 'auto' });
    const count = h('span', { class: 'ask-count muted', 'aria-hidden': 'true' }, `0/${ASK_MAX}`);
    const send = h('button', { type: 'button', class: 'btn primary ask-send' }, t('askSend'));
    box.addEventListener('input', () => { if (box.value.length > ASK_MAX) box.value = box.value.slice(0, ASK_MAX); count.textContent = `${box.value.length}/${ASK_MAX}`; });
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send.click(); } });

    let busy = false;
    send.addEventListener('click', async () => {
      const q = box.value.trim().slice(0, ASK_MAX);
      if (!q || busy) return;
      const lang = getLang();
      if (isPersonalFatwa(q)) { trackAsk('refer'); show(h('div', { class: 'ask-answer refer' }, h('p', {}, t('askPersonal')), referBlock(rulingId, '', q))); return; }
      const passages = buildPassages({ rulingId, location: loc });
      const hits = retrieve(q, passages, 5);
      if (!hits.length) { trackAsk('abstain'); show(h('div', { class: 'ask-answer abstain' }, h('p', {}, t('askAbstain')), referBlock(rulingId, '', q))); return; }
      const byId = new Map(passages.map((p) => [p.id, p]));
      const sent = hits.map((x) => byId.get(x.id));
      busy = true; send.disabled = true;
      show(h('p', { class: 'muted ask-thinking' }, t('askThinking')));
      let raw = null;
      try { raw = await askModel(q, sent, lang); } finally { busy = false; send.disabled = false; }
      if (!document.contains(m.el)) return;
      if (raw) {
        const v = validateAnswer(raw, sent.map((p) => p.id), lang);
        if (!v.abstain) {
          trackAsk(v.refer ? 'refer' : 'answered');
          const used = v.used_ids.map((id) => byId.get(id)).filter(Boolean);
          show(h('div', { class: 'ask-answer ai' },
            h('p', { class: 'eyebrow ai-label' }, h('span', { class: 'badge status draft' }, t('askAiLabel'))),
            textWithTts('ask-a', v.answer),
            h('div', { class: 'ask-used' }, h('h4', {}, t('askUsed')),
              h('ul', { class: 'rc-list' }, used.map((p) => h('li', {}, h('strong', {}, p.label), h('span', { class: 'muted' }, ` — ${p.text.length > 220 ? `${p.text.slice(0, 220)}…` : p.text}`))))),
            sourceList(used.flatMap((p) => p.item?.source_ids || [])),
            v.refer ? referBlock(rulingId, '', q) : null));
          return;
        }
      }
      // no endpoint / model abstained / invalid answer: the closest prepared answer, else abstain + referral
      const top = hits.map((x) => byId.get(x.id)).find((p) => p.item);
      if (top && !raw) { trackAsk('answered'); show(preparedAnswer(top.item, t('askClosest'))); }
      else { trackAsk('abstain'); show(h('div', { class: 'ask-answer abstain' }, h('p', {}, t('askAbstain')), top ? preparedAnswer(top.item, t('askClosest')) : null, referBlock(rulingId, '', q))); }
    });

    // voice input (push-to-talk): the transcript fills the box and goes through the same text path as typing
    const voiceStatus = h('p', { class: 'muted ask-voice-status', role: 'status', 'aria-live': 'polite' });
    const mic = micButton({
      lang: getLang(),
      onInterim: (txt) => { box.value = txt.slice(0, ASK_MAX); count.textContent = `${box.value.length}/${ASK_MAX}`; },
      onFinal: (txt) => { box.value = txt.slice(0, ASK_MAX); count.textContent = `${box.value.length}/${ASK_MAX}`; voiceStatus.textContent = ''; send.click(); },
      onStatus: (msg) => { voiceStatus.textContent = msg || ''; }
    });

    m.body.replaceChildren(
      h('div', { class: 'ask-panel' },
        h('div', { class: 'ask-head' },
          h('div', {}, h('p', { class: 'eyebrow' }, rulingId ? titleOf(rulingId) : tr(getScript(loc)?.title) || ''), h('h2', {}, t('askTitle'))),
          h('button', { type: 'button', class: 'ask-close', 'aria-label': t('close'), onclick: done, 'data-autofocus': true }, '✕')),
        h('p', { class: 'ask-note muted' }, t('askNote')),
        h('h3', { class: 'ask-sub' }, t('askPrepared')),
        chips,
        out,
        h('div', { class: 'ask-free' },
          h('label', { class: 'ask-sub' }, t('askFree'), box),
          voiceStatus,
          h('div', { class: 'row ask-free-row' }, h('span', { class: 'muted ask-privacy' }, `${t('askPrivacy')} · `, count), mic, send))));
    if (start) show(preparedAnswer(start)); // e.g. "Start with the basics: Tawhid" from the start screen
  });
}
