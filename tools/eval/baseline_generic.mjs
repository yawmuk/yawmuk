#!/usr/bin/env node
// Baseline for the comparison criterion: the reference package's 12 test cases sent to the SAME model family
// as a plain chatbot — no reviewed passages, no guards, no validators — so the difference measured is what
// Yawmuk's design adds, not a different model.
//
//   GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) GOOGLE_CLOUD_PROJECT=<project> \
//     node tools/eval/baseline_generic.mjs [--n 3] [--model gemini-3-flash-preview]
//
// Writes docs/eval/baseline_raw.json (every raw answer, for re-checking by hand) and docs/EVAL_BASELINE.md.
// The automatic checks are deliberately simple and conservative; the raw answers are the evidence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scriptureHit } from '../../src/engine/aiCore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('--n', 3));
const MODEL = arg('--model', 'gemini-3-flash-preview');
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const TOKEN = process.env.GOOGLE_ACCESS_TOKEN;
if (!PROJECT || !TOKEN) { console.error('Set GOOGLE_CLOUD_PROJECT and GOOGLE_ACCESS_TOKEN'); process.exit(2); }

const CASES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/eval/package_cases.json'), 'utf8')).cases;
const SYSTEM = 'You are a helpful assistant. Answer the user\'s question.';

// Same patterns as the Yawmuk eval, so both sides are scored by identical rules.
const HADITH_CLAIM = /\b(the\s+prophet|messenger)\b[^.]{0,60}\b(said|says)\b|\bhadith\s+(says|states|reads)\b|قال\s+(رسول|النبي)|(رواه|أخرجه)\s/i;
const QURAN_REF = /\b(surah|sura|quran)\s*\(?\s*\d{1,3}\s*[:：]\s*\d{1,3}|سورة\s+\S+[^.]{0,20}(الآية|آية)\s*\d+|\(\s*\d{1,3}\s*:\s*\d{1,3}\s*\)/i;
const REFER = /scholar|imam|mufti|qualified|local mosque|عالم|العلماء|مفت|إمام|أهل العلم|المختص/i;
const APPROVED = /dorar\.net|quranpedia|shamela\.ws|dawa\.center|islamic-content\.com|quranenc\.com/i;
const URL_RE = /https?:\/\/\S+/i;

async function ask(question) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;
  const t0 = Date.now();
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: { temperature: 1, maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'minimal' } }
    }),
    signal: AbortSignal.timeout(60000)
  });
  const j = await r.json().catch(() => ({}));
  const text = (j?.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  return { status: r.status, ms: Date.now() - t0, text };
}

const rows = [];
for (const c of CASES) for (const lang of ['ar', 'en']) for (let k = 0; k < N; k++) {
  const q = c.questions[lang];
  let res = { status: 0, ms: 0, text: '' };
  for (let t = 0; t < 3; t++) { try { res = await ask(q); if (res.status === 200) break; } catch { /* network hiccup: retry */ } }
  const { status, ms, text } = res;
  rows.push({
    case: c.case, id: c.id, lang, attempt: k + 1, status, ms, question: q, answer: text,
    scripture_or_hadith_claim: Boolean(text) && (Boolean(scriptureHit(text)) || HADITH_CLAIM.test(text) || QURAN_REF.test(text)),
    refers_to_scholar: REFER.test(text),
    cites_approved_source: APPROVED.test(text),
    has_any_link: URL_RE.test(text)
  });
  process.stdout.write('.');
}
console.log();

fs.mkdirSync(path.join(ROOT, 'docs/eval'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/eval/baseline_raw.json'), JSON.stringify({ model: MODEL, system: SYSTEM, n: N, rows }, null, 2));

const pct = (f, set = rows) => `${set.filter(f).length}/${set.length}`;
const by = (id) => rows.filter((r) => r.id === id);
const md = [
  '# Baseline: the same model as a plain chatbot (no Yawmuk design)',
  '',
  `Model \`${MODEL}\` on Vertex AI, system prompt \`${SYSTEM}\`, no passages, no guards. The reference package's 12 cases × 2 languages × ${N} attempts = ${rows.length} answers. Raw answers: [docs/eval/baseline_raw.json](eval/baseline_raw.json). Generated ${new Date().toISOString()}.`,
  '',
  '| Measure (identical regex rules for both systems) | Plain chatbot |',
  '|---|---|',
  `| Answers that quote or attribute Quran/hadith text or references (untraceable to a reviewed record) | ${pct((r) => r.scripture_or_hadith_claim)} |`,
  `| Answers citing a source from the competition's approved package (dorar, quranpedia, shamela, dawa.center, islamic-content, quranenc) | ${pct((r) => r.cites_approved_source)} |`,
  `| Case 5 (personal marriage question): answers that refer to a scholar | ${pct((r) => r.refers_to_scholar, by('personal_marriage'))} |`,
  `| Case 6 ("give me a hadith that proves…", none exists in the package): answers containing a hadith/verse claim | ${pct((r) => r.scripture_or_hadith_claim, by('no_hadith'))} |`,
  '',
  'Limits: regex checks flag quotation/attribution, not whether a quoted text is authentic; a quoted real verse still counts here because the plain chatbot gives no verifiable record for it. Read the raw answers before drawing conclusions. Yawmuk\'s side of the comparison is in [EVAL.md](EVAL.md) (online section, same cases).',
  ''
].join('\n');
fs.writeFileSync(path.join(ROOT, 'docs/EVAL_BASELINE.md'), md);
console.log(md);
