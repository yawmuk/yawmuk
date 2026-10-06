// «يومك» — ISLAMIC BANK branch (a free-to-visit place reached from the town hub; no situations / no script).
// One open lobby: teller counter with glass screens along the back wall, two finance-advisor desks (west),
// an «اسأل أهل العلم» question kiosk with a small library (east), a waiting area, ATM and the street door (south).
// Procedural low-poly geometry merged into a handful of vertex-coloured meshes (./bank/batch.js), like home.js.
// Walls are one-sided inward-facing planes ("dollhouse") so the third-person camera always sees inside;
// wall colliders are 1.1 m tall so camera collision never yanks the camera into Adam's face.
// Interactables are declared as static featureSpots (engine opens src/features/<feature>/index.js).
import { createBatcher } from './bank/batch.js';

const W = 16, D = 12, H = 3.4;               // room: x -8..8, z -6..6
const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
const PI = Math.PI;

const C = {
  wall: '#efe9dd', wallAccent: '#0f6b62', cap: '#d9d0bd', base: '#3f4a48', trim: '#f4efe4',
  stone1: '#e7e1d4', stone2: '#d6cdb9', runner: '#0f5a53', runnerEdge: '#c9a24a',
  walnut: '#5e4130', walnutDark: '#4a3326', oak: '#b08257', counterTop: '#ece8de', gold: '#c9a24a', goldDark: '#9c7a2e',
  steel: '#b9bfc5', dark: '#22282a', screen: '#9fe3d6', screenWarm: '#ffe2a8', glow: '#fff4d6',
  fabric: '#2f6f68', fabricDark: '#245751', leaf: '#4f7f4a', leaf2: '#6a9a55', pot: '#b8693f',
  book1: '#7a2e2e', book2: '#2e4a7a', book3: '#2f6b4a', book4: '#b58a3a', book5: '#5a3a6a',
  sidewalk: '#bdbab3', street: '#55595e'
};

const ADVISOR_DESK = [-5.6, -0.6];   // desk centre (x, z); advisor sits west of it, clients east
const SECOND_DESK = [-5.6, 2.4];
const KIOSK = [5.3, -0.4];

