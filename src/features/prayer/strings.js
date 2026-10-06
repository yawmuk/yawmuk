// UI strings + level-أ explanatory text for the prayer feature (ar/en).
// Explanations are short, general, written in plain words (no Quran/hadith text), and each one
// links to the matching chapter of the Fiqh Encyclopedia at dorar.net (an approved reference source).

export const DORAR = {
  ruling: 'https://dorar.net/feqhia/677/%D8%A7%D9%84%D9%85%D8%A8%D8%AD%D8%AB-%D8%A7%D9%84%D8%A3%D9%88%D9%84-%D8%AD%D9%83%D9%85-%D8%A7%D9%84%D8%B5%D9%84%D8%A7%D8%A9',
  timeCondition: 'https://dorar.net/feqhia/831/%D8%A7%D9%84%D9%85%D8%B7%D9%84%D8%A8-%D8%A7%D9%84%D8%A3%D9%88%D9%84-%D8%A7%D8%B4%D8%AA%D8%B1%D8%A7%D8%B7-%D8%AF%D8%AE%D9%88%D9%84-%D8%A7%D9%84%D9%88%D9%82%D8%AA',
  fajr: 'https://dorar.net/feqhia/838/%D8%A7%D9%84%D9%81%D8%B1%D8%B9-%D8%A7%D9%84%D8%A3%D9%88%D9%84-%D9%88%D9%82%D8%AA-%D8%B5%D9%84%D8%A7%D8%A9-%D8%A7%D9%84%D9%81%D8%AC%D8%B1',
  dhuhr: 'https://dorar.net/feqhia/840/%D8%A7%D9%84%D9%81%D8%B1%D8%B9-%D8%A7%D9%84%D8%AB%D8%A7%D9%86%D9%8A-%D9%88%D9%82%D8%AA-%D8%B5%D9%84%D8%A7%D8%A9-%D8%A7%D9%84%D8%B8%D9%87%D8%B1',
  asr: 'https://dorar.net/feqhia/842/%D8%A7%D9%84%D9%81%D8%B1%D8%B9-%D8%A7%D9%84%D8%AB%D8%A7%D9%84%D8%AB-%D9%88%D9%82%D8%AA-%D8%B5%D9%84%D8%A7%D8%A9-%D8%A7%D9%84%D8%B9%D8%B5%D8%B1',
  maghrib: 'https://dorar.net/feqhia/844/%D8%A7%D9%84%D9%81%D8%B1%D8%B9-%D8%A7%D9%84%D8%B1%D8%A7%D8%A8%D8%B9-%D9%88%D9%82%D8%AA-%D8%B5%D9%84%D8%A7%D8%A9-%D8%A7%D9%84%D9%85%D8%BA%D8%B1%D8%A8',
  isha: 'https://dorar.net/feqhia/846/%D8%A7%D9%84%D9%81%D8%B1%D8%B9-%D8%A7%D9%84%D8%AE%D8%A7%D9%85%D8%B3-%D9%88%D9%82%D8%AA-%D8%B5%D9%84%D8%A7%D8%A9-%D8%A7%D9%84%D8%B9%D8%B4%D8%A7%D8%A1',
  highLatitude: 'https://dorar.net/feqhia/848/%D8%A7%D9%84%D9%81%D8%B1%D8%B9-%D8%A7%D9%84%D8%B3%D8%A7%D8%AF%D8%B3-%D8%A3%D9%88%D9%82%D8%A7%D8%AA-%D8%A7%D9%84%D8%B5%D9%84%D8%A7%D8%A9-%D9%81%D9%8A-%D8%A7%D9%84%D8%A8%D9%84%D8%A7%D8%AF-%D8%A7%D9%84%D8%AA%D9%8A-%D9%8A%D8%AE%D8%B1%D8%AC-%D9%81%D9%8A%D9%87%D8%A7-%D8%A7%D9%84%D9%84%D9%8A%D9%84-%D9%88%D8%A7%D9%84%D9%86%D9%87%D8%A7%D8%B1-%D8%B9%D9%86-%D8%A7%D9%84%D9%85%D8%B9%D8%AA%D8%A7%D8%AF'
};

