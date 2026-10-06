// «اسأل عمر» / «Ask Omar, your guide» — a game-wide, text + voice chat that answers ONLY from the reviewed
// library (every ruling's plain words / summary / guidance / alternatives / when-to-ask, plus the reviewed Q&A bank).
// Feature contract: open({ lang, onClose }) -> close().
//
// Flow per question (see guideCore.js): personal -> referral (no model) · injection -> scope reply (no model) ·
// nothing retrieved -> scope reply · else POST /.netlify/functions/guide with the retrieved passages only ->
// validated again here. If the model is unavailable, the closest reviewed passages are shown verbatim with their
// sources (labelled "no AI"). Abstain / refer offers "Send to scholars" (feature 'experts', question prefilled).
// Questions are kept only in this open panel; nothing is stored.
//
// Conversation language (selector, default = UI language): any speechLangs.js language. The reviewed library is
// Arabic/English, so for es/zh/hi … the question is first rendered in English by the server ("pivot"), English
// passages are retrieved with it, the filters run on both, and the model answers in the conversation language.
// Live conversation (toggle, needs SpeechRecognition): listen -> ask like typed text -> show + speak the answer ->
// listen again; stops on toggle off, panel close, an interruption, or two silent/failed turns in a row.
import './guide.css';
import { h, link } from '../../engine/dom.js';
import { openModal } from '../../engine/ui/overlay.js';
import { renderRulingCard } from '../../engine/ui/rulingCard.js';
import { rulingsById, getQuestions, getSources, getRuling } from '../../engine/content.js';
import { allPassages, routeQuestion, wireBody, validateGuide, sourcesFor, fallbackPassages, isPersonalFatwa, looksLikeInjection, ASK_MAX, WIRE_MAX_BYTES } from './guideCore.js';
import { micButton, listen, speak, stopVoice, stopListening, voiceOutputSupported, voiceInputSupported, vt } from '../voice/index.js';
import { unlockAudio } from '../../engine/tts.js';
import { SPEECH_LANGS, normalizeLang } from '../../engine/speechLangs.js';

export const GUIDE_ENDPOINT = '/.netlify/functions/guide';
const TIMEOUT_MS = 15000;
const LIB_LANGS = new Set(['ar', 'en']); // languages of the reviewed library; others go through the English pivot
// The experts feature is optional at build time: glob returns {} when the file does not exist.
const expertsModule = import.meta.glob('../experts/index.js');

