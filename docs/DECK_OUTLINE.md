# «يومك» Yawmuk — مخطط العرض التقديمي · Deck outline

> For the required PDF/PowerPoint deck (participant guide p. 14 and 31: problem, solution, how it works, added value, technologies with a detailed AI explanation, screenshots, results, continuity plan). Arabic is primary, English secondary. `{{…}}` = numbers to refresh from the repo right before exporting (commands given next to each).
>
> Suggested length: 12 slides. Brand: lantern-glass dark navy + brass (as in the game UI), Arabic font IBM Plex Sans Arabic / Reem Kufi for titles.

---

## 1 · الغلاف · Cover

- **«يومك» — تعرّف على أحكام الإسلام في يومك العادي**
- *Yawmuk — learn what Islam says about everyday life, by living it.*
- لعبة ثلاثية الأبعاد في المتصفح · عربي/إنجليزي · حاسوب وجوال
- المسار 03: التجارب التفاعلية · فريق Lemonada
- Live demo: `{{LIVE_URL}}` · GitHub: github.com/B4r4k4/yawmuk · Video: `{{VIDEO_URL}}`
- Visual: `docs/phase-4/screenshots/ui/after/desktop-ar/02-start.jpg`

## 2 · المشكلة · Problem

- أسئلة يومية حقيقية: قرض عقاري بفائدة، خطة تقاعد 401(k)، حفلة عمل فيها خمر، محفظة مفقودة، سحب خيري.
- المحتوى المتاح: فتاوى نصية طويلة، أو مقاطع قصيرة بلا مصادر.
- روبوتات المحادثة العامة: تجيب بسرعة لكنها **تخترع أحاديث، وتُخفي الخلاف، ولا تقول «اسأل عالماً»**.
- لا توجد تجربة تجعل المتعلم **يعيش الموقف** ثم يقرأ الدليل.
- *Everyday questions get either long fatwas or unsourced clips; generic chatbots fabricate and never refer.*

## 3 · الحل · Solution

- قصة تفاعلية: «آدم» مهندس برمجيات في كولومبس، أوهايو، يتعرف على الإسلام من خلال جيرانه وزملائه المسلمين خلال أسبوع عادي.
- 6 مواقع · 18 موقفاً · بطاقة حكم بعد كل موقف: الحكم، «بكلمات بسيطة»، القرآن، الحديث، المذاهب الأربعة، المجامع المعاصرة، متى تسأل عالماً.
- مخطط رحلة بالذكاء الاصطناعي + لوحة «اسأل عن هذا الموقف» مقيّدة بالمصادر الموثّقة.
- لا ضغط، لا سؤال عن المعتقد، لا تخزين لبيانات شخصية.
- Visuals: `docs/phase-4/screenshots/engine/home-after-overview.jpg`, `docs/phase-4/screenshots/ui/after/desktop-ar/12-ruling-top.jpg`

## 4 · آلية العمل: خمس محطات · How it works (5 stations)

1. **خطة الرحلة** — يكتب اللاعب ما يهمه → مسار مرتب من المواقف (AI أو بديل حتمي).
2. **عِش الموقف** — تجوّل في مشهد ثلاثي الأبعاد وتحدّث مع شخصيات متحركة.
3. **اختر** — كيف يسأل آدم ويتصرف؟ (الاختيارات تُخلط في كل مرة، والتقييم يكافئ السؤال المحترم).
4. **بطاقة الحكم** — أدلة حرفية موثّقة + خلاف المذاهب + «اسأل عن هذا الموقف».
5. **تحقق وتابع** — سؤال فهم، ثم الموقف التالي؛ وفي النهاية: ما تعلّمه، موضوع تالٍ، دعوة لزيارة مسجد.
- Diagram: a horizontal 5-step flow with icons. Visuals: `…/desktop-en/10-choices.jpg`, `…/desktop-en/18-check.jpg`, `…/desktop-en/23-end-top.jpg`

## 5 · القيمة المضافة مقارنة بالممارسة الحالية · Added value vs current practice

| الممارسة الحالية · Today | «يومك» · Yawmuk |
|---|---|
| قراءة فتوى نصية | **تجربة** الموقف ثم قراءة الدليل (تعلّم بالممارسة) |
| مقاطع بلا مصادر | كل آية وحديث **حرفي موثّق** برقمه ودرجته ورابطه |
| رأي واحد يُقدَّم كأنه الإسلام كله | **المذاهب الأربعة جنباً إلى جنب** + المجامع المعاصرة |
| شات بوت يخترع ويجيب عن كل شيء | ذكاء اصطناعي **مقيّد**: يستشهد بمعرّفات تم التحقق منها أو **يمتنع ويحيل إلى عالم** |
| محتوى عام للجميع | **رحلة مخصّصة** حسب اهتمام المتعلم |
| حسابات وتتبّع | بلا حساب، بلا تخزين للمعتقد، قياس مجهول باختيار المستخدم |

