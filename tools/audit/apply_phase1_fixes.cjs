// One-off: applies the confirmed corrections of the phase-1 Sharia audit (2026-10-05) to content/rulings/*.json.
// Idempotent: re-running does not duplicate notes. Run: node tools/audit/apply_phase1_fixes.cjs
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', '..', 'content', 'rulings');
const TAG = '[تدقيق المرحلة 1 — 2026-10-05]';
const QUDAH = 'د. مائن خالد القضاة';

const files = {};
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) files[f] = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const get = id => { for (const a of Object.values(files)) { const r = a.find(x => x.id === id); if (r) return r; } throw new Error(id); };
const replaceDeep = (o, from, to) => {
  for (const k of Object.keys(o)) {
    if (typeof o[k] === 'string') o[k] = o[k].split(from).join(to);
    else if (o[k] && typeof o[k] === 'object') replaceDeep(o[k], from, to);
  }
};
const note = (r, text) => {
  const base = (r.notes_for_reviewer || '').split('\n\n' + TAG)[0];
  r.notes_for_reviewer = base + '\n\n' + TAG + ' ' + text;
};

// ---- 1. name of the AMJA mufti (Dr. Main Khalid Al-Qudah) — confirmed on amjaonline.org
for (const a of Object.values(files)) for (const r of a) {
  replaceDeep(r.contemporary || [], 'د. ماجد (Main) القضاة', QUDAH);
  replaceDeep(r.contemporary || [], 'د. منير/معين القضاة', QUDAH);
  replaceDeep(r.contemporary || [], 'مقالة د. معين القضاة', 'مقالة ' + QUDAH);
}

// ---- 2. home.credit_card: "late penalty = riba by agreement" was an overstatement
{
  const r = get('home.credit_card');
  r.summary.ar = 'دفع الفائدة على الدين ربا محرم باتفاق، وكذلك غرامة التأخير المالية المشروطة لصالح الدائن عند مجمع الفقه الإسلامي الدولي (القرار 51) وجمهور المعاصرين، مع خلاف معاصر في التعويض عن ضرر المماطلة وفي الغرامة التي تُصرف للخير. أما توقيع عقد بطاقة فيه شرط فائدة مع العزم على السداد في فترة السماح، فقد منعه مجمع الفقه الإسلامي الدولي (القرار 108)، وأجازه AMJA للمسلم في أمريكا للحاجة بشرط السداد الكامل دائماً. وتقسيط BNPL بلا فائدة جائز في أصله، ويبقى الإشكال في شرط غرامة التأخير.';
  r.summary.en = 'Paying interest on a debt is riba by agreement, and so is a stipulated monetary late penalty paid to the creditor according to the International Islamic Fiqh Academy (Resolution 51) and most contemporary scholars, though some contemporaries debate compensation for a solvent debtor\'s delay and penalties that are paid to charity. Signing a card agreement that contains an interest clause while intending to pay within the grace period was prohibited by the International Islamic Fiqh Academy (Resolution 108), but AMJA permitted it for Muslims in the US due to need, provided the balance is always paid in full. Interest-free BNPL installments are permissible in principle; the problem is the late-fee clause.';
  note(r, 'صُحّح الملخص: عبارة «غرامة التأخير المشروطة ربا باتفاق» تعميم غير دقيق؛ فالمنع قول المجمع (القرار 51) والجمهور، وفي المسألة خلاف معاصر معروف (التعويض عن ضرر المماطلة عند بعض المعاصرين، والتزام التصدق بغرامة التأخير في معايير AAOIFI). يُستحسن أن يضيف المراجع مرجعاً لهذا الخلاف. تعارض مع السيناريو: الخيار c (بطاقة ائتمان مع سداد تلقائي) موسوم best والخيار b (بطاقة خصم) acceptable، بينما الحكم «disputed» والإرشاد العملي يقدّم بطاقة الخصم لأنها «بلا شبهة» — انظر docs/audit/phase1_audit.md. نجحت الفحوص الآلية.');
  r.review_status = 'ai_verified';
}