const S = {
  title: { ar: 'اسأل عمر، دليلك', en: 'Ask Omar, your guide' },
  sub: { ar: 'اسأل عن أي موقف في يوم آدم — بالكتابة أو بالصوت.', en: "Ask about any situation in Adam's day — by typing or by voice." },
  disclosure: { ar: 'مساعد آلي مقيّد بمصادر مراجَعة — ليس مفتياً', en: 'AI assistant limited to reviewed sources — not a mufti' },
  hello: {
    ar: 'السلام عليكم، أنا عمر. أجيبك من مكتبة اللعبة المراجَعة فقط، وإن لم أجد الجواب فيها قلت لك ذلك. لحالتك الخاصة أدلّك على أهل العلم.',
    en: "Assalamu alaikum, I'm Omar. I answer only from the game's reviewed library, and if the answer isn't there I'll tell you so. For your own case I'll point you to scholars."
  },
  try: { ar: 'جرّب أن تسأل:', en: 'Try asking:' },
  placeholder: { ar: 'اكتب سؤالك هنا…', en: 'Type your question…' },
  input: { ar: 'سؤالك لعمر', en: 'Your question for Omar' },
  send: { ar: 'أرسل', en: 'Send' },
  close: { ar: 'إغلاق', en: 'Close' },
  you: { ar: 'أنت', en: 'You' },
  omar: { ar: 'عمر', en: 'Omar' },
  thinking: { ar: 'يبحث عمر في المكتبة المراجَعة…', en: 'Omar is searching the reviewed library…', es: 'Omar está buscando en la biblioteca revisada…', zh: '奥马尔正在查阅经过审核的资料库…', hi: 'उमर समीक्षित लाइब्रेरी में खोज रहे हैं…' },
  aiLabel: { ar: 'إجابة بالذكاء الاصطناعي من مادة مراجَعة', en: 'AI answer from reviewed material', es: 'Respuesta de IA a partir de material revisado', zh: '基于审核资料的AI回答', hi: 'समीक्षित सामग्री से AI का उत्तर' },
  libLabel: { ar: 'عُرض كما كُتب — لا توليد آلي في هذا الرد', en: 'Shown as written — no AI generation in this reply', es: 'Mostrado tal como está escrito: sin generación de IA en esta respuesta', zh: '按原文显示——此回复未经AI生成', hi: 'जैसा लिखा है वैसा दिखाया गया — इस उत्तर में AI ने कुछ नहीं लिखा' },
  libIntro: { ar: 'المساعد الآلي غير متاح الآن، فهذه أقرب المقاطع المراجَعة لسؤالك كما هي:', en: "The AI assistant isn't available right now, so here are the closest reviewed passages, word for word:",
    es: 'El asistente de IA no está disponible ahora, así que estos son los pasajes revisados más cercanos a tu pregunta, palabra por palabra (en inglés):',
    zh: 'AI助手暂时不可用，以下是与你的问题最接近的审核原文（英文）：',
    hi: 'AI सहायक अभी उपलब्ध नहीं है, इसलिए आपके प्रश्न से सबसे मिलते-जुलते समीक्षित अंश यहाँ हूबहू (अंग्रेज़ी में) दिए गए हैं:' },
  unavailable: {
    ar: 'المساعد غير متاح الآن بهذه اللغة. جرّب السؤال بالعربية أو الإنجليزية، أو أرسل سؤالك إلى أهل العلم.',
    en: "The assistant isn't available in this language right now. Try asking in English or Arabic, or send your question to scholars.",
    es: 'El asistente no está disponible en este idioma ahora mismo. Prueba a preguntar en inglés o en árabe, o envía tu pregunta a los eruditos.',
    zh: '助手暂时无法使用这种语言。请尝试用英语或阿拉伯语提问，或把问题发送给学者。',
    hi: 'सहायक अभी इस भाषा में उपलब्ध नहीं है। अंग्रेज़ी या अरबी में पूछकर देखें, या अपना प्रश्न विद्वानों को भेजें।'
  },
  basedOn: { ar: 'استند إلى', en: 'Based on' },
  related: { ar: 'للاطلاع العام', en: 'General reading' },
  sources: { ar: 'المصادر الموثّقة', en: 'Verified sources' },
  source: { ar: 'المصدر', en: 'Source' },
  personal: {
    ar: 'يبدو أن سؤالك عن حالتك الخاصة. الحكم في الحالات الخاصة يحتاج عالماً يسمع التفاصيل — أنا لا أُفتي. يمكنك إرسال سؤالك إلى أهل العلم.',
    en: "This sounds like your own situation. Personal cases need a scholar who can hear the details — I don't give fatwas. You can send your question to scholars.",
    es: 'Parece que tu pregunta trata de tu situación personal. Los casos personales necesitan un erudito que escuche los detalles; yo no doy fetuas. Puedes enviar tu pregunta a los eruditos.',
    zh: '你的问题似乎关于你个人的情况。个人情况需要一位能了解细节的学者来解答——我不发布教法意见（法特瓦）。你可以把问题发送给学者。',
    hi: 'लगता है आपका प्रश्न आपकी अपनी स्थिति के बारे में है। निजी मामलों के लिए ऐसे विद्वान की ज़रूरत होती है जो पूरी बात सुने — मैं फ़तवा नहीं देता। आप अपना प्रश्न विद्वानों को भेज सकते हैं।'
  },
  abstain: {
    ar: 'لا أجد في المادة المراجَعة ما يكفي للإجابة عن هذا، ولن أخمّن. يمكنك إرسال سؤالك إلى أهل العلم.',
    en: "I don't have enough reviewed material to answer this, and I won't guess. You can send your question to scholars.",
    es: 'No tengo suficiente material revisado para responder a esto, y no voy a adivinar. Puedes enviar tu pregunta a los eruditos.',
    zh: '经过审核的资料不足以回答这个问题，我不会猜测。你可以把问题发送给学者。',
    hi: 'इसका उत्तर देने के लिए मेरे पास पर्याप्त समीक्षित सामग्री नहीं है, और मैं अनुमान नहीं लगाऊँगा। आप अपना प्रश्न विद्वानों को भेज सकते हैं।'
  },
  offTopic: {
    ar: 'هذا خارج ما أستطيع الحديث عنه هنا. أنا أجيب عن مواقف المسلم اليومية في اللعبة: المال والفائدة، والطعام والشراب، والصلاة، والتحية، والأمانة، والمناسبات.',
    en: "That's outside what I can talk about here. I answer about everyday Muslim life in the game: money and interest, food and drink, prayer, greetings, honesty and events.",
    es: 'Eso está fuera de lo que puedo tratar aquí. Respondo sobre la vida cotidiana de los musulmanes en el juego: el dinero y los intereses, la comida y la bebida, la oración, los saludos, la honestidad y los eventos.',
    zh: '这超出了我在这里能谈论的范围。我只回答游戏中穆斯林的日常生活问题：金钱与利息、饮食、礼拜、问候、诚实以及各种活动。',
    hi: 'यह उस दायरे से बाहर है जिस पर मैं यहाँ बात कर सकता हूँ। मैं खेल में मुसलमानों के रोज़मर्रा के जीवन के बारे में उत्तर देता हूँ: पैसा और ब्याज, खाना-पीना, नमाज़, अभिवादन, ईमानदारी और आयोजन।'
  },
  judge: {
    ar: 'الحكم على الأشخاص والجماعات بالكفر أو البدعة أو النفاق ليس مما أتحدث فيه؛ هذا شأن أهل العلم الراسخين وجهات الفتوى المعتمدة. يمكنك إرسال سؤالك إلى أهل العلم.',
    en: "Judging specific people or groups (as disbelievers, innovators or hypocrites) is not something I do; that belongs to qualified scholars and recognised fatwa bodies. You can send your question to scholars."
  },
  evidence: {
    ar: 'لا أنشئ آيات ولا أحاديث عند الطلب، ولم أجد دليلاً مطابقاً لطلبك في المصادر المراجَعة هنا. الأدلة الموثّقة تظهر فقط في بطاقات الأحكام مع مصادرها.',
    en: "I don't produce verses or hadith on request, and I found no matching evidence for this in the reviewed sources here. Verified evidence appears only on the ruling cards, with its sources."
  },
  generalInfo: { ar: 'هذه معلومات عامة وليست فتوى لحالة خاصة.', en: 'This is general information, not a fatwa for a personal case.',
    es: 'Esta es información general, no una fatua para un caso personal.', zh: '这是一般性信息，不是针对个人情况的教令（法特瓦）。', hi: 'यह सामान्य जानकारी है, किसी निजी मामले के लिए फ़तवा नहीं।' },
  referNote: { ar: 'للحالات الخاصة: اسأل إمام مسجد قريب أو عالماً موثوقاً.', en: 'For your own case: ask the imam of a nearby mosque or a trusted scholar.',
    es: 'Para tu caso personal: pregunta al imán de una mezquita cercana o a un erudito de confianza.', zh: '关于你个人的情况：请询问附近清真寺的伊玛目或可信赖的学者。', hi: 'अपने निजी मामले के लिए: पास की मस्जिद के इमाम या किसी भरोसेमंद विद्वान से पूछें।' },
  convLang: { ar: 'لغة المحادثة', en: 'Conversation language', es: 'Idioma de la conversación', zh: '对话语言', hi: 'बातचीत की भाषा' },
  live: { ar: 'محادثة مباشرة', en: 'Live conversation', es: 'Conversación en vivo', zh: '实时对话', hi: 'लाइव बातचीत' },
  liveHint: { ar: 'بلا أزرار: يستمع عمر، ويجيب بصوت، ثم يستمع من جديد.', en: 'Hands-free: Omar listens, answers aloud, then listens again.', es: 'Manos libres: Omar escucha, responde en voz alta y vuelve a escuchar.', zh: '免提：奥马尔聆听、语音回答，然后继续聆听。', hi: 'बिना हाथ लगाए: उमर सुनते हैं, बोलकर जवाब देते हैं, फिर से सुनते हैं।' },
  live_listening: { ar: 'يستمع عمر… تكلّم', en: 'Omar is listening… speak', es: 'Omar te escucha… habla', zh: '奥马尔正在聆听…请说话', hi: 'उमर सुन रहे हैं… बोलिए' },
  live_thinking: { ar: 'يفكّر عمر…', en: 'Omar is thinking…', es: 'Omar está pensando…', zh: '奥马尔正在思考…', hi: 'उमर सोच रहे हैं…' },
  live_speaking: { ar: 'يتحدّث عمر…', en: 'Omar is speaking…', es: 'Omar está hablando…', zh: '奥马尔正在说话…', hi: 'उमर बोल रहे हैं…' },
  liveEnded: { ar: 'توقفت المحادثة المباشرة.', en: 'Live conversation stopped.', es: 'La conversación en vivo se detuvo.', zh: '实时对话已停止。', hi: 'लाइव बातचीत रुक गई।' },
  toScholars: { ar: 'أرسل سؤالك إلى أهل العلم', en: 'Send to scholars' },
  noExperts: { ar: 'خدمة إرسال الأسئلة غير متاحة في هذه النسخة. اسأل إمام مسجد قريب.', en: 'Sending questions is not available in this build. Ask the imam of a nearby mosque.' },
  readAloud: { ar: 'استمع', en: 'Listen' },
  autoSpeak: { ar: 'اقرأ ردود عمر بصوت', en: "Read Omar's replies aloud" },
  back: { ar: 'العودة إلى المحادثة', en: 'Back to the chat' },
  open: { ar: 'افتح', en: 'Open' },
  privacy: { ar: 'لا نحفظ أسئلتك.', en: 'Your questions are not stored.' }
};
const st = (k, lang) => S[k]?.[normalizeLang(lang, 'en')] ?? S[k]?.en ?? k; // missing language -> English
const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : o[lang] || o[lang === 'ar' ? 'en' : 'ar'] || '');

