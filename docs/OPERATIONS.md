# Operating «يومك» Yawmuk · التشغيل والاستدامة

This document covers what it costs to run Yawmuk, what it depends on, what happens when a dependency fails, who does what, and how the content stays correct. Deployment steps are in [DEPLOY.md](DEPLOY.md).

> **Everything marked *estimate* is a calculation from the code, not a measured bill.** We give the method so anyone can redo the calculation. We have no production traffic yet, so there are no measured numbers.

---

## 1. AI running cost per 1,000 players (estimate)

### Method
1. **Prompt sizes** were measured from the source (`netlify/functions/*.mjs`, `src/features/guide/guideCore.js`) on 2026-10-06:

   | Call | System prompt | Per-request content (max) | `max_tokens` | When it runs |
   |---|---|---|---|---|
   | `plan` | 1,108 chars | situation catalogue 2,977 chars (3.4 KB, AR+EN titles) + day type/topics | 2,000 | Once per new day, **only** if the player picks a day context. "Ready-made day" makes no call. |
   | `guide` | 1,896 chars | ≤ 6 retrieved passages × ≤ 1,000 chars, body capped at 12,000 bytes + question ≤ 300 chars | 1,500 | Per free-text question that **passes** the personal-fatwa, injection and coverage filters |
   | `ask` | 1,312 chars | ≤ 5 passages × ≤ 1,200 chars + question | 1,500 | Per free-text question in a card's Ask panel (same filters) |
   | `experts` triage | 917 chars | the question (≤ 1,000 chars) | 600 | Only when a scholar presses "AI triage" in the dashboard |

   Chips (pre-written questions), personal-case questions, injection attempts and uncovered questions **never call the model**.
2. **Token conversion (assumption):** about 4 characters per token for English and about 2.5 for Arabic. We add about 300 tokens for the structured-output schema and about 500 output tokens for low-effort thinking. The real counts vary; the API's `usage` field would give exact numbers, and we do not log it today.
> **Note:** the live deployment uses Gemini 3 Flash / 2.5 Flash on Vertex AI, billed at Google's rates (cloud.google.com/vertex-ai/generative-ai/pricing). The per-player figures below were computed at Claude Sonnet rates and should be re-measured from Cloud Billing after the first real sessions.

3. **Price:** Claude Sonnet 5.5 (`claude-sonnet-5-5`, the default `YAWMUK_MODEL`) is **USD 2 per million input tokens and USD 10 per million output tokens** (Anthropic list price as cached on 2026-09-25; check anthropic.com/pricing before budgeting).

### Per call (estimate)

| Call | Input tokens | Output tokens | Cost |
|---|---|---|---|
| `plan` | ~1,600 | ~1,200 (6–8 items, `why` in AR+EN, plus thinking) | ~$0.015 |
| `guide` | ~2,000–3,000 | ~600 (answer ≤ 900 chars + ids + thinking) | ~$0.010–0.012 |
| `ask` | ~2,000–2,800 | ~600 | ~$0.010–0.012 |
| triage | ~700 | ~300 | ~$0.004 |

### Per 1,000 players (estimate)

| Profile | Assumed AI calls per player | Per player | **Per 1,000 players** |
|---|---|---|---|
| Light | no plan, 1 question reaches the model | ~$0.012 | **~$12** |
| Typical | 1 plan + 3 questions reach the model | ~$0.05 | **~$50** |
| Heavy | 1 plan + 10 questions reach the model | ~$0.14 | **~$140** |

- Prompt caching is **not** used. The prefixes are short, so the saving would be small; caching the `plan` catalogue is a possible later optimisation.
- **Gemini on Vertex AI** (used when no Anthropic key is configured) is billed by Google at its own rates. See cloud.google.com/vertex-ai/generative-ai/pricing. We did not estimate it.
- **Guardrails on spend:** per-client and global rate limits in the functions, server-side caps on the request body (16 KB), question length (300 chars) and passage count, and `max_tokens` on every call. An Anthropic workspace spend limit is recommended as a hard ceiling.

## 2. Hosting

| Item | Estimate and method |
|---|---|
| Cloud Run, 1 always-on minimum instance (1 vCPU, 512 MiB) | Idle min instances are billed per vCPU-second and GiB-second at Google's idle rate, for about 2.63 M seconds a month. **Order of magnitude: USD 10–20 per month** (rough, from our reading of the published rates; confirm in the Google Cloud pricing calculator for `me-central1`). It can be set to 0 outside judging and events, which brings cold starts back. |
| Requests from 1,000 players | Small: about 5–15 function calls per player plus static files. Within Cloud Run's per-request pricing, it is cents. |
| Egress | `dist/` is 30 MB (28 MB of 3D assets, which load per scene). A typical session downloads roughly 10–25 MB, so **about 10–25 GB per 1,000 players**, priced at Google's internet-egress rate. A CDN in front of the static assets would cut most of it. |
| Firestore | Questions, reviews, study records and metrics are tiny documents. A few thousand reads and writes per 1,000 players fit in or near the free tier. |
| Quran text, translation and recitation; prayer times | **Free to us**: api.quran.com, quranenc.com and everyayah.com are called from the player's browser, and prayer times are computed on the device. |

**Total running cost (estimate):** about **USD 10–20 per month fixed**, plus **about USD 12–140 per 1,000 players** for AI depending on use, plus egress. This is low enough for a single mosque or da'wah centre budget.

## 3. Critical dependencies and fallbacks

