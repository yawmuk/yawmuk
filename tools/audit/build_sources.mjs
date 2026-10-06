#!/usr/bin/env node
// Builds content/sources.json (unified source registry) from content/rulings/*.json.
// Inputs: verify.mjs results (run inline via --json), tools/audit/.cache/links.json (from links.mjs --json),
//         tools/audit/manual_verifications.json, the MANUAL_CONTEMPORARY list below (sources the auditor read directly),
//         and the EXISTING content/sources.json: entries cited by the Q&A bank (used_in ids "qa.*", from
//         content/script/questions.json) are preserved and merged, never dropped.
// Run:   node tools/audit/links.mjs --json > tools/audit/.cache/links.json ; node tools/audit/build_sources.mjs ; npm run sources
//
// Every record carries (schema promised in the proposal):
//   id, type, citation, url, text {ar, en?}, location, edition, review_status, verified, verified_how, used_in, checked_at
//   + grade, grader (and dorar_url / hadeethenc_url / sunnah_url / dorar_ref where present) for hadith.
//   review_status: "machine_verified" (text/grade matched against the source by verify.mjs or by the auditor),
//                  "pending_human" (not matched; a human must check), "reviewed" (a human scholar signed off — none yet).
// Owner decision 2026-10-06: no references to other religions anywhere (the former Christian-practice records are gone).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIR = path.join(ROOT, 'content', 'rulings');
const OUT = path.join(ROOT, 'content', 'sources.json');
const CACHE = path.join(HERE, '.cache');
const CHECKED_AT = '2026-10-06';
const QURAN_EDITION = 'Arabic: Madinah Mushaf (Hafs) Uthmani text of the King Fahd Glorious Qur\'an Printing Complex, as served by quranenc.com; English: Saheeh International, issued by Noor International Center, as hosted by QuranEnc (quranenc.com translation key "english_saheeh"), footnote markers omitted.';

let verify = [];
try { verify = JSON.parse(execFileSync(process.execPath, [path.join(HERE, 'verify.mjs'), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 })); }
catch (e) { verify = JSON.parse(e.stdout || '[]'); }
const links = fs.existsSync(path.join(CACHE, 'links.json')) ? JSON.parse(fs.readFileSync(path.join(CACHE, 'links.json'), 'utf8')) : [];
const linkStatus = u => links.find(l => l.url === u)?.level;
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];

// Contemporary sources the auditor opened and read directly on 2026-10-05 (match on decision_ref/body substring).
const MANUAL_CONTEMPORARY = [
  { m: /127/, b: /مجمع الفقه الإسلامي الدولي/, how: 'Auditor read the official IIFA page (ar/2114, en/32854): resolution 127 on competition cards, Doha Jan 2003; text matches. Arabic page numbers it (14/1), English page (1/14).' },
  { m: /210/, b: /مجمع الفقه/, how: 'Auditor read iifa-aifi.org/en/33099: Resolution 210 (6/22), Kuwait, 22-25 March 2015; wine-food ban, solvent-alcohol permission and gelatin deferral match.' },
  { m: /هيوستن|2014/, b: /AMJA/, how: 'Auditor read the AMJA Resident Fatwa Committee resolution (Houston, 15-17 Sep 2014); company tiers match (Mubarak Mortgage and Neeyah added).' },
  { m: /المؤتمر السنوي التاسع/, b: /AMJA/, how: 'Auditor extracted the PDF text: 9th annual AMJA conference on foods/medicines; beef/lamb ban, poultry concession, gelatin and alcohol clauses match.' },
  { m: /22801/, b: /AMJA/, how: 'Auditor read amjaonline.org fatwa 22801 (Dr. Salah Al-Sawy, 6 Aug 2007); content matches.' },
  { m: /78565/, b: /AMJA/, how: 'Auditor read amjaonline.org fatwa 78565 (Dr. Main Khalid Al-Qudah, 14 Apr 2009); content matches.' },
];

const reg = new Map();
const add = (id, obj, rulingId) => {
  if (!reg.has(id)) reg.set(id, { id, ...obj, used_in: [], checked_at: CHECKED_AT });
  const e = reg.get(id);
  if (!e.used_in.includes(rulingId)) e.used_in.push(rulingId);
};
const slug = s => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);
const status = ok => (ok ? 'machine_verified' : 'pending_human');

