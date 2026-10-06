// Situation flow: setup + dialogue -> choices -> consequence(+points) -> ruling card -> check question -> done.
import { h } from '../dom.js';
import { t, tr, getLang } from '../i18n.js';
import { QUALITY } from '../config.js';
import { getRuling } from '../content.js';
import { recordChoice, recordCheck, markDone, sitRecord } from '../progress.js';
import { openModal, setContent, btn, tilt, prefersReducedMotion } from './overlay.js';
import { renderRulingCard, statusBadge } from './rulingCard.js';
import './strings.js';
import './aiStrings.js';
import { speakButton, stopSpeaking, unlockAudio } from '../tts.js';
import { listen, stopListening, speak, voiceInputSupported, voiceOutputSupported } from '../../features/voice/index.js';
import { openAskPanel } from './askPanel.js';

function speakerName(speaker, sit, script) {
  if (!speaker || speaker === 'narrator') return null;
  if (speaker === 'adam') return t('adam');
  if (sit.npc?.id === speaker) return tr(sit.npc.name) || speaker;
  const other = (script?.situations || []).find((s) => s.npc?.id === speaker);
  if (other) return tr(other.npc.name);
  return speaker.charAt(0).toUpperCase() + speaker.slice(1);
}
function speakerRole(speaker, sit, script) {
  if (sit.npc?.id === speaker) return tr(sit.npc.role) || '';
  const other = (script?.situations || []).find((s) => s.npc?.id === speaker);
  return tr(other?.npc?.role) || '';
}

// Portrait palette: a stable hue per speaker id (no images; a monogram in the 8-point star frame).
const HUES = ['#2f8f74', '#b5793a', '#3f7cac', '#8a5a9e', '#a8553f', '#4b8a8c', '#7d8a3a'];
function hueFor(id) { let n = 0; for (const c of String(id)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return HUES[n % HUES.length]; }
function portrait(speaker, name) {
  const letter = [...String(name || '?').trim()][0] || '?';
  return h('div', { class: 'portrait', style: { '--pc': speaker === 'adam' ? '#2a6f86' : hueFor(speaker) }, 'aria-hidden': 'true' },
    h('span', { class: 'portrait-star' }), h('span', { class: 'portrait-letter' }, letter));
}

/**
 * Word-by-word reveal. The full text is in the DOM from the start (screen readers and layout get the final text,
 * Arabic shaping never "jumps"); each word only fades in on a staggered delay. Returns { el, finish, typing() }.
 */
function typewriter(text) {
  const el = h('p', { class: 'line-text' });
  const parts = String(text || '').split(/(\s+)/);
  const words = parts.filter((p) => p && !/^\s+$/.test(p)).length;
  const reduce = prefersReducedMotion();
  // ~45 ms per word, the whole line capped at ~1.8 s
  const step = Math.min(45, 1800 / Math.max(1, words));
  let i = 0;
  for (const p of parts) {
    if (!p) continue;
    if (/^\s+$/.test(p)) el.append(p);
    else el.append(h('span', { class: 'w', style: { animationDelay: `${Math.round(i++ * step)}ms` } }, p));
  }
  const total = reduce ? 0 : Math.round(i * step) + 260;
  let done = total === 0;
  if (done) el.classList.add('instant'); else el.classList.add('typing');
  const timer = done ? 0 : setTimeout(() => { done = true; el.classList.remove('typing'); el.dispatchEvent(new Event('typed')); }, total);
  return {
    el,
    typing: () => !done,
    finish() { if (done) return; done = true; clearTimeout(timer); el.classList.remove('typing'); el.classList.add('instant'); el.dispatchEvent(new Event('typed')); }
  };
}

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const nextLabel = () => `${t('next')} ${document.documentElement.dir === 'rtl' ? '‹' : '›'}`;
const wait = (fn) => new Promise((resolve) => fn(resolve));

/** Number-key shortcuts for a list of buttons while `container` is in the DOM. */
function numberKeys(container, buttons) {
  const onKey = (e) => {
    if (!document.contains(container)) { document.removeEventListener('keydown', onKey); return; }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= buttons.length && !buttons[n - 1].disabled) { e.preventDefault(); document.removeEventListener('keydown', onKey); buttons[n - 1].click(); }
  };
  document.addEventListener('keydown', onKey);
}

