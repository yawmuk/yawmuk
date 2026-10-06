// Pure, DOM-free helpers for the Quran panel (importable from node tests).
// No Quran text lives in this file: all text comes from content/quran/*.json
// (fetched by tools/quran/fetch.mjs) or from the live APIs below at runtime.

export const QURAN_API = 'https://api.quran.com/api/v4';
export const QURANENC_API = 'https://quranenc.com/api/v1';
export const EVERYAYAH = 'https://everyayah.com/data';

/** Bundled for offline use (Al-Fatiha, Al-Ikhlas, Al-Falaq, An-Nas). */
export const OFFLINE_SURAHS = [1, 112, 113, 114];

/** Recitation audio (per ayah) — every folder verified to return audio/mpeg with CORS `*`. */
export const RECITERS = [
  { id: 'alafasy', dir: 'Alafasy_128kbps', name: { ar: 'مشاري راشد العفاسي', en: 'Mishary Rashid Alafasy' } },
  { id: 'husary', dir: 'Husary_128kbps', name: { ar: 'محمود خليل الحصري', en: 'Mahmoud Khalil Al-Husary' } },
  { id: 'minshawy', dir: 'Minshawy_Murattal_128kbps', name: { ar: 'محمد صديق المنشاوي (مرتل)', en: 'Mohamed Siddiq Al-Minshawi (Murattal)' } },
  { id: 'abdulbasit', dir: 'Abdul_Basit_Murattal_192kbps', name: { ar: 'عبد الباسط عبد الصمد (مرتل)', en: 'Abdul Basit Abdul Samad (Murattal)' } }
];

/**
 * Translations of meanings from quranenc.com (موسوعة القرآن الكريم).
 * Publishers are stated exactly as quranenc.com lists them.
 */
export const TRANSLATIONS = {
  english_saheeh: { lang: 'en', dir: 'ltr', label: { ar: 'الإنجليزية — صحيح إنترناشيونال (مركز نور الدولي)', en: 'English — Saheeh International (Noor International Center)' } },
  english_hilali_khan: { lang: 'en', dir: 'ltr', label: { ar: 'الإنجليزية — تقي الدين الهلالي ومحمد محسن خان', en: 'English — Taqi-ud-Din al-Hilali & Muhammad Muhsin Khan' } },
  arabic_moyassar: { lang: 'ar', dir: 'rtl', label: { ar: 'التفسير الميسر (تفسير مختصر)', en: 'Al-Tafsir Al-Muyassar (concise Arabic tafsir)' } }
};
export const DEFAULT_TRANSLATION = { ar: 'arabic_moyassar', en: 'english_saheeh' };

const pad3 = (n) => String(n).padStart(3, '0');

function checkRef(surah, ayah) {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw new RangeError(`bad surah ${surah}`);
  if (ayah !== undefined && (!Number.isInteger(ayah) || ayah < 1 || ayah > 286)) throw new RangeError(`bad ayah ${ayah}`);
}

export function audioUrl(reciterId, surah, ayah) {
  checkRef(surah, ayah);
  const r = RECITERS.find((x) => x.id === reciterId) || RECITERS[0];
  return `${EVERYAYAH}/${r.dir}/${pad3(surah)}${pad3(ayah)}.mp3`;
}

export function textUrl(surah) {
  checkRef(surah);
  return `${QURAN_API}/verses/by_chapter/${surah}?fields=text_qpc_hafs&per_page=300&page=1`;
}

export function translationUrl(key, surah) {
  checkRef(surah);
  if (!TRANSLATIONS[key]) throw new Error(`unknown translation ${key}`);
  return `${QURANENC_API}/translation/sura/${key}/${surah}`;
}

export const chaptersUrl = (lang = 'en') => `${QURAN_API}/chapters?language=${lang}`;
export const quranComLink = (surah, ayah) => `https://quran.com/${surah}${ayah ? `/${ayah}` : ''}`;
export const quranencLink = (key, surah, ayah) => `https://quranenc.com/${TRANSLATIONS[key]?.lang === 'ar' ? 'ar' : 'en'}/browse/${key}/${surah}${ayah ? `#${ayah}` : ''}`;

/**
 * quranenc.com terms forbid modifying the translation, so the text is shown exactly as published
 * (including footnote markers like "[2011]") and the footnotes are listed under it.
 * Splits the API's `footnotes` string into one entry per note.
 */
export function splitFootnotes(s) {
  return String(s ?? '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
}

/** QPC Hafs text from api.quran.com ends with an Arabic-Indic verse number; drop it. */
export function stripVerseNumber(s) {
  return String(s ?? '').replace(/[\s ]*[٠-٩]+\s*$/u, '').trim();
}

/** Comparison key for cross-verifying two copies of the same ayah (whitespace only). */
export function normalizeForCompare(s) {
  return stripVerseNumber(s).replace(/[\s ‌‍‏‎]+/g, ' ').trim();
}

export const sameAyah = (a, b) => normalizeForCompare(a) === normalizeForCompare(b);

export const ATTRIBUTION = {
  ar: {
    text: 'النص القرآني: رواية حفص بالرسم العثماني وفق نص مجمع الملك فهد لطباعة المصحف الشريف (QPC Hafs) عبر api.quran.com، ومطابَق آليًا مع نص موسوعة القرآن الكريم.',
    translation: 'الترجمة والتفسير المختصر: موسوعة القرآن الكريم quranenc.com.',
    audio: 'التلاوة: everyayah.com.',
    note: 'الترجمة بيان لمعاني القرآن وليست قرآنًا.'
  },
  en: {
    text: 'Quran text: Hafs, Uthmani script, King Fahd Glorious Quran Printing Complex text (QPC Hafs) via api.quran.com, automatically cross-checked with the Encyclopedia of the Noble Quran.',
    translation: 'Translation of meanings: Encyclopedia of the Noble Quran, quranenc.com.',
    audio: 'Recitation: everyayah.com.',
    note: 'A translation conveys the meanings of the Quran; it is not the Quran itself.'
  },
  links: [
    { href: 'https://qurancomplex.gov.sa/', label: { ar: 'مجمع الملك فهد', en: 'King Fahd Complex' } },
    { href: 'https://quran.com/', label: { ar: 'Quran.com', en: 'Quran.com' } },
    { href: 'https://quranenc.com/', label: { ar: 'موسوعة القرآن الكريم', en: 'quranenc.com' } },
    { href: 'https://everyayah.com/', label: { ar: 'EveryAyah', en: 'EveryAyah' } }
  ]
};

/**
 * Merge api.quran.com verses with a quranenc translation into panel rows.
 * Arabic always comes from QPC Hafs; `verified` says whether quranenc's copy matched.
 */
export function mergeVerses(qpcVerses, encRows) {
  const byAya = new Map((encRows || []).map((r) => [Number(r.aya), r]));
  return qpcVerses.map((v) => {
    const n = Number(v.verse_number ?? v.n);
    const enc = byAya.get(n);
    const ar = stripVerseNumber(v.text_qpc_hafs ?? v.ar);
    return {
      n,
      ar,
      tr: enc ? String(enc.translation ?? '').trim() : '',
      fn: enc ? splitFootnotes(enc.footnotes) : [],
      verified: enc ? sameAyah(ar, enc.arabic_text) : false
    };
  });
}
