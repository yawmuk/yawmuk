// Brand system checks: tokens are the single source of truth, every text role passes WCAG AA, the stylesheet is
// token-driven, logo files are well-formed, and index.html carries the brand meta. (node:test, no browser)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTokens, renderCss, contrast, CSS_PATH } from '../src/brand/build.mjs';
import { prayerPoints, ARC } from '../src/brand/make-logos.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = loadTokens();
const SURFACES = ['bg', 'surface', 'raised', 'sunken'];
const TEXT_ROLES = ['text', 'textSoft', 'muted', 'accent', 'accentHi', 'teal', 'info', 'ok', 'warn', 'danger'];

test('brand: tokens.css is generated from tokens.json (no drift)', () => {
  assert.equal(readFileSync(CSS_PATH, 'utf8'), renderCss(T), 'run `node src/brand/build.mjs` after editing tokens.json');
});

for (const theme of ['dark', 'light']) {
  test(`brand: every ${theme} text role meets WCAG AA (≥4.5:1) on all four surfaces`, () => {
    const u = T.ui[theme];
    for (const role of TEXT_ROLES) for (const s of SURFACES) {
      const r = contrast(u[role].$value, u[s].$value);
      assert.ok(r >= 4.5, `${theme} ${role} on ${s} = ${r.toFixed(2)}:1`);
    }
  });
  test(`brand: ${theme} strong line and focus ring meet 3:1 (non-text, WCAG 1.4.11)`, () => {
    const u = T.ui[theme];
    for (const role of ['lineStrong', 'focus']) for (const s of SURFACES) {
      const r = contrast(u[role].$value, u[s].$value);
      assert.ok(r >= 3, `${theme} ${role} on ${s} = ${r.toFixed(2)}:1`);
    }
  });
  test(`brand: ${theme} text on the accent button is AA`, () => {
    const u = T.ui[theme];
    assert.ok(contrast(u.onAccent.$value, u.accent.$value) >= 4.5);
  });
}

test('brand: verdict badge fills keep AA with their label colour', () => {
  for (const [k, v] of Object.entries(T.verdict)) {
    if (k.startsWith('$')) continue;
    const fg = k === 'disputed' ? '#241A02' : '#FFFFFF';
    assert.ok(contrast(v.$value, fg) >= 4.5, `${k} ${contrast(v.$value, fg).toFixed(2)}`);
  }
});

test('brand: main.css imports the tokens first and aliases legacy palette names to tokens', () => {
  const css = readFileSync(join(root, 'src/styles/main.css'), 'utf8');
  assert.ok(css.startsWith("@import '../brand/tokens.css';"), 'the @import must be the first statement');
  for (const name of ['--ink-900', '--brass-400', '--emerald-300', '--sand-100', '--accent', '--text', '--muted', '--font-ui', '--font-quran'])
    assert.match(css, new RegExp(`${name}: var\\(--yk-`), `${name} should alias a --yk-* token`);
  // legacy names consumed by engine/feature CSS must survive
  for (const name of ['--line-strong', '--glass', '--glass-solid', '--glass-3', '--star', '--pattern', '--spring', '--radius-lg', '--safe-b', '--sky-300', '--clay-400', '--mist'])
    assert.match(css, new RegExp(`${name}:`), `${name} must stay defined`);
  // the retired brass hex values are gone
  for (const hex of ['#e0ae52', '#f2cf86', '#a87a2c', '#6e4d16']) assert.ok(!css.toLowerCase().includes(hex), `stale ${hex}`);
});

test('brand: Quran text keeps a font designed for Uthmani marks', () => {
  assert.equal(T.font.quran.$value[0], 'Amiri Quran');
});

