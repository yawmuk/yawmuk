// Character accessories fitted to the character geometry (model space: metres, Y up, facing +Z, rest pose).
// Every builder returns [{ name, geometry, color?, rough?, side? }] where geometry carries position/normal/
// skinIndex/skinWeight bound to the primary skeleton (so pieces deform with the head, neck, chest, legs…).
//   hijab   — head + neck wrap with an oval face opening, under-chin tuck and a drape over shoulders/chest,
//             fitted to an envelope of the real head/neck/shoulder vertices, plus a contrasting underscarf rim
//   kufi, beanie, santa — caps fitted to the skull (+hair) cross-sections
//   beard   — a shell lifted off the jaw/chin skin (full | short), with a moustache
//   glasses — rims, bridge and temples at the measured eye positions
//   skirt   — long A-line skirt from waist to ankles, weighted between hips and thighs
//   sleeves / trousers — shells lifted off bare arm / leg skin (turns T-shirts and shorts into long sleeves / trousers)
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function build(kind, ctx, a) {
  const fn = { hijab, kufi, beanie, santa, beard, glasses, skirt, sleeves, trousers }[kind];
  return fn ? fn(ctx, a) : null;
}

// ------------------------------------------------------------------ helpers
const clamp = THREE.MathUtils.clamp;
const smoothstep = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Make a skinned geometry from positions [x,y,z,…], indices and a weight function (x,y,z) -> [[bone,w],…]. */
function skinnedGeo(pos, idx, weightFn, { smoothNormals = true, weld = true } = {}) {
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const n = pos.length / 3;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const ws = weightFn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).filter((x) => x[1] > 1e-4).sort((p, q) => q[1] - p[1]).slice(0, 4);
    const tot = ws.reduce((s, x) => s + x[1], 0) || 1;
    ws.forEach(([b, w], k) => { si[i * 4 + k] = b; sw[i * 4 + k] = w / tot; });
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  if (weld) g = mergeVertices(g, 1e-5);
  if (smoothNormals) g.computeVertexNormals();
  else { g = g.toNonIndexed(); g.computeVertexNormals(); }
  return g;
}

/** Attach skin attributes (all weight on one bone) to a plain three.js geometry. */
function rigid(geo, bone) {
  const g = geo.index ? geo : geo;
  for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a);
  const n = g.attributes.position.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return g;
}

function* verts(prims, filter) {
  const v = new THREE.Vector3();
  for (const p of prims) {
    const P = p.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      if (!filter || filter(p, i, v)) yield v;
    }
  }
}

/** Ellipse (centre + half axes in X/Z) of the vertices within ±h of height y. */
function bandEllipse(prims, y, h, filter) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, n = 0;
  for (const v of verts(prims, filter)) {
    if (Math.abs(v.y - y) > h) continue;
    n++; minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
  }
  if (!n) return null;
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, ax: (maxX - minX) / 2, az: (maxZ - minZ) / 2 };
}

/** Lathe through a list of rings [{y, cx, cz, ax, az}] (+ optional pole on top). Returns {pos, idx}. */
function ringLathe(rings, segs, { capTop = null, capBottom = false } = {}) {
  const pos = [], idx = [];
  for (const r of rings) for (let s = 0; s < segs; s++) {
    const t = (s / segs) * Math.PI * 2;
    pos.push(r.cx + Math.sin(t) * r.ax, r.y, r.cz + Math.cos(t) * r.az);
  }
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < segs; s++) {
    const a = r * segs + s, b = r * segs + ((s + 1) % segs), c = (r + 1) * segs + s, d = (r + 1) * segs + ((s + 1) % segs);
    idx.push(a, c, b, b, c, d);
  }
  if (capTop) {
    const top = pos.length / 3; pos.push(capTop.x, capTop.y, capTop.z);
    const base = (rings.length - 1) * segs;
    for (let s = 0; s < segs; s++) idx.push(base + s, top, base + ((s + 1) % segs));
  }
  if (capBottom) {
    const r0 = rings[0], bot = pos.length / 3; pos.push(r0.cx, r0.y, r0.cz);
    for (let s = 0; s < segs; s++) idx.push(s, ((s + 1) % segs), bot);
  }
  return { pos, idx };
}

