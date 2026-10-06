// ar/en strings for the micro-study UI (kept inside the module, not in content/script/ui_strings.json).
export const S = {
  entry: { ar: 'شارك في تجربة قصيرة (٥ دقائق)', en: 'Join a 5-minute study' },
  title: { ar: 'تجربة قصيرة لقياس الفهم', en: 'A short study on understanding' },
  pilot: { ar: 'تجربة تجريبية — لا تدخل في النتائج', en: 'Pilot run — excluded from results' },
  close: { ar: 'إغلاق', en: 'Close' },

  consentLead: {
    ar: 'نريد أن نعرف: هل تساعد «يومك» الناس على فهم كيف يتعامل المسلمون مع مواقف يومية؟ مشاركتك اختيارية تماماً.',
    en: 'We want to learn whether «Yawmuk» helps people understand how Muslims handle everyday situations. Taking part is completely optional.'
  },
  consentWhat: { ar: 'ماذا ستفعل', en: 'What you will do' },
  consentSteps: {
    ar: ['تجيب عن ٥ أسئلة اختيار من متعدد (دقيقتان).', 'تلعب يوماً قصيراً في اللعبة (١٠–١٥ دقيقة، ٣ مواقف على الأقل).', 'تجيب عن الأسئلة نفسها بترتيب آخر، و٣ أسئلة تقييم، وتعليق اختياري (دقيقتان).'],
    en: ['Answer 5 multiple-choice questions (2 minutes).', 'Play a short day in the game (10–15 minutes, at least 3 situations).', 'Answer the same questions in a different order, 3 rating questions and an optional comment (2 minutes).']
  },
  consentPrivacy: { ar: 'خصوصيتك', en: 'Your privacy' },
  consentPrivacyItems: {
    ar: ['لا نسأل عن اسمك ولا بريدك ولا موقعك ولا ديانتك أو معتقدك، ولا نستنتج شيئاً منها.', 'تحصل على رمز عشوائي مجهول؛ هو الرابط الوحيد بين إجاباتك القبلية والبعدية.', 'نحفظ فقط: إجاباتك، والمجموعة، وعدد المواقف التي أنهيتها، وتقييماتك. لا نحفظ عنوان IP ولا نوع جهازك.', 'تُعرض النتائج مجمّعة فقط. يمكنك الانسحاب في أي وقت وحذف بياناتك برمزك.'],
    en: ['We never ask your name, email, location, religion or beliefs, and we infer none of them.', 'You get a random anonymous code; it is the only link between your before and after answers.', 'We store only: your answers, your group, how many situations you finished, and your ratings. No IP address or device data.', 'Results are shown only in aggregate. You can stop at any time and delete your data with your code.']
  },
  consentAi: {
    ar: 'تنبيه: بعض أجزاء اللعبة تستعين بالذكاء الاصطناعي لترتيب رحلتك والإجابة من نصوص مراجَعة فقط. هذه تجربة تعليمية وليست فتوى.',
    en: 'Note: parts of the game use AI to arrange your journey and to answer only from reviewed passages. This is an educational experience, not a fatwa.'
  },
  consentAge: { ar: 'عمري ١٨ سنة أو أكثر، وقرأت ما سبق وأوافق على المشاركة.', en: 'I am 18 or older, I have read the above and I agree to take part.' },
  agree: { ar: 'أوافق، لنبدأ', en: 'I agree — start' },
  decline: { ar: 'لا، شكراً', en: 'No, thanks' },
  needAge: { ar: 'يرجى تأكيد الموافقة أولاً.', en: 'Please confirm your consent first.' },

  preTitle: { ar: 'قبل اللعب: ٥ أسئلة', en: 'Before you play: 5 questions' },
  preNote: { ar: 'لا بأس إن لم تعرف الإجابة — اختر «لا أعرف». لن نكشف الإجابات الآن.', en: "It's fine not to know — pick \"I don't know\". We won't reveal answers yet." },
  postTitle: { ar: 'بعد اللعب: الأسئلة نفسها بترتيب آخر', en: 'After playing: the same questions, reordered' },
  answerAll: { ar: 'أجب عن كل الأسئلة للمتابعة.', en: 'Please answer every question to continue.' },
  next: { ar: 'التالي', en: 'Next' },
  sending: { ar: 'جارٍ الإرسال…', en: 'Sending…' },

  armTitle: { ar: 'شكراً! الآن العب يومك', en: 'Thanks! Now play your day' },
  armNote: {
    ar: 'تم توزيعك على إحدى مجموعتين بالتناوب. لن نخبرك بمجموعتك حتى لا يتأثر رأيك.',
    en: "You've been placed in one of two groups by alternation. We won't tell you which, so it doesn't colour your view."
  },
  armSteps: {
    ar: ['في شاشة البداية اختر «يوم جديد».', 'اختر ما يناسب يومك من الخيارات (أي خيارات تريد).', 'العب ٣ مواقف على الأقل (نحو ١٠–١٥ دقيقة). يمكنك تخطي الأسئلة القصيرة داخل اللعبة.', 'ثم اضغط زر «إنهاء التجربة» في أسفل الشاشة.'],
    en: ['On the start screen choose "New day".', 'Pick whatever fits your day from the options (any choice is fine).', 'Play at least 3 situations (about 10–15 minutes). You may skip the short in-game quiz.', 'Then press the "Finish study" button at the bottom of the screen.']
  },
  yourCode: { ar: 'رمزك المجهول', en: 'Your anonymous code' },
  codeNote: { ar: 'احتفظ به إن أردت حذف بياناتك لاحقاً.', en: 'Keep it if you may want your data deleted later.' },
  startPlaying: { ar: 'ابدأ اللعب', en: 'Start playing' },

  pill: { ar: 'إنهاء التجربة', en: 'Finish study' },
  pillDone: { ar: 'انتهى يومك — أجب عن الأسئلة الأخيرة', en: 'Day done — answer the final questions' },
  hubTitle: { ar: 'أنت مشارك في التجربة', en: "You're taking part in the study" },
  hubNote: { ar: 'أنهيت حتى الآن', en: 'Situations finished so far' },
  hubFew: { ar: 'نقترح إنهاء ٣ مواقف على الأقل قبل الأسئلة الأخيرة.', en: 'We suggest finishing at least 3 situations before the final questions.' },
  toPost: { ar: 'الأسئلة الأخيرة الآن', en: 'Final questions now' },
  keepPlaying: { ar: 'متابعة اللعب', en: 'Keep playing' },
  leave: { ar: 'الانسحاب وحذف بياناتي', en: 'Leave and delete my data' },
  leaveConfirm: { ar: 'هل تريد الانسحاب وحذف إجاباتك؟', en: 'Leave the study and delete your answers?' },
  left: { ar: 'تم حذف بياناتك. شكراً لوقتك.', en: 'Your data has been deleted. Thank you for your time.' },

  likertTitle: { ar: 'قيّم تجربتك (١ = لا أوافق إطلاقاً، ٥ = أوافق تماماً)', en: 'Rate your experience (1 = strongly disagree, 5 = strongly agree)' },
  likert: {
    clarity: { ar: 'كانت المعلومات واضحة وسهلة الفهم.', en: 'The information was clear and easy to understand.' },
    respect: { ar: 'كانت النبرة محترمة لي ولغيري.', en: 'The tone was respectful to me and to others.' },
    next_step: { ar: 'أعرف الخطوة التالية إن واجهت موقفاً كهذا (ومتى أسأل عالماً).', en: 'I know my next step if I face a situation like this (and when to ask a scholar).' }
  },
  low: { ar: 'لا أوافق', en: 'Disagree' },
  high: { ar: 'أوافق', en: 'Agree' },
  commentLabel: { ar: 'تعليق اختياري: ما الذي ساعدك أو أربكك؟', en: 'Optional comment: what helped or confused you?' },
  commentHint: { ar: 'لا تكتب اسماً أو وسيلة تواصل. حد أقصى ٣٠٠ حرف. لا يُنشر التعليق.', en: "Don't write names or contact details. Max 300 characters. Comments are never published." },
  submit: { ar: 'إرسال', en: 'Submit' },

  doneTitle: { ar: 'شكراً لمشاركتك!', en: 'Thank you for taking part!' },
  before: { ar: 'قبل', en: 'Before' },
  after: { ar: 'بعد', en: 'After' },
  reviewTitle: { ar: 'الإجابات الصحيحة ومصدرها في اللعبة', en: 'Correct answers and where they come from in the game' },
  cardRef: { ar: 'بطاقة الحكم', en: 'Ruling card' },
  results: { ar: 'النتائج المجمّعة', en: 'Aggregate results' },
  finish: { ar: 'إنهاء', en: 'Finish' },

  errTitle: { ar: 'تعذّر الاتصال بخادم التجربة', en: 'Could not reach the study server' },
  errNote: { ar: 'لم يُحفظ شيء. أبلغ المشرف أو حاول لاحقاً. يمكنك متابعة اللعب عادياً.', en: 'Nothing was saved. Tell the facilitator or try again later. You can keep playing as usual.' },
  retry: { ar: 'إعادة المحاولة', en: 'Try again' }
};

export const tr = (o, lang) => (o ? (o[lang] ?? o.en ?? '') : '');
