// «يومك» — MOSQUE (Islamic center of the neighbourhood, Columbus, Ohio; winter daylight).
// Two rooms under one roof, open "dollhouse" style like home.js:
//   * Prayer hall (z -8..1.5): carpet laid in rows (sufuf) facing the qibla wall (north, -Z), mihrab niche in the
//     middle of the qibla wall, minbar on its right (seen by someone facing the qibla), two calligraphy roundels with
//     the generic names «الله» and «محمد» only (no verse text), mushaf shelf + reading table on the west side, prayer
//     times board and the imam's office door on the east side. High windows give soft daylight.
//   * Entrance lobby (z 1.5..9): shoe racks at the arcade (shoes come off before the carpet), a wudu area with taps
//     and stools (east), a small library / reading corner (west), the entrance door = exit back to town (south).
// Procedural geometry only, merged into a few vertex-coloured batches (./mosque/batch.js). Canvas textures
// (./mosque/textures.js) are optional: without a DOM the scene falls back to flat colours (node:test builds it).
// No characters are shown praying (no animated worship poses): the imam simply stands at his office door and one
// background visitor sits reading in the library.
import { createBatcher } from './mosque/batch.js';
import { calligraphyAtlas, carpetTile, mihrabTile, ensureCalligraphyFont } from './mosque/textures.js';

const PI = Math.PI;
const X0 = -8, X1 = 8;          // building x extent
const ZN = -8;                  // qibla wall (north)
const ZA = 1.5;                 // arcade between hall and lobby
const ZS = 9;                   // entrance wall (south)
const HH = 4.0;                 // hall wall height
const HL = 3.0;                 // lobby wall height

const C = {
  wall: '#f1ebdf', wallLobby: '#ece4d3', cap: '#d6cbb5', base: '#cdbf9f', trim: '#e9dfc9',
  stone: '#d9cfbb', stoneDark: '#b9ab90', gold: '#c9a54a', green: '#1f4d44', greenDark: '#163a33',
  wood: '#8a5a36', woodDark: '#5e3c24', woodLight: '#b8875a', walnut: '#6e4b30',
  tile: '#d7e3e6', tileDark: '#a9bcc1', chrome: '#c7ccd1', steel: '#9aa1a8', black: '#1d1f22', white: '#fafaf6',
  window: '#e4eef4', led: '#ffb347', ledDim: '#6b4a1f', board: '#20262b',
  snow: '#eef3f6', pine: '#2f5a43', bark: '#5a4030', minaret: '#e8e0cf'
};

/** Interactable spots that open feature panels (wired by the engine owner, see the feature contract). */
const FEATURE_SPOTS = Object.freeze([
  Object.freeze({ feature: 'quran', pos: Object.freeze([-6.85, 0.9, -3.95]), label: Object.freeze({ ar: 'المصحف المرتل والترجمة', en: 'Recited Quran & translation' }) }),
  Object.freeze({ feature: 'adhkar', pos: Object.freeze([-6.7, 0.9, 4.95]), label: Object.freeze({ ar: 'أذكار الصباح والمساء', en: 'Morning & evening adhkar' }) }),
  Object.freeze({ feature: 'prayer', pos: Object.freeze([6.75, 1.4, -4.2]), label: Object.freeze({ ar: 'مواقيت الصلاة', en: 'Prayer times' }) }),
  Object.freeze({ feature: 'experts', pos: Object.freeze([6.7, 1.0, -1.15]), label: Object.freeze({ ar: 'اسأل أهل العلم', en: 'Ask a scholar' }) })
]);