// What to show for a passage: a Q&A item's answer, a scholar answer without its repeated question line, else the text.
const shownText = (p, lang) => (p.kind === 'qa' ? pick(p.item?.answer, lang) || p.text
  : p.kind === 'scholar' && p.title && p.text.startsWith(`${p.title}\n`) ? p.text.slice(p.title.length + 1) : p.text);
let passagesCache = { lang: null, list: [] };
// Answers written and marked publishable by the scholars in the experts dashboard (GET questions?public=1).
// Fetched once per page; on a static host / offline it stays empty and the guide uses the reviewed library only.
let scholarList = [];
let scholarFetch = null;
function loadScholarAnswers() {
  if (scholarFetch || typeof fetch !== 'function') return scholarFetch;
  scholarFetch = fetch('/.netlify/functions/questions?public=1', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const items = Array.isArray(j?.passages) ? j.passages : [];
      scholarList = items.filter((p) => p && typeof p.id === 'string' && /^x:[\w.:-]{1,80}$/i.test(p.id) && typeof p.text === 'string' && p.text.trim())
        .slice(0, 200)
        .map((p) => ({ id: p.id, kind: 'scholar', lang: p.lang || null, title: String(p.question || '').slice(0, 300) || p.id, part: 'scholar', text: String(p.text).slice(0, 1200),
          search: `${p.question || ''} ${p.question || ''} ${p.text}`, reviewer: String(p.reviewer || '').slice(0, 80), reviewerTitle: String(p.title || '').slice(0, 80),
          links: (Array.isArray(p.sources) ? p.sources : []).filter((u) => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, 10) }));
      passagesCache = { lang: null, list: [] }; // rebuild with the scholar answers included
    })
    .catch(() => {});
  return scholarFetch;
}
function passages(lang) {
  if (passagesCache.lang !== lang) {
    const mine = scholarList.filter((p) => !p.lang || p.lang === lang);
    passagesCache = { lang, list: [...allPassages(rulingsById(), getQuestions(), lang), ...mine] };
  }
  return passagesCache.list;
}

