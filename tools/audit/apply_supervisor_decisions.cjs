// Supervisor decisions on the pivot audit (2026-10-05). Re-runnable (idempotent).
//  (1) [withdrawn 2026-10-06 — common_ground no longer carries any scriptural text]
//  (2) Reword `question` (AR+EN) in 9 rulings neutrally for a Christian learner (never addressing Adam as the Muslim),
//      and fix practical_guidance wording only where it addressed Adam as the Muslim (school.student_loan) — substance unchanged.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'content', 'rulings');

// ---- (1) withdrawn: superseded by the project-owner decision of 2026-10-06 (no scriptural texts or references;
//          see apply_no_scripture.cjs). Nothing is written to common_ground_data.json here any more.

// ---- (2) neutral questions + one practical_guidance wording fix
const Q = {
  'private_events.wedding': {
    ar: 'ماذا يعلّم الإسلام عن الزواج وحفله: ما الواجب في المهر والوليمة؟ وهل يجوز الدف والغناء؟ وما حكم المعازف (فرقة موسيقية/DJ)؟ وماذا يفعل المسلم المدعو إن كان في الحفل منكرات كالخمر أو الاختلاط الماجن؟',
    en: 'What does Islam teach about a wedding and its celebration: what is required regarding mahr and walima? Are the daff and singing allowed? What about musical instruments (a band/DJ)? And what should a Muslim guest do if the party includes wrongdoing such as alcohol or indecent mixing?',
  },
  'private_events.neighbor_funeral': {
    ar: 'إذا توفي جار غير مسلم، فهل يجوز للمسلم أن يعزّي أسرته؟ وهل يحضر الجنازة في الكنيسة أو المقبرة؟ وبماذا يدعو؟',
    en: 'When a non-Muslim neighbor dies, may a Muslim console the family? May he attend the funeral at the church or cemetery? And what may he pray?',
  },
  'private_events.gifts_birthday': {
    ar: 'هل يجوز للمسلم أن يقبل هدية من زميل أو جار غير مسلم، ولو كانت فيها زجاجة نبيذ؟ وماذا يفعل بالنبيذ؟ وهل يحضر حفل عيد ميلاد طفل جاره؟',
    en: 'May a Muslim accept a gift from a non-Muslim coworker or neighbor, even one that includes a bottle of wine? What should he do with the wine? And may he attend a neighbor\'s child\'s birthday party?',
  },
  'public_events.holiday_greetings': {
    ar: 'هل يجوز للمسلم أن يهنئ زملاءه بالكريسماس، وأن يحضر حفل نهاية العام في العمل، وأن يشارك في تبادل الهدايا، وأن يجلس مع أسرة صديقه على عشاء عيد الشكر؟',
    en: 'May a Muslim wish coworkers "Merry Christmas", attend the end-of-year office party, join the gift exchange, and sit with a friend\'s family for Thanksgiving dinner?',
  },
  'public_events.alcohol_table': {
    ar: 'ماذا يعلّم الإسلام عن الجلوس إلى طاولة يُصبّ عليها النبيذ والبيرة في حفل الشركة؟ وما البديل المقبول الذي يحفظ للمسلم علاقته بفريقه؟',
    en: 'What does Islam teach about sitting at a company-party table where wine and beer are being poured, and what acceptable alternative lets a Muslim keep good relations with the team?',
  },
  'school.student_loan': {
    ar: 'هل يجوز للمسلم أن يأخذ قرضاً طلابياً فيدرالياً بفائدة ليكمل دراسته؟ وما البدائل المشروعة؟',
    en: 'Is it permissible for a Muslim to take an interest-bearing federal student loan to finish his studies? What are the lawful alternatives?',
  },
  'school.mixed_social': {
    ar: 'ماذا يعلّم الإسلام عن التعامل بين الرجال والنساء في مجموعة الدراسة؟ وما حكم الخلوة بزميل أو زميلة؟ وهل يصافح المسلم أستاذته إذا مدّت يدها؟',
    en: 'What does Islam teach about men and women interacting in a study group? What is the ruling on being alone with a classmate of the opposite sex? Should a Muslim shake a female professor\'s hand if she extends it?',
  },
  'street.lost_wallet': {
    ar: 'إذا وجد المسلم محفظة فيها نقود وبطاقات وهوية صاحبها، فماذا يجب عليه؟ وما حكم تملّكها إن لم يظهر صاحبها؟',
    en: 'If a Muslim finds a wallet containing cash, cards and the owner\'s ID, what must he do, and may he keep it if the owner never appears?',
  },
  'street.buying_selling': {
    ar: 'هل يلزم المسلمَ الذي يبيع سلعة مستعملة فيها عيب (كبطارية هاتف ضعيفة) أن يبيّنه؟ وما حكم الغبن في السعر، والإكرامية (tip)، وكتابة تقييم كاذب لمتجر صديق مقابل خصم؟',
    en: 'Must a Muslim selling a used item with a defect (such as a weak phone battery) disclose it? And what about overcharging, tipping, and writing a fake review for a friend\'s store in exchange for a discount?',
  },
};
const PG = { // [rulingId, lang, from, to]
  fixes: [
    ['school.student_loan', 'ar', 'وهو مهم لآدم لأنه موظف.', 'وهو مهم خاصة للطالب الذي يعمل.'],
    ['school.student_loan', 'en', 'especially relevant for Adam as an employee.', 'especially relevant for students who are also employed.'],
  ],
};
let changed = 0;
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json'))) {
  const file = path.join(DIR, f);
  const before = fs.readFileSync(file, 'utf8');
  const arr = JSON.parse(before);
  for (const r of arr) {
    if (Q[r.id]) r.question = { ar: Q[r.id].ar, en: Q[r.id].en };
    for (const [id, lang, from, to] of PG.fixes) if (r.id === id) {
      r.practical_guidance[lang] = r.practical_guidance[lang].map(s => s.replace(from, to));
      if (!r.practical_guidance[lang].some(s => s.includes(to))) throw new Error(`${id} ${lang}: practical_guidance fix not applied`);
    }
  }
  const after = JSON.stringify(arr, null, 2) + (before.endsWith('\n') ? '\n' : '');
  if (after !== before) { fs.writeFileSync(file, after); changed++; }
}
// any remaining reference to Adam in ruling legacy fields?
const left = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json')))
  for (const r of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
    for (const k of ['title', 'question', 'summary', 'practical_guidance', 'halal_alternatives', 'refer_to_scholar_when'])
      if (/Adam|آدم/.test(JSON.stringify(r[k]))) left.push(`${r.id}.${k}`);
console.log(`ruling files written: ${changed}; remaining Adam references in legacy fields: ${left.length ? left.join(', ') : 'none'}`);
