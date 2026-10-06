// «Talk to anyone nearby»: the pure part (no DOM, no three.js) so node:test can cover it.
//   - talkables(): who can be talked to in the current scene (scene NPCs with a `talk` entry + the location's
//     script NPCs that have a figure in the scene); background extras (ids starting with bg_) never.
//   - pickTalkable(): the nearest talkable within TALK_RADIUS metres of Adam (x/z plane).
//   - freePayload(): the request body of the npc function's free-chat mode (caps mirror netlify/functions/npc.mjs).
// The DOM/voice side lives in nearbyTalk.js.

export const TALK_RADIUS = 2.6;
export const TALK_TEXT_MAX = 300;
const CAPS = { name: 60, role: 120, persona: 400, place: 80, turn: 300, history: 6 };

const cut = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
/** {ar,en,…} or string -> the text for `lang`, falling back to en, then ar. */
export const pickLang = (v, lang) => (typeof v === 'string' ? v : v && typeof v === 'object' ? (v[lang] ?? v.en ?? v.ar ?? '') : '');
export const isBackground = (id) => String(id || '').startsWith('bg_');

/**
 * Build the list of talkable people for a scene.
 *   sceneNpcs: the scene's build-result `npcs` entries ({ id, talk?: { name, role, persona } }, …)
 *   figures:   id -> { position: { x, z } } (the built 3D figures; a person without a figure has no position)
 *   situations: the location's script situations ({ npc: { id, name, role }, setup }, …)
 * -> [{ id, name:{…}, role:{…}, persona:{…}|'', contexts: [setup…], x, z, source: 'scene'|'script' }]
 * A scene `talk` entry wins over the script data for the same id; the script setups become the background context.
 */
export function talkables(sceneNpcs = [], figures = {}, situations = []) {
  const out = new Map();
  for (const n of Array.isArray(sceneNpcs) ? sceneNpcs : []) {
    if (!n || !n.id || isBackground(n.id) || !n.talk || typeof n.talk !== 'object') continue;
    const fig = figures[n.id];
    if (!fig?.position) continue;
    out.set(n.id, { id: n.id, name: n.talk.name || n.id, role: n.talk.role || '', persona: n.talk.persona || '', contexts: [], x: fig.position.x, z: fig.position.z, source: 'scene' });
  }
  for (const s of Array.isArray(situations) ? situations : []) {
    const id = s?.npc?.id;
    if (!id || isBackground(id)) continue;
    const fig = figures[id];
    if (!fig?.position) continue;
    const prev = out.get(id);
    if (prev) { prev.contexts = [...(prev.contexts || []), s.setup].filter(Boolean); continue; }
    out.set(id, { id, name: s.npc.name || id, role: s.npc.role || '', persona: '', contexts: s.setup ? [s.setup] : [], x: fig.position.x, z: fig.position.z, source: 'script' });
  }
  return [...out.values()];
}

/** The nearest talkable within `radius` of `pos` ({x,z}); null when none. Ignores bg_ ids. */
export function pickTalkable(pos, list, radius = TALK_RADIUS) {
  let best = null, bestD = Infinity;
  for (const p of Array.isArray(list) ? list : []) {
    if (!p || isBackground(p.id)) continue;
    const d = Math.hypot((pos?.x ?? 0) - p.x, (pos?.z ?? 0) - p.z);
    if (d <= radius && d < bestD) { best = p; bestD = d; }
  }
  return best;
}

/** Request body for POST /.netlify/functions/npc in free-chat mode. */
export function freePayload(person, lang, history, text, place = '') {
  const persona = [pickLang(person.persona, lang), ...(person.contexts || []).map((c) => pickLang(c, lang))].filter(Boolean).join(' ');
  return {
    mode: 'free',
    lang,
    npc: { id: cut(person.id, 80), name: cut(pickLang(person.name, lang), CAPS.name), role: cut(pickLang(person.role, lang), CAPS.role) },
    persona: cut(persona, CAPS.persona),
    place: cut(pickLang(place, lang), CAPS.place),
    history: (history || []).slice(-CAPS.history).map((x) => ({ who: x.who === 'npc' ? 'npc' : 'player', text: cut(x.text, CAPS.turn) })),
    text: cut(text, TALK_TEXT_MAX)
  };
}