/** English rendering of a question in a language without a reviewed library ('' when unavailable). */
async function pivotQuestion(question) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(GUIDE_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'pivot', question }), signal: ctrl.signal });
    if (!res.ok) return '';
    const j = await res.json();
    return typeof j?.en === 'string' ? j.en.trim().slice(0, 600) : '';
  } catch { return ''; } finally { clearTimeout(timer); }
}

async function askGuide(body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GUIDE_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) return null; // 404 (not mounted) / 413 / 502 / 503 -> library fallback
    const j = await res.json();
    return j && j.unavailable ? null : j; // 200 { unavailable } = no AI key on the server -> library fallback
  } catch { return null; } finally { clearTimeout(timer); }
}

/** Starter questions: reviewed Q&A items that do not refer to a scholar. */
function starters(lang, n = 4) {
  const qs = getQuestions().filter((q) => !q.refer && pick(q.question, lang));
  const step = Math.max(1, Math.floor(qs.length / n));
  return qs.filter((_, i) => i % step === 0).slice(0, n).map((q) => pick(q.question, lang));
}

export function open({ lang = 'ar', onClose } = {}) {
  lang = lang === 'ar' ? 'ar' : 'en';
  loadScholarAnswers();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  let closed = false;
  let busy = false;
  let autoSpeak = false;
  let convLang = lang; // conversation language (questions, answers, voice); the panel chrome stays in the UI language
  let live = false, liveSeq = 0, misses = 0, liveHard = false;

  const m = openModal({ className: 'yk-guide-modal', label: st('title', lang), dismissible: true, onClose: () => { closed = true; live = false; liveSeq++; stopListening(); stopVoice(); onClose?.(); } });
  const close = () => m.close();

  const log = h('div', { class: 'yk-guide-log', role: 'log', 'aria-live': 'polite', 'aria-label': st('title', lang) });
  const status = h('p', { class: 'yk-guide-status', role: 'status', 'aria-live': 'polite' });
  const box = h('textarea', { class: 'yk-guide-input', rows: '2', maxlength: String(ASK_MAX), placeholder: st('placeholder', lang), 'aria-label': st('input', lang), dir: 'auto' });
  const send = h('button', { type: 'button', class: 'yk-guide-send' }, st('send', lang));
  const count = h('span', { class: 'yk-guide-count', 'aria-hidden': 'true' }, `0/${ASK_MAX}`);
  const scroll = () => { try { log.lastElementChild?.scrollIntoView({ block: 'nearest' }); } catch { /* */ } };

  const speakToggle = voiceOutputSupported()
    ? h('label', { class: 'yk-guide-toggle' }, h('input', { type: 'checkbox', onchange: (e) => { autoSpeak = e.target.checked; if (!autoSpeak) stopVoice(); } }), h('span', {}, st('autoSpeak', lang)))
    : null;
  const setAutoSpeak = (on) => { autoSpeak = on; const c = speakToggle?.querySelector('input'); if (c) c.checked = on; };

  const listenBtn = (text, sl = convLang) => (voiceOutputSupported()
    ? h('button', { type: 'button', class: 'yk-guide-listen', 'aria-label': st('readAloud', lang), title: st('readAloud', lang), onclick: () => { unlockAudio(); speak(text, sl); } }, h('span', { 'aria-hidden': 'true' }, '🔊'))
    : null);

  function bubble(who, ...children) {
    const el = h('div', { class: `yk-guide-msg yk-guide-${who}` },
      h('div', { class: 'yk-guide-who' }, who === 'user' ? st('you', lang) : st('omar', lang)),
      h('div', { class: 'yk-guide-body' }, children));
    log.append(el);
    scroll();
    return el;
  }

  // ---------- citation chip -> in-panel ruling card / Q&A view (no stacked modals)
  const chat = h('div', { class: 'yk-guide-chat' });
  const detail = h('div', { class: 'yk-guide-detail', hidden: true });
  function showDetail(p) {
    const back = h('button', { type: 'button', class: 'yk-guide-back', 'data-autofocus': true, onclick: () => { detail.hidden = true; chat.hidden = false; detail.replaceChildren(); send.focus(); } }, `${lang === 'ar' ? '→' : '←'} ${st('back', lang)}`);
    let view;
    if (p.kind === 'ruling' && getRuling(p.rulingId)) {
      try { view = renderRulingCard(getRuling(p.rulingId), p.rulingId); } catch { view = null; }
    }
    if (!view && p.kind === 'scholar') {
      view = h('div', { class: 'yk-guide-qa yk-guide-scholar' },
        h('h3', {}, p.title),
        h('p', {}, shownText(p, lang)),
        p.reviewer ? h('p', { class: 'yk-guide-reviewer' }, h('strong', {}, lang === 'ar' ? 'أجاب عنه: ' : 'Answered by: '), `${p.reviewer}${p.reviewerTitle ? ` — ${p.reviewerTitle}` : ''}`) : null,
        p.links.length ? h('ul', {}, p.links.map((u) => h('li', {}, link(u, st('source', lang))))) : null);
    }
    if (!view) {
      const recs = sourcesFor(p, getSources());
      view = h('div', { class: 'yk-guide-qa' },
        h('h3', {}, p.title),
        h('p', {}, p.kind === 'qa' ? pick(p.item?.answer, lang) : p.text),
        recs.length ? sourceList(recs) : null);
    }
    detail.replaceChildren(back, view);
    chat.hidden = true; detail.hidden = false;
    requestAnimationFrame(() => back.focus());
  }
  const chips = (used, lbl = 'basedOn') => h('div', { class: 'yk-guide-chips', role: 'list', 'aria-label': st(lbl, lang) },
    h('span', { class: 'yk-guide-chips-lbl' }, `${st(lbl, lang)}:`),
    used.map((p) => h('button', { type: 'button', role: 'listitem', class: 'yk-guide-chip', title: st('open', lang), onclick: () => showDetail(p) }, p.title.length > 60 ? `${p.title.slice(0, 58)}…` : p.title)));

  function sourceList(recs) {
    const uniq = [...new Map(recs.map((r) => [r.id, r])).values()].slice(0, 6);
    if (!uniq.length) return null;
    return h('details', { class: 'yk-guide-sources' }, h('summary', {}, `${st('sources', lang)} (${uniq.length})`),
      h('ul', {}, uniq.map((s) => h('li', {}, h('bdi', { dir: 'auto' }, String(s.citation || s.id)), ' ', link(s.url, st('source', lang))))));
  }

  function scholarsBtn(question) {
    return h('button', { type: 'button', class: 'yk-guide-scholars', onclick: async (e) => {
      const loader = expertsModule['../experts/index.js'];
      if (!loader) { e.currentTarget.replaceWith(h('p', { class: 'yk-guide-note' }, st('noExperts', lang))); return; }
      const btn = e.currentTarget;
      try {
        const mod = await loader();
        close();
        // Through the engine so player input stays paused and panels never stack; direct open only without the engine.
        let ok = false;
        try { ok = typeof window !== 'undefined' && window.yawmuk?.openFeature ? await window.yawmuk.openFeature('experts', { prefill: question }) : false; } catch { ok = false; }
        if (!ok) mod.open({ lang, onClose: () => {}, prefill: question });
      } catch { btn.replaceWith(h('p', { class: 'yk-guide-note' }, st('noExperts', lang))); }
    } }, `✉ ${st('toScholars', lang)}`);
  }

  let spoke = false; // did this turn start speaking (the live loop resumes listening after the speech)
  function say(text, sl = convLang) {
    if (!text || closed) return;
    if (live) { spoke = true; liveSpeak(text, sl); return; }
    if (autoSpeak) speak(text, sl);
  }

  // ---------- one question
  async function ask(raw, { byVoice = false } = {}) {
    const q = String(raw || '').trim().slice(0, ASK_MAX);
    if (!q || busy || closed) return;
    if (byVoice) setAutoSpeak(true);
    if (live) { liveSeq++; stopListening(); } // never listen while answering
    box.value = ''; count.textContent = `0/${ASK_MAX}`;
    bubble('user', h('p', { dir: 'auto' }, q));
    busy = true; send.disabled = true; spoke = false;
    setLiveState('thinking');
    try { await answer(q, convLang); } finally { busy = false; send.disabled = false; }
    if (live && !closed && !spoke) liveListen();
  }

  async function answer(q, cl) {
    const libLang = LIB_LANGS.has(cl) ? cl : 'en'; // the reviewed library exists in ar/en
    const msg = (k) => st(k, cl);
    const P = (text) => h('p', { dir: 'auto', lang: cl }, text);
    let wait = null;
    const thinking = () => { wait ||= bubble('omar', h('p', { class: 'yk-guide-thinking', dir: 'auto' }, msg('thinking'))); };
    const unwait = () => { wait?.remove(); wait = null; };

    // es / zh / hi …: English pivot for retrieval and the filters (the question itself is still what is answered)
    let pivot = '';
    if (libLang !== cl) {
      thinking();
      pivot = await pivotQuestion(q);
      if (closed) return;
      if (!pivot) { unwait(); bubble('omar', P(msg('unavailable')), listenBtn(msg('unavailable'), cl), scholarsBtn(q)); say(msg('unavailable'), cl); return; }
    }
    const r = routeQuestion(pivot || q, passages(libLang));
    let route = r.route;
    if (pivot && route !== 'personal') { // the ar/en filters also run on the original words
      if (isPersonalFatwa(q)) route = 'personal';
      else if (route !== 'injection' && looksLikeInjection(q)) route = 'injection';
    }

    if (route === 'personal') {
      unwait();
      // "General reading" only when a reviewed card clearly matches (never a passage that shares just a place name)
      const rel = fallbackPassages(r.hits, 2);
      bubble('omar', P(msg('personal')), listenBtn(msg('personal'), cl), rel.length ? chips(rel, 'related') : null, scholarsBtn(q));
      say(msg('personal'), cl); return;
    }
    if (route === 'judge') {
      unwait();
      bubble('omar', P(msg('judge')), listenBtn(msg('judge'), cl), scholarsBtn(q));
      say(msg('judge'), cl); return;
    }
    if (route === 'evidence') {
      unwait();
      const rel = fallbackPassages(r.hits, 2, 0.34);
      bubble('omar', P(msg('evidence')), listenBtn(msg('evidence'), cl), rel.length ? chips(rel, 'related') : null, scholarsBtn(q));
      say(msg('evidence'), cl); return;
    }
    if (route === 'injection' || route === 'uncovered' || route === 'empty') {
      unwait();
      const text = route === 'injection' ? msg('offTopic') : msg('abstain');
      bubble('omar', P(text), listenBtn(text, cl), route !== 'injection' ? scholarsBtn(q) : null);
      say(text, cl); return;
    }

    thinking();
    const body = wireBody(q, cl, r.hits, WIRE_MAX_BYTES, pivot);
    const raw2 = await askGuide(body);
    if (closed) return;
    unwait();
    const sentIds = body.passages.map((p) => p.id);
    const byId = new Map(r.hits.map((p) => [p.id, p]));

    if (!raw2 || raw2.error) {
      // model unavailable -> reviewed passages verbatim (library language), never a generated answer
      const top = fallbackPassages(r.hits);
      if (!top.length) { bubble('omar', P(msg('abstain')), listenBtn(msg('abstain'), cl), scholarsBtn(q)); say(msg('abstain'), cl); return; }
      bubble('omar',
        h('p', { class: 'yk-guide-badge lib', dir: 'auto' }, msg('libLabel')),
        P(msg('libIntro')),
        h('ol', { class: 'yk-guide-passages' }, top.map((p) => h('li', {},
          h('strong', {}, p.title), h('p', { dir: 'auto' }, shownText(p, libLang)), listenBtn(shownText(p, libLang), libLang)))),
        chips(top),
        sourceList(top.flatMap((p) => sourcesFor(p, getSources()))),
        h('p', { class: 'yk-guide-note', dir: 'auto' }, msg('generalInfo')),
        h('p', { class: 'yk-guide-note', dir: 'auto' }, msg('referNote')),
        scholarsBtn(q));
      say(msg('libIntro'), cl);
      return;
    }

    const v = validateGuide(raw2, sentIds, cl);
    if (v.kind === 'off_topic') { bubble('omar', P(msg('offTopic')), listenBtn(msg('offTopic'), cl)); say(msg('offTopic'), cl); return; }
    if (v.kind === 'abstain') {
      const near = fallbackPassages(r.hits, 2);
      bubble('omar', P(msg('abstain')), listenBtn(msg('abstain'), cl), near.length ? chips(near, 'related') : null, scholarsBtn(q));
      say(msg('abstain'), cl); return;
    }
    const used = v.used_ids.map((id) => byId.get(id)).filter(Boolean);
    bubble('omar',
      h('p', { class: 'yk-guide-badge ai', dir: 'auto' }, msg('aiLabel')),
      h('p', { dir: 'auto', lang: cl, class: 'yk-guide-answer' }, v.answer),
      listenBtn(v.answer, cl),
      chips(used),
      sourceList(used.flatMap((p) => sourcesFor(p, getSources()))),
      h('p', { class: 'yk-guide-note', dir: 'auto' }, msg('generalInfo')),
      v.refer ? h('p', { class: 'yk-guide-note', dir: 'auto' }, msg('referNote')) : null,
      v.refer ? scholarsBtn(q) : null);
    say(v.answer, cl);
  }

  // ---------- live conversation: listen -> ask -> speak -> listen …
  const liveBtn = voiceInputSupported()
    ? h('button', { type: 'button', class: 'yk-guide-live', 'aria-pressed': 'false', title: st('liveHint', lang), onclick: () => (live ? stopLive() : startLive()) },
      h('span', { class: 'yk-guide-live-dot', 'aria-hidden': 'true' }), h('span', {}, st('live', lang)))
    : null;
  const liveState = h('span', { class: 'yk-guide-livestate', role: 'status', 'aria-live': 'polite' });
  function setLiveState(k) {
    if (!liveBtn) return;
    liveBtn.dataset.state = live && k ? k : '';
    liveState.textContent = live && k ? st(`live_${k}`, convLang) : '';
  }
  function startLive() {
    if (live || closed) return;
    unlockAudio(); // inside the click: lets the spoken answers play later without a gesture
    live = true; misses = 0; liveHard = false;
    setAutoSpeak(true);
    liveBtn.setAttribute('aria-pressed', 'true'); liveBtn.classList.add('on');
    if (mic) mic.disabled = true;
    status.textContent = '';
    if (busy) setLiveState('thinking'); else liveListen();
  }
  function stopLive({ silence = true, note = false } = {}) {
    if (!live) return;
    live = false; liveSeq++;
    stopListening();
    if (silence) stopVoice();
    liveBtn?.setAttribute('aria-pressed', 'false'); liveBtn?.classList.remove('on');
    if (mic) mic.disabled = false;
    setLiveState(null);
    if (note) status.textContent = `${status.textContent ? `${status.textContent} ` : ''}${st('liveEnded', convLang)}`;
  }
  function liveListen() {
    if (!live || closed || busy) return;
    const mine = ++liveSeq;
    setLiveState('listening');
    const session = listen({
      lang: convLang,
      onInterim: (t) => { if (mine === liveSeq) box.value = t.slice(0, ASK_MAX); },
      onFinal: (t) => { if (mine !== liveSeq) return; misses = 0; status.textContent = ''; ask(t, { byVoice: true }); },
      onError: (text, code) => {
        if (mine !== liveSeq) return;
        status.textContent = text || '';
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'start'].includes(code)) liveHard = true;
      },
      onEnd: (t) => {
        if (mine !== liveSeq || !live || closed || t) return;
        if (liveHard || ++misses >= 2) { stopLive({ note: true }); return; }
        liveListen(); // one silent turn: listen again
      }
    });
    if (!session && live && mine === liveSeq) stopLive({ note: true });
  }
  function liveSpeak(text, sl) {
    const mine = ++liveSeq;
    setLiveState('speaking');
    const ok = speak(text, sl, {
      onEnd: () => { if (mine === liveSeq && live && !closed) liveListen(); },
      onStop: () => { if (mine === liveSeq && live) stopLive({ silence: false }); } // cut off (another voice, stop) -> leave live mode
    });
    if (!ok && mine === liveSeq) liveListen();
  }

  // ---------- conversation language
  const langSel = h('select', { class: 'yk-guide-langsel', 'aria-label': st('convLang', lang), title: st('convLang', lang) },
    SPEECH_LANGS.map((l) => h('option', { value: l.code, lang: l.code, selected: l.code === convLang }, l.label)));
  langSel.addEventListener('change', () => {
    convLang = normalizeLang(langSel.value, convLang);
    box.setAttribute('lang', convLang);
    if (live && !busy) { liveSeq++; stopListening(); liveListen(); } // keep listening, in the new language
  });
  langSel.addEventListener('keydown', (e) => e.stopPropagation());

  // ---------- input row
  box.addEventListener('input', () => { if (box.value.length > ASK_MAX) box.value = box.value.slice(0, ASK_MAX); count.textContent = `${box.value.length}/${ASK_MAX}`; });
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(box.value); } });
  send.addEventListener('click', () => ask(box.value));
  const mic = micButton({
    lang: () => convLang,
    uiLang: lang,
    onInterim: (t) => { box.value = t.slice(0, ASK_MAX); },
    onFinal: (t) => { status.textContent = ''; ask(t, { byVoice: true }); },
    onStatus: (msg) => { status.textContent = msg || ''; }
  });

  const head = h('div', { class: 'yk-guide-head' },
    h('div', { class: 'yk-guide-avatar', 'aria-hidden': 'true' }, lang === 'ar' ? 'ع' : 'O'),
    h('div', { class: 'yk-guide-titles' }, h('h2', {}, st('title', lang)), h('p', {}, st('sub', lang))),
    h('button', { type: 'button', class: 'yk-guide-close', 'aria-label': st('close', lang), onclick: close }, '✕'));
  const disclosure = h('p', { class: 'yk-guide-disclosure' }, h('span', { 'aria-hidden': 'true' }, 'ⓘ '), st('disclosure', lang));

  const hello = bubble('omar', h('p', {}, st('hello', lang)));
  const sugg = starters(lang);
  if (sugg.length) hello.querySelector('.yk-guide-body').append(h('div', { class: 'yk-guide-starters' }, h('span', {}, st('try', lang)), sugg.map((s) => h('button', { type: 'button', class: 'yk-guide-chip', onclick: () => ask(s) }, s))));

  const voiceNote = [mic ? vt('privacy', lang) : '', voiceOutputSupported() ? vt('speakPrivacy', lang) : ''].filter(Boolean).join(' ');
  chat.append(log, status,
    h('div', { class: 'yk-guide-voicebar' },
      h('label', { class: 'yk-guide-langpick' }, h('span', {}, st('convLang', lang)), langSel),
      liveBtn, liveState),
    h('div', { class: 'yk-guide-inputrow' }, box, mic, send),
    h('div', { class: 'yk-guide-foot' }, h('span', {}, `${st('privacy', lang)} `, count), speakToggle),
    voiceNote ? h('p', { class: 'yk-guide-voicenote' }, voiceNote) : null);

  m.body.replaceChildren(h('div', { class: 'yk-guide', dir, lang }, head, disclosure, chat, detail));
  requestAnimationFrame(() => { try { box.focus({ preventScroll: true }); } catch { /* */ } });
  return close;
}