export default {
  id: 'bank',
  title: { ar: 'البنك الإسلامي', en: 'Islamic bank' },

  // Contract: the engine wires each spot -> import('../features/<feature>/index.js').open({ lang, onClose })
  featureSpots: [
    { feature: 'bank', pos: [-3.9, 0.8, ADVISOR_DESK[1]], radius: 1.6, label: { ar: 'مستشار التمويل الإسلامي', en: 'Islamic finance advisor' } },
    { feature: 'experts', pos: [4.1, 0.8, KIOSK[1]], radius: 1.6, label: { ar: 'اسأل أهل العلم', en: 'Ask a scholar' } }
  ],

  build(ctx) {
    const THREE = ctx.THREE;
    const group = ctx.group || new THREE.Group();
    group.name = 'bank';
    const low = ctx.quality === 'low';
    const disposables = [];
    const own = (x) => { disposables.push(x); return x; };
    const makeBatch = createBatcher(THREE);

    const mat = {
      matte: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })),
      satin: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, flatShading: true })),
      floor: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.05 })),
      metal: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.7, flatShading: true })),
      walls: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, emissive: '#5a5246', emissiveIntensity: 0.5 })),
      glow: own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
      glass: own(new THREE.MeshBasicMaterial({ color: '#d8eef0', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })),
      outside: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
    };
    const B = {
      walls: makeBatch('walls'), matte: makeBatch('matte'), satin: makeBatch('satin'), floor: makeBatch('floor'),
      metal: makeBatch('metal'), glow: makeBatch('glow'), glass: makeBatch('glass'), outside: makeBatch('outside')
    };
    const colliders = [];
    const solid = (x0, z0, x1, z1, h = 1.1) => colliders.push({ min: [Math.min(x0, x1), 0, Math.min(z0, z1)], max: [Math.max(x0, x1), Math.min(h, 1.1), Math.max(z0, z1)] });

    // ================================================================== FLOOR: polished two-tone stone + teal runner
    const TILE = 1;
    for (let x = X0; x < X1; x += TILE) for (let z = Z0; z < Z1; z += TILE) {
      const odd = (Math.round(x - X0) + Math.round(z - Z0)) % 2;
      B.floor.quad(odd ? C.stone2 : C.stone1, TILE, TILE, x + TILE / 2, 0, z + TILE / 2, 0, -PI / 2);
    }
    B.floor.quad(C.runnerEdge, 1.9, 8.6, 0, 0.004, 1.3, 0, -PI / 2);
    B.floor.quad(C.runner, 1.7, 8.4, 0, 0.006, 1.3, 0, -PI / 2);
    // eight-point star inlay at the centre of the lobby
    for (const r of [0, PI / 4]) B.floor.quad(C.gold, 1.1, 1.1, 0, 0.008, 1.3, r, -PI / 2);
    B.floor.quad(C.runner, 0.6, 0.6, 0, 0.01, 1.3, PI / 8, -PI / 2);

    // ================================================================== WALLS (one-sided, inward)
    const WALLS = {
      n: { o: [X0, Z0], ry: 0, len: W, holes: [] },
      s: { o: [X1, Z1], ry: PI, len: W, holes: [{ a0: 7, a1: 9, y0: 0, y1: 2.5, door: true }] },        // door x -1..1
      w: { o: [X0, Z1], ry: PI / 2, len: D, holes: [{ a0: 6.2, a1: 7.8, y0: 1.3, y1: 2.7 }, { a0: 9.6, a1: 11.2, y0: 1.3, y1: 2.7 }] },
      e: { o: [X1, Z0], ry: -PI / 2, len: D, holes: [{ a0: 7.8, a1: 9.6, y0: 1.2, y1: 2.7 }] }
    };
    const inFrame = (wd, fn, batches) => { for (const b of batches) b.push(wd.o[0], 0, wd.o[1], wd.ry); fn(); for (const b of batches) b.pop(); };
    for (const wd of Object.values(WALLS)) {
      inFrame(wd, () => {
        const rect = (u0, u1, y0, y1, col = C.wall) => { if (u1 - u0 > 1e-3 && y1 - y0 > 1e-3) B.walls.quad(col, u1 - u0, y1 - y0, (u0 + u1) / 2, (y0 + y1) / 2, 0); };
        let cur = 0;
        for (const h of [...wd.holes].sort((a, b) => a.a0 - b.a0)) {
          rect(cur, h.a0, 0, H); rect(h.a0, h.a1, 0, h.y0); rect(h.a0, h.a1, h.y1, H);
          cur = h.a1;
        }
        rect(cur, wd.len, 0, H);
        if (wd !== WALLS.s) B.walls.quad(C.cap, wd.len + 0.3, 0.15, wd.len / 2, H, -0.075, 0, -PI / 2);
        // teal wainscot band + dark skirting (skip door gaps)
        let bc = 0;
        for (const h of wd.holes.filter((x) => x.y0 < 0.1)) { if (h.a0 > bc) { B.walls.box(C.base, h.a0 - bc, 0.12, 0.02, (bc + h.a0) / 2, 0.06, 0.01); B.walls.box(C.wallAccent, h.a0 - bc, 0.06, 0.02, (bc + h.a0) / 2, 1.0, 0.01); } bc = h.a1; }
        if (bc < wd.len) { B.walls.box(C.base, wd.len - bc, 0.12, 0.02, (bc + wd.len) / 2, 0.06, 0.01); B.walls.box(C.wallAccent, wd.len - bc, 0.06, 0.02, (bc + wd.len) / 2, 1.0, 0.01); }
        for (const h of wd.holes) {
          const uc = (h.a0 + h.a1) / 2, yc = (h.y0 + h.y1) / 2, w = h.a1 - h.a0, hh = h.y1 - h.y0;
          if (h.door) {
            B.satin.box(C.walnut, 0.12, hh + 0.12, 0.22, h.a0 - 0.06, yc + 0.06, 0);
            B.satin.box(C.walnut, 0.12, hh + 0.12, 0.22, h.a1 + 0.06, yc + 0.06, 0);
            B.satin.box(C.walnut, w + 0.24, 0.12, 0.22, uc, h.y1 + 0.06, 0);
            continue;
          }
          // arched-look window: frame + pointed top made of two tilted bars
          B.satin.box(C.trim, 0.08, hh + 0.12, 0.18, h.a0 - 0.04, yc, 0);
          B.satin.box(C.trim, 0.08, hh + 0.12, 0.18, h.a1 + 0.04, yc, 0);
          B.satin.box(C.trim, w + 0.24, 0.05, 0.26, uc, h.y0 - 0.02, 0.04);
          B.satin.box(C.trim, w, 0.06, 0.18, uc, h.y1 + 0.03, 0);
          B.satin.box(C.trim, 0.04, hh, 0.05, uc, yc, 0);
          B.glass.quad('#ffffff', w, hh, uc, yc, -0.01);
        }
      }, [B.walls, B.satin, B.glass]);
    }
    solid(X0 - 0.3, Z0 - 0.3, X1 + 0.3, Z0);
    solid(X0 - 0.3, Z0 - 0.3, X0, Z1 + 0.3);
    solid(X1, Z0 - 0.3, X1 + 0.3, Z1 + 0.3);
    solid(X0 - 0.3, Z1, -1.0, Z1 + 0.3);           // south wall left of the door
    solid(1.0, Z1, X1 + 0.3, Z1 + 0.3);            // south wall right of the door

    // glass entrance doors standing open + outside sidewalk / street (seen through the door)
    B.glass.quad('#ffffff', 0.95, 2.4, -1.0, 1.2, Z1 - 0.5, PI / 2);
    B.glass.quad('#ffffff', 0.95, 2.4, 1.0, 1.2, Z1 - 0.5, -PI / 2);
    B.metal.box(C.steel, 0.04, 2.4, 0.04, -1.0, 1.2, Z1 - 0.98);
    B.metal.box(C.steel, 0.04, 2.4, 0.04, 1.0, 1.2, Z1 - 0.98);
    B.outside.quad(C.sidewalk, 10, 3, 0, -0.01, Z1 + 1.5, 0, -PI / 2);
    B.outside.quad(C.street, 14, 5, 0, -0.02, Z1 + 5.5, 0, -PI / 2);
    B.floor.quad(C.dark, 1.8, 1.0, 0, 0.006, Z1 - 0.55, 0, -PI / 2);      // door mat

    // ================================================================== BACK WALL: sign panel + geometric band
    B.satin.box(C.wallAccent, 6.4, 1.0, 0.06, 0, 2.75, Z0 + 0.04);
    B.metal.box(C.gold, 6.6, 0.05, 0.08, 0, 3.27, Z0 + 0.05);
    B.metal.box(C.gold, 6.6, 0.05, 0.08, 0, 2.23, Z0 + 0.05);
    if (!low) {
      for (let x = -7.2; x <= 7.21; x += 0.8) {
        if (Math.abs(x) < 3.5) continue;
        for (const r of [0, PI / 4]) B.metal.box(C.gold, 0.32, 0.32, 0.03, x, 2.9, Z0 + 0.03, 0, 0, r);
        B.satin.box(C.wallAccent, 0.14, 0.14, 0.04, x, 2.9, Z0 + 0.04, 0, 0, PI / 8);
      }
    }
    const sign = ctx.makeLabel({ ar: 'المصرف الإسلامي', en: 'Islamic Bank' }, { size: 0.5, color: '#fff7e0', background: false });
    sign.position.set(0, 2.75, Z0 + 0.25);
    group.add(sign);

    // ================================================================== TELLER COUNTER (z ≈ -3.8)
    const CZ = -3.8, CX0 = -5.6, CX1 = 5.6;
    B.matte.fbox(C.walnut, CX1 - CX0, 1.02, 0.7, 0, 0, CZ);
    B.satin.fbox(C.counterTop, CX1 - CX0 + 0.2, 0.05, 0.85, 0, 1.02, CZ);
    B.metal.box(C.gold, CX1 - CX0, 0.04, 0.02, 0, 0.85, CZ + 0.36);
    B.metal.box(C.gold, CX1 - CX0, 0.04, 0.02, 0, 0.15, CZ + 0.36);
    for (let x = CX0 + 0.7; x < CX1; x += 1.4) B.matte.box(C.walnutDark, 0.9, 0.5, 0.02, x, 0.5, CZ + 0.36);
    // glass screens with steel posts; 4 windows
    B.glass.quad('#ffffff', CX1 - CX0, 0.95, 0, 1.55, CZ - 0.1);
    const winX = [-4.2, -1.4, 1.4, 4.2];
    for (const x of [CX0, -2.8, 0, 2.8, CX1]) B.metal.box(C.steel, 0.05, 1.0, 0.05, x, 1.55, CZ - 0.1);
    B.metal.box(C.steel, CX1 - CX0, 0.05, 0.06, 0, 2.05, CZ - 0.1);
    winX.forEach((x, i) => {
      B.glow.box(i === 1 ? C.screenWarm : C.screen, 0.5, 0.2, 0.04, x, 2.25, CZ - 0.1);   // window number display
      B.satin.box(C.dark, 0.36, 0.26, 0.03, x + 0.35, 1.2, CZ - 0.2, 0, -0.35);               // teller monitor
      B.glow.box(C.screen, 0.32, 0.22, 0.01, x + 0.35, 1.2, CZ - 0.18, 0, -0.35);
    });
    if (!low) winX.forEach((x, i) => { const n = ctx.makeLabel(String(i + 1), { size: 0.16, color: '#0b3b36', background: false }); n.position.set(x, 2.25, CZ + 0.02); group.add(n); });
    // end gates closing the staff area
    B.matte.fbox(C.walnut, X1 - CX1, 1.0, 0.08, (X1 + CX1) / 2, 0, CZ - 0.3);
    B.matte.fbox(C.walnut, CX0 - X0, 1.0, 0.08, (X0 + CX0) / 2, 0, CZ - 0.3);
    solid(CX0 - 0.1, CZ - 0.4, CX1 + 0.1, CZ + 0.45);
    solid(X0, CZ - 0.4, CX0, CZ - 0.2);
    solid(CX1, CZ - 0.4, X1, CZ - 0.2);
    // staff back cabinets
    B.matte.fbox(C.oak, 10, 0.9, 0.5, 0, 0, Z0 + 0.3);
    B.satin.fbox(C.counterTop, 10.1, 0.04, 0.55, 0, 0.9, Z0 + 0.3);

    // queue stanchions in front of the counter
    for (const [x, z] of [[-0.8, -2.6], [-0.8, -1.2], [0.8, -2.6], [0.8, -1.2]]) {
      B.metal.fcyl(C.gold, 0.035, 0.035, 0.95, x, 0, z, 8);
      B.metal.fcyl(C.goldDark, 0.16, 0.18, 0.04, x, 0, z, 12);
    }
    for (const x of [-0.8, 0.8]) B.satin.box(C.runner, 0.04, 0.05, 1.4, x, 0.88, -1.9);
    solid(-0.85, -2.65, -0.75, -1.15); solid(0.75, -2.65, 0.85, -1.15);

    // ================================================================== ADVISOR DESKS (west)
    const desk = ([dx, dz]) => {
      B.matte.fbox(C.walnut, 0.85, 0.72, 1.7, dx, 0, dz);
      B.satin.fbox(C.oak, 0.95, 0.04, 1.8, dx, 0.72, dz);
      B.satin.box(C.dark, 0.06, 0.34, 0.55, dx - 0.25, 0.97, dz);                // monitor (faces the advisor)
      B.glow.box(C.screen, 0.01, 0.3, 0.5, dx - 0.285, 0.97, dz);
      B.satin.fbox(C.dark, 0.18, 0.05, 0.1, dx - 0.22, 0.76, dz);
      B.matte.box('#f3f0e8', 0.22, 0.01, 0.3, dx + 0.15, 0.77, dz - 0.4);           // papers
      B.metal.fcyl(C.gold, 0.03, 0.03, 0.12, dx + 0.3, 0.76, dz + 0.55, 8);         // pen cup
      // advisor chair (west) + two client chairs (east)
      chair(dx - 0.95, dz, -PI / 2, C.dark);
      chair(dx + 0.85, dz - 0.45, PI / 2, C.fabric);
      chair(dx + 0.85, dz + 0.45, PI / 2, C.fabric);
      solid(dx - 0.5, dz - 0.9, dx + 0.5, dz + 0.9);
      solid(dx - 1.25, dz - 0.3, dx - 0.65, dz + 0.3);
      solid(dx + 0.62, dz - 0.72, dx + 1.08, dz + 0.72);
    };
    // chair facing yaw (0 = -Z): seat + back on the far side from where it faces
    function chair(x, z, yaw, col) {
      B.matte.push(x, 0, z, yaw);
      B.matte.fbox(col, 0.48, 0.08, 0.46, 0, 0.42, 0);
      B.matte.fbox(col, 0.48, 0.5, 0.07, 0, 0.5, 0.22);
      for (const [a, b] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) B.matte.fbox(C.dark, 0.04, 0.42, 0.04, a, 0, b);
      B.matte.pop();
    }
    desk(ADVISOR_DESK);
    desk(SECOND_DESK);
    // privacy screen between the desks + nameplate sign
    B.glass.quad('#ffffff', 2.8, 1.3, -6.6, 0.65 + 0.4, 0.9, 0);
    B.metal.box(C.steel, 2.8, 0.04, 0.04, -6.6, 1.72, 0.9);
    solid(-8, 0.86, -5.2, 0.94);
    B.satin.box(C.wallAccent, 0.04, 0.6, 2.6, X0 + 0.03, 2.35, ADVISOR_DESK[1] + 1.5);
    const advSign = ctx.makeLabel({ ar: 'التمويل الإسلامي', en: 'Islamic finance' }, { size: 0.26, color: '#fff7e0', background: false });
    advSign.position.set(X0 + 0.2, 2.35, ADVISOR_DESK[1] + 1.5);
    group.add(advSign);

    // ================================================================== ASK-A-SCHOLAR KIOSK + library (east)
    const [kx, kz] = KIOSK;
    B.matte.fbox(C.walnut, 0.6, 0.9, 0.5, kx, 0, kz);
    B.satin.box(C.dark, 0.08, 0.62, 0.78, kx - 0.1, 1.2, kz, 0, 0, -0.35);
    B.glow.box(C.screenWarm, 0.01, 0.54, 0.7, kx - 0.15, 1.2, kz, 0, 0, -0.35);
    B.metal.box(C.gold, 0.62, 0.04, 0.52, kx, 0.9, kz);
    solid(kx - 0.35, kz - 0.45, kx + 0.35, kz + 0.45);
    // library behind the kiosk
    const LX = X1 - 0.22, LZ = kz;
    B.matte.fbox(C.walnut, 0.05, 2.2, 2.6, X1 - 0.03, 0, LZ);                                   // back panel
    for (const dz of [-1.28, 1.28]) B.matte.fbox(C.walnut, 0.4, 2.2, 0.05, LX, 0, LZ + dz);        // sides
    B.matte.fbox(C.walnut, 0.42, 0.05, 2.62, LX, 2.2, LZ);                                      // top
    const books = [C.book1, C.book2, C.book3, C.book4, C.book5];
    const rnd = (ctx.rand ? ctx.rand(7) : (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })());
    for (let shelf = 0; shelf < 4; shelf++) {
      const y = 0.15 + shelf * 0.52;
      B.matte.fbox(C.walnutDark, 0.38, 0.03, 2.5, LX - 0.01, y, LZ);
      if (low && shelf % 2) continue;
      let z = LZ - 1.18;
      while (z < LZ + 1.15) {
        const w = 0.05 + rnd() * 0.05, h = 0.3 + rnd() * 0.12;
        B.matte.fbox(books[Math.floor(rnd() * books.length)], 0.26, h, w, LX - 0.05, y + 0.03, z + w / 2);
        z += w + 0.005;
      }
    }
    solid(LX - 0.22, LZ - 1.3, X1, LZ + 1.3);
    B.satin.box(C.wallAccent, 0.04, 0.5, 2.4, X1 - 0.03, 2.6, LZ);
    const askSign = ctx.makeLabel({ ar: 'اسأل أهل العلم', en: 'Ask a scholar' }, { size: 0.24, color: '#fff7e0', background: false });
    askSign.position.set(X1 - 0.2, 2.6, LZ);
    group.add(askSign);

    // ================================================================== WAITING AREA (east-centre)
    const bench = (x, z) => {
      B.matte.fbox(C.fabric, 2.0, 0.12, 0.55, x, 0.32, z);
      B.matte.fbox(C.fabricDark, 2.0, 0.45, 0.1, x, 0.44, z + 0.25);
      for (const dx of [-0.9, 0.9]) B.metal.fbox(C.steel, 0.06, 0.32, 0.5, x + dx, 0, z);
      solid(x - 1.0, z - 0.3, x + 1.0, z + 0.32, 0.9);
    };
    bench(3.2, 1.6);
    bench(3.2, 3.4);
    B.satin.fcyl(C.oak, 0.35, 0.35, 0.04, 5.0, 0.45, 2.5, 14);                       // side table with brochures
    B.metal.fcyl(C.steel, 0.04, 0.04, 0.45, 5.0, 0, 2.5, 8);
    B.matte.box(C.runner, 0.2, 0.01, 0.28, 4.95, 0.5, 2.45, 0.3);
    B.matte.box(C.gold, 0.2, 0.01, 0.28, 5.1, 0.505, 2.6, -0.2);
    solid(4.65, 2.15, 5.35, 2.85, 0.6);
    // queue ticket machine near the door
    B.matte.fbox(C.wallAccent, 0.5, 1.3, 0.35, 2.4, 0, 4.6);
    B.glow.box(C.screen, 0.36, 0.26, 0.01, 2.4, 1.08, 4.42);
    solid(2.12, 4.4, 2.68, 4.8);
    // ATM on the south wall
    B.satin.fbox(C.dark, 0.85, 1.8, 0.5, 5.5, 0, Z1 - 0.28);
    B.glow.box(C.screen, 0.5, 0.36, 0.01, 5.5, 1.3, Z1 - 0.54, 0, 0.2);
    B.metal.box(C.steel, 0.6, 0.04, 0.2, 5.5, 1.0, Z1 - 0.6);
    solid(5.05, Z1 - 0.6, 5.95, Z1);

    // columns with gold capitals
    for (const [x, z] of [[-3.6, -2.4], [3.6, -2.4], [-3.6, 4.2], [3.6, 4.2]]) {
      B.satin.fcyl(C.trim, 0.24, 0.26, H - 0.2, x, 0, z, 12);
      B.metal.fcyl(C.gold, 0.32, 0.26, 0.18, x, H - 0.38, z, 12);
      B.matte.fcyl(C.base, 0.3, 0.3, 0.12, x, 0, z, 12);
      solid(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
    }
    // plants
    if (!low) {
      for (const [x, z] of [[-7.4, 5.3], [7.4, 5.3], [-7.4, -2.9], [7.3, 2.4]]) {
        B.matte.fcyl(C.pot, 0.22, 0.17, 0.42, x, 0, z, 10);
        B.matte.ico(C.leaf, 0.42, x, 0.95, z, 1, 1.3, 1);
        B.matte.ico(C.leaf2, 0.3, x + 0.12, 1.3, z - 0.05, 1, 1.2, 1, 0.6);
        solid(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
      }
    }
    // wall sconces (emissive; bloom on medium/high)
    for (const z of [-2.5, 2.5]) { B.glow.box(C.glow, 0.06, 0.4, 0.18, X0 + 0.04, 2.3, z); B.glow.box(C.glow, 0.06, 0.4, 0.18, X1 - 0.04, 2.3, z + (z > 0 ? 1.2 : 0)); }
    for (const x of [-5, 5]) B.glow.box(C.glow, 0.5, 0.06, 0.06, x, 2.95, Z0 + 0.04);

    // ================================================================== build meshes
    const add = (m, opts) => { if (m) { own(m.geometry); group.add(m); } return m; };
    add(B.floor.build(mat.floor, { cast: false }));
    add(B.walls.build(mat.walls, { cast: false }));
    add(B.matte.build(mat.matte));
    add(B.satin.build(mat.satin));
    add(B.metal.build(mat.metal));
    add(B.glow.build(mat.glow, { cast: false, receive: false }));
    add(B.outside.build(mat.outside, { cast: false }));
    const glass = add(B.glass.build(mat.glass, { cast: false, receive: false }));
    if (glass) { glass.userData.noCameraCollide = true; glass.renderOrder = 2; }

    // soft warm fill (no shadows; ≤ 3 lights per the budget)
    for (const [x, z] of [[-4.5, 0.8], [4.5, 0.8]]) {
      const l = new THREE.PointLight('#ffe6c2', 6, 9, 2);
      l.castShadow = false;
      l.position.set(x, 3.0, z);
      group.add(l);
    }

    // ================================================================== NPCs
    const npcs = [
      { id: 'bank_advisor', name: { ar: 'المستشارة هدى', en: 'Advisor Huda' }, position: [ADVISOR_DESK[0] - 0.95, 0, ADVISOR_DESK[1]], yaw: -PI / 2, pose: 'sit', sitArms: 'desk',
        look: { sex: 'female', skin: '#c68642', hijab: '#0f6b62', jacket: '#2b2f3a', dress: '#2b2f3a', glasses: true, height: 1.66 } },
      { id: 'bg_teller1', position: [winX[0], 0, CZ - 0.75], yaw: PI, look: { sex: 'male', skin: '#8d5524', shirt: '#f2f2f2', suit: '#1f2d4d', tie: '#0f6b62', beard: '#1d1410', height: 1.78 } },
      { id: 'bg_teller2', position: [winX[1], 0, CZ - 0.75], yaw: PI, look: { sex: 'female', skin: '#e0ac69', hijab: '#c9a24a', dress: '#1f2d4d', height: 1.64 } },
      { id: 'bg_teller3', position: [winX[3], 0, CZ - 0.75], yaw: PI, look: { sex: 'male', skin: '#f1c27d', shirt: '#f2f2f2', suit: '#3a3a3a', tie: '#7a2e2e', height: 1.8 } },
      { id: 'bg_customer1', position: [0, 0, -2.85], yaw: 0, look: { sex: 'male', skin: '#5a3a22', shirt: '#a83232', jacket: '#2f3542', height: 1.82 } },
      { id: 'bg_customer2', position: [2.7, 0, 1.6], yaw: 0, pose: 'sit', collide: false, look: { sex: 'female', skin: '#c68642', hijab: '#5b7b5a', dress: '#3b3b55', height: 1.66 } },
      { id: 'bg_advisor2', position: [SECOND_DESK[0] - 0.95, 0, SECOND_DESK[1]], yaw: -PI / 2, pose: 'sit', sitArms: 'desk', look: { sex: 'male', skin: '#e0ac69', suit: '#2b2f3a', tie: '#c9a24a', height: 1.76 } },
      { id: 'bg_client2', position: [SECOND_DESK[0] + 0.85, 0, SECOND_DESK[1] + 0.45], yaw: PI / 2, pose: 'sit', collide: false, look: { sex: 'male', skin: '#f1c27d', shirt: '#3a6ea5', pants: '#2f3542', height: 1.78 } }
    ];

    return {
      group,
      spawn: { position: [0, 0, 3.9], yaw: 0 },
      colliders,
      hotspots: [],
      npcs,
      exit: { position: [0, 0, 6.6], radius: 1.4 },
      lights: 'day',
      environment: { hdri: 'studio', intensity: 0.55 },
      sky: '#d9e4ea',
      dispose() {
        for (const d of disposables) d?.dispose?.();
        disposables.length = 0;
      }
    };
  }
};