test('brand: the five prayer points sit on the day arc, east (fajr) first', () => {
  const pts = prayerPoints();
  assert.equal(pts.length, 5);
  for (const [x, y] of pts) assert.ok(Math.abs(Math.hypot(x - ARC.cx, y - ARC.cy) - ARC.r) < 0.05);
  assert.ok(pts[0][0] > pts[4][0], 'fajr point is on the east (right) side');
  assert.equal(pts[2][0], 50, 'the middle point is the zenith');
});

test('brand: every logo SVG is well-formed, titled and uses only brand colours', () => {
  const dir = join(root, 'public/brand/logo');
  const allowed = new Set([...Object.values(T.color).map((c) => c.$value.toUpperCase()), '#1B4143', '#0A1D1F']);
  const svgs = readdirSync(dir).filter((f) => f.endsWith('.svg'));
  assert.ok(svgs.length >= 13, `expected the full logo set, got ${svgs.length}`);
  for (const f of [...svgs.map((s) => join(dir, s)), join(root, 'public/favicon.svg'), join(root, 'public/brand/og-image.svg')]) {
    const s = readFileSync(f, 'utf8');
    assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[-\d. ]+"/, f);
    assert.match(s, /<title>[^<]+<\/title>/, `${f} needs a <title>`);
    assert.ok(s.trim().endsWith('</svg>'), f);
    const opens = (s.match(/<(?!\/)(?!title)[a-zA-Z]+[^>]*[^/]>/g) || []).length;
    const closes = (s.match(/<\/(?!title)[a-zA-Z]+>/g) || []).length;
    assert.equal(opens, closes, `${f}: unbalanced tags`);
    for (const hex of s.match(/#[0-9A-Fa-f]{6}\b/g) || []) assert.ok(allowed.has(hex.toUpperCase()), `${f}: off-palette ${hex}`);
  }
});

test('brand: key art and app icons exist, are compressed, and have provenance', () => {
  const prov = JSON.parse(readFileSync(join(root, 'public/brand/provenance.json'), 'utf8'));
  assert.match(prov.generator, /image_gen/);
  for (const img of prov.images) {
    const p = join(root, 'public/brand', img.file);
    assert.ok(existsSync(p), img.file);
    assert.ok(statSync(p).size < 400_000, `${img.file} too large for the web bundle`);
    assert.match(img.prompt, /no text/i, 'prompts must forbid text/calligraphy');
  }
  for (const n of [180, 192, 512]) assert.ok(existsSync(join(root, `public/brand/logo/yawmuk-app-icon-${n}.png`)));
  assert.ok(existsSync(join(root, 'public/brand/og-image.jpg')));
});

test('brand: index.html carries brand meta matching the tokens', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const theme = /<meta name="theme-color" content="(#[0-9A-Fa-f]{6})"/.exec(html)?.[1];
  assert.equal(theme?.toUpperCase(), T.ui.dark.bg.$value.toUpperCase());
  for (const p of ['og:title', 'og:description', 'og:image', 'og:image:alt']) assert.ok(html.includes(`property="${p}"`), p);
  assert.ok(html.includes('<title>يومك · Yawmuk</title>'));
  assert.ok(html.includes('rel="icon" type="image/svg+xml" href="./favicon.svg"'));
  assert.ok(html.includes('class="yk-prayer-points"'), 'loader shows the day-arc mark');
  for (const id of ['stage', 'ui', 'fade', 'loader', 'loader-title', 'loader-bar', 'loader-label', 'loader-tip', 'veil-bar']) assert.ok(html.includes(`id="${id}"`), id);
});

test('brand: BRAND.md documents every section of the brand book', () => {
  const md = readFileSync(join(root, 'docs/BRAND.md'), 'utf8');
  for (const h of ['Story', 'Values', 'Voice', 'Logo', 'Clearspace', 'Misuse', 'Colour', 'Typography', 'Iconography', 'Illustration', 'Components', 'Motion', 'Accessibility', 'Assets'])
    assert.match(md, new RegExp(`^##.*${h}`, 'm'), `missing section: ${h}`);
});
