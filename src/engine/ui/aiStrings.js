// UI strings for the AI-assisted features (context picker, journey badge, ask panel, read-aloud, understanding check).
// Merged into STRINGS without overriding existing keys; content/script/ui_strings.json may override any of them
// under an optional "ai" section (same key names), e.g. { "ai": { "askTitle": { "ar": "…", "en": "…" } } }.
import { STRINGS } from '../i18n.js';

const DEFAULTS = {
  // context picker (start screen)
  ctxTitle: { ar: 'خصّص يومك (اختياري)', en: 'Personalize your day (optional)' },
  ctxNote: { ar: 'لا حساب ولا أسئلة عن معتقدك — فقط ما يهمّك اليوم.', en: 'No account and no questions about your beliefs — just what interests you today.' },
  ctxDayType: { ar: 'نوع اليوم', en: 'Kind of day' },
  ctxTopics: { ar: 'مواضيع تهمّك', en: 'Topics you care about' },
  ctxReady: { ar: 'يوم جاهز', en: 'Ready-made day' },
  ctxReadyHint: { ar: 'تخطَّ التخصيص وابدأ بالترتيب المعتاد', en: 'Skip personalizing and use the usual order' },
  planning: { ar: 'نرتّب محطات يومك…', en: 'Arranging your day…' },
  // journey badge
  planAi: { ar: 'رتّبها الذكاء الاصطناعي من مكتبة مراجَعة', en: 'AI-arranged from a reviewed library' },
  planDefault: { ar: 'خطة افتراضية', en: 'Default plan' },
  whyHere: { ar: 'لماذا هذه المحطة الآن؟', en: 'Why this stop now?' },
  disc_journey: {
    ar: 'قد يرتّب الذكاء الاصطناعي محطات يومك ويشرح من مكتبة مواقف وأحكام مراجَعة فقط؛ لا يكتب نصوصاً شرعية ولا يُفتي، وما يعرضه ليس فتوى.',
    en: 'AI may arrange the stops of your day and explain things only from a reviewed library of situations and rulings; it never writes religious texts and never gives a fatwa.'
  },
  // ask panel
  askBtn: { ar: 'اسأل عن هذا', en: 'Ask about this' },
  askHud: { ar: 'اسأل', en: 'Ask' },
  askTitle: { ar: 'اسأل عن هذا', en: 'Ask about this' },
  askNote: { ar: 'الإجابات من مكتبة مراجَعة، وليست فتوى. لحالتك الخاصة اسأل عالماً موثوقاً.', en: 'Answers come from a reviewed library and are not a fatwa. For your own case, ask a trusted scholar.' },
  askPrepared: { ar: 'أسئلة يطرحها الناس', en: 'Questions people ask' },
  askNone: { ar: 'لا توجد أسئلة جاهزة هنا بعد.', en: 'No prepared questions here yet.' },
  askFree: { ar: 'اكتب سؤالك', en: 'Type your question' },
  askPlaceholder: { ar: 'مثال: لماذا يتجنب المسلمون الفائدة؟', en: 'e.g. Why do Muslims avoid interest?' },
  askSend: { ar: 'اسأل', en: 'Ask' },
  askThinking: { ar: 'نبحث في المكتبة المراجَعة…', en: 'Searching the reviewed library…' },
  askAiLabel: { ar: 'إجابة بالذكاء الاصطناعي من مادة مراجَعة', en: 'AI answer from reviewed material' },
  askPreparedLabel: { ar: 'إجابة جاهزة مراجَعة', en: 'Prepared, reviewed answer' },
  askClosest: { ar: 'أقرب إجابة جاهزة لسؤالك', en: 'The closest prepared answer to your question' },
  askUsed: { ar: 'المقاطع التي استند إليها', en: 'Passages it relied on' },
  askSources: { ar: 'المصادر', en: 'Sources' },
  askAbstain: { ar: 'لا نجد في المادة المراجَعة ما يكفي للإجابة عن هذا السؤال، ولن نخمّن.', en: "We don't have enough reviewed material to answer this, and we won't guess." },
  askPersonal: { ar: 'يبدو أن سؤالك عن حالة شخصية. الحكم في الحالات الخاصة يحتاج إلى عالم يسمع التفاصيل — هذه اللعبة لا تُفتي.', en: 'This sounds like a question about a personal situation. Personal cases need a scholar who can hear the details — this game does not give fatwas.' },
  askRefer: { ar: 'اسأل إمام مسجد قريب أو عالماً موثوقاً.', en: 'Ask the imam of a nearby mosque or a trusted scholar.' },
  askReferWhen: { ar: 'متى تسأل عالماً', en: 'When to ask a scholar' },
  askLimit: { ar: 'حرف', en: 'characters' },
  askPrivacy: { ar: 'لا نحفظ أسئلتك.', en: 'Your questions are not stored.' },
  askCorrection: { ar: 'تصحيح لفكرة شائعة', en: 'Correcting a common idea' },
  // read aloud
  readAloud: { ar: 'استمع', en: 'Listen' },
  stopReading: { ar: 'إيقاف', en: 'Stop' },
  // understanding check + measurement
  preTitle: { ar: 'قبل أن يبدأ اليوم: ثلاثة أسئلة سريعة', en: 'Before the day starts: three quick questions' },
  preNote: { ar: 'لا نقاط ولا حكم عليك — فقط لترى ماذا تعلّمت في آخر اليوم.', en: "No points and no judgement — just so you can see what you learned at the end of the day." },
  preStart: { ar: 'ابدأ اليوم', en: 'Start the day' },
  preSkip: { ar: 'تخطَّ', en: 'Skip' },
  postTitle: { ar: 'الأسئلة نفسها مرة أخرى', en: 'The same questions again' },
  postScore: { ar: 'قبل اليوم', en: 'Before the day' },
  postScoreAfter: { ar: 'بعد اليوم', en: 'After the day' },
  postGain: { ar: 'التحسّن', en: 'Gain' },
  clarityQ: { ar: 'هل خطوتك التالية واضحة؟ (1 = غير واضحة، 5 = واضحة جداً)', en: 'Is your next step clear? (1 = not clear, 5 = very clear)' },
  consent: { ar: 'شارك نتيجة مجهولة الهوية لتحسين اللعبة', en: 'Share an anonymous result to improve the game' },
  consentNote: { ar: 'نرسل فقط: نوع الخطة، هل أكملت اليوم، عدد الإجابات الصحيحة قبل وبعد، ودرجة الوضوح. لا هوية ولا معتقد ولا نصوص.', en: 'We only send: plan type, whether you finished, correct answers before/after, and the clarity score. No identity, no beliefs, no free text.' },
  consentOn: { ar: 'مفعّل', en: 'On' },
  consentOff: { ar: 'متوقف', en: 'Off' },
  consentSent: { ar: 'شكراً — أُرسلت النتيجة المجهولة.', en: 'Thank you — the anonymous result was sent.' },
  measureTitle: { ar: 'ماذا تغيّر في فهمك؟', en: 'What changed in your understanding?' },
  followupLabel: { ar: 'موقف مقترح للمتابعة', en: 'A suggested follow-up situation' }
};

for (const [k, v] of Object.entries(DEFAULTS)) if (!(k in STRINGS)) STRINGS[k] = v;

/** Apply optional overrides from ui_strings.json → "ai" section, plus disclaimers.ai_journey. */
export function applyAiUi(ui) {
  if (!ui || typeof ui !== 'object') return;
  const sec = ui.ai && typeof ui.ai === 'object' ? ui.ai : {};
  for (const k of Object.keys(DEFAULTS)) {
    const v = sec[k];
    if (v && typeof v === 'object' && ('ar' in v || 'en' in v)) STRINGS[k] = { ...STRINGS[k], ...v };
  }
  const j = ui.disclaimers?.ai_journey;
  if (j && typeof j === 'object' && ('ar' in j || 'en' in j)) STRINGS.disc_journey = { ...STRINGS.disc_journey, ...j };
}
