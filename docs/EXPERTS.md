# Human scholarly review loop («اسأل أهل العلم» + لوحة المراجعة الشرعية)

The in-game guide answers **only** from reviewed passages and abstains or refers otherwise. This loop closes the
gap: what the guide can't (or must not) answer goes to **qualified scholars**, who answer it themselves, with sources.
Their answers can be approved for publishing, and then the guide may answer from them too. Scholars can also record
reviews of the 18 ruling cards. The game shows «راجعه: <name>» only when a real review record exists.

```
player ──(question, no personal data)──▶ POST /.netlify/functions/questions ──▶ store (questions)
   ▲                                                         │ rule triage at submit (level أ/ب/ج/د, related cards)
   │ ticket code (localStorage)                              ▼
   └── GET ?tickets=… ◀── status / answer / sources / reviewer ◀── /experts dashboard (scholars, passcode)
                                                             │  + AI pre-triage on demand ("اقتراح آلي يحتاج مراجعة")
GET ?public=1 ◀── only answers a scholar marked publishable ◀┘  + ruling review records ──▶ GET experts?view=reviews
```

## Pieces

| File | Role |
|---|---|
| `src/features/experts/index.js` (+ `experts.css`) | Player panel. `open({ lang, onClose, prefill }) -> close()`. Tabs: *New question* / *My questions* (ticket list in localStorage, status + answer from the server, add a code from another device, delete). RTL/LTR, Esc closes, focus trap, works at 390 px. |
| `src/features/experts/core.js` | DOM-free rules shared by browser, server and tests: validation and limits, ticket codes, answer/review forms, public passages, rate limiter. |
| `netlify/functions/questions.mjs` | Public API (submit / status / delete / public passages). |
| `netlify/functions/experts.mjs` | Scholar API (login, queue, triage, answer, ruling review) + public `?view=reviews`. |
| `netlify/lib/store.mjs` | Storage adapter: JSON files (default) or Firestore (`STORE=firestore`). |
| `experts.html` + `src/experts/` | Scholar dashboard, built by Vite as a second page and served at `/experts` by `server.mjs`. |
| `server.mjs` | Now auto-mounts **every** `netlify/functions/*.mjs` at `/.netlify/functions/<name>`, and serves `/experts` with `no-store`, `X-Frame-Options: DENY`, `noindex`. |

## API

Public:
- `POST /.netlify/functions/questions` `{"action":"submit","question":"…","lang":"ar|en|other","nickname":"…"}` → `201 {"ticket":"ABCD2345EFGH"}`.
  The question must be 8 to 1000 characters and the nickname at most 40. Unknown fields such as email or phone are dropped and never stored.
- `GET /.netlify/functions/questions?tickets=CODE1,CODE2` (max 20) → `{items:[{ticket,question,status,answer,sources,reviewer,title,level,…}]}`. It never returns the nickname.
- `POST … {"action":"delete","ticket":"CODE"}` → `{deleted:true|false}`. This is delete-on-request, and the ticket code is the only credential (60 random bits).
- `GET /.netlify/functions/questions?public=1` → `{passages:[{id:"x:<ticket>", lang, question, text, sources, reviewer, title, level, answered_at}]}`. It contains **only** answers a scholar marked *publishable*. Publishing requires status `answered` and a level other than د, and the scholar rewrites the question to remove personal details.
- `GET /.netlify/functions/experts?view=reviews` → `{reviews:{"<ruling_id>":{reviewer,title,verdict,at}}}`. This is the latest review per ruling. A later `needs_changes` record withdraws it. Scholar notes are never public.

Scholars (cookie session):
- `POST experts {"action":"login","passcode":"…"}`. The passcode is compared in constant time with `EXPERTS_PASSCODE`. The response sets the `yk_experts` cookie: HMAC-SHA256 with `SESSION_SECRET`, `HttpOnly; SameSite=Strict; Path=/.netlify/functions/experts`, `Secure` on https, 8 h. Rate limits count **failed** attempts only: 5 per 10 min per client (reset on a successful login) and 60 per 10 min globally, so scholars sharing one network are never locked out by their own logins.
- `GET experts?view=queue&status=new|answered|referred|out_of_scope|all`, `GET experts?view=rulings`
- `POST experts {"action":"answer", id, status:"answered|referred|out_of_scope", answer, sources:[https…], level:"A|B|C|D", reviewer, title, publish, public_question}`
- `POST experts {"action":"triage", id}`: the AI pre-triage (level أ/ب/ج/د, personal?, out of scope?, short reason). It is cached on the question and labelled «اقتراح آلي يحتاج مراجعة». Without an API key the rule triage still works: the personal-case filter → د, and BM25 over the 18 rulings → related cards and their level.
- `POST experts {"action":"review", ruling_id, verdict:"reviewed|reviewed_with_notes|needs_changes", reviewer, title, notes}`. This stores a record. `content/rulings/*.json` is **never** modified at runtime.

