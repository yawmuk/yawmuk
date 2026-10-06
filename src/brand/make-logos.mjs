// Yawmuk logo generator: writes every logo SVG in public/brand/ from code (reproducible, no design tool needed).
// Usage: node src/brand/make-logos.mjs
// The symbol «قوس اليوم / Day Arc» is drawn on a 100-unit grid: a horizon line, a half sun rising on it,
// and five points on the sky arc — the five daily prayers (fajr, dhuhr, asr, maghrib, isha) as the shape of a day.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', 'public', 'brand');
const WM = JSON.parse(readFileSync(join(here, 'wordmark-paths.json'), 'utf8'));
const T = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8')).color;
const c = (k) => T[k].$value;

export const PALETTES = {
  light: { line: c('ink900'), sun: c('sun400'), dots: c('olive700'), word: c('ink900') },
  dark: { line: c('sand100'), sun: c('sun400'), dots: c('olive300'), word: c('sand100') },
  mono: { line: 'currentColor', sun: 'currentColor', dots: 'currentColor', word: 'currentColor' },
};

/** Geometry of the five prayer points: angles on the sky arc, measured from the east (right) horizon. */
export const ARC = { cx: 50, cy: 64, r: 30, angles: [12, 51, 90, 129, 168], dot: 4 };
const round = (n) => Math.round(n * 100) / 100;
export const prayerPoints = () => ARC.angles.map((a) => [round(ARC.cx + ARC.r * Math.cos((a * Math.PI) / 180)), round(ARC.cy - ARC.r * Math.sin((a * Math.PI) / 180))]);

function symbol(p, { stroke = 7 } = {}) {
  const dots = prayerPoints().map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${ARC.dot}" fill="${p.dots}"/>`).join('');
  return [
    `<path d="M34 64a16 16 0 0 1 32 0z" fill="${p.sun}"/>`,
    `<path d="M12 72h76" fill="none" stroke="${p.line}" stroke-width="${stroke}" stroke-linecap="round"/>`,
    `<g class="yk-prayer-points">${dots}</g>`,
  ].join('');
}

