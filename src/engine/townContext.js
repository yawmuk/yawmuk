// Town context: the neighbourhood «حيّ السلام» seen around every interior, so each building reads as part of the
// main map (not a separate region). A ring of low-poly houses, round-canopy trees, black street lamps, the street
// in front of the entrance and the mosque's green dome + minaret on the skyline — placed OUTSIDE the interior's
// bounds and never part of the walkable area or the camera occluders (sceneManager adds it next to res.backdrop).
// Same palette/style as src/scenes/town.js. Standard materials only (vertex colours), no custom shaders, so it
// works on both renderers. 3 merged meshes = 3 draw calls; nothing casts or receives shadows.
import * as THREE from 'three';

const PI = Math.PI;
const GREENS = ['#3f7a2c', '#4c8a33', '#5b963a', '#3a6b28', '#69993c', '#46812f'];
const AUTUMN = ['#d88a2f', '#c86c2c', '#e2a43e', '#ba5a2b', '#d4973a'];
const WARM = ['#ffd38f', '#ffc977', '#ffe0a8', '#ffbf6a'];
const WALLS = ['#f2ede1', '#efe6d6', '#f3ecdf', '#e8d9b8', '#d9dfe0', '#e9d6c4', '#dcc6a2', '#ebdfc5', '#c8d3dd', '#dde6d3'];
const ROOFS = ['#4a5260', '#5b5f66', '#6d4a3c', '#55606b', '#4f5d6b'];
const IRON = '#1c1e21';

function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Minimal merge batcher: primitives -> one vertex-coloured BufferGeometry. */
function batch() {
  const P = [], N = [], C = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color();
  const nrm = new THREE.Matrix3();
  const api = {
    geo(g, color, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
      const gg = g.index ? g.toNonIndexed() : g;
      e.set(0, ry, 0); q.setFromEuler(e); m.compose(p.set(x, y, z), q, s.set(sx, sy, sz)); nrm.getNormalMatrix(m);
      c.set(color);
      const pa = gg.attributes.position, na = gg.attributes.normal;
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m); P.push(v.x, v.y, v.z);
        v.fromBufferAttribute(na, i).applyMatrix3(nrm).normalize(); N.push(v.x, v.y, v.z);
        C.push(c.r, c.g, c.b);
      }
      if (gg !== g) gg.dispose();
      g.dispose();
      return api;
    },
    fbox(color, w, h, d, x, y0, z, ry = 0) { return api.geo(new THREE.BoxGeometry(w, h, d), color, x, y0 + h / 2, z, ry); },
    fcyl(color, rt, rb, h, x, y0, z, seg = 8) { return api.geo(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y0 + h / 2, z); },
    ico(color, r, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) { return api.geo(new THREE.IcosahedronGeometry(r, 1), color, x, y, z, ry, sx, sy, sz); },
    build(material, name) {
      if (!P.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, material);
      mesh.name = name;
      mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      return mesh;
    }
  };
  return api;
}

function prism(w, h, depth) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}

/**
 * Build the neighbourhood around an interior.
 * opts: { bounds:{minX,maxX,minZ,maxZ}, front:[x,z] (the exit/door position: the street runs on that side),
 *         location, quality, night }
 * Returns a THREE.Group (add it to the scene root, never to the scene group) with userData.dispose().
 */
