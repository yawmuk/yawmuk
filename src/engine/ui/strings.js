// Extra UI strings used only by the UI layer (src/engine/ui/**). Built-in defaults are merged into STRINGS
// (without overriding anything i18n.js already defines); applyExtraUi() then lets content/script/ui_strings.json
// override them. Keep this module free of content.js so rulingCard.js stays importable under node:test.
import { STRINGS } from '../i18n.js';

const DEFAULTS = {
  skip: { ar: 'تخطَّ', en: 'Skip' },
  skipLine: { ar: 'أظهر النص كاملاً', en: 'Show the full line' },
  narratorLabel: { ar: 'الراوي', en: 'Narrator' },
  choiceHint: { ar: 'اختر بالنقر أو بالأرقام 1–4', en: 'Tap a choice or press 1–4' },
  verdictLabel: { ar: 'الحكم الإجمالي', en: 'Overall ruling' },
  expandSection: { ar: 'إظهار', en: 'Show' },
  collapseSection: { ar: 'إخفاء', en: 'Hide' },
  externalLink: { ar: 'يفتح في نافذة جديدة', en: 'opens in a new tab' },
  stopOf: { ar: 'المحطة', en: 'Stop' },
  loadingTitle: { ar: 'نجهّز يوم آدم…', en: "Setting up Adam's day…" },
  loadingTips: {
    ar: [
      'كل موقف ينتهي ببطاقة تشرح موقف الإسلام ببساطة، مع أدلته وأقوال المذاهب الأربعة.',
      'لا يوجد خيار «ذكي» واحد: الأسئلة المحترمة الفضولية هي التي تقود إلى فهم أعمق.',
      'استعمل الأرقام 1–4 لاختيار الرد بسرعة.',
      'حين يختلف العلماء تعرض البطاقة الأقوال بإنصاف — والمسلمون أنفسهم يتنوعون في التطبيق.',
      'الأحكام مسودات أُعدّت بمساعدة الذكاء الاصطناعي وتنتظر مراجعة أهل العلم.'
    ],
    en: [
      "Every situation ends with a card that explains Islam's position in plain words, with its evidence and the views of the four schools.",
      "There's no single 'clever' answer: respectful, curious questions lead to real understanding.",
      'Press 1–4 to pick a reply quickly.',
      'Where scholars differ, the card presents the views fairly — Muslims themselves vary in practice.',
      'The rulings are AI-prepared drafts awaiting review by qualified scholars.'
    ]
  },
  tipLabel: { ar: 'هل تعلم؟', en: 'Good to know' },
  creditsTitle: { ar: 'حقوق وشكر', en: 'Credits' },
  creditsIntro: { ar: 'بُنيت مشاهد اللعبة بنماذج ثلاثية الأبعاد وخامات من مبدعين يشاركون أعمالهم مجاناً. شكراً لهم.', en: "The game's scenes are built with 3D models and textures shared freely by their creators. Thank you." },
  creditsCcBy: { ar: 'نماذج برخصة CC-BY 3.0 (يلزم ذكر المؤلف)', en: 'Models licensed CC-BY 3.0 (attribution required)' },
  creditsCharacters: { ar: 'الشخصيات', en: 'Characters' },
  creditsCc0Title: { ar: 'شكر خاص (CC0)', en: 'Special thanks (CC0)' },
  creditsCc0: { ar: 'شكر خاص لـ Kenney وQuaternius وPoly Haven ولمؤلفي نماذج poly.pizza الذين أتاحوا أعمالهم ملكاً عاماً (CC0).', en: 'Special thanks to Kenney, Quaternius, Poly Haven and the poly.pizza authors who released their work into the public domain (CC0).' },
  creditsFontsTitle: { ar: 'الخطوط', en: 'Fonts' },
  creditsFonts: { ar: 'Amiri وAmiri Quran وIBM Plex Sans Arabic وReem Kufi — برخصة SIL Open Font License، عبر Google Fonts.', en: 'Amiri, Amiri Quran, IBM Plex Sans Arabic and Reem Kufi — SIL Open Font License, via Google Fonts.' }
};

for (const [k, v] of Object.entries(DEFAULTS)) if (!(k in STRINGS)) STRINGS[k] = v;

const PATHS = {
  skip: 'dialogue.skip', skipLine: 'dialogue.skip_line', narratorLabel: 'dialogue.narrator', choiceHint: 'dialogue.choice_hint',
  verdictLabel: 'ruling_card.verdict',
  expandSection: 'ruling_card.expand', collapseSection: 'ruling_card.collapse', externalLink: 'ruling_card.external_link',
  stopOf: 'transition.stop', loadingTitle: 'transition.loading_title', loadingTips: 'transition.loading_tips', tipLabel: 'transition.tip_label',
  creditsTitle: 'credits.title', creditsIntro: 'credits.intro', creditsCcBy: 'credits.cc_by', creditsCharacters: 'credits.characters',
  creditsCc0Title: 'credits.cc0_title', creditsCc0: 'credits.cc0', creditsFontsTitle: 'credits.fonts_title', creditsFonts: 'credits.fonts'
};
const getPath = (o, p) => p.split('.').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), o);

/** Apply overrides from the raw ui_strings.json object (content.js `uiStrings`). */
export function applyExtraUi(ui) {
  if (!ui || typeof ui !== 'object') return;
  for (const [key, path] of Object.entries(PATHS)) {
    const v = getPath(ui, path);
    if (v && typeof v === 'object' && ('ar' in v || 'en' in v)) STRINGS[key] = { ...STRINGS[key], ...v };
  }
}
