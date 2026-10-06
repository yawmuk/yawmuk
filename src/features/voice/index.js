// Voice in / voice out for Yawmuk.
//   - Input: the browser's SpeechRecognition in any language of src/engine/speechLangs.js (ar-SA, en-US, es-US,
//     zh-CN, hi-IN …), push-to-talk (press to start, press again or pause to stop), interim transcript, clear
//     fallbacks. Hidden entirely when unsupported (e.g. Firefox): the text box stays.
//   - Output: the tts.js engine (server voice, then speechSynthesis), so only one thing speaks at a time.
//   - Privacy: the game never records, uploads or stores audio. The transcript is plain text that goes through
//     exactly the same path as typed text (same filters, same validators). Where the browser offers on-device
//     recognition (SpeechRecognition.available + processLocally) we ask for it; otherwise the browser's own
//     speech service is used, and the UI says so.
import './voice.css';
import { h } from '../../engine/dom.js';
import { stopSpeaking, ttsSupported, speakText } from '../../engine/tts.js';
import { normalizeLang, bcp47Of, detectSpeechLang } from '../../engine/speechLangs.js';
import { matchChoice } from '../guide/guideCore.js';

// UI strings; a language missing here falls back to English (the speech itself works for every speechLangs entry).
const STR = {
  speak: { ar: 'تحدّث', en: 'Speak', es: 'Hablar', zh: '说话', hi: 'बोलें' },
  stop: { ar: 'إيقاف الاستماع', en: 'Stop listening', es: 'Dejar de escuchar', zh: '停止聆听', hi: 'सुनना बंद करें' },
  listening: { ar: 'أستمع… تكلّم الآن', en: 'Listening… speak now', es: 'Escuchando… habla ahora', zh: '正在聆听…请说话', hi: 'सुन रहा हूँ… अब बोलिए' },
  denied: { ar: 'لم يُسمح باستخدام الميكروفون. يمكنك الكتابة بدلاً من ذلك.', en: 'Microphone access was not allowed. You can type instead.', es: 'No se permitió el acceso al micrófono. Puedes escribir en su lugar.', zh: '未允许使用麦克风。你可以改为输入文字。', hi: 'माइक्रोफ़ोन की अनुमति नहीं मिली। आप टाइप कर सकते हैं।' },
  nomic: { ar: 'لم نجد ميكروفوناً. يمكنك الكتابة بدلاً من ذلك.', en: 'No microphone was found. You can type instead.', es: 'No se encontró ningún micrófono. Puedes escribir en su lugar.', zh: '未找到麦克风。你可以改为输入文字。', hi: 'कोई माइक्रोफ़ोन नहीं मिला। आप टाइप कर सकते हैं।' },
  nospeech: { ar: 'لم نسمع شيئاً. اضغط الميكروفون وحاول مرة أخرى.', en: "We didn't hear anything. Press the mic and try again.", es: 'No escuchamos nada. Pulsa el micrófono e inténtalo de nuevo.', zh: '没有听到声音。请按麦克风再试一次。', hi: 'हमें कुछ सुनाई नहीं दिया। माइक दबाकर फिर कोशिश करें।' },
  network: { ar: 'خدمة التعرّف الصوتي غير متاحة الآن. يمكنك الكتابة.', en: 'Speech recognition is unavailable right now. You can type.', es: 'El reconocimiento de voz no está disponible ahora. Puedes escribir.', zh: '语音识别暂时不可用。你可以输入文字。', hi: 'वाणी पहचान अभी उपलब्ध नहीं है। आप टाइप कर सकते हैं।' },
  failed: { ar: 'تعذّر التعرّف على الكلام. يمكنك الكتابة.', en: "Couldn't recognise the speech. You can type.", es: 'No se pudo reconocer lo que dijiste. Puedes escribir.', zh: '无法识别语音。你可以输入文字。', hi: 'बोली पहचानी नहीं जा सकी। आप टाइप कर सकते हैं।' },
  privacy: {
    ar: 'يحوّل متصفحك الكلام إلى نص بخدمة التعرّف الصوتي المدمجة فيه؛ اللعبة لا تسجّل صوتك ولا ترفعه ولا تحفظه.',
    en: "Your browser's built-in speech recognition turns speech into text; the game never records, uploads or stores your voice.",
    es: 'El reconocimiento de voz integrado en tu navegador convierte tu voz en texto; el juego nunca graba, sube ni guarda tu voz.',
    zh: '你的浏览器内置的语音识别会把语音转成文字；游戏从不录制、上传或保存你的声音。',
    hi: 'आपके ब्राउज़र की अंतर्निहित वाणी पहचान बोली को पाठ में बदलती है; खेल आपकी आवाज़ कभी रिकॉर्ड, अपलोड या संग्रहीत नहीं करता।'
  },
  speakPrivacy: {
    ar: 'لقراءة الردود بصوت طبيعي يُرسَل النص الظاهر على الشاشة فقط إلى خادم اللعبة، ولا يُحفظ.',
    en: 'To read replies in a natural voice, only the text shown on screen is sent to the game server; it is not stored.',
    es: 'Para leer las respuestas con una voz natural, solo se envía al servidor del juego el texto que aparece en pantalla; no se guarda.',
    zh: '为了用自然的声音朗读回答，只会把屏幕上显示的文字发送到游戏服务器，且不会保存。',
    hi: 'जवाबों को स्वाभाविक आवाज़ में पढ़ने के लिए केवल स्क्रीन पर दिखा पाठ खेल के सर्वर पर भेजा जाता है; उसे संग्रहीत नहीं किया जाता।'
  },
  choiceMic: { ar: 'قل اختيارك', en: 'Say your choice', es: 'Di tu elección', zh: '说出你的选择', hi: 'अपना विकल्प बोलें' },
  choiceHint: { ar: 'قل رقم الخيار أو جزءاً من نصه', en: 'Say the option number or part of its text', es: 'Di el número de la opción o parte de su texto', zh: '说出选项编号或部分内容', hi: 'विकल्प की संख्या या उसके पाठ का कुछ हिस्सा बोलें' },
  choiceMiss: { ar: 'لم أتأكد أي خيار تقصد — قل رقمه أو اضغط عليه.', en: "I wasn't sure which option you meant — say its number or tap it.", es: 'No estoy seguro de qué opción quieres; di su número o tócala.', zh: '我不确定你指的是哪个选项——请说出编号或点击它。', hi: 'मुझे पक्का नहीं पता कि आपका मतलब कौन-सा विकल्प है — उसकी संख्या बोलें या उस पर टैप करें।' }
};
export const vt = (key, lang) => STR[key]?.[normalizeLang(lang, 'en')] ?? STR[key]?.en ?? key;