## Safety and privacy
- Nothing personal is required. We store no IP and no user agent, and nothing is logged with the question text. Rate limiting uses the client address in memory only, through the `x-yk-client` header, which `server.mjs` sets and which overwrites any value the client sends.
- Every free text is cleaned: control, bidi-override and zero-width characters are stripped, and length is capped. Sources must be `https:` URLs (at most 10). Both UIs render server data with `textContent` only, and links are created only for `https:`.
- CSRF: the `SameSite=Strict` cookie is scoped to the experts path. Every POST must have `content-type: application/json`, which a cross-site HTML form cannot send without a CORS preflight, and no CORS is enabled. A present `Origin` header must match the host.
- Abuse guard: 5 questions per 10 min per client, 300 per hour globally, and at most 3000 unanswered questions in the queue.
- The AI never answers players here. It only *suggests* a level to the scholar, and every suggestion is labelled as needing review.

## Storage trade-offs
| | JSON file (`DATA_DIR`, default `./data`) | Firestore (`STORE=firestore`) |
|---|---|---|
| Setup | none | enable API + create DB (below) |
| Durability on Cloud Run | **lost on every restart / new revision; each instance has its own copy** (ok for a demo with `--max-instances=1`, not for real use) | durable, shared by all instances |
| Concurrency | serialised in one process; atomic writes (tmp + rename) | per-document writes; last write wins |
| Tested | yes (`tests/experts.test.mjs`) | REST adapter (no SDK dependency; token from the metadata server); not covered by unit tests |
| Cost | free | free tier is ample for a review queue |

Firestore documents live in the collections `yawmuk_questions` and `yawmuk_reviews`, one string field `json` per document.

## Deploy (Cloud Run): commands the human runs
Replace `<REGION>` and `<SERVICE>` with the existing service's values (`gcloud run services list`). The project is `madar-509706`.

```bash
PROJECT=madar-509706; REGION=<REGION>; SERVICE=<SERVICE>
gcloud config set project $PROJECT

# 1) Firestore (Native mode) + permission for the Cloud Run runtime service account
gcloud services enable firestore.googleapis.com
gcloud firestore databases create --database='(default)' --location=$REGION --type=firestore-native
SA=$(gcloud run services describe $SERVICE --region $REGION --format='value(spec.template.spec.serviceAccountName)')
[ -z "$SA" ] && SA="$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role=roles/datastore.user

# 2) Secrets (passcode: give it to the scholars out of band; session secret: random)
printf '%s' "$(openssl rand -base64 18)" | gcloud secrets create EXPERTS_PASSCODE --data-file=-
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create SESSION_SECRET --data-file=-
gcloud secrets add-iam-policy-binding EXPERTS_PASSCODE --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
gcloud secrets add-iam-policy-binding SESSION_SECRET  --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
gcloud secrets versions access latest --secret=EXPERTS_PASSCODE; echo   # read the passcode to hand to the scholars

# 3) Wire them into the service (keeps the existing ANTHROPIC_API_KEY secret)
gcloud run services update $SERVICE --region $REGION \
  --update-env-vars STORE=firestore,GOOGLE_CLOUD_PROJECT=$PROJECT \
  --update-secrets EXPERTS_PASSCODE=EXPERTS_PASSCODE:latest,SESSION_SECRET=SESSION_SECRET:latest
```
If Firestore is not enabled in time, leave out `STORE=firestore`. The JSON store then works, but deploy with `--max-instances=1` and accept that data resets on each new revision.

## Local check
```bash
npm run build
PORT=8099 DATA_DIR=./data EXPERTS_PASSCODE=dev-passcode SESSION_SECRET=dev-secret-please-change node server.mjs
# player panel: open the game, or in the console: import('/src/features/experts/index.js') under `npm run dev`
#   (the Vite dev server has no functions, so use the built server for the full loop)
# dashboard:   http://localhost:8099/experts
npm test   # tests/experts.test.mjs covers store, API, auth, CSRF, triage, publishing
```

## For the guide / voice agent (consuming public answers)
Fetch `GET /.netlify/functions/questions?public=1` once per session (it is cached for 60 s). Use the passages as extra
retrieval items with `boost: 0`. Their ids (`x:<ticket>`) already pass `ask.mjs`'s id filter
`/^[a-z]:[\w.:-]{1,80}$/i`. **Truncate `text` to 1200 chars**, as `ask.mjs` does. Show `reviewer`/`title` and
`sources` when such a passage is cited. Never add triage output to passages: only scholar-written, published answers.
