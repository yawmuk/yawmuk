# AI in «يومك» Yawmuk — architecture, safety and privacy

The game uses AI in exactly two narrow places, and both are optional:

1. **Journey planner** — arranges the order of the day from the reviewed situation library, for a player who picked a kind of day and/or topics on the start screen.
2. **"Ask about this"** — answers a newcomer's free-text question **only from reviewed passages** (pre-authored Q&A + the current ruling card), or refers/abstains.

The AI never writes religious text, never cites sources on its own, and never gives a fatwa. Everything it returns is validated twice (server + browser). If anything fails, the game uses deterministic, pre-authored behaviour, so the demo works with no key, no network and no Netlify.

> **Live deployment (6 Oct 2026):** the public site runs **Gemini 3 Flash (`gemini-3-flash-preview`) on Google Cloud Vertex AI**, retried once on **Gemini 2.5 Flash** on timeout/error (`netlify/lib/vertex.mjs`). Auth is the Cloud Run service account `yawmuk-runtime` (role `aiplatform.user` only), so no API key exists anywhere. Same prompts, JSON schemas and validators as below; the Claude path remains supported when `ANTHROPIC_API_KEY` is set. Verified live on the production URL: grounded answer with source id, "give me a hadith" → no fabrication, personal case → referral, off-topic → abstain, prompt injection → ignored.

## Architecture

```
 Browser (static Vite build, no secrets)                         Netlify Functions (server, ANTHROPIC_API_KEY)
 ───────────────────────────────────────                          ─────────────────────────────────────────────
 Start screen ─ optional context {dayType, topics[]}
      │  (Ready-made day / nothing chosen / ?arm=fixed  →  default order, NO network call)
      ▼
 planner.js ── POST /.netlify/functions/plan {lang,dayType,topics} ──►  plan.mjs
      │        6 s timeout                                              builds a compact catalog: id, titles,
      │                                                                 topic tags, location (no scripture)
      │                                                                 → Claude (structured JSON output)
      │                                                                 → validatePlan (ids, dedupe, why rules)
      │  ◄── {journey:[{situation_id, why{ar,en}}], followup} ──────────┘
      ▼
 aiCore.validatePlan  (ids ∈ catalog, dedupe, why ≤160 chars, no quotes/scripture,
                       every ruling citation resolves in content/sources.json, ≥1 item)
      │ fail → aiCore.fallbackPlan (deterministic)
      ▼
 location order = journey locations first, then every missing location  (all 6 stay reachable)
 HUD badge: "AI-arranged from a reviewed library" | "Default plan"

 Ruling card / HUD "Ask" ─ askPanel.js
      ├─ chips → pre-authored answer (questions.json) + resolved sources.json citations + referral
      └─ free text (≤300 chars, never stored)
           ├─ personal-fatwa pre-filter (هل يجوز لي | أنا في … | نحن في … | زوجي/أمي … | أريد أن … ما رأيكم | I live/work in … | is it okay to take this … | my husband/boss … | should I) → fixed referral, no model
           ├─ BM25 retrieval over reviewed passages (Q&A + summary + practical guidance +
           │   when-to-ask-a-scholar + plain-words text)          none → abstain + referral
           └─ POST /.netlify/functions/ask {lang, question, passages[{id,text}]} ─► ask.mjs
                                                                     → Claude (answer ONLY from passages, JSON)
                                                                     → validateAnswer
              ◄── {answer, used_ids, refer, abstain} ────────────────┘
           aiCore.validateAnswer (used_ids ⊆ sent ids, no scripture / verse refs / links) → else abstain
           no endpoint / failure → closest pre-authored answer, else abstain + referral

 Summary (consent toggle, default OFF) ── POST /.netlify/functions/metrics {arm,completed,pre,post,clarity} ─► metrics.mjs (log, 204)
```

Files: `src/engine/aiCore.js` (all validators, pure, shared by browser/functions/tests), `src/engine/planner.js`, `src/engine/ui/askPanel.js`, `src/engine/tts.js`, `src/engine/metrics.js`, `netlify/functions/{plan,ask,metrics}.mjs`, `netlify/lib/claude.mjs`, `tests/ai.test.mjs`.

## What is sent to the model