// ------------------------------------------------------------------ support
export function recognitionCtor(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win) return null;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}
export const voiceInputSupported = () => !!recognitionCtor();
export const voiceOutputSupported = () => ttsSupported();
/** Recognition language tag for a speechLangs code ('es' -> 'es-US'); unknown -> en-US. */
export const recLang = (lang) => bcp47Of(lang);

/** Map a SpeechRecognition error code to a message key (null = silent, e.g. the user stopped it). */
export function errorKey(code) {
  switch (code) {
    case 'not-allowed': case 'service-not-allowed': return 'denied';
    case 'audio-capture': return 'nomic';
    case 'no-speech': return 'nospeech';
    case 'network': case 'language-not-supported': return 'network';
    case 'aborted': return null;
    default: return 'failed';
  }
}

// On-device recognition (Chrome's SpeechRecognition.available/processLocally) — checked ahead of the click,
// so the user gesture that starts listening is not spent waiting on a promise.
const localOk = new Map();
function checkLocal(lang) {
  const C = recognitionCtor();
  const l = recLang(lang);
  if (!C || typeof C.available !== 'function' || localOk.has(l)) return;
  localOk.set(l, false);
  try {
    Promise.resolve(C.available({ langs: [l], processLocally: true }))
      .then((s) => localOk.set(l, s === 'available'))
      .catch(() => {});
  } catch { /* older API shape */ }
}

let active = null; // the single live recognition session
const MIC_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" focusable="false"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z"/></svg>';

/**
 * Start one recognition session. Resolves nothing; reports through callbacks.
 * -> { stop() } or null when unsupported.
 */
export function listen({ lang = 'en', onInterim, onFinal, onError, onEnd } = {}) {
  const C = recognitionCtor();
  if (!C) return null;
  stopListening();
  stopVoice();
  const rec = new C();
  const l = recLang(lang);
  rec.lang = l;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  if (localOk.get(l) && 'processLocally' in rec) { try { rec.processLocally = true; } catch { /* */ } }
  let final = '';
  let ended = false;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
    }
    if (interim) onInterim?.(`${final}${interim}`.trim());
  };
  rec.onerror = (e) => { const k = errorKey(e?.error); if (k) onError?.(vt(k, lang), e?.error); };
  rec.onend = () => {
    if (ended) return; ended = true;
    if (active?.rec === rec) active = null;
    const text = final.trim();
    if (text) onFinal?.(text);
    onEnd?.(text);
  };
  try { rec.start(); } catch { onError?.(vt('failed', lang), 'start'); onEnd?.(''); return null; }
  active = { rec, stop: () => { try { rec.stop(); } catch { /* */ } } };
  return active;
}

export function stopListening() {
  if (!active) return;
  const a = active; active = null;
  try { a.rec.abort ? a.rec.abort() : a.rec.stop(); } catch { /* */ }
}

// ------------------------------------------------------------------ output
/**
 * Speak `text` through the tts.js engine (server voice, then the browser's). The voice follows the script of the
 * text; Latin text follows `lang` (so a Spanish answer is read in Spanish). Returns false when unsupported.
 * opts: { onEnd(how), onStop() } — onEnd when it finishes by itself, onStop when it is cut off.
 */
