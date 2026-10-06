// Language state + UI strings. Content strings come from JSON as {ar, en}; use tr() for those.

let lang = 'ar';
const listeners = new Set();

export const STRINGS = {
  gameTitle: { ar: 'يومك', en: 'Yawmuk' },
  tagline: { ar: 'يوم مع آدم وأصدقائه المسلمين — تعرّف على الإسلام من مواقف الحياة اليومية', en: "A day with Adam and his Muslim friends — discover Islam through everyday life" },
  // ---- learner framing (Adam is learning about Islam) — overridable from ui_strings.json
  plainWords: { ar: 'بكلمات بسيطة', en: 'In plain words' },
  adamLearned: { ar: 'ما تعلّمه آدم اليوم', en: 'What Adam learned today' },
  nextTopic: { ar: 'موضوع مقترح لتتابع التعلّم', en: 'A suggested next topic' },
  nextTopicAllDone: { ar: 'استكشفت كل مواقف اليوم. يمكنك إعادة أي موقف وتجربة خيار آخر.', en: "You've explored every situation of the day. Replay any of them and try a different choice." },
  learnMoreTitle: { ar: 'هل تريد أن تعرف المزيد؟', en: 'Want to learn more?' },
  learnMoreBody: {
    ar: 'أقرب مسجد أو مركز تعريف بالإسلام في مدينتك يرحّب بالأسئلة دائماً — كثير منها يقيم أيام «مسجد مفتوح» وجلسات تعريفية للزوار من كل الخلفيات، بلا أي التزام.',
    en: 'Your nearest mosque or Islamic information center is always happy to answer questions — many host open-mosque days and introductory sessions for visitors of every background, with no commitment.'
  },
  goThereNow: { ar: 'اذهب إلى هذا الموقف', en: 'Go to this situation' },
  aboutRulings: { ar: 'عن هذه الأحكام', en: 'About these rulings' },
  progressTitle: { ar: 'تقدّمك حتى الآن', en: 'Your progress so far' },
  progressMessage: { ar: 'أسبوع آدم لم ينتهِ بعد. هذا ما تعلّمه حتى الآن — تابع اللعب لتكمل بقية المواقف.', en: "Adam's week isn't over yet. Here's what he has learned so far — keep playing to explore the rest." },
  progressScore: { ar: 'النقاط حتى الآن', en: 'Score so far' },
  referralButton: { ar: 'ابحث عن مسجد قريب منك', en: 'Find a mosque near you' },
  referralQuery: { ar: 'مسجد قريب مني', en: 'mosque open house near me' },
  summaryPoints: { ar: [], en: [] },
  nextTopics: { ar: [], en: [] },
  stillToExplore: { ar: 'ما زال في يوم آدم موقف لم تكتشفه:', en: "There's still a situation in Adam's day you haven't explored:" },
  nothingYet: { ar: 'لم يكتمل أي موقف بعد — كل موقف تنهيه يظهر هنا.', en: 'No situations completed yet — each one you finish will appear here.' },
  chooseLang: { ar: 'اختر اللغة', en: 'Choose language' },
  newGame: { ar: 'ابدأ يوماً جديداً', en: 'Start a new day' },
  continue: { ar: 'متابعة', en: 'Continue' },
  next: { ar: 'التالي', en: 'Next' },
  start: { ar: 'ابدأ', en: 'Start' },
  startExploring: { ar: 'ابدأ الاستكشاف', en: 'Start exploring' },
  close: { ar: 'إغلاق', en: 'Close' },
  interact: { ar: 'تفاعل', en: 'Interact' },
  pressE: { ar: 'اضغط E', en: 'Press E' },
  exitDoor: { ar: 'إلى المحطة التالية', en: 'To the next stop' },
  finishDay: { ar: 'إنهاء اليوم', en: 'Finish the day' },
  score: { ar: 'النقاط', en: 'Score' },
  done: { ar: 'المواقف', en: 'Situations' },
  menu: { ar: 'القائمة', en: 'Menu' },
  resume: { ar: 'استئناف', en: 'Resume' },
  locations: { ar: 'الانتقال إلى محطة', en: 'Jump to a location' },
  language: { ar: 'English', en: 'العربية' },
  restart: { ar: 'إعادة اللعبة من البداية', en: 'Restart from scratch' },
  confirmRestart: { ar: 'سيُحذف تقدمك. هل أنت متأكد؟', en: 'Your progress will be erased. Are you sure?' },
  whatDoYouDo: { ar: 'ماذا تفعل؟', en: 'What do you do?' },
  points: { ar: 'نقطة', en: 'pts' },
  seeRuling: { ar: 'اعرض الحكم الشرعي', en: 'See the ruling' },
  checkTitle: { ar: 'سؤال للتثبيت', en: 'Quick check' },
  correct: { ar: 'إجابة صحيحة! +5', en: 'Correct! +5' },
  exitLocked: { ar: 'أكمل مواقف هذا المكان أولاً', en: "Finish this location's situations first" },
  exitReady: { ar: 'الطريق مفتوح — اتجه إلى الباب', en: "You're all set — head for the exit" },
  // integrated neighbourhood (hub)
  backToTown: { ar: 'العودة إلى الحيّ', en: 'Back to the neighbourhood' },
  enterPlace: { ar: 'ادخل', en: 'Enter' },
  nextStop: { ar: 'وجهتك التالية', en: 'Next stop' },
  dayDone: { ar: 'أكملت مواقف اليوم — تجوّل بحرية', en: "You've finished the day's situations — explore freely" },
  townHint: { ar: 'امشِ إلى الباب المضيء واضغط E للدخول', en: 'Walk to a glowing door and press E to go in' },
  townHintTouch: { ar: 'امشِ إلى الباب المضيء واضغط زر الدخول', en: 'Walk to a glowing door and tap the button to go in' },
  guideFab: { ar: 'اسأل المرشد', en: 'Ask the guide' },
  featureMissing: { ar: 'هذه الميزة غير متاحة حالياً', en: 'This feature is not available right now' },
  placesTitle: { ar: 'أماكن في الحيّ', en: 'Places in the neighbourhood' },
  disc_general: { ar: 'هذه معلومة عامة؛ لحالتك الخاصة اسأل عالماً موثوقاً.', en: 'This is general information; for your specific situation, ask a trusted scholar.' },
  disc_fiction: { ar: 'القصة والشخصيات في هذه اللعبة تخييلية.', en: 'The story and characters in this game are fictional.' },
  disc_ai: { ar: 'الأحكام أُعدّت بمساعدة الذكاء الاصطناعي وتحتاج إلى مراجعة أهل العلم.', en: 'The rulings were prepared with AI help and need review by qualified scholars.' },
  bestChoices: { ar: 'اختيارات «الأفضل»', en: "'Best' choices" },
  correctChecks: { ar: 'أسئلة الفهم الصحيحة', en: 'Correct check answers' },
  incorrect: { ar: 'ليست الإجابة الصحيحة. الصحيح موضّح باللون الأخضر.', en: 'Not quite. The correct answer is highlighted in green.' },
  finishSituation: { ar: 'تم', en: 'Done' },
  tryAnother: { ar: 'جرّب خياراً آخر', en: 'Try another choice' },
  reviewRuling: { ar: 'راجع بطاقة الحكم', en: 'Review the ruling card' },
  alreadyDone: { ar: 'أنهيت هذا الموقف. ماذا تريد؟', en: 'You finished this situation. What would you like to do?' },
  leaveAnyway: { ar: 'غادر على أي حال', en: 'Leave anyway' },
  stay: { ar: 'ابقَ واستكشف', en: 'Stay and explore' },
  remaining: { ar: 'بقيت مواقف لم تكملها هنا:', en: "There are situations here you haven't completed:" },
  // ruling card
  ruling: { ar: 'بطاقة الحكم', en: 'Ruling card' },
  question: { ar: 'المسألة', en: 'The question' },
  summary: { ar: 'الخلاصة', en: 'Summary' },
  quran: { ar: 'من القرآن الكريم', en: 'From the Quran' },
  hadith: { ar: 'من السنة النبوية', en: 'From the Sunnah' },
  madhahib: { ar: 'المذاهب الأربعة', en: 'The four madhhabs' },
  hanafi: { ar: 'الحنفي', en: 'Hanafi' },
  maliki: { ar: 'المالكي', en: 'Maliki' },
  shafii: { ar: 'الشافعي', en: "Shafi'i" },
  hanbali: { ar: 'الحنبلي', en: 'Hanbali' },
  reference: { ar: 'المرجع', en: 'Reference' },
  contemporary: { ar: 'المجامع والهيئات المعاصرة', en: 'Contemporary fiqh bodies' },
  guidance: { ar: 'إرشادات عملية', en: 'Practical guidance' },
  alternatives: { ar: 'بدائل حلال', en: 'Halal alternatives' },
  referScholar: { ar: 'متى تسأل عالماً؟', en: 'When to ask a scholar' },
  source: { ar: 'المصدر', en: 'Source' },
  grade: { ar: 'الدرجة', en: 'Grade' },
  narrator: { ar: 'الراوي', en: 'Narrator' },
  confidence: { ar: 'درجة الثقة', en: 'Confidence' },
  conf_high: { ar: 'عالية', en: 'High' },
  conf_medium: { ar: 'متوسطة', en: 'Medium' },
  conf_low: { ar: 'منخفضة', en: 'Low' },
  status_ai_draft: { ar: 'مسودة بالذكاء الاصطناعي — بانتظار مراجعة عالم', en: 'AI draft — pending scholar review' },
  status_ai_verified: { ar: 'روجِع آلياً بالذكاء الاصطناعي — بانتظار مراجعة عالم', en: 'AI-checked — pending scholar review' },
  status_reviewed: { ar: 'تمت مراجعته من مختص', en: 'Reviewed by a scholar' },
  pendingTitle: { ar: 'المحتوى قيد الإعداد', en: 'Content pending' },
  pendingBody: { ar: 'بطاقة الحكم لهذا الموقف لم تكتمل بعد. يعمل فريق البحث الشرعي على توثيقها بالأدلة وأقوال المذاهب. إلى ذلك الحين، اسأل عالماً موثوقاً أو إمام مسجدك.', en: 'The ruling card for this situation is not ready yet. The research team is still documenting the evidence and the positions of the madhhabs. Until then, please ask a trusted scholar or your local imam.' },
  notProvided: { ar: 'لم يُوثّق بعد', en: 'Not documented yet' },
  fixtureBadge: { ar: 'بيانات اختبار (ليست محتوى حقيقياً)', en: 'Test fixture (not real content)' },
  // intro / disclaimer
  introTitle: { ar: 'قبل أن تبدأ', en: 'Before you begin' },
  introBody: {
    ar: 'ستعيش يوماً كاملاً مع آدم، شاب من Columbus, Ohio يحب أن يتعرّف على الإسلام من أصدقائه وزملائه وجيرانه المسلمين. في كل محطة موقف يومي حقيقي: تختار ماذا يسأل آدم أو كيف يتصرف، ثم ترى بطاقة تشرح ماذا يقول الإسلام ولماذا، موثقة بالقرآن والسنة وأقوال المذاهب الأربعة.',
    en: 'You will spend a full day with Adam, a young man from Columbus, Ohio who is curious about Islam and learns from his Muslim friends, coworkers and neighbors. At each stop there is a real everyday situation: you choose what Adam asks or does, then see a card explaining what Islam says and why, documented from the Quran, the Sunnah and the four schools of law.'
  },
  disclaimerTitle: { ar: 'تنبيه مهم', en: 'Important notice' },
  disclaimerBody: {
    ar: 'القصص والحوارات في اللعبة تخييلية. أما الأحكام فهي مسودات أعدّها الذكاء الاصطناعي من مصادر موثقة، وهي بانتظار مراجعة أهل العلم. هذه اللعبة أداة تعليمية وليست فتوى؛ الأحكام قد تختلف باختلاف الأحوال الشخصية، فاسأل عالماً موثوقاً أو إمام مسجدك في حالتك الخاصة.',
    en: 'The stories and dialogue are fictional. The rulings are AI-prepared drafts based on documented sources and are pending review by qualified scholars. This game is an educational tool, not a fatwa; rulings can vary with personal circumstances — ask a trusted scholar or your local imam about your own case.'
  },
  controlsTitle: { ar: 'التحكم', en: 'Controls' },
  controlsBody: {
    ar: 'الحركة: W A S D أو الأسهم · تدوير الكاميرا: اسحب بالفأرة · تفاعل: E · القائمة: Esc. على الهاتف: عصا التحكم للحركة، اسحب الشاشة للتدوير، وزر «تفاعل».',
    en: 'Move: W A S D or arrow keys · Orbit camera: drag with the mouse · Interact: E · Menu: Esc. On mobile: joystick to move, drag the screen to look, and the "Interact" button.'
  },
  iUnderstand: { ar: 'فهمت، لنبدأ', en: 'I understand, let’s go' },
  // summary
  summaryTitle: { ar: 'انتهى يومك', en: 'Your day is over' },
  finalScore: { ar: 'مجموع النقاط', en: 'Final score' },
  completed: { ar: 'المواقف المكتملة', en: 'Situations completed' },
  topicsLearned: { ar: 'ما تعلمته اليوم', en: 'What you learned today' },
  scholarNote: {
    ar: 'هذه بداية التعرّف لا نهايته. ما عرضته اللعبة مسودات تعليمية بانتظار مراجعة العلماء، والأحكام قد تختلف باختلاف الأحوال؛ فللتفاصيل اسأل إمام مسجد قريب أو عالماً موثوقاً.',
    en: "This is the start of learning, not the end. What you saw are educational drafts pending scholarly review, and rulings can depend on circumstances — for details, ask the imam of a nearby mosque or a trusted scholar."
  },
  playAgain: { ar: 'العب من جديد', en: 'Play again' },
  backToGame: { ar: 'عودة إلى اللعبة', en: 'Back to the game' },
  loading: { ar: 'جارٍ التحميل…', en: 'Loading…' },
  sceneError: { ar: 'تعذّر بناء المشهد؛ استُخدم مشهد بديل.', en: 'Scene failed to build; using a fallback room.' },
  noSituations: { ar: 'لا توجد مواقف في هذه المحطة بعد.', en: 'No situations at this stop yet.' },
  adam: { ar: 'آدم', en: 'Adam' },
  narratorName: { ar: '', en: '' },
  of: { ar: 'من', en: 'of' },
  time: { ar: 'الوقت', en: 'Time' },
  log: { ar: 'سجل المواقف', en: 'Situation log' },
  notStarted: { ar: 'لم يبدأ', en: 'Not started' },
  goThere: { ar: 'اذهب', en: 'Go' }
};

