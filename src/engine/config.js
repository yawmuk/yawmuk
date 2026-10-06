// Static game configuration shared by the engine. Content (rulings / script) is NOT here.

export const LOCATIONS = ['home', 'work', 'school', 'street', 'public_events', 'private_events'];

export const LOCATION_TITLES = {
  home: { ar: 'المنزل', en: 'Home' },
  work: { ar: 'العمل', en: 'Work' },
  school: { ar: 'الكلية', en: 'College' },
  street: { ar: 'الشارع', en: 'Street' },
  public_events: { ar: 'مناسبات عامة', en: 'Public events' },
  private_events: { ar: 'مناسبات خاصة', en: 'Private events' },
  // places without situations (the walkable hub and free-to-visit buildings)
  town: { ar: 'الحيّ', en: 'The neighbourhood' },
  mosque: { ar: 'المسجد', en: 'Mosque' },
  bank: { ar: 'البنك الإسلامي', en: 'Islamic bank' }
};

// The walkable hub and the buildings that carry no situations (no script, never part of the journey order).
// LOCATIONS above stays the 6 journey stops (planner order, catalog, tests); PLACES are reachable from the hub.
export const HUB = 'town';

// Global look (key art: public/brand/imagery/keyart-town-golden-hour.jpg). 'golden' = every scene uses the
// golden-hour light preset and ignores its own sky/fog colours; only a scene that explicitly asks for 'night'
// (the winter-night street) keeps it. The town adds the golden sky backdrop. Set to null to restore the
// per-scene presets (day/evening/night by the script's time of day) and the old flat sky.
export const LIGHTING = 'golden';
export const PLACES = [HUB, 'mosque', 'bank'];
/** Every scene the player can be in: the 6 journey stops + the hub + free places. */
export const ALL_LOCATIONS = [...LOCATIONS, ...PLACES];
export const isPlace = (loc) => PLACES.includes(loc);

// Situation catalog from docs/TEAM_BRIEF.md: the 7 situations chosen by the team lead (2026-10-06).
export const CATALOG = [
  ['home.purity_mosque', 'الطهارة والمسجد: الوضوء وخلع الحذاء', 'Purity and the mosque: wudu and shoes'],
  ['work.amulet', 'العقيدة: رفض تميمة الحظ والتوكل على الله', 'Belief: declining a lucky charm, trusting God'],
  ['work.hijab', 'الحجاب: الاحترام والتكريم في العمل', 'Hijab: respect and dignity at work'],
  ['school.pork', 'أكل الخنزير: الامتناع طاعةً لله', 'Pork: abstaining in obedience to God'],
  ['street.lottery', 'القمار واليانصيب: حفظ المجتمع', 'Gambling and the lottery: protecting society'],
  ['public_events.alcohol_table', 'شرب الخمر: نخب الحفل وحفظ العقل', 'Alcohol: the party toast and protecting the mind'],
  ['private_events.proposal', 'إجراءات الزواج: الخطبة والولي والمهر', 'Marriage: the proposal, the guardian and the mahr']
].map(([id, ar, en]) => ({ id, location: id.split('.')[0], title: { ar, en } }));

export const VERDICTS = {
  haram: { ar: 'حرام', en: 'Haram (forbidden)', color: '#c0392b' },
  makruh: { ar: 'مكروه', en: 'Makruh (disliked)', color: '#d35400' },
  mubah: { ar: 'مباح', en: 'Mubah (permissible)', color: '#2e8b57' },
  halal: { ar: 'حلال', en: 'Halal (permitted)', color: '#1e8449' },
  mustahab: { ar: 'مستحب', en: 'Mustahab (recommended)', color: '#138d75' },
  wajib: { ar: 'واجب', en: 'Wajib (obligatory)', color: '#1f618d' },
  disputed: { ar: 'مختلف فيه', en: 'Disputed among scholars', color: '#b7950b' },
  depends: { ar: 'يختلف بحسب الحال', en: 'Depends on the case', color: '#2874a6' },
  unknown: { ar: 'قيد الإعداد', en: 'Pending', color: '#5d6d7e' }
};

export const QUALITY = {
  best: { ar: 'الخيار الأفضل', en: 'Best choice', color: '#1e8449' },
  acceptable: { ar: 'مقبول', en: 'Acceptable', color: '#b7950b' },
  wrong: { ar: 'خيار خاطئ', en: 'Wrong choice', color: '#c0392b' }
};

export const CHECK_BONUS = 5; // points for answering the check question correctly
export const STORAGE_KEY = 'yawmuk.progress.v1';

// Topic categories used by the end screen to suggest a next topic (themes cut across locations).
export const THEMES = {
  money: { nextTopic: 3, ar: 'المال والمجتمع', en: 'Money & society', ids: ['street.lottery'] },
  food: { nextTopic: 0, ar: 'الطعام والشراب', en: 'Food & drink', ids: ['school.pork', 'public_events.alcohol_table'] },
  honesty: { nextTopic: 1, ar: 'العقيدة والعبادة', en: 'Belief & worship', ids: ['work.amulet', 'home.purity_mosque'] },
  social: { nextTopic: 2, ar: 'الأسرة والكرامة', en: 'Family & dignity', ids: ['work.hijab', 'private_events.proposal'] }
};

// ---------------------------------------------------------------- context picker (start screen; optional, never asks belief)
// Topics the player may pick. Each maps onto situation ids (built from THEMES above + a few cross-cutting picks).
export const TOPICS = {
  money: { ar: 'المال', en: 'Money', ids: THEMES.money.ids },
  food: { ar: 'الطعام', en: 'Food', ids: THEMES.food.ids },
  work: { ar: 'العمل', en: 'At work', ids: ['work.amulet', 'work.hijab'] },
  social: { ar: 'العلاقات', en: 'Relationships', ids: THEMES.social.ids },
  celebrations: { ar: 'المناسبات', en: 'Celebrations', ids: ['public_events.alcohol_table', 'private_events.proposal'] }
};
// Day types: the locations such a day naturally starts with (a light ordering hint only).
export const DAY_TYPES = {
  office: { ar: 'يوم عمل', en: 'Office day', locations: ['work', 'street'] },
  student: { ar: 'يوم دراسة', en: 'Student day', locations: ['school', 'street'] },
  weekend: { ar: 'عطلة نهاية الأسبوع', en: 'Weekend', locations: ['home', 'public_events', 'private_events'] }
};

// ---------------------------------------------------------------- the player character
// Single place to change how Adam looks. Any makeNPC(look) option works (see src/engine/README.md):
// skin, shirt, pants, shoes, hair (false = bald), beard, glasses, suit, tie, kufi, height, build…
export const PLAYER = {
  name: { ar: 'آدم', en: 'Adam' }, // Adam Reed — character notes: docs/story_bible.md
  look: {
    skin: '#e8c4a0',
    hair: '#5a3b24',   // short brown hair
    beard: false,      // clean-shaven
    kufi: false,
    shirt: '#2f4a6d',  // navy shirt
    pants: '#5b6270',  // grey jeans
    shoes: '#6b4a2f',  // brown shoes
    glasses: false,
    height: 1.78,
    build: 1
  }
};
// A scene may return `playerLook: { suit: '#1f2d4d', … }` — it is merged over PLAYER.look for that scene only.