// ---- 3. private_events.neighbor_funeral: Hanbali relied-upon view confirmed (prohibition)
{
  const r = get('private_events.neighbor_funeral');
  r.madhahib.hanbali.position_ar = 'توقف الإمام أحمد في تعزية أهل الذمة، وفيها عنه روايات. وخرّجها ابن قدامة على عيادتهم وفيها روايتان: المنع، والجواز لحديث عيادة الغلام اليهودي «فعلى هذا نعزيهم». والمذهب عند متأخري الحنابلة تحريم تعزيتهم وتهنئتهم وعيادتهم (الإنصاف، والإقناع وشرحه كشاف القناع: «ويحرم تهنئتهم وتعزيتهم وعيادتهم»)، وعن أحمد رواية بالكراهة، واختار ابن تيمية جوازها للمصلحة كرجاء الإسلام.';
  r.madhahib.hanbali.position_en = 'Imam Ahmad withheld judgment, and several reports are transmitted from him. Ibn Qudama derived the issue from visiting them, on which there are two narrations: prohibition, and permission based on the Jewish boy hadith ("accordingly we console them"). The relied-upon position of the later Hanbali school is that consoling, congratulating and visiting them is prohibited (al-Insaf; al-Iqna\' with Kashshaf al-Qina\': "it is prohibited to congratulate, console or visit them"), with another report of mere dislike, while Ibn Taymiyya allowed it when there is a benefit such as hope of their Islam.';
  r.madhahib.hanbali.reference = 'المغني لابن قدامة (3/486 ط. التركي؛ 2/406 ط. أخرى)؛ الإنصاف للمرداوي، باب أحكام أهل الذمة؛ كشاف القناع للبهوتي، باب أحكام أهل الذمة («ويحرم تهنئتهم وتعزيتهم وعيادتهم») — النص مؤكَّد عبر نتائج بحث (shamela/dorar)، والجزء والصفحة يحتاجان مطابقة';
  r.summary.ar = r.summary.ar.replace('(الحنفية والمالكية والشافعية ورواية عن أحمد)', '(الحنفية والمالكية والشافعية ورواية عن أحمد، والمعتمد عند متأخري الحنابلة المنع)');
  r.summary.en = r.summary.en.replace('(Hanafi, Maliki, Shafi\'i and one narration from Ahmad)', '(Hanafi, Maliki, Shafi\'i and one narration from Ahmad; the later Hanbali relied-upon view prohibits it)');
  note(r, 'أُكّد أن المعتمد عند متأخري الحنابلة تحريم تعزية الكافر («ويحرم تهنئتهم وتعزيتهم وعيادتهم» — الإقناع/كشاف القناع، والإنصاف) فأُزيل وصف «لم نتحقق» وأُضيف ذلك إلى الملخص توازناً. فتوى AMJA 78565 تحققتُ منها مباشرة (د. مائن خالد القضاة، 14/4/2009) وصُحّح اسم المفتي. الحكم «mubah» يمثل قول الجمهور؛ للمراجع أن ينظر هل «disputed» أدق. نجحت الفحوص الآلية.');
  r.review_status = 'ai_verified';
}

// ---- 4. home.food_ingredients: AMJA document is the 9th conference (verified by reading the PDF)
{
  const r = get('home.food_ingredients');
  const c = r.contemporary.find(x => /AMJA/.test(x.body));
  c.decision_ref = 'قرارات وتوصيات المؤتمر السنوي التاسع لمجمع فقهاء الشريعة بأمريكا: الأطعمة والأدوية المباحة والمحرمة في غير بلاد المسلمين (اسم ملف الموقع «13th»)';
  note(r, 'تحققتُ من نص وثيقة AMJA (قراءة PDF): عنوانها «المؤتمر السنوي التاسع»، وفيها حرفياً تحريم أبقار وأغنام المسالخ الأمريكية لقوة الشبهة والترخيص في الدواجن مع استحباب التورع، والجيلاتين والكحول كما لُخّص — فصُحّح decision_ref. وتحققتُ من قرار المجمع 210 (6/22) الكويت مارس 2015: المنع من الأطعمة المحتوية على خمر ولو قليلاً، وجواز الكحول المذيب لعموم البلوى، وإرجاء الجيلاتين — مطابق. يبقى ai_draft لأن تنزيل القرار على «خلاصة الفانيليا» (كحول بنسبة كبيرة يضيفه المستهلك) اجتهاد من الباحث، ولأن أقوال المذاهب في الاستحالة والتسمية منقولة من مراجع ثانوية (الجزيري، تيسير التفسير) — يحتاج عالماً.');
}