export default {
  id: 'mosque',
  title: { ar: 'المسجد', en: 'Mosque' },
  featureSpots: FEATURE_SPOTS,

  async build(ctx) {
    const THREE = ctx.THREE;
    const group = ctx.group || new THREE.Group();
    group.name = 'mosque';
    const low = ctx.quality === 'low';
    const disposables = [];
    const own = (x) => { if (x) disposables.push(x); return x; };
    const makeBatch = createBatcher(THREE);
    const font = await ensureCalligraphyFont(1500);

    // ------------------------------------------------------------------ materials (all owned by this scene)
    const mat = {
      matte: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true })),
      satin: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, flatShading: true })),
      metal: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6, flatShading: true })),
      walls: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, emissive: '#5a5246', emissiveIntensity: 0.5 })),
      glow: own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
      glass: own(new THREE.MeshBasicMaterial({ color: '#dcebf7', transparent: true, opacity: 0.22, depthWrite: false })),
      lobbyFloor: own(new THREE.MeshStandardMaterial({ color: '#e6dfd0', roughness: 0.35 })),
      snowGround: own(new THREE.MeshStandardMaterial({ color: C.snow, roughness: 1 }))
    };
    const tex = {
      carpet: own(carpetTile(THREE)),
      mihrab: own(mihrabTile(THREE)),
      calli: own(calligraphyAtlas(THREE, { honorific: font.honorific }))
    };
    const carpetW = X1 - X0, carpetD = ZA - ZN;
    if (tex.carpet) {
      tex.carpet.repeat.set(carpetW / 1.0, carpetD / 1.2);
      tex.carpet.offset.set(0, Math.ceil(carpetD / 1.2) - carpetD / 1.2);   // first row starts exactly at the qibla wall
    }
    if (tex.mihrab) tex.mihrab.repeat.set(4, 4);
    const tmat = {
      carpet: own(new THREE.MeshStandardMaterial(tex.carpet ? { map: tex.carpet, roughness: 1 } : { color: '#7d1e2c', roughness: 1 })),
      // concave niche: BackSide shows the inside (three flips the normals for back faces)
      niche: own(new THREE.MeshStandardMaterial(tex.mihrab ? { map: tex.mihrab, roughness: 0.5, side: THREE.BackSide } : { color: '#2f7f8a', roughness: 0.5, side: THREE.BackSide })),
      calli: tex.calli ? own(new THREE.MeshStandardMaterial({ map: tex.calli, roughness: 0.6, transparent: true, alphaTest: 0.5 })) : null
    };

    // ------------------------------------------------------------------ batches
    const B = {
      walls: makeBatch('walls'), matte: makeBatch('matte'), satin: makeBatch('satin'), metal: makeBatch('metal'),
      glow: makeBatch('glow'), glass: makeBatch('glass'), niche: makeBatch('niche'), calli: makeBatch('calligraphy'),
      outside: makeBatch('outside')
    };
    const colliders = [];
    const solid = (x0, z0, x1, z1, h = 1.1) => colliders.push({ min: [Math.min(x0, x1), 0, Math.min(z0, z1)], max: [Math.max(x0, x1), Math.min(h, 1.1), Math.max(z0, z1)] });

    // ================================================================== FLOORS
    const carpet = new THREE.Mesh(own(new THREE.PlaneGeometry(carpetW, carpetD)), tmat.carpet);
    carpet.rotation.x = -PI / 2;
    carpet.position.set(0, 0.002, (ZN + ZA) / 2);
    carpet.receiveShadow = true;
    carpet.name = 'mosque:carpet';
    group.add(carpet);
    const lobby = new THREE.Mesh(own(new THREE.PlaneGeometry(X1 - X0, ZS - ZA)), mat.lobbyFloor);
    lobby.rotation.x = -PI / 2;
    lobby.position.set(0, 0, (ZA + ZS) / 2);
    lobby.receiveShadow = true;
    lobby.name = 'mosque:lobbyFloor';
    group.add(lobby);
    // stone threshold strip under the arcade + inlaid border lines in the lobby
    B.matte.span(C.stoneDark, X0, 0, ZA - 0.05, X1, 0.012, ZA + 0.35);
    for (const z of [3.0, 7.5]) B.satin.span('#cfc5b1', -5.5, 0, z - 0.03, 5.5, 0.004, z + 0.03);
    B.matte.span('#3f4a4f', -1.1, 0, 7.6, 1.1, 0.01, 8.9);                               // entrance mat

    // ================================================================== WALLS (one-sided, inward)
    // frame: origin + u along the wall; local +z = inward normal. holes: { a0, a1, y0, y1, door? }
    const WALLS = {
      n: { o: [X0, ZN], ry: 0, len: X1 - X0, h: HH, col: C.wall, cap: true, holes: [
        { a0: 7.3, a1: 8.7, y0: 0, y1: 2.5, niche: true },           // mihrab opening x -0.7..0.7
        { a0: 1.4, a1: 2.6, y0: 2.5, y1: 3.6 }, { a0: 13.4, a1: 14.6, y0: 2.5, y1: 3.6 }
      ] },
      wh: { o: [X0, ZA], ry: PI / 2, len: ZA - ZN, h: HH, col: C.wall, cap: true, holes: [   // z = ZA - u
        { a0: 3.0, a1: 4.2, y0: 2.4, y1: 3.6 }, { a0: 7.4, a1: 8.6, y0: 2.4, y1: 3.6 }
      ] },
      eh: { o: [X1, ZN], ry: -PI / 2, len: ZA - ZN, h: HH, col: C.wall, cap: true, holes: [   // z = ZN + u
        { a0: 0.9, a1: 2.1, y0: 2.4, y1: 3.6 },
        { a0: 6.6, a1: 7.6, y0: 0, y1: 2.15, door: true }              // imam's office door z -1.4..-0.4
      ] },
      wl: { o: [X0, ZS], ry: PI / 2, len: ZS - ZA, h: HL, col: C.wallLobby, cap: true, holes: [  // z = ZS - u
        { a0: 2.0, a1: 3.5, y0: 0.9, y1: 2.2 }                            // library window z 7..5.5
      ] },
      el: { o: [X1, ZA], ry: -PI / 2, len: ZS - ZA, h: HL, col: C.wallLobby, cap: true, holes: [] },  // z = ZA + u
      s: { o: [X1, ZS], ry: PI, len: X1 - X0, h: HL, col: C.wallLobby, cap: false, holes: [         // x = X1 - u
        { a0: 3.0, a1: 5.0, y0: 0.9, y1: 2.2 }, { a0: 7.2, a1: 8.8, y0: 0, y1: 2.3, door: true }, { a0: 11.0, a1: 13.0, y0: 0.9, y1: 2.2 }
      ] }
    };
    const inFrame = (wd, fn, batches) => {
      for (const b of batches) b.push(wd.o[0], 0, wd.o[1], wd.ry);
      fn();
      for (const b of batches) b.pop();
    };
    for (const wd of Object.values(WALLS)) {
      inFrame(wd, () => {
        const rect = (u0, u1, y0, y1) => { if (u1 - u0 > 1e-3 && y1 - y0 > 1e-3) B.walls.quad(wd.col, u1 - u0, y1 - y0, (u0 + u1) / 2, (y0 + y1) / 2, 0); };
        let cur = 0;
        for (const h of [...wd.holes].sort((a, b) => a.a0 - b.a0)) {
          rect(cur, h.a0, 0, wd.h);
          rect(h.a0, h.a1, 0, h.y0);
          rect(h.a0, h.a1, h.y1, wd.h);
          cur = h.a1;
        }
        rect(cur, wd.len, 0, wd.h);
        if (wd.cap) B.walls.quad(C.cap, wd.len + 0.3, 0.15, wd.len / 2, wd.h, -0.075, 0, -PI / 2);
        // stone dado (lower band) + baseboard, interrupted by floor-level openings
        let bc = 0;
        const band = (u0, u1) => {
          if (u1 - u0 < 1e-3) return;
          B.walls.quad(C.base, u1 - u0, 0.12, (u0 + u1) / 2, 0.06, 0.012);
          B.walls.quad(C.trim, u1 - u0, 0.05, (u0 + u1) / 2, 1.1, 0.01);
        };
        for (const h of wd.holes.filter((x) => x.y0 < 0.1).sort((a, b) => a.a0 - b.a0)) { band(bc, h.a0); bc = h.a1; }
        band(bc, wd.len);
        // window frames + glowing daylight panes
        for (const h of wd.holes) {
          if (h.door || h.niche) continue;
          const uc = (h.a0 + h.a1) / 2, yc = (h.y0 + h.y1) / 2, w = h.a1 - h.a0, hh = h.y1 - h.y0;
          B.satin.box(C.trim, 0.07, hh + 0.14, 0.16, h.a0 - 0.035, yc, 0);
          B.satin.box(C.trim, 0.07, hh + 0.14, 0.16, h.a1 + 0.035, yc, 0);
          B.satin.box(C.trim, w, 0.07, 0.16, uc, h.y1 + 0.035, 0);
          B.satin.box(C.trim, w + 0.2, 0.04, 0.22, uc, h.y0 - 0.02, 0.03);
          B.satin.box(C.trim, 0.035, hh, 0.04, uc, yc, 0);
          B.glow.quad(C.window, w, hh, uc, yc, -0.02);
          B.glass.quad('#ffffff', w, hh, uc, yc, -0.01);
        }
      }, [B.walls, B.satin, B.glow, B.glass]);
    }
    // wall colliders (outside the inner faces). Closed doors are part of the walls.
    solid(X0 - 0.3, ZN - 0.9, X1 + 0.3, ZN);          // qibla wall (+ the mihrab niche behind it)
    solid(X0 - 0.3, ZS, X1 + 0.3, ZS + 0.3);
    solid(X0 - 0.3, ZN - 0.3, X0, ZS + 0.3);
    solid(X1, ZN - 0.3, X1 + 0.3, ZS + 0.3);

    // ================================================================== ARCADE between hall and lobby
    // Columns + pointed arches. The arch band faces the hall only (one-sided), so the usual camera, which sits
    // south of Adam, always sees through it into the hall.
    const COLS = [-5.2, -1.8, 1.8, 5.2], CHW = 0.22, SPRING = 2.05, TOP = 3.0;
    {
      const edges = [X0 + 0.18, ...COLS.flatMap((x) => [x - CHW, x + CHW]), X1 - 0.18];
      const shape = new THREE.Shape();
      shape.moveTo(X0, 0);
      for (let i = 0; i < edges.length; i += 2) {
        const xa = edges[i], xb = edges[i + 1], mid = (xa + xb) / 2, rise = Math.min(0.85, (xb - xa) * 0.32);
        shape.lineTo(xa, 0);
        shape.lineTo(xa, SPRING);
        shape.quadraticCurveTo(xa, SPRING + rise * 0.85, mid, SPRING + rise);
        shape.quadraticCurveTo(xb, SPRING + rise * 0.85, xb, SPRING);
        shape.lineTo(xb, 0);
      }
      shape.lineTo(X1, 0);
      shape.lineTo(X1, TOP);
      shape.lineTo(X0, TOP);
      shape.closePath();
      B.walls.geo(new THREE.ShapeGeometry(shape, 6), C.wall, 0, 0, ZA - 0.2, PI);   // ry=PI -> faces -Z (the hall); symmetric
      for (let i = 0; i < edges.length; i += 2) {                                       // wooden tie beams at the springing line
        const xa = edges[i], xb = edges[i + 1];
        B.satin.box(C.woodDark, xb - xa + 0.06, 0.06, 0.06, (xa + xb) / 2, SPRING - 0.03, ZA);
      }
      B.matte.span(C.cap, X0, TOP, ZA - 0.25, X1, TOP + 0.1, ZA + 0.25);
      for (const x of COLS) {
        B.satin.fbox(C.stone, CHW * 2, SPRING - 0.25, CHW * 2, x, 0.2, ZA);
        B.satin.fbox(C.stoneDark, CHW * 2 + 0.12, 0.2, CHW * 2 + 0.12, x, 0, ZA);          // base
        B.satin.fbox(C.stoneDark, CHW * 2 + 0.14, 0.12, CHW * 2 + 0.14, x, SPRING - 0.05, ZA); // capital
        B.matte.fbox(C.wall, CHW * 2, TOP - SPRING - 0.07, CHW * 2, x, SPRING + 0.07, ZA);
        solid(x - CHW - 0.06, ZA - CHW - 0.06, x + CHW + 0.06, ZA + CHW + 0.06);
      }
      for (const x of [X0 + 0.09, X1 - 0.09]) B.satin.fbox(C.stone, 0.18, TOP, 0.5, x, 0, ZA);
    }

    // ================================================================== MIHRAB (centre of the qibla wall)
    {
      const R = 0.7, YS = 1.8;
      B.niche.geo(new THREE.CylinderGeometry(R, R, YS, 16, 1, true, PI / 2, PI), '#ffffff', 0, YS / 2, ZN);
      B.niche.geo(new THREE.SphereGeometry(R, 16, 6, PI, PI, 0, PI / 2), '#ffffff', 0, YS, ZN);
      B.matte.span(C.stone, -R, 0, ZN - R, R, 0.03, ZN);                                   // niche floor
      // spandrels: fill the corners between the round arch and the rectangular opening
      for (const s of [-1, 1]) {
        const sp = new THREE.Shape();
        sp.moveTo(s * R, YS);
        sp.lineTo(s * R, YS + R);
        sp.lineTo(0, YS + R);
        sp.absarc(0, YS, R, PI / 2, s > 0 ? 0 : PI, s > 0);
        sp.closePath();
        B.walls.geo(new THREE.ShapeGeometry(sp, 8), C.wall, 0, 0, ZN + 0.001);
      }
      // frame: slim columns, gold arch band, rectangular alfiz border, green field above
      for (const s of [-1, 1]) {
        B.satin.fcyl(C.green, 0.06, 0.06, YS, s * (R + 0.08), 0, ZN + 0.06, 8);
        B.metal.fcyl(C.gold, 0.09, 0.09, 0.08, s * (R + 0.08), YS - 0.04, ZN + 0.06, 8);
        B.metal.fcyl(C.gold, 0.09, 0.09, 0.06, s * (R + 0.08), 0, ZN + 0.06, 8);
      }
      B.metal.torus(C.gold, R + 0.06, 0.045, 0, YS, ZN + 0.05, 0, 0, 0, PI);
      const fw = 2 * R + 0.6, fy0 = 0, fy1 = YS + R + 0.45;
      B.walls.quad(C.green, fw, fy1 - YS - R, 0, (YS + R + fy1) / 2, ZN + 0.004);
      B.walls.quad(C.greenDark, 0.18, fy1, -fw / 2 + 0.09, fy1 / 2, ZN + 0.005);
      B.walls.quad(C.greenDark, 0.18, fy1, fw / 2 - 0.09, fy1 / 2, ZN + 0.005);
      B.metal.box(C.gold, fw + 0.06, 0.05, 0.03, 0, fy1, ZN + 0.02);
      B.metal.box(C.gold, 0.04, fy1, 0.03, -fw / 2, fy1 / 2, ZN + 0.02);
      B.metal.box(C.gold, 0.04, fy1, 0.03, fw / 2, fy1 / 2, ZN + 0.02);
      for (let i = -2; i <= 2; i++) B.metal.ico(C.gold, 0.05, i * 0.22, YS + R + 0.22, ZN + 0.03, 1, 1, 0.4, PI / 4);
    }

    // ================================================================== MINBAR (right of the mihrab, facing the rows)
    {
      const MX0 = 1.15, MX1 = 1.95, ZF = -5.75, STEPS = 6, RUN = 0.3, RISE = 0.26;
      for (let i = 0; i < STEPS; i++) {
        const zf = ZF - RUN * i, top = RISE * (i + 1);
        B.satin.span(C.woodDark, MX0 + 0.06, 0, zf - RUN, MX1 - 0.06, top - 0.03, zf);
        B.satin.span(C.woodLight, MX0 + 0.06, top - 0.03, zf - RUN, MX1 - 0.06, top, zf);
      }
      const zTop = ZF - RUN * STEPS, yTop = RISE * STEPS;
      B.satin.span(C.woodDark, MX0 + 0.06, 0, ZN, MX1 - 0.06, yTop, zTop);                 // platform
      // side panels (stepped balustrade), drawn both ways so they read from either side
      const dTop = ZF - zTop, dEnd = ZF - ZN;
      const panelShape = (sg) => {   // sg=+1: u grows toward the qibla when yawed +PI/2; sg=-1 mirrored for -PI/2
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.lineTo(0, 1.05); sh.lineTo(sg * dTop, yTop + 0.95); sh.lineTo(sg * dEnd, yTop + 0.95); sh.lineTo(sg * dEnd, 0); sh.closePath();
        return sh;
      };
      for (const x of [MX0, MX1]) {
        B.matte.geo(new THREE.ShapeGeometry(panelShape(1), 1), C.walnut, x + 0.005, 0, ZF, PI / 2);     // faces +X
        B.matte.geo(new THREE.ShapeGeometry(panelShape(-1), 1), C.walnut, x - 0.005, 0, ZF, -PI / 2);   // faces -X
      }
      // front gate posts + canopy (kiosk) with a small dome at the top
      for (const x of [MX0, MX1]) {
        B.satin.fbox(C.walnut, 0.1, 1.55, 0.1, x, 0, ZF);
        B.metal.sph(C.gold, 0.05, x, 1.6, ZF);
      }
      B.satin.box(C.walnut, MX1 - MX0 + 0.1, 0.1, 0.08, (MX0 + MX1) / 2, 1.5, ZF);
      for (const x of [MX0 + 0.08, MX1 - 0.08]) for (const z of [zTop - 0.05, ZN + 0.1]) B.satin.fbox(C.walnut, 0.06, 0.95, 0.06, x, yTop, z);
      const kc = (zTop + ZN) / 2;
      B.satin.span(C.walnut, MX0, yTop + 0.95, zTop - 0.12, MX1, yTop + 1.03, ZN + 0.02);
      B.matte.sph(C.green, 0.36, (MX0 + MX1) / 2, yTop + 1.03, kc, 1, 1.15, 1, 12, 6);
      B.metal.fcyl(C.gold, 0.012, 0.03, 0.28, (MX0 + MX1) / 2, yTop + 1.4, kc, 6);
      solid(MX0 - 0.05, ZN, MX1 + 0.05, ZF + 0.05);
    }

    // ================================================================== CALLIGRAPHY ROUNDELS (generic names only)
    // «الله» to the right of the mihrab, «محمد» to the left (as seen facing the qibla).
    {
      const D = 1.5, Y = 2.55;
      const spots = [[3.4, 0], [-3.4, 0.5]];      // [x, atlas u offset]: left half = الله, right half = محمد
      for (const [x, ou] of spots) {
        if (tmat.calli) B.calli.quad('#ffffff', D, D, x, Y, ZN + 0.02, 0, 0, [0.5, 1, ou, 0]);
        else {
          B.metal.geo(new THREE.CircleGeometry(D / 2, 24), C.gold, x, Y, ZN + 0.015);
          B.matte.geo(new THREE.CircleGeometry(D / 2 * 0.92, 24), C.green, x, Y, ZN + 0.02);
        }
      }
    }

    // ================================================================== MUSHAF SHELF + READING TABLE (hall, west)
    {
      const SX0 = X0, SX1 = X0 + 0.4, SZ0 = -6.2, SZ1 = -3.8, SH = 1.3;
      B.satin.span(C.wood, SX0, 0, SZ0, SX1, 0.06, SZ1);
      B.satin.span(C.wood, SX0, SH - 0.04, SZ0 - 0.02, SX1 + 0.02, SH, SZ1 + 0.02);
      B.matte.span(C.woodDark, SX0, 0, SZ0, SX0 + 0.02, SH, SZ1);
      for (const z of [SZ0, (SZ0 + SZ1) / 2, SZ1]) B.satin.span(C.wood, SX0, 0, z - 0.02, SX1, SH, z + 0.02);
      const shelves = [0.06, 0.48, 0.9];
      for (const y of shelves.slice(1)) B.satin.span(C.wood, SX0, y - 0.03, SZ0, SX1, y, SZ1);
      // mushafs: uniform green / maroon covers with a gold spine band, standing upright, spines facing the hall
      const step = low ? 0.1 : 0.065;
      let k = 0;
      for (const y of shelves) {
        for (let z = SZ0 + 0.08; z < SZ1 - 0.06; z += step) {
          if (Math.abs(z - (SZ0 + SZ1) / 2) < 0.06) continue;
          const col = (k++ % 7 === 3) ? '#6b1f2a' : C.green;
          B.matte.box(col, 0.24, 0.3, 0.05, X0 + 0.2, y + 0.15, z);
          B.metal.box(C.gold, 0.005, 0.04, 0.045, SX1 - 0.155 + 0.12, y + 0.24, z);
        }
      }
      solid(SX0, SZ0 - 0.05, SX1 + 0.08, SZ1 + 0.05);
      // low reading table with a rahl (folding book rest) and an open mushaf; two floor cushions
      const TX = -6.8, TZ = -5.0;
      B.satin.span(C.woodDark, TX - 0.35, 0.3, TZ - 0.3, TX + 0.35, 0.36, TZ + 0.3);
      for (const [dx, dz] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]]) B.satin.fbox(C.woodDark, 0.05, 0.3, 0.05, TX + dx, 0, TZ + dz);
      for (const s of [-1, 1]) B.satin.box(C.woodLight, 0.36, 0.02, 0.3, TX, 0.46, TZ + s * 0.09, 0, s * 0.75);   // rahl (X)
      for (const s of [-1, 1]) B.matte.box('#f4efe2', 0.16, 0.012, 0.22, TX + s * 0.08, 0.5, TZ, 0, 0, s * -0.25); // open pages
      B.matte.box(C.green, 0.34, 0.01, 0.24, TX, 0.493, TZ);
      for (const dz of [-0.75, 0.75]) B.matte.fbox('#2f5f6e', 0.55, 0.1, 0.5, TX, 0.003, TZ + dz);
      solid(TX - 0.38, TZ - 0.33, TX + 0.38, TZ + 0.33, 0.5);
      // two chairs at the back for those who cannot sit on the floor
      for (const z of [-0.6, 0.2]) {
        const cx = -7.4;
        B.satin.fbox('#6d747b', 0.44, 0.45, 0.44, cx, 0, z);
        B.satin.box('#3f6f8a', 0.44, 0.45, 0.05, cx - 0.2, 0.68, z, PI / 2);
        solid(cx - 0.24, z - 0.24, cx + 0.24, z + 0.24, 0.9);
      }
    }

    // ================================================================== PRAYER-TIMES BOARD (hall, east wall)
    // A physical board only; the live times come from the 'prayer' feature panel.
    {
      const BZ = -4.2, BY = 1.35, BW = 1.4, BH = 1.05, xf = X1 - 0.02;
      B.satin.box(C.walnut, 0.05, BH + 0.1, BW + 0.1, xf - 0.025, BY + BH / 2, BZ);
      B.matte.box(C.board, 0.02, BH, BW, xf - 0.06, BY + BH / 2, BZ);
      // clock face on top + five rows of amber "dot-matrix" bars (no baked text or numbers)
      B.glow.geo(new THREE.CircleGeometry(0.11, 20), '#f2e9d0', xf - 0.075, BY + BH - 0.16, BZ, -PI / 2);
      for (let i = 0; i < 5; i++) {
        const y = BY + 0.14 + i * 0.15;
        B.glow.quad(i === 2 ? C.led : C.ledDim, 0.42, 0.06, xf - 0.075, y, BZ - 0.32, -PI / 2);
        B.glow.quad(C.led, 0.36, 0.06, xf - 0.075, y, BZ + 0.36, -PI / 2);
      }
      if (typeof ctx.makeLabel === 'function') {
        const l = ctx.makeLabel({ ar: 'مواقيت الصلاة', en: 'Prayer times' }, { size: 0.2, background: 'rgba(22,58,51,0.85)', color: '#f3e3b0' });
        l.position.set(X1 - 0.12, BY + BH + 0.32, BZ);
        group.add(l);
      }
    }

    // ================================================================== IMAM'S OFFICE DOOR (hall, east wall)
    {
      const DZ0 = -1.4, DZ1 = -0.4, DH = 2.15;
      inFrame(WALLS.eh, () => {
        const u0 = DZ0 - ZN, u1 = DZ1 - ZN, uc = (u0 + u1) / 2;
        B.walls.quad(C.wood, u1 - u0, DH, uc, DH / 2, -0.04);
        for (const [pu, py, ph] of [[uc - 0.22, 1.55, 0.7], [uc + 0.22, 1.55, 0.7], [uc - 0.22, 0.55, 0.75], [uc + 0.22, 0.55, 0.75]]) B.walls.quad(C.walnut, 0.34, ph, pu, py, -0.035);
        B.walls.quad(C.trim, 0.08, DH + 0.08, u0 - 0.04, (DH + 0.08) / 2, 0.004);
        B.walls.quad(C.trim, 0.08, DH + 0.08, u1 + 0.04, (DH + 0.08) / 2, 0.004);
        B.walls.quad(C.trim, u1 - u0 + 0.16, 0.08, uc, DH + 0.04, 0.004);
        B.metal.sph(C.gold, 0.035, u0 + 0.12, 1.0, 0.0);
      }, [B.walls, B.metal]);
      if (typeof ctx.makeLabel === 'function') {
        const l = ctx.makeLabel({ ar: 'مكتب الإمام', en: "Imam's office" }, { size: 0.2, background: 'rgba(22,58,51,0.85)', color: '#f3e3b0' });
        l.position.set(X1 - 0.12, DH + 0.6, (DZ0 + DZ1) / 2);
        group.add(l);
      }
    }

    // ================================================================== SHOE RACKS (lobby side of the arcade)
    {
      const shoeCols = ['#2b2b2b', '#7a4e2e', '#f0f0f0', '#3a5f9a', '#5a4a3c', '#1d1f22', '#9e3b2b'];
      let k = 0;
      for (const [xa, xb] of [[-4.75, -2.25], [2.25, 4.75]]) {
        const z0 = ZA + 0.3, z1 = ZA + 0.68;
        for (const y of [0, 0.32, 0.64, 0.96]) B.satin.span(C.woodLight, xa, y, z0, xb, y + 0.035, z1);
        for (let x = xa; x <= xb + 1e-6; x += (xb - xa) / 5) B.satin.span(C.woodLight, x - 0.02, 0, z0, x + 0.02, 0.995, z1);
        for (const y of [0.035, 0.355, 0.675]) {
          for (let x = xa + 0.12; x < xb - 0.1; x += 0.25) {
            if ((k * 7) % 5 === 1) { k++; continue; }
            const col = shoeCols[k++ % shoeCols.length];
            B.matte.fbox(col, 0.08, 0.08, 0.26, x, y, (z0 + z1) / 2);
            B.matte.fbox(col, 0.08, 0.08, 0.26, x + 0.1, y, (z0 + z1) / 2);
          }
        }
        solid(xa - 0.03, z0 - 0.03, xb + 0.03, z1 + 0.03);
      }
      if (typeof ctx.makeLabel === 'function') {
        const l = ctx.makeLabel({ ar: 'تُخلع الأحذية هنا', en: 'Shoes off here' }, { size: 0.17, background: 'rgba(22,58,51,0.8)', color: '#f3e3b0' });
        l.position.set(-3.5, 1.35, ZA + 0.5);
        group.add(l);
      }
    }

    // ================================================================== WUDU AREA (lobby, east)
    {
      const WZ0 = 3.9, WZ1 = 8.2, xw = X1;
      // tiled splash wall (on the east wall, facing west) + privacy screen
      B.satin.span(C.tile, xw - 0.03, 0, WZ0, xw - 0.005, 1.5, WZ1);
      for (let z = WZ0 + 0.3; z < WZ1; z += 0.3) B.satin.span(C.tileDark, xw - 0.035, 0, z - 0.006, xw - 0.03, 1.5, z + 0.006);
      for (let y = 0.3; y < 1.5; y += 0.3) B.satin.span(C.tileDark, xw - 0.035, y - 0.006, WZ0, xw - 0.03, y + 0.006, WZ1);
      B.satin.span(C.tileDark, 5.9, 0, WZ0 - 0.32, X1, 1.2, WZ0 - 0.2);
      B.satin.span(C.stoneDark, 5.9, 1.2, WZ0 - 0.34, X1, 1.25, WZ0 - 0.18);
      solid(5.9, WZ0 - 0.34, X1, WZ0 - 0.18);
      // drain basin + taps + stone stools
      B.satin.span(C.stoneDark, xw - 0.6, 0, WZ0, xw, 0.18, WZ1);
      B.matte.span('#5d6a70', xw - 0.5, 0.18, WZ0 + 0.08, xw - 0.1, 0.185, WZ1 - 0.08);
      for (let z = WZ0 + 0.45; z < WZ1 - 0.2; z += 0.85) {
        B.metal.box(C.chrome, 0.2, 0.035, 0.035, xw - 0.1, 0.9, z);
        B.metal.fcyl(C.chrome, 0.02, 0.02, 0.06, xw - 0.18, 0.84, z, 6);
        B.metal.box(C.chrome, 0.06, 0.02, 0.06, xw - 0.06, 0.95, z);
        B.matte.fcyl(C.stone, 0.17, 0.19, 0.4, xw - 1.0, 0, z, 10);
      }
      solid(xw - 1.2, WZ0, xw, WZ1);
      if (typeof ctx.makeLabel === 'function') {
        const l = ctx.makeLabel({ ar: 'مكان الوضوء', en: 'Wudu area' }, { size: 0.2, background: 'rgba(22,58,51,0.85)', color: '#f3e3b0' });
        l.position.set(X1 - 0.3, 2.35, (WZ0 + WZ1) / 2);
        group.add(l);
      }
    }

    // ================================================================== LIBRARY / READING CORNER (lobby, west)
    const readerChair = [-6.2, 0, 7.05];
    {
      // tall bookshelf along the west wall
      const LZ0 = 2.2, LZ1 = 4.6, LH = 2.0, LX1 = X0 + 0.42;
      B.satin.span(C.wood, X0, 0, LZ0 - 0.03, LX1, LH, LZ0 + 0.03);
      B.satin.span(C.wood, X0, 0, LZ1 - 0.03, LX1, LH, LZ1 + 0.03);
      B.matte.span(C.woodDark, X0, 0, LZ0, X0 + 0.02, LH, LZ1);
      const rows = [0.05, 0.45, 0.85, 1.25, 1.65];
      for (const y of rows) B.satin.span(C.wood, X0, y - 0.03, LZ0, LX1, y, LZ1);
      B.satin.span(C.wood, X0, LH - 0.04, LZ0, LX1, LH, LZ1);
      const r = (ctx.rand || ((s) => { let v = s; return () => ((v = (v * 1664525 + 1013904223) >>> 0) / 4294967296); }))(42);
      const spines = ['#1f4d44', '#6b1f2a', '#2f4f7a', '#8a6a3a', '#3c3c3c', '#7a5538', '#406a52', '#a0522d'];
      for (const y of rows.slice(0, low ? 3 : 5)) {
        let z = LZ0 + 0.05;
        while (z < LZ1 - 0.08) {
          const t = 0.035 + r() * 0.04, h = 0.24 + r() * 0.1;
          if (r() < 0.06) { z += 0.12; continue; }
          B.matte.box(spines[Math.floor(r() * spines.length)], 0.26, h, t, X0 + 0.2, y + h / 2, z + t / 2);
          z += t + 0.004;
        }
      }
      solid(X0, LZ0 - 0.05, LX1 + 0.06, LZ1 + 0.05);
      // rug, reading table, two chairs, a floor lamp
      B.matte.span('#5b6b4a', -7.6, 0, 5.0, -4.7, 0.008, 8.2);
      B.matte.span('#c9b27a', -7.45, 0.008, 5.15, -4.85, 0.01, 8.05);
      B.matte.span('#5b6b4a', -7.3, 0.01, 5.3, -5.0, 0.012, 7.9);
      const TX = -6.2, TZ = 6.35;
      B.satin.span(C.woodLight, TX - 0.65, 0.72, TZ - 0.38, TX + 0.65, 0.76, TZ + 0.38);
      for (const [dx, dz] of [[-0.58, -0.32], [0.58, -0.32], [-0.58, 0.32], [0.58, 0.32]]) B.satin.fbox(C.woodDark, 0.05, 0.72, 0.05, TX + dx, 0, TZ + dz);
      B.matte.box('#2f4f7a', 0.22, 0.03, 0.3, TX - 0.25, 0.775, TZ + 0.05, 0.2);
      B.matte.box('#f4efe2', 0.3, 0.015, 0.22, TX + 0.05, 0.772, TZ + 0.2, -0.1);
      solid(TX - 0.68, TZ - 0.4, TX + 0.68, TZ + 0.4, 0.9);
      const chair = (cx, cz, back) => {   // back: +1 -> backrest toward +Z
        B.satin.span(C.woodDark, cx - 0.22, 0.43, cz - 0.22, cx + 0.22, 0.47, cz + 0.22);
        for (const [dx, dz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) B.satin.fbox(C.woodDark, 0.04, 0.43, 0.04, cx + dx, 0, cz + dz);
        B.satin.span(C.woodDark, cx - 0.22, 0.47, cz + back * 0.2, cx + 0.22, 0.95, cz + back * 0.23);
        solid(cx - 0.24, cz - 0.24, cx + 0.24, cz + 0.24, 0.9);
      };
      chair(readerChair[0], readerChair[2], 1);
      chair(TX, TZ - 0.72, -1);
      B.metal.fcyl(C.black, 0.14, 0.16, 0.03, -4.95, 0, 7.75, 10);
      B.metal.fcyl(C.black, 0.015, 0.015, 1.5, -4.95, 0.03, 7.75, 6);
      B.glow.fcyl('#ffe2b0', 0.13, 0.19, 0.24, -4.95, 1.5, 7.75, 12);
      solid(-5.12, 7.58, -4.78, 7.92);
      if (typeof ctx.makeLabel === 'function') {
        const l = ctx.makeLabel({ ar: 'ركن القراءة', en: 'Reading corner' }, { size: 0.2, background: 'rgba(22,58,51,0.85)', color: '#f3e3b0' });
        l.position.set(X0 + 0.25, 2.3, 3.4);
        group.add(l);
      }
    }

    // ================================================================== ENTRANCE (south wall): double doors = exit to town
    inFrame(WALLS.s, () => {
      const u0 = 7.2, u1 = 8.8, uc = 8.0, DH = 2.3;
      for (const s of [-1, 1]) {
        const c = uc + s * 0.4;
        B.walls.quad(C.walnut, 0.78, DH, c, DH / 2, -0.04);
        B.walls.quad(C.window, 0.42, 1.0, c, 1.45, -0.035);
        }
      B.walls.quad(C.trim, 0.1, DH + 0.1, u0 - 0.05, (DH + 0.1) / 2, 0.004);
      B.walls.quad(C.trim, 0.1, DH + 0.1, u1 + 0.05, (DH + 0.1) / 2, 0.004);
      B.walls.quad(C.trim, u1 - u0 + 0.2, 0.1, uc, DH + 0.05, 0.004);
      // notice board (one-sided quads only: nothing floats when the camera looks through this wall)
      B.walls.quad('#c9b89a', 1.1, 0.75, 10.0, 1.5, 0.006);
      B.walls.quad(C.walnut, 1.18, 0.83, 10.0, 1.5, 0.003);
    }, [B.walls]);

    // ================================================================== OUTSIDE (snowy lot, minaret)
    const ground = new THREE.Mesh(own(new THREE.PlaneGeometry(70, 70)), mat.snowGround);
    ground.rotation.x = -PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; ground.name = 'mosque:snow';
    group.add(ground);
    {
      const MX = 10.2, MZ = -9.6;
      B.outside.fcyl(C.minaret, 1.0, 1.15, 0.6, MX, 0, MZ, 8);
      B.outside.fcyl(C.minaret, 0.75, 0.85, 9.4, MX, 0.6, MZ, 8);
      B.outside.fcyl(C.stoneDark, 1.15, 0.95, 0.35, MX, 8.6, MZ, 8);
      B.outside.fcyl(C.minaret, 0.6, 0.6, 1.6, MX, 8.95, MZ, 8);
      B.outside.fcyl(C.green, 0, 0.75, 1.6, MX, 10.55, MZ, 8);
      B.outside.sph(C.gold, 0.12, MX, 12.25, MZ);
      for (let y = 2.5; y < 8; y += 2.2) B.outside.fcyl(C.stoneDark, 0.88, 0.88, 0.12, MX, y, MZ, 8);
      if (!low) {
        const pine = (x, z, s) => {
          B.outside.fcyl(C.bark, 0.08 * s, 0.1 * s, 0.6 * s, x, 0, z, 6);
          for (let i = 0; i < 3; i++) {
            const y = (0.5 + i * 0.7) * s, rr = (1.1 - i * 0.28) * s;
            B.outside.fcyl(C.pine, 0, rr, 1.2 * s, x, y, z, 7);
            B.outside.fcyl(C.snow, 0, rr * 0.55, 0.55 * s, x, y + 0.66 * s, z, 7);
          }
        };
        for (const [x, z, s] of [[-11, -6, 1.4], [-12, 4, 1.2], [11.5, 3, 1.3], [12, 10, 1.5], [-10.5, 12, 1.3], [5, -13, 1.6], [-6, -13, 1.4]]) pine(x, z, s);
      }
      // shovelled path out of the entrance
      B.outside.span('#b8b4ac', -1.2, -0.01, ZS + 0.3, 1.2, 0.0, ZS + 9);
    }

    // ------------------------------------------------------------------ build batches
    const add = (m) => { if (m) { own(m.geometry); group.add(m); } return m; };
    add(B.walls.build(mat.walls, { cast: false, receive: true }));
    add(B.matte.build(mat.matte));
    add(B.satin.build(mat.satin));
    add(B.metal.build(mat.metal));
    add(B.glow.build(mat.glow, { cast: false, receive: false }));
    const glassMesh = add(B.glass.build(mat.glass, { cast: false, receive: false }));
    if (glassMesh) glassMesh.renderOrder = 2;
    const nicheMesh = add(B.niche.build(tmat.niche, { cast: false, receive: true }));
    if (nicheMesh) nicheMesh.userData.noCameraCollide = true;
    if (tmat.calli) add(B.calli.build(tmat.calli, { cast: false, receive: true }));
    add(B.outside.build(mat.matte));

    // ------------------------------------------------------------------ lights (no shadows; ≤ 3)
    const hallLight = new THREE.PointLight('#fff1d6', 2.4, 13, 2);
    hallLight.position.set(0, 3.4, -3.5);
    const mihrabLight = new THREE.PointLight('#ffd9a0', 1.1, 4.5, 2);
    mihrabLight.position.set(0, 2.2, ZN + 1.2);
    const lobbyLight = new THREE.PointLight('#fff4e0', 1.8, 10, 2);
    lobbyLight.position.set(0, 2.6, 5.2);
    group.add(hallLight, mihrabLight, lobbyLight);

    // ------------------------------------------------------------------ NPCs (no worship poses)
    const yawTo = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));
    const imamPos = [6.95, 0, 0.55];
    const npcs = [
      { id: 'imam', name: { ar: 'الإمام', en: 'Imam' }, position: imamPos, yaw: yawTo([imamPos[0], imamPos[2]], [3.5, 3.0]),
        look: { sex: 'male', skin: '#a8754f', hair: '#1a1410', beard: '#2a2018', beardStyle: 'full', kufi: '#f4f1ea', shirt: '#f1ede4', pants: '#e9e4d8', shoes: '#3a2a20', height: 1.78 } },
      { id: 'bg_reader', position: readerChair, yaw: 0, pose: 'sit', sitArms: 'desk', collide: false,
        look: { sex: 'male', skin: '#6b4a32', hair: '#20160f', beard: '#20160f', beardStyle: 'short', shirt: '#4a5d6e', pants: '#2f3542', height: 1.76 } }
    ];

    return {
      group,
      spawn: { position: [0, 0, 6.3], yaw: 0 },
      colliders,
      hotspots: [],
      featureSpots: FEATURE_SPOTS,
      npcs,
      exit: { position: [0, 0, 8.4], radius: 1.3 },
      lights: 'day',
      environment: { hdri: 'ballroom', intensity: 0.45 },

      dispose() {
        for (const d of disposables) d?.dispose?.();
        disposables.length = 0;
      }
    };
  }
};
