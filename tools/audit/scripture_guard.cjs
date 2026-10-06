// Project-owner decision 2026-10-06: no Bible/Torah/Gospel text or reference anywhere in the project.
// This guard is used by verify.mjs (FAIL). (The former apply_common_ground.cjs writer was retired on 2026-10-06.)
// It scans every string of a ruling EXCEPT the verified Qur'an and hadith texts/translations (which are never changed).
const EN_BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', 'Samuel', 'Kings', 'Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms?', 'Proverbs', 'Ecclesiastes', 'Song of (?:Solomon|Songs)', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', 'Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', 'Thessalonians', 'Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', 'Peter', 'Jude', 'Revelation'];
const AR_BOOKS = ['تكوين', 'التكوين', 'خروج', 'الخروج', 'لاويين', 'اللاويين', 'عدد', 'العدد', 'تثنية', 'التثنية', 'يشوع', 'قضاة', 'القضاة', 'راعوث', 'صموئيل', 'ملوك', 'الملوك', 'أخبار', 'عزرا', 'نحميا', 'أستير', 'أيوب', 'مزمور', 'مزامير', 'المزامير', 'أمثال', 'الأمثال', 'جامعة', 'الجامعة', 'نشيد الأنشاد', 'إشعياء', 'إرميا', 'مراثي', 'حزقيال', 'دانيال', 'هوشع', 'يوئيل', 'عاموس', 'عوبديا', 'يونان', 'ميخا', 'ناحوم', 'حبقوق', 'صفنيا', 'حجي', 'زكريا', 'ملاخي', 'متى', 'مرقس', 'لوقا', 'يوحنا', 'أعمال الرسل', 'رومية', 'كورنثوس', 'غلاطية', 'أفسس', 'فيلبي', 'كولوسي', 'تسالونيكي', 'تيموثاوس', 'تيطس', 'فليمون', 'عبرانيين', 'يعقوب', 'بطرس', 'يهوذا', 'رؤيا'];
const REF_EN = new RegExp(`\\b(?:[123]\\s*)?(?:${EN_BOOKS.join('|')})\\s+\\d+\\s*:\\s*\\d+`, 'i');
const REF_AR = new RegExp(`(?:${AR_BOOKS.join('|')})(?:\\s+(?:الأول|الثاني|الثانية|الأولى|الثالثة))?\\s*\\d+\\s*[:：،,]\\s*\\d+`);
const WORDS = /\b(?:KJV|King James|Van ?Dyc?ke?|bible-api|getbible|bolls\.life|Bible|biblical|Torah|Gospels?|Old Testament|New Testament)\b|فاندايك|فان دايك|الكتاب المقدس|الكتاب المقدّس|التوراة|الإنجيل|الأناجيل|العهد القديم|العهد الجديد/i;

function findScripture(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(REF_EN) || text.match(REF_AR) || text.match(WORDS);
  return m ? m[0] : null;
}
// Walk a ruling, skipping quran[] and hadith[] (verified sacred texts are out of scope).
function scanRuling(r) {
  const hits = [];
  if (r.common_ground && 'bible' in r.common_ground) hits.push({ path: 'common_ground.bible', match: 'bible field present' });
  const walk = (v, p) => {
    if (typeof v === 'string') { const m = findScripture(v); if (m) hits.push({ path: p, match: m }); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
  };
  for (const [k, v] of Object.entries(r)) if (k !== 'quran' && k !== 'hadith') walk(v, k);
  return hits;
}
module.exports = { findScripture, scanRuling };