| Dependency | If it fails | What the player sees | Where |
|---|---|---|---|
| **Claude API** (or no key) | `ANTHROPIC_API_KEY` missing on Cloud Run → Gemini on Vertex AI. Both fail, time out (5.5–9 s) or return invalid JSON → deterministic behaviour. | Planner: the default route, or a rule-based route built from the chosen topics. Guide/Ask: the closest **reviewed passage, shown verbatim**, or abstain + referral. Nothing breaks. | `netlify/lib/claude.mjs`, `vertex.mjs`, `src/engine/aiCore.js` (`fallbackPlan`), `src/features/guide/guideCore.js` (`fallbackPassages`) |
| **api.quran.com / quranenc.com** | Live fetch fails | Surahs 1, 112, 113 and 114 come from the bundled copy, fetched from the same sources by `tools/quran/fetch.mjs`, with a visible "offline copy" note. Other surahs show a clear error. **No text is ever generated.** | `src/features/quran/`, `content/quran/offline.json` |
| **everyayah.com** (recitation audio) | Audio fails to load | The text and translation still show, and the play button reports the error. | `src/features/quran/` |
| **Web Speech API** (Firefox, some mobile browsers, mic denied) | Recognition is unsupported or denied | The mic button is hidden or explains why. Text input always works. | `src/features/voice/` |
| **Prayer times** | No network needed (adhan-js runs on the device). Autoplay blocked by the browser → "tap to listen". | Times always show; the adhan plays on the next tap. | `src/features/prayer/` |
| **Firestore** | Not enabled → `STORE` unset → JSON files on the instance | Works, but the data resets on each new revision. Deploy with `--max-instances 1` in that case ([EXPERTS.md](EXPERTS.md)). | `netlify/lib/store.mjs` |
| **Cloud Run region outage** | Redeploy to another region from the same source; Netlify is the static/AI-only backup ([DEPLOY.md](DEPLOY.md)). | The scholar queue lives in Firestore and is not lost. | |

## 4. Content maintenance workflow

Religious content changes only through **people with the right role**, and every change passes the automated checks before release.

```
question from a player ──► scholar queue (/experts) ──► scholar answers with sources ──► optionally "publish"
        │                                                                                    │
        │                                         published answer becomes a reviewed passage the guide may cite
        ▼
recurring gaps ──► content editor drafts a new / revised ruling in content/rulings/*.json
                   (Quran/hadith fetched from approved sources, never typed; sources.json entry with URL, number, grade)
                ──► npm run audit (letter-by-letter re-check + links) ──► npm test (levels, safety, tiers)
                ──► scholar records a review on the card in /experts (verdict + name + date)
                ──► deploy; the card shows «Reviewed by …» only from that record
```

- **Scholar review of the 18 existing cards** is the first job. The 4 `ai_draft` cards come first, using the prioritised list in [`audit/phase1_audit.md`](audit/phase1_audit.md). A `needs_changes` review withdraws the "Reviewed by" label until the card is fixed.
- **Source tiers:** `node tools/eval/source_tiers.mjs --check` fails if any source lacks a tier. Secondary sources are kept, labelled, and replaced over time with sources from the reference package (dorar.net, quranpedia.net, shamela.ws, dawa.center, islamic-content.com, quranenc.com).
- **Quran bundle refresh:** `node tools/quran/fetch.mjs`. It re-downloads and cross-checks; never hand-edit the bundle.
- **Release cadence:** content changes are batched monthly, or sooner for a correction. Each release requires `npm test` and `npm run audit` to pass.

## 5. Roles

| Role | Who (target) | Does |
|---|---|---|
| **Scholar panel** | 2–3 qualified scholars from the hosting organisation | Answers the queue, reviews cards, decides what is published. Holds the dashboard passcode. |
| **Content editor** | A trained student of knowledge | Drafts rulings and Q&A from approved sources, runs the audit, prepares changes for the scholars. |
| **Maintainer** | Lemonada (developer) | Deploys, monitors cost and errors, rotates secrets, keeps dependencies updated. |
| **Host organisation** | A mosque or da'wah centre (see §6) | Owns the content and the scholar panel, runs events, decides the roadmap. |

**Security routine:** rotate `EXPERTS_PASSCODE` when a panel member leaves (`gcloud secrets versions add`). Never share the passcode in chat logs or documents. Review the Cloud Run logs weekly; they contain no question text by design.

## 6. Adoption plan (no partnership is claimed)

We have **no signed partner today**. This is the plan to get one.

1. **Target hosts:** mosques and Islamic centres in North America that already run **open-house** days, new-Muslim classes or interfaith visits, and university **MSAs** (Muslim Student Associations) that run Islam Awareness Weeks. These hosts already meet curious newcomers, which is exactly Yawmuk's audience.
2. **Offer:** a free, branded deployment. The host's scholars run the review dashboard, the host's name appears on the end screen ("visit us"), and the host can see anonymous aggregate study results.
3. **Pilot shape (4 weeks):** one host, a QR code at the open house and on the welcome desk, and the opt-in study switched on (`?study=1`). Success means the track metrics in the README: understanding gain, completion, next-step clarity, and zero critical safety failures.
4. **Scale:** add situations and languages through the same pipeline, with each new host bringing its own scholar panel.
5. **Funding (to be sought):** hosting costs (§1–2) are small enough for a host's own budget or a da'wah grant.

## 7. What we monitor

- Function error rate and latency in Cloud Run metrics. A high `plan`/`guide` error rate means the fallbacks are carrying the load.
- AI spend in the Anthropic console against the workspace limit.
- Queue size and age in `/experts` (unanswered questions older than 7 days).
- `/results.html` for study completion. We never edit or seed data.