/** Flip triangle winding if normals point inward (relative to a centre axis). */
function orientOutward(g, cx, cz) {
  const P = g.attributes.position, N = g.attributes.normal;
  let dot = 0;
  for (let i = 0; i < P.count; i += 7) dot += (P.getX(i) - cx) * N.getX(i) + (P.getZ(i) - cz) * N.getZ(i);
  if (dot < 0) {
    const I = g.index.array;
    for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}

/** Copy of the triangles of `prims` whose vertices all satisfy pick(dom, v), pushed out along smoothed normals. */
function shell(prims, pick, offset, extraPick) {
  const pos = [], si = [], sw = [];
  const key = (x, y, z) => `${Math.round(x * 2e3)},${Math.round(y * 2e3)},${Math.round(z * 2e3)}`;
  const nAcc = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3();
  const tris = [];
  for (const p of prims) {
    const P = p.geometry.attributes.position, I = p.geometry.index?.array;
    const triCount = I ? I.length / 3 : P.count / 3;
    for (let t = 0; t < triCount; t++) {
      const ia = I ? I[t * 3] : t * 3, ib = I ? I[t * 3 + 1] : t * 3 + 1, ic = I ? I[t * 3 + 2] : t * 3 + 2;
      a.fromBufferAttribute(P, ia); b.fromBufferAttribute(P, ib); c.fromBufferAttribute(P, ic);
      fn.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      for (const [v, i] of [[a, ia], [b, ib], [c, ic]]) {
        const k = key(v.x, v.y, v.z); const s = nAcc.get(k) || new THREE.Vector3(); s.add(fn); nAcc.set(k, s);
      }
      const ok = [[a, ia], [b, ib], [c, ic]].every(([v, i]) => pick(p.dom[i], v, p)) || (extraPick && extraPick(p, [ia, ib, ic], [a, b, c]));
      if (ok) tris.push([p, [ia, ib, ic]]);
    }
  }
  const SI = (p) => p.geometry.attributes.skinIndex, SW = (p) => p.geometry.attributes.skinWeight;
  for (const [p, ids] of tris) {
    for (const i of ids) {
      a.fromBufferAttribute(p.geometry.attributes.position, i);
      const n = nAcc.get(key(a.x, a.y, a.z)).clone().normalize();
      pos.push(a.x + n.x * offset, a.y + n.y * offset, a.z + n.z * offset);
      for (let k = 0; k < 4; k++) { si.push(SI(p).getComponent(i, k)); sw.push(SW(p).getComponent(i, k)); }
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(si), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(sw), 4));
  g.computeVertexNormals();
  return g;
}

const boneSet = (ctx, names) => new Set(names.map((n) => ctx.index.get(n)).filter((x) => x != null));

// ------------------------------------------------------------------ hijab
function hijab(ctx) {
  const hi = ctx.headInfo, B = (n) => ctx.index.get(n);
  const cx = hi.center.x, cz = hi.center.z;
  const iHead = B('Head'), iNeck = B('Neck'), iChest = B('Chest');
  const torsoBones = boneSet(ctx, ['Head', 'Neck', 'Chest', 'Torso', 'Abdomen', 'ShoulderL', 'ShoulderR']);
  const upperArms = boneSet(ctx, ['UpperArmL', 'UpperArmR']);
  const shoulderY = (hi.shoulders[0].y + hi.shoulders[1].y) / 2;
  const topY = hi.topY + 0.014;
  const hemBase = shoulderY - 0.15;
  const yMin = hemBase - 0.08, dy = 0.01;
  const NC = 48, NR = Math.ceil((topY + 0.02 - yMin) / dy) + 1;
  const env = Array.from({ length: NC }, () => new Float32Array(NR).fill(-1));
  const addV = (v) => {
    const dx = v.x - cx, dz = v.z - cz, r = Math.hypot(dx, dz);
    let phi = Math.atan2(dx, dz); if (phi < 0) phi += Math.PI * 2;
    const c = Math.floor((phi / (Math.PI * 2)) * NC) % NC, row = Math.round((v.y - yMin) / dy);
    if (row < 0 || row >= NR) return;
    for (const cc of [c - 1, c, c + 1]) { const k = (cc + NC) % NC; if (r > env[k][row]) env[k][row] = r; }
  };
  for (const v of verts(ctx.head, (p) => p.role !== 'hair' && p.role !== 'hat' && p.role !== 'hatBand')) addV(v);
  for (const v of verts(ctx.body, (p, i, v) => torsoBones.has(p.dom[i]) || (upperArms.has(p.dom[i]) && v.y > shoulderY - 0.05))) addV(v);
  // fill gaps along each column, then dilate + smooth
  for (const col of env) {
    let last = -1;
    for (let r = 0; r < NR; r++) { if (col[r] >= 0) { if (last >= 0 && r - last > 1) for (let k = last + 1; k < r; k++) col[k] = col[last] + (col[r] - col[last]) * ((k - last) / (r - last)); last = r; } }
    const first = col.findIndex((x) => x >= 0); for (let r = 0; r < first; r++) col[r] = col[first];
    for (let r = last + 1; r < NR; r++) col[r] = 0;
  }
  const pass = (src, fnc) => src.map((col, c) => col.map((_, r) => fnc(c, r)));
  let E = pass(env, (c, r) => Math.max(...[-2, -1, 0, 1, 2].map((d) => env[c][clamp(r + d, 0, NR - 1)]), env[(c + 1) % NC][r], env[(c + NC - 1) % NC][r]));
  for (let it = 0; it < 5; it++) {
    const P = E;
    E = pass(P, (c, r) => 0.4 * P[c][r] + 0.15 * (P[(c + 1) % NC][r] + P[(c + NC - 1) % NC][r]) + 0.15 * (P[c][clamp(r + 1, 0, NR - 1)] + P[c][clamp(r - 1, 0, NR - 1)]));
  }
  const envAt = (phi, y) => {
    const f = ((phi / (Math.PI * 2)) * NC + NC) % NC, c0 = Math.floor(f), c1 = (c0 + 1) % NC, tc = f - c0;
    const fr = clamp((y - yMin) / dy, 0, NR - 1), r0 = Math.floor(fr), r1 = Math.min(NR - 1, r0 + 1), tr = fr - r0;
    const e = (c) => E[c][r0] * (1 - tr) + E[c][r1] * tr;
    return e(c0) * (1 - tc) + e(c1) * tc;
  };
  // face opening (oval, front = phi 0)
  const browY = hi.eyeY + 0.045, chinOpen = hi.chinY + 0.014;
  const yc = (browY + chinOpen) / 2, hh = (browY - chinOpen) / 2, phiW = 1.0;
  const openAt = (phi) => { const p = phi > Math.PI ? phi - Math.PI * 2 : phi; const u = Math.abs(p) / phiW; return u >= 1 ? 0 : Math.pow(1 - u * u, 0.6); };
  const neckY = hi.neck.y, headBoneY = hi.headBone.y;
  const rNeck = Math.max(...Array.from({ length: 12 }, (_, i) => envAt((i / 12) * Math.PI * 2, neckY + 0.03))) + 0.02;
  const radius = (phi, y) => {
    const e = envAt(phi, y);
    if (y >= headBoneY) return e + 0.013;
    // neck + drape: never tighter than a cone that falls from the neck over the shoulders
    const cone = rNeck + Math.max(0, neckY + 0.02 - y) * 0.35;
    const tm = smoothstep(y, neckY - 0.02, headBoneY);
    const m = 0.016 * (1 - tm) + 0.013 * tm;
    return Math.max(e + m, y < headBoneY - 0.01 ? cone * (1 - tm * 0.6) : 0);
  };
  const hemAt = (phi) => hemBase - 0.06 * Math.pow(Math.cos(phi), 2) + 0.05 * Math.pow(Math.sin(phi), 2);
  const point = (phi, y) => { const r = radius(phi, y); return [cx + Math.sin(phi) * r, y, cz + Math.cos(phi) * r]; };

  const U = 18, Lr = 30;
  const pos = [], idx = [];
  const grid = (rowsFn, nRows) => {
    const base = pos.length / 3;
    for (let c = 0; c <= NC; c++) {
      const phi = ((c % NC) / NC) * Math.PI * 2;
      for (let r = 0; r < nRows; r++) pos.push(...point(phi, rowsFn(phi, r / (nRows - 1))));
    }
    for (let c = 0; c < NC; c++) for (let r = 0; r < nRows - 1; r++) {
      const a = base + c * nRows + r, b = a + 1, d = base + (c + 1) * nRows + r, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    return base;
  };
  // upper: crown -> brow line (hole columns) / face centre height (others)
  const upTop = (t) => t * t; // denser rows near the crown
  const ubase = grid((phi, t) => { const o = openAt(phi); const yEnd = yc + hh * o; return topY - 0.004 + (yEnd - topY + 0.004) * upTop(t); }, U);
  // lower: chin line -> hem
  grid((phi, t) => { const o = openAt(phi); const y0 = yc - hh * o; return y0 + (hemAt(phi) - y0) * t; }, Lr);
  // crown pole
  const pole = pos.length / 3; pos.push(cx, topY + 0.002, cz);
  for (let c = 0; c < NC; c++) idx.push(ubase + c * U, ubase + (c + 1) * U, pole);

  const wHead = (x, y) => {
    if (y >= headBoneY) return [[iHead, 1]];
    if (y >= neckY) { const t = (headBoneY - y) / Math.max(0.01, headBoneY - neckY); return [[iHead, 1 - t], [iNeck, t]]; }
    const t = clamp((neckY - y) / 0.07, 0, 1);
    return [[iNeck, 1 - t], [iChest, t]];
  };
  const g = orientOutward(skinnedGeo(pos, idx, wHead), cx, cz);

  // underscarf rim: a narrow band just inside the face opening
  const rp = [], ri = [];
  const steps = 40;
  for (let s = 0; s <= steps; s++) {
    const u = (s / steps) * 2 - 1; // -1..1 across the opening
    const phi = (u * phiW + Math.PI * 2) % (Math.PI * 2);
    const o = openAt(phi);
    for (const [y0, dir] of [[yc + hh * o, -1], [yc - hh * o, 1]]) {
      const outer = point(phi, y0), inner = point(phi, y0 + dir * 0.011 * (0.4 + 0.6 * o));
      const pull = (p) => { const dx = p[0] - cx, dz = p[2] - cz, r = Math.hypot(dx, dz) || 1; return [cx + dx * (r - 0.003) / r, p[1], cz + dz * (r - 0.003) / r]; };
      rp.push(...pull(outer), ...pull(inner));
    }
  }
  for (let s = 0; s < steps; s++) {
    for (const k of [0, 1]) {
      const a = (s * 2 + k) * 2, b = ((s + 1) * 2 + k) * 2;
      ri.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const rim = skinnedGeo(rp, ri, wHead, { weld: false });
  return [{ name: 'wrap', geometry: g, rough: 0.92, side: THREE.DoubleSide }, { name: 'rim', geometry: rim, color: 'rim', rough: 0.9, side: THREE.DoubleSide }];
}

// ------------------------------------------------------------------ caps
function skullPrims(ctx, withHair = true) { return ctx.head.filter((p) => withHair || (p.role !== 'hair' && p.role !== 'hat' && p.role !== 'hatBand')); }

function capRings(ctx, y0, y1, n, grow, extra = 0) {
  const prims = skullPrims(ctx, true).filter((p) => p.role !== 'hat' && p.role !== 'hatBand');
  const rings = [];
  let prev = null;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), y = y0 + (y1 - y0) * t;
    const e = bandEllipse(prims, y, 0.008) || prev;
    if (!e) continue;
    prev = e;
    rings.push({ y, cx: e.cx, cz: e.cz, ax: e.ax * grow + extra, az: e.az * grow + extra });
  }
  return rings;
}

function kufi(ctx) {
  const hi = ctx.headInfo, top = hi.hairTop;
  const yb = Math.max(hi.eyeY + 0.075, top - 0.07);
  const base = bandEllipse(skullPrims(ctx), yb, 0.01) || { cx: hi.center.x, cz: hi.center.z, ax: hi.half.x, az: hi.half.z };
  const R = (k, y) => ({ y, cx: base.cx, cz: base.cz, ax: base.ax * k + 0.008, az: base.az * k + 0.008 });
  const rings = [R(1.0, yb - 0.004), R(1.0, yb + 0.03), R(0.99, top - 0.005), R(0.9, top + 0.008), R(0.62, top + 0.014)];
  const { pos, idx } = ringLathe(rings, 28, { capTop: { x: base.cx, y: top + 0.016, z: base.cz } });
  const g = orientOutward(skinnedGeo(pos, idx, () => [[ctx.index.get('Head'), 1]]), base.cx, base.cz);
  return [{ name: 'kufi', geometry: g, rough: 0.9, side: THREE.DoubleSide }];
}

function beanie(ctx) {
  const hi = ctx.headInfo, top = hi.hairTop;
  const yb = hi.eyeY + 0.035;
  const rings = capRings(ctx, yb, top - 0.004, 9, 1.04, 0.01);
  if (rings.length < 3) return null;
  const last = rings[rings.length - 1];
  rings.push({ ...last, y: top + 0.012, ax: last.ax * 0.6, az: last.az * 0.6 });
  // rolled cuff
  const c0 = rings[0];
  const cuff = [{ ...c0, y: yb - 0.004, ax: c0.ax + 0.008, az: c0.az + 0.008 }, { ...c0, y: yb + 0.035, ax: c0.ax + 0.01, az: c0.az + 0.01 }];
  const body = ringLathe(rings, 28, { capTop: { x: last.cx, y: top + 0.02, z: last.cz } });
  const ring = ringLathe(cuff, 28);
  const H = () => [[ctx.index.get('Head'), 1]];
  return [
    { name: 'beanie', geometry: orientOutward(skinnedGeo(body.pos, body.idx, H), last.cx, last.cz), rough: 0.95, side: THREE.DoubleSide },
    { name: 'cuff', geometry: orientOutward(skinnedGeo(ring.pos, ring.idx, H), c0.cx, c0.cz), rough: 0.95, side: THREE.DoubleSide }
  ];
}

function santa(ctx) {
  const hi = ctx.headInfo, top = hi.hairTop;
  const yb = hi.eyeY + 0.05;
  const base = bandEllipse(skullPrims(ctx), yb + 0.02, 0.01) || { cx: hi.center.x, cz: hi.center.z, ax: hi.half.x, az: hi.half.z };
  const rings = [];
  const n = 12, tip = { x: base.cx, y: top + 0.2, z: base.cz - 0.13 };
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const k = (1 - t) * 1.06;
    const y = yb + 0.02 + (tip.y - yb - 0.02) * t - 0.07 * t * t;
    const z = base.cz + (tip.z - base.cz) * t * t;
    rings.push({ y, cx: base.cx, cz: z, ax: base.ax * k + 0.008 * (1 - t), az: base.az * k + 0.008 * (1 - t) });
  }
  const H = () => [[ctx.index.get('Head'), 1]];
  const cone = ringLathe(rings, 20, { capTop: { x: tip.x, y: rings[n - 1].y, z: rings[n - 1].cz } });
  const band = ringLathe([{ ...base, y: yb - 0.005, ax: base.ax + 0.022, az: base.az + 0.022 }, { ...base, y: yb + 0.045, ax: base.ax + 0.024, az: base.az + 0.024 }], 24, {});
  const pom = new THREE.IcosahedronGeometry(0.035, 1).translate(base.cx, rings[n - 1].y - 0.01, rings[n - 1].cz - 0.01);
  return [
    { name: 'cone', geometry: orientOutward(skinnedGeo(cone.pos, cone.idx, H), base.cx, base.cz), rough: 0.9, side: THREE.DoubleSide },
    { name: 'band', geometry: orientOutward(skinnedGeo(band.pos, band.idx, H), base.cx, base.cz), color: 'white', rough: 1, side: THREE.DoubleSide },
    { name: 'pom', geometry: rigid(pom, ctx.index.get('Head')), color: 'white', rough: 1 }
  ];
}

// ------------------------------------------------------------------ beard
function beard(ctx, a) {
  const hi = ctx.headInfo, iHead = ctx.index.get('Head');
  const mouthY = hi.eyeY - 0.6 * (hi.eyeY - hi.chinY);
  const backZ = hi.center.z - 0.015;
  const skin = ctx.head.filter((p) => p.role === 'skin' || p.role === 'skinDark');
  const short = a.style === 'short';
  const g = shell(skin, (dom, v) => dom === iHead && v.y < mouthY + 0.004 && v.z > backZ && v.y > hi.chinY - 0.03, short ? 0.0045 : 0.008);
  const m = shell(skin, (dom, v) => dom === iHead && v.y < mouthY + 0.024 && v.y > mouthY - 0.006 && Math.abs(v.x - hi.center.x) < 0.034 && v.z > hi.eyeZ - 0.04, 0.006);
  const out = [];
  if (g) out.push({ name: 'beard', geometry: g, rough: 0.95 });
  if (m) out.push({ name: 'moustache', geometry: m, rough: 0.95 });
  return out;
}

// ------------------------------------------------------------------ glasses
function glasses(ctx) {
  const hi = ctx.headInfo, iHead = ctx.index.get('Head');
  const z = hi.eyeZ + 0.014, y = hi.eyeY + 0.002, ex = Math.max(0.026, hi.eyeX);
  const parts = [];
  for (const s of [-1, 1]) {
    const rimG = new THREE.TorusGeometry(0.019, 0.0026, 5, 18);
    rimG.scale(1.28, 1, 1).translate(hi.center.x + s * ex, y, z);
    parts.push(rimG);
    const temple = new THREE.BoxGeometry(0.004, 0.004, Math.max(0.05, z - hi.center.z));
    const tx = hi.center.x + s * (hi.half.x + 0.006);
    temple.translate(tx, y + 0.004, (z + hi.center.z) / 2 - 0.004);
    parts.push(temple);
    const hinge = new THREE.BoxGeometry(Math.abs(tx - (hi.center.x + s * (ex + 0.024))) + 0.004, 0.004, 0.004);
    hinge.translate((tx + hi.center.x + s * (ex + 0.024)) / 2, y + 0.004, z);
    parts.push(hinge);
  }
  const bridge = new THREE.CylinderGeometry(0.0022, 0.0022, Math.max(0.008, 2 * ex - 0.048), 5).rotateZ(Math.PI / 2).translate(hi.center.x, y + 0.006, z);
  parts.push(bridge);
  // fresh, never-rendered primitives: position/normal are always Float32, so the merge sees consistent array types
  const geos = parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k); return q; });
  const merged = mergeGeometries(geos, false);
  return [{ name: 'glasses', geometry: rigid(merged, iHead), rough: 0.35 }];
}