## 6 · التقنيات · Technologies

- **Three.js r170 + Vite 6** — 3D في المتصفح، يعمل على الجوال؛ postprocessing (SSAO عبر n8ao، bloom، tone mapping)، إضاءة HDRI.
- **أصول ثلاثية الأبعاد مفتوحة الترخيص**: {{ASSET_COUNT=253}} أصلاً (242 CC0 + 11 CC-BY 3.0 منسوبة داخل اللعبة)، شخصيات Quaternius متحركة (CC0) مع حجاب وطاقية ولحى تُولَّد برمجياً، ضغط meshopt.
- **محتوى منفصل عن الكود**: `content/rulings/*.json` (المكان الوحيد للمحتوى الديني) و`content/script/*.json` (القصة، بلا نصوص شرعية).
- **Netlify** (موقع ثابت + Function خادمية) · **Claude (Anthropic API)** للتخطيط والسؤال.
- **ضمان الجودة**: node:test (عقد المحتوى، السلامة، تدقيق الاستشهادات)، Puppeteer لاختبار شامل عربي/إنجليزي حاسوب/جوال.

## 7 · الذكاء الاصطناعي بالتفصيل · AI in detail

**المكونات · Components**
- `src/engine/planner.js` (العميل) → `netlify/functions/` (الخادم، يحمل `ANTHROPIC_API_KEY`) → Claude.
- مصدر الاسترجاع: كتالوج المواقف الـ18 + `content/rulings/*.json` + `content/sources.json` (سجل المصادر الموحّد).

**التدفق · Flow**
1. المتعلم يكتب اهتمامه → Function ترسل الطلب + الكتالوج الثابت فقط.
2. Claude يعيد **JSON منظّماً** (معرّفات مواقف + سبب قصير).
3. **التحقق**: معرّفات معروفة فقط، بلا تكرار، حدود طول، بلا نص ديني حر.
4. لوحة «اسأل»: استرجاع مقيّد بالحكم الحالي ومصادره → الإجابة يجب أن تشير إلى معرّفات مصادر → كل معرّف يُطابَق مع سجل المصادر قبل العرض.
5. **الامتناع والإحالة**: إن لم تغطِّ المصادر السؤال، أو كان شخصياً/عالي الخطورة → «لا أستطيع الإجابة من المصادر المتاحة، اسأل عالماً أو إمام مسجدك».

**البديل عند غياب المفتاح · Fallback**
- بلا مفتاح، أو مهلة، أو مخرجات غير صالحة → مخطط **حتمي** من الكتالوج نفسه؛ اللعبة تعمل كاملة دون ذكاء اصطناعي.
- لا يُولِّد النموذج أي آية أو حديث إطلاقاً: النصوص تأتي حصراً من JSON الموثّق.

**الذكاء الاصطناعي في بناء المحتوى**: وكلاء بحث فقهي، وسيناريست، ومدقق شرعي مستقل يعيد جلب كل آية وحديث ويطابقها حرفاً بحرف.
- Diagram: Player → planner.js → Netlify Function → Claude → JSON validator → (route | deterministic fallback); Ask: question → retrieval (ruling + sources) → Claude → citation-id check → answer | abstain + refer. See [docs/AI.md](AI.md).

## 8 · الموثوقية والمصادر · Reliability & sources

| المستوى · Level | المحتوى | المعالجة في اللعبة |
|---|---|---|
| **A** نص أصلي موثّق | آيات وأحاديث مطابقة حرفاً بحرف | تُعرض حرفياً مع الرقم والدرجة والرابط؛ لا تُولَّد أبداً |
| **B** قول علمي منسوب | المذاهب والمجامع | تُعرض منسوبة جنباً إلى جنب، والخلاف ظاهر |
| **C** نص توضيحي | «بكلمات بسيطة»، التوجيه العملي | موسوم «بانتظار مراجعة عالم» |
| **D** خارج التغطية / حالة شخصية | سؤال غير مغطى أو مصدر غير مُتحقَّق | **امتناع وإحالة** إلى عالم؛ «النص غير متوفر» |

- سجل المصادر: {{SOURCES_TOTAL=212}} مصدراً، منها {{SOURCES_VERIFIED=92}} موثّقة آلياً/يدوياً (كل الآيات {{QURAN=27}} وكل الأحاديث {{HADITH=58}}). — refresh: `docs/SOURCES.md` summary table.
- أدوات التحقق: `npm run audit` (إعادة جلب ومطابقة + فحص الروابط)، `npm test` (قواعد السلامة)، [docs/QA_BANK.md](QA_BANK.md) (بنك أسئلة الحالات الحرجة).
- الأحكام الـ18: مسودات بالذكاء الاصطناعي **بانتظار مراجعة عالم بشري** (14 `ai_verified`، 4 `ai_draft`). أداة تعليمية، ليست فتوى.

