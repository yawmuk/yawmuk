// Yawmuk brand: generates src/brand/tokens.css from src/brand/tokens.json (single source of truth).
// Usage: node src/brand/build.mjs   (also imported by tests/brand.test.mjs to check sync + WCAG contrast)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const TOKENS_PATH = join(here, 'tokens.json');
export const CSS_PATH = join(here, 'tokens.css');

const kebab = (s) => s.replace(/([a-z])([0-9])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const val = (t) => (Array.isArray(t.$value) ? t.$value.map((f) => (/\s/.test(f) ? `'${f}'` : f)).join(', ') : t.$value);
const entries = (group) => Object.entries(group).filter(([k]) => !k.startsWith('$'));

/** WCAG 2.x relative luminance of a #RRGGBB colour. */
export function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #RRGGBB colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio between two #RRGGBB colours (1..21). */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function loadTokens() {
  return JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
}

export function renderCss(t) {
  const L = [];
  L.push('/* GENERATED from src/brand/tokens.json by `node src/brand/build.mjs` — edit the JSON, not this file.');
  L.push('   Yawmuk (يومك) design tokens. Prefix --yk-*. Dark (lantern glass over the 3D scene) is the default theme;');
  L.push("   add data-yk-theme='light' (or class yk-theme-light) to any container for the paper theme. See docs/BRAND.md. */");
  L.push(':root {');
  L.push('  /* primitives */');
  for (const [k, v] of entries(t.color)) L.push(`  --yk-${kebab(k)}: ${v.$value};`);
  L.push('  /* semantic roles — dark (default) */');
  for (const [k, v] of entries(t.ui.dark)) L.push(`  --yk-${kebab(k)}: ${v.$value};`);
  L.push('  /* ruling verdict fills */');
  for (const [k, v] of entries(t.verdict)) L.push(`  --yk-verdict-${kebab(k)}: ${v.$value};`);
  L.push('  /* day-cycle scene palette (one set per prayer time) */');
  for (const [k, v] of entries(t.scene)) for (const [p, c] of Object.entries(v)) L.push(`  --yk-scene-${kebab(k)}-${p}: ${c};`);
  L.push('  /* type */');
  for (const [k, v] of entries(t.font)) L.push(`  --yk-font-${kebab(k)}: ${val(v)};`);
  for (const [k, v] of entries(t.size)) L.push(`  --yk-size-${kebab(k)}: ${v.$value};`);
  L.push('  /* shape, depth, motion */');
  for (const [k, v] of entries(t.radius)) L.push(`  --yk-radius-${kebab(k)}: ${v.$value};`);
  for (const [k, v] of entries(t.shadow)) L.push(`  --yk-shadow-${kebab(k)}: ${v.$value};`);
  for (const [k, v] of entries(t.motion)) L.push(`  --yk-motion-${kebab(k)}: ${v.$value};`);
  L.push('}');
  L.push(":where([data-yk-theme='light'], .yk-theme-light) {");
  for (const [k, v] of entries(t.ui.light)) L.push(`  --yk-${kebab(k)}: ${v.$value};`);
  L.push('  color-scheme: light;');
  L.push('}');
  L.push('@media (prefers-reduced-motion: reduce) {');
  L.push('  :root { --yk-motion-fast: 0ms; --yk-motion-base: 0ms; --yk-motion-slow: 0ms; }');
  L.push('}');
  return L.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(CSS_PATH, renderCss(loadTokens()));
  console.log(`wrote ${CSS_PATH}`);
}
