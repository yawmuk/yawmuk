#!/usr/bin/env node
// Source tiers (devil's-advocate finding 7). Classifies every record of content/sources.json as
//   approved_package — reachable on a site the challenge's scientific reference package names
//                      (dorar.net, quranpedia.net, shamela.ws, dawa.center (بينات), islamic-content.com (الجمهرة),
//                      quranenc.com for the King Fahd Complex Madinah-Mushaf text), the Qur'an text itself, or a
//                      hadith from al-Bukhari / Muslim (the package names الصحيحين explicitly);
//   secondary        — everything else (islamqa, islamhouse, official sites of fiqh councils, fatwa portals …).
// A secondary record is not "wrong"; it is simply not one of the package's named references and is labelled so.
//   node tools/eval/source_tiers.mjs          annotate content/sources.json in place (adds tier + tier_note)
//   node tools/eval/source_tiers.mjs --check  exit 1 if any record's tier is missing or stale
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APPROVED_HOSTS = ['dorar.net', 'quranpedia.net', 'shamela.ws', 'dawa.center', 'islamic-content.com', 'quranenc.com'];
export const TIERS = ['approved_package', 'secondary'];

const hostOf = (u) => { try { return new URL(String(u).trim()).hostname.replace(/^www\./, ''); } catch { return null; } };
export const urlsOf = (s) => [s.url, s.dorar_url, s.hadeethenc_url, ...String(s.sunnah_url || '').split(/\s*;\s*/)]
  .flatMap((u) => String(u || '').split(/\s*;\s*/)).map((u) => u.trim()).filter(Boolean);
export const isApprovedHost = (u) => { const h = hostOf(u); return !!h && APPROVED_HOSTS.some((a) => h === a || h.endsWith(`.${a}`)); };

/** { tier, tier_note } for one sources.json record. */
export function tierOf(s) {
  if (s.type === 'quran') return { tier: 'approved_package', tier_note: 'Madinah Mushaf text (King Fahd Complex) via quranenc.com; English is the Saheeh International translation hosted there.' };
  if (s.type === 'hadith' && /صحيح-(البخاري|مسلم)/.test(s.id)) return { tier: 'approved_package', tier_note: 'From the two Sahihs (named by the package); grade shown as on dorar.net.' };
  const urls = urlsOf(s);
  const ok = urls.filter(isApprovedHost);
  if (ok.length) return { tier: 'approved_package', tier_note: `Package-named site: ${[...new Set(ok.map(hostOf))].join(', ')}.` };
  if (s.type === 'madhhab' && /بحسب نقل|منقول عبر|نقلاً عن/.test(s.citation || '')) return { tier: 'secondary', tier_note: 'Classical madhhab book (acceptable per the package) but accessed via a secondary site; the original volume/page needs a human check.' };
  if (s.type === 'contemporary') return { tier: 'secondary', tier_note: 'Official publication of a contemporary fiqh council or scholar; not one of the package-named references.' };
  return { tier: 'secondary', tier_note: urls.length ? `Not a package-named site (${[...new Set(urls.map(hostOf).filter(Boolean))].join(', ')}).` : 'No package-named link.' };
}

export function annotate(sources) {
  return sources.map((s) => ({ ...s, ...tierOf(s) }));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const file = path.join(ROOT, 'content/sources.json');
  const sources = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (process.argv.includes('--check')) {
    const bad = sources.filter((s) => s.tier !== tierOf(s).tier).map((s) => s.id);
    if (bad.length) { console.error(`stale/missing tier: ${bad.join(', ')}`); process.exit(1); }
    console.log(`tiers ok (${sources.length})`);
  } else {
    const out = annotate(sources);
    fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
    const n = (t) => out.filter((s) => s.tier === t).length;
    console.log(`tiers written: approved_package ${n('approved_package')} | secondary ${n('secondary')}`);
  }
}