// ------------------------------------------------------------------ skirt
function skirt(ctx) {
  const tpl = ctx.tpl;
  const hips = tpl.bonePos('Hips'), legL = tpl.bonePos('UpperLegL');
  const iHips = ctx.index.get('Hips'), iL = ctx.index.get('UpperLegL'), iR = ctx.index.get('UpperLegR');
  const iLL = ctx.index.get('LowerLegL'), iLR = ctx.index.get('LowerLegR');
  const sideL = Math.sign(legL.x - hips.x) || 1;
  const waistY = legL.y + 0.1;
  const prims = [...ctx.body, ...ctx.legs];
  const core = boneSet(ctx, ['Hips', 'Abdomen', 'Torso', 'UpperLegL', 'UpperLegR']);
  const coreF = (p, i) => core.has(p.dom[i]);
  const top = bandEllipse(prims, waistY, 0.015, coreF) || { cx: hips.x, cz: hips.z, ax: 0.16, az: 0.11 };
  const hipE = bandEllipse(prims, legL.y - 0.06, 0.02, coreF) || top;
  const n = 11, rings = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = waistY + (0.07 - waistY) * t;
    const flare = 1 + 0.22 * Math.pow(t, 1.6);
    const ax = Math.max(top.ax + 0.015, (hipE.ax + 0.03) * Math.min(1, t * 4)) * flare;
    const az = Math.max(top.az + 0.018, (hipE.az + 0.05) * Math.min(1, t * 4)) * flare;
    rings.push({ y, cx: top.cx, cz: top.cz + 0.01 * t, ax: Math.max(ax, 0.13 + 0.06 * t), az: Math.max(az, 0.11 + 0.06 * t) });
  }
  const { pos, idx } = ringLathe(rings, 32);
  const w = (x, y, z) => {
    const t = clamp((waistY - y) / (waistY - 0.07), 0, 1);
    const legW = 0.62 * Math.pow(t, 0.8);
    const side = clamp(((x - top.cx) / 0.12) * sideL, -1, 1);
    const l = legW * (0.5 + 0.5 * side), r = legW * (0.5 - 0.5 * side);
    // the hem partly follows the shins, so a seated skirt drapes over the knees instead of jutting forward
    const sh = smoothstep(t, 0.5, 0.95) * 0.45;
    return [[iHips, 1 - legW], [iL, l * (1 - sh)], [iR, r * (1 - sh)], [iLL, l * sh], [iLR, r * sh]];
  };
  const g = orientOutward(skinnedGeo(pos, idx, w), top.cx, top.cz);
  return [{ name: 'skirt', geometry: g, rough: 0.9, side: THREE.DoubleSide }];
}

// ------------------------------------------------------------------ sleeves / trousers
function sleeves(ctx) {
  const arms = boneSet(ctx, ['UpperArmL', 'UpperArmR', 'LowerArmL', 'LowerArmR', 'ShoulderL', 'ShoulderR']);
  const hands = new Set([...ctx.index.entries()].filter(([n]) => /Wrist|Index|Middle|Ring|Pinky|Thumb/.test(n)).map(([, i]) => i));
  const skin = ctx.body.filter((p) => p.role === 'skin');
  // all-arm triangles, plus border triangles (one arm vertex, no hand vertex) to close the seam with the shirt
  const g = shell(skin, (dom) => arms.has(dom), 0.0055, (p, ids) => ids.some((i) => arms.has(p.dom[i])) && !ids.some((i) => hands.has(p.dom[i])));
  return g ? [{ name: 'sleeves', geometry: g, rough: 0.85 }] : null;
}
function trousers(ctx) {
  const legs = boneSet(ctx, ['UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR', 'Hips']);
  const skin = ctx.legs.filter((p) => p.role === 'skin');
  const g = shell(skin, (dom) => legs.has(dom), 0.006);
  return g ? [{ name: 'trousers', geometry: g, rough: 0.85 }] : null;
}
