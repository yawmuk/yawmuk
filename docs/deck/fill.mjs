#!/usr/bin/env node
// Fill the «يومك» deck placeholders and export PPTX + PDF for submission.
//
//   node docs/deck/fill.mjs            # fill from docs/deck/values.json
//   node docs/deck/fill.mjs --auto     # also run `npm test` and read docs/SOURCES.md for the counts
//   node docs/deck/fill.mjs --no-pdf   # skip the LibreOffice export
//
// Input : docs/deck/yawmuk-deck.template.pptx (from build.py; keeps every {{TOKEN}})
//         docs/deck/values.json  ({ "tokens": {KEY: value}, "screenshots": {SLOT: path} })
//         docs/deck/slots.json   (written by build.py: aspect ratio of each picture slot)
// Output: <repo>/../../submission/Yawmuk_Final_Deck.pptx and .pdf
//
// No npm dependencies: uses the macOS/Linux `unzip`, `zip`, and (for screenshots) `sips`
// (macOS), and LibreOffice `soffice` for the PDF.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..', '..');
const SUBMISSION = path.resolve(PROJECT, '..', '..', 'submission');
const TEMPLATE = path.join(HERE, 'yawmuk-deck.template.pptx');
const OUT_NAME = 'Yawmuk_Final_Deck';

// Shown when a token has no value yet. Never a number: an unmeasured result stays visibly unmeasured.
export const PENDING = {
  ar: 'قيد القياس',
  dash: '—',
};
// Per-token text when no value is given (URLs stay as raw tokens so a missing link is obvious).
export const FALLBACK = {
  LIVE_URL: '{{LIVE_URL}}',
  VIDEO_URL: '{{VIDEO_URL}}',
  COST_MEASURED: 'لم يُقس بعد',
  STUDY_RESULTS: 'قيد التنفيذ، والنتائج الحيّة في صفحة results.html',
  EVAL_COMPARISON: 'قيد القياس',
  RESULTS_DATE: 'يوم التسليم',
};
export const KPI_TOKENS = new Set([
  'TESTS_PASS', 'TESTS_TOTAL', 'EVAL_PASS', 'SOURCES_VERIFIED', 'SOURCES_TOTAL', 'STUDY_N', 'STUDY_GAIN',
]);

export function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function findTokens(xml) {
  return [...new Set([...xml.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((m) => m[1]))];
}

/** Replace {{KEY}} with values[KEY]; unknown/empty keys get a visible "pending" marker, never a number. */
export function replaceTokens(xml, values) {
  return xml.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    const v = values[key];
    if (v === undefined || v === null || String(v).trim() === '') {
      if (key in FALLBACK) return xmlEscape(FALLBACK[key]);
      return xmlEscape(KPI_TOKENS.has(key) ? PENDING.dash : PENDING.ar);
    }
    return xmlEscape(v);
  });
}