## 9 · النتائج · Results

- **18/18** موقفاً قابلاً للعب في 6 مشاهد، عربي وإنجليزي، حاسوب وجوال.
- **{{TESTS_PASS}}/{{TESTS_TOTAL}}** اختباراً ناجحاً — refresh: `npm test` (summary lines `ℹ tests` / `ℹ pass`).
- **{{SOURCES_VERIFIED}}** مصدراً موثّقاً من {{SOURCES_TOTAL}}؛ **0** حديث غير موثّق؛ **0** نص شرعي داخل ملفات القصة.
- اختبار شامل آلي: {{E2E_RUNS=4}} جولات كاملة (AR/EN × حاسوب/جوال) — refresh: `docs/phase-3/e2e_results.json` or `npm run test:e2e`.
- حالات السلامة الحرجة في بنك الأسئلة: {{SAFETY_PASS}}/{{SAFETY_TOTAL}} امتناع وإحالة صحيحة — refresh from `docs/QA_BANK.md`.
- حجم البناء: {{BUILD_SIZE}} (JS gzip {{JS_GZIP}}) — refresh: `npm run build`.

## 10 · لقطات من المشروع · Screenshots

Pick 6–8 (all exist in the repo):
- `docs/phase-4/screenshots/ui/after/desktop-ar/02-start.jpg` — start screen
- `docs/phase-4/screenshots/ui/after/desktop-ar/09-dialogue.jpg` — dialogue
- `docs/phase-4/screenshots/ui/after/desktop-en/10-choices.jpg` — choices
- `docs/phase-4/screenshots/ui/after/desktop-ar/12-ruling-top.jpg` — ruling card
- `docs/phase-4/screenshots/ui/after/desktop-ar/13-ruling-quran.jpg` — verified Quran evidence
- `docs/phase-4/screenshots/ui/after/desktop-ar/15-ruling-madhahib.jpg` — four madhhabs
- `docs/phase-4/screenshots/ui/after/desktop-en/23-end-top.jpg` — end screen + referral
- `docs/phase-4/screenshots/ui/after/mobile-ar/12-ruling-top.jpg` — phone
- `docs/phase-4/screenshots/engine/street-after-overview.jpg`, `…/work-after-overview.jpg`, `…/characters-lineup.jpg` — 3D scenes and characters
- `docs/phase-4/screenshots/ui/after/desktop-ar/03-credits.jpg` — in-game credits (licences)
- New for the AI slide (capture after deploy): planner screen, Ask panel answer with citations, Ask panel abstain case.

> Avoid `…/16-ruling-common-ground.jpg` — that section was removed from the game.

## 11 · خطة الاستمرار · Continuity plan

- **التبني**: مركز دعوي/إسلامي يستضيف اللعبة ويملك محتواها ويستخدمها في الأيام المفتوحة ودروس المسلمين الجدد وفعاليات الطلاب.
- **مسار مراجعة العلماء**: عالم مؤهل يراجع الأحكام (الأربعة `ai_draft` أولاً) ويوقّع؛ تتحول الحالة إلى `scholar_reviewed` باسم المراجع وتاريخه.
- **التوسع**: مواقف جديدة بالخط نفسه (بحث → تدقيق → سيناريو → مشهد → اختبارات)، أسبوع رمضان، لغات إضافية (أردو، فرنسية، إسبانية، صومالية).
- **القياس**: إكمال الرحلة ≥ 70٪، وضوح الخطوة التالية ≥ 75٪، 100٪ في حالات السلامة الحرجة، تحسّن الفهم قبل/بعد، مقارنة الرحلة المخصّصة بالثابتة (`?arm=fixed`).
- **الاستدامة التقنية**: موقع ثابت + Function واحدة على خطة Netlify المجانية؛ يعمل دون مفتاح عند الحاجة؛ ترخيص MIT للكود وCC BY-NC-SA للمحتوى.

## 12 · الفريق · Team

- فريق **Lemonada** — {{TEAM_MEMBERS: name — role}}
- فريق وكلاء ذكاء اصطناعي (Claude Code) بإشراف وكيل منسّق: باحثون فقهيون، سيناريست، بناة مشاهد، مدقق شرعي مستقل، ضمان جودة، توثيق.
- شكر: Kenney، Quaternius، Poly Haven، مؤلفو poly.pizza (CC0/CC-BY)، خطوط Google (OFL).
- Contact / links: `{{LIVE_URL}}` · github.com/B4r4k4/yawmuk · `{{VIDEO_URL}}`
