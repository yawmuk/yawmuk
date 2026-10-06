#!/usr/bin/env node
// «يومك» — Link checker for every URL in content/rulings/*.json
// Usage: node tools/audit/links.mjs        Exit 1 if any URL returns 404/410 or fails DNS.
// 401/403/429/5xx and Cloudflare challenges are reported as BLOCKED (not failures): sunnah.com / dorar.net
// block automated clients; those links are validated structurally by verify.mjs instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.YAWMAK_RULINGS_DIR || path.join(HERE, '..', '..', 'content', 'rulings');
const urls = new Map();
const walk = (v, id) => {
  if (typeof v === 'string') {
    for (const m of v.matchAll(/https?:\/\/[^\s;,()«»"؛،]+/g)) {
      const u = m[0].replace(/[.)\]]+$/, '');
      if (!urls.has(u)) urls.set(u, new Set());
      urls.get(u).add(id);
    }
  } else if (Array.isArray(v)) v.forEach(x => walk(x, id));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, id));
};
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')))
  for (const r of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) walk(r, r.id);

async function check(u) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(encodeURI(decodeURI(u)), { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (yawmak-audit)' } });
    return r.status;
  } catch (e) { return 'ERR ' + (e.cause?.code || e.name); } finally { clearTimeout(t); }
}
const rows = [];
const list = [...urls.keys()];
for (let i = 0; i < list.length; i += 8) {
  const part = list.slice(i, i + 8);
  const st = await Promise.all(part.map(check));
  part.forEach((u, k) => rows.push({ url: u, status: st[k], used_in: [...urls.get(u)] }));
}
let bad = 0;
for (const r of rows) {
  const s = r.status;
  const level = (s === 404 || s === 410 || /ENOTFOUND|EAI_AGAIN/.test(String(s))) ? 'BROKEN'
    : (typeof s === 'number' && s < 400) ? 'OK' : 'BLOCKED';
  if (level === 'BROKEN') bad++;
  r.level = level;
}
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else {
  for (const r of rows.sort((a, b) => a.level.localeCompare(b.level))) console.log(`[${r.level}] ${r.status}  ${r.url}  (${r.used_in.join(', ')})`);
  console.log(`\nURLs: ${rows.length} | OK ${rows.filter(r => r.level === 'OK').length} | BLOCKED ${rows.filter(r => r.level === 'BLOCKED').length} | BROKEN ${bad}`);
}
process.exit(bad ? 1 : 0);