// ---- 5. home.mortgage: AMJA 2014 tiers verified; two permissible providers were omitted
{
  const r = get('home.mortgage');
  const c = r.contemporary.find(x => /AMJA/.test(x.body));
  c.position_ar = c.position_ar.replace('(Ameen Housing بعد تعديل عقودها)', '(Ameen Housing بعد تعديل عقودها في يناير 2015، وMubarak Mortgage وNeeyah)');
  c.position_en = c.position_en.replace('(Ameen Housing, after amending its contracts)', '(Ameen Housing after amending its contracts in January 2015, plus Mubarak Mortgage and Neeyah)');
  note(r, 'تحققتُ مباشرة من قرار AMJA (هيوستن 15-17 سبتمبر 2014): التصنيف مطابق (Guidance: يجوز للحاجة؛ Devon Bank بعقديه وUIF: للحاجة الشديدة؛ LARIBA وIjara Loan: لا يجوز؛ Ameen Housing: جائز بعد تعديل يناير 2015)، وأُضيفت شركتان صنّفهما القرار جائزتين (Mubarak Mortgage، Neeyah). أرقام قرارات المجمع 10 (10/2)، 50 (1/6)، 40-41 (2/5، 3/5)، 136 (2/15) صحيحة. ملاحظات الباحث بشأن المراجع المذهبية الثانوية (islamqa/askimam) ما تزال قائمة لكنها لا تمس الحكم المجمع عليه. نجحت الفحوص الآلية.');
  r.review_status = 'ai_verified';
}

// ---- 6. status + audit notes for the rest
const verified = {
  'work.retirement_401k': 'المحتوى منسجم: قرار المجمع 63 (1/7) صحيح الرقم والمضمون، ونسب AAOIFI (30% ديون/ودائع ربوية من القيمة السوقية، 5% إيراد محرم) هي المعتمدة في التطبيقات. تنبيه للمراجع: الإرشاد «إن اضطررت إلى صندوق مؤشر عام مؤقتاً... طهّر الأرباح» ترخيص يستند إلى فتوى مفتٍ واحد في AMJA ويخالف أصل قرار المجمع 63؛ يحسن أن يُصاغ بوصفه قولاً لا توجيهاً عاماً. نجحت الفحوص الآلية.',
  'work.honesty_gifts': 'الحكم والأدلة متينة (حديث ابن اللتبية، عدي بن عميرة، بريدة). الإحالات المذهبية في هدية العامل منقولة عن نتائج بحث — يُستحسن توثيقها من الموسوعة الكويتية (مادة «هدية»/«رشوة»). نجحت الفحوص الآلية.',
  'school.cheating': 'لا ملاحظات جوهرية؛ أقوال المذاهب عبر الموسوعة الكويتية مقبولة وفق العقد، ومسألة الذكاء الاصطناعي مخرّجة تخريجاً سليماً مع ربطها بشرط الأستاذ. نجحت الفحوص الآلية.',
  'school.student_loan': 'صُحّح اسم المفتي في decision_ref إلى «د. مائن خالد القضاة» (مؤكَّد من موقع AMJA). الحكم منسجم مع الأدلة وعرض قول الحاجة عند AMJA أمين. تنبيه قانوني للمراجع: شروط القرض المدعوم (Direct Subsidized) ودعم فائدة فترة السماح قد تتغير بتشريعات 2025-2026؛ يُتحقق من studentaid.gov قبل النشر. نجحت الفحوص الآلية.',
  'school.mixed_social': 'حديث معقل بن يسار (خارج الكتب الستة) تحققتُ من لفظه وأحكام الألباني (صحيح الجامع 5045، الصحيحة 226) يدوياً؛ رمز السيوطي بالضعف لم أتحقق منه. عرض الخلاف في المصافحة أمين (استثناء الحنفية والحنابلة للعجوز، وقول القرضاوي). نجحت الفحوص الآلية.',
  'street.lost_wallet': 'أقوال المذاهب الأربعة في اللقطة منقولة من الموسوعة الكويتية ومطابقة للمشهور. ملاحظة: معلومة قانون أوهايو (ORC 737.29 وما بعدها تنظم المفقودات لدى الشرطة) تحتاج مراجعة قانونية. نجحت الفحوص الآلية.',
  'street.lottery': 'قرار المجمع 127 صحيح (الموقع العربي يرقّمه (14/1) والإنجليزي (1/14)). تحقق: المراهنات الرياضية قانونية في أوهايو منذ 1/1/2023 (صحيح). تنبيه: الملخص يقول «المسابقات المجانية ليست قماراً»، والسيناريو يسم «الرهان المجاني» في تطبيق مراهنات بـ wrong ويحيل إلى البطاقة — يُستحسن إضافة جملة صريحة في الحكم عن «الرهانات المجانية الترويجية» في تطبيقات القمار (ذريعة إلى الإيداع، وتسجيل في منصة قمار). الخط الوطني الصحيح للمساعدة: 1-800-GAMBLER (أو 1-800-522-4700) وخط أوهايو 1-800-589-9966 — للمراجع. نجحت الفحوص الآلية.',
  'street.buying_selling': 'لا ملاحظات جوهرية؛ أقوال المذاهب في الغبن والعيب مطابقة للموسوعة الكويتية. قاعدة FTC بحظر التقييمات المزيفة صدرت في أغسطس 2024 (صحيح). نجحت الفحوص الآلية.',
  'public_events.holiday_greetings': 'صُحّح اسم المفتي في decision_ref إلى «د. مائن خالد القضاة». عرض الخلاف متوازن (ابن القيم/العثيمين مقابل المجلس الأوروبي/FCNA). نص الشربيني «ويعزر من وافق الكفار في أعيادهم... ومن هنأه بعيده» معروف في مغني المحتاج (باب الجزية) لكن لم يُطابق الجزء والصفحة. نجحت الفحوص الآلية.',
  'public_events.alcohol_table': 'الحكم منسجم مع نصوص المذاهب في الوليمة ذات المنكر، ودرجة حديث الترمذي 2801 معروضة بأمانة (الألباني: حسن؛ بشار عواد وزبير علي زئي: ضعيف — بحسب hadith-api). نجحت الفحوص الآلية.',
  'public_events.raffle': 'نص القرار 127 مطابق للموقع الرسمي (الموقع العربي يكتب الرقم (14/1) والإنجليزي (1/14)، فكلا الترقيمين وارد). نجحت الفحوص الآلية.',
};
for (const [id, t] of Object.entries(verified)) { const r = get(id); note(r, t); r.review_status = 'ai_verified'; }

