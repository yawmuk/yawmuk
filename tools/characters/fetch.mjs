#!/usr/bin/env node
// Downloads the CC0 Quaternius source characters listed in sources.json into scratch/characters-src/ (git-ignored).
// Then run: node tools/characters/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'scratch/characters-src');
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/characters/sources.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
for (const m of src.models) {
  const file = path.join(OUT, `${m.id}.glb`);
  if (fs.existsSync(file)) { console.log('have', m.id); continue; }
  const r = await fetch(m.glb);
  if (!r.ok) throw new Error(`${m.id}: HTTP ${r.status}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  console.log('got', m.id, fs.statSync(file).size);
}