export function getLang() { return lang; }

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'ar';
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  listeners.forEach((fn) => { try { fn(lang); } catch (e) { console.error(e); } });
}

export function onLangChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** UI string by key. */
export function t(key) {
  const s = STRINGS[key];
  if (!s) return key;
  return s[lang] ?? s.en ?? key;
}

/** Translate a bilingual content object {ar, en} (or a plain string). Falls back to the other language. */
export function tr(obj, l = lang) {
  if (obj == null) return '';
  if (typeof obj === 'string' || typeof obj === 'number') return String(obj);
  const other = l === 'ar' ? 'en' : 'ar';
  const v = obj[l];
  if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) return v;
  return obj[other] ?? '';
}

/** For fields shaped like position_ar / position_en. */
export function trField(o, base, l = lang) {
  if (!o) return '';
  const other = l === 'ar' ? 'en' : 'ar';
  return o[`${base}_${l}`] || o[`${base}_${other}`] || '';
}

/** Arabic-Indic digits are not used: Western digits stay readable in both languages. */
export function fmtNum(n) { return String(n); }

// ---------------------------------------------------------------- content/script/ui_strings.json overrides
// Engine key -> dotted path in ui_strings.json. Anything present there wins over the built-in defaults above.
const UI_MAP = {
  gameTitle: 'game_title', tagline: 'game_subtitle',
  newGame: 'start.play', continue: 'start.continue', howToPlay: 'start.how_to_play', about: 'start.about',
  chooseLang: 'language.choose', language: 'language.switch',
  next: 'dialogue.next', whatDoYouDo: 'dialogue.what_do_you_do', adam: 'dialogue.adam', narratorLabel: 'dialogue.narrator',
  resume: 'hud.resume', score: 'hud.score', done: 'hud.progress', time: 'hud.time', menu: 'hud.pause',
  interactHint: 'hud.interact_hint', interactHintMobile: 'hud.interact_hint_mobile',
  exitLocked: 'hud.exit_locked', exitReady: 'hud.exit_ready',
  seeRuling: 'result.see_ruling', pointsEarned: 'result.points_earned',
  ruling: 'ruling_card.title', question: 'ruling_card.question', verdictLabel: 'ruling_card.verdict', summary: 'ruling_card.summary',
  quran: 'ruling_card.quran', hadith: 'ruling_card.hadith', madhahib: 'ruling_card.madhahib',
  hanafi: 'ruling_card.hanafi', maliki: 'ruling_card.maliki', shafii: 'ruling_card.shafii', hanbali: 'ruling_card.hanbali',
  contemporary: 'ruling_card.contemporary', guidance: 'ruling_card.practical', alternatives: 'ruling_card.alternatives',
  referScholar: 'ruling_card.refer', source: 'ruling_card.source', grade: 'ruling_card.grade', reference: 'ruling_card.reference',
  notProvided: 'ruling_card.text_pending', confidence: 'ruling_card.confidence', status_ai_draft: 'ruling_card.review_status_ai_draft',
  close: 'ruling_card.close',
  conf_high: 'ruling_card.confidence_levels.high', conf_medium: 'ruling_card.confidence_levels.medium', conf_low: 'ruling_card.confidence_levels.low',
  checkTitle: 'check.title', correct: 'check.correct', incorrect: 'check.incorrect',
  exitDoor: 'transition.next_stop', loading: 'transition.loading',
  summaryTitle: 'end.title', endMessage: 'end.message', finalScore: 'end.total_score', bestChoices: 'end.best_choices',
  correctChecks: 'end.correct_checks', playAgain: 'end.play_again', tier_high: 'end.tiers.high', tier_mid: 'end.tiers.mid', tier_low: 'end.tiers.low',
  controlsTitle: 'instructions.title', ctrlDesktop: 'instructions.desktop', ctrlMobile: 'instructions.mobile', howFlow: 'instructions.flow',
  iUnderstand: 'instructions.got_it',
  disc_general: 'disclaimers.general_info', disc_fiction: 'disclaimers.fiction', disc_ai: 'disclaimers.ai_review',
  disc_disagreement: 'disclaimers.disagreement', discAccept: 'disclaimers.accept',
  aboutTitle: 'about.title', aboutBody: 'about.body',
  // learner framing — several candidate key names are accepted (first present wins)
  plainWords: ['ruling_card.newcomer_explainer', 'ruling_card.plain_words', 'ruling_card.in_plain_words'],
  adamLearned: ['end.summary_title', 'end.learned', 'end.adam_learned'],
  nextTopic: ['end.next_topic_title', 'end.next_topic', 'end.suggested_topic'],
  nextTopicAllDone: ['end.next_topic_all_done', 'end.all_done'],
  learnMoreTitle: ['end.referral_title', 'end.learn_more_title'],
  learnMoreBody: ['end.referral_body', 'end.learn_more'],
  referralButton: ['end.referral_button'],
  progressTitle: ['end.progress_title'],
  progressMessage: ['end.progress_message'],
  progressScore: ['end.progress_score'],
  referralQuery: ['end.referral_search_query'],
  summaryPoints: ['end.summary_points'],
  nextTopics: ['end.next_topics'],
  reviewRulings: ['end.review_rulings'],
  startBasics: ['start.basics'],
  verdictLevelC: ['ruling_card.verdict_level_c'],
  scholarNote: ['end.scholar_note', 'end.ask_scholar']
};

const getPath = (o, p) => p.split('.').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), o);
const isBi = (v) => v && typeof v === 'object' && ('ar' in v || 'en' in v);

/** Apply ui_strings.json. Returns the raw object so other modules can read extra sections (verdicts, result, locations). */
export function applyUiStrings(ui) {
  if (!ui || typeof ui !== 'object') return null;
  for (const [key, paths] of Object.entries(UI_MAP)) {
    for (const path of [paths].flat()) {
      const v = getPath(ui, path);
      // a section object like {title:{ar,en}} is accepted too
      const bi = isBi(v) ? v : isBi(v?.title) ? v.title : null;
      if (bi) { STRINGS[key] = { ...(STRINGS[key] || {}), ...bi }; break; }
    }
  }
  return ui;
}
