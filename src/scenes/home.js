// «يومك» — HOME (Monday 07:00): the ground floor of Adam's house in حيّ السلام.
// Open plan: kitchen (back-left), dining (centre), living room + reading nook (right), entry with the front
// door, mail table and stairs (front). Family books and photos on the shelf; the neighbour and friend Omar
// has dropped by for coffee.
// The house envelope (footprint, door, windows, colours) comes from ./home/layout.js and is shared with the
// town's exterior of this house, so the room is the same building Adam walked up to. Nothing outside the
// walls is built here: the engine surrounds the room with the real neighbourhood (town.js in backdrop mode).
// Static props are merged into a handful of vertex-coloured meshes (see ./home/batch.js).
//
// Closed ground-floor interior: double-sided walls and a solid roof keep the camera indoors.
// Low player colliders preserve the existing walkable layout; visual walls block the camera.
import { addInteriorRoof } from './interiorRoof.js';
import { createBatcher } from './home/batch.js';
import { HOUSE } from './home/layout.js';
import { woodFloor, subwayTile, livingRug, familyPhoto, starArt, laptopScreen } from './home/textures.js';

const W = HOUSE.w, D = HOUSE.d, H = HOUSE.h;   // room: x -6..6, z -4.5..4.5
const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
const PI = Math.PI;

// palette
const C = {
  wall: '#efe6d6', cap: '#d8ccb8', base: '#f8f4ec', trim: '#f7f3ea',
  cab: '#6b4a32', cabLine: '#523825', counter: '#d9d9d4', appliance: '#f1f1ee', steel: '#b9bfc5', darkSteel: '#6d747b',
  oak: '#b5875a', oakDark: '#8a6243', walnut: '#6e4b30', shelfWood: '#7a5538',
  sofa: '#6f8296', sofaDark: '#5d6f82', mustard: '#d9a441', terracotta: '#c46a4a', knit: '#cbb89a',
  leaf: '#4f7f4a', leaf2: '#6a9a55', leaf3: '#3e6b3d', pot: '#b8693f', potWhite: '#ecebe6', soil: '#4a3426',
  black: '#1d1f22', white: '#fafaf6', ceramic: '#e9e4da',
  door: HOUSE.colors.door, doorPanel: '#28505f',    // the same blue door as on the street side
  bark: '#5a4030'
};

