<div dir="rtl">

# «يومك» — Yawmuk

**عالم ثلاثي الأبعاد في المتصفح، فيه حيّ واحد متصل يمشي فيه اللاعب من البيت إلى العمل والمدرسة والمسجد والبنك. يرى كيف يتعامل المسلمون مع مواقف الحياة اليومية، ويقرأ أحكامها بأدلة موثّقة، ويسأل مرشداً بالصوت أو بالكتابة. المرشد لا يجيب إلا من مصادر مراجَعة، وما لا يجوز له أن يجيب عنه يُحال إلى لوحة يجيب فيها أهل العلم.**

| | |
|---|---|
| 🎮 **التجربة المباشرة · Live demo** | https://yawmuk.world (احتياطي · backup: https://yawmuk-851682870274.us-central1.run.app) |
| 🏠 **صفحة التعريف · Landing page** | https://yawmuk.world/landing |
| 🎬 **الفيديو (أقل من دقيقتين) · Video** | مرفق في نموذج التسليم · attached to the submission form |
| 📑 **العرض التقديمي · Deck (PDF)** | مرفق في نموذج التسليم · attached to the submission form |
| 💻 **المستودع · Repo** | https://github.com/yawmuk/yawmuk |
| 🧭 **المسار · Track** | **03: التجارب التفاعلية (Interactive experiences)** |

> ⚠️ **حالة المراجعة:** المواقف السبعة في الرحلة: **خمسة منها مسودات جديدة أعدّها الذكاء الاصطناعي في 6 أكتوبر (`ai_draft`)، واثنان (القمار واليانصيب، وشرب الخمر) من الأحكام السابقة التي اجتازت التدقيق الآلي؛ ولم يراجع أيّاً منها عالم بشري بعد، فكلها بانتظار مراجعة عالم**. والأحكام الستة عشر السابقة باقية مكتبةً مرجعية يستند إليها المرشد. نصوص الآيات والأحاديث طوبقت آلياً حرفاً بحرف مع مصادرها (انظر سجل المصادر). أما الإحالات المذهبية والمعاصرة فلم تُطابَق كلها على المطبوع. اللعبة أداة تعليمية **وليست فتوى**. ومن كانت له مسألة في حالته الخاصة فليسأل عالماً موثوقاً أو إمام مسجده. ولا تظهر على البطاقة عبارة «راجعه: …» إلا إذا سجّل عالم مراجعته فعلاً في لوحة المراجعة.

</div>

> ⚠️ **Review status:** of the 7 situations on the journey, **5 are new AI-prepared drafts written on 6 Oct (`ai_draft`) and 2 (gambling & the lottery, alcohol) are earlier rulings that passed automated checks. None has been reviewed by a human scholar yet; all are pending scholarly review.** The 16 earlier rulings remain as a reference library the guide answers from. The video and the deck were recorded with the previous 18-situation version. Every Quran and hadith text was machine-matched letter by letter against its source (source log). Madhhab and contemporary references are attributed, but most have not been checked page by page against printed editions. The game is an educational tool, **not a fatwa**. A Muslim with a question about their own situation should ask a trusted scholar or their local imam. A card shows «Reviewed by …» only when a scholar has actually recorded a review in the dashboard.

**Yawmuk («يومك», "your day")** is a browser 3D world, an ordinary day in a neighbourhood («حيّ السلام», Al-Salam), where **Adam**, a newcomer curious about Islam, learns how his Muslim neighbours, coworkers and friends handle everyday situations: money, food, work, study, celebrations, prayer. It runs on desktop and phone, in Arabic (RTL) and English, with no install and no account.

---

## For judges: verify in 3 minutes · للمحكّمين: تحقّق في 3 دقائق

Use **Chrome or Edge** on desktop: voice input relies on the Web Speech API, and other browsers fall back to text. If the main link is unreachable, use the backup: https://yawmuk-851682870274.us-central1.run.app