for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
  for (const r of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
    for (const q of r.quran || []) {
      const k = `${q.surah}:${q.ayah}`;
      const res = verify.filter(v => /^quran/.test(v.kind) && v.ref === k && v.ruling === r.id);
      const ok = res.length && res.every(v => v.level === 'PASS');
      add(`quran:${k}`, {
        type: 'quran',
        citation: `القرآن الكريم، سورة ${q.surah_name_ar} (${q.surah})، الآية ${q.ayah} — نص مصحف المدينة النبوية (مجمع الملك فهد لطباعة المصحف الشريف)؛ الترجمة: صحيح إنترناشيونال — مركز نور الدولي (عبر موسوعة القرآن الكريم quranenc.com)`,
        url: q.source_url, verified: !!ok, review_status: status(ok),
        text: { ar: q.text_ar, en: q.translation_en },
        location: `${q.surah}:${q.ayah}`,
        edition: QURAN_EDITION,
        verified_how: ok ? 'verify.mjs: text_ar re-fetched from quranenc.com API (King Fahd Complex) and matched exactly; letters cross-checked against Tanzil quran-uthmani (api.alquran.cloud); translation_en matched quranenc english_saheeh.' : 'verify.mjs FAILED or not run',
      }, r.id);
    }
    for (const h of r.hadith || []) {
      const ref = `${h.collection} ${h.number}`;
      const res = verify.filter(v => v.ruling === r.id && v.ref === ref && /^hadith/.test(v.kind));
      const ok = res.length && res.every(v => v.level === 'PASS');
      const how = res.map(v => v.msg).join(' | ');
      const rec = {
        type: 'hadith', citation: `${h.collection}، رقم ${h.number} — عن ${h.narrator}؛ الدرجة: ${h.grade} (${h.grader})`,
        url: String(h.source_url).split(/\s*;\s*/)[0], verified: !!ok, review_status: status(ok),
        text: { ar: h.text_ar, en: h.translation_en },
        location: `${h.collection}، رقم ${h.number}` + (h.dorar_ref ? ` — الدرر السنية: ${h.dorar_ref}` : ''),
        grade: h.grade, grader: h.grader,
        edition: `Arabic: sunnah.com text (identical to fawazahmed0/hadith-api; Muslim numbered by Fuad Abd al-Baqi)${/^صحيح (البخاري|مسلم)/.test(h.collection) ? '' : '; grade as displayed on dorar.net'}; English: ${h.translation_source || 'sunnah.com'}`,
        verified_how: ok ? `verify.mjs: ${how}. Text source: fawazahmed0/hadith-api (same Arabic text as sunnah.com, which blocks automated access with 403).` : `NOT verified: ${how}`,
      };
      for (const k of ['dorar_url', 'dorar_ref', 'hadeethenc_url', 'sunnah_url']) if (h[k]) rec[k] = h[k];
      add(`hadith:${slug(h.collection)}:${String(h.number).match(/[\d/]+/)?.[0] || slug(String(h.number))}`, rec, r.id);
    }
    for (const [m, v] of Object.entries(r.madhahib || {})) {
      add(`madhhab:${m}:${r.id}`, {
        type: 'madhhab', citation: `${m} — ${v.reference}`,
        url: (v.reference.match(/https?:\/\/[^\s;,()«»"؛،]+/) || [''])[0], verified: false, review_status: 'pending_human',
        text: { ar: v.position_ar, en: v.position_en },
        location: v.reference,
        edition: 'Volume/page as given in the reference string; NOT matched against a named printed edition (see verified_how).',
        verified_how: 'Attribution reviewed by the auditor for consistency with the well-known position of the school (and the Kuwaiti Fiqh Encyclopedia where cited); NOT matched against a printed edition page by page. Requires a human scholar.',
      }, r.id);
    }
    for (const c of r.contemporary || []) {
      const man = MANUAL_CONTEMPORARY.find(x => x.m.test(c.decision_ref) && x.b.test(c.body));
      const urls = String(c.source_url || '').split(/\s*;\s*/).filter(Boolean);
      const st = urls.map(linkStatus);
      add(`contemporary:${slug(c.body).slice(0, 30)}:${slug(c.decision_ref).slice(0, 40)}`, {
        type: 'contemporary', citation: `${c.body} — ${c.decision_ref}`, url: urls[0] || '',
        verified: !!man, review_status: status(!!man),
        text: { ar: c.position_ar, en: c.position_en },
        location: c.decision_ref,
        edition: 'Official online publication of the issuing body (see url).',
        verified_how: man ? man.how : `Not read in full by the auditor; summary taken from the researcher. Link check: ${st.map((s, i) => `${urls[i]} → ${s || 'unchecked'}`).join('; ') || 'no url'}.`,
      }, r.id);
    }
  }
}
// manual non-six-book hadith records (keep their "how")
const manual = JSON.parse(fs.readFileSync(path.join(HERE, 'manual_verifications.json'), 'utf8'));
for (const e of reg.values()) if (e.type === 'hadith' && e.verified) {
  const m = manual.find(x => e.used_in.includes(x.ruling) && e.citation.includes(x.citation.split(' ')[0]));
  if (m) e.verified_how = `Manual (auditor): ${m.verified_how}`;
}

// ---- Preserve the Q&A bank's records (used_in "qa.*"), merging used_in; never drop them. ----
const REMOVED_IDS = new Set(['other:ccc-2413', 'other:umc-gambling', 'other:billy-graham-rule']); // owner decision: no other-religion references
const cachedQuranenc = (s, a) => {
  const f = path.join(CACHE, `qe_${s}_${a}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).result;
  try {
    const txt = execFileSync('curl', ['-s', `https://quranenc.com/api/v1/translation/aya/english_saheeh/${s}/${a}`], { encoding: 'utf8' });
    fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, txt);
    return JSON.parse(txt).result;
  } catch { return null; }
};
const bukhariText = (() => { let hs; return n => { try { hs ??= JSON.parse(fs.readFileSync(path.join(CACHE, 'ara-bukhari.json'), 'utf8')).hadiths; return hs.find(x => Number(x.hadithnumber) === Number(n))?.text; } catch { return undefined; } }; })();
const QA_CITED = new Set();
try { for (const it of JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'script', 'questions.json'), 'utf8')).items || []) for (const s of it.source_ids || []) QA_CITED.add(s); } catch { /* no Q&A bank */ }
for (const p of previous) {
  if (REMOVED_IDS.has(p.id)) continue;
  const qaUses = (p.used_in || []).filter(u => u.startsWith('qa.'));
  if (!qaUses.length && !QA_CITED.has(p.id)) continue;
  if (reg.has(p.id)) { const e = reg.get(p.id); for (const u of qaUses) if (!e.used_in.includes(u)) e.used_in.push(u); continue; }
  const e = { ...p };
  if (e.type === 'quran') {
    const [, s, a] = e.id.split(':');
    const qe = cachedQuranenc(s, a);
    e.text ??= qe ? { ar: qe.arabic_text, en: qe.translation.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim() } : { ar: '' };
    e.location ??= `${s}:${a}`;
    e.edition ??= QURAN_EDITION;
  } else if (e.type === 'hadith') {
    const n = (e.id.match(/:(\d+)$/) || [])[1];
    e.text ??= { ar: /البخاري/.test(e.id) ? (bukhariText(n) || '') : '' };
    e.location ??= `${e.id.split(':')[1].replace(/-/g, ' ')}، رقم ${n}`;
    e.grade ??= /صحيح-(البخاري|مسلم)/.test(e.id) ? 'صحيح' : '';
    e.grader ??= /صحيح-البخاري/.test(e.id) ? 'الإمام البخاري (أخرجه في صحيحه)' : /صحيح-مسلم/.test(e.id) ? 'الإمام مسلم (أخرجه في صحيحه)' : '';
    e.edition ??= 'Arabic: sunnah.com text (identical to fawazahmed0/hadith-api); grade as displayed on dorar.net';
  } else {
    e.text ??= { ar: '', en: (e.citation.split(' — ')[1] || e.citation) };
    e.location ??= e.url;
    e.edition ??= 'Web page (see url), as fetched on checked_at';
  }
  e.review_status ??= status(!!e.verified);
  reg.set(e.id, e);
}

