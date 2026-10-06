// Engine-only TEST FIXTURES. Used ONLY when real files under content/ are missing,
// so the game stays playable end-to-end while content agents are still writing.
// Every string is marked [FIXTURE] / [بيانات اختبار] and the UI shows a fixture badge.
import { CATALOG, LOCATIONS, LOCATION_TITLES } from '../config.js';
import sampleRulings from './sample-ruling.json';

const TIMES = { home: '07:00', work: '10:00', school: '14:00', street: '17:30', public_events: '19:00', private_events: '21:00' };

function fixtureScript(location, idx) {
  const situations = CATALOG.filter((c) => c.location === location).map((c, i) => ({
    ruling_id: c.id,
    hotspot: `spot_${i + 1}`,
    npc: { id: `npc_${i + 1}`, name: { ar: `شخصية ${i + 1}`, en: `Character ${i + 1}` }, role: { ar: 'بيانات اختبار', en: 'fixture' } },
    setup: { ar: `[بيانات اختبار] موقف: ${c.title.ar}`, en: `[FIXTURE] Situation: ${c.title.en}` },
    dialogue: [
      { speaker: `npc_${i + 1}`, ar: '[بيانات اختبار] سطر حوار تجريبي من الشخصية.', en: '[FIXTURE] A placeholder dialogue line from the character.' },
      { speaker: 'adam', ar: '[بيانات اختبار] رد آدم التجريبي.', en: "[FIXTURE] Adam's placeholder reply." },
      { speaker: 'narrator', ar: '[بيانات اختبار] الراوي يصف المشهد.', en: '[FIXTURE] The narrator describes the scene.' }
    ],
    choices: [
      { id: 'a', label: { ar: '[اختبار] الخيار الأفضل', en: '[fixture] Best option' }, quality: 'best', consequence: { ar: '[اختبار] نتيجة الخيار الأفضل.', en: '[fixture] Consequence of the best option.' }, points: 10 },
      { id: 'b', label: { ar: '[اختبار] خيار مقبول', en: '[fixture] Acceptable option' }, quality: 'acceptable', consequence: { ar: '[اختبار] نتيجة مقبولة.', en: '[fixture] Acceptable consequence.' }, points: 5 },
      { id: 'c', label: { ar: '[اختبار] خيار خاطئ', en: '[fixture] Wrong option' }, quality: 'wrong', consequence: { ar: '[اختبار] نتيجة خاطئة.', en: '[fixture] Wrong consequence.' }, points: 0 }
    ],
    check_question: {
      q: { ar: '[اختبار] سؤال تثبيت تجريبي؟', en: '[fixture] Placeholder check question?' },
      options: [
        { ar: '[اختبار] الإجابة الصحيحة', en: '[fixture] Correct answer', correct: true },
        { ar: '[اختبار] إجابة خاطئة', en: '[fixture] Wrong answer', correct: false }
      ]
    }
  }));
  return {
    location,
    title: LOCATION_TITLES[location],
    time_of_day: TIMES[location],
    intro: { ar: `[بيانات اختبار] مقدمة محطة «${LOCATION_TITLES[location].ar}».`, en: `[FIXTURE] Intro for the "${LOCATION_TITLES[location].en}" stop.` },
    situations,
    outro: { ar: '[بيانات اختبار] خاتمة المحطة.', en: '[FIXTURE] Outro for this stop.' },
    next_location: LOCATIONS[idx + 1] || null,
    _fixture: true
  };
}

export const fixtureScripts = Object.fromEntries(LOCATIONS.map((l, i) => [l, fixtureScript(l, i)]));
export const fixtureRulings = Object.fromEntries(sampleRulings.map((r) => [r.id, r]));