/** "+10 pts": the signed number is an LTR island so it never flips to "10+" in Arabic. */
const pointsEl = (n) => h('span', { class: `points ${n > 0 ? 'pos' : 'zero'}` }, h('bdi', { dir: 'ltr' }, `+${n}`), ` ${t('points')}`);

const QUALITY_ICON = { best: '✓', acceptable: '◐', wrong: '✕' };

/** The always-visible review status + action buttons under the ruling card (a real footer, never over the content). */
function rulingFooter(ruling, rulingId, ...buttons) {
  return h('div', { class: 'row end sticky-actions' },
    h('div', { class: 'review-chip' }, statusBadge(ruling?.review_status || 'ai_draft', 'compact')),
    rulingId ? btn(t('askBtn'), () => openAskPanel({ rulingId }), 'ghost ask-open') : null,
    buttons);
}

/** The ruling card plus a read-aloud button on its "In plain words" box (hooked from outside rulingCard.js). */
function rulingCardWithTts(ruling, rulingId) {
  const card = renderRulingCard(ruling, rulingId);
  try {
    const plain = card.querySelector('.rc-plain');
    const head = plain?.querySelector('.rc-h');
    const b = head && speakButton(() => plain.querySelector('.plain')?.textContent || '', 'tts-plain');
    if (b) head.append(b);
  } catch { /* never break the card */ }
  return card;
}


// ---------------- «Talk to <NPC>»: live voice / typed conversation with the situation's character
// listen -> POST /.netlify/functions/npc -> reply bubble + spoken (tts.js) -> listen again. When the player's words
// clearly express one of the choices, the server returns its id and that choice button is tapped (same as a tap),
// so the scripted consequence and the reviewed ruling card follow.
export const NPC_ENDPOINT = '/.netlify/functions/npc';
const TALK_STR = {
  talk: { ar: (n) => `تحدّث مع ${n}`, en: (n) => `Talk to ${n}`, es: (n) => `Habla con ${n}`, zh: (n) => `和${n}交谈`, hi: (n) => `${n} से बात करें` },
  stop: { ar: 'إنهاء المحادثة', en: 'End conversation', es: 'Terminar la conversación', zh: '结束对话', hi: 'बातचीत समाप्त करें' },
  listening: { ar: 'أستمع… تكلّم', en: 'Listening… speak', es: 'Escuchando… habla', zh: '正在聆听…请说话', hi: 'सुन रहे हैं… बोलिए' },
  thinking: { ar: (n) => `${n} يفكّر…`, en: (n) => `${n} is thinking…`, es: (n) => `${n} está pensando…`, zh: (n) => `${n}正在思考…`, hi: (n) => `${n} सोच रहे हैं…` },
  speaking: { ar: (n) => `${n} يتحدّث…`, en: (n) => `${n} is speaking…`, es: (n) => `${n} está hablando…`, zh: (n) => `${n}正在说话…`, hi: (n) => `${n} बोल रहे हैं…` },
  placeholder: { ar: 'اكتب ما تقوله…', en: 'Type what you say…', es: 'Escribe lo que dices…', zh: '输入你想说的话…', hi: 'जो कहना है लिखें…' },
  send: { ar: 'إرسال', en: 'Send', es: 'Enviar', zh: '发送', hi: 'भेजें' },
  you: { ar: 'آدم', en: 'Adam', es: 'Adam', zh: '亚当', hi: 'आदम' },
  failed: { ar: 'تعذّر الرد الآن. اختر من الخيارات.', en: "Couldn't reply right now. Pick one of the options.", es: 'No se pudo responder ahora. Elige una opción.', zh: '暂时无法回复。请选择一个选项。', hi: 'अभी जवाब नहीं मिल सका। कोई विकल्प चुनें।' },
  note: { ar: 'محادثة بالذكاء الاصطناعي داخل الموقف فقط؛ الحكم في «بطاقة الحكم».', en: 'AI role-play inside this scene only; the ruling is on the ruling card.', es: 'Juego de rol con IA solo dentro de esta escena; el dictamen está en la tarjeta.', zh: '仅限本场景的AI角色扮演；裁决见裁决卡。', hi: 'केवल इस दृश्य में AI रोल-प्ले; हुक्म कार्ड पर है।' }
};
const ts = (k, lang, ...a) => { const v = TALK_STR[k]?.[lang] ?? TALK_STR[k]?.en; return typeof v === 'function' ? v(...a) : v; };
let npcUnavailable = false; // the first { unavailable } hides the talk button for the rest of the session
const TALK_TEXT_MAX = 300;

