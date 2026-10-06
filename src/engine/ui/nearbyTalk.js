// «Talk to anyone nearby»: walk up to a person -> a chip «🎙 T — تحدّث مع يوسف» -> press T / tap -> a compact
// conversation sheet: hands-free live voice (listen -> POST /.netlify/functions/npc { mode:'free' } -> spoken reply
// -> listen again) plus a text box. Same voice helpers as the situation's «Talk to <NPC>» (voice/index.js, tts.js).
// Bubbles carry data-speaker so game.js's watchDialogue() animates the character (talk while its line is live).
// Pure logic (who is talkable, proximity, payload, strings) lives in nearbyTalkCore.js.
import './nearbyTalk.css';
import { h } from '../dom.js';
import { getLang, tr, onLangChange } from '../i18n.js';
import { openModal } from './overlay.js';
import { stopSpeaking, unlockAudio } from '../tts.js';
import { listen, stopListening, speak, voiceInputSupported, voiceOutputSupported } from '../../features/voice/index.js';
import { NPC_ENDPOINT } from './situation.js';
import { ns, freePayload, TALK_TEXT_MAX } from './nearbyTalkCore.js';

let unavailable = false; // the first { unavailable } (no model configured) hides the chip for the rest of the session
export const talkUnavailable = () => unavailable;
/** Test hook: reset the session flag. */
export const resetTalkAvailability = () => { unavailable = false; };

/**
 * The proximity chip. Lives in the world layer (hidden with it outside play mode). set(person|null) shows
 * «🎙 T — Talk to <name>»; a tap (touch screens) or the T key (game.js -> input.onTalk) opens the conversation.
 */
export function createTalkChip({ onTalk }) {
  const text = h('span', { class: 'yk-talk-chip-text' });
  const el = h('button', { type: 'button', class: 'yk-talk-chip hidden', onclick: () => onTalk?.() },
    h('kbd', { class: 'yk-talk-chip-key', 'aria-hidden': 'true' }, 'T'),
    h('span', { class: 'yk-talk-chip-icon', 'aria-hidden': 'true' }, '🎙'),
    text);
  let person = null;
  function render() {
    if (!person || unavailable) { el.classList.add('hidden'); el.setAttribute('aria-hidden', 'true'); return; }
    const label = ns('prompt', getLang(), tr(person.name) || person.id);
    text.textContent = label;
    el.setAttribute('aria-label', label);
    el.removeAttribute('aria-hidden');
    el.classList.remove('hidden');
  }
  onLangChange(render);
  return { el, set(p) { if (p === person) return; person = p; render(); }, get person() { return person; } };
}

/**
 * Open the conversation sheet with `person` ({ id, name, role, persona, contexts }).
 * opts: { lang, place, onClose(), onGuide(), onUnavailable() } -> { close, el }
 * Never throws on a failed request: the "couldn't reply" state shows and the text box stays usable.
 */
