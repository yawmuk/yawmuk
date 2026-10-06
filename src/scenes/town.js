// «يومك» — the neighbourhood: ONE walkable hub that connects every location.
// Adam walks the street grid and presses E at a glowing door to go into that building (home, office, college,
// market street, event hall, the neighbours', the mosque, the Islamic bank). Each interior's exit returns here,
// at that building's door. Procedural geometry only, merged per material (see home/batch.js): 5 draw calls of
// static geometry + a few background people.
// Look: the golden-hour key art (public/brand/imagery/keyart-town-golden-hour.jpg) — round-canopy trees (some
// autumn), cypresses by the mosque, black lanterns, flower beds, a playground at the college, warm windows.
// The sky, hills, sea and the suburb beyond the hedges are a separate `backdrop` (never part of the walkable bounds).
// Backdrop mode: the engine builds this scene again with `ctx.backdropFor = '<location>'` to surround that interior
// with the real street (static scenery only, the shell of that building left out, no labels/people/doors). The
// interior's local origin is placed at INTERIOR_ANCHORS[location].
import { createBatcher } from './home/batch.js';
import { HOUSE } from './home/layout.js';
import { createGoldenSky, rng, GOLDEN } from '../engine/goldenSky.js';
import { groundMaterial, wallMaterial, applyLeafSurface } from '../engine/tslSurfaces.js';
import { LIGHTING } from '../engine/config.js';
import { positionView, screenCoordinate, floor, dot, vec2, sin, fract, bool } from 'three/tsl';

const PI = Math.PI;
const FACE = 8;          // |z| of the building facades (north row at -8, south row at +8)
const DOOR = 6.9;        // |z| of the door interaction points (forecourt, just off the sidewalk)
const SPAWN = 4.6;       // |z| where Adam appears when he walks out of a building (on the sidewalk)
const HALF_X = 31, HALF_Z = 21; // map half extents (62 x 42 m)
// Backdrop mode and the interior's own building: the brief said to omit its whole shell, but home.js is now a CLOSED
// room (double-sided walls + ceiling, camera kept indoors), so its upper storey, roof and porch roof are kept so the
// house is complete when seen from the street inside that scene. Flip to false to omit them again (dollhouse camera).
const BACKDROP_UPPER_STOREY = true;

// side 'n' = north row (facade faces +Z), 's' = south row (facade faces -Z)
const BUILDINGS = [
  // Adam's house: the interior's 12 x 9 footprint (home/layout.js), door at centre + 4.5; the new-day spawn looks west
  // along the avenue, away from the low sun at the east end (GOLDEN.sunAz)
  { loc: 'home', x: -23, side: 'n', w: HOUSE.w, d: HOUSE.d, h: 5.6, kind: 'house', doorX: HOUSE.door.x, spawnYaw: PI / 2,
    color: HOUSE.colors.siding, roof: HOUSE.colors.roof, label: { ar: 'بيت آدم', en: "Adam's home" } },
  { loc: 'school', x: -11, side: 'n', w: 9, d: 9, h: 8, kind: 'school', color: '#a24f39', label: { ar: 'الكلية', en: 'College' } },
  { loc: 'mosque', x: 12, side: 'n', w: 11, d: 10, h: 6, kind: 'mosque', color: '#f4efe3', label: { ar: 'المسجد', en: 'Mosque' } },
  { loc: 'work', x: 24, side: 'n', w: 8, d: 9, h: 15, kind: 'office', color: '#5f819b', label: { ar: 'مكتب العمل', en: 'The office' } },
  { loc: 'street', x: -22, side: 's', w: 9, d: 7, h: 4.6, kind: 'market', color: '#dcc6a2', label: { ar: 'سوق الحيّ', en: 'Market street' } },
  { loc: 'bank', x: -11, side: 's', w: 9, d: 8, h: 7, kind: 'bank', color: '#ebdfc5', label: { ar: 'البنك الإسلامي', en: 'Islamic bank' } },
  { loc: 'public_events', x: 12, side: 's', w: 11, d: 9, h: 6.5, kind: 'hall', color: '#c8d3dd', label: { ar: 'قاعة المناسبات', en: 'Event hall' } },
  { loc: 'private_events', x: 24, side: 's', w: 8, d: 8, h: 5, kind: 'house', color: '#dde6d3', roof: '#4f5d6b', lights: true, label: { ar: 'بيت الجيران', en: "The neighbours' home" } }
];

/** Geometry of a building in world space: facade z, front direction f (+1 faces +Z), centre z, door + spawn points. */
export function layoutOf(b) {
  const f = b.side === 'n' ? 1 : -1;
  const zFace = -f * FACE;
  const doorX = b.x + (b.doorX ?? 0);          // per-building door offset from the building centre
  return {
    f, zFace, zc: zFace - f * b.d / 2, doorX,
    door: [doorX, 0, -f * DOOR],
    // step out onto the sidewalk facing along the street (camera behind, not inside the building);
    // `spawnYaw` overrides the default "face the town centre" (home: face away from the low sun)
    spawn: { position: [doorX, 0, -f * SPAWN], yaw: b.spawnYaw ?? (b.x < 0 ? -PI / 2 : PI / 2) }
  };
}

/** Town-world position of each interior's local origin (the engine places the interior there, or the town around it). */
// Align each local entrance with its actual facade in town. Rotation maps the
// interior's door-facing direction onto the street-facing direction of the building.
export const INTERIOR_ANCHORS = (() => {
  const entrances = {
    home: { x: HOUSE.door.x, z: HOUSE.d / 2, yaw: 0 },
    bank: { x: 0, z: 6, yaw: PI },
    mosque: { x: 0, z: 9, yaw: 0 },
    work: { x: 0, z: 6.1, yaw: 0 },
    school: { x: 10, z: 0, yaw: -PI / 2 },
    public_events: { x: 0, z: 8, yaw: PI }
  };
  return Object.fromEntries(Object.entries(entrances).map(([location, entrance]) => {
    const building = BUILDINGS.find((b) => b.loc === location);
    const facade = layoutOf(building);
    const c = Math.cos(entrance.yaw), s = Math.sin(entrance.yaw);
    return [location, {
      x: facade.doorX - (entrance.x * c + entrance.z * s),
      z: facade.zFace - (-entrance.x * s + entrance.z * c),
      yaw: entrance.yaw
    }];
  }));
})();

const FEATURE_SPOTS = [
  { feature: 'guide', pos: [-4.9, 0, 4.9], label: { ar: 'مكتب الإرشاد — اسأل المرشد', en: 'Guide desk — ask the guide' } },
  { feature: 'experts', pos: [4.9, 0, -4.9], label: { ar: 'اسأل أهل العلم', en: 'Ask a scholar' } },
  { feature: 'prayer', pos: [7.6, 0, -6.9], label: { ar: 'مواقيت الصلاة', en: 'Prayer times' } },
  { feature: 'adhkar', pos: [-4.9, 0, -4.9], label: { ar: 'أذكار الصباح والمساء', en: 'Morning & evening adhkar' } }
];

export const TOWN_DOORS = BUILDINGS.map((b) => ({ location: b.loc, label: b.label, ...layoutOf(b) }));

const GREENS = ['#3f7a2c', '#4c8a33', '#5b963a', '#3a6b28', '#69993c', '#46812f'];
const AUTUMN = ['#d88a2f', '#c86c2c', '#e2a43e', '#ba5a2b', '#d4973a'];
const WARM = ['#ffd38f', '#ffc977', '#ffe0a8', '#ffbf6a'];
const FLOWERS = ['#e8607a', '#f6f1e6', '#f3c24f', '#d8485c', '#b27fc9', '#f6a1b3', '#ffffff', '#f08a3c'];