/** Payload for the npc function (caps mirror npc.mjs so a long scene never exceeds the 16 KB body limit). */
export function npcPayload(sit, choices, lang, history, text) {
  const cut = (s, n) => String(s || '').slice(0, n);
  return {
    lang,
    situation_id: sit.key || sit.ruling_id || '',
    npc: { id: sit.npc?.id || '', name: cut(tr(sit.npc?.name), 60), role: cut(tr(sit.npc?.role), 120) },
    setup: cut(tr(sit.setup), 600),
    dialogue: (sit.dialogue || []).slice(0, 8).map((d) => ({ speaker: d.speaker || 'narrator', text: cut(tr(d), 400) })),
    choices: choices.map((c) => ({ id: c.id, label: cut(tr(c.label), 300) })),
    history: history.slice(-6).map((x) => ({ who: x.who, text: cut(x.text, 300) })),
    text: cut(text, TALK_TEXT_MAX)
  };
}

function npcTalk(sit, choices, onChoice) {
  if (npcUnavailable || !sit.npc || typeof fetch !== 'function') return null;
  const lang = getLang();
  const name = tr(sit.npc.name) || sit.npc.id || '';
  const history = [];
  let open = false, closed = false, busy = false, live = false, seq = 0, misses = 0;
  const log = h('div', { class: 'npc-talk-log', role: 'log', 'aria-live': 'polite' });
  const state = h('span', { class: 'npc-talk-state', role: 'status', 'aria-live': 'polite' });
  const box = h('input', { type: 'text', class: 'npc-talk-input', maxlength: String(TALK_TEXT_MAX), placeholder: ts('placeholder', lang), 'aria-label': ts('placeholder', lang), dir: 'auto' });
  const send = h('button', { type: 'button', class: 'npc-talk-send' }, ts('send', lang));
  const voice = voiceInputSupported();
  const toggle = h('button', { type: 'button', class: 'npc-talk-btn', 'aria-pressed': 'false', onclick: () => (open ? end() : start()) },
    h('span', { class: 'npc-talk-dot', 'aria-hidden': 'true' }), h('span', { class: 'npc-talk-label' }, ts('talk', lang, name)));
  const panel = h('div', { class: 'npc-talk-panel', hidden: true },
    log,
    h('div', { class: 'npc-talk-row' }, box, send),
    h('p', { class: 'npc-talk-note' }, ts('note', lang)));
  const el = h('div', { class: 'npc-talk', dir: 'auto' }, h('div', { class: 'npc-talk-bar' }, toggle, state), panel);

  const setState = (k) => { state.textContent = k ? ts(k, lang, name) : ''; toggle.dataset.state = k || ''; };
  const bubble = (who, text) => {
    log.append(h('div', { class: `npc-talk-msg ${who}` }, h('span', { class: 'npc-talk-who' }, who === 'npc' ? name : ts('you', lang)), h('p', { dir: 'auto' }, text)));
    try { log.lastElementChild.scrollIntoView({ block: 'nearest' }); } catch { /* */ }
  };
  function hide() { npcUnavailable = true; end(); el.remove(); }
  function end() {
    seq++; live = false; open = false;
    stopListening(); stopSpeaking();
    toggle.setAttribute('aria-pressed', 'false'); toggle.classList.remove('on');
    toggle.querySelector('.npc-talk-label').textContent = ts('talk', lang, name);
    setState(null);
  }
  function close() { closed = true; end(); }
  function start() {
    if (closed) return;
    unlockAudio(); // inside the click: the spoken replies may play later without a gesture
    open = true; live = voice; misses = 0;
    panel.hidden = false;
    toggle.setAttribute('aria-pressed', 'true'); toggle.classList.add('on');
    toggle.querySelector('.npc-talk-label').textContent = ts('stop', lang);
    if (live) liveListen(); else { try { box.focus({ preventScroll: true }); } catch { /* */ } }
  }
  function liveListen() {
    if (!live || closed || busy) return;
    const mine = ++seq;
    setState('listening');
    const session = listen({
      lang,
      onInterim: (t) => { if (mine === seq) box.value = t.slice(0, TALK_TEXT_MAX); },
      onFinal: (t) => { if (mine === seq) { misses = 0; say(t); } },
      onError: (msg, code) => { if (mine === seq && ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'start'].includes(code)) { live = false; setState(null); state.textContent = msg || ''; } },
      onEnd: (t) => {
        if (mine !== seq || !live || closed || t || busy) return;
        if (++misses >= 2) { live = false; setState(null); return; } // two silent turns: stop listening, typing still works
        liveListen();
      }
    });
    if (!session && mine === seq) { live = false; setState(null); }
  }
  async function say(raw) {
    const text = String(raw || '').trim().slice(0, TALK_TEXT_MAX);
    if (!text || busy || closed) return;
    const mine = ++seq;
    stopListening();
    box.value = '';
    bubble('player', text);
    busy = true; send.disabled = true;
    setState('thinking');
    let out = null;
    try {
      const res = await fetch(NPC_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(npcPayload(sit, choices, lang, history, text)) });
      out = await res.json().catch(() => null);
    } catch { out = null; }
    busy = false; send.disabled = false;
    if (closed || mine !== seq) return;
    if (out?.unavailable) { hide(); return; }
    history.push({ who: 'player', text });
    const reply = typeof out?.reply === 'string' ? out.reply.trim() : '';
    if (!reply && !out?.choice) { setState(null); state.textContent = ts('failed', lang); return; }
    if (reply) { bubble('npc', reply); history.push({ who: 'npc', text: reply }); }
    const picked = out?.choice ? choices.find((c) => c.id === out.choice) : null;
    if (picked) {
      // let the character finish its line, then tap that choice (consequence + ruling card follow)
      live = false;
      const go = () => { if (mine === seq && !closed) onChoice(picked); };
      setState(reply ? 'speaking' : null);
      if (!(reply && voiceOutputSupported() && speak(reply, lang, { onEnd: go, onStop: go }))) setTimeout(go, reply ? 1600 : 0);
      return;
    }
    if (!reply) { liveListen(); return; }
    setState('speaking');
    const spoke = voiceOutputSupported() && speak(reply, lang, {
      onEnd: () => { if (mine === seq && !closed) { setState(null); if (live) liveListen(); } },
      onStop: () => { if (mine === seq) setState(null); }
    });
    if (!spoke) { setState(null); if (live) liveListen(); }
  }
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); say(box.value); } });
  box.addEventListener('keyup', (e) => e.stopPropagation());
  send.addEventListener('click', () => say(box.value));
  toggle.addEventListener('keydown', (e) => e.stopPropagation());
  return { el, close };
}