export default {
  id: 'home',
  title: { ar: 'المنزل', en: 'Home' },

  build(ctx) {
    const THREE = ctx.THREE;
    const group = new THREE.Group();
    group.name = 'home';
    const disposables = [];
    const own = (x) => { disposables.push(x); return x; };
    const makeBatch = createBatcher(THREE);

    // ------------------------------------------------------------------ materials (all owned by this scene)
    // walls and floor: real PBR texture sets from the catalog (plaster, oak planks) lit by the sun + sky like
    // everything else — no emissive "fill" that flattens the room. Canvas fallbacks when the loader is missing.
    const hasPbr = typeof ctx.pbr === 'function';
    const mat = {
      matte: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true })),
      satin: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, flatShading: true })),
      metal: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.65, flatShading: true })),
      // warm-white painted plaster: flat vertex colour + the catalog plaster set's normal/roughness detail only
      // (its grey colour map would muddy the room); uv per quad = metres / 2 (tile 2 m)
      walls: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })),
      glow: own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
      glass: own(new THREE.MeshBasicMaterial({ color: '#dcebf7', transparent: true, opacity: 0.2, depthWrite: false })),
      curtain: own(new THREE.MeshStandardMaterial({ color: '#efe7d6', roughness: 1, side: THREE.DoubleSide })),
      steam: own(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }))
    };
    if (typeof ctx.loadTexture === 'function') {
      ctx.loadTexture('plaster', { repeat: [1, 1] }).then((maps) => {
        if (!maps) return;
        mat.walls.normalMap = maps.normalMap || null; mat.walls.roughnessMap = maps.roughnessMap || null;
        if (maps.normalMap) mat.walls.normalScale.set(0.6, 0.6);
        mat.walls.needsUpdate = true;
      }).catch(() => {});
    }
    const tex = {
      floor: hasPbr ? null : own(woodFloor(THREE)), tile: own(subwayTile(THREE)), rug: own(livingRug(THREE)),
      photo: own(familyPhoto(THREE)), art: own(starArt(THREE)), screen: own(laptopScreen(THREE))
    };
    if (tex.floor) tex.floor.repeat.set(W / 1.6, D / 1.6);
    const tmat = {
      floor: hasPbr ? ctx.pbr('wood_floor', { size: [W, D], roughness: 0.6 }) : own(new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.55 })),
      tile: own(new THREE.MeshStandardMaterial({ map: tex.tile, roughness: 0.3 })),
      rug: own(new THREE.MeshStandardMaterial({ map: tex.rug, roughness: 1 })),
      photo: own(new THREE.MeshStandardMaterial({ map: tex.photo, roughness: 0.5 })),
      art: own(new THREE.MeshStandardMaterial({ map: tex.art, roughness: 0.8 })),
      screen: own(new THREE.MeshBasicMaterial({ map: tex.screen, toneMapped: false }))
    };

    // ------------------------------------------------------------------ batches
    const B = {
      walls: makeBatch('walls'), matte: makeBatch('matte'), satin: makeBatch('satin'), metal: makeBatch('metal'),
      outside: makeBatch('outside'), glow: makeBatch('glow'), glass: makeBatch('glass'), tile: makeBatch('tile'), art: makeBatch('art'), photo: makeBatch('photo')
    };
    const colliders = [];
    const solid = (x0, z0, x1, z1, h = 1.1) => colliders.push({ min: [Math.min(x0, x1), 0, Math.min(z0, z1)], max: [Math.max(x0, x1), Math.min(h, 1.1), Math.max(z0, z1)] });

    // ================================================================== FLOOR
    const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(W, D)), tmat.floor);
    floor.rotation.x = -PI / 2;
    floor.receiveShadow = true;
    floor.name = 'home:floor';
    group.add(floor);

    // ================================================================== WALLS (one-sided, inward)
    // frame: origin + u*dir along the wall; local +z = inward normal. Openings come from the shared house layout
    // (home/layout.js) so they sit exactly where the town's exterior draws them.
    const hole = (c, w, y0, y1, toU, extra) => ({ a0: toU(c) - w / 2, a1: toU(c) + w / 2, y0, y1, ...extra });
    const WALLS = {
      n: { o: [X0, Z0], ry: 0, len: W, holes: HOUSE.back.map((w) => hole(w.x, w.w, w.y0, w.y1, (x) => x - X0)) },        // kitchen, dining, living windows
      s: { o: [X1, Z1], ry: PI, len: W, holes: [
        hole(HOUSE.door.x, HOUSE.door.w, 0, HOUSE.door.h, (x) => X1 - x, { door: true }),                                   // front door x 4..5
        ...HOUSE.front.map((w) => hole(w.x, w.w, w.y0, w.y1, (x) => X1 - x))                                                // street windows
      ] },
      w: { o: [X0, Z1], ry: PI / 2, len: D, holes: HOUSE.west.map((w) => hole(w.z, w.w, w.y0, w.y1, (z) => Z1 - z)) },
      e: { o: [X1, Z0], ry: -PI / 2, len: D, holes: HOUSE.east.map((w) => hole(w.z, w.w, w.y0, w.y1, (z) => z - Z0)) }
    };
    const inFrame = (wd, fn, batches) => {
      for (const b of batches) b.push(wd.o[0], 0, wd.o[1], wd.ry);
      fn();
      for (const b of batches) b.pop();
    };
    for (const wd of Object.values(WALLS)) {
      inFrame(wd, () => {
        // plaster quads carry metre-based uvs (2 m tile) so the texture is continuous across the pieces of a wall
        const rect = (u0, u1, y0, y1) => { if (u1 - u0 > 1e-3 && y1 - y0 > 1e-3) B.walls.quad(C.wall, u1 - u0, y1 - y0, (u0 + u1) / 2, (y0 + y1) / 2, 0, 0, 0, [(u1 - u0) / 2, (y1 - y0) / 2]); };
        let cur = 0;
        for (const h of [...wd.holes].sort((a, b) => a.a0 - b.a0)) {
          rect(cur, h.a0, 0, H);
          rect(h.a0, h.a1, 0, h.y0);
          rect(h.a0, h.a1, h.y1, H);
          cur = h.a1;
        }
        rect(cur, wd.len, 0, H);
        // top cap (dollhouse cut line), crown moulding + baseboard (satin: crisp painted trim, no plaster map)
        if (wd !== WALLS.s) B.satin.quad(C.cap, wd.len + 0.3, 0.15, wd.len / 2, H, -0.075, 0, -PI / 2);  // no cap on the camera side
        B.satin.box(C.trim, wd.len, 0.07, 0.04, wd.len / 2, H - 0.035, 0.03);                            // crown moulding
        let bc = 0;
        for (const h of wd.holes.filter((x) => x.y0 < 0.1)) { if (h.a0 > bc) B.satin.box(C.base, h.a0 - bc, 0.1, 0.02, (bc + h.a0) / 2, 0.05, 0.015); bc = h.a1; }
        if (bc < wd.len) B.satin.box(C.base, wd.len - bc, 0.1, 0.02, (bc + wd.len) / 2, 0.05, 0.015);
        // window frames + glass
        for (const h of wd.holes) {
          if (h.door) continue;
          const uc = (h.a0 + h.a1) / 2, yc = (h.y0 + h.y1) / 2, w = h.a1 - h.a0, hh = h.y1 - h.y0;
          B.satin.box(C.trim, 0.07, hh + 0.14, 0.18, h.a0 - 0.035, yc, 0);
          B.satin.box(C.trim, 0.07, hh + 0.14, 0.18, h.a1 + 0.035, yc, 0);
          B.satin.box(C.trim, w, 0.07, 0.18, uc, h.y1 + 0.035, 0);
          B.satin.box(C.trim, w + 0.24, 0.04, 0.26, uc, h.y0 - 0.02, 0.04);      // sill
          B.satin.box(C.trim, 0.035, hh, 0.05, uc, yc, 0);                       // mullions
          B.satin.box(C.trim, w, 0.035, 0.05, uc, h.y0 + hh * 0.62, 0);
          B.glass.quad('#ffffff', w, hh, uc, yc, -0.01);
        }
      }, [B.walls, B.satin, B.glass]);
    }
    // wall colliders (outside the inner faces); the closed front door is part of the south wall
    solid(X0 - 0.3, Z0 - 0.3, X1 + 0.3, Z0);
    solid(X0 - 0.3, Z1, X1 + 0.3, Z1 + 0.3);
    solid(X0 - 0.3, Z0 - 0.3, X0, Z1 + 0.3);
    solid(X1, Z0 - 0.3, X1 + 0.3, Z1 + 0.3);

    // front door (south wall, u 1..2 => x 5..4): the same blue door as outside — recessed slab + panels + trim,
    // all one-sided quads facing inward (they vanish when the camera is outside)
    inFrame(WALLS.s, () => {
      B.satin.quad(C.door, 1.0, 2.1, 1.5, 1.05, -0.04);
      for (const [pu, py, ph] of [[1.27, 1.55, 0.7], [1.73, 1.55, 0.7], [1.27, 0.55, 0.75], [1.73, 0.55, 0.75]]) B.satin.quad(C.doorPanel, 0.34, ph, pu, py, -0.035);
      B.satin.quad(C.trim, 0.08, 2.18, 0.96, 1.09, 0.004);
      B.satin.quad(C.trim, 0.08, 2.18, 2.04, 1.09, 0.004);
      B.satin.quad(C.trim, 1.16, 0.08, 1.5, 2.14, 0.004);
      B.metal.sph('#c9a227', 0.035, 1.88, 1.0, 0.0);
      B.metal.box('#c9a227', 0.05, 0.08, 0.02, 1.88, 1.18, -0.01);
      // mirror above the mail table (x -2 => u 8)
      B.satin.quad(C.walnut, 0.66, 0.86, 8.0, 1.6, 0.006);
      B.glow.quad('#c7d6df', 0.56, 0.76, 8.0, 1.6, 0.01);
      // geometric art between the street window and the door (x 0.6 => u 5.4)
      B.satin.quad(C.black, 0.62, 0.62, 5.4, 1.6, 0.006);
      B.art.quad('#ffffff', 0.54, 0.54, 5.4, 1.6, 0.01);
    }, [B.satin, B.metal, B.art, B.glow]);

    // ================================================================== KITCHEN (x -6..-2, z -4.5..-1)
    // L counter: run along north wall + peninsula
    B.matte.span(C.cab, -5.15, 0.08, -4.5, -2.0, 0.86, -3.9);
    B.matte.span('#2e241c', -5.12, 0, -4.45, -2.03, 0.08, -3.95);                   // toe kick
    B.matte.span(C.cab, -2.65, 0.08, -3.9, -2.0, 0.86, -1.95);
    B.matte.span('#2e241c', -2.6, 0, -3.85, -2.05, 0.08, -2.0);
    B.satin.span(C.counter, -5.17, 0.86, -4.5, -1.98, 0.9, -3.83);
    B.satin.span(C.counter, -2.72, 0.86, -3.85, -1.98, 0.9, -1.88);
    for (let x = -4.85; x < -2.2; x += 0.55) {                                       // cabinet doors + pulls
      B.matte.box(C.cabLine, 0.012, 0.66, 0.012, x + 0.27, 0.5, -3.895);
      B.metal.box(C.steel, 0.02, 0.12, 0.02, x + 0.2, 0.7, -3.88);
    }
    for (let z = -3.6; z < -2.0; z += 0.55) {
      B.matte.box(C.cabLine, 0.012, 0.66, 0.012, -2.655, 0.5, z + 0.27, PI / 2);
      B.metal.box(C.steel, 0.02, 0.12, 0.02, -2.665, 0.7, z + 0.2);
    }
    solid(-5.2, -4.5, -1.95, -3.82);
    solid(-2.75, -3.9, -1.95, -1.85);
    // sink under the window
    B.metal.span(C.darkSteel, -4.42, 0.895, -4.38, -3.78, 0.905, -3.96);
    B.metal.span(C.steel, -4.36, 0.9, -4.34, -3.84, 0.906, -4.0);
    B.metal.fcyl(C.steel, 0.015, 0.02, 0.3, -4.1, 0.9, -4.42, 8);
    B.metal.box(C.steel, 0.025, 0.025, 0.2, -4.1, 1.2, -4.33);
    // cooktop + oven + kettle
    B.satin.span(C.black, -3.25, 0.9, -4.42, -2.65, 0.915, -3.9);
    for (const [bx, bz] of [[-3.1, -4.28], [-2.8, -4.28], [-3.1, -4.04], [-2.8, -4.04]]) B.metal.cyl(C.darkSteel, 0.08, 0.08, 0.008, bx, 0.92, bz, 12);
    B.satin.span('#26292d', -3.22, 0.18, -3.905, -2.68, 0.74, -3.89);
    B.metal.box(C.steel, 0.46, 0.025, 0.03, -2.95, 0.76, -3.87);
    B.satin.sph('#c0392b', 0.1, -2.8, 1.0, -4.04, 1, 0.8, 1);                         // red kettle
    B.satin.cyl(C.black, 0.012, 0.012, 0.14, -2.8, 1.1, -4.04, 6, 0, 0, PI / 2);
    B.satin.cyl('#c0392b', 0.015, 0.025, 0.1, -2.69, 1.02, -4.04, 6, 0, 0, -1.0);
    // upper cabinets + range hood
    B.matte.span(C.cab, -5.15, 1.5, -4.5, -4.7, 2.3, -4.15);
    B.matte.span(C.cab, -3.5, 1.5, -4.5, -3.3, 2.3, -4.15);
    B.matte.span(C.cab, -2.6, 1.5, -4.5, -2.0, 2.3, -4.15);
    B.metal.span(C.steel, -3.3, 1.55, -4.5, -2.6, 1.7, -4.05);
    B.metal.span(C.steel, -3.05, 1.7, -4.5, -2.85, 2.3, -4.3);
    for (const x of [-4.92, -3.4, -2.3]) B.metal.box(C.steel, 0.02, 0.1, 0.02, x + 0.12, 1.6, -4.13);
    // tiled backsplash (not behind the window)
    const tileQ = (x0, x1, y0, y1) => B.tile.quad('#ffffff', x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2, -4.495, 0, 0, [(x1 - x0) / 0.6, (y1 - y0) / 0.3]);
    tileQ(-5.15, -4.6, 0.9, 1.5); tileQ(-4.6, -3.6, 0.9, 1.15); tileQ(-3.6, -2.0, 0.9, 1.5);
    // herbs on the kitchen sill
    for (const [i, x] of [[0, -4.4], [1, -4.1], [2, -3.8]]) {
      B.matte.fcyl(C.pot, 0.05, 0.04, 0.09, x, 1.15, -4.42, 8);
      B.matte.ico(i === 1 ? C.leaf2 : C.leaf, 0.07, x, 1.3, -4.42, 1, 1.2, 1, i);
    }
    // floating shelves with jars on the west wall
    for (const y of [1.45, 1.85]) B.matte.span(C.oak, -5.985, y, -2.9, -5.78, y + 0.03, -1.7);
    for (let i = 0; i < 4; i++) {
      B.satin.fcyl(['#e8d9b8', '#cfe3d6', '#f1e1c6', '#d8c9e6'][i], 0.06, 0.06, 0.16, -5.89, 1.48, -2.75 + i * 0.3, 10);
      B.metal.fcyl(C.steel, 0.062, 0.062, 0.025, -5.89, 1.64, -2.75 + i * 0.3, 10);
    }
    B.matte.fbox('#7d9cb3', 0.18, 0.22, 0.06, -5.88, 1.88, -2.4, PI / 2); B.matte.fbox('#c96f4a', 0.18, 0.2, 0.05, -5.88, 1.88, -2.32, PI / 2);
    B.matte.fcyl(C.potWhite, 0.07, 0.06, 0.12, -5.88, 1.88, -1.95, 8); B.matte.ico(C.leaf3, 0.11, -5.86, 2.05, -1.95, 1, 0.9, 1);
    // peninsula: fruit bowl
    B.satin.cyl(C.ceramic, 0.16, 0.1, 0.07, -2.33, 0.935, -2.5, 12);
    for (const [fx, fz, col] of [[-2.38, -2.47, '#f0922b'], [-2.27, -2.52, '#f0922b'], [-2.33, -2.4, '#d33b2c'], [-2.32, -2.6, '#e6c84a']]) B.satin.sph(col, 0.045, fx, 0.99, fz);

    // ---- FRIDGE (NW corner, door open 60°) ---------------------------------------
    const FX0 = -6, FX1 = -5.2, FZ0 = -4.5, FZ1 = -3.75;
    B.satin.span(C.appliance, FX0, 0, FZ0, FX1, 0.04, FZ1);
    B.satin.span(C.appliance, FX0, 0, FZ0, FX0 + 0.04, 1.8, FZ1);                        // sides
    B.satin.span(C.appliance, FX1 - 0.04, 0, FZ0, FX1, 1.8, FZ1);
    B.satin.span(C.appliance, FX0, 1.76, FZ0, FX1, 1.8, FZ1);                            // top
    B.satin.span(C.appliance, FX0, 0, FZ0, FX1, 1.8, FZ0 + 0.04);                        // back
    B.satin.span(C.appliance, FX0, 0.04, FZ1 - 0.04, FX1, 0.56, FZ1);                    // freezer drawer
    B.metal.box(C.steel, 0.5, 0.025, 0.03, -5.6, 0.48, FZ1 + 0.02);
    B.satin.span('#e4ebee', FX0 + 0.04, 0.56, FZ0 + 0.04, FX1 - 0.04, 0.6, FZ1 - 0.04);  // inner floor
    B.glow.quad('#eef6ff', 0.7, 1.12, -5.6, 1.17, FZ0 + 0.045);                          // lit back panel
    B.glow.box('#ffffff', 0.3, 0.02, 0.06, -5.6, 1.74, -4.3);                            // fridge lamp
    for (const y of [0.9, 1.2, 1.48]) B.satin.span('#dfe9ee', FX0 + 0.04, y, FZ0 + 0.04, FX1 - 0.04, y + 0.015, FZ1 - 0.06);
    // shelf contents
    const fr = [
      [0.6, '#ffffff', 'c', -5.82, -4.25, 0.08, 0.24], [0.6, '#f39c32', 'b', -5.62, -4.2, 0.1, 0.22], [0.6, '#5aa05a', 'c', -5.42, -4.1, 0.05, 0.14],
      [0.915, '#d64545', 'b', -5.8, -4.15, 0.14, 0.1], [0.915, '#f5d76e', 'c', -5.55, -4.25, 0.07, 0.12], [0.915, '#7fb2d9', 'b', -5.35, -4.0, 0.1, 0.08],
      [1.215, '#e8e1d0', 'b', -5.75, -4.1, 0.2, 0.08], [1.215, '#9b59b6', 'c', -5.45, -4.2, 0.05, 0.16],
      [1.495, '#f4a3a8', 'b', -5.65, -4.2, 0.16, 0.1], [1.495, '#ffffff', 'c', -5.38, -4.15, 0.05, 0.13]
    ];
    for (const [y, col, kind, x, z, s, h] of fr) {
      if (kind === 'c') B.satin.fcyl(col, s, s, h, x, y, z, 8); else B.satin.fbox(col, s, h, s * 0.8, x, y, z);
    }
    // open door: hinge at (x=-6, z=-3.75), swung -60° about Y so it opens toward +z
    B.satin.push(FX0 + 0.02, 0.56, FZ1, -PI / 3);
    B.metal.push(FX0 + 0.02, 0.56, FZ1, -PI / 3);
    B.satin.box(C.appliance, 0.8, 1.22, 0.06, 0.4, 0.61, 0.03);
    B.satin.box('#e9eef0', 0.72, 1.12, 0.01, 0.4, 0.61, -0.005);
    for (const y of [0.25, 0.6, 0.95]) {
      B.satin.box('#dfe9ee', 0.66, 0.08, 0.1, 0.4, y, -0.06);
      for (let i = 0; i < 3; i++) B.satin.fcyl(['#7b4b2a', '#f6f6f2', '#e2b33c', '#8bc34a', '#d64545'][(i + y * 10) % 5 | 0], 0.03, 0.03, 0.15, 0.18 + i * 0.2, y + 0.02, -0.07, 6);
    }
    B.metal.box(C.steel, 0.025, 0.6, 0.03, 0.74, 0.7, 0.08);
    B.satin.pop(); B.metal.pop();
    solid(FX0, FZ0, FX1, FZ1);
    solid(FX0, FZ1, -5.5, -3.0);

    // ================================================================== DINING (table 1.6 x 0.9 at (0,-1.5))
    const TX = 0, TZ = -1.5, TY = 0.76;
    B.satin.span(C.oak, TX - 0.8, TY - 0.04, TZ - 0.45, TX + 0.8, TY, TZ + 0.45);
    B.matte.span(C.oakDark, TX - 0.72, TY - 0.12, TZ - 0.38, TX + 0.72, TY - 0.04, TZ + 0.38);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.matte.fbox(C.oakDark, 0.06, TY - 0.04, 0.06, TX + sx * 0.72, 0, TZ + sz * 0.37);
    const chair = (b, x, z, ry) => {
      b.push(x, 0, z, ry);
      b.fbox(C.oakDark, 0.44, 0.05, 0.42, 0, 0.42, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.fbox(C.oakDark, 0.04, 0.42, 0.04, sx * 0.19, 0, sz * 0.18);
      for (const sx of [-1, 1]) b.fbox(C.oakDark, 0.04, 0.5, 0.04, sx * 0.19, 0.47, 0.18);
      b.box(C.oakDark, 0.42, 0.12, 0.03, 0, 0.88, 0.19);
      b.box(C.oakDark, 0.42, 0.04, 0.03, 0, 0.66, 0.19);
      b.fbox(C.mustard, 0.38, 0.03, 0.36, 0, 0.47, -0.01);
      b.pop();
    };
    chair(B.matte, -0.42, -0.75, 0);          // south side, facing -z
    chair(B.matte, 0.42, -0.75, 0);
    chair(B.matte, -1.12, -1.5, -PI / 2);     // west end, facing +x (Sarah's seat)
    chair(B.matte, 0.32, -2.72, PI - 0.4);    // pulled-out chair (Omar sat here for coffee)
    solid(TX - 0.82, TZ - 0.47, TX + 0.82, TZ + 0.47);
    solid(-0.66, -0.98, -0.18, -0.52); solid(0.18, -0.98, 0.66, -0.52);
    solid(-1.36, -1.74, -0.88, -1.26); solid(0.06, -2.98, 0.58, -2.46);

    // laptop (hotspot object): base + lid + glowing listing screen, facing the player (+z)
    const LX = 0.12, LZ = -1.42;
    B.metal.span('#c9ced3', LX - 0.17, TY, LZ - 0.12, LX + 0.17, TY + 0.018, LZ + 0.12);
    B.satin.span('#9aa1a8', LX - 0.15, TY + 0.018, LZ - 0.08, LX + 0.15, TY + 0.02, LZ + 0.04);
    const lidTilt = 0.32;
    B.metal.push(LX, TY + 0.018, LZ - 0.12, 0, -lidTilt);
    B.metal.box('#c9ced3', 0.34, 0.23, 0.01, 0, 0.115, -0.005);
    B.metal.pop();
    const screen = new THREE.Mesh(own(new THREE.PlaneGeometry(0.31, 0.195)), tmat.screen);
    screen.position.set(LX, TY + 0.018 + Math.cos(lidTilt) * 0.118, LZ - 0.12 - Math.sin(lidTilt) * 0.118 + Math.cos(lidTilt) * 0.0005);
    screen.position.z += 0.0012;
    screen.rotation.x = -lidTilt;
    screen.name = 'home:laptopScreen';
    group.add(screen);
    // breakfast: two mugs, toast plate, dates
    const mug = (x, z, col) => {
      B.satin.fcyl(col, 0.04, 0.036, 0.095, x, TY, z, 10);
      B.satin.torus(col, 0.027, 0.008, x + 0.045, TY + 0.05, z, 0, 0, 0, PI);
      B.satin.cyl('#4a2c1a', 0.036, 0.036, 0.004, x, TY + 0.085, z, 10);
    };
    mug(-0.42, -1.25, '#2f6b6b'); mug(0.55, -1.75, C.white); mug(-0.6, -1.72, '#b5523b');
    B.satin.cyl(C.white, 0.12, 0.1, 0.015, -0.32, TY + 0.008, -1.6, 14);
    B.satin.box('#d9a35b', 0.1, 0.012, 0.1, -0.35, TY + 0.022, -1.62, 0.3);
    B.satin.box('#c98b45', 0.1, 0.012, 0.1, -0.29, TY + 0.034, -1.57, -0.2);
    B.satin.cyl(C.ceramic, 0.07, 0.05, 0.03, 0.62, TY + 0.015, -1.3, 10);
    for (let i = 0; i < 4; i++) B.satin.sph('#5a2a14', 0.016, 0.6 + (i % 2) * 0.03, TY + 0.04, -1.32 + (i >> 1) * 0.03, 1.6, 1, 1, 6, 4);
    // pendant lamp
    B.metal.fcyl(C.black, 0.006, 0.006, H - 1.95, TX, 1.95, TZ, 4);
    B.matte.cyl('#2f5d4a', 0.06, 0.26, 0.24, TX, 1.84, TZ, 14);
    B.glow.cyl('#fff1c9', 0.24, 0.24, 0.005, TX, 1.715, TZ, 14);
    B.glow.sph('#fff6dc', 0.05, TX, 1.76, TZ);
    // curtains: rod + two sway-able panels beside the dining window
    B.metal.cyl(C.black, 0.012, 0.012, 3.2, 0, 2.42, Z0 + 0.12, 6, 0, 0, PI / 2);
    const curtainGeo = own(new THREE.PlaneGeometry(0.5, 2.3, 10, 1));
    { const pa = curtainGeo.attributes.position; for (let i = 0; i < pa.count; i++) { pa.setZ(i, Math.sin((pa.getX(i) + 0.25) * 25) * 0.035); pa.setY(i, pa.getY(i) - 1.15); } curtainGeo.computeVertexNormals(); }
    const curtains = [-1.5, 1.5].map((x) => {
      const m = new THREE.Mesh(curtainGeo, mat.curtain);
      m.position.set(x, 2.4, Z0 + 0.14);
      m.castShadow = true; m.receiveShadow = true;
      m.name = 'home:curtain';
      group.add(m);
      return m;
    });
    // steam above the teal mug
    const steamGeo = own(new THREE.SphereGeometry(0.03, 6, 4));
    const steam = [0, 1, 2].map((i) => { const s = new THREE.Mesh(steamGeo, mat.steam); s.name = 'home:steam'; group.add(s); return s; });

    // ================================================================== LIVING ROOM (x 2..6)
    const rug = new THREE.Mesh(own(new THREE.PlaneGeometry(3.0, 2.4)), tmat.rug);
    rug.rotation.x = -PI / 2; rug.rotation.z = PI / 2; rug.position.set(4.05, 0.006, -1.5);
    rug.receiveShadow = true; rug.name = 'home:rug';
    group.add(rug);
    // sofa (back to the dining area, facing the TV on the east wall)
    B.matte.span(C.sofaDark, 2.2, 0.06, -2.6, 3.1, 0.42, -0.4);
    B.matte.span(C.sofa, 2.2, 0.06, -2.6, 2.44, 0.88, -0.4);                         // back
    B.matte.span(C.sofa, 2.2, 0.06, -2.6, 3.1, 0.64, -2.4);                          // arms
    B.matte.span(C.sofa, 2.2, 0.06, -0.6, 3.1, 0.64, -0.4);
    B.matte.span(C.sofa, 2.44, 0.42, -2.38, 3.08, 0.56, -1.51);                      // seat cushions
    B.matte.span(C.sofa, 2.44, 0.42, -1.49, 3.08, 0.56, -0.62);
    B.matte.box(C.sofa, 0.16, 0.42, 0.86, 2.5, 0.78, -1.95, 0, 0, -0.18);           // back cushions
    B.matte.box(C.sofa, 0.16, 0.42, 0.86, 2.5, 0.78, -1.06, 0, 0, -0.18);
    for (const z of [-2.55, -0.45]) for (const x of [2.26, 3.04]) B.matte.fbox('#3a2a20', 0.05, 0.06, 0.05, x, 0, z);
    B.matte.box(C.mustard, 0.12, 0.34, 0.34, 2.62, 0.74, -2.15, 0.2, 0, -0.25);
    B.matte.box(C.terracotta, 0.12, 0.32, 0.32, 2.62, 0.73, -0.85, -0.25, 0, -0.25);
    B.matte.box(C.knit, 0.92, 0.03, 0.5, 2.66, 0.655, -0.5, 0, 0, 0.05);             // throw over the arm
    B.matte.box(C.knit, 0.03, 0.4, 0.5, 3.12, 0.46, -0.5);
    B.matte.box('#7f9a8c', 0.6, 0.08, 0.7, 2.8, 0.6, -1.85, 0.4, 0.1, 0.05);           // crumpled blanket (Ben slept here)
    B.matte.box('#7f9a8c', 0.45, 0.1, 0.5, 2.85, 0.65, -1.45, -0.3, -0.12, 0.08);
    B.matte.box('#7f9a8c', 0.04, 0.35, 0.55, 3.12, 0.4, -1.75, 0.1);
    B.matte.box(C.white, 0.35, 0.1, 0.24, 2.6, 0.62, -2.25, 0.3);                         // pillow
    solid(2.15, -2.65, 3.15, -0.35);
    // floor lamp at the sofa's south end
    B.matte.fcyl(C.black, 0.15, 0.17, 0.03, 2.4, 0, 0.0, 12);
    B.metal.fcyl(C.black, 0.012, 0.012, 1.45, 2.4, 0.03, 0.0, 6);
    B.matte.cyl('#f3ead6', 0.17, 0.22, 0.28, 2.4, 1.55, 0.0, 14);
    B.glow.cyl('#fff1c9', 0.2, 0.2, 0.005, 2.4, 1.415, 0.0, 14);
    solid(2.22, -0.18, 2.58, 0.18);
    // coffee table
    B.satin.span('#c79a6b', 3.55, 0.38, -2.1, 4.35, 0.42, -0.9);
    B.matte.span('#a87a50', 3.6, 0.12, -2.05, 4.3, 0.14, -0.95);
    for (const sx of [3.6, 4.3]) for (const sz of [-2.05, -0.95]) B.matte.fbox('#8a6243', 0.04, 0.38, 0.04, sx, 0, sz);
    B.matte.fbox('#3a5f9a', 0.22, 0.04, 0.3, 3.85, 0.42, -1.75, 0.2);
    B.matte.fbox('#c96f4a', 0.2, 0.03, 0.27, 3.86, 0.46, -1.74, 0.05);
    B.matte.fcyl(C.potWhite, 0.06, 0.05, 0.08, 4.1, 0.42, -1.2, 8);
    for (let i = 0; i < 5; i++) B.matte.ico(C.leaf2, 0.035, 4.1 + Math.cos(i * 1.3) * 0.035, 0.53, -1.2 + Math.sin(i * 1.3) * 0.035, 1, 1.4, 1, i);
    B.satin.cyl(C.ceramic, 0.12, 0.12, 0.02, 4.1, 0.43, -1.6, 14);                      // tray
    solid(3.52, -2.13, 4.38, -0.87, 0.42);
    // TV stand + TV on the east wall
    B.matte.span(C.walnut, 5.5, 0.1, -2.4, 5.98, 0.52, -0.6);
    for (const z of [-2.35, -0.65]) B.matte.fbox(C.black, 0.04, 0.1, 0.04, 5.55, 0, z);
    B.matte.box('#5a3c26', 0.01, 0.3, 0.7, 5.495, 0.31, -1.95); B.matte.box('#5a3c26', 0.01, 0.3, 0.7, 5.495, 0.31, -1.05);
    B.satin.span(C.black, 5.72, 0.52, -1.6, 5.82, 0.56, -1.4);
    B.satin.span(C.black, 5.75, 0.6, -2.15, 5.81, 1.36, -0.85);
    B.satin.quad('#273342', 1.24, 0.7, 5.745, 0.98, -1.5, -PI / 2);
    B.matte.fbox('#d4c3a3', 0.12, 0.14, 0.12, 5.75, 0.52, -2.2);                         // small vase
    solid(5.47, -2.43, 6, -0.57);
    // bookshelf: books, with family photos on the top shelf
    const BX0 = 3.2, BX1 = 4.4, BZ0 = Z0, BZ1 = Z0 + 0.32;
    B.matte.span(C.shelfWood, BX0, 0, BZ0, BX0 + 0.03, 1.8, BZ1);
    B.matte.span(C.shelfWood, BX1 - 0.03, 0, BZ0, BX1, 1.8, BZ1);
    B.matte.span('#5e4029', BX0, 0, BZ0, BX1, 1.8, BZ0 + 0.015);
    const shelves = [0.06, 0.48, 0.9, 1.32, 1.77];
    for (const y of shelves) B.matte.span(C.shelfWood, BX0, y - 0.03, BZ0, BX1, y, BZ1);
    const rr = ctx.rand ? ctx.rand(11) : ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(11);
    const bookCols = ['#7d3c3c', '#2f4f6f', '#c9a227', '#3f6b4f', '#d8c8a8', '#8a5a9a', '#b5523b', '#4a6a8a', '#e3d5b8', '#5b4636'];
    for (let si = 0; si < 3; si++) {
      let x = BX0 + 0.05;
      const y = shelves[si];
      while (x < BX1 - 0.12) {
        const w = 0.03 + rr() * 0.035, h = 0.24 + rr() * 0.12;
        if (rr() < 0.12 && x < BX1 - 0.3) { // a small horizontal stack or decor gap
          for (let k = 0; k < 3; k++) B.matte.fbox(bookCols[(si * 3 + k) % 10], 0.22, 0.04, 0.2, x + 0.11, y + k * 0.04, BZ0 + 0.16, rr() * 0.2 - 0.1);
          x += 0.26; continue;
        }
        B.matte.fbox(bookCols[(rr() * 10) | 0], w, h, 0.2 + rr() * 0.05, x + w / 2, y, BZ0 + 0.15);
        x += w + 0.004;
      }
    }
    // top shelf: two small framed family photos
    for (const [px, w, h, ry] of [[3.92, 0.16, 0.2, -0.15], [4.13, 0.2, 0.15, 0.2]]) {
      B.satin.push(px, shelves[3], BZ0 + 0.14, ry, -0.12);
      B.satin.box('#2b2420', w, h, 0.02, 0, h / 2, 0);
      B.satin.pop();
      B.photo.push(px, shelves[3], BZ0 + 0.14, ry, -0.12);
      B.photo.quad('#ffffff', w - 0.03, h - 0.03, 0, h / 2, 0.011);
      B.photo.pop();
    }
    B.matte.fcyl(C.potWhite, 0.07, 0.06, 0.12, 4.22, 1.8, BZ0 + 0.16, 8);                 // trailing plant on top
    for (let i = 0; i < 6; i++) B.matte.ico(i % 2 ? C.leaf : C.leaf2, 0.06, 4.22 + (i - 2.5) * 0.04, 1.95 - (i % 3) * 0.08, BZ0 + 0.22, 1, 1, 1, i);
    solid(BX0, BZ0, BX1, BZ1);
    // fiddle-leaf fig in front of the living window
    const tallPlant = (x, z, s = 1) => {
      B.matte.fcyl(C.pot, 0.2 * s, 0.15 * s, 0.38 * s, x, 0, z, 10);
      B.matte.cyl(C.soil, 0.18 * s, 0.18 * s, 0.01, x, 0.37 * s, z, 10);
      B.matte.fcyl(C.bark, 0.018, 0.025, 1.0 * s, x, 0.38 * s, z, 5);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, h = 0.75 + (i / 9) * 0.85;
        B.matte.ico(i % 3 === 0 ? C.leaf3 : i % 3 === 1 ? C.leaf : C.leaf2, 0.17 * s, x + Math.cos(a) * 0.17 * s, h * s, z + Math.sin(a) * 0.17 * s, 1, 0.75, 1.15, a);
      }
    };
    tallPlant(2.42, -4.0);
    solid(2.2, -4.25, 2.65, -3.75);
    // snake plants in the reading nook and by the door
    const snakePlant = (x, z) => {
      B.matte.fcyl(C.potWhite, 0.15, 0.12, 0.3, x, 0, z, 10);
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        B.matte.box(i % 2 ? '#4f7f4a' : '#7aa35a', 0.07, 0.6 + (i % 3) * 0.12, 0.02, x + Math.cos(a) * 0.05, 0.6, z + Math.sin(a) * 0.05, a, Math.sin(a) * 0.15, Math.cos(a) * 0.15);
      }
    };
    snakePlant(5.72, -2.78);
    snakePlant(5.7, 3.2);
    solid(5.52, -2.96, 5.9, -2.6, 0.9); solid(5.5, 3.0, 5.9, 3.4, 0.9);

    // ---- READING NOOK (NE): armchair + side table, family photos on the wall
    B.matte.push(5.15, 0, -3.75, -2.4);   // armchair facing the room (south-west)
    B.matte.fbox(C.terracotta, 0.78, 0.4, 0.74, 0, 0.06, 0);
    B.matte.fbox(C.terracotta, 0.78, 0.5, 0.16, 0, 0.42, 0.29);
    for (const sx of [-1, 1]) B.matte.fbox(C.terracotta, 0.14, 0.24, 0.66, sx * 0.32, 0.42, 0.02);
    B.matte.fbox(C.knit, 0.5, 0.1, 0.5, 0, 0.46, -0.02);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.matte.fbox('#3a2a20', 0.05, 0.06, 0.05, sx * 0.33, 0, sz * 0.3);
    B.matte.pop();
    solid(4.68, -4.25, 5.62, -3.25, 0.9);
    B.matte.span(C.walnut, 5.66, 0, -4.5, 6.0, 0.55, -4.12);                               // side table
    B.satin.fcyl(C.white, 0.04, 0.036, 0.09, 5.82, 0.55, -4.3, 10);
    B.matte.fbox('#2f4f6f', 0.14, 0.03, 0.2, 5.8, 0.55, -4.2, 0.4);
    solid(5.64, -4.5, 6, -4.1, 0.55);
    // a small gallery of family photos on the wall
    for (const [px, py, w, h] of [[4.95, 1.45, 0.34, 0.26], [5.45, 1.55, 0.3, 0.4], [4.98, 1.82, 0.28, 0.2]]) {
      B.satin.quad('#2b2420', w, h, px, py, Z0 + 0.006);
      B.photo.quad('#ffffff', w - 0.05, h - 0.05, px, py, Z0 + 0.01);
    }

    // low console under the east window with a potted plant
    B.matte.span(C.walnut, 5.6, 0.0, 1.1, 5.98, 0.6, 2.3);
    B.matte.span('#5a3c26', 5.62, 0.6, 1.12, 5.98, 0.62, 2.28);
    B.matte.fcyl(C.potWhite, 0.09, 0.07, 0.14, 5.8, 0.62, 1.4, 8); B.matte.ico(C.leaf, 0.12, 5.8, 0.84, 1.4, 1, 0.9, 1);
    B.matte.fbox('#7d3c3c', 0.2, 0.05, 0.14, 5.8, 0.62, 1.95, 0.2); B.matte.fbox('#2f4f6f', 0.2, 0.04, 0.14, 5.8, 0.67, 1.95, -0.15);
    solid(5.58, 1.08, 6, 2.32, 0.6);
    // wall clock (~07:00) on the west wall
    B.satin.cyl(C.white, 0.17, 0.17, 0.03, X0 + 0.015, 2.0, -0.8, 18, 0, 0, PI / 2);
    B.satin.torus(C.black, 0.17, 0.012, X0 + 0.03, 2.0, -0.8, PI / 2);
    B.satin.box(C.black, 0.006, 0.12, 0.012, X0 + 0.035, 2.06, -0.8);                     // minute -> 12
    B.satin.box(C.black, 0.008, 0.08, 0.016, X0 + 0.04, 2.0 - 0.035, -0.8 + 0.02, 0, -PI / 6 * 1, 0);
    // (hour hand points to 7: tilt in the wall plane)

    // ---- study desk under the west window (night-class textbooks)
    B.satin.span(C.oak, -6, 0.72, 0.3, -5.38, 0.76, 1.7);
    for (const z of [0.34, 1.66]) B.matte.span(C.oakDark, -5.98, 0, z - 0.03, -5.42, 0.72, z + 0.03);
    B.matte.fbox('#2f4f6f', 0.22, 0.05, 0.28, -5.75, 0.76, 0.6, 0.1);
    B.matte.fbox('#b5523b', 0.21, 0.04, 0.27, -5.74, 0.81, 0.62, -0.1);
    B.matte.fbox('#e3d5b8', 0.2, 0.05, 0.26, -5.75, 0.85, 0.6, 0.15);
    B.matte.fbox(C.white, 0.21, 0.01, 0.28, -5.6, 0.76, 1.05, 0.25);                      // open notebook
    B.matte.fcyl('#3e6d8a', 0.035, 0.03, 0.1, -5.85, 0.76, 1.4, 8);
    B.metal.fcyl(C.black, 0.08, 0.08, 0.02, -5.85, 0.76, 1.55, 10);                       // desk lamp
    B.metal.cyl(C.black, 0.01, 0.01, 0.4, -5.8, 0.98, 1.5, 5, 0, 0.3);
    B.matte.cyl('#2f5d4a', 0.04, 0.09, 0.12, -5.72, 1.17, 1.4, 10, 0, 0.6);
    // desk chair
    chair(B.matte, -5.0, 1.0, -PI / 2);
    solid(-6, 0.27, -5.36, 1.73, 0.76); solid(-5.24, 0.77, -4.76, 1.23);

    // ================================================================== ENTRY (south)
    // mail table (hotspot object) next to the stairs
    B.satin.span(C.walnut, -2.52, 0.8, 4.16, -1.48, 0.84, 4.485);
    B.matte.span('#5e3d22', -2.46, 0.66, 4.2, -1.54, 0.8, 4.48);
    B.metal.sph('#c9a227', 0.015, -2.0, 0.73, 4.19);
    for (const sx of [-2.47, -1.53]) for (const sz of [4.2, 4.46]) B.matte.fbox('#5e3d22', 0.035, 0.66, 0.035, sx, 0, sz);
    B.matte.span('#5e3d22', -2.47, 0.15, 4.2, -1.53, 0.17, 4.46);
    for (let i = 0; i < 4; i++) B.matte.fbox(i % 2 ? '#f4f1e8' : C.white, 0.22, 0.008, 0.11, -2.28 + i * 0.012, 0.84 + i * 0.009, 4.3 + i * 0.006, -0.2 + i * 0.13);
    B.satin.fbox('#e3262c', 0.24, 0.01, 0.12, -2.22, 0.881, 4.27, 0.18);                   // glossy red store envelope
    B.satin.fbox('#f7d23e', 0.06, 0.004, 0.035, -2.26, 0.891, 4.26, 0.18);
    B.satin.sph('#3e6d8a', 0.09, -1.75, 0.84, 4.32, 1, 0.45, 1, 10, 6);                    // key bowl
    B.metal.box(C.steel, 0.05, 0.01, 0.02, -1.77, 0.87, 4.31, 0.6); B.metal.torus(C.steel, 0.015, 0.003, -1.72, 0.875, 4.33, 0, PI / 2);
    B.matte.fcyl(C.potWhite, 0.045, 0.04, 0.07, -1.58, 0.84, 4.4, 8); B.matte.ico(C.leaf2, 0.05, -1.58, 0.94, 4.4, 1, 1, 1);
    solid(-2.55, 4.14, -1.45, 4.5, 0.84);

    // staircase along the south wall rising westward (x -3 .. -6)
    const STEPS = 10, RUN = 0.3, RISE = H / STEPS;
    for (let i = 0; i < STEPS; i++) {
      const xa = -3.0 - RUN * (i + 1), xb = -3.0 - RUN * i, top = RISE * (i + 1);
      B.matte.span('#f2ede3', xa, 0, 3.55, xb, top - 0.03, 4.485);
      B.satin.span(C.oak, xa - 0.02, top - 0.03, 3.53, xb, top, 4.485);
    }
    const slope = Math.atan2(H, STEPS * RUN);
    B.satin.box(C.oakDark, Math.hypot(STEPS * RUN, H) + 0.1, 0.05, 0.06, -3.0 - STEPS * RUN / 2, H / 2 + 0.9, 3.52, 0, 0, -slope);
    for (let i = 0; i < STEPS; i += 1) {
      const x = -3.0 - RUN * i - RUN / 2, top = RISE * (i + 1);
      B.satin.fbox(i === 0 ? C.oakDark : C.white, i === 0 ? 0.08 : 0.025, 0.9 + (i === 0 ? 0.1 : 0) - (RUN / 2) * Math.tan(slope) * 0, i === 0 ? 0.08 : 0.025, x, top, 3.52);
    }
    B.satin.fbox(C.oakDark, 0.09, 1.0, 0.09, -2.96, 0, 3.52);
    solid(-6, 3.5, -2.92, 4.5);
    // shoe rack + shoes (shoes off at home), entry mat
    B.matte.span(C.oakDark, 3.15, 0.0, 4.18, 3.85, 0.04, 4.48);
    B.matte.span(C.oakDark, 3.15, 0.22, 4.18, 3.85, 0.25, 4.48);
    B.matte.span(C.oak, 3.15, 0.42, 4.18, 3.85, 0.46, 4.48);
    for (const x of [3.17, 3.83]) B.matte.span(C.oakDark, x - 0.02, 0, 4.18, x + 0.02, 0.46, 4.48);
    for (const [x, y, col] of [[3.28, 0.04, '#2b2b2b'], [3.36, 0.04, '#2b2b2b'], [3.58, 0.04, '#f0f0f0'], [3.66, 0.04, '#f0f0f0'], [3.32, 0.25, '#7a4e2e'], [3.4, 0.25, '#7a4e2e'], [3.62, 0.25, '#3a5f9a'], [3.7, 0.25, '#3a5f9a']]) B.matte.fbox(col, 0.07, 0.08, 0.24, x, y, 4.33);
    B.matte.fbox('#5a4a3c', 1.0, 0.012, 0.6, 4.5, 0, 3.95);
    solid(3.12, 4.15, 3.88, 4.5, 0.46);
    // umbrella stand next to the door
    B.satin.fcyl('#3e6d8a', 0.09, 0.08, 0.42, 5.2, 0, 4.3, 10);
    B.satin.cyl(C.black, 0.012, 0.012, 0.8, 5.2, 0.6, 4.3, 5, 0, 0, 0.12);
    B.satin.cyl('#9e3b2b', 0.012, 0.012, 0.75, 5.26, 0.58, 4.26, 5, 0, 0.1, -0.1);
    solid(5.08, 4.18, 5.32, 4.42, 0.5);
    // coat rack with coats
    B.matte.fcyl('#3b2e25', 0.2, 0.22, 0.04, 5.6, 0, 4.2, 10);
    B.matte.fcyl('#3b2e25', 0.025, 0.025, 1.75, 5.6, 0.04, 4.2, 6);
    B.matte.box('#2f3a55', 0.36, 0.85, 0.16, 5.6, 1.25, 4.06, 0.1);
    B.matte.box('#b08a5a', 0.32, 0.75, 0.16, 5.72, 1.3, 4.3, 1.4);
    B.matte.box('#9e3b2b', 0.06, 0.7, 0.14, 5.45, 1.28, 4.24, 0.6);
    B.matte.sph('#3a5f9a', 0.1, 5.6, 1.86, 4.2, 1, 0.8, 1);
    solid(5.38, 3.98, 5.82, 4.42);

    // (nothing is built outside the walls: the engine surrounds the room with the real street — town.js backdrop mode)

    // ------------------------------------------------------------------ build batches
    const add = (m) => { if (m) { own(m.geometry); group.add(m); } return m; };
    addInteriorRoof(THREE, group, { x0: X0, x1: X1, z0: Z0, z1: Z1, height: H, name: 'home', beams: true });
    const envelopeWalls = add(B.walls.build(mat.walls, { cast: false, receive: true }));
    if (envelopeWalls) envelopeWalls.userData.cameraCollide = true;
    add(B.matte.build(mat.matte));
    add(B.satin.build(mat.satin));
    add(B.metal.build(mat.metal));
    add(B.glow.build(mat.glow, { cast: false, receive: false }));
    const glassMesh = add(B.glass.build(mat.glass, { cast: false, receive: false }));
    if (glassMesh) glassMesh.renderOrder = 2;
    add(B.tile.build(tmat.tile, { cast: false }));
    add(B.art.build(tmat.art, { cast: false }));
    add(B.photo.build(tmat.photo, { cast: false }));

    // ------------------------------------------------------------------ lights (3 practicals, no shadows: README budget)
    // the room is lit by the global golden-hour sun + sky; these only add warmth under the pendant, by the
    // sofa lamp and a soft fill in the kitchen corner the low sun never reaches
    const pendant = new THREE.PointLight('#ffd49a', 3.2, 7, 2);
    pendant.position.set(TX, 1.62, TZ);
    const kitchenFill = new THREE.PointLight('#ffe3c0', 2.4, 8, 2);
    kitchenFill.position.set(-3.6, 2.2, -2.2);
    const lampLight = new THREE.PointLight('#ffd9a0', 1.0, 4, 2);
    lampLight.position.set(2.4, 1.35, 0.0);
    group.add(pendant, kitchenFill, lampLight);

    // ------------------------------------------------------------------ NPCs
    const npcs = [];
    const yawTo = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));
    const propMats = {
      dark: own(new THREE.MeshStandardMaterial({ color: '#222326', roughness: 0.5 })),
      phoneGlow: own(new THREE.MeshBasicMaterial({ color: '#7fc4ff', toneMapped: false })),
      paper: own(new THREE.MeshStandardMaterial({ color: '#f6f3ea', roughness: 0.8 })),
      mug: own(new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.4 })),
      beanie: own(new THREE.MeshStandardMaterial({ color: '#7d8187', roughness: 1, flatShading: true })),
      silver: own(new THREE.MeshStandardMaterial({ color: '#c9c9c9', roughness: 0.9, flatShading: true })),
      chestnut: own(new THREE.MeshStandardMaterial({ color: '#8a4b2a', roughness: 0.9, flatShading: true })),
      blond: own(new THREE.MeshStandardMaterial({ color: '#8b6b3d', roughness: 0.9, flatShading: true }))
    };
    const posed = [];   // [{ part, x }] arm poses re-applied after the engine's idle animation
    const prop = (geo, m, parent, x, y, z) => { const o = new THREE.Mesh(own(geo), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };

    // Omar (situation NPC, laptop): tall, short beard, grey wool beanie, olive jacket, coffee mug in hand
    const omarLook = { skin: '#5a3a22', shirt: '#556b2f', pants: '#3b3d42', shoes: '#3a2a20', hair: '#1a1410', beard: '#1a1410', height: 1.85 };
    // Carol (situation NPC, fridge): Adam's mom, short silver bob, olive cardigan, reading glasses, menu notepad
    const carolLook = { skin: '#f0c8a8', shirt: '#6b7a3a', pants: '#4a4a52', shoes: '#4a3a30', hair: '#c9c9c9', glasses: true, height: 1.62 };
    // Ben (situation NPC, mail table): Adam's younger brother, messy dark-blond hair, grey hoodie, headphones, phone
    const benLook = { skin: '#f3d3b5', shirt: '#8a8f98', pants: '#2f3542', hair: '#8b6b3d', shoes: '#f0f0f0', height: 1.8, build: 0.9 };
    // Sarah (background): Adam's wife, seated at the west end of the table looking at her laptop
    const sarahLook = { skin: '#f1cfae', shirt: '#9c3d54', pants: '#2f3542', shoes: '#5a4a3c', hair: '#8a4b2a', height: 1.66 };
    const omarPos = [-3.6, 0, -3.4], benPos = [-1.2, 0, 3.4];

    if (typeof ctx.makeNPC === 'function') {
      const om = ctx.makeNPC(omarLook);
      const po = om.userData.parts;
      if (po?.head) {
        const cap = prop(new THREE.SphereGeometry(0.148, 12, 6, 0, PI * 2, 0, PI * 0.5), propMats.beanie, po.head, 0, 0.015, 0.008);
        cap.scale.set(1, 1.05, 1);
        const cuff = prop(new THREE.TorusGeometry(0.142, 0.022, 5, 16), propMats.beanie, po.head, 0, 0.03, 0.008);
        cuff.rotation.x = PI / 2;
      }
      if (po?.armR) {
        prop(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 10), propMats.mug, po.armR, 0, -0.68, -0.05);
        posed.push({ part: po.armR, x: 0.9 });
      }
      npcs.push({ id: 'omar', position: omarPos, yaw: yawTo([omarPos[0], omarPos[2]], [-5.0, -3.3]), object: om });

      const ca = ctx.makeNPC(carolLook);
      const pc = ca.userData.parts;
      if (pc?.head) {
        const bob = prop(new THREE.SphereGeometry(0.152, 12, 8, 0, PI * 2, 0, PI * 0.64), propMats.silver, pc.head, 0, 0.005, 0.02);
        bob.scale.set(1.04, 1, 1);
      }
      if (pc?.armL) {
        prop(new THREE.BoxGeometry(0.11, 0.15, 0.015), propMats.paper, pc.armL, 0, -0.68, -0.05).rotation.x = -0.6;
        posed.push({ part: pc.armL, x: 1.0 });
      }
      npcs.push({ id: 'carol', position: [-4.4, 0, -3.0], yaw: 2.35, object: ca });

      const be = ctx.makeNPC(benLook);
      const pb = be.userData.parts;
      if (pb?.head) {   // messy hair tufts
        for (let i = 0; i < 6; i++) {
          const a2 = i * 1.05;
          prop(new THREE.IcosahedronGeometry(0.05, 0), propMats.blond, pb.head, Math.cos(a2) * 0.07, 0.11 + (i % 2) * 0.02, Math.sin(a2) * 0.07).rotation.set(i, i * 2, 0);
        }
      }
      if (pb?.body) {
        const band = prop(new THREE.TorusGeometry(0.1, 0.018, 5, 14), propMats.dark, pb.body, 0, 1.47, 0.02);
        band.rotation.x = PI / 2 - 0.25;
        const cupGeo = own(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 10));
        for (const sx of [-1, 1]) { const cup = new THREE.Mesh(cupGeo, propMats.dark); cup.rotation.z = PI / 2; cup.position.set(sx * 0.105, 1.44, -0.02); pb.body.add(cup); }
      }
      if (pb?.armR) {
        const phone = prop(new THREE.BoxGeometry(0.075, 0.15, 0.012), propMats.dark, pb.armR, 0, -0.7, -0.03);
        phone.rotation.x = -0.5;
        const face = prop(new THREE.PlaneGeometry(0.065, 0.13), propMats.phoneGlow, phone, 0, 0, -0.007);
        face.rotation.y = PI;
        posed.push({ part: pb.armR, x: 1.15 });
      }
      npcs.push({ id: 'ben', position: benPos, yaw: yawTo([benPos[0], benPos[2]], [0.3, 2.4]), object: be });

      const sa = ctx.makeNPC(sarahLook);
      const ps = sa.userData.parts;
      if (ps) {
        ps.legL.rotation.x = ps.legR.rotation.x = PI / 2;   // seated: thighs forward
        ps.armL.rotation.x = ps.armR.rotation.x = 0.75;     // hands toward the table
        const tail = prop(new THREE.SphereGeometry(0.05, 8, 6), propMats.chestnut, ps.head, 0, -0.02, 0.15);
        tail.scale.set(0.9, 1.8, 0.9);
      }
      npcs.push({ id: 'bg_sarah', position: [-1.1, -0.38, -1.5], yaw: -PI / 2, object: sa, animate: false, collide: false, showName: false });
    } else {
      npcs.push({ id: 'omar', position: omarPos, yaw: yawTo([omarPos[0], omarPos[2]], [-5.0, -3.3]), look: omarLook });
      npcs.push({ id: 'carol', position: [-4.4, 0, -3.0], yaw: 2.35, look: carolLook });
      npcs.push({ id: 'ben', position: benPos, yaw: yawTo([benPos[0], benPos[2]], [0.3, 2.4]), look: benLook });
      npcs.push({ id: 'bg_sarah', position: [-1.1, 0, -2.0], yaw: yawTo([-1.1, -2.0], [0.12, -1.42]), look: sarahLook, collide: false });
    }

    // ------------------------------------------------------------------ result
    const MUG = [-0.42, TY + 0.1, -1.25];
    return {
      group,
      spawn: { position: [0, 0, 3], yaw: 0 },
      colliders,
      hotspots: [
        { id: 'laptop', position: [LX, 0.85, LZ], radius: 1.8, label: { ar: 'اللابتوب', en: 'Laptop' } },
        { id: 'fridge', position: [-5.0, 1.0, -3.3], radius: 1.9, label: { ar: 'المطبخ', en: 'Kitchen' } },
        { id: 'mail_table', position: [-2.0, 0.9, 3.95], radius: 1.7, label: { ar: 'طاولة البريد', en: 'Mail table' } }
      ],
      npcs,
      exit: { position: [4.5, 0, 4.0], radius: 1.5 },
      lights: 'day',

      update(dt, t) {
        // steam puffs rising from the teal mug
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.45 + i / 3) % 1;
          const s = steam[i];
          s.position.set(MUG[0] + Math.sin(t * 1.7 + i * 2) * 0.02 * k, MUG[1] + k * 0.3, MUG[2]);
          const sc = 0.6 + k * 1.6;
          s.scale.set(sc, sc * 1.3, sc);
          s.visible = k < 0.92;
        }
        // curtains breathe slightly (a window is ajar)
        curtains[0].rotation.x = Math.sin(t * 0.8) * 0.025;
        curtains[1].rotation.x = Math.sin(t * 0.8 + 1.3) * 0.025;
        // hold props up (after the engine's idle animation reset the arms)
        for (const p of posed) p.part.rotation.x = p.x + Math.sin(t * 1.3) * 0.03;
      },

      dispose() {
        for (const d of disposables) d?.dispose?.();
        disposables.length = 0;
      }
    };
  }
};