export function createTownContext({ bounds, front = null, location = '', quality = 'high', night = false } = {}) {
  const group = new THREE.Group();
  group.name = 'backdrop:town';
  if (!bounds) return group;
  const low = quality === 'low';
  let seed = 7; for (const ch of String(location)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const R = rng(seed);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const tint = (hex, amt = 1) => {
    const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl);
    return c.setHSL(hsl.h + (R() - 0.5) * 0.03 * amt, Math.min(1, hsl.s * (0.88 + R() * 0.24 * amt)), Math.min(1, hsl.l * (0.86 + R() * 0.28 * amt)));
  };
  const S = batch(), L = batch(), Gl = batch();
  const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
  const hx = (bounds.maxX - bounds.minX) / 2 + 1.5, hz = (bounds.maxZ - bounds.minZ) / 2 + 1.5; // + the outer wall

  // which side faces the street (where the exit door is): 0 = +X, 1 = -X, 2 = +Z, 3 = -Z
  let frontSide = 2;
  if (front) {
    const dx = (front[0] - cx) / hx, dz = (front[1] - cz) / hz;
    frontSide = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 0 : 1) : (dz > 0 ? 2 : 3);
  }
  // local frame per side: outward normal (nx,nz), tangent (tx,tz), half-length along the tangent, distance to wall
  const sides = [
    { nx: 1, nz: 0, tx: 0, tz: 1, len: hz, dist: hx },
    { nx: -1, nz: 0, tx: 0, tz: 1, len: hz, dist: hx },
    { nx: 0, nz: 1, tx: 1, tz: 0, len: hx, dist: hz },
    { nx: 0, nz: -1, tx: 1, tz: 0, len: hx, dist: hz }
  ];
  const at = (sd, u, d) => [cx + sd.nx * (sd.dist + d) + sd.tx * u, cz + sd.nz * (sd.dist + d) + sd.tz * u];

  // ---- ground: lawn out to the haze, a sidewalk apron around the building, the avenue in front
  S.geo(new THREE.CircleGeometry(120, 32).rotateX(-PI / 2), '#6e9447', cx, -0.09, cz);
  S.fbox('#c8b699', hx * 2 + 6, 0.02, hz * 2 + 6, cx, -0.08, cz);
  {
    const sd = sides[frontSide];
    const [x, z] = at(sd, 0, 6.5);
    const w = sd.tx ? 200 : 7, d = sd.tx ? 7 : 200;
    S.fbox('#4c4844', w, 0.02, d, x, -0.07, z);
    const [x2, z2] = at(sd, 0, 11.25);
    S.fbox('#c8b699', sd.tx ? 200 : 2.5, 0.02, sd.tx ? 2.5 : 200, x2, -0.065, z2);
  }

  // ---- pieces
  const tree = (x, z, s = 1) => {
    const trunkH = 1.7 * s;
    S.fcyl('#5b4231', 0.1 * s, 0.17 * s, trunkH + 0.7 * s, x, -0.05, z, 6);
    const pal = R() < 0.3 ? AUTUMN : GREENS, base = pick(pal), cy = trunkH + 1.0 * s;
    const n = low ? 2 : 4;
    for (let k = 0; k < n; k++) {
      const a = R() * PI * 2, rr = k === 0 ? 0 : 0.6 * s * (0.6 + R() * 0.4);
      const r = (k === 0 ? 1.12 : 0.72 + R() * 0.3) * s;
      L.ico(tint(R() < 0.75 ? base : pick(pal)), r, x + Math.cos(a) * rr, cy + (k === 0 ? 0 : (R() - 0.35) * s), z + Math.sin(a) * rr, 1, 0.88 + R() * 0.15, 1, R() * PI);
    }
  };
  const lamp = (x, z) => {
    S.fcyl(IRON, 0.15, 0.19, 0.4, x, -0.05, z, 8);
    S.fcyl(IRON, 0.05, 0.07, 3.3, x, 0.35, z, 6);
    Gl.fcyl('#ffcf85', 0.15, 0.11, 0.44, x, 3.7, z, 6);
    S.geo(new THREE.ConeGeometry(0.25, 0.26, 6), IRON, x, 4.27, z);
  };
  // a house facing the interior (ry turns its lit facade towards the centre)
  const house = (x, z, ry, big = false) => {
    const w = 6 + R() * 3, d = 6 + R() * 2, h = (big ? 6 : 3.2) + R() * (big ? 6 : 1.8);
    S.geo(new THREE.BoxGeometry(w, h, d), tint(pick(WALLS), 0.5), x, h / 2 - 0.05, z, ry);
    if (!big || R() < 0.4) S.geo(prism(w + 0.6, 1.5 + R() * 0.8, d + 0.6), tint(pick(ROOFS), 0.4), x, h - 0.05, z, ry);
    else S.fbox('#e2d6bc', w + 0.3, 0.3, d + 0.3, x, h - 0.05, z, ry);
    // warm windows on the facade facing the interior (+local Z after the yaw) and a lit door
    const fx = Math.sin(ry), fz = Math.cos(ry), tx = Math.cos(ry), tz = -Math.sin(ry);
    const rows = Math.max(1, Math.floor((h - 0.8) / 2.4));
    for (let r = 0; r < rows; r++) for (const u of [-w * 0.3, w * 0.3]) {
      if (R() < (night ? 0.15 : 0.35)) continue;
      Gl.geo(new THREE.BoxGeometry(0.9, 1.0, 0.08), pick(WARM), x + tx * u + fx * (d / 2 + 0.03), 1.4 + r * 2.4, z + tz * u + fz * (d / 2 + 0.03), ry);
    }
    Gl.geo(new THREE.BoxGeometry(1.0, 2.0, 0.08), '#ffc977', x + fx * (d / 2 + 0.03), 0.95, z + fz * (d / 2 + 0.03), ry);
  };

  // ---- rings: houses beyond the street / garden on every side, trees + lamps in between
  sides.forEach((sd, i) => {
    const isFront = i === frontSide;
    const yaw = Math.atan2(-sd.nx, -sd.nz);        // face the interior
    for (const [d, big] of [[isFront ? 17 : 11, false], [isFront ? 30 : 24, true]]) {
      if (low && big) continue;
      const span = sd.len + d;                    // longer rows further out so corners stay filled
      for (let u = -span; u <= span; u += 9 + R() * 3) {
        if (R() < 0.12) continue;
        const [x, z] = at(sd, u + (R() - 0.5) * 2, d + (R() - 0.5) * 2);
        house(x, z, yaw, big && R() < 0.5);
      }
    }
    // a row of trees in the garden between the wall and the houses, lamps along the sidewalk
    for (let u = -sd.len - 2; u <= sd.len + 2; u += 5.5 + R() * 2) {
      const [x, z] = at(sd, u, (isFront ? 12.5 : 5.5) + (R() - 0.5));
      tree(x, z, 0.85 + R() * 0.35);
    }
    for (let u = -sd.len; u <= sd.len; u += 9) {
      const [x, z] = at(sd, u, isFront ? 2.6 : 3.2);
      lamp(x, z);
    }
  });

  // ---- the mosque on the skyline: green dome on a white drum + a slender minaret (skipped inside the mosque)
  if (location !== 'mosque') {
    const back = sides[frontSide ^ 1];               // behind the building, slightly to one side
    const [mx, mz] = at(back, back.len * 0.6 + 6, 34);
    S.fbox('#f4efe3', 11, 6, 10, mx, -0.05, mz);
    S.fcyl('#f4efe3', 2.9, 3.0, 1.0, mx, 5.95, mz, 20);
    const pts = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * PI / 2; pts.push(new THREE.Vector2(Math.max(0.001, 2.75 * Math.cos(a) * (1 + 0.1 * Math.sin(a * 2))), 3.2 * Math.pow(Math.sin(a), 0.85))); }
    S.geo(new THREE.LatheGeometry(pts, 20), '#3f8f6a', mx, 6.9, mz);
    S.fcyl('#c9a227', 0.05, 0.08, 0.8, mx, 10.05, mz, 6);
    const nx = mx + 7.2, nz = mz + 3.5;
    S.fcyl('#f5f0e5', 0.5, 0.6, 11.4, nx, -0.05, nz, 12);
    S.fcyl('#e2d6bc', 0.84, 0.6, 0.32, nx, 11.4, nz, 12);
    S.fcyl('#f5f0e5', 0.38, 0.42, 2.6, nx, 11.72, nz, 12);
    S.geo(new THREE.ConeGeometry(0.44, 2.0, 12), '#3f8f6a', nx, 15.3, nz);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; Gl.geo(new THREE.IcosahedronGeometry(0.07, 0), '#ffe1a0', nx + Math.cos(a) * 0.82, 11.6, nz + Math.sin(a) * 0.82); }
    for (let k = 0; k < 10; k++) { const a = (k / 10) * PI * 2; Gl.geo(new THREE.BoxGeometry(0.26, 0.48, 0.06), pick(WARM), mx + Math.cos(a) * 2.95, 6.45, mz + Math.sin(a) * 2.95, Math.atan2(Math.cos(a), Math.sin(a))); }
  }

  const mats = [
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
    new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(1.6, 1.4, 1.15) })
  ];
  [S.build(mats[0], 'town:ctx-solid'), L.build(mats[1], 'town:ctx-leaf'), Gl.build(mats[2], 'town:ctx-glow')].forEach((m) => { if (m) { m.userData.noCameraCollide = true; group.add(m); } });
  group.userData.dispose = () => { group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); mats.forEach((m) => m.dispose()); };
  return group;
}