| # | Open | Do | What you should see |
|---|---|---|---|
| 1 | `https://yawmuk.world/?scene=town&nointro=1` | Walk with **WASD** or the joystick. Doors are labelled. Press **E** near a door or a sign. | One connected neighbourhood with doors to home, work, school, street, events, **mosque** and **bank**, and a live **prayer-times** widget in the HUD. |
| 2 | `https://yawmuk.world/?scene=mosque&nointro=1` | Press **E** at «المصحف المرتل والترجمة / Recited Quran & translation». Play an ayah. Then try the **adhkar** stand and the **prayer times** board. | KFGQPC Hafs text with a translation of meanings (quranenc.com) and per-ayah recitation (everyayah.com); adhkar with counters, each with its book, number, grade and dorar.net record; computed prayer times with the adhan at prayer time. |
| 3 | `https://yawmuk.world/?scene=bank&nointro=1` | Press **E** at the «Islamic finance advisor» desk. | Contract cards (murabaha, ijara, diminishing musharaka…), each position attributed to a named body and linked; a zakat calculator; a loan vs murabaha vs musharaka comparison. Disputed (level C) items are marked as such. |
| 4 | `https://yawmuk.world/?scene=home&nointro=1` | Talk to Omar, pick a choice, open the **ruling card**. | The verdict in plain words; verbatim Quran (with link) and hadith (number, grade, link); the four madhhabs side by side; "when to ask a scholar". |
| 5 | Any scene → **«؟ Ask»** in the HUD (or the Guide desk in town) | Press 🎤 and ask aloud *"Why do Muslims avoid interest?"*, then type *"My wife and I want to take a mortgage, is it okay for us?"* | First: an answer drawn **only** from reviewed passages, with the passages it used shown. Second: **no AI answer**, but a fixed referral and an «Ask a scholar» button. |
| 6 | «Ask a scholar» (town or mosque) | Submit a question. Keep the ticket code. | A ticket, and the question waiting in the scholars' queue. |
| 7 | `https://yawmuk.world/experts` | Log in with the **passcode given in the submission form**. It is never published here. | The scholar dashboard: the question from step 6 with an automatic level (أ/ب/ج/د) and related cards; answer it with sources; optionally publish it. Back in the game, the ticket shows the scholar's answer. |
| 8 | `https://yawmuk.world/?study=1` then `https://yawmuk.world/results.html` | Consent, pre-test, play, post-test. | `/results.html` shows only **real** live aggregates. Below 5 participants per arm it says "insufficient data". |

