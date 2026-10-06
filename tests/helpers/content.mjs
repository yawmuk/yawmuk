// Shared loaders for the content tests (no dependencies).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LOCATIONS = ['home', 'work', 'school', 'street', 'public_events', 'private_events'];

export function readJson(rel) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^﻿/, '');
  return JSON.parse(raw);
}

/** { file, ruling } for every ruling in content/rulings/*.json */
function readRulingDir(dir) {
  const out = [];
  if (!fs.existsSync(path.join(ROOT, dir))) return out;
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith('.json')).sort()) {
    const data = readJson(`${dir}/${f}`);
    for (const r of Array.isArray(data) ? data : [data]) out.push({ file: f, ruling: r });
  }
  return out;
}

/** Rulings played as situations (content/rulings). */
export function loadSituationRulings() { return readRulingDir('content/rulings'); }

/** Every reviewed ruling the app ships: situation rulings + the guide's reference library (content/library).
 * All content/safety/level audits run on both. */
export function loadRulings() { return [...loadSituationRulings(), ...readRulingDir('content/library')]; }

/** location -> script JSON */
export function loadScripts() {
  return Object.fromEntries(LOCATIONS.map((l) => [l, readJson(`content/script/${l}.json`)]));
}

/** The fixed 18-situation catalog, parsed from docs/TEAM_BRIEF.md (the source of truth). */
export function briefCatalog() {
  const md = fs.readFileSync(path.join(ROOT, 'docs/TEAM_BRIEF.md'), 'utf8');
  return [...md.matchAll(/^\|\s*`([a-z_]+\.[a-z0-9_]+)`\s*\|/gm)].map((m) => m[1]);
}

/** Recursively visit every string value with its JSON path. */
export function walkStrings(node, fn, p = '$') {
  if (typeof node === 'string') fn(node, p);
  else if (Array.isArray(node)) node.forEach((v, i) => walkStrings(v, fn, `${p}[${i}]`));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walkStrings(v, fn, `${p}.${k}`);
}

export const nonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;
export const bilingual = (o) => !!o && nonEmptyStr(o.ar) && nonEmptyStr(o.en);