/** Parse node:test summary lines ("ℹ tests 605", "ℹ pass 605"). */
export function parseTestSummary(out) {
  const num = (k) => {
    const m = out.match(new RegExp(`^\\S*\\s*${k}\\s+(\\d+)\\s*$`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const total = num('tests');
  const pass = num('pass');
  const fail = num('fail');
  return total == null || pass == null ? null : { total, pass, fail };
}

/** Parse the "| **Total** | **246** | **128** | **118** |" row of docs/SOURCES.md. */
export function parseSourcesSummary(md) {
  const m = md.match(/\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/);
  return m ? { total: Number(m[1]), verified: Number(m[2]) } : null;
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function autoValues() {
  const v = {};
  let out = '';
  try {
    out = sh('npm', ['test'], { cwd: PROJECT, maxBuffer: 64 << 20 });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  const t = parseTestSummary(out);
  if (t) {
    v.TESTS_PASS = String(t.pass);
    v.TESTS_TOTAL = String(t.total);
    if (t.fail) console.warn(`! npm test reports ${t.fail} failing test(s) — the deck shows ${t.pass}/${t.total}`);
  } else console.warn('! could not parse npm test output');
  const s = parseSourcesSummary(fs.readFileSync(path.join(PROJECT, 'docs', 'SOURCES.md'), 'utf8'));
  if (s) {
    v.SOURCES_VERIFIED = String(s.verified);
    v.SOURCES_TOTAL = String(s.total);
  } else console.warn('! could not parse docs/SOURCES.md summary table');
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const d = new Date();
  v.RESULTS_DATE = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  return v;
}

function soffice() {
  const cands = ['/Applications/LibreOffice.app/Contents/MacOS/soffice', 'soffice', 'libreoffice'];
  for (const c of cands) {
    try {
      sh(c, ['--version']);
      return c;
    } catch { /* try next */ }
  }
  return null;
}

/** Crop + convert an image to PNG with the slot's aspect ratio (macOS sips; keeps the top, centres horizontally). */
function prepareImage(src, aspect, dst) {
  sh('sips', ['-s', 'format', 'png', src, '--out', dst]);
  const info = sh('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', dst]);
  const w = Number(info.match(/pixelWidth: (\d+)/)[1]);
  const h = Number(info.match(/pixelHeight: (\d+)/)[1]);
  let cw = w, ch = h;
  if (w / h > aspect) cw = Math.round(h * aspect);
  else ch = Math.round(w / aspect);
  // sips crops around the centre unless --cropOffset comes first; a 0 offset is ignored, so use 1px.
  const ox = Math.max(1, Math.round((w - cw) / 2));
  sh('sips', ['--cropOffset', '1', String(ox), '-c', String(ch), String(cw), dst, '--out', dst]);
}

function replaceScreenshot(dir, slot, srcPath, aspect) {
  const slidesDir = path.join(dir, 'ppt', 'slides');
  for (const f of fs.readdirSync(slidesDir).filter((n) => n.endsWith('.xml'))) {
    const xml = fs.readFileSync(path.join(slidesDir, f), 'utf8');
    const pics = xml.split('<p:pic>').slice(1);
    for (const pic of pics) {
      if (!pic.includes(`name="SLOT:${slot}"`)) continue;
      const rid = pic.match(/r:embed="([^"]+)"/)[1];
      const rels = fs.readFileSync(path.join(slidesDir, '_rels', `${f}.rels`), 'utf8');
      const rel = rels.match(new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*>`))[0];
      const target = rel.match(/Target="([^"]+)"/)[1];
      const mediaPath = path.resolve(slidesDir, target);
      if (!mediaPath.endsWith('.png')) throw new Error(`slot ${slot} media is not PNG: ${target}`);
      prepareImage(path.resolve(PROJECT, srcPath), aspect, mediaPath);
      return true;
    }
  }
  return false;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const cfgPath = path.join(HERE, 'values.json');
  const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
  const values = { ...(cfg.tokens || {}) };
  if (args.has('--auto')) Object.assign(values, autoValues(), cfg.tokens_override || {});
  const slots = JSON.parse(fs.readFileSync(path.join(HERE, 'slots.json'), 'utf8'));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yawmuk-deck-'));
  sh('unzip', ['-q', TEMPLATE, '-d', tmp]);

  const pending = new Set();
  for (const sub of ['ppt/slides', 'ppt/notesSlides']) {
    const d = path.join(tmp, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((n) => n.endsWith('.xml'))) {
      const p = path.join(d, f);
      const xml = fs.readFileSync(p, 'utf8');
      for (const k of findTokens(xml)) if (!String(values[k] ?? '').trim()) pending.add(k);
      fs.writeFileSync(p, replaceTokens(xml, values));
    }
  }

  for (const [slot, src] of Object.entries(cfg.screenshots || {})) {
    if (!src) continue;
    if (!slots[slot]) { console.warn(`! unknown screenshot slot ${slot}`); continue; }
    if (!fs.existsSync(path.resolve(PROJECT, src))) { console.warn(`! missing screenshot ${src}`); continue; }
    if (!replaceScreenshot(tmp, slot, src, slots[slot].aspect)) console.warn(`! slot ${slot} not found in deck`);
    else console.log(`  screenshot ${slot} <- ${src}`);
  }

  fs.mkdirSync(SUBMISSION, { recursive: true });
  const outPptx = path.join(SUBMISSION, `${OUT_NAME}.pptx`);
  fs.rmSync(outPptx, { force: true });
  sh('zip', ['-q', '-r', '-X', outPptx, '.'], { cwd: tmp });
  console.log(`wrote ${outPptx}`);
  if (pending.size) console.log(`  still pending (shown as «${PENDING.ar}» / «${PENDING.dash}»): ${[...pending].sort().join(', ')}`);

  if (!args.has('--no-pdf')) {
    const bin = soffice();
    if (!bin) { console.warn('! LibreOffice not found — open the PPTX in PowerPoint/Keynote and export PDF'); return; }
    // Make the bundled Readex Pro (OFL) visible to LibreOffice's fontconfig.
    const fc = path.join(tmp, 'fonts.conf');
    fs.writeFileSync(fc, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>
<dir>${path.join(HERE, 'fonts')}</dir><dir>/Applications/LibreOffice.app/Contents/Resources/fonts</dir>
<dir>/System/Library/Fonts</dir><dir>/Library/Fonts</dir><dir>${path.join(os.homedir(), 'Library', 'Fonts')}</dir>
<dir>/usr/share/fonts</dir><cachedir>${path.join(tmp, 'fc-cache')}</cachedir></fontconfig>`);
    sh(bin, [`-env:UserInstallation=file://${path.join(tmp, 'lo')}`, '--headless', '--convert-to', 'pdf', '--outdir', SUBMISSION, outPptx],
      { env: { ...process.env, FONTCONFIG_FILE: fc }, timeout: 300000 });
    console.log(`wrote ${path.join(SUBMISSION, `${OUT_NAME}.pdf`)}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