| Call | Sent | Never sent |
|---|---|---|
| `plan` | The 18 situation ids, their Arabic/English titles, topic tags, location; the chosen day type and topics; UI language. | Quran/hadith text, rulings, any player data, progress, IP-derived data. |
| `ask` | The question (≤300 chars) and up to 5 retrieved passages (ids + text, each ≤1200 chars) in the UI language. | Player history, other questions, identity. |
| `metrics` | Not a model call. Only `{arm, completed, pre, post, clarity}`, and only after opt-in. | Ids, belief, free text, user agent. |

Model: `YAWMUK_MODEL` (default `claude-sonnet-5-5`), via the official `@anthropic-ai/sdk` on the server, with structured outputs (`output_config.format` JSON schema; situation ids and passage ids are `enum`s), `effort: low` for latency, server-side refusal fallback (`fallbacks: "default"`; retried without it if the platform rejects that parameter). A refusal, `max_tokens` stop, API error or invalid JSON → the function returns an error → the browser falls back.

## Reliability and scientific safety (reference package)

- **Level D never reaches the model.** `isPersonalFatwa` (`src/engine/aiCore.js`) catches questions about the asker's own case in Arabic (normalised: «أنا في …»، «نحن في …»، «هل يجوز لي»، «زوجي/زوجتي/أمي/ابني …»، «أريد أن … ما رأيكم»، «ماذا أفعل») and English ("I live/work/am in …", "is it okay/halal to <verb> this/my …", "my husband/wife/father/boss …", "should I", "can I"). General questions ("What is riba?", "Is it halal to eat shrimp?", «ما حكم الربا؟») pass. Positive and negative cases are in `tests/reliability.test.mjs`.
- **No automated tarjih on level C (ج).** Every contested ruling carries a bilingual `verdict_scope` that names who holds each view (e.g. International Islamic Fiqh Academy Resolution 50 (1/6); AAOIFI Shari'ah Standard 21; AMJA fatwa numbers) and labels the minority view as such; level-C rulings never carry `confidence: "high"`. The models are told to present differences as the passages do and never pick a side.
- **Source tiers.** Each record in `content/sources.json` is tagged `approved_package` (sites the package names: dorar.net, quranpedia.net, shamela.ws, dawa.center/بينات, islamic-content.com/الجمهرة, the King Fahd Complex Mushaf text via quranenc.com, hadith of the two Sahihs) or `secondary`, by `node tools/eval/source_tiers.mjs`. Objection-type answers (Kaaba, authorship of the Quran, spread by the sword, why scholars differ) cite بينات by question number and PDF page; term translation cites the Jamhara dictionary entry.
- **Eval of the package's 12 test cases.** `tests/eval/package_cases.json` + `node tools/eval/run_package_eval.mjs [--base <url> --n 3]`. Offline mode (no model) checks routing, retrieval grounding and the deterministic guards; online mode sends each case in Arabic and English N times to `/guide` and `/ask` and checks refer / abstain / no fabricated hadith / used_ids. Results: [`docs/EVAL.md`](EVAL.md) (online results are marked pending until run against the deployed URL).

## Validation rules

**Plan** (`validatePlan`, run in the function and again in the browser): drop ids not in the catalog; drop duplicates; each `why` must be `{ar,en}`, non-empty, ≤160 chars, no quote marks (`" “ ” « » ﴿ ﴾`), none of the words Quran/hadith/sunnah/آية/حديث/قرآن/fatwa/فتوى, no «قال الله» / «قال رسول», and no scripture pattern (the same detector patterns as `tests/safety.test.mjs` plus verse references and heavily vocalised Arabic); every kept situation's Quran citations must resolve to records in `content/sources.json` (browser side); at least one item must remain.

**Answer** (`validateAnswer`): abstain unless `used_ids` is non-empty and ⊆ the ids actually sent; abstain on scripture-like text, verse/hadith references, `https://` links, empty or >900-char answers, or when the model abstained. A valid answer is shown with the label "AI answer from reviewed material" and the passages it relied on (plus their resolved sources).

**Personal fatwa**: questions about the player's own case are caught before retrieval and get a fixed referral to a trusted scholar/local imam — the model is not called (the function repeats the check).

## Fallback behaviour

| Situation | Result |
|---|---|
| No context chosen, "Ready-made day", or `?arm=fixed` | Default order (home → work → school → street → public events → private events), no network call. |
| Context chosen, function missing / no key / timeout (6 s) / invalid output | Deterministic rule-based plan: situations sorted by number of matching topics, then day-type locations, then default order. |
| Ask panel without endpoint | Closest pre-authored answer (BM25), else abstain + referral. |
| `questions.json` missing or empty | No chips ("No prepared questions here yet"); free text still answers from the ruling's passages or abstains. |

The e2e playthrough relies on the default order; with no context the fallback equals it exactly (unit-tested).

## Privacy

- No account, no belief question, nothing about religion is stored. The context picker only offers a kind of day and everyday topics.
- Questions typed in the ask panel are not stored (not in localStorage, not logged by the function).
- `localStorage` (`yawmuk.progress.v1`) additionally keeps `plan` (location order, source, situation ids + short reasons) and `pre` (whether each pre-check answer was correct).
- Metrics are opt-in (toggle default OFF) and anonymous; the function re-normalises the payload to five fields and logs it.
- The API key lives only in Netlify environment variables; the browser bundle never contains it (functions are a separate build; `dist/` has no `@anthropic-ai/sdk`).

## Read-aloud and A/B

- 🔊 buttons (browser `speechSynthesis`, `ar-SA` / `en-US`) on dialogue lines, the "In plain words" box and Q&A answers. Nothing is spoken automatically; the buttons are hidden when the browser has no speech support.
- `?arm=fixed` forces the fixed journey. The consented metric records `arm: "ai"` when the AI plan was used, else `"fixed"`, with pre/post check scores (0–3) and the "Is your next step clear?" rating (1–5).

## Running locally

```bash
npm install
npm run dev                 # game only: functions are absent → every AI feature uses its fallback
# optional, with the functions:
cp .env.example .env        # put ANTHROPIC_API_KEY=... in .env (never commit it)
npx netlify dev             # serves Vite + /.netlify/functions/* on one port
npm test                    # includes tests/ai.test.mjs (validators + fallback, no network)
```

Deploy: `netlify.toml` (build `npm run build`, publish `dist`, functions `netlify/functions`, Node 22). Set `ANTHROPIC_API_KEY` (and optionally `YAWMUK_MODEL`) in **Site settings → Environment variables**.

## Cost estimate (claude-sonnet-5-5: $2 / MTok input, $10 / MTok output)

| Call | Input | Output (incl. low-effort thinking) | ≈ Cost |
|---|---|---|---|
| plan (once per personalised day) | ~2,000 tokens | ~1,000 | ~$0.014 |
| ask (per free-text question) | ~1,800 | ~600 | ~$0.010 |

1,000 players × (1 plan + 3 questions) ≈ **$45**. Chips, pre-authored answers, the personal-fatwa referral and every fallback cost nothing. There is no rate limiting yet; for a public launch add Netlify rate limiting or a per-IP quota on the two functions.

## Fixed routes that never call the model (guide and Ask)

Before any model call, `src/features/guide/guideCore.js` (`routeQuestion`) and the server pre-routes (`netlify/functions/guide.mjs` `preRoute`, `ask.mjs`) send these to fixed, pre-written replies:

| Route | Trigger | Reply |
|---|---|---|
| `personal` | the asker's own case (`isPersonalFatwa` in `src/engine/aiCore.js`: «عندي…», «صلاتي…», «حلفت…», "where I live", "Am I…", "my prayer/contract…") | referral + "send to scholars"; related reviewed cards only when they clearly match (coverage ≥ 0.5) |
| `judge` | asking to declare a named person or group a disbeliever, innovator, hypocrite… (`judgesPeople`); ordinary fiqh questions that mention a group are not caught | "not something I do; ask qualified scholars" |
| `injection` | override / role-play attempts (`looksLikeInjection`) | scope reply |
| `evidence` | "give me / write me a hadith or verse that proves…" (`asksForEvidence`) | "I don't produce verses or hadith on request; verified evidence is on the ruling cards" + matching cards |

With no API key the functions return **HTTP 200 `{ "error": "no_key", "unavailable": true }`** (not 503), and the browser shows the reviewed passages verbatim, followed by the "general information, not a fatwa" line and the "send to scholars" button. Regression tests: `tests/safety-guards.test.mjs`; the package eval (`docs/EVAL.md`) runs the same guards.