// UI strings (the UI language is ar/en; the other codes are for the spoken conversation language).
export const NEARBY_STR = {
  prompt: { ar: (n) => `تحدّث مع ${n}`, en: (n) => `Talk to ${n}`, es: (n) => `Habla con ${n}`, zh: (n) => `和${n}交谈`, hi: (n) => `${n} से बात करें` },
  promptGuide: { ar: 'اسأل المرشد', en: 'Ask the guide', es: 'Pregunta al guía', zh: '问向导', hi: 'मार्गदर्शक से पूछें' },
  end: { ar: 'إنهاء المحادثة', en: 'End conversation', es: 'Terminar la conversación', zh: '结束对话', hi: 'बातचीत समाप्त करें' },
  listening: { ar: 'أستمع… تكلّم', en: 'Listening… speak', es: 'Escuchando… habla', zh: '正在聆听…请说话', hi: 'सुन रहे हैं… बोलिए' },
  thinking: { ar: (n) => `${n} يفكّر…`, en: (n) => `${n} is thinking…`, es: (n) => `${n} está pensando…`, zh: (n) => `${n}正在思考…`, hi: (n) => `${n} सोच रहे हैं…` },
  speaking: { ar: (n) => `${n} يتحدّث…`, en: (n) => `${n} is speaking…`, es: (n) => `${n} está hablando…`, zh: (n) => `${n}正在说话…`, hi: (n) => `${n} बोल रहे हैं…` },
  placeholder: { ar: 'اكتب ما تقوله…', en: 'Type what you say…', es: 'Escribe lo que dices…', zh: '输入你想说的话…', hi: 'जो कहना है लिखें…' },
  send: { ar: 'إرسال', en: 'Send', es: 'Enviar', zh: '发送', hi: 'भेजें' },
  mic: { ar: 'تحدّث بصوتك', en: 'Speak', es: 'Hablar', zh: '说话', hi: 'बोलें' },
  you: { ar: 'آدم', en: 'Adam', es: 'Adam', zh: '亚当', hi: 'आदम' },
  failed: { ar: 'تعذّر الرد الآن. جرّب مرة أخرى أو اكتب رسالتك.', en: "Couldn't reply right now. Try again or type your message.", es: 'No se pudo responder ahora. Inténtalo de nuevo o escribe tu mensaje.', zh: '暂时无法回复。请重试或输入文字。', hi: 'अभी जवाब नहीं मिल सका। फिर कोशिश करें या लिखकर भेजें।' },
  ended: { ar: 'انتهت المحادثة. يمكنك المتابعة بالكتابة.', en: 'The conversation ended. You can keep typing.', es: 'La conversación terminó. Puedes seguir escribiendo.', zh: '对话结束了。你可以继续输入。', hi: 'बातचीत समाप्त हुई। आप लिखकर जारी रख सकते हैं।' },
  hello: { ar: (n) => `أنت تتحدّث مع ${n}. قل شيئاً أو اكتبه.`, en: (n) => `You're talking to ${n}. Say something or type it.`, es: (n) => `Estás hablando con ${n}. Di algo o escríbelo.`, zh: (n) => `你正在和${n}交谈。请说话或输入。`, hi: (n) => `आप ${n} से बात कर रहे हैं। कुछ कहें या लिखें।` },
  guideBtn: { ar: 'اسأل المرشد', en: 'Ask the guide', es: 'Pregunta al guía', zh: '问向导', hi: 'मार्गदर्शक से पूछें' },
  note: { ar: 'محادثة بالذكاء الاصطناعي؛ للأحكام اسأل المرشد أو إمام المسجد.', en: 'An AI conversation; for rulings ask the guide or the imam at the mosque.', es: 'Conversación con IA; para dictámenes pregunta al guía o al imán de la mezquita.', zh: 'AI对话；教法问题请问向导或清真寺的伊玛目。', hi: 'AI बातचीत; हुक्म के लिए मार्गदर्शक या मस्जिद के इमाम से पूछें।' }
};
export const ns = (k, lang, ...a) => { const v = NEARBY_STR[k]?.[lang] ?? NEARBY_STR[k]?.en; return typeof v === 'function' ? v(...a) : v ?? k; };