/**
 * Run a situation. opts: { script, startAt: 'dialogue'|'choices'|'ruling', onPoints(total), onFaceNpc }
 * Resolves when the player closes the flow.
 */
export async function runSituation(sit, opts = {}) {
  const { script } = opts;
  const key = sit.key || sit.ruling_id;
  let startAt = opts.startAt || 'dialogue';

  // ---------------- dialogue phase (bottom sheet, scene stays visible)
  const sheet = openModal({ variant: 'sheet', className: 'dialogue', label: tr(sit.npc?.name) || t('whatDoYouDo') });
  let lastChoice = null;
  try {
    if (startAt === 'dialogue') {
      const lines = [];
      if (tr(sit.setup)) lines.push({ speaker: 'narrator', text: tr(sit.setup), setup: true });
      for (const d of sit.dialogue || []) lines.push({ speaker: d.speaker, text: tr(d) });
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        const name = speakerName(L.speaker, sit, script);
        const role = name && L.speaker !== 'adam' ? speakerRole(L.speaker, sit, script) : '';
        await wait((next) => {
          const tw = typewriter(L.text);
          const skip = h('button', { type: 'button', class: 'skip-line', onclick: () => tw.finish(), 'aria-label': t('skipLine') }, `${t('skip')} »`);
          tw.el.addEventListener('typed', () => skip.classList.add('gone'));
          if (!tw.typing()) skip.classList.add('gone');
          const nextBtn = btn(nextLabel(), () => { stopSpeaking(); next(); }, 'primary', { 'data-autofocus': true });
          const isAdam = L.speaker === 'adam';
          const bubble = h('div', { class: 'bubble', onclick: () => tw.finish() }, tw.el);
          setContent(sheet, [
            h('div', { class: `line ${name ? 'speech' : 'narration'}${isAdam ? ' adam' : ''}`, 'data-speaker': L.speaker || 'narrator' },
              h('div', { class: 'line-head' },
                name ? portrait(L.speaker, name) : h('div', { class: 'portrait narr', 'aria-hidden': 'true' }, h('span', { class: 'portrait-letter' }, '❝')),
                h('div', { class: 'nameplate' },
                  h('div', { class: 'speaker' }, name || t('narratorLabel')),
                  role ? h('div', { class: 'role' }, role) : null),
                speakButton(L.text, 'tts-line'),
                skip),
              bubble),
            h('div', { class: 'row end' },
              h('span', { class: 'progress-dots', 'aria-label': `${i + 1}/${lines.length}` },
                lines.map((_, j) => h('span', { class: `dot${j < i ? ' past' : j === i ? ' now' : ''}`, 'aria-hidden': 'true' })),
                h('span', { class: 'count', 'aria-hidden': 'true' }, `${i + 1}/${lines.length}`)),
              nextBtn)
          ]);
        });
      }
    }

    if (startAt === 'dialogue' || startAt === 'choices') {
      // Shuffled on every display: the 'best' option is often the longest, so a fixed order would give it away.
      const choices = shuffle(sit.choices || []);
      if (choices.length) {
        const rec = sitRecord(key);
        lastChoice = await wait((resolve) => {
          let talk = null;
          const pick = (c) => { talk?.close(); resolve(c); };
          const buttons = choices.map((c, i) => {
            const tried = rec?.tried?.includes(c.id);
            return tilt(h('button', { type: 'button', class: `choice${tried ? ' tried' : ''}`, style: { '--i': i }, onclick: () => pick(c), ...(i === 0 ? { 'data-autofocus': true } : {}) },
              h('span', { class: 'num', 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, tr(c.label))), 3);
          });
          const wrap = h('div', { class: 'choices', role: 'group', 'aria-label': t('whatDoYouDo') }, buttons);
          // the character's choice -> tap that button (same as the player tapping it)
          talk = npcTalk(sit, choices, (c) => { const b = buttons[choices.indexOf(c)]; if (b && document.contains(b)) { b.focus(); b.click(); } else pick(c); });
          setContent(sheet, [
            h('div', { class: 'choices-head' }, h('div', { class: 'speaker' }, t('whatDoYouDo')), h('span', { class: 'hint' }, t('choiceHint'))),
            talk?.el || null,
            wrap]);
          numberKeys(wrap, buttons);
        });
        recordChoice(key, lastChoice);
        opts.onPoints?.();
        const q = QUALITY[lastChoice.quality] || QUALITY.acceptable;
        await wait((next) => {
          setContent(sheet, [
            h('div', { class: `consequence q-${lastChoice.quality || 'acceptable'}` },
              h('div', { class: 'row' },
                h('span', { class: 'badge quality', style: { '--c': q.color } }, h('span', { class: 'v-icon', 'aria-hidden': 'true' }, QUALITY_ICON[lastChoice.quality] || '•'), h('span', {}, q[document.documentElement.lang] || q.en)),
                pointsEl(lastChoice.points)),
              h('p', { class: 'line-text' }, tr(lastChoice.consequence))),
            h('div', { class: 'row end' }, btn(t('seeRuling'), next, 'primary', { 'data-autofocus': true }))
          ]);
        });
      }
    }
  } finally {
    stopListening();
    stopSpeaking();
    sheet.close();
  }

  // ---------------- ruling + check phase (full modal)
  const ruling = getRuling(sit.ruling_id);
  const modal = openModal({ className: 'ruling-modal', label: t('ruling') });
  let action = 'done';
  try {
    await wait((next) => {
      setContent(modal, [rulingCardWithTts(ruling, sit.ruling_id), rulingFooter(ruling, sit.ruling_id, btn(nextLabel(), () => { stopSpeaking(); next(); }, 'primary', { 'data-autofocus': true }))]);
      modal.box.scrollTop = 0;
    });

    const cq = sit.check_question;
    if (cq && Array.isArray(cq.options) && cq.options.length) {
      await wait((next) => {
        const fb = h('p', { class: 'feedback', role: 'status' });
        let answered = false;
        const doneBtn = btn(nextLabel(), next, 'primary', { disabled: true });
        const buttons = cq.options.map((o, i) => h('button', {
          type: 'button', class: 'choice', style: { '--i': i }, ...(i === 0 ? { 'data-autofocus': true } : {}),
          onclick: () => {
            if (answered) return; answered = true;
            const ok = !!o.correct;
            recordCheck(key, ok);
            opts.onPoints?.();
            buttons.forEach((b, j) => { b.disabled = true; if (cq.options[j].correct) b.classList.add('correct'); });
            if (!ok) buttons[i].classList.add('wrong');
            fb.textContent = ok ? t('correct') : t('incorrect');
            fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
            doneBtn.disabled = false; doneBtn.focus();
          }
        }, h('span', { class: 'num', 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, tr(o))));
        const wrap = h('div', { class: 'choices', role: 'group', 'aria-label': t('checkTitle') }, buttons);
        setContent(modal, [h('div', { class: 'check' }, h('p', { class: 'eyebrow' }, t('checkTitle')), h('h2', {}, tr(cq.q)), wrap, fb), h('div', { class: 'row end' }, doneBtn)]);
        numberKeys(wrap, buttons);
      });
    }
    markDone(key);
    opts.onPoints?.();

    action = await wait((done) => {
      const rec = sitRecord(key);
      const canRetry = (sit.choices || []).length > 1;
      const n = (sit.choices || []).length;
      setContent(modal, [h('div', { class: 'check finish' },
        h('div', { class: 'finish-mark', 'aria-hidden': 'true' }, h('span', {}, '✓')),
        h('p', { class: 'eyebrow' }, tr(sit.npc?.name) || ''),
        h('h2', {}, t('finishSituation')),
        lastChoice ? h('p', { class: 'finish-choice' }, h('span', {}, tr(lastChoice.label)), ' ', pointsEl(lastChoice.points)) : null,
        rec?.tried?.length ? h('div', { class: 'tried-meter', 'aria-label': `${rec.tried.length}/${n}` },
          Array.from({ length: n }, (_, j) => h('span', { class: `pip${j < rec.tried.length ? ' on' : ''}`, 'aria-hidden': 'true' })),
          h('span', { class: 'muted', 'aria-hidden': 'true' }, `${rec.tried.length}/${n}`)) : null),
      h('div', { class: 'row end wrap' },
        canRetry ? btn(t('tryAnother'), () => done('retry'), 'ghost') : null,
        btn(t('finishSituation'), () => done('done'), 'primary', { 'data-autofocus': true }))]);
    });
  } finally {
    modal.close();
  }
  if (action === 'retry') return runSituation(sit, { ...opts, startAt: 'choices' });
  return 'done';
}

/** Menu shown when the player re-triggers a completed hotspot. Resolves 'retry' | 'review' | null. */
export function revisitMenu(sit) {
  return new Promise((resolve) => {
    const m = openModal({ className: 'small', label: t('alreadyDone'), dismissible: true, onClose: (r) => resolve(r ?? null) });
    setContent(m, [
      h('p', { class: 'eyebrow' }, tr(sit.npc?.name) || ''),
      h('h2', {}, t('alreadyDone')),
      h('div', { class: 'stack' },
        btn(t('tryAnother'), () => m.close('retry'), 'primary', { 'data-autofocus': true }),
        btn(t('reviewRuling'), () => m.close('review'), 'ghost'),
        btn(t('close'), () => m.close(null), 'ghost'))
    ]);
  });
}

/** Ruling card alone (review mode). */
export function showRulingOnly(sit) {
  return new Promise((resolve) => {
    const m = openModal({ className: 'ruling-modal', label: t('ruling'), dismissible: true, onClose: () => resolve() });
    const r = getRuling(sit.ruling_id);
    setContent(m, [rulingCardWithTts(r, sit.ruling_id), rulingFooter(r, sit.ruling_id, btn(t('close'), () => { stopSpeaking(); m.close(); }, 'primary', { 'data-autofocus': true }))]);
  });
}
