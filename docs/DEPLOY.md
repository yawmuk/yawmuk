# Deploying «يومك» Yawmuk · النشر

There are two ways to deploy:

| | **Google Cloud Run (recommended, used for judging)** | **Netlify (partial alternative)** |
|---|---|---|
| Game, ruling cards, mosque, bank, adhkar, prayer times, Quran | yes | yes |
| AI journey planner, «Ask» panel, «Ask Omar» guide (text + voice) | yes | yes |
| Scholar dashboard `/experts` and the «Ask a scholar» queue | yes (Firestore) | **no**: `/experts.html` loads, but nothing persists (the functions have no durable store) |
| Opt-in micro-study and `/results.html` | yes (Firestore) | **no**: there is no durable store |

`server.mjs` serves `dist/` and mounts **every** `netlify/functions/*.mjs` at `/.netlify/functions/<name>`, so the browser code is the same on both hosts. The `Dockerfile` builds the game and runs `node server.mjs` on port 8080.

---

## 1. Cloud Run

### What you need
- `gcloud` logged in with access to the project, and a billing account.
- For the current deployment, Gemini on Vertex AI uses the Cloud Run service account. See README.md for the current Vertex setup; an Anthropic API key is an optional alternative injected through Secret Manager.
- About 10 minutes for the first deploy. Each later deploy takes 3 to 5 minutes.

### Variables

| Name | Kind | Required | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | secret | recommended | Claude for the planner, Ask, guide and scholar triage. Without it, see «LLM provider» below. |
| `EXPERTS_PASSCODE` | secret | for `/experts` | Shared passcode for the scholar dashboard. Hand it to scholars and judges out of band, never in the README. |
| `SESSION_SECRET` | secret | for `/experts` | HMAC key for the dashboard session cookie (random, 32+ bytes). |
| `STUDY_ADMIN_KEY` | secret | optional | Unlocks free-text comments in the study CSV export. Leave it unset and free text is never exported. |
| `STORE` | env | yes on Cloud Run | `firestore` gives durable storage shared by all instances. With no value, the JSON files in `DATA_DIR` are lost on every restart. |
| `GOOGLE_CLOUD_PROJECT` | env | with Firestore/Vertex | Project id. If it is not set, the server reads it from the metadata server. |
| `YAWMUK_MODEL` | env | optional | Claude model id. The default is `claude-sonnet-5-5`. |
| `LLM_PROVIDER` | env | optional | `claude` or `vertex`. Leave it unset for automatic selection (see below). |

### LLM provider
`netlify/lib/claude.mjs` decides which provider handles each call:
- If `ANTHROPIC_API_KEY` is set, the call goes to **Claude** through the Anthropic API.
- If no key is set and the server runs on Cloud Run (`K_SERVICE`), or if `LLM_PROVIDER=vertex`, the call goes to **Gemini on Vertex AI** (`netlify/lib/vertex.mjs`, default `gemini-3-flash-preview` with `gemini-2.5-flash` as the retry). This path uses the service account and needs no key, but it does need the Vertex AI API and `roles/aiplatform.user` (step 3 below).
- Both providers go through the same structured-output contract and the same validators (`src/engine/aiCore.js`). If both fail, the game uses its deterministic fallbacks: the default plan and the verbatim reviewed passages.

### Commands

