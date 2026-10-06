// «يومك» adhkar feature — UI strings (ar/en). Religious text is NOT here: it comes from content/adhkar/adhkar.json.
export const S = {
  title: { ar: 'الأذكار', en: 'Adhkar' },
  subtitle: { ar: 'أذكار الصباح والمساء وأذكار اليوم — من حصن المسلم، بتخريج موثّق', en: 'Morning, evening and daily remembrance — from Hisn al-Muslim, every item referenced' },
  close: { ar: 'إغلاق', en: 'Close' },
  tabs: { ar: 'أقسام الأذكار', en: 'Adhkar sections' },
  suggested: { ar: 'مقترح الآن', en: 'Suggested now' },
  basisPrayer: { ar: 'حسب مواقيت الصلاة في {c}', en: 'by prayer times in {c}' },
  basisClock: { ar: 'حسب ساعة جهازك', en: 'by your device clock' },
  progress: { ar: 'أتممت {d} من {t}', en: '{d} of {t} completed' },
  allDone: { ar: 'أتممت أذكار هذا القسم — تقبّل الله منك', en: 'Section complete — may Allah accept it from you' },
  tapToCount: { ar: 'اضغط للعدّ', en: 'Tap to count' },
  counterLabel: { ar: 'العدّاد: بقي {r} من {n}', en: 'Counter: {r} of {n} left' },
  done: { ar: 'تم', en: 'Done' },
  reset: { ar: 'إعادة العدّ', en: 'Reset counters' },
  resetOne: { ar: 'إعادة', en: 'Reset' },
  times: { ar: 'مرات', en: 'times' },
  once: { ar: 'مرة', en: 'once' },
  translation: { ar: 'ترجمة المعاني (إنجليزي)', en: 'Translation of meaning' },
  showTranslation: { ar: 'عرض ترجمة المعاني', en: 'Show translation of meaning' },
  hideTranslation: { ar: 'إخفاء الترجمة', en: 'Hide translation' },
  translit: { ar: 'النطق بالحروف اللاتينية', en: 'Transliteration' },
  evening: { ar: 'في المساء تُقال هذه العبارات بدل نظيرتها الصباحية (من حاشية حصن المسلم):', en: 'In the evening, these phrases replace their morning counterparts (Hisn al-Muslim note):' },
  virtue: { ar: 'الفضل', en: 'Virtue' },
  note: { ar: 'تنبيه', en: 'Note' },
  reference: { ar: 'التخريج والحكم', en: 'Reference and grading' },
  grade: { ar: 'الحكم', en: 'Grade' },
  grader: { ar: 'المحدّث', en: 'Graded by' },
  dorarRecord: { ar: 'سجل الدرر السنية', en: 'dorar.net record' },
  openSunnah: { ar: 'النص على sunnah.com', en: 'Text on sunnah.com' },
  openDorar: { ar: 'البحث في الدرر السنية', en: 'Search on dorar.net' },
  openQuran: { ar: 'النص في موسوعة القرآن الكريم', en: 'Text on QuranEnc' },
  hisn: { ar: 'حصن المسلم — الذكر رقم {n}', en: 'Hisn al-Muslim — item {n}' },
  listen: { ar: 'استمع', en: 'Listen' },
  pause: { ar: 'إيقاف', en: 'Pause' },
  audioCredit: { ar: 'التلاوة الصوتية من hisnmuslim.com', en: 'Audio from hisnmuslim.com' },
  audioError: { ar: 'تعذّر تشغيل الصوت', en: 'Audio unavailable' },
  howVerified: { ar: 'كيف تحقّقنا من هذه الأذكار؟', en: 'How were these verified?' },
  howVerifiedBody: {
    ar: 'النص العربي منقول من «حصن المسلم» (hisnmuslim.com)، ونص القرآن نص مصحف المدينة النبوية (مجمع الملك فهد) عبر موسوعة القرآن الكريم. طابقنا كل ذكر مع نص الحديث في الكتب الستة برقمه، ولم نُدرج إلا ما في الصحيحين أو صحّحه/حسّنه الألباني مع مراجعة سجلّه في الدرر السنية. لم يُستعمل الذكاء الاصطناعي في توليد أي نص.',
    en: 'Arabic text is quoted from Hisn al-Muslim (hisnmuslim.com); Qur\'an text is the Madinah Mushaf (King Fahd Complex) via QuranEnc. Every item was matched by number against the hadith text in the six books, and only items in al-Bukhari/Muslim or graded Sahih/Hasan by al-Albani (checked on dorar.net) are included. No text is AI-generated.',
  },
  excludedTitle: { ar: 'أذكار من حصن المسلم لم نُدرجها ولماذا', en: 'Hisn al-Muslim items we left out, and why' },
  disclaimer: { ar: 'للاستزادة والسؤال الشرعي راجع أهل العلم.', en: 'For religious questions, consult qualified scholars.' },
  occasion: { ar: 'الوقت', en: 'When' },
  quranLabel: { ar: 'قرآن كريم', en: "Qur'an" },
  ayah: { ar: 'سورة {s}', en: 'Surah {s}' },
};

export const SURAH = {
  112: { ar: 'الإخلاص', en: 'al-Ikhlas' },
  113: { ar: 'الفلق', en: 'al-Falaq' },
  114: { ar: 'الناس', en: 'an-Nas' },
};

export function tr(key, lang, vars = {}) {
  const e = S[key];
  let s = e ? (e[lang] ?? e.en) : key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