// registry checks from verify.mjs (records cited only by the Q&A bank are verified there)
for (const e of reg.values()) {
  if (e.used_in.some(u => !u.startsWith('qa.'))) continue;
  const res = verify.filter(v => /^registry-/.test(v.kind) && v.ref === e.id);
  if (!res.length) continue;
  const ok = res.every(v => v.level === 'PASS');
  e.verified = ok; e.review_status = status(ok);
  e.verified_how = `verify.mjs (registry): ${res.map(v => v.msg).join(' | ')}.` + (e.verified_how && !/^verify\.mjs \(registry\)/.test(e.verified_how) ? ` Earlier note: ${e.verified_how}` : (e.verified_how?.split(' Earlier note: ')[1] ? ` Earlier note: ${e.verified_how.split(' Earlier note: ')[1]}` : ''));
}

// qa.* used_in is authoritative from content/script/questions.json (source_ids), so citations are neither lost nor stale.
const QA = path.join(ROOT, 'content', 'script', 'questions.json');
if (fs.existsSync(QA)) {
  const items = JSON.parse(fs.readFileSync(QA, 'utf8')).items || [];
  for (const e of reg.values()) e.used_in = e.used_in.filter(u => !u.startsWith('qa.'));
  for (const it of items) for (const sid of it.source_ids || []) {
    const e = reg.get(sid);
    if (!e) { console.warn(`WARN: ${it.id} cites ${sid}, which is not in the registry (no previous record to preserve)`); continue; }
    if (!e.used_in.includes(it.id)) e.used_in.push(it.id);
  }
  for (const [id, e] of reg) if (!e.used_in.length) reg.delete(id);
}

// stable key order
const ORDER = ['id', 'type', 'citation', 'url', 'text', 'location', 'grade', 'grader', 'dorar_url', 'dorar_ref', 'hadeethenc_url', 'sunnah_url', 'edition', 'review_status', 'verified', 'verified_how', 'used_in', 'checked_at'];
const out = [...reg.values()].map(e => Object.fromEntries([...ORDER.filter(k => k in e).map(k => [k, e[k]]), ...Object.entries(e).filter(([k]) => !ORDER.includes(k))]));
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
const by = t => out.filter(x => x.type === t);
console.log(`sources: ${out.length}`, ['quran', 'hadith', 'madhhab', 'contemporary', 'other'].map(t => `${t} ${by(t).length} (verified ${by(t).filter(x => x.verified).length})`).join(' | '));