export const ADHAN_CREDIT = {
  title: 'The Adhan - Muslim Call to Prayer - Aaqib Azeez.mp3',
  author: 'Atcovi',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3'
};

export const NAMES = {
  fajr: { ar: 'الفجر', en: 'Fajr' },
  sunrise: { ar: 'الشروق', en: 'Sunrise' },
  dhuhr: { ar: 'الظهر', en: 'Dhuhr' },
  asr: { ar: 'العصر', en: 'Asr' },
  maghrib: { ar: 'المغرب', en: 'Maghrib' },
  isha: { ar: 'العشاء', en: 'Isha' }
};

export const EXPLAIN = {
  intro: {
    ar: 'الصلوات الخمس فرضٌ على كل مسلم بالغ عاقل في اليوم والليلة، ولكل صلاة وقتٌ محدد، ودخول الوقت شرطٌ لصحة الصلاة.',
    en: 'The five daily prayers are obligatory on every adult, sane Muslim each day and night. Each prayer has a set time, and a prayer is only valid once its time has begun.',
    links: [DORAR.ruling, DORAR.timeCondition]
  },
  fajr: { ar: 'ركعتان. يبدأ وقتها بطلوع الفجر الصادق (البياض المنتشر في الأفق)، وينتهي بطلوع الشمس.', en: 'Two units (rak‘ahs). Its time begins at true dawn, when light spreads across the horizon, and ends at sunrise.' },
  dhuhr: { ar: 'أربع ركعات. يبدأ وقتها بعد زوال الشمس عن وسط السماء، ويمتد إلى دخول وقت العصر.', en: 'Four units. Its time begins just after the sun passes its highest point and lasts until Asr begins.' },
  asr: { ar: 'أربع ركعات. يبدأ وقتها عند جمهور العلماء حين يصير ظل الشيء مثله، ولا ينبغي تأخيرها حتى تصفرّ الشمس.', en: 'Four units. For most scholars its time begins when an object’s shadow equals its height; it should not be delayed until the sun turns yellow.' },
  maghrib: { ar: 'ثلاث ركعات. يبدأ وقتها بغروب الشمس كاملًا، ويمتد حتى مغيب الشفق الأحمر عند الجمهور.', en: 'Three units. Its time begins once the sun has fully set and lasts until the red twilight disappears, in the view of the majority.' },
  isha: { ar: 'أربع ركعات. يبدأ وقتها بعد مغيب الشفق الأحمر عند الجمهور، ووقتها المختار إلى منتصف الليل.', en: 'Four units. Its time begins after the red twilight disappears (majority view); its preferred time lasts until the middle of the night.' }
};

