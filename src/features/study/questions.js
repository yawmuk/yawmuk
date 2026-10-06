// The micro-study's 5-item concept test. Copied VERBATIM from the reviewed `check_question` of five situations in
// content/script/*.json — no new religious text is written here. Each item cites its ruling_id; `correct` is the index
// of the option flagged correct in the source. tests/study.test.mjs fails if any item drifts from its source.
// Concepts (the 7-situation catalog): tawhid (amulets), maysir (gambling), tahara (purity), food (pork), marriage (wali/mahr).
// Every item also offers "I don't know" (value -1, scored incorrect) to reduce guessing.
// Pure module (no DOM, no CSS): imported by the browser UI and by netlify/functions/study.mjs for server-side scoring.

export const ITEMS = 
[
  {
    "id": "tawhid",
    "ruling_id": "work.amulet",
    "q": {
      "ar": "لماذا رفض سمير تَمِيمَة الحظ؟",
      "en": "Why did Samir turn down the lucky charm?"
    },
    "options": [
      {
        "ar": "لأنه لا يحب الإكسسوارات",
        "en": "Because he doesn't like accessories"
      },
      {
        "ar": "لأن المسلم يؤمن أن النفع والضرر بيد الله وحده، فيجتهد ثم يتوكَّل عليه",
        "en": "Because a Muslim believes benefit and harm are in God's hands alone, so he works hard and relies on Him"
      },
      {
        "ar": "لأنه لا يريد الترقية",
        "en": "Because he doesn't want the promotion"
      }
    ],
    "correct": 1
  },
  {
    "id": "maysir",
    "ruling_id": "street.lottery",
    "q": {
      "ar": "لماذا يتجنب المسلمون اليانصيب والمراهنات؟",
      "en": "Why do Muslims avoid lotteries and betting?"
    },
    "options": [
      {
        "ar": "لأنها قمار: دفع مال مقابل احتمال ربح أو خسارة يتوقف على الحظ، وهو محرم في الإسلام",
        "en": "Because it's gambling: paying money for a chance to win or lose based on luck, which Islam prohibits"
      },
      {
        "ar": "لأنها تُباع في محطات الوقود",
        "en": "Because they're sold at gas stations"
      },
      {
        "ar": "لأن المسلمين لا يحبون الرياضة",
        "en": "Because Muslims don't like sports"
      }
    ],
    "correct": 0
  },
  {
    "id": "tahara",
    "ruling_id": "home.purity_mosque",
    "q": {
      "ar": "ما علاقة الوُضُوء بالصلاة عند المسلمين؟",
      "en": "How is wudu related to prayer for Muslims?"
    },
    "options": [
      {
        "ar": "عادةٌ ثقافية لا علاقة لها بالصلاة",
        "en": "It's a cultural habit with no link to prayer"
      },
      {
        "ar": "الوُضُوء شرطٌ لصحة الصلاة، فلا تصحّ الصلاة بدونه",
        "en": "Wudu is a condition of prayer: without it, the prayer isn't valid"
      },
      {
        "ar": "خلع الحذاء عند باب المسجد يُغني عن الوُضُوء",
        "en": "Taking off your shoes at the mosque door replaces wudu"
      }
    ],
    "correct": 1
  },
  {
    "id": "food",
    "ruling_id": "school.pork",
    "q": {
      "ar": "لماذا رفضت نور شطيرة الخِنْزِير مع أنها مجانية وشهيّة؟",
      "en": "Why did Noor turn down the ham sandwich, even though it was free and tasty?"
    },
    "options": [
      {
        "ar": "لأنها لا تحبّ طعم اللحم",
        "en": "Because she doesn't like the taste of meat"
      },
      {
        "ar": "لأن أكل الخِنْزِير محرّمٌ في الإسلام، والمسلم يتركه طاعةً لله حتى حين يكون متاحاً",
        "en": "Because eating pork is prohibited in Islam, and a Muslim leaves it to obey God even when it's right there"
      },
      {
        "ar": "لأن المسلمين لا يأكلون مع غير المسلمين",
        "en": "Because Muslims don't eat with non-Muslims"
      }
    ],
    "correct": 1
  },
  {
    "id": "marriage",
    "ruling_id": "private_events.proposal",
    "q": {
      "ar": "أيُّ عبارةٍ صحيحة عن الزواج في الإسلام؟",
      "en": "Which statement about marriage in Islam is correct?"
    },
    "options": [
      {
        "ar": "المَهْر مالٌ يدفعه أهل العروس إلى العريس",
        "en": "The mahr is money the bride's family pays to the groom"
      },
      {
        "ar": "المسلمة لا تتزوّج إلا مسلمًا بإجماع العلماء، والمَهْر حقٌّ لها وحدها",
        "en": "By scholarly consensus a Muslim woman marries only a Muslim man, and the mahr belongs to her alone"
      },
      {
        "ar": "الوَلِيّ يأخذ المَهْر لنفسه مقابل موافقته",
        "en": "The wali keeps the mahr for himself in return for his consent"
      }
    ],
    "correct": 1
  }
];

export const DONT_KNOW = { ar: 'لا أعرف', en: "I don't know" };

/** Pre-test shows ITEMS in this order; the post-test uses a fixed rotation (same concepts, different order). */
export const PRE_ORDER = [0, 1, 2, 3, 4];
export const POST_ORDER = [3, 0, 4, 1, 2];

/** answers: map itemId -> option index (or -1 = "I don't know"). Returns the number correct (0..5). */
export function scoreAnswers(answers) {
  if (!answers || typeof answers !== 'object') return 0;
  let n = 0;
  for (const it of ITEMS) if (answers[it.id] === it.correct) n += 1;
  return n;
}

/** Keeps only the 5 known item ids with an in-range integer (or -1). Returns null unless all 5 are answered. */
export function cleanAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const out = {};
  for (const it of ITEMS) {
    const v = answers[it.id];
    if (!Number.isInteger(v) || v < -1 || v >= it.options.length) return null;
    out[it.id] = v;
  }
  return out;
}