const svg = (vb, body, label, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${label}"${extra}><title>${label}</title>${body}</svg>\n`;

// wordmark placement: Arabic body (671 units above baseline) = 46 grid units; Latin cap height (785) = 40 units.
const AR_S = 46 / 671;
const EN_S = 40 / 785;
const wordAr = (x, baseline, fill) => `<path transform="translate(${round(x - WM.ar.bounds[0] * AR_S)} ${baseline}) scale(${round(AR_S * 10000) / 10000})" d="${WM.ar.d}" fill="${fill}"/>`;
const wordEn = (x, baseline, fill) => `<path transform="translate(${round(x - WM.en.bounds[0] * EN_S)} ${baseline}) scale(${round(EN_S * 10000) / 10000})" d="${WM.en.d}" fill="${fill}"/>`;
const AR_W = round((WM.ar.bounds[2] - WM.ar.bounds[0]) * AR_S); // ≈144
const EN_W = round((WM.en.bounds[2] - WM.en.bounds[0]) * EN_S); // ≈195

function lockupAr(p) {
  // RTL: symbol on the right, word to its left; the word sits on the horizon line (baseline y = 72)
  const gap = 14, w = AR_W + gap + 76;
  return svg(`-4 20 ${round(w + 8)} 72`, `${wordAr(0, 72, p.word)}<g transform="translate(${round(AR_W + gap - 12)} 0)">${symbol(p)}</g>`, 'يومك');
}
function lockupEn(p) {
  const gap = 14, w = 76 + gap + EN_W;
  return svg(`-4 20 ${round(w + 8)} 60`, `<g transform="translate(-12 0)">${symbol(p)}</g>${wordEn(76 + gap, 72, p.word)}`, 'Yawmuk');
}
function stacked(p) {
  // symbol over Arabic word over Latin word, centred on x=0
  const arX = -AR_W / 2, enS = 0.55, enW = EN_W * enS;
  const en = `<g transform="translate(${round(-enW / 2)} 178) scale(${enS})">${wordEn(0, 0, p.word)}</g>`;
  return svg('-90 22 180 164', `<g transform="translate(-50 0)">${symbol(p)}</g>${wordAr(arX, 132, p.word)}${en}`, 'يومك · Yawmuk');
}

function appIcon() {
  const p = { line: c('sand100'), sun: c('sun400'), dots: c('olive300') };
  const body = [
    '<defs><radialGradient id="g" cx="50%" cy="62%" r="70%"><stop offset="0" stop-color="#1B4143"/><stop offset="1" stop-color="#0A1D1F"/></radialGradient>',
    `<radialGradient id="h" cx="50%" cy="66%" r="34%"><stop offset="0" stop-color="${c('sun400')}" stop-opacity=".35"/><stop offset="1" stop-color="${c('sun400')}" stop-opacity="0"/></radialGradient></defs>`,
    '<rect width="100" height="100" rx="22" fill="url(#g)"/>',
    '<rect width="100" height="100" rx="22" fill="url(#h)"/>',
    `<g transform="translate(4 1.5) scale(.92)">${symbol(p, { stroke: 7.5 })}</g>`,
  ].join('');
  return svg('0 0 100 100', body, 'يومك · Yawmuk');
}

function favicon() {
  // ≤32px: drop to three bold elements (sun, horizon, the dhuhr point) — five dots blur at 16px
  const body = [
    `<rect width="64" height="64" rx="14" fill="${c('ink900')}"/>`,
    `<path d="M18 40a14 14 0 0 1 28 0z" fill="${c('sun400')}"/>`,
    `<path d="M11 47h42" stroke="${c('sand100')}" stroke-width="6" stroke-linecap="round"/>`,
    `<circle cx="32" cy="14" r="4" fill="${c('olive300')}"/><circle cx="14" cy="24" r="3.4" fill="${c('olive300')}"/><circle cx="50" cy="24" r="3.4" fill="${c('olive300')}"/>`,
  ].join('');
  return svg('0 0 64 64', body, 'Yawmuk');
}

function ogImage() {
  const p = PALETTES.dark;
  const arcs = [0.55, 0.8, 1.05].map((k, i) => `<circle cx="600" cy="520" r="${round(420 * k)}" fill="none" stroke="${c('sand100')}" stroke-opacity="${0.06 - i * 0.015}" stroke-width="2"/>`).join('');
  const body = [
    '<defs><radialGradient id="bg" cx="50%" cy="85%" r="90%"><stop offset="0" stop-color="#1B4143"/><stop offset=".55" stop-color="#0E2628"/><stop offset="1" stop-color="#061314"/></radialGradient>',
    `<radialGradient id="sunglow" cx="50%" cy="30%" r="45%"><stop offset="0" stop-color="${c('sun400')}" stop-opacity=".32"/><stop offset="1" stop-color="${c('sun400')}" stop-opacity="0"/></radialGradient></defs>`,
    '<rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#sunglow)"/>',
    arcs,
    `<g transform="translate(480 -10) scale(2.4)">${symbol(p)}</g>`,
    `<g transform="translate(${round(600 - AR_W * 2.4 / 2)} 0) scale(2.4)">${wordAr(0, 178, p.word)}</g>`,
    `<g transform="translate(${round(600 - EN_W * 0.8 / 2)} 548) scale(.8)">${wordEn(0, 0, c('sun300'))}</g>`,
  ].join('');
  return svg('0 0 1200 630', body, 'يومك · Yawmuk');
}

export function buildAll() {
  mkdirSync(join(OUT, 'logo'), { recursive: true });
  const files = {};
  for (const [name, p] of Object.entries(PALETTES)) {
    files[`logo/yawmuk-mark-${name}.svg`] = svg('8 26 84 54', symbol(p), 'Yawmuk mark');
    files[`logo/yawmuk-ar-${name}.svg`] = lockupAr(p);
    files[`logo/yawmuk-en-${name}.svg`] = lockupEn(p);
    files[`logo/yawmuk-stacked-${name}.svg`] = stacked(p);
  }
  files['logo/yawmuk-app-icon.svg'] = appIcon();
  files['og-image.svg'] = ogImage();
  for (const [f, s] of Object.entries(files)) writeFileSync(join(OUT, f), s);
  const fav = favicon();
  writeFileSync(join(OUT, '..', 'favicon.svg'), fav);
  return Object.keys(files).concat('../favicon.svg');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(buildAll().join('\n'));