```bash
PROJECT=madar-509706           # the existing project; change if you deploy elsewhere
REGION=us-central1             # Doha. me-central2 (Dammam) keeps data in the Kingdom if Cloud Run/Firestore are offered there for your project
SERVICE=yawmuk
gcloud config set project $PROJECT

# 1) APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com firestore.googleapis.com

# 2) Runtime service account (the default compute SA unless you use a dedicated one)
SA="$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

# 3) Firestore (Native) for the scholar queue, reviews and study records.
#    The command rejects a location Firestore does not offer; if so, pick the nearest one it lists.
gcloud firestore databases create --database='(default)' --location=$REGION --type=firestore-native
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role=roles/datastore.user
#    Optional: Gemini fallback when no Anthropic key is configured
gcloud services enable aiplatform.googleapis.com
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$SA" --role=roles/aiplatform.user

# 4) Secrets (values are typed or generated here, never written to a file in the repo)
read -rs KEY && printf '%s' "$KEY" | gcloud secrets create ANTHROPIC_API_KEY --data-file=- ; unset KEY
printf '%s' "$(openssl rand -base64 18)" | gcloud secrets create EXPERTS_PASSCODE --data-file=-
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create SESSION_SECRET --data-file=-
for S in ANTHROPIC_API_KEY EXPERTS_PASSCODE SESSION_SECRET; do
  gcloud secrets add-iam-policy-binding $S --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
done
#    (If a secret already exists: `gcloud secrets versions add <NAME> --data-file=-` instead of `create`.)

# 5) Build from source (uses the Dockerfile) and deploy
gcloud run deploy $SERVICE --source . --region $REGION --allow-unauthenticated \
  --port 8080 --cpu 1 --memory 512Mi \
  --min-instances 1 --max-instances 4 --concurrency 80 --timeout 60 \
  --set-env-vars STORE=firestore,GOOGLE_CLOUD_PROJECT=$PROJECT \
  --set-secrets ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,EXPERTS_PASSCODE=EXPERTS_PASSCODE:latest,SESSION_SECRET=SESSION_SECRET:latest

# 6) Passcode to hand to scholars and judges (out of band, e.g. in the submission form)
gcloud secrets versions access latest --secret=EXPERTS_PASSCODE; echo
```

Notes:
- **`--min-instances 1`** keeps one instance warm so a judge never waits for a cold start or finds the service idle. It costs money while idle; see [OPERATIONS.md](OPERATIONS.md#2-hosting).
- **If Firestore is not ready in time**, leave out `STORE=firestore` and deploy with `--max-instances 1`. The JSON file store then works on one instance, but **its data resets on every new revision**. This trade-off is also recorded in [EXPERTS.md](EXPERTS.md).
- **Updating an existing service** without retyping everything: `gcloud run deploy $SERVICE --source . --region $REGION` keeps the env vars and secrets of the previous revision.

### Smoke test after deploy (2 minutes)

```bash
URL=$(gcloud run services describe $SERVICE --region $REGION --format='value(status.url)')
curl -sI "$URL/" | head -1                                   # 200
curl -sI "$URL/experts" | grep -i x-frame-options            # DENY
curl -s  "$URL/.netlify/functions/experts?view=reviews"      # {"reviews":{...}}
curl -s  "$URL/.netlify/functions/study?view=aggregate" | head -c 200
curl -s -X POST "$URL/.netlify/functions/plan" -H 'content-type: application/json' \
  -d '{"lang":"en","topics":["money"]}' | head -c 300          # a journey, or {"error":...} if no provider (the game then falls back)
```
Then follow the 3-minute judge path in the [README](../README.md) («For judges: verify in 3 minutes»).

### Rollback
`gcloud run services update-traffic $SERVICE --region $REGION --to-revisions <PREVIOUS_REVISION>=100`; list revisions with `gcloud run revisions list --service $SERVICE --region $REGION`.

---

## 2. Netlify (game + AI only)

1. Netlify → **Add new site → Import an existing project** → GitHub → `B4r4k4/yawmuk`.
2. Build settings come from `netlify.toml`: build `npm run build`, publish `dist`, functions `netlify/functions`, Node 22.
3. **Site configuration → Environment variables:** set `ANTHROPIC_API_KEY`, scoped to Functions.
4. Deploy, then check the start screen, one full situation, a ruling card, the «Ask» panel and its abstain case, and the mosque.

On Netlify the functions run statelessly. «Ask a scholar» submissions, the `/experts` dashboard and the study cannot persist data there, so use Cloud Run for the full human-review loop.

## 3. Local

```bash
npm ci && npm run build
PORT=8099 DATA_DIR=./data EXPERTS_PASSCODE=dev-passcode SESSION_SECRET=dev-secret-please-change node server.mjs
# game:      http://localhost:8099/?scene=town&nointro=1
# dashboard: http://localhost:8099/experts   (passcode: dev-passcode)
# results:   http://localhost:8099/results.html
```
To try the AI locally, also export `ANTHROPIC_API_KEY` in that shell. Never write it to a committed file. Without a key the game uses its deterministic fallbacks.