export function openTalkPanel(person, { lang = getLang(), place = '', onClose, onGuide, onUnavailable } = {}) {
  const name = tr(person.name) || person.id || '';
  const dir = document.documentElement.dir || 'ltr';
  const history = [];
  let closed = false, busy = false, live = false, seq = 0, misses = 0, ended = false;
  const voice = voiceInputSupported();
  let after = null; // 'guide' when the panel closes to open the guide

  const log = h('div', { class: 'yk-talk-log', role: 'log', 'aria-live': 'polite' });
  const state = h('p', { class: 'yk-talk-state', role: 'status', 'aria-live': 'polite' });
  const box = h('input', { type: 'text', class: 'yk-talk-input', maxlength: String(TALK_TEXT_MAX), placeholder: ns('placeholder', lang), 'aria-label': ns('placeholder', lang), dir: 'auto', 'data-autofocus': true, autocomplete: 'off' });
  const send = h('button', { type: 'button', class: 'yk-talk-send' }, ns('send', lang));
  const mic = voice ? h('button', { type: 'button', class: 'yk-talk-mic', 'aria-pressed': 'false', 'aria-label': ns('mic', lang), title: ns('mic', lang), onclick: () => { unlockAudio(); if (live) { live = false; seq++; stopListening(); setState(null); } else { live = true; misses = 0; liveListen(); } } },
    h('span', { 'aria-hidden': 'true' }, '🎙')) : null;
  const endBtn = h('button', { type: 'button', class: 'yk-talk-end', onclick: () => m.close() }, ns('end', lang));
  const guideBtn = h('button', { type: 'button', class: 'yk-talk-guide', onclick: () => { after = 'guide'; m.close(); } }, `؟ ${ns('guideBtn', lang)}`);

  const m = openModal({
    variant: 'sheet', className: 'yk-talk-sheet', label: ns('prompt', lang, name), dismissible: true,
    onClose: () => {
      if (closed) return; closed = true;
      seq++; live = false;
      stopListening(); stopSpeaking();
      if (after === 'guide') onGuide?.();
      onClose?.();
    }
  });
  m.body.append(h('div', { class: 'yk-talk', dir },
    h('div', { class: 'yk-talk-head' },
      h('div', { class: 'yk-talk-avatar', 'aria-hidden': 'true' }, [...name.trim()][0] || '?'),
      h('div', { class: 'yk-talk-names' }, h('div', { class: 'yk-talk-name' }, name), tr(person.role) ? h('div', { class: 'yk-talk-role' }, tr(person.role)) : null),
      endBtn),
    log,
    state,
    h('div', { class: 'yk-talk-row' }, mic, box, send),
    h('div', { class: 'yk-talk-foot' }, h('p', { class: 'yk-talk-note' }, ns('note', lang)), guideBtn)));

  const setState = (k, text) => { state.textContent = text ?? (k ? ns(k, lang, name) : ''); state.dataset.state = k || ''; if (mic) { mic.setAttribute('aria-pressed', live && k === 'listening' ? 'true' : 'false'); mic.classList.toggle('on', live && k === 'listening'); } };
  // data-speaker = the character id: watchDialogue() in game.js plays 'talk' on that character while the line is live
  const bubble = (who, text) => {
    const el = h('div', { class: `yk-talk-msg ${who}`, 'data-speaker': who === 'npc' ? person.id : 'adam' },
      h('span', { class: 'yk-talk-who' }, who === 'npc' ? name : ns('you', lang)), h('p', { dir: 'auto' }, text));
    log.append(el);
    try { el.scrollIntoView({ block: 'nearest' }); } catch { /* */ }
    return el;
  };
  function liveListen() {
    if (!live || closed || busy) return;
    const mine = ++seq;
    setState('listening');
    const session = listen({
      lang,
      onInterim: (t) => { if (mine === seq) box.value = t.slice(0, TALK_TEXT_MAX); },
      onFinal: (t) => { if (mine === seq) { misses = 0; say(t); } },
      onError: (msg, code) => { if (mine === seq && ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'network', 'start'].includes(code)) { live = false; setState(null, msg || ''); } },
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
    stopListening(); stopSpeaking();
    box.value = '';
    bubble('player', text);
    busy = true; send.disabled = true;
    setState('thinking');
    let out = null;
    try {
      const res = await fetch(NPC_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(freePayload(person, lang, history, text, place)) });
      out = await res.json().catch(() => null);
    } catch { out = null; }
    busy = false; send.disabled = false;
    if (closed || mine !== seq) return;
    if (out?.unavailable) { unavailable = true; after = null; m.close(); onUnavailable?.(); return; }
    history.push({ who: 'player', text });
    const reply = typeof out?.reply === 'string' ? out.reply.trim() : '';
    if (!reply) { setState(null, ns('failed', lang)); if (live) liveListen(); return; }
    const el = bubble('npc', reply);
    history.push({ who: 'npc', text: reply });
    if (out.done) { ended = true; live = false; }
    const finish = () => { el.classList.remove('typing'); if (mine !== seq || closed) return; setState(null, ended ? ns('ended', lang) : ''); if (live) liveListen(); };
    setState('speaking');
    el.classList.add('typing');
    if (!(voiceOutputSupported() && speak(reply, lang, { onEnd: finish, onStop: finish }))) setTimeout(finish, Math.min(4000, 900 + reply.length * 40));
  }
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); say(box.value); } });
  box.addEventListener('keyup', (e) => e.stopPropagation());
  send.addEventListener('click', () => say(box.value));
  for (const b of [send, endBtn, guideBtn, mic]) b?.addEventListener('keydown', (e) => { if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation(); });

  // start: a line of welcome, then hands-free listening when the browser can (the first click/keypress unlocked audio)
  unlockAudio();
  setState(null, ns('hello', lang, name));
  live = voice; misses = 0;
  if (live) liveListen();
  return { el: m.el, close: () => m.close(), say };
}