const drafts = {
  'work.alcohol_pork_job': 'يبقى ai_draft: (1) السؤال يشمل تقديم لحم الخنزير لكن الحكم والإرشاد يركزان على الخمر؛ يلزم بيان صريح لحكم تقديم الخنزير لغير المسلم وأجرته (الخلاف بين الجمهور والحنفية في بيع الخنزير لغير المسلم/خدمته). (2) قولا المالكية والشافعية منقولان عن المغني لا من كتبهما. (3) فتوى AMJA المذكورة في «مجالسة» من يقدّمون المحرم لا في «العمل» لديهم — صلتها بالمسألة غير مباشرة. وصف «تطبيق مصنع الجعة» في السيناريو (صفحة «اطلب برميلاً» وزر «أضف إلى السلة») هو صورة الإعانة القريبة على البيع، وهي أقوى من الصورة التي أجازها SeekersGuidance — انظر التقرير.',
  'private_events.wedding': 'يبقى ai_draft: (1) نسبة «إجابة الدعوة سنة عند كثير من الحنفية» و«الدف يكره تحريماً للرجال» عند الحنفية لم تُتحقق من نص معتمد. (2) فتوى دار الإفتاء المصرية 11981 في الموسيقى لم أفتحها. (3) تعارض مع السيناريو: الخيار b (البقاء حتى النهاية مع رقص مختلط وشرب في الموقف) موسوم acceptable، بينما ينص الحكم وأقوال المذاهب على الانصراف عند منكر لا يُقدر على تغييره. الأحاديث كلها اجتازت الفحص الآلي.',
  'private_events.gifts_birthday': 'تحققتُ من فتوى AMJA 22801 (د. صلاح الصاوي، 6/8/2007: لا يجوز الاحتفال بأعياد الميلاد ولا إجابة الدعوة إليها) ومن نص حديث المقوقس عند الهيثمي (مجمع الزوائد 4/155) ومن «تهادوا تحابوا» (الأدب المفرد 594) يدوياً. صُحّح اسم المفتي «د. مائن خالد القضاة». يبقى ai_draft لأن خانات المذاهب عامة بلا نص معتمد في قبول هدية غير المسلم (يُقترح شرح السير الكبير للسرخسي والمغني)، ولأن صياغة السيناريو للخيار best («keep the wine for yourself — I know it\'s your favorite!») قد تُفهم إقراراً بشرب الخمر — انظر التقرير.',
};
for (const [id, t] of Object.entries(drafts)) { const r = get(id); note(r, t); r.review_status = 'ai_draft'; }

for (const [f, a] of Object.entries(files)) fs.writeFileSync(path.join(DIR, f), JSON.stringify(a, null, 2) + '\n');
console.log('done');