export const S = {
  title: { ar: 'مواقيت الصلاة', en: 'Prayer times' },
  close: { ar: 'إغلاق', en: 'Close' },
  now: { ar: 'الآن', en: 'Now' },
  next: { ar: 'الصلاة القادمة', en: 'Next prayer' },
  in: { ar: 'بعد', en: 'in' },
  today: { ar: 'مواقيت اليوم', en: "Today's times" },
  location: { ar: 'الموقع', en: 'Location' },
  method: { ar: 'طريقة الحساب', en: 'Calculation method' },
  myLocation: { ar: 'موقعي الحالي', en: 'My location' },
  useMyLocation: { ar: 'استخدام موقعي', en: 'Use my location' },
  consent: {
    ar: 'سيطلب المتصفح إذنك لمعرفة موقعك. نستخدمه فقط لحساب المواقيت على جهازك: نقرّب الإحداثيات إلى مستوى المدينة، ونحفظها في متصفحك فقط، ولا نرسلها إلى أي خادم.',
    en: 'Your browser will ask for permission to read your location. It is used only to calculate prayer times on your device: we round the coordinates to city level, keep them only in your browser, and never send them to any server.'
  },
  agree: { ar: 'موافق، استخدم موقعي', en: 'OK, use my location' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  locating: { ar: 'جارٍ تحديد الموقع…', en: 'Finding your location…' },
  geoDenied: { ar: 'تعذّر الحصول على الموقع، فبقيت المواقيت على المدينة المختارة.', en: 'Could not get your location; times stay on the selected city.' },
  geoOk: { ar: 'تم استخدام موقعك (مقرّبًا لمستوى المدينة).', en: 'Using your location (rounded to city level).' },
  forget: { ar: 'نسيان موقعي', en: 'Forget my location' },
  mute: { ar: 'كتم الأذان', en: 'Mute adhan' },
  unmute: { ar: 'تشغيل صوت الأذان', en: 'Unmute adhan' },
  muted: { ar: 'الأذان مكتوم', en: 'Adhan muted' },
  preview: { ar: 'استماع للأذان', en: 'Play the adhan' },
  stop: { ar: 'إيقاف الأذان', en: 'Stop the adhan' },
  dismiss: { ar: 'حسنًا', en: 'OK' },
  adhanNow: { ar: 'حان الآن موعد أذان صلاة {p}', en: 'It is now time for the {p} adhan' },
  fajrNote: { ar: 'يُزاد في أذان الفجر «الصلاة خير من النوم»؛ والتسجيل المستخدم هنا أذان عام قد لا يتضمنها.', en: 'The Fajr adhan adds “as-salatu khayrun min an-nawm” (prayer is better than sleep); the recording used here is a general adhan and may not include it.' },
  adhanWhere: { ar: 'بحسب توقيت {c}', en: 'by the time in {c}' },
  audioBlocked: { ar: 'منع المتصفح التشغيل التلقائي؛ اضغط للاستماع.', en: 'The browser blocked autoplay; tap to listen.' },
  audioError: { ar: 'تعذّر تشغيل ملف الأذان.', en: 'The adhan audio could not be played.' },
  aboutTitle: { ar: 'الصلوات الخمس باختصار', en: 'The five prayers, briefly' },
  sourceLink: { ar: 'المصدر: الموسوعة الفقهية — الدرر السنية', en: 'Source: Fiqh Encyclopedia — Dorar.net (Arabic)' },
  disclaimer: {
    ar: 'تُحسب هذه المواقيت فلكيًّا على جهازك بطريقة الحساب المختارة (دون إنترنت)، وقد تختلف بدقائق عن تقويم مسجدك أو الجهة الرسمية في بلدك؛ فالمعتمد هو تقويمهم.',
    en: 'These times are calculated astronomically on your device with the selected method (no internet needed). They may differ by a few minutes from your local mosque or official calendar — follow theirs.'
  },
  asrNote: { ar: 'العصر محسوب على قول الجمهور (ظل الشيء مثله).', en: 'Asr is calculated by the majority view (shadow equal to height).' },
  ummQuraNote: { ar: 'في رمضان يؤخّر تقويم أم القرى العشاء إلى ١٢٠ دقيقة بعد المغرب؛ هذا التعديل غير مطبّق هنا.', en: 'In Ramadan the Umm al-Qura calendar sets Isha 120 minutes after Maghrib; that adjustment is not applied here.' },
  credits: { ar: 'الحساب: مكتبة adhan-js (رخصة MIT). صوت الأذان: ', en: 'Calculation: adhan-js library (MIT). Adhan audio: ' },
  hudLabel: { ar: 'مواقيت الصلاة — افتح التفاصيل', en: 'Prayer times — open details' }
};

export const tr = (key, lang, vars = {}) => {
  const e = S[key];
  let s = (e && (e[lang] || e.en)) || key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
};