export default {
  id: 'town',
  title: { ar: 'حيّ السلام', en: 'Al-Salam neighbourhood' },
  featureSpots: FEATURE_SPOTS,

  build(ctx) {
    const { THREE, makeLabel } = ctx;
    const group = ctx.group;
    const low = ctx.quality === 'low';
    const golden = LIGHTING === 'golden';
    const backdropFor = typeof ctx.backdropFor === 'string' ? ctx.backdropFor : null;   // backdrop mode (see header)
    const place = typeof ctx.place === 'function' ? ctx.place : () => null;             // headless tests have no asset loader
    const makeBatch = createBatcher(THREE);
    const R = rng(20261006);
    const owned = [];
    const own = (x) => { owned.push(x); return x; };
    const M = {
      vc: own(wallMaterial(THREE, { roughness: 0.82 })),          // + plaster weathering, grime band, ground AO (TSL)
      flat: own(groundMaterial(THREE, { roughness: 0.95 })),      // + lawn patches, asphalt grain, paving joints (TSL)
      glass: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.35 })),
      // warm windows / door lintels (slightly HDR so bloom lifts them a little)
      glow: own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(1.2, 1.12, 1.0) })),
      // lanterns and bulbs: clearly HDR so the bloom catches them
      lamp: own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2.6, 2.1, 1.6) })),
      // tree canopies: dithered fade within ~4 m of the camera so leaves never block the follow camera
      // (TSL node material; plain MeshStandardMaterial without the fade when ctx.THREE has no node materials, e.g. headless tests)
      leaf: own(new (THREE.MeshStandardNodeMaterial ?? THREE.MeshStandardMaterial)({ vertexColors: true, roughness: 0.86 }))
    };
    if (M.leaf.isNodeMaterial) {
      // camFade: 0 at <=1.5 m from the camera, 1 at >=4 m; screen-space hash dither keeps the fragment when hash <= camFade
      // (hash < 1, so camFade = 1 never discards). Shadows stay solid (the old depth material had no fade either).
      const camFade = positionView.length().sub(1.5).div(2.5).clamp(0, 1);
      const dither = fract(sin(dot(floor(screenCoordinate.xy), vec2(12.9898, 78.233))).mul(43758.5453));
      M.leaf.maskNode = dither.lessThanEqual(camFade);
      M.leaf.maskShadowNode = bool(true);
      // per-tree colour jitter, leaf-clump dapples and a warm sun-side glow (golden hour)
      applyLeafSurface(M.leaf, { sunDir: golden ? GOLDEN.sunDir : [0.55, 1, 0.35], glow: golden ? 0.4 : 0.12 });
    }
    const B = { vc: makeBatch('town-solid'), flat: makeBatch('town-ground'), glass: makeBatch('town-glass'), glow: makeBatch('town-glow'), lamp: makeBatch('town-lamp'), leaf: makeBatch('town-leaf') };
    const colliders = [];
    const col = (x0, z0, x1, z1, y1 = 3) => colliders.push({ min: [Math.min(x0, x1), 0, Math.min(z0, z1)], max: [Math.max(x0, x1), y1, Math.max(z0, z1)] });
    const proxyGeo = own(new THREE.BoxGeometry(1, 1, 1));
    const proxyMat = own(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const occluders = [];
    const occ = (cx, cy, cz, w, h, d) => { const m = new THREE.Mesh(proxyGeo, proxyMat); m.position.set(cx, cy, cz); m.scale.set(w, h, d); m.updateMatrixWorld(true); occluders.push(m); };
    const label = (text, pos, opts = {}) => { if (backdropFor) return null; const s = makeLabel(text, { size: 0.3, ...opts }); s.position.set(...pos); group.add(s); return s; };
    // geometry sent here is never built: in backdrop mode the shell of the interior's own building goes to these
    // batches so the random sequence (window lights, tints, shrubs) stays identical to normal mode
    const discard = { vc: makeBatch('discard'), glass: makeBatch('discard'), glow: makeBatch('discard'), lamp: makeBatch('discard') };
    const prism = (w, h, depth) => {
      const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
    };
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    /** colour with a small random shift in hue / saturation / lightness (painterly variation) */
    const tint = (hex, amt = 1) => {
      const c = new THREE.Color(hex), hsl = {};
      c.getHSL(hsl);
      return c.setHSL(hsl.h + (R() - 0.5) * 0.03 * amt, Math.min(1, hsl.s * (0.88 + R() * 0.24 * amt)), Math.min(1, hsl.l * (0.86 + R() * 0.28 * amt)));
    };

    // ------------------------------------------------------------ ground: grass, roads, sidewalks, forecourts
    const G = B.flat;
    // lawn: one subdivided plane with soft two-tone patches (vertex colours; sunlit yellow-green vs. deeper green)
    {
      const cA = new THREE.Color('#4b7e33'), cB = new THREE.Color('#78a043'), cDry = new THREE.Color('#9b9f50'), c = new THREE.Color();
      const lawnRect = (x0, z0, x1, z1) => {
        const w = x1 - x0, d = z1 - z0;
        if (w <= 0 || d <= 0) return;
        const lawn = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / 1.6)), Math.max(1, Math.round(d / 1.6)));
        const pa = lawn.attributes.position, cols = [];
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i) + (x0 + x1) / 2, z = -pa.getY(i) + (z0 + z1) / 2;   // world coords -> same patches whatever the split
          const n = 0.5 + 0.32 * Math.sin(x * 0.23 + 1.3) * Math.sin(z * 0.29 + 0.4) + 0.18 * Math.sin(x * 0.61 - z * 0.47 + 2.0);
          c.copy(cA).lerp(cB, Math.min(1, Math.max(0, n)));
          if (Math.sin(x * 0.13 + z * 0.21) > 0.75) c.lerp(cDry, 0.35);
          cols.push(c.r, c.g, c.b);
        }
        lawn.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        G.geo(lawn, '#ffffff', (x0 + x1) / 2, 0, (z0 + z1) / 2, 0, -PI / 2);
      };
      const X = HALF_X + 1, Z = HALF_Z + 1;
      const hidden = backdropFor && BUILDINGS.find((b) => b.loc === backdropFor);
      if (hidden) {
        // leave the interior's footprint bare (its floor is at y = 0 there): four patches around it
        const L = layoutOf(hidden), hx0 = hidden.x - hidden.w / 2, hx1 = hidden.x + hidden.w / 2;
        const hz0 = Math.min(L.zFace, L.zFace - L.f * hidden.d), hz1 = Math.max(L.zFace, L.zFace - L.f * hidden.d);
        lawnRect(-X, -Z, hx0, Z); lawnRect(hx1, -Z, X, Z); lawnRect(hx0, -Z, hx1, hz0); lawnRect(hx0, hz1, hx1, Z);
      } else lawnRect(-X, -Z, X, Z);
    }
    G.fbox('#4c4844', HALF_X * 2, 0.02, 7, 0, 0, 0);                                     // avenue (E-W), warm asphalt
    G.fbox('#4c4844', 7, 0.021, HALF_Z * 2, 0, 0, 0);                                    // cross street (N-S)
    // sidewalks + forecourts stop at the crossing roads (so the crosswalks stay visible)
    const runX = (HALF_X - 3.5), cX = (HALF_X + 3.5) / 2, runZ = (HALF_Z - 3.5), cZ = (HALF_Z + 3.5) / 2;
    for (const s of [-1, 1]) {
      for (const t of [-1, 1]) {
        G.fbox('#c8b699', runX, 0.05, 2.5, t * cX, 0, s * 4.75);                         // sidewalks along the avenue
        G.fbox('#c8b699', 2.5, 0.051, runZ, s * 4.75, 0, t * cZ);                        // sidewalks along the cross street
        G.fbox('#a39276', runX, 0.052, 0.14, t * cX, 0, s * 3.55);                       // kerb line
        G.fbox('#d3bf9c', runX, 0.03, 2, t * cX, 0, s * 7);                              // forecourt paving in front of the facades
      }
      for (let i = -2; i <= 2; i++) {                                                     // crosswalks
        G.fbox('#f4f1ea', 0.5, 0.026, 2.4, i * 1.1, 0, s * 4.75);
        G.fbox('#f4f1ea', 2.4, 0.026, 0.5, s * 4.75, 0, i * 1.1);
      }
    }
    for (let x = -HALF_X + 2; x < HALF_X - 1; x += 4) if (Math.abs(x) > 6.5) G.fbox('#efe6cf', 2, 0.025, 0.14, x, 0, 0);   // lane dashes
    for (let z = -HALF_Z + 2; z < HALF_Z - 1; z += 4) if (Math.abs(z) > 6.5) G.fbox('#efe6cf', 0.14, 0.025, 2, 0, 0, z);

    // central roundabout with a fountain (the landmark Adam sees first), ringed with flowers
    G.fcyl('#6a9a48', 3.2, 3.2, 0.06, 0, 0, 0, 28);
    B.vc.fcyl('#ddd3c0', 1.9, 2.0, 0.55, 0, 0, 0, 24);
    B.vc.fcyl('#5a9cbc', 1.7, 1.7, 0.02, 0, 0.5, 0, 24);
    B.vc.fcyl('#ddd3c0', 0.25, 0.32, 1.4, 0, 0, 0, 10);
    B.vc.fcyl('#ddd3c0', 0.8, 0.6, 0.15, 0, 1.4, 0, 16);
    B.glow.fcyl('#bfe6ff', 0.07, 0.12, 0.7, 0, 1.55, 0, 8);
    for (let i = 0; i < (low ? 18 : 30); i++) {
      const a = (i / (low ? 18 : 30)) * PI * 2, r = 2.45 + (i % 2) * 0.35;
      B.vc.ico(i % 3 === 0 ? tint('#4f8a3a') : tint(pick(FLOWERS)), i % 3 === 0 ? 0.22 : 0.13, Math.cos(a) * r, 0.18, Math.sin(a) * r);
    }
    col(-1.7, -1.7, 1.7, 1.7, 1);
    label({ ar: 'حيّ السلام', en: 'Al-Salam neighbourhood' }, [0, 3.0, 0], { size: 0.42, background: 'rgba(14,38,40,0.75)' });

    // edge hedges (soft boundary of the map): a box base with bushy tops
    for (const s of [-1, 1]) {
      B.vc.fbox('#3f6a35', HALF_X * 2, 0.75, 0.8, 0, 0, s * HALF_Z);
      B.vc.fbox('#3f6a35', 0.8, 0.75, HALF_Z * 2, s * HALF_X, 0, 0);
      col(-HALF_X, s * HALF_Z - 0.4, HALF_X, s * HALF_Z + 0.4, 1);
      col(s * HALF_X - 0.4, -HALF_Z, s * HALF_X + 0.4, HALF_Z, 1);
      const step = low ? 2.2 : 1.5;
      for (let x = -HALF_X + 0.6; x <= HALF_X - 0.6; x += step) B.vc.ico(tint('#4a7a3a'), 0.55, x, 0.78, s * HALF_Z, 1, 0.8, 1, R() * PI);
      for (let z = -HALF_Z + 0.6; z <= HALF_Z - 0.6; z += step) B.vc.ico(tint('#4a7a3a'), 0.55, s * HALF_X, 0.78, z, 1, 0.8, 1, R() * PI);
    }

    // ------------------------------------------------------------ buildings
    /** one window on any wall: (cx,cy,cz) centre on the wall plane, (nx,nz) outward normal. Batches S (shell or discard). */
    const facadeWin = (S, cx, cy, cz, ww, wh, nx, nz, { color = '#33495c', frame = '#f4efe6', glassBatch = false, lit = 0.85, muntin = true } = {}) => {
      const ry = Math.atan2(nx, nz);
      const at = (d) => [cx + nx * d, cz + nz * d];
      let p = at(0.03); S.vc.box(frame, ww + 0.16, wh + 0.16, 0.06, p[0], cy, p[1], ry);
      p = at(0.08); S.vc.box(frame, ww + 0.3, 0.08, 0.16, p[0], cy - wh / 2 - 0.1, p[1], ry);            // sill
      p = at(0.06);
      if (R() < lit) {
        S.glow.box(pick(WARM), ww, wh, 0.06, p[0], cy, p[1], ry);                                       // warm lit pane
        if (muntin) { const q = at(0.1); S.vc.box(frame, 0.05, wh, 0.03, q[0], cy, q[1], ry); S.vc.box(frame, ww, 0.05, 0.03, q[0], cy, q[1], ry); }
      } else (glassBatch ? S.glass : S.vc).box(color, ww, wh, 0.06, p[0], cy, p[1], ry);
    };
    const windows = (b, L, { rows, y0, rowH, cols, ww = 0.9, wh = 1.1, ...opts }) => {
      const span = b.w - 1.6;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = b.x - span / 2 + (cols === 1 ? span / 2 : (span / (cols - 1)) * c);
        if (r === 0 && Math.abs(x - L.doorX) < 1.3) continue; // keep the door clear
        facadeWin(B, x, y0 + r * rowH, L.zFace, ww, wh, 0, L.f, opts);
      }
    };
    const door = (b, L, { w = 1.5, h = 2.4, color = '#4a3424', frame = '#efe6d4', S = B, steps = B } = {}) => {
      S.vc.box(frame, w + 0.3, h + 0.2, 0.1, L.doorX, (h + 0.2) / 2, L.zFace + L.f * 0.04);
      S.vc.box(color, w, h, 0.1, L.doorX, h / 2, L.zFace + L.f * 0.08);
      S.glow.box('#ffe2a0', w, 0.08, 0.04, L.doorX, h + 0.25, L.zFace + L.f * 0.12);   // warm lintel light = "you can go in"
      steps.vc.fbox('#cfc6b4', w + 1, 0.12, 0.9, L.doorX, 0, L.zFace + L.f * 0.45);      // step
    };
    /** flower bed against a facade (x0..x1 along the wall, depth 0.6 out from it): stone edge, shrubs, flowers */
    const facadeBed = (L, x0, x1, depth = 0.62) => {
      const z0 = L.zFace + L.f * 0.04, z1 = L.zFace + L.f * (0.04 + depth);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.abs(x1 - x0);
      B.vc.fbox('#9b8a72', w + 0.1, 0.16, depth + 0.08, cx, 0, cz);
      G.fbox('#4a3627', w - 0.06, 0.02, depth - 0.06, cx, 0.16, cz);
      for (let x = Math.min(x0, x1) + 0.3; x < Math.max(x0, x1) - 0.15; x += 0.55) {
        B.vc.ico(tint('#3f6f34'), 0.3 + R() * 0.08, x, 0.42, L.zFace + L.f * 0.45, 1, 0.85, 1, R() * PI);   // (fully outside the facade plane)
        for (let k = 0; k < (low ? 1 : 3); k++) B.vc.ico(tint(pick(FLOWERS)), 0.08 + R() * 0.04, x + (R() - 0.5) * 0.5, 0.3 + R() * 0.12, L.zFace + L.f * (0.42 + R() * 0.18));
      }
      col(x0, z0, x1, z1, 0.6);
    };
    const shrub = (x, z, r = 0.45, collide = true) => {
      B.vc.ico(tint('#41733a'), r, x, r * 0.8, z, 1, 0.9, 1, R() * PI);
      B.vc.ico(tint('#4f8240'), r * 0.7, x + r * 0.4, r * 1.1, z - r * 0.2, 1, 0.9, 1, R() * PI);
      if (!low) for (let k = 0; k < 3; k++) B.vc.ico(tint(pick(FLOWERS)), 0.08, x + (R() - 0.5) * r * 1.6, r * (0.9 + R() * 0.5), z + (R() - 0.5) * r * 1.6);
      if (collide) col(x - r * 0.8, z - r * 0.8, x + r * 0.8, z + r * 0.8, 0.8);
    };

    for (const b of BUILDINGS) {
      const L = layoutOf(b);
      const hidden = backdropFor === b.loc;       // backdrop mode: this building's shell is the interior scene itself
      const S = hidden ? discard : B;             // shell geometry (walls, roof, windows, door) -> drawn or discarded
      const V = S.vc;
      const zb0 = L.zFace, zb1 = L.zFace - L.f * b.d;
      // houses: the ground floor is the shell (the interior replaces it in backdrop mode), the upper storey + roof
      // are always drawn so the house is complete from every angle; other buildings are one block
      const SPLIT = 3.0;
      const UP = hidden && !BACKDROP_UPPER_STOREY ? discard : B;   // upper storey of the hidden house (see BACKDROP_UPPER_STOREY)
      if (b.kind === 'house') { V.fbox(b.color, b.w, SPLIT, b.d, b.x, 0, L.zc); UP.vc.fbox(b.color, b.w, b.h - SPLIT, b.d, b.x, SPLIT, L.zc); }
      else V.fbox(b.color, b.w, b.h, b.d, b.x, 0, L.zc);
      V.fbox('#8f8a80', b.w + 0.1, 0.35, b.d + 0.1, b.x, 0, L.zc);                    // plinth
      col(b.x - b.w / 2, zb0, b.x + b.w / 2, zb1, b.h);                                 // (kept in backdrop mode: keeps trees out)
      if (!hidden) occ(b.x, b.h / 2, L.zc, b.w, b.h, b.d);

      if (b.kind === 'house') {
        const isHome = b.loc === 'home';
        const T = HOUSE.colors.trim;
        // white clapboard: thin shadow lines on the front and both sides
        const line = new THREE.Color(b.color).multiplyScalar(0.86);
        const U = UP.vc;                                                                       // upper storey (always drawn unless BACKDROP_UPPER_STOREY is off)
        for (let y = 0.6; y < b.h - 0.1; y += 0.3) {
          const W2 = y > SPLIT ? U : V;
          W2.box(line, b.w + 0.02, 0.035, 0.02, b.x, y, L.zFace + L.f * 0.005);
          for (const sx of [-1, 1]) W2.box(line, 0.02, 0.035, b.d + 0.02, b.x + sx * (b.w / 2 + 0.005), y, L.zc);
        }
        for (const sx of [-1, 1]) {                                                            // corner boards (two parts)
          V.box('#faf7f0', 0.18, SPLIT - 0.35, 0.18, b.x + sx * (b.w / 2 - 0.05), 0.35 + (SPLIT - 0.35) / 2, L.zFace + L.f * 0.02);
          U.box('#faf7f0', 0.18, b.h - SPLIT, 0.18, b.x + sx * (b.w / 2 - 0.05), SPLIT + (b.h - SPLIT) / 2, L.zFace + L.f * 0.02);
        }
        U.box(T, b.w + 0.1, 0.12, 0.06, b.x, SPLIT - 0.05, L.zFace + L.f * 0.03);              // storey band (floor line of the upper floor)
        U.geo(prism(b.w + 0.8, 2.3, b.d + 0.8), b.roof, b.x, b.h, L.zc);
        U.box('#f4efe6', b.w + 0.85, 0.18, b.d + 0.85, b.x, b.h + 0.05, L.zc);                // eave trim
        U.fbox('#9b4b36', 0.7, 2.0, 0.7, b.x + b.w / 4, b.h + 0.6, L.zc);                     // brick chimney
        U.fbox('#7d3d2c', 0.82, 0.14, 0.82, b.x + b.w / 4, b.h + 2.6, L.zc);
        // porch around the door: deck, white columns, railings with balusters, a sloped roof and two lit sconces.
        // Local x range from the layout (home: 1..6, east of centre, around the door at 4.5); the neighbours' house is symmetric.
        const P = isHome ? HOUSE.porch : { x0: -3.5, x1: 3.5, depth: 1.9, deckH: 0.16, roofY: 2.75 };
        const px0 = b.x + P.x0, px1 = b.x + P.x1, pw = px1 - px0, pcx = (px0 + px1) / 2;
        const pz = L.zFace + L.f * (P.depth - 0.25);
        B.vc.fbox(HOUSE.colors.porch, pw, P.deckH, P.depth, pcx, 0, L.zFace + L.f * P.depth / 2);
        for (let x = px0 + 0.3; x < px1; x += 0.3) B.vc.box('#c9b797', 0.02, 0.01, P.depth - 0.1, x, P.deckH, L.zFace + L.f * P.depth / 2);   // deck boards
        // porch roof (the interior is a closed room with its own ceiling, so the camera never orbits out here)
        UP.vc.fbox('#f4efe6', pw + 0.2, 0.14, P.depth + 0.2, pcx, P.roofY, L.zFace + L.f * (P.depth + 0.1) / 2);
        UP.vc.box(b.roof, pw + 0.5, 0.08, P.depth + 0.45, pcx, P.roofY + 0.32, L.zFace + L.f * (P.depth + 0.14) / 2, 0, L.f * 0.2);
        const colX = [px0 + 0.15, px1 - 0.15];
        for (const side of [[px0 + 0.15, L.doorX - 0.75], [L.doorX + 0.75, px1 - 0.15]]) {       // rails left / right of the opening
          const [a, c] = side;
          if (c - a < 0.4) continue;
          if (c - a > 2.2) colX.push(side[0] === px0 + 0.15 ? c : a);                               // column flanking the steps
          B.vc.box(T, c - a, 0.06, 0.08, (a + c) / 2, 0.95, pz);
          B.vc.box(T, c - a, 0.05, 0.06, (a + c) / 2, 0.3, pz);
          for (let x = a + 0.15; x < c - 0.1; x += 0.25) B.vc.box(T, 0.04, 0.62, 0.04, x, 0.62, pz);
          col(a, pz - 0.1, c, pz + 0.1, 1);
        }
        for (const x of colX) B.vc.fcyl('#f8f4ec', 0.1, 0.12, P.roofY, x, P.deckH, pz, 10);
        for (const sx of [-1, 1]) UP.lamp.box('#ffd28a', 0.12, 0.2, 0.08, L.doorX + sx * 0.85, 2.15, L.zFace + L.f * 0.12);   // sconces (on the interior's wall too)
        // steps down from the deck in front of the door
        for (let k = 0; k < 2; k++) B.vc.fbox('#cfc6b4', 2.0, P.deckH / 2 * (2 - k), 0.32, L.doorX, 0, L.zFace + L.f * (P.depth + 0.16 + k * 0.32));
        if (isHome) {
          // ground floor exactly as the interior has it (home/layout.js): windows on all four walls, the blue door
          for (const w of HOUSE.front) facadeWin(S, b.x + w.x, (w.y0 + w.y1) / 2, L.zFace, w.w, w.y1 - w.y0, 0, L.f, { frame: T, lit: 1 });
          for (const w of HOUSE.back) facadeWin(S, b.x + w.x, (w.y0 + w.y1) / 2, zb1, w.w, w.y1 - w.y0, 0, -L.f, { frame: T, lit: 0.6 });
          for (const w of HOUSE.west) facadeWin(S, b.x - b.w / 2, (w.y0 + w.y1) / 2, L.zc + L.f * w.z, w.w, w.y1 - w.y0, -1, 0, { frame: T, lit: 0.6 });
          for (const w of HOUSE.east) facadeWin(S, b.x + b.w / 2, (w.y0 + w.y1) / 2, L.zc + L.f * w.z, w.w, w.y1 - w.y0, 1, 0, { frame: T, lit: 0.6 });
          for (const x of [-3.8, -0.4, 3.0]) facadeWin(UP, b.x + x, HOUSE.h + 1.55, L.zFace, 1.0, 1.15, 0, L.f, { frame: T, lit: 1 });   // upper floor
          door(b, L, { w: HOUSE.door.w, h: HOUSE.door.h, color: HOUSE.colors.door, frame: T, S, steps: discard });
          // garden west of the porch: flower bed along the facade, a hedge at the sidewalk, a mailbox by the path
          facadeBed(L, b.x - b.w / 2 + 0.3, px0 - 0.4, 0.6);
          for (let x = b.x - b.w / 2 + 0.5; x < px0 - 0.6; x += 1.2) shrub(x, L.zFace + L.f * 1.75, 0.32);   // low hedge at the forecourt's edge
          shrub(px1 + 0.5, L.zFace + L.f * 0.6, 0.38);
          place('mailbox', { position: [L.doorX + 1.35, 0, L.zFace + L.f * 2.55], yaw: PI, collider: true });
        } else {
          windows(b, L, { rows: 2, y0: 1.5, rowH: 2.3, cols: 3, frame: T });
          door(b, L, { color: '#6b3d2a', frame: T });
          for (const sx of [-1, 1]) shrub(b.x + sx * 4.05, L.zFace + L.f * 0.55, 0.42);
        }
        if (b.lights) for (let i = 0; i < 9; i++) B.lamp.sph(i % 2 ? '#ffd27a' : '#fff1c9', 0.08, b.x - 3.6 + i * 0.9, 3.45 - Math.sin((i / 8) * PI) * 0.3, L.zFace + L.f * 2.2);
      } else if (b.kind === 'school') {
        // red brick with white trim: cornice, floor band, corner quoins, portico
        V.fbox('#f1ebe0', b.w + 0.3, 0.4, b.d + 0.3, b.x, b.h - 0.4, L.zc);            // cornice
        V.fbox('#f1ebe0', b.w + 0.12, 0.22, b.d + 0.12, b.x, 3.2, L.zc);               // floor band
        for (const sx of [-1, 1]) for (let y = 0.5; y < b.h - 0.6; y += 0.7) V.box('#efe6d8', 0.5, 0.32, 0.5, b.x + sx * (b.w / 2 - 0.2), y, L.zFace + L.f * 0.02 - L.f * 0.2);
        V.fbox('#f1ebe0', 3.6, 3.4, 1.4, b.x, 0, L.zFace + L.f * 0.7);                 // entrance portico
        V.geo(prism(4.2, 1.1, 1.6), '#f1ebe0', b.x, 3.4, L.zFace + L.f * 0.7);
        V.cyl('#fbfaf6', 0.55, 0.55, 0.08, b.x, b.h - 1.4, L.zFace + L.f * 0.05, 20, 0, PI / 2);  // clock
        V.cyl('#2d2d2d', 0.04, 0.04, 0.45, b.x, b.h - 1.3, L.zFace + L.f * 0.1, 6);
        windows(b, L, { rows: 2, y0: 1.7, rowH: 2.9, cols: 4, frame: '#f6f1e7' });
        door(b, L, { color: '#30424f' });
        facadeBed(L, b.x - b.w / 2 + 0.2, b.x - 2.0);
        facadeBed(L, b.x + 2.0, b.x + b.w / 2 - 0.2);
      } else if (b.kind === 'mosque') {
        V.fbox('#e4d8bf', b.w + 0.2, 0.5, b.d + 0.2, b.x, b.h - 0.5, L.zc);             // crown band
        for (let i = 0; i < 11; i++) V.fbox('#e4d8bf', 0.45, 0.45, 0.45, b.x - b.w / 2 + 0.5 + i * 1.0, b.h, L.zFace - L.f * 0.2); // crenellation
        V.fcyl('#f2ebda', 2.6, 2.6, 0.9, b.x, b.h, L.zc, 28);                           // drum
        for (let k = 0; k < 14; k++) {                                                   // lit drum windows
          const a = (k / 14) * PI * 2;
          B.glow.box(pick(WARM), 0.26, 0.48, 0.06, b.x + Math.cos(a) * 2.6, b.h + 0.45, L.zc + Math.sin(a) * 2.6, Math.atan2(Math.cos(a), Math.sin(a)));
        }
        // green, slightly pointed dome
        const pts = [];
        for (let i = 0; i <= 14; i++) { const a = (i / 14) * PI / 2; pts.push(new THREE.Vector2(Math.max(0.001, 2.75 * Math.cos(a) * (1 + 0.1 * Math.sin(a * 2))), 3.2 * Math.pow(Math.sin(a), 0.85))); }
        V.geo(new THREE.LatheGeometry(pts, 28), '#3f8f6a', b.x, b.h + 0.9, L.zc);
        V.fcyl('#c9a227', 0.05, 0.08, 0.8, b.x, b.h + 4.05, L.zc, 6);
        V.sph('#c9a227', 0.16, b.x, b.h + 4.9, L.zc);
        V.torus('#d8b54a', 0.22, 0.04, b.x, b.h + 5.25, L.zc, 0, 0, -0.6, PI * 1.25);
        // tall, slender minaret at the front corner (base + collider unchanged) with balconies and a green cap
        const mx = b.x + b.w / 2 + 1.1, mz = L.zFace - L.f * 1.2;
        V.fbox('#efe7d4', 1.8, 3, 1.8, mx, 0, mz);
        V.fbox('#e2d6bc', 2.0, 0.2, 2.0, mx, 3, mz);
        V.fcyl('#f5f0e5', 0.46, 0.56, 8.2, mx, 3.2, mz, 14);
        V.fcyl('#e2d6bc', 0.84, 0.6, 0.32, mx, 11.4, mz, 14);
        V.fcyl('#efe7d4', 0.86, 0.86, 0.12, mx, 11.72, mz, 14);
        V.torus('#efe7d4', 0.82, 0.035, mx, 12.3, mz, 0, PI / 2);
        V.fcyl('#f5f0e5', 0.38, 0.42, 2.6, mx, 11.84, mz, 14);
        V.fcyl('#e2d6bc', 0.56, 0.42, 0.2, mx, 14.44, mz, 14);
        V.fcyl('#f5f0e5', 0.3, 0.32, 0.9, mx, 14.64, mz, 12);
        V.geo(new THREE.ConeGeometry(0.44, 2.0, 14), '#3f8f6a', mx, 15.54 + 1.0, mz);
        V.fcyl('#c9a227', 0.03, 0.03, 0.5, mx, 17.5, mz, 6);
        V.sph('#c9a227', 0.12, mx, 18.05, mz);
        for (let k = 0; k < 4; k++) B.glow.box('#ffd08a', 0.12, 0.62, 0.05, mx, 4.6 + k * 1.75, mz + L.f * 0.53);
        for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; B.lamp.ico('#ffe1a0', 0.06, mx + Math.cos(a) * 0.82, 12.38, mz + Math.sin(a) * 0.82); }
        col(mx - 0.9, mz - 0.9, mx + 0.9, mz + 0.9, 12);
        occ(mx, 6, mz, 1.8, 12, 1.8);
        // arched entrance
        V.box('#d8c9a8', 3, 3.6, 0.3, b.x, 1.8, L.zFace + L.f * 0.15);
        V.cyl('#d8c9a8', 1.5, 1.5, 0.3, b.x, 3.6, L.zFace + L.f * 0.15, 20, 0, PI / 2);
        V.box('#2a5a50', 1.9, 2.8, 0.1, b.x, 1.4, L.zFace + L.f * 0.32);
        V.cyl('#2a5a50', 0.95, 0.95, 0.1, b.x, 2.8, L.zFace + L.f * 0.32, 16, 0, PI / 2);
        B.glow.box('#ffe2a0', 1.9, 0.06, 0.04, b.x, 3.85, L.zFace + L.f * 0.34);
        V.fbox('#cfc6b4', 3.4, 0.12, 0.9, b.x, 0, L.zFace + L.f * 0.45);
        for (const sx of [-1, 1]) for (const k of [2.6, 4.2]) {                                  // arched windows, lit warm
          const wc = pick(WARM);
          B.glow.box(wc, 0.9, 1.6, 0.06, b.x + sx * k, 2.2, L.zFace + L.f * 0.04);
          B.glow.cyl(wc, 0.45, 0.45, 0.06, b.x + sx * k, 3.0, L.zFace + L.f * 0.04, 12, 0, PI / 2);
          V.box('#e2d6bc', 1.1, 0.1, 0.16, b.x + sx * k, 1.36, L.zFace + L.f * 0.08);
        }
        // prayer-times board next to the door (opens the prayer panel when that feature exists)
        V.fbox('#2a5a50', 1.2, 1.6, 0.12, b.x - 4.4, 0.4, L.zFace + L.f * 0.6);
        V.fcyl('#555', 0.04, 0.04, 0.4, b.x - 4.4, 0, L.zFace + L.f * 0.6, 6);
        facadeBed(L, b.x + 1.9, b.x + b.w / 2 - 0.25);
      } else if (b.kind === 'office') {
        B.glass.fbox('#6f93ad', b.w - 0.1, b.h - 0.4, b.d - 0.1, b.x, 0.35, L.zc);
        for (let y = 3; y < b.h; y += 3) V.fbox('#d9dde0', b.w + 0.08, 0.22, b.d + 0.08, b.x, y, L.zc);   // floor bands
        for (let i = -1; i <= 1; i++) V.fbox('#d9dde0', 0.12, b.h, 0.08, b.x + i * (b.w / 3), 0, L.zFace + L.f * 0.04);
        for (let y = 4.5; y < b.h - 1; y += 3) for (let j = 0; j < 4; j++) if (R() < 0.55) B.glow.box(pick(WARM), 1.6, 1.5, 0.03, b.x + (j - 1.5) * 2, y, L.zFace + L.f * 0.025);
        V.fbox('#d9dde0', b.w + 0.3, 0.6, b.d + 0.3, b.x, b.h, L.zc);
        V.fbox('#2e3b46', 3.4, 0.25, 1.8, b.x, 3, L.zFace + L.f * 0.9);                 // entrance canopy
        door(b, L, { color: '#1f2a33', frame: '#cfd6dc' });
        facadeBed(L, b.x - b.w / 2 + 0.2, b.x - 1.9, 0.5);
        facadeBed(L, b.x + 1.9, b.x + b.w / 2 - 0.2, 0.5);
      } else if (b.kind === 'market') {
        const aw = ['#c0392b', '#2f8f74', '#d4a017'];
        for (let i = 0; i < 3; i++) {
          const x = b.x - 3 + i * 3;
          V.box(aw[i], 2.8, 0.08, 1.5, x, 2.9, L.zFace + L.f * 0.7, 0, L.f * 0.32);
          if (i !== 1) { B.glow.box(pick(WARM), 2.2, 1.6, 0.06, x, 1.5, L.zFace + L.f * 0.04); }
        }
        door(b, L, { color: '#5a3b26' });
        for (const sx of [-1, 1]) {                                                            // fruit stalls
          const x = b.x + sx * 3.4, z = L.zFace + L.f * 0.9;
          V.fbox('#8a6a45', 1.6, 0.8, 0.8, x, 0, z);
          ['#e74c3c', '#f39c12', '#7cb342'].forEach((c, k) => V.fbox(c, 0.45, 0.14, 0.6, x - 0.5 + k * 0.5, 0.8, z));
          col(x - 0.8, z - 0.4, x + 0.8, z + 0.4, 1);
        }
        V.fbox(b.color, b.w, 0.9, 0.2, b.x, b.h, L.zFace);                                     // sign band
        for (let i = 0; i < 7; i++) B.lamp.sph(i % 2 ? '#ffd27a' : '#fff1c9', 0.07, b.x - 3.9 + i * 1.3, 3.55, L.zFace + L.f * 0.15);
      } else if (b.kind === 'bank') {
        V.geo(prism(b.w + 0.4, 1.4, 1.2), '#efe6cf', b.x, b.h, L.zFace + L.f * 0.3);         // pediment
        V.fbox('#efe6cf', b.w + 0.4, 0.4, 1.4, b.x, b.h - 0.4, L.zFace + L.f * 0.3);
        V.fbox('#e2d5b8', b.w + 0.1, 0.18, b.d + 0.1, b.x, 3.3, L.zc);                        // stone string course
        for (let i = 0; i < 4; i++) {
          const x = b.x - 3.3 + i * 2.2;
          V.fcyl('#f4eedc', 0.28, 0.32, b.h - 0.75, x, 0.35, L.zFace + L.f * 0.75, 12);
        }
        for (let k = 0; k < 3; k++) V.fbox('#d8cfba', b.w + 0.4 - k * 0.6, 0.12, 1.5 - k * 0.35, b.x, k * 0.12, L.zFace + L.f * (0.75 - k * 0.15));
        windows(b, L, { rows: 2, y0: 1.6, rowH: 2.6, cols: 3, color: '#2c3e50', lit: 0.9 });
        door(b, L, { color: '#2c3e50', frame: '#c9a227' });
        for (const sx of [-1, 1]) {                                                            // dark-green awnings + planters
          const x = b.x + sx * 3.7;
          V.box('#1f4a37', 1.25, 0.05, 0.6, x, 2.5, L.zFace + L.f * 0.32, 0, L.f * 0.45);
          V.box('#1f4a37', 1.25, 0.2, 0.03, x, 2.3, L.zFace + L.f * 0.6);
          const qx = b.x + sx * 4.15, qz = L.zFace + L.f * 0.78;
          V.fbox('#d8cfba', 0.6, 0.5, 0.6, qx, 0.36, qz);
          B.vc.ico(tint('#3f6f34'), 0.32, qx, 1.05, qz, 1, 0.9, 1, R() * PI);
          for (let k = 0; k < 4; k++) B.vc.ico(tint(pick(FLOWERS)), 0.08, qx + (R() - 0.5) * 0.45, 1.0 + R() * 0.25, qz + (R() - 0.5) * 0.45);
        }
        col(b.x - b.w / 2, L.zFace, b.x + b.w / 2, L.zFace + L.f * 1.1, b.h);
      } else if (b.kind === 'hall') {
        V.fbox('#9fb0bf', b.w + 0.2, 0.5, b.d + 0.2, b.x, b.h - 0.5, L.zc);
        V.fbox('#7d2e46', 6, 0.3, 2.2, b.x, 3.1, L.zFace + L.f * 1.1);                 // marquee canopy
        for (const sx of [-1, 1]) V.fcyl('#c9a227', 0.06, 0.06, 3.1, b.x + sx * 2.8, 0, L.zFace + L.f * 2.05, 6);
        for (let i = 0; i < 12; i++) B.lamp.sph('#ffe7a8', 0.08, b.x - 2.75 + i * 0.5, 3.0, L.zFace + L.f * 2.2);
        for (let i = 0; i < 4; i++) {
          const x = b.x - 4.2 + i * 2.8;
          if (Math.abs(x - b.x) < 1.5) continue;
          B.glow.cyl(pick(WARM), 0.6, 0.6, 0.06, x, 4.2, L.zFace + L.f * 0.04, 16, 0, PI / 2);
        }
        windows(b, L, { rows: 1, y0: 1.6, rowH: 0, cols: 4, ww: 1.4, wh: 1.4 });
        door(b, L, { w: 2.2, color: '#3b2a3a' });
        for (const sx of [-1, 1]) col(b.x + sx * 2.8 - 0.12, L.zFace + L.f * 1.93, b.x + sx * 2.8 + 0.12, L.zFace + L.f * 2.17);
        facadeBed(L, b.x - b.w / 2 + 0.2, b.x - 3.4);
        facadeBed(L, b.x + 3.4, b.x + b.w / 2 - 0.2);
      }
    }

    // ------------------------------------------------------------ street furniture (merged): lamps, benches, cars
    // kept out of the camera line behind each door spawn (north row: Adam's door is at x -18.5, camera to its east)
    const lampXs = { [-1]: [-28.5, -22.5, -8, 9, 21, 28.5], [1]: [-28.5, -19, -8, 9, 21, 28.5] };
    const lamps = [];
    for (const s of [-1, 1]) {
      for (const x of lampXs[s]) lamps.push([x, s * 3.9]);
      for (const z of [12.5, 19]) lamps.push([s * 3.9, z], [s * 3.9, -z]);
    }
    const IRON = '#1c1e21';
    lamps.forEach(([x, z]) => {                                                               // black post + glowing lantern
      B.vc.fcyl(IRON, 0.15, 0.19, 0.4, x, 0, z, 8);
      B.vc.fcyl(IRON, 0.05, 0.07, 3.3, x, 0.4, z, 8);
      B.vc.fcyl(IRON, 0.1, 0.07, 0.14, x, 3.66, z, 8);
      B.lamp.fcyl('#ffcf85', 0.15, 0.11, 0.44, x, 3.8, z, 6);
      B.vc.geo(new THREE.ConeGeometry(0.25, 0.26, 6), IRON, x, 4.37, z);
      B.vc.sph(IRON, 0.05, x, 4.55, z, 1, 1, 1, 6, 4);
      col(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
    });
    // benches on the cross-street sidewalks: warm wood slats on dark-green iron
    for (const [x, z] of [[-5.4, -13.5], [5.4, 13.5], [-5.4, 13.5], [5.4, -13.5]]) {
      const sx = Math.sign(x);
      for (let k = 0; k < 3; k++) B.vc.fbox('#a8703f', 0.14, 0.05, 1.6, x - 0.17 + k * 0.17, 0.42, z);
      for (let k = 0; k < 2; k++) B.vc.box('#a8703f', 0.05, 0.12, 1.6, x + sx * 0.26, 0.62 + k * 0.17, z);
      for (const k of [-0.65, 0.65]) { B.vc.fbox('#1f3b2d', 0.48, 0.42, 0.06, x, 0, z + k); B.vc.box('#1f3b2d', 0.05, 0.5, 0.06, x + sx * 0.28, 0.67, z + k); }
      col(x - 0.3, z - 0.8, x + 0.3, z + 0.8, 1);
    }
    // feature-spot furniture: guide kiosk, scholars' notice board, adhkar bench
    B.vc.fbox('#1f6b5c', 1.1, 1.2, 0.7, -4.9, 0, 5.6); B.vc.fbox('#e0ae52', 1.3, 0.12, 0.9, -4.9, 2.3, 5.6);
    B.vc.fcyl('#1f6b5c', 0.05, 0.05, 1.1, -5.4, 1.2, 5.6, 6); B.vc.fcyl('#1f6b5c', 0.05, 0.05, 1.1, -4.4, 1.2, 5.6, 6);
    B.glow.box('#bfe6ff', 0.8, 0.5, 0.04, -4.9, 0.85, 5.24);
    col(-5.5, 5.25, -4.3, 5.95, 1.3);
    B.vc.fbox('#5a4632', 1.4, 1.1, 0.1, 4.9, 0.9, -5.7); B.vc.fbox('#f3ead7', 1.2, 0.9, 0.04, 4.9, 1.0, -5.63);
    for (const k of [-0.6, 0.6]) B.vc.fcyl('#5a4632', 0.04, 0.04, 0.9, 4.9 + k, 0, -5.7, 6);
    col(4.1, -5.8, 5.7, -5.6, 2);
    B.vc.fbox('#7a5232', 1.6, 0.08, 0.5, -4.9, 0.42, -5.75); B.vc.fbox('#7a5232', 1.6, 0.45, 0.08, -4.9, 0.5, -6.0);
    col(-5.7, -6.05, -4.1, -5.5, 1);

    // parked cars along both kerbs (Quaternius CC0 models: ~3k tris each, long axis +Z -> yaw ±90° along the avenue;
    // too many triangles for the camera ray, so each gets an invisible occluder box + one collider)
    const car = (id, x, z, yaw) => place(id, { position: [x, 0, z], yaw, collider: true, occluder: 'box' });
    car('car_sedan', -26.5, -2.45, PI / 2);
    car('car_hatchback', -17.2, 2.45, -PI / 2);
    car('car_suv', 17.5, -2.45, PI / 2);
    car('car_sedan', 9.5, 2.45, -PI / 2);

    // street-name signs at the crossing
    for (const [x, z, t] of [[-6.2, -6.2, { ar: 'شارع النور ↕', en: 'Al-Noor St ↕' }], [6.2, 6.2, { ar: 'جادة السلام ↔', en: 'Al-Salam Ave ↔' }]]) {
      B.vc.fcyl('#2f3a40', 0.04, 0.04, 2.6, x, 0, z, 6);
      B.vc.fbox('#1e6b4f', 1.4, 0.32, 0.04, x, 2.4, z);
      label(t, [x, 2.95, z], { size: 0.24, background: 'rgba(30,107,79,0.9)' });
      col(x - 0.1, z - 0.1, x + 0.1, z + 0.1);
    }

    // ------------------------------------------------------------ playground behind the college (slide + swings)
    {
      const z = -18.9;
      G.fbox('#c99b63', 7.4, 0.03, 2.9, -11.4, 0, z);                                      // wood-chip pad
      const tx = -13.7;                                                                     // slide tower
      for (const ox of [-0.5, 0.5]) for (const oz of [-0.5, 0.5]) B.vc.fbox('#d24a3a', 0.09, 2.3, 0.09, tx + ox, 0, z + oz);
      B.vc.fbox('#f2c14e', 1.15, 0.08, 1.15, tx, 1.3, z);
      B.vc.geo(prism(1.4, 0.7, 1.4), '#2f6fb5', tx, 2.3, z);
      B.vc.box('#f2c14e', 2.4, 0.06, 0.62, tx + 1.62, 0.75, z, 0, 0, -0.5);
      for (const oz of [-0.3, 0.3]) B.vc.box('#e2a73a', 2.4, 0.18, 0.04, tx + 1.62, 0.84, z + oz, 0, 0, -0.5);
      for (const oz of [-0.25, 0.25]) B.vc.box('#d24a3a', 0.06, 1.5, 0.06, tx - 0.85, 0.7, z + oz, 0, 0, -0.35);
      for (let k = 0; k < 4; k++) B.vc.box('#d24a3a', 0.05, 0.05, 0.5, tx - 1.0 + k * 0.08, 0.2 + k * 0.32, z);
      col(tx - 1.1, z - 0.6, tx + 2.8, z + 0.6, 2.4);
      const sxL = -10.6, sxR = -7.9;                                                        // swing set
      B.vc.cyl('#2f6fb5', 0.05, 0.05, sxR - sxL + 0.2, (sxL + sxR) / 2, 2.15, z, 8, 0, 0, PI / 2);
      for (const lx of [sxL, sxR]) {
        for (const oz of [-1, 1]) B.vc.box('#2f6fb5', 0.07, 2.3, 0.07, lx, 1.08, z + oz * 0.42, 0, -oz * 0.38);
        col(lx - 0.15, z - 0.9, lx + 0.15, z + 0.9, 2.2);
      }
      for (const cx of [-9.8, -8.7]) {
        for (const ox of [-0.22, 0.22]) B.vc.box('#8d9399', 0.02, 1.55, 0.02, cx + ox, 1.35, z);
        B.vc.box('#d24a3a', 0.5, 0.05, 0.22, cx, 0.55, z);
      }
      // a bench facing the playground
      B.vc.fbox('#a8703f', 1.5, 0.06, 0.45, -11.4, 0.42, -17.6); B.vc.fbox('#1f3b2d', 1.4, 0.42, 0.06, -11.4, 0, -17.6);
      col(-12.2, -17.85, -10.6, -17.35, 1);
    }

    // ------------------------------------------------------------ trees: round canopies (some autumn), cypresses
    const keepOut = [
      ...BUILDINGS.flatMap((b) => { const L = layoutOf(b); return [[L.door[0], L.door[2], 2.6], [L.spawn.position[0], L.spawn.position[2], 2.2]]; }),
      ...FEATURE_SPOTS.map((s) => [s.pos[0], s.pos[2], 2.2])
    ];
    const free = (x, z, r) => {
      if (Math.abs(x) > HALF_X - 0.9 || Math.abs(z) > HALF_Z - 0.9) return false;
      if (keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) return false;
      return !colliders.some((c) => x > c.min[0] - r && x < c.max[0] + r && z > c.min[2] - r && z < c.max[2] + r);
    };
    const tree = (x, z, s = 1, { autumn = R() < 0.3, collide = true, check = true } = {}) => {
      if (check && !free(x, z, 0.35)) return false;
      const trunkH = 1.7 * s;
      B.vc.fcyl('#5b4231', 0.1 * s, 0.17 * s, trunkH + 0.7 * s, x, 0, z, 6);
      const pal = autumn ? AUTUMN : GREENS;
      const base = pick(pal);
      const cy = trunkH + 1.0 * s;
      const n = low ? 3 : 4 + (R() < 0.45 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const a = R() * PI * 2, rr = k === 0 ? 0 : 0.6 * s * (0.6 + R() * 0.4);
        const r = (k === 0 ? 1.12 : 0.72 + R() * 0.3) * s;
        const y = cy + (k === 0 ? 0 : (R() - 0.35) * 1.0 * s);
        B.leaf.geo(new THREE.IcosahedronGeometry(r, 1), tint(R() < 0.75 ? base : pick(pal)), x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, R() * PI, 0, 0, 1, 0.88 + R() * 0.15, 1);
      }
      if (collide) col(x - 0.22 * s, z - 0.22 * s, x + 0.22 * s, z + 0.22 * s);
      return true;
    };
    const cypress = (x, z, s = 1) => {
      if (!free(x, z, 0.3)) return false;
      B.vc.fcyl('#4a3626', 0.08 * s, 0.12 * s, 0.9 * s, x, 0, z, 6);
      B.leaf.geo(new THREE.IcosahedronGeometry(0.75 * s, 1), tint('#2d5230', 0.6), x, 3.2 * s, z, R() * PI, 0, 0, 0.66, 3.6, 0.66);
      B.leaf.geo(new THREE.IcosahedronGeometry(0.55 * s, 1), tint('#335b33', 0.6), x + 0.05 * s, 5.3 * s, z, R() * PI, 0, 0, 0.62, 2.6, 0.62);
      col(x - 0.3 * s, z - 0.3 * s, x + 0.3 * s, z + 0.3 * s, 4);
      return true;
    };
    // the original sidewalk / cross-street trees (positions unchanged)
    for (const s of [-1, 1]) {
      // (north side: no tree at -27.6 / -16.5 any more — they would hide Adam's house from the street)
      for (const x of s < 0 ? [18.75, 29.2] : [-27.6, -16.5, 18.75, 29.2]) { tree(x, s * 5.5, 1, { check: false }); G.fcyl('#5b4632', 0.55, 0.55, 0.06, x, 0, s * 5.5, 10); }
      for (const z of [10, 17]) for (const zz of [z, -z]) { tree(s * 5.5, zz, 1, { check: false }); G.fcyl('#5b4632', 0.55, 0.55, 0.06, s * 5.5, 0, zz, 10); }
    }
    // cypresses around the mosque (behind it and beside the minaret)
    const mosque = BUILDINGS.find((b) => b.kind === 'mosque');
    for (const x of [mosque.x - 4.6, mosque.x - 1.6, mosque.x + 1.7, mosque.x + 4.7]) cypress(x + (R() - 0.5) * 0.3, -19.4, 1.25 + R() * 0.2);
    cypress(18.75, -12.6, 1.15); cypress(18.75, -15.8, 1.3);
    // rows behind both building rows (they read above the roofs), the map ends and the gaps between buildings
    const step = low ? 4.6 : 3.1;
    for (let x = -HALF_X + 1.6; x < HALF_X - 1; x += step) {
      const inPlay = x > -15.8 && x < -7.2, byMosque = x > mosque.x - 5.8 && x < mosque.x + 5.8;
      if (!inPlay && !byMosque) tree(x + (R() - 0.5) * 0.8, -19.6 + (R() - 0.5) * 0.5, 1.05 + R() * 0.4);
      tree(x + 1.2 + (R() - 0.5) * 0.8, 19.2 + (R() - 0.5) * 0.6, 1.0 + R() * 0.45);
    }
    for (const s of [-1, 1]) for (const z of [8.8, 12.2, 15.6]) {
      tree(-29.1 + (R() - 0.5) * 0.6, s * (z + (R() - 0.5)), 0.95 + R() * 0.35);
      tree(29.6, s * (z + 1 + (R() - 0.5)), 0.8 + R() * 0.25);
    }
    for (const [x, z] of [[-16.5, 10.9], [-16.5, 14.3], [18.75, 11.0], [18.75, 14.4]]) tree(x, z, 0.8);   // (none in the 1.5 m gap house/college)
    // a proper leafy tree (CC0 model) on the sidewalk at the west end of Adam's house, framing it without hiding the door
    place('tree_leafy', { position: [-26.8, 0, -5.7], yaw: 0.6, scale: 0.8, collider: false, occluder: 'box' });
    col(-27.1, -6.0, -26.5, -5.4);
    G.fcyl('#5b4632', 0.55, 0.55, 0.06, -26.8, 0, -5.7, 10);

    // ------------------------------------------------------------ meshes
    for (const [k, b] of Object.entries(B)) {
      const mesh = b.build(M[k], { cast: k !== 'flat' && k !== 'glow' && k !== 'lamp', receive: k !== 'glow' && k !== 'lamp' });
      if (!mesh) continue;
      mesh.name = `town:${k}`;
      if (k === 'flat' || backdropFor) mesh.userData.noCameraCollide = true;
      group.add(mesh);
    }

    // ------------------------------------------------------------ backdrop: golden sky + the suburb around the map
    let backdrop = null;
    if (golden) {
      backdrop = createGoldenSky({ quality: ctx.quality });
      const sea = backdrop.userData.seaSector;
      const S = makeBatch('town-suburb');
      S.geo(new THREE.CircleGeometry(260, 40), '#6e9447', 0, backdropFor ? -0.09 : -0.06, 0, 0, -PI / 2);   // ground out to the haze (below an interior's floor)
      const gridStep = low ? 9.5 : 7.2;
      for (let gx = -96; gx <= 96; gx += gridStep) for (let gz = -96; gz <= 96; gz += gridStep) {
        const x = gx + (R() - 0.5) * gridStep * 0.7, z = gz + (R() - 0.5) * gridStep * 0.7;
        const r = Math.hypot(x, z);
        if (r > 96 || (Math.abs(x) < HALF_X + 4 && Math.abs(z) < HALF_Z + 4)) continue;
        const az = Math.atan2(z, x);
        const da = Math.abs(Math.atan2(Math.sin(az - sea.az), Math.cos(az - sea.az)));
        if (da < sea.half + 0.12 && r > HALF_X + 3) { if (R() < 0.25) S.ico(tint('#4d7a3a'), 0.7, x, 0.4, z, 1.4, 0.7, 1); continue; }   // keep the view to the sea open
        if (R() < 0.12) continue;
        if (R() < 0.42) {
          const w = 6 + R() * 3, d = 6 + R() * 2, h = 3 + R() * 1.6, ry = R() < 0.5 ? 0 : PI / 2;
          S.geo(new THREE.BoxGeometry(w, h, d), tint(pick(['#efe6d6', '#f3ecdf', '#e8d9b8', '#d9dfe0', '#e9d6c4', '#c9b08e']), 0.5), x, h / 2, z, ry);
          S.geo(prism(w + 0.6, 1.6 + R() * 0.8, d + 0.6), tint(pick(['#4a5260', '#5b5f66', '#6d4a3c', '#55606b']), 0.4), x, h, z, ry);
          if (R() < 0.7) { const a = R() * PI * 2; S.ico(tint(pick(R() < 0.3 ? AUTUMN : GREENS)), 1.6, x + Math.cos(a) * 4.5, 2.6, z + Math.sin(a) * 4.5, 1, 1.1, 1); }
        } else {
          const s2 = 0.9 + R() * 0.7, pal = R() < 0.3 ? AUTUMN : GREENS;
          S.fcyl('#5b4231', 0.15 * s2, 0.2 * s2, 2.2 * s2, x, 0, z, 5);
          for (let k = 0; k < 3; k++) S.ico(tint(pick(pal)), (k ? 1.0 : 1.4) * s2, x + (R() - 0.5) * 1.6 * s2, (2.8 + R() * 0.9) * s2, z + (R() - 0.5) * 1.6 * s2, 1, 0.95, 1, R() * PI);
        }
      }
      const suburbMat = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
      const suburb = S.build(suburbMat, { cast: false, receive: false });
      suburb.name = 'town:suburb';
      suburb.userData.noCameraCollide = true;
      backdrop.add(suburb);
    }

    // ------------------------------------------------------------ people (background extras: 1 draw call each)
    const npcs = backdropFor ? [] : [
      // Yusuf, the retired neighbour, by his hedge west of Adam's porch (a real NPC: name label + the talk feature)
      {
        id: 'neighbor_yusuf', position: [-25.0, 0, -5.6], yaw: PI - 0.5,
        name: { ar: 'يوسف — الجار', en: 'Yusuf (neighbour)' },
        look: { sex: 'male', skin: '#a8714b', shirt: '#e9e4d6', pants: '#6b6b6b', shoes: '#3a2a20', kufi: '#f4f1ea', beard: '#b9b4ad', hair: '#9a948c', glasses: true, height: 1.7, build: 1.05 },
        talk: {
          name: { ar: 'يوسف', en: 'Yusuf' },
          role: { ar: 'جار آدم، متقاعد ويحب الحديقة', en: "Adam's retired neighbour who loves his garden" },
          persona: {
            ar: 'رجل مسنّ ودود يسقي حديقته كل صباح ويعرف حيّ السلام شبراً شبراً: المسجد، سوق الحيّ، الكلية، ومن يسكن أين. يرحّب بآدم بحرارة ويحكي عن الحيّ وجيرانه، لكنه لا يُفتي أبداً؛ إن سُئل عن حكم شرعي أرشد إلى إمام المسجد أو أهل العلم.',
            en: 'A warm, elderly man who waters his garden every morning and knows Al-Salam neighbourhood inside out: the mosque, the market street, the college and who lives where. He greets Adam heartily and chats about the neighbourhood and its people, but never gives religious rulings; asked for one, he points to the mosque imam or people of knowledge.'
          }
        }
      },
      { id: 'bg_town_walker1', position: [-19.5, 0, 5.3], yaw: -PI / 2, look: { sex: 'female', skin: '#8d5524', shirt: '#7b4b6a', hijab: '#2f4a6d', dress: '#2f3542', height: 1.65 } },
      { id: 'bg_town_walker2', position: [9.4, 0, -5.4], yaw: PI / 2, look: { sex: 'male', skin: '#c68642', shirt: '#f2f2f2', kufi: '#ffffff', beard: '#2b1d14', pants: '#3a3a3a', height: 1.78 } },
      { id: 'bg_town_walker3', position: [-13.6, 0, 5.4], yaw: PI, look: { sex: 'male', skin: '#e8c4a0', jacket: '#3d5a40', pants: '#2f3542', height: 1.8 } },
      { id: 'bg_town_walker4', position: [14.6, 0, 5.3], yaw: -PI / 2, look: { sex: 'female', skin: '#e0ac69', shirt: '#c9a227', hijab: '#7d2e46', dress: '#3b3b55', height: 1.62 } },
      { id: 'bg_town_child', position: [-23.4, 0, 6.1], yaw: PI, look: { sex: 'male', skin: '#c68642', shirt: '#e67e22', pants: '#34495e', height: 1.15 } }
    ];

    const doors = backdropFor ? [] : BUILDINGS.map((b) => { const L = layoutOf(b); return { location: b.loc, position: L.door, radius: 1.7, label: b.label, spawn: L.spawn }; });
    const home = layoutOf(BUILDINGS[0]);

    const res = {
      group,
      spawn: home.spawn,
      colliders,
      npcs,
      doors,
      exit: null,
      featureSpots: backdropFor ? [] : FEATURE_SPOTS,
      cameraOccluders: backdropFor ? [] : occluders,
      dispose() { for (const o of owned) o.dispose?.(); backdrop?.userData.dispose?.(); }
    };
    if (golden) Object.assign(res, { lights: 'golden', backdrop });
    else Object.assign(res, { lights: 'day', sky: '#bcd4e6', fog: { color: '#bcd4e6', near: 45, far: 120 } });
    return res;
  }
};