Offline check, no keys needed: `npm ci && npm test && npm run build` (full run and keys guide: [Setup, keys & run](#setup-keys--run--التشغيل-والمفاتيح)). The game still works without an AI provider: the planner falls back to a deterministic route, and the guide answers with the reviewed passages verbatim or abstains.

## What's new for the final round · ما أضيف في المرحلة النهائية

1. **One walkable town** (`src/scenes/town.js`, `src/engine/hub.js`). Every location opens from the same neighbourhood, and the player walks out of the house to school, the mosque or the bank.
2. **Mosque** (`src/scenes/mosque.js`), with:
   - **live prayer times + adhan** (`src/features/prayer/`, [adhan-js](https://github.com/batoulapps/adhan-js), computed on the device);
   - **recited Quran with translation of meanings** (`src/features/quran/`): KFGQPC Hafs text via api.quran.com, cross-checked against quranenc.com, translation from quranenc.com, audio from everyayah.com, with 4 surahs bundled for offline use;
   - **morning & evening adhkar** (`src/features/adhkar/`): text from Hisn al-Muslim; every hadith checked against the six books and dorar.net.
3. **Islamic bank advisor + zakat calculator** (`src/scenes/bank.js`, `src/features/bank/`). It writes no new verdicts: every position is attributed and linked.
4. **«Ask Omar» guide with voice and text** (`src/features/guide/`, `src/features/voice/`). It works across the whole game and answers only from reviewed passages. Personal-fatwa questions and prompt-injection attempts are caught **before** the model is called. If nothing reviewed covers a question, it abstains and refers.
5. **Scholar dashboard, the human review loop** (`/experts`, `netlify/functions/questions.mjs`, `experts.mjs`). Players send what the guide cannot answer. Scholars answer with sources and can publish an answer, which then becomes a reviewed passage the guide can use. They can also record reviews of the ruling cards (the 7 situations and the 16 library rulings).
6. **Opt-in micro-study with live results**: pre/post understanding test, AI-personalised vs fixed route, `/results.html`.
7. **Evaluation against the reference package.** Content levels أ/ب/ج/د are enforced in code and tests. Every source is tiered as *approved package* or *secondary* (`tools/eval/source_tiers.mjs`). A religious Q&A eval runs in `tests/religious_qa.test.mjs` and `tests/levels.test.mjs`.
8. **New brand identity**, built as a sibling of the «Madar» identity: tokens, logo, contrast tests.
9. **Cloud Run deployment** (`server.mjs`, `Dockerfile`) with Firestore storage and secrets in Secret Manager.

## Problem · المشكلة

- People meeting Islam for the first time, and many Muslims in the West, run into everyday questions: a mortgage, a 401(k), a work party with alcohol, a lost wallet, a raffle. Most Islamic content answers them either with **long text fatwas** or with **short, unsourced social-media clips**.
- Generic AI chatbots answer fast, but they can **invent hadiths, flatten scholarly disagreement and never say "ask a scholar"**.
- Existing apps are mostly Q&A lists. None lets a learner *experience* the situation, see how Muslims actually handle it, and then read the evidence.

## Solution · الحل

An interactive 3D day. At each stop a Muslim friend does something that raises a question. The player chooses how Adam asks and responds, and a **ruling card** then shows:
- the verdict and an **"In plain words"** explanation for a newcomer;
- the evidence: **Quran** (verbatim, verified), **hadith** (verbatim, with number, grade and link), the **four madhhabs** side by side, and **contemporary fiqh councils**;
- practical guidance, halal alternatives and **when to ask a scholar**.

Around the situations, the town has a **mosque** (prayer times, adhan, recited Quran with translation, adhkar), a **bank** (Islamic finance and zakat), a **guide** you can speak to, and a door to **real scholars**. The score rewards curious, respectful questions. The game never asks about the player's beliefs and stores nothing about them.

### Locations: 7 situations + two places · المواقع: 7 مواقف ومكانان

| Location · الموقع | Situations · المواقف |
|---|---|
| 🏠 Home · البيت | Purity and the mosque: wudu and shoes · الطهارة والمسجد: الوضوء وخلع الحذاء |
| 💼 Work · العمل | Belief: declining a lucky charm, trusting God · العقيدة: رفض تميمة الحظ والتوكل على الله<br>Hijab: respect and dignity at work · الحجاب: الاحترام والتكريم في العمل |
| 🎓 College · الكلية | Pork: abstaining in obedience to God · أكل الخنزير: الامتناع طاعةً لله |
| 🌃 Street · الشارع | Gambling and the lottery: protecting society · القمار واليانصيب: حفظ المجتمع |
| 🎉 Event hall · قاعة المناسبات | Alcohol: the party toast and protecting the mind · شرب الخمر: نخب الحفل وحفظ العقل |
| 💍 Neighbours · بيت الجيران | Marriage: the proposal, the guardian and the mahr · إجراءات الزواج: الخطبة والولي والمهر |
| 🕌 Mosque · المسجد | Prayer times & adhan · Recited Quran with translation of meanings · Morning/evening adhkar · Ask a scholar |
| 🏦 Bank · البنك | Contract cards · Zakat on savings · House-finance comparison |

The 16 earlier rulings (mortgage, credit cards, student loans, 401(k), lost wallet, wedding, condolences, holiday greetings…) stay in `content/library/` as reference passages: the guide answers from them and can open their cards, but they are no longer on the journey.

**Controls:** WASD/arrows to move, Shift to run, drag to orbit, **E** to interact, Esc for the menu. On a phone: joystick, drag to look, and the **Interact** button.

## Screenshots · لقطات

| Start (AR) | Dialogue & choices (EN) | Ruling card (AR) |
|---|---|---|
| ![Start screen, Arabic](.github/screenshots/start-ar.jpg) | ![Choices, English](.github/screenshots/choices-en.jpg) | ![Ruling card top, Arabic](.github/screenshots/ruling-ar.jpg) |
| **Quran evidence (EN)** | **Four madhhabs (AR)** | **Phone (390×844, AR)** |
| ![Quran evidence](.github/screenshots/quran-en.jpg) | ![Madhhabs](.github/screenshots/madhahib-ar.jpg) | <img src=".github/screenshots/phone-ar.jpg" width="200" alt="Phone ruling card"> |

These screenshots predate the town, mosque and bank, which are shown in the video.

## Architecture · البنية

```mermaid
flowchart LR
  subgraph Browser["Browser (Vite + three.js, no secrets)"]
    Town["Town hub<br/>home · work · school · street · events · mosque · bank"]
    Card["Ruling cards<br/>content/rulings (verbatim, verified)"]
    Guide["«Ask Omar» guide + Ask panel<br/>BM25 over reviewed passages<br/>personal / injection pre-filter"]
    Voice["Web Speech API<br/>speech-to-text / text-to-speech"]
    Prayer["Prayer times<br/>adhan-js (local) + adhan audio"]
    Quran["Quran panel"]
    Adhkar["Adhkar<br/>content/adhkar (dorar-verified)"]
    Bank["Bank advisor + zakat calc<br/>content/bank"]
    Study["Opt-in study"]
    Validate["aiCore validators<br/>ids ⊆ sent · no scripture · no links"]
  end
  subgraph Run["Google Cloud Run · server.mjs (serves dist/ + mounts functions)"]
    F_plan["plan"]; F_ask["ask"]; F_guide["guide"]
    F_q["questions"]; F_exp["experts"]; F_study["study"]; F_m["metrics"]
    Store[("store.mjs<br/>Firestore · or JSON files")]
    Dash["/experts<br/>scholar dashboard"]
    Results["/results.html"]
  end
  LLM["Gemini 3 Flash on Vertex AI<br/>(fallback Gemini 2.5 Flash)"]
  Ext["api.quran.com · quranenc.com · everyayah.com"]
  Voice --> Guide
  Town --> Card & Guide & Prayer & Quran & Adhkar & Bank & Study
  Guide -->|retrieved passages only| F_guide & F_ask
  Town -->|day context| F_plan
  F_plan & F_ask & F_guide -->|structured JSON| LLM
  F_plan & F_ask & F_guide --> Validate
  Guide -->|refer| F_q --> Store
  Dash --> F_exp --> Store
  F_exp -. AI pre-triage, labelled .-> LLM
  Study --> F_study --> Store
  F_m --> Store
  Results --> F_study
  Quran --> Ext
```

<details><summary>File map</summary>

```
index.html, src/main.js          boot; experts.html + src/experts/ = scholar dashboard (2nd Vite page)
src/engine/                      engine: game flow, hub/town, scenes, player, assets, aiCore (validators), planner, ui/
src/scenes/                      town, home, work, school, street, public_events, private_events, mosque, bank
src/features/<name>/             self-contained panels: guide, voice, prayer, quran, adhkar, bank, experts, study
content/rulings, content/script  rulings (the only place religious rulings live) / story (no scripture)
content/quran, adhkar, bank      fetched Quran bundle, verified adhkar, attributed bank cards
content/sources.json             unified source log
netlify/functions/*.mjs          plan, ask, guide, questions, experts, study, metrics (Web-standard handlers)
netlify/lib/                     claude.mjs (Claude), vertex.mjs (Gemini fallback), store.mjs (Firestore/JSON)
server.mjs, Dockerfile           Cloud Run server: static + auto-mounted functions + /experts
tools/audit, tools/eval          citation re-verification, link check, source tiers
tests/                           node:test suites (+ e2e playthrough)
```
</details>

## The role of AI · دور الذكاء الاصطناعي

The AI **arranges and explains reviewed material. It never writes religious text and never rules on a personal case.**

1. **Journey planner** (`plan`). The model receives the situation catalogue plus the player's chosen day type and topics, and returns a structured JSON route. It is validated twice, on the server and in the browser. If it is invalid, times out or there is no provider, a deterministic planner is used.
2. **«Ask Omar» guide and the per-card Ask panel** (`guide`, `ask`). Retrieval runs first in the browser, over reviewed passages only (Q&A bank, card summaries and guidance, published scholar answers). The model must answer from those passages and cite their ids, and every id is checked. Scripture-like text, verse references and links all cause an abstention. **Personal-fatwa questions and injection attempts never reach the model**: they get a fixed, pre-written referral to a scholar.
3. **Voice.** Speech-to-text and text-to-speech use the browser's Web Speech API, on-device where the browser supports it. A voice transcript follows exactly the same path and filters as typed text. The game never records, uploads or stores audio.
4. **Scholar triage** (`experts`). The AI only *suggests* a content level for the human scholar, and the suggestion is labelled «اقتراح آلي يحتاج مراجعة» ("automatic suggestion, needs review"). It never answers players.
5. **Provider.** The live deployment runs **Gemini 3 Flash (`gemini-3-flash-preview`) on Google Cloud Vertex AI**, with automatic retry on **Gemini 2.5 Flash** if the preview model times out or errors; authentication is the Cloud Run service account (no API key anywhere). The same code can use Claude (`@anthropic-ai/sdk`) when `ANTHROPIC_API_KEY` is set. Both use the same contract and validators.
6. **Building the content (offline, before release).** Research agents drafted the rulings. An independent audit agent re-fetched every ayah and hadith and matched them letter by letter. The tests are the evaluation suite.

**Why not a general chatbot?** A general chatbot generates religious text from its weights. In Yawmuk, the model only ever sees reviewed passages, may cite only ids it was given, and is overruled by deterministic filters on the cases that matter most: personal fatwa, out-of-scope questions and injection. A human scholar sits behind it. The critical cases are checked by `tests/ai.test.mjs`, `tests/religious_qa.test.mjs` and `tests/levels.test.mjs`.

## Reliability & scientific safety · الموثوقية والسلامة العلمية

**Online eval on production (yawmuk.world):** 682/695 checks pass, and all 13 failures are in the cautious direction (referral instead of an answer); **0 unsafe failures**. The same model without Yawmuk's design quoted or attributed Quran/hadith text with no verifiable record in **42/72** answers and cited an approved-package source in **0/72**.

Every source, with link, verification status and tier, is in `content/sources.json` (273 records: 135 verified; all tiered approved-package or secondary).

**Content levels from the challenge's scientific reference package** are applied to every ruling (`content_level`) and every Q&A item (`level`):

| Level | Scope | How Yawmuk handles it |
|---|---|---|
| **أ · A**: stable foundational information | Quran, authentic hadith, pillars, ethics | Direct answer with its source. Ayat come verbatim from the KFGQPC text via QuranEnc; hadith with collection, number, grade and grader. Never paraphrased or generated. |
| **ب · B**: explanation and reasoning | concepts, maqasid, misconceptions | Answered from reviewed material with the reference. Our own reasoning appears separately, labelled «شرح توضيحي — ليس نصاً شرعياً» ("explanatory note, not a religious text"). |
| **ج · C**: disagreement / high sensitivity | fiqh khilaf | Restricted. The verdict is `disputed`/`depends` or carries an explicit scope (e.g. "majority view"), with madhhab positions side by side and attributed. No confidence badge is shown. |
| **د · D**: fatwa or personal case | the player's own situation | **No ruling.** The player gets general information and a referral. The guide pre-filters these questions and sends them to the scholar dashboard. |

Tooling: `npm run audit` re-fetches every ayah and six-book hadith and checks every link. `npm test` enforces the rules: no scripture in script files, no unverified hadith, `refer_to_scholar_when` on every ruling, no claim of scholar review without a real record, and level ج wording.

## Privacy · الخصوصية

- **No player accounts, no sign-in, no profile.** The game never asks about religion or belief.
- Browser `localStorage` holds only game progress (`yawmuk.progress.v1`), the graphics preset (`yawmuk.quality`), prayer location/method settings (`yk-prayer-settings`), adhkar counters (`yk-adhkar-progress`), the player's own scholar-question ticket codes (`yawmuk.experts.tickets.v1`) and, for study participants, their random study code (`yk-study`).
- Questions typed into the guide (Omar) and the Ask panel are sent, with the reviewed passages, to an AI model (in the live deployment: Google Gemini on Vertex AI; the code can also use Claude by Anthropic if a server operator sets `ANTHROPIC_API_KEY`) for that request only, and are never logged by the game.
- Questions sent to scholars store the question text and the optional nickname, but no email, phone or IP; the scholars' dashboard may send the question to the same AI model to pre-sort it. The player can delete a question with the ticket code.
- Study and metrics data are opt-in and anonymous, published as aggregates only, and the participant can withdraw.
- Voice uses the browser's own speech engine. The game itself never records, uploads or stores audio. Where the browser offers on-device recognition, the game asks for it. Otherwise the browser's speech service handles the audio (in Chrome that is Google's service), and the UI says so.

## Setup, keys & run · التشغيل والمفاتيح

<div dir="rtl">

**باختصار:** اللعبة تعمل كاملةً **بدون أي مفتاح**. المفاتيح تفعّل فقط ميزات الذكاء الاصطناعي (المرشد، مخطط الرحلة، حوار الشخصيات، الصوت) ولوحة العلماء. بدونها تعمل اللعبة بالبدائل الثابتة: مسار افتراضي، ونصوص مراجَعة حرفية، ومرشد نصي.

</div>

### 1. Prerequisites · المتطلبات

- **Node.js 22+** and npm.
- Chrome or Edge (WebGL2; WebGPU is used when available).
- Optional, for AI: the **Google Cloud CLI** (`gcloud`) and a Google Cloud project with billing and the **Vertex AI API** enabled.

### 2. Run without keys (2 minutes) · التشغيل بدون مفاتيح

```bash
git clone https://github.com/yawmuk/yawmuk.git && cd yawmuk
npm ci                 # exact locked dependencies
npm test               # ~780 tests: content contracts, safety, AI validators, features, eval (no browser, no keys)
npm run dev            # game only: http://localhost:5173/?scene=town&nointro=1  (Vite does not serve the AI functions)
```

Full stack (game + AI functions + `/experts` + `/results.html`), exactly as on Cloud Run:

```bash
npm run build          # -> dist/ (game + scholar dashboard)
npm start              # node server.mjs on http://localhost:8080
```

### 3. Keys & variables · المفاتيح والمتغيرات

Copy [`.env.example`](.env.example) to `.env`, fill what you need, then run `node --env-file=.env server.mjs`. **Never commit `.env`** (it is git-ignored).

| Variable | Needed for | How to get it |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | AI (Gemini on Vertex AI), voice, Firestore | Your project id: `gcloud config get-value project` |
| `GOOGLE_ACCESS_TOKEN` | AI + voice **when running locally** | `gcloud auth login` then `gcloud auth print-access-token` (valid ~1 hour). **Not needed on Cloud Run**: the service account is used. |
| `EXPERTS_PASSCODE` | Scholar dashboard `/experts` | Any strong passcode you choose; share it out of band. |
| `SESSION_SECRET` | Scholar dashboard session cookie | `openssl rand -hex 32` |
| `STORE=firestore`, `FIRESTORE_DATABASE` | Durable storage on Cloud Run | Create a Firestore (Native) database; without it, data is kept in `./data` (lost on Cloud Run restarts). |
| `STUDY_ADMIN_KEY` | Optional: free-text comments in the study CSV export | Any random string. |
| `GEMINI_API_KEY` | Optional alternative to Vertex (e.g. on Netlify) | [Google AI Studio](https://aistudio.google.com/apikey). ⚠️ When set it **takes priority over Vertex**; a key without credit breaks the AI features. |
| `ANTHROPIC_API_KEY` | Optional alternative: Claude instead of Gemini | [Anthropic Console](https://console.anthropic.com/). When set, Claude takes priority unless `LLM_PROVIDER=vertex`. |

Optional tuning: `VERTEX_LOCATION` (default `global`), `YAWMUK_GEMINI_MODEL` (default `gemini-3-flash-preview`), `YAWMUK_GEMINI_FALLBACK` (default `gemini-2.5-flash`), `YAWMUK_TTS_MODEL`, `YAWMUK_TTS_VOICE`, `LLM_PROVIDER` (`vertex` | `claude`), `DATA_DIR`, `PORT`.

The Google account or service account that calls Vertex AI needs the role **`roles/aiplatform.user`**, and Firestore needs **`roles/datastore.user`**.

### 4. Run locally with AI (Gemini on Vertex AI) · التشغيل مع الذكاء الاصطناعي

```bash
gcloud auth login
gcloud services enable aiplatform.googleapis.com --project <YOUR_PROJECT_ID>
npm run build
GOOGLE_CLOUD_PROJECT=<YOUR_PROJECT_ID> \
GOOGLE_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
EXPERTS_PASSCODE=dev-passcode SESSION_SECRET="$(openssl rand -hex 32)" \
node server.mjs
# game:      http://localhost:8080/?scene=town&nointro=1
# dashboard: http://localhost:8080/experts      (passcode: dev-passcode)
# results:   http://localhost:8080/results.html
```

Quick AI check: `curl -s -X POST localhost:8080/.netlify/functions/plan -H 'content-type: application/json' -d '{"lang":"en","topics":["money"]}'` returns a journey (or an `error`, in which case the game falls back on its own).

### 5. Deploy to Google Cloud Run · النشر على Google Cloud Run

```bash
PROJECT=<YOUR_PROJECT_ID>; REGION=us-central1; SERVICE=yawmuk
gcloud config set project $PROJECT

# 1) APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com firestore.googleapis.com aiplatform.googleapis.com

# 2) Runtime service account + roles (Gemini on Vertex AI, Firestore)
SA="$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role=roles/aiplatform.user
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role=roles/datastore.user

# 3) Firestore (Native) for the scholar queue, reviews and study records
gcloud firestore databases create --database='(default)' --location=nam5 --type=firestore-native

# 4) Secrets (generated here, never written to the repo)
printf '%s' "$(openssl rand -base64 18)" | gcloud secrets create EXPERTS_PASSCODE --data-file=-
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create SESSION_SECRET --data-file=-
for S in EXPERTS_PASSCODE SESSION_SECRET; do
  gcloud secrets add-iam-policy-binding $S --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
done

# 5) Build from source (Dockerfile) and deploy
gcloud run deploy $SERVICE --source . --region $REGION --allow-unauthenticated \
  --port 8080 --cpu 1 --memory 512Mi --min-instances 1 --max-instances 4 --timeout 60 \
  --set-env-vars STORE=firestore,GOOGLE_CLOUD_PROJECT=$PROJECT \
  --set-secrets EXPERTS_PASSCODE=EXPERTS_PASSCODE:latest,SESSION_SECRET=SESSION_SECRET:latest
#    If the build fails with a storage permission error, add --build-service-account <a SA with storage + logging access>.

# 6) Smoke test, and the passcode to hand to scholars (out of band)
URL=$(gcloud run services describe $SERVICE --region $REGION --format='value(status.url)')
curl -sI "$URL/" | head -1                                                      # HTTP/2 200
curl -s -X POST "$URL/.netlify/functions/plan" -H 'content-type: application/json' -d '{"lang":"en","topics":["money"]}' | head -c 300
gcloud secrets versions access latest --secret=EXPERTS_PASSCODE; echo
```

- **Do not set `GEMINI_API_KEY` on Cloud Run** unless that key has AI Studio credit: it takes priority over the service account.
- To use Claude instead: create an `ANTHROPIC_API_KEY` secret the same way and add it to `--set-secrets`.
- Without Firestore: drop `STORE=firestore` and use `--max-instances 1`; data then resets on every new revision.
- Rollback: `gcloud run services update-traffic $SERVICE --region $REGION --to-revisions <PREVIOUS_REVISION>=100`.
- **Netlify alternative** (game + AI only, no durable scholar queue): `netlify.toml` is ready; set `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` in the site's environment variables.

### 6. Other scripts · أوامر أخرى

```bash
npm run audit          # re-verify every Quran/hadith text against its source + check every link (network)
npm run test:e2e       # headless Chrome playthrough (needs Chrome; set CHROME_PATH if it is not found)
```

No secrets are committed to this repository. Keys live only in `.env` (local, git-ignored), Secret Manager (Cloud Run) or the host's environment.

### Repository layout · بنية المستودع

| Path | What |
|---|---|
| `src/` | The game: 3D engine (three.js, WebGPU/WebGL2), scenes, features (prayer, Quran, adhkar, bank, guide, voice, study), UI |
| `content/` | Reviewed content: rulings, script, Quran, adhkar, bank cards, library, `sources.json` |
| `netlify/functions/`, `netlify/lib/` | Server functions (AI guide, planner, NPC, TTS, scholar queue, study) and the Vertex/Claude/Firestore adapters |
| `server.mjs`, `Dockerfile` | Production server for Cloud Run (serves `dist/` + mounts every function) |
| `public/` | 3D assets (CC0/CC-BY, see `public/assets/LICENSES.md`), audio, brand, landing page |
| `tests/` | `node:test` suites + headless e2e |
| `tools/` | Citation audit, eval, asset and character pipelines |

## Built during the challenge (Oct 4–6, 2026) · ما بُني خلال التحدي

There is **no prior codebase**: the code, content and asset integration were all created in the challenge window (Oct 4–6, 2026).

This public repository is a **clean snapshot** of the final code: it contains one commit, and it leaves out the build output, the phase reports, the screenshot archives, the deck and the video tooling. The full commit-by-commit history is in the team's development repository: https://github.com/B4r4k4/yawmuk.

| When (+03) | What |
|---|---|
| Oct 5, 21:40 | Initial commit: engine, 6 scenes, 18 rulings with machine-verified citations, script, audit tools, tests, phases 1–3. |
| Oct 5, 21:47 – 23:54 | Pivot to the non-Muslim learner premise (Adam learns from Muslim friends); QA fixes; summary screen. |
| Oct 6, 00:14 – 03:39 | Removal, by owner decision, of all non-Islamic scripture references, with a guard. |
| Oct 6, 14:44 – 15:56 | CC0 3D asset library, UI redesign, animated characters, HDRI/post-processing. |
| Oct 6, 16:28 | Compliance with the scientific reference package: content levels, explanatory-note labelling, consensus sources. |
| Oct 6, 18:37 | Cloud Run server and container build. |
| Oct 6, evening | Everything in «What's new» above: town, mosque, bank, voice guide, scholar dashboard, study, eval, brand. |

## Team · الفريق

**Humans:**
- **Abubakr Abusham** (Lemonada): project owner.
- **Mohamed Al-Mubarak**

**AI disclosure.** Most code and drafts were produced by **AI coding agents** (Claude Code, Claude Opus models) under human direction. A supervisor agent coordinated them through shared written contracts: fiqh researchers, scriptwriter, engine and scene builders, an independent sharia-citation auditor, feature agents (mosque, Quran, adhkar, prayer, bank, voice, guide, scholar dashboard, study, brand), QA and documentation. Agents did not decide religious rulings by themselves. Every scripture text is fetched from a source and machine-verified, and the rulings remain **pending human scholarly review**, as stated at the top of this page.

## Measurement · القياس

| Metric (track 3) | Target | How |
|---|---|---|
| Understanding gain | positive pre→post gain | Opt-in micro-study, 5 concept items copied from reviewed cards; live at `/results.html` (protocol) |
| AI-personalised vs fixed route | compare gain and completion | Arms alternate by enrolment; intention-to-treat and realized arm both reported |
| Journey completion | ≥ 70% | Anonymous opt-in events |
| Next-step clarity | ≥ 75% "I know my next step / whom to ask" | Likert item at post-test |
| Critical safety cases | 100% abstain/refer | Automated eval on every `npm test` |

We report only real submissions. Below 5 completed participants per arm, the dashboard says "insufficient data", and we do not quote numbers until there are enough.

## Sources, tools & licences · سجل المصادر والأدوات والتراخيص

**Code licence:** [MIT](LICENSE), © 2026 Yawmuk team (Lemonada). **Content** (`content/` and docs): CC BY-NC-SA 4.0. Quran and hadith texts remain under their publishers' terms. See [`LICENSE`](LICENSE).

| Kind | Item | Licence |
|---|---|---|
| Runtime | three 0.170, postprocessing 6.39, n8ao 2.0 | MIT, Zlib, ISC |
| Runtime | adhan (adhan-js) 4.4: prayer-time calculation | MIT |
| Server | Vertex AI REST (Gemini, primary); @anthropic-ai/sdk 0.131 (Claude, optional); Firestore REST | MIT; Google Cloud terms |
| Dev | vite 6, puppeteer-core (e2e), @gltf-transform 4.5, meshoptimizer 1.3 | MIT / Apache-2.0 |
| Fonts | Amiri, Amiri Quran, IBM Plex Sans Arabic, Reem Kufi (Google Fonts) | SIL OFL 1.1 |
| 3D assets | Kenney, Poly Haven, poly.pizza authors (CC0 1.0) + 11 CC-BY 3.0 models; Quaternius characters (CC0) | [`public/assets/LICENSES.md`](public/assets/LICENSES.md) |
| Quran | api.quran.com (`text_qpc_hafs`), quranenc.com translations, everyayah.com audio | see `src/features/quran/` |
| Hadith / adhkar | Hisn al-Muslim API, hadith-api (sunnah.com text), dorar.net | see `content/sources.json` |
| Adhan audio | «The Adhan – Muslim Call to Prayer – Aaqib Azeez» by Atcovi, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3) (`public/audio/adhan/adhan.mp3`), credited in the prayer panel | CC BY-SA 4.0 |
| AI (runtime) | Gemini 3 Flash / 2.5 Flash on Vertex AI (live); Claude supported | provider terms; keys server-side only |
| AI (building) | Claude Code agents (Claude Opus) | n/a |

CC-BY models are credited in the in-game **Credits** screen, which is generated from `public/assets/LICENSES.md`.

## Roadmap & continuity · خطة الاستمرار

1. **Scholar review first.** The dashboard is ready. A qualified scholar reviews the 7 situation cards, starting with the 5 `ai_draft` ones, then the 16 library cards; each review is stored with name and date and shown on the card.
2. **Adoption by a mosque or da'wah centre** for open houses and new-Muslim classes.
3. **More situations through the same pipeline** (research → audit → script → scene → tests): healthcare, travel, Ramadan week, online business.
4. **More languages** (Urdu, French, Spanish, Somali), using approved KFGQPC/quranenc translations for each.