export function speak(text, lang, { onEnd, onStop } = {}) {
  const s = String(text ?? '').trim();
  if (!s || !voiceOutputSupported()) return false;
  return speakText(s, { lang: detectSpeechLang(s, lang), onEnd, onStop });
}

export function stopVoice() {
  try { stopSpeaking(); } catch { /* */ }
}

// ------------------------------------------------------------------ UI: mic button
/**
 * Push-to-talk mic button. Press to start; press again (or simply pause) to stop.
 * opts: { lang (code, or a function returning the current one), uiLang (labels; default lang), onInterim(text),
 *         onFinal(text), onStatus(text|null), className, label }
 * Returns null when the browser has no speech recognition (caller keeps the text box only).
 */
export function micButton({ lang: langOpt = 'en', uiLang, onInterim, onFinal, onStatus, className = '', label } = {}) {
  if (!voiceInputSupported()) return null;
  const L = () => (typeof langOpt === 'function' ? langOpt() : langOpt);
  const lang = uiLang || L();
  checkLocal(L());
  const text = label || vt('speak', lang);
  const b = h('button', { type: 'button', class: `yk-voice-mic${className ? ` ${className}` : ''}`, 'aria-pressed': 'false', 'aria-label': text, title: `${text} — ${vt('privacy', lang)}` },
    h('span', { class: 'yk-voice-mic-icon', 'aria-hidden': 'true' }),
    h('span', { class: 'yk-voice-mic-text' }, text));
  // icon (static markup; no content strings)
  b.querySelector('.yk-voice-mic-icon').innerHTML = MIC_SVG;
  let session = null;
  const setOn = (on) => {
    b.classList.toggle('yk-voice-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? vt('stop', lang) : text);
  };
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (session) { session.stop(); return; }
    setOn(true);
    checkLocal(L());
    onStatus?.(vt('listening', L()));
    session = listen({
      lang: L(),
      onInterim: (t) => onInterim?.(t),
      onFinal: (t) => onFinal?.(t),
      onError: (msg) => onStatus?.(msg),
      onEnd: (t) => { session = null; setOn(false); if (t) onStatus?.(null); }
    });
    if (!session) setOn(false);
  });
  b.addEventListener('keydown', (e) => e.stopPropagation()); // keep game key bindings (E, digits) away
  return b;
}

// ------------------------------------------------------------------ dialogue choices by voice
/**
 * Add a "say your choice" mic to a choices group: the transcript is matched to the closest option and that
 * option's button is clicked (same as tapping it). Idempotent per group.
 */
export function attachChoiceVoice(group, lang = document.documentElement.lang) {
  if (!group || group.dataset.ykVoice || !voiceInputSupported()) return null;
  group.dataset.ykVoice = '1';
  const buttons = () => [...group.querySelectorAll('button.choice')];
  const labelOf = (b) => [...b.querySelectorAll('span')].filter((s) => !s.classList.contains('num')).map((s) => s.textContent).join(' ') || b.textContent;
  const status = h('span', { class: 'yk-voice-choice-status', role: 'status', 'aria-live': 'polite' });
  const mic = micButton({
    lang,
    label: vt('choiceMic', lang),
    className: 'yk-voice-choice-mic',
    onInterim: (t) => { status.textContent = t; },
    onStatus: (m) => { status.textContent = m || ''; },
    onFinal: (t) => {
      const bs = buttons();
      const i = matchChoice(t, bs.map(labelOf));
      if (i >= 0 && bs[i] && document.contains(bs[i])) { status.textContent = ''; bs[i].focus(); bs[i].click(); } else status.textContent = vt('choiceMiss', lang);
    }
  });
  if (!mic) return null;
  const bar = h('div', { class: 'yk-voice-choice', dir: lang === 'ar' ? 'rtl' : 'ltr' }, mic, h('span', { class: 'yk-voice-choice-hint' }, vt('choiceHint', lang)), status);
  group.parentElement?.insertBefore(bar, group);
  return bar;
}

let observer = null;
/**
 * Watch the UI for dialogue choice groups (.dialogue .choices[role=group]) and give each a voice mic.
 * Call once at startup; no-op when speech recognition is unsupported.
 */
export function installChoiceVoice(root = typeof document !== 'undefined' ? document.body : null) {
  if (observer || !root || !voiceInputSupported() || typeof MutationObserver !== 'function') return;
  const scan = () => root.querySelectorAll('.dialogue .choices[role="group"]').forEach((g) => attachChoiceVoice(g));
  observer = new MutationObserver(() => scan());
  observer.observe(root, { childList: true, subtree: true });
  scan();
}

// ------------------------------------------------------------------ feature contract
/** Feature contract: open({lang,onClose}) -> close(). Voice has no panel of its own: it opens the guide. */
export function open({ lang = 'en', onClose } = {}) {
  let closer = null, closed = false;
  import('../guide/index.js').then((m) => { if (!closed) closer = m.open({ lang, onClose }); }).catch(() => onClose?.());
  return () => { closed = true; closer?.(); };
}
