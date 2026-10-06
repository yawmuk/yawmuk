// Canvas-painted textures for the mosque scene. No image files, no network.
// Every exporter returns null when there is no DOM (node:test) or no 2D context, and the scene
// falls back to flat vertex colours, so build() also runs headless.
//
// The ONLY baked text in the scene is decorative calligraphy of two generic names (no verse text,
// no hadith text): see CALLIGRAPHY_WORDS. Everything readable (signs, labels) goes through
// ctx.makeLabel so it switches language.

/** Whitelist of the words drawn as calligraphy medallions. Nothing else is ever baked into a texture. */
export const CALLIGRAPHY_WORDS = Object.freeze(['الله', 'محمد']);
/** Honorific appended after «محمد» only when a font that has the glyph is confirmed loaded. */
export const HONORIFIC = 'ﷺ';

const CALLI_FONT = 'Amiri';

function canvas(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return [null, null];
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext?.('2d');
  return g ? [c, g] : [null, null];
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function toTex(THREE, c, { repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Wait (bounded) for the calligraphy web font. Resolves { loaded, honorific } and never rejects. */
export async function ensureCalligraphyFont(timeoutMs = 1500) {
  try {
    if (typeof document === 'undefined' || !document.fonts?.load) return { loaded: false, honorific: false };
    const spec = `700 160px "${CALLI_FONT}"`;
    const done = document.fonts.load(spec, CALLIGRAPHY_WORDS.join(' ') + HONORIFIC).then(() => true, () => false);
    const loaded = await Promise.race([done, new Promise((r) => setTimeout(() => r(false), timeoutMs))]);
    const honorific = !!loaded && document.fonts.check(spec, HONORIFIC);
    return { loaded: !!loaded, honorific };
  } catch {
    return { loaded: false, honorific: false };
  }
}

/** Draws one roundel (deep green disc, gold rings, gold word) centred at (cx, cy). */
function roundel(g, cx, cy, r, word, small) {
  g.save();
  g.fillStyle = '#c9a54a';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#123d33';
  g.beginPath(); g.arc(cx, cy, r * 0.93, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(214,180,96,0.85)';
  g.lineWidth = r * 0.018;
  g.beginPath(); g.arc(cx, cy, r * 0.86, 0, Math.PI * 2); g.stroke();
  // 16 small dots on the inner ring (simple geometric ornament)
  g.fillStyle = '#d8b862';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.895, cy + Math.sin(a) * r * 0.895, r * 0.018, 0, Math.PI * 2); g.fill();
  }
  g.direction = 'rtl';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#e6c873';
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = r * 0.03;
  g.font = `700 ${Math.round(r * (word.length > 4 ? 0.62 : 0.78))}px "${CALLI_FONT}", "Noto Naskh Arabic", "Geeza Pro", "Traditional Arabic", serif`;
  g.fillText(word, cx, cy + r * 0.04);
  if (small) {
    g.font = `700 ${Math.round(r * 0.3)}px "${CALLI_FONT}", "Noto Naskh Arabic", "Geeza Pro", serif`;
    g.fillText(small, cx, cy + r * 0.56);
  }
  g.restore();
}

/**
 * Calligraphy atlas 1024x512: left half «الله», right half «محمد» (+ «ﷺ» if `honorific`).
 * Returns null without a DOM.
 */
export function calligraphyAtlas(THREE, { honorific = false } = {}) {
  const [c, g] = canvas(1024, 512);
  if (!c) return null;
  g.clearRect(0, 0, 1024, 512);
  roundel(g, 256, 256, 240, CALLIGRAPHY_WORDS[0]);
  roundel(g, 768, 256, 240, CALLIGRAPHY_WORDS[1], honorific ? HONORIFIC : null);
  return toTex(THREE, c, { aniso: 4 });
}

/**
 * Prayer-carpet tile: one tile = 1.0 m wide x 1.2 m deep (one row, saff). Top of the image points to the
 * qibla once the floor plane is laid with rotation.x = -PI/2. Arches, border, and a light saff line.
 */
export function carpetTile(THREE) {
  const [c, g] = canvas(512, 512);
  if (!c) return null;
  const r = rng(11);
  g.fillStyle = '#7d1e2c';
  g.fillRect(0, 0, 512, 512);
  // fine wool noise
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  // saff line (front edge of the row) + back band
  g.fillStyle = '#e3cf9a';
  g.fillRect(0, 0, 512, 10);
  g.fillStyle = '#5c1520';
  g.fillRect(0, 500, 512, 12);
  // side borders between prayer places
  g.fillStyle = '#5c1520';
  g.fillRect(0, 0, 8, 512); g.fillRect(504, 0, 8, 512);
  // pointed arch (mihrab motif) pointing to the top of the tile
  const arch = (inset, color, width) => {
    g.strokeStyle = color; g.lineWidth = width;
    const x0 = 60 + inset, x1 = 452 - inset, yb = 470 - inset, ys = 190 + inset * 0.6, ya = 40 + inset * 1.4;
    g.beginPath();
    g.moveTo(x0, yb); g.lineTo(x0, ys);
    g.quadraticCurveTo(x0, ya + 40, 256, ya);
    g.quadraticCurveTo(x1, ya + 40, x1, ys);
    g.lineTo(x1, yb); g.closePath(); g.stroke();
  };
  g.fillStyle = '#8f2433';
  g.beginPath();
  g.moveTo(60, 470); g.lineTo(60, 190); g.quadraticCurveTo(60, 80, 256, 40); g.quadraticCurveTo(452, 80, 452, 190); g.lineTo(452, 470); g.closePath();
  g.fill();
  arch(0, '#d8b862', 8);
  arch(22, '#1f4d44', 5);
  // a small eight-point star motif in the arch
  g.save(); g.translate(256, 250); g.fillStyle = '#d8b862';
  for (let k = 0; k < 2; k++) { g.rotate(Math.PI / 4); g.fillRect(-28, -28, 56, 56); }
  g.restore();
  g.fillStyle = '#7d1e2c'; g.beginPath(); g.arc(256, 250, 18, 0, Math.PI * 2); g.fill();
  return toTex(THREE, c, { repeat: true });
}

/** Geometric tile for the mihrab niche (repeating 8-point star lattice in blue/turquoise/white). */
export function mihrabTile(THREE) {
  const [c, g] = canvas(256, 256);
  if (!c) return null;
  g.fillStyle = '#f3efe4'; g.fillRect(0, 0, 256, 256);
  const star = (x, y, s, col) => {
    g.save(); g.translate(x, y); g.fillStyle = col;
    for (let k = 0; k < 2; k++) { g.rotate(Math.PI / 4); g.fillRect(-s, -s, 2 * s, 2 * s); }
    g.restore();
  };
  for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256], [128, 128]]) { star(x, y, 46, '#1f5f8b'); star(x, y, 30, '#3aa6a0'); star(x, y, 12, '#f3efe4'); }
  for (const [x, y] of [[128, 0], [0, 128], [256, 128], [128, 256]]) star(x, y, 18, '#c9a54a');
  g.strokeStyle = 'rgba(31,95,139,0.35)'; g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254);
  return toTex(THREE, c, { repeat: true });
}
