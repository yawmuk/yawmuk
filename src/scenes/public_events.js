// «يومك» — public_events: the company end-of-year party in a downtown hotel ballroom (Friday 19:00, evening).
// Procedural low-poly geometry only. Repeated props use InstancedMesh; string/tree lights twinkle through a
// shader uniform (no per-frame allocations). Walls are inward-facing planes with LOW (1.1 m) colliders, so the
// player is blocked but the third-person camera can back "through" a wall and still see the hall (dollhouse view).
import { uniform, instanceIndex, vertexStage, materialColor, float, fract, sin, vec4 } from 'three/tsl';
import { carpetTex, wallTex, ceilingTex, curtainTex, windowTex, doorTex, bannerTex, tvTex } from './public_events/textures.js';

const W = 22, D = 16, H = 5;               // hall: x -11..11, z -8..8, ceiling 5 m
const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
const DEG = Math.PI / 180;

const yawTo = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));

export default {
  id: 'public_events',
  title: { ar: 'حفل نهاية العام للشركة', en: 'The Company Holiday Party' },

  build(ctx) {
    const { THREE } = ctx;
    const group = ctx.group || new THREE.Group();
    const colliders = [];
    const disposables = [];      // textures / geometries / instanced meshes we own
    const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpE = new THREE.Euler();
    const tmpC = new THREE.Color();

    // ------------------------------------------------------------------ helpers
    const matCache = new Map();
    const mat = (hex, o = {}) => {
      const k = hex + JSON.stringify(o);
      if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8, ...o }));
      return matCache.get(k);
    };
    const own = (x) => { disposables.push(x); return x; };
    const add = (mesh, { cast = true, receive = true } = {}) => { mesh.castShadow = cast; mesh.receiveShadow = receive; group.add(mesh); return mesh; };
    const boxAt = (w, h, d, m, x, y, z, o = {}) => {
      const mesh = new THREE.Mesh(own(new THREE.BoxGeometry(w, h, d)), m);
      mesh.position.set(x, y + h / 2, z);
      if (o.rotY) mesh.rotation.y = o.rotY;
      return add(mesh, o);
    };
    const cylAt = (rt, rb, h, m, x, y, z, o = {}) => {
      const mesh = new THREE.Mesh(own(new THREE.CylinderGeometry(rt, rb, h, o.seg || 16)), m);
      mesh.position.set(x, y + h / 2, z);
      return add(mesh, o);
    };
    /** vertical plane facing direction `face` ('+x','-x','+z','-z'); (x,z) on the wall, y = bottom */
    const panel = (w, h, m, x, y, z, face, o = {}) => {
      const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(w, h)), m);
      mesh.position.set(x, y + h / 2, z);
      mesh.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[face];
      return add(mesh, { cast: false, receive: true, ...o });
    };
    const collide = (minX, minZ, maxX, maxZ, h = 1.1) => colliders.push({ min: [minX, 0, minZ], max: [maxX, h, maxZ] });
    /** merge simple geometries into one non-indexed geometry (position+normal). */
    const merge = (geos) => {
      const parts = geos.map((g) => { const n = g.index ? g.toNonIndexed() : g; return n; });
      let count = 0; for (const p of parts) count += p.attributes.position.count;
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
      let o = 0;
      for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
      for (const g of geos) g.dispose();
      for (const p of parts) p.dispose();
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      return own(out);
    };
    const bx = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    const cy = (rt, rb, h, x, y, z, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z);
    /** InstancedMesh from a list of {p:[x,y,z], r:[rx,ry,rz]?, s:[sx,sy,sz]|number?, c:'#hex'?} */
    const instanced = (geo, m, list, o = {}) => {
      const im = new THREE.InstancedMesh(geo, m, list.length);
      list.forEach((it, i) => {
        tmpP.set(it.p[0], it.p[1], it.p[2]);
        tmpE.set(it.r?.[0] || 0, it.r?.[1] || 0, it.r?.[2] || 0); tmpQ.setFromEuler(tmpE);
        const s = it.s ?? 1; if (typeof s === 'number') tmpS.set(s, s, s); else tmpS.set(s[0], s[1], s[2]);
        tmpM.compose(tmpP, tmpQ, tmpS); im.setMatrixAt(i, tmpM);
        if (it.c) im.setColorAt(i, tmpC.set(it.c));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.computeBoundingBox();
      own(geo); disposables.push(im);
      return add(im, o);
    };

    // ------------------------------------------------------------------ palette
    const M = {
      linen: mat('#f6f1e6', { roughness: 0.95 }),
      gold: mat('#c9a227', { metalness: 0.7, roughness: 0.32 }),
      chairGold: mat('#d4ae3c', { metalness: 0.55, roughness: 0.35 }),
      ivory: mat('#efe6d2', { roughness: 0.9 }),
      woodDark: mat('#5b3a22', { roughness: 0.55 }),
      wood: mat('#8a5a35', { roughness: 0.6 }),
      redCloth: mat('#9e1f2c', { roughness: 0.95 }),
      skyCloth: mat('#8ec9e8', { roughness: 0.95 }),
      chrome: mat('#d7dde2', { metalness: 0.9, roughness: 0.18 }),
      black: mat('#16181b', { roughness: 0.4 }),
      plate: mat('#fbfbf8', { roughness: 0.35 }),
      candle: mat('#f4ecd8', { roughness: 0.7 }),
      greenery: mat('#2f5f3a', { roughness: 0.9, flatShading: true }),
      treeGreen: mat('#2c5a37', { roughness: 0.9, flatShading: true }),
      bottleDark: mat('#2a1418', { roughness: 0.2, metalness: 0.1 }),
      white: mat('#ffffff', { roughness: 0.7 }),
      instanced: mat('#ffffff', { roughness: 0.6 }),
      instancedShiny: mat('#ffffff', { roughness: 0.3, metalness: 0.35 })
    };
    const glassMat = new THREE.MeshStandardMaterial({ color: '#dfeff5', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const amberMat = new THREE.MeshStandardMaterial({ color: '#f0d77e', transparent: true, opacity: 0.88, roughness: 0.15 }); // sparkling apple juice
    const flameMat = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 1.8 });
    const glowMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd890', emissiveIntensity: 1.4 });
    const exitMat = new THREE.MeshStandardMaterial({ color: '#2ecc71', emissive: '#27e07a', emissiveIntensity: 1.5 });
    for (const m of [glassMat, amberMat, flameMat, glowMat, exitMat]) disposables.push(m);

    // twinkle material: instance colour × per-instance sine driven by a single time uniform (TSL; the per-bulb phase is
    // a hash of instanceIndex). Without node materials (headless tests) the bulbs simply stay lit.
    const uTime = uniform(0);
    const twinkleMat = new (THREE.MeshBasicNodeMaterial ?? THREE.MeshBasicMaterial)({ color: '#ffffff', toneMapped: false });
    if (twinkleMat.isNodeMaterial) {
      const ph = fract(sin(float(instanceIndex).mul(12.9898)).mul(43758.5453)).mul(6.283);
      const tw = vertexStage(sin(uTime.mul(fract(ph).mul(2.2).add(1.4)).add(ph.mul(4.0))).mul(0.4).add(0.6));
      twinkleMat.colorNode = vec4(materialColor.rgb.mul(tw), materialColor.a);
    }
    disposables.push(twinkleMat);

    // ------------------------------------------------------------------ shell: floor, ceiling, walls
    const tCarpet = own(carpetTex(THREE)), tWall = own(wallTex(THREE)), tCeil = own(ceilingTex(THREE));
    const tCurtain = own(curtainTex(THREE)), tWin = own(windowTex(THREE)), tDoor = own(doorTex(THREE)), tDoor1 = own(doorTex(THREE, true));
    const tBanner = own(bannerTex(THREE)), tTv = own(tvTex(THREE));
    const floorMat = new THREE.MeshStandardMaterial({ map: tCarpet, roughness: 1 });
    const wallMat = new THREE.MeshStandardMaterial({ map: tWall, roughness: 0.9 });
    const ceilMat = new THREE.MeshStandardMaterial({ map: tCeil, roughness: 0.95 });
    disposables.push(floorMat, wallMat, ceilMat);

    const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(W, D)), floorMat);
    floor.rotation.x = -Math.PI / 2; add(floor, { cast: false });
    const ceil = new THREE.Mesh(own(new THREE.PlaneGeometry(W, D)), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H; add(ceil, { cast: false, receive: false });

    panel(W, H, wallMat, 0, 0, Z0, '+z');   // north (stage)
    panel(W, H, wallMat, 0, 0, Z1, '-z');   // south (entrance)
    panel(D, H, wallMat, X0, 0, 0, '+x');   // west (windows + buffet)
    panel(D, H, wallMat, X1, 0, 0, '-x');   // east (exit + drinks)
    collide(X0 - 0.3, Z0 - 0.3, X1 + 0.3, Z0);
    collide(X0 - 0.3, Z1, X1 + 0.3, Z1 + 0.3);
    collide(X0 - 0.3, Z0, X0, Z1);
    collide(X1, Z0, X1 + 0.3, Z1);

    // entrance double doors (behind spawn) + side exit door to the parking lot
    const doorM = new THREE.MeshStandardMaterial({ map: tDoor, roughness: 0.6 });
    const door1M = new THREE.MeshStandardMaterial({ map: tDoor1, roughness: 0.6 });
    disposables.push(doorM, door1M);
    panel(2.6, 2.9, doorM, 0, 0, Z1 - 0.02, '-z');
    panel(1.3, 2.3, door1M, X1 - 0.02, 0, -6, '-x');
    boxAt(0.12, 0.22, 0.6, exitMat, X1 - 0.08, 2.5, -6, { cast: false });

    // pilasters with gilded capitals and warm sconces (N, W, E walls)
    const pil = [];
    for (const x of [-8.6, -5, 5, 8.6]) pil.push({ x, z: Z0 + 0.07, rot: 0 });
    for (const z of [-4.2, -1.3, 1.3, 4.2, 6.6]) { pil.push({ x: X0 + 0.07, z, rot: Math.PI / 2 }); pil.push({ x: X1 - 0.07, z, rot: Math.PI / 2 }); }
    instanced(new THREE.BoxGeometry(0.5, 4.6, 0.14), M.ivory, pil.map((p) => ({ p: [p.x, 2.3, p.z], r: [0, p.rot, 0] })), { cast: false });
    instanced(new THREE.BoxGeometry(0.64, 0.2, 0.22), M.gold, pil.map((p) => ({ p: [p.x, 4.62, p.z], r: [0, p.rot, 0] })), { cast: false });
    const sconce = pil.map((p) => {
      const inward = p.rot === 0 ? [0, 0.16] : p.x < 0 ? [0.16, 0] : [-0.16, 0];
      return { p: [p.x + inward[0], 2.75, p.z + inward[1]] };
    });
    instanced(new THREE.SphereGeometry(0.11, 10, 8), glowMat, sconce, { cast: false });

    // west windows (dusk downtown) with burgundy drapes
    const winM = new THREE.MeshBasicMaterial({ map: tWin, toneMapped: true });
    disposables.push(winM);
    const winZ = [-2.65, 0, 2.65];
    instanced(new THREE.PlaneGeometry(1.4, 3), winM, winZ.map((z) => ({ p: [X0 + 0.03, 2.8, z], r: [0, Math.PI / 2, 0] })), { cast: false });
    instanced(new THREE.BoxGeometry(0.12, 3.6, 0.32), M.redCloth,
      winZ.flatMap((z) => [{ p: [X0 + 0.1, 2.9, z - 0.82] }, { p: [X0 + 0.1, 2.9, z + 0.82] }]), { cast: false });

    // ------------------------------------------------------------------ stage (back wall, centre)
    boxAt(6, 0.45, 1.8, M.woodDark, 0, 0, Z0 + 0.9);
    boxAt(6.02, 0.06, 1.82, M.gold, 0, 0.42, Z0 + 0.9, { cast: false });
    boxAt(1.4, 0.22, 0.4, M.woodDark, 0, 0, Z0 + 2.0);
    collide(-3, Z0, 3, Z0 + 2.2);
    const curtM = new THREE.MeshStandardMaterial({ map: tCurtain, roughness: 1 });
    disposables.push(curtM);
    panel(7.2, 4.3, curtM, 0, 0.45, Z0 + 0.04, '+z');
    boxAt(7.6, 0.5, 0.25, M.gold, 0, 4.3, Z0 + 0.15, { cast: false });
    boxAt(0.62, 1.05, 0.45, M.wood, 1.9, 0.45, Z0 + 1.0);                    // podium
    boxAt(0.7, 0.06, 0.52, M.gold, 1.9, 1.5, Z0 + 1.0, { cast: false });
    cylAt(0.012, 0.012, 0.35, M.black, 1.9, 1.56, Z0 + 1.15, { seg: 6 });       // mic
    // poinsettias flanking the stage
    const potPts = [[-3.5, Z0 + 1.6], [3.5, Z0 + 1.6]];
    instanced(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 10), M.gold, potPts.map(([x, z]) => ({ p: [x, 0.2, z] })));
    instanced(new THREE.IcosahedronGeometry(0.36, 0), mat('#b3202c', { flatShading: true }), potPts.map(([x, z]) => ({ p: [x, 0.62, z], s: [1, 0.6, 1] })));
    collide(-3.8, Z0 + 1.3, -3.2, Z0 + 1.9); collide(3.2, Z0 + 1.3, 3.8, Z0 + 1.9);

    // ------------------------------------------------------------------ holiday tree (back-left corner)
    const TREE = [-9.1, -6.2];
    const cones = [[1.45, 1.4, 0.35], [1.15, 1.2, 1.2], [0.85, 1.0, 1.95], [0.5, 0.8, 2.6]]; // r, h, base y
    const treeGeo = merge(cones.map(([r, h, y]) => new THREE.ConeGeometry(r, h, 9).translate(0, y + h / 2, 0)));
    const tree = new THREE.Mesh(treeGeo, M.treeGreen); tree.position.set(TREE[0], 0, TREE[1]); add(tree);
    cylAt(0.16, 0.2, 0.4, M.woodDark, TREE[0], 0, TREE[1], { seg: 8 });
    cylAt(1.6, 1.7, 0.04, M.redCloth, TREE[0], 0, TREE[1], { seg: 20, cast: false });
    const star = new THREE.Mesh(own(new THREE.OctahedronGeometry(0.2, 0)), glowMat);
    star.position.set(TREE[0], 3.55, TREE[1]); add(star, { cast: false });
    collide(TREE[0] - 1.4, TREE[1] - 1.4, TREE[0] + 1.4, TREE[1] + 1.4);
    const treeR = (y) => { let r = 0; for (const [cr, ch, cy0] of cones) if (y >= cy0 && y <= cy0 + ch) r = Math.max(r, cr * (1 - (y - cy0) / ch)); return r; };
    const ornaments = [];
    const ornCols = ['#c9a227', '#b3202c', '#c0c4c8', '#2b5f9e'];
    for (let i = 0; i < 26; i++) {
      const u = (i + 0.5) / 26, y = 0.55 + u * 2.6, a = i * 2.39;
      const r = treeR(y) * 0.86 + 0.04;
      ornaments.push({ p: [TREE[0] + Math.cos(a) * r, y, TREE[1] + Math.sin(a) * r], c: ornCols[i % 4] });
    }
    instanced(new THREE.SphereGeometry(0.075, 8, 6), M.instancedShiny, ornaments, { cast: false });

    // ------------------------------------------------------------------ lights: string strands + tree bulbs (one twinkling InstancedMesh)
    const bulbs = [];
    const wire = [];
    const strandZ = [-5.6, -2.2, 1.2, 4.6];
    for (const z of strandZ) {
      const N = 34, sag = (x) => 4.7 - 0.75 * (1 - (x / X1) ** 2);
      for (let i = 0; i <= 40; i++) {
        const xa = X0 + (W * i) / 40, xb = X0 + (W * (i + 1)) / 40;
        if (i < 40) wire.push(xa, sag(xa), z, xb, sag(xb), z);
      }
      for (let i = 0; i < N; i++) { const x = X0 + 0.4 + ((W - 0.8) * i) / (N - 1); bulbs.push({ p: [x, sag(x) - 0.06, z], c: '#ffd27a' }); }
    }
    const treeCols = ['#ff5a4f', '#ffd27a', '#6fb3ff', '#7ee08a', '#ffffff'];
    for (let i = 0; i < 64; i++) {
      const u = (i + 0.5) / 64, y = 0.45 + u * 2.85, a = u * Math.PI * 2 * 6;
      const r = treeR(y) * 0.9 + 0.05;
      bulbs.push({ p: [TREE[0] + Math.cos(a) * r, y, TREE[1] + Math.sin(a) * r], c: treeCols[i % 5] });
    }
    instanced(new THREE.IcosahedronGeometry(0.045, 0), twinkleMat, bulbs, { cast: false, receive: false });

    // ------------------------------------------------------------------ chandeliers
    const CH = [[-5, -2.9], [0, -1], [5, -2.9]];
    const CHY = 4.15;
    instanced(new THREE.TorusGeometry(0.6, 0.035, 6, 24), M.gold, CH.map(([x, z]) => ({ p: [x, CHY, z], r: [Math.PI / 2, 0, 0] })), { cast: false });
    instanced(new THREE.CylinderGeometry(0.015, 0.015, H - CHY, 5), M.gold, CH.map(([x, z]) => ({ p: [x, (H + CHY) / 2, z] })), { cast: false });
    const chGlow = [];
    for (const [x, z] of CH) {
      chGlow.push({ p: [x, CHY - 0.05, z], s: 1.7 });
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; chGlow.push({ p: [x + Math.cos(a) * 0.6, CHY + 0.1, z + Math.sin(a) * 0.6], s: 0.7 }); }
    }
    instanced(new THREE.IcosahedronGeometry(0.1, 1), glowMat, chGlow, { cast: false, receive: false });

    // ------------------------------------------------------------------ round dinner tables (6) with chairs, plates, glasses, candles
    // slot k sits at angle off + k*45°; 'chair' (default), 'stand' (plate, no chair — a guest stands there), 'empty'
    const TABLES = [
      { c: [0, -1], off: 41.6 * DEG, slots: { 0: 'stand', 1: 'empty', 3: 'stand', 4: 'stand' }, jake: true },
      { c: [-5, -1.2], off: 22.5 * DEG, slots: { 5: 'stand', 6: 'stand' } },
      { c: [5, -1.2], off: 22.5 * DEG, slots: { 6: 'stand' } },
      { c: [-5.6, -4.9], off: 0, slots: {} },
      { c: [5.6, -4.9], off: 22.5 * DEG, slots: { 5: 'stand' } },
      { c: [0, -4.5], off: 0, slots: { 2: 'empty' } }
    ];
    const slotPos = (t, k, r) => { const a = t.off + k * Math.PI / 4; return [t.c[0] + Math.cos(a) * r, t.c[1] + Math.sin(a) * r, a]; };
    const cloths = [], plates = [], glasses = [], liquids = [], candles = [], flames = [], bases = [], greens = [], chairs = [];
    let liquidN = 0;
    for (const t of TABLES) {
      cloths.push({ p: [t.c[0], 0.38, t.c[1]] });
      collide(t.c[0] - 0.8, t.c[1] - 0.8, t.c[0] + 0.8, t.c[1] + 0.8, 0.8); // square inscribed-ish in the round cloth
      bases.push({ p: [t.c[0], 0.775, t.c[1]] });
      greens.push({ p: [t.c[0], 0.83, t.c[1]], s: [1, 0.35, 1] });
      for (let k = 0; k < 3; k++) {
        const a = k * 2.094 + 0.3, cx = t.c[0] + Math.cos(a) * 0.14, cz = t.c[1] + Math.sin(a) * 0.14, h = 0.16 + k * 0.05;
        candles.push({ p: [cx, 0.79 + h / 2, cz], s: [1, h / 0.2, 1] });
        flames.push({ p: [cx, 0.79 + h + 0.03, cz] });
      }
      for (let k = 0; k < 8; k++) {
        const kind = t.slots[k] || 'chair';
        if (kind === 'empty') continue;
        const [px, pz] = slotPos(t, k, 0.66);
        plates.push({ p: [px, 0.765, pz] });
        const ga = t.off + k * Math.PI / 4 - 0.2;
        const gx = t.c[0] + Math.cos(ga) * 0.62, gz = t.c[1] + Math.sin(ga) * 0.62;
        glasses.push({ p: [gx, 0.84, gz] });
        const red = t.jake && (k === 0 || k === 3 || k === 6);
        liquids.push({ p: [gx, 0.8, gz], c: red ? '#4a0c18' : (liquidN++ % 3 === 2 ? '#e9a23b' : '#cfe6f0') });
        if (kind === 'chair') {
          const [cx, cz, a] = slotPos(t, k, 1.22);
          chairs.push({ p: [cx, 0, cz], r: [0, Math.atan2(-Math.cos(a), -Math.sin(a)), 0] });
          collide(cx - 0.23, cz - 0.23, cx + 0.23, cz + 0.23, 0.95);
        }
      }
    }
    instanced(new THREE.CylinderGeometry(0.92, 0.99, 0.76, 28), M.linen, cloths);
    instanced(new THREE.CylinderGeometry(0.13, 0.11, 0.015, 16), M.plate, plates, { cast: false });
    instanced(new THREE.CylinderGeometry(0.036, 0.028, 0.15, 10, 1, true), glassMat, glasses, { cast: false, receive: false });
    instanced(new THREE.CylinderGeometry(0.03, 0.026, 0.07, 8), M.instanced, liquids, { cast: false });
    instanced(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), M.candle, candles, { cast: false });
    instanced(new THREE.ConeGeometry(0.018, 0.05, 6), flameMat, flames, { cast: false, receive: false });
    instanced(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 16), M.gold, bases, { cast: false });
    instanced(new THREE.IcosahedronGeometry(0.2, 0), M.greenery, greens, { cast: false });
    // Chiavari chair: gold frame (merged) + ivory cushion; sitter faces local +z
    const chairGeo = merge([
      bx(0.42, 0.04, 0.4, 0, 0.45, 0),
      cy(0.015, 0.015, 0.45, -0.19, 0.225, 0.18, 5), cy(0.015, 0.015, 0.45, 0.19, 0.225, 0.18, 5),
      cy(0.015, 0.015, 0.95, -0.19, 0.475, -0.18, 5), cy(0.015, 0.015, 0.95, 0.19, 0.475, -0.18, 5),
      bx(0.4, 0.03, 0.03, 0, 0.94, -0.18), bx(0.4, 0.025, 0.025, 0, 0.72, -0.18),
      cy(0.01, 0.01, 0.45, -0.07, 0.7, -0.18, 4), cy(0.01, 0.01, 0.45, 0.07, 0.7, -0.18, 4)
    ]);
    instanced(chairGeo, M.chairGold, chairs);
    instanced(new THREE.BoxGeometry(0.4, 0.05, 0.38), M.ivory, chairs.map((c) => ({ p: [c.p[0], 0.495, c.p[2]], r: c.r })), { cast: false });
    // Jake's table: two dark unlabelled bottles
    const bottleGeo = merge([cy(0.038, 0.04, 0.22, 0, 0.11, 0, 10), cy(0.014, 0.034, 0.06, 0, 0.25, 0, 8), cy(0.014, 0.014, 0.08, 0, 0.32, 0, 6)]);
    instanced(bottleGeo, M.bottleDark, [{ p: [0.28, 0.77, -1.2] }, { p: [-0.22, 0.77, -0.75] }]);

    // ------------------------------------------------------------------ gift-exchange table (left of the entrance)
    const GT = [-6.3, 5.0];
    boxAt(0.85, 0.76, 1.8, M.redCloth, GT[0], 0, GT[1]);
    boxAt(0.87, 0.03, 1.82, M.gold, GT[0], 0.72, GT[1], { cast: false });
    collide(GT[0] - 0.45, GT[1] - 0.92, GT[0] + 0.45, GT[1] + 0.92);
    const RED = '#b3262e', GRN = '#2e6b3f', GLD = '#d4a838', SLV = '#c0c4c8', WHT = '#f5f1e8';
    const gifts = [
      // [x, y(bottom), z, w, h, d, box colour, ribbon colour, rotY]
      [-6.45, 0.77, 4.3, 0.34, 0.24, 0.3, RED, GLD, 0.2], [-6.1, 0.77, 4.45, 0.24, 0.32, 0.24, GRN, RED, -0.3],
      [-6.45, 0.77, 4.85, 0.3, 0.2, 0.36, GLD, RED, 0], [-6.12, 0.77, 4.95, 0.22, 0.18, 0.22, SLV, RED, 0.4],
      [-6.45, 0.97, 4.82, 0.2, 0.16, 0.2, RED, WHT, 0.5], [-6.42, 0.77, 5.4, 0.36, 0.3, 0.34, GRN, GLD, -0.15],
      [-6.1, 0.77, 5.45, 0.24, 0.24, 0.24, RED, GLD, 0.25], [-6.4, 1.07, 5.4, 0.22, 0.18, 0.2, SLV, GRN, 0.3],
      [-6.12, 0.77, 5.85, 0.26, 0.2, 0.28, GLD, GRN, 0], [-6.45, 0.77, 5.8, 0.22, 0.34, 0.22, RED, WHT, -0.4],
      // under the tree
      [-8.0, 0.04, -5.2, 0.4, 0.3, 0.4, RED, GLD, 0.3], [-8.4, 0.04, -4.95, 0.3, 0.22, 0.3, GLD, RED, -0.2],
      [-9.9, 0.04, -5.0, 0.36, 0.28, 0.32, GRN, GLD, 0.5], [-7.9, 0.04, -6.1, 0.3, 0.36, 0.3, SLV, RED, 0.1],
      // raffle prize on its pedestal
      [6.95, 0.9, 3.45, 0.42, 0.36, 0.42, '#2b5f9e', '#f2f2f2', 0.3]
    ];
    const giftBoxes = [], ribbons = [], bows = [];
    for (const [x, y, z, w, h, d, col, rib, ry] of gifts) {
      giftBoxes.push({ p: [x, y, z], s: [w, h, d], r: [0, ry, 0], c: col });
      ribbons.push({ p: [x, y - 0.004, z], s: [w + 0.012, h + 0.01, 0.04], r: [0, ry, 0], c: rib });
      ribbons.push({ p: [x, y - 0.004, z], s: [0.04, h + 0.01, d + 0.012], r: [0, ry, 0], c: rib });
      bows.push({ p: [x, y + h + 0.025, z], s: [1, 0.55, 1], r: [0, ry, 0], c: rib });
    }
    const unitBox = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    instanced(unitBox(), M.instanced, giftBoxes);
    instanced(unitBox(), M.instancedShiny, ribbons, { cast: false });
    instanced(new THREE.TorusKnotGeometry(0.035, 0.012, 24, 4, 2, 3), M.instancedShiny, bows, { cast: false });

    // ------------------------------------------------------------------ charity raffle booth (right of the entrance)
    const RB = [5.6, 5.0];
    boxAt(0.8, 0.76, 1.8, M.skyCloth, RB[0], 0, RB[1]);
    collide(RB[0] - 0.42, RB[1] - 0.92, RB[0] + 0.42, RB[1] + 0.92);
    const banM = new THREE.MeshStandardMaterial({ map: tBanner, roughness: 0.95 });
    disposables.push(banM);
    panel(1.7, 0.53, banM, RB[0] - 0.41, 0.12, RB[1], '-x');                                   // front drape
    // overhead banner on two poles
    cylAt(0.025, 0.025, 2.5, M.chrome, RB[0] + 0.2, 0, RB[1] - 0.95, { seg: 6 });
    cylAt(0.025, 0.025, 2.5, M.chrome, RB[0] + 0.2, 0, RB[1] + 0.95, { seg: 6 });
    panel(1.9, 0.6, banM, RB[0] + 0.2, 1.85, RB[1], '-x');
    // ticket jars (glass + coloured fill)
    const jars = [[RB[0] - 0.05, RB[1] - 0.35, 0.22, '#d64545'], [RB[0] - 0.05, RB[1] + 0.35, 0.13, '#f5f5f5']];
    instanced(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 16, 1, true), glassMat, jars.map(([x, z]) => ({ p: [x, 0.92, z] })), { cast: false, receive: false });
    instanced(new THREE.CylinderGeometry(0.125, 0.125, 1, 14).translate(0, 0.5, 0), M.instanced,
      jars.map(([x, z, h, c]) => ({ p: [x, 0.77, z], s: [1, h, 1], c })), { cast: false });
    // [Phase 3] small transparent donation box between the jars (bills inside, gold slotted lid)
    const donGlass = new THREE.Mesh(own(new THREE.BoxGeometry(0.22, 0.2, 0.2)), glassMat);
    donGlass.position.set(RB[0] - 0.08, 0.87, RB[1]); add(donGlass, { cast: false, receive: false });
    boxAt(0.18, 0.07, 0.16, mat('#7fae6a', { roughness: 0.9 }), RB[0] - 0.08, 0.775, RB[1], { cast: false });
    boxAt(0.23, 0.015, 0.21, M.gold, RB[0] - 0.08, 0.97, RB[1], { cast: false });
    // big TV prize on a stand
    const TV = [7.45, 5.0];
    cylAt(0.35, 0.35, 0.04, M.black, TV[0], 0, TV[1], { seg: 16 });
    cylAt(0.035, 0.035, 1.3, M.black, TV[0], 0, TV[1], { seg: 8 });
    boxAt(0.07, 0.9, 1.5, M.black, TV[0], 1.15, TV[1]);
    const tvM = new THREE.MeshBasicMaterial({ map: tTv });
    disposables.push(tvM);
    panel(1.4, 0.8, tvM, TV[0] - 0.04, 1.2, TV[1], '-x');
    collide(TV[0] - 0.36, TV[1] - 0.76, TV[0] + 0.36, TV[1] + 0.76);
    // prize pedestal + balloons
    cylAt(0.3, 0.3, 0.9, M.white, 6.95, 0, 3.45, { seg: 16 });
    collide(6.6, 3.1, 7.3, 3.8);
    const balloons = [[RB[0] - 0.1, 2.75, RB[1] - 1.05, '#8ec9e8'], [RB[0] + 0.1, 2.95, RB[1] - 0.9, '#ffffff'], [RB[0] + 0.25, 2.7, RB[1] - 1.15, '#e0505e']];
    instanced(new THREE.SphereGeometry(0.2, 12, 10), M.instancedShiny, balloons.map(([x, y, z, c]) => ({ p: [x, y, z], s: [1, 1.18, 1], c })), { cast: false });
    for (const [x, y, z] of balloons) wire.push(x, y - 0.23, z, RB[0] + 0.2, 1.4, RB[1] - 0.95);

    const wireGeo = own(new THREE.BufferGeometry());
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    const wireMat = new THREE.LineBasicMaterial({ color: '#3a2a1a' });
    disposables.push(wireMat);
    group.add(new THREE.LineSegments(wireGeo, wireMat));

    // ------------------------------------------------------------------ buffet (west wall, under the windows)
    const BF = [-10.25, 0.1];
    boxAt(0.8, 0.78, 4.8, M.linen, BF[0], 0, BF[1]);
    boxAt(0.82, 0.12, 4.82, M.redCloth, BF[0], 0.6, BF[1], { cast: false });
    collide(BF[0] - 0.42, BF[1] - 2.42, BF[0] + 0.42, BF[1] + 2.42);
    const dishZ = [-1.7, -0.6, 0.5, 1.6];
    instanced(new THREE.BoxGeometry(0.34, 0.1, 0.5), M.chrome, dishZ.map((z) => ({ p: [BF[0], 0.83, z] })));
    instanced(new THREE.SphereGeometry(0.25, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.chrome, dishZ.map((z) => ({ p: [BF[0], 0.88, z], s: [0.68, 0.5, 1] })), { cast: false });
    cylAt(0.13, 0.13, 0.14, M.plate, BF[0], 0.78, 2.25, { seg: 16 });
    cylAt(0.2, 0.14, 0.08, M.wood, BF[0], 0.78, -2.25, { seg: 14 });
    const fruit = [];
    const fCols = ['#c0392b', '#e67e22', '#f1c40f', '#7cb342'];
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.05 + (i % 3) * 0.04; fruit.push({ p: [BF[0] + Math.cos(a) * r, 0.9 + (i > 5 ? 0.05 : 0), -2.25 + Math.sin(a) * r], c: fCols[i % 4] }); }
    instanced(new THREE.SphereGeometry(0.045, 8, 6), M.instanced, fruit, { cast: false });

    // ------------------------------------------------------------------ coffee & sparkling apple-juice table (front-right, east wall)
    const CT = [10.25, 2.7];
    boxAt(0.7, 0.78, 2.6, M.linen, CT[0], 0, CT[1]);
    boxAt(0.3, 0.005, 2.62, mat('#2e6b3f', { roughness: 1 }), CT[0], 0.78, CT[1], { cast: false });
    collide(CT[0] - 0.37, CT[1] - 1.32, CT[0] + 0.37, CT[1] + 1.32);
    cylAt(0.13, 0.13, 0.42, M.chrome, CT[0], 0.78, 1.75, { seg: 14 });
    cylAt(0.05, 0.13, 0.08, M.chrome, CT[0], 1.2, 1.75, { seg: 14 });
    const ciderGeo = merge([cy(0.04, 0.042, 0.22, 0, 0.11, 0, 10), cy(0.015, 0.036, 0.07, 0, 0.255, 0, 8), cy(0.016, 0.016, 0.06, 0, 0.32, 0, 6)]);
    const ciderPts = [2.2, 2.35, 2.5, 2.65].map((z, i) => [CT[0] - 0.06 * (i % 2), z]);
    instanced(ciderGeo, amberMat, ciderPts.map(([x, z]) => ({ p: [x, 0.78, z] })), { cast: false });
    instanced(new THREE.CylinderGeometry(0.02, 0.02, 0.035, 8), mat('#2e8b3f', { roughness: 0.5 }), ciderPts.map(([x, z]) => ({ p: [x, 0.78 + 0.367, z] })), { cast: false });
    const cups = [];
    for (let i = 0; i < 8; i++) cups.push({ p: [CT[0] - 0.18 + (i % 2) * 0.1, 0.82, 1.95 + Math.floor(i / 2) * 0.09] });
    instanced(new THREE.CylinderGeometry(0.035, 0.028, 0.08, 8), M.plate, cups, { cast: false });
    cylAt(0.22, 0.22, 0.02, M.gold, CT[0], 0.88, 3.4, { seg: 16 });
    cylAt(0.14, 0.14, 0.02, M.gold, CT[0], 1.08, 3.4, { seg: 16 });
    cylAt(0.015, 0.015, 0.32, M.gold, CT[0], 0.78, 3.4, { seg: 6 });
    const sweets = [];
    const sCols = ['#f4d6e0', '#7a4a2e', '#f2e2b8', '#c0392b', '#ffffff'];
    for (let i = 0; i < 12; i++) { const a = i * 0.9, top = i >= 8, r = top ? 0.08 : 0.15; sweets.push({ p: [CT[0] + Math.cos(a) * r, top ? 1.12 : 0.92, 3.4 + Math.sin(a) * r], c: sCols[i % 5] }); }
    instanced(new THREE.BoxGeometry(0.06, 0.04, 0.06), M.instanced, sweets, { cast: false });

    // ------------------------------------------------------------------ warm practical lights (no shadows)
    const pl = (hex, i, d, x, y, z) => { const l = new THREE.PointLight(hex, i, d, 2); l.position.set(x, y, z); group.add(l); return l; };
    // [Phase 3 QA] 5 -> 3 lights (README budget). The centre light now also reaches the stage (range 13 -> 16,
    // moved back to z -2.6); the tree glow comes from its emissive twinkle bulbs.
    pl('#ffcf8a', 24, 16, 0, 3.6, -2.6);       // over Jake's table / centre + stage
    pl('#ffcf8a', 13, 11, -6.2, 3.2, 3.6);     // gift table + tree side
    pl('#ffe2b0', 12, 10, 6.2, 3.2, 4.4);      // raffle booth

    // ------------------------------------------------------------------ NPCs (engine builds them; Dave gets a Santa hat)
    const daveLook = { skin: '#f0c8a8', shirt: '#2e6b3f', pants: '#3b3a36', hair: '#9a9a9a', height: 1.78, build: 1.08 };
    let daveObj;
    if (typeof ctx.makeNPC === 'function') {
      daveObj = ctx.makeNPC(daveLook);
      const head = daveObj.userData.parts?.head;
      if (head) {
        const hat = new THREE.Group();
        const hatRed = new THREE.MeshStandardMaterial({ color: '#c0262e', roughness: 0.9 });
        const fur = new THREE.MeshStandardMaterial({ color: '#f6f6f2', roughness: 1 });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.135, 0.3, 12), hatRed);
        cone.position.set(0, 0.17, 0.02); cone.rotation.x = 0.35;
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.032, 6, 16), fur);
        band.rotation.x = Math.PI / 2; band.position.set(0, 0.05, 0.01);
        const pom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), fur);
        pom.position.set(0, 0.29, 0.08);
        for (const m of [cone, band, pom]) { m.castShadow = true; hat.add(m); }
        head.add(hat);
      }
    }
    const P = (id, pos, yaw, look, extra = {}) => ({ id, position: [pos[0], 0, pos[1]], yaw, look, ...extra });
    // [Phase 3 perf] background guests are baked: makeNPC's ~20 meshes are merged into ONE mesh with vertex
    // colours (all bg guests share one material) and passed as `object` with animate:false. Only the
    // situation NPCs (samir, rania) stay as full animated engine figures.
    const bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    disposables.push(bakedMat);
    const tmpCol = new THREE.Color();
    const bake = (fig) => {
      fig.updateMatrixWorld(true);
      const parts = [];
      fig.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        tmpCol.copy(o.material.color);
        for (let i = 0; i < n; i++) { col[i * 3] = tmpCol.r; col[i * 3 + 1] = tmpCol.g; col[i * 3 + 2] = tmpCol.b; }
        parts.push({ g, col });
        if (!o.geometry.userData?.shared) o.geometry.dispose();
        if (!o.material.userData?.shared) o.material.dispose();
      });
      let count = 0; for (const p of parts) count += p.g.attributes.position.count;
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
      let off = 0;
      for (const p of parts) { pos.set(p.g.attributes.position.array, off * 3); nor.set(p.g.attributes.normal.array, off * 3); col.set(p.col, off * 3); off += p.g.attributes.position.count; p.g.dispose(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, bakedMat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      return mesh;
    };
    const BG = (id, pos, yaw, look, prebuilt) => {
      if (typeof ctx.makeNPC !== 'function') return P(id, pos, yaw, look);
      return P(id, pos, yaw, look, { object: bake(prebuilt || ctx.makeNPC(look)), animate: false, showName: false });
    };
    const jakeTable = TABLES[0];
    const sp = (t, k) => { const [x, z] = slotPos(t, k, 1.25); return [x, z]; };
    const emilyPos = sp(jakeTable, 4);
    const aminaPos = sp(TABLES[1], 6), marcusPos = sp(TABLES[1], 5), gracePos = sp(TABLES[2], 6), kenjiPos = sp(TABLES[4], 5);
    // [Phase 3 premise change] samir (Muslim coworker) leads gift_table + dinner_table via `stations`
    // (engine moves him to the next unfinished station; `position` = first station as a fallback).
    // rania (purple hijab) runs the raffle booth; dave/jake/linda/emily are background colleagues.
    const samirGift = [-5, 3.9], samirDinner = [0.9, -0.2];
    const samirGiftYaw = yawTo(samirGift, [-1, 6.4]), samirDinnerYaw = yawTo(samirDinner, [0, 6.6]);
    const raniaPos = [4.65, 4.0], sarahPos = [8.7, 0.7], davePos = [-4, 5.5];
    const jakePos = sp(jakeTable, 3);
    const npcs = [
      P('samir', samirGift, samirGiftYaw, { skin: '#c99a6e', shirt: '#f4f4f4', suit: '#2b2b2b', tie: '#f4f4f4', pants: '#2b2b2b', hair: '#1e1611', beard: '#1e1611', glasses: true, height: 1.78 }, {
        stations: {
          gift_table: { position: [samirGift[0], 0, samirGift[1]], yaw: samirGiftYaw },
          dinner_table: { position: [samirDinner[0], 0, samirDinner[1]], yaw: samirDinnerYaw }
        }
      }),
      P('rania', raniaPos, yawTo(raniaPos, [0, 6.6]), { skin: '#d1a17a', shirt: '#7d7d85', dress: '#7d7d85', hijab: '#6a4c93', hijabColor: '#6a4c93', height: 1.65 }),
      BG('bg_dave', davePos, yawTo(davePos, [-6.3, 5]), daveLook, daveObj),
      BG('bg_jake', jakePos, yawTo(jakePos, jakeTable.c), { skin: '#f1c27d', shirt: '#f4f4f4', suit: '#1c1c1c', tie: '#f4f4f4', hair: '#c9a45c', beard: '#c9a45c', pants: '#1c1c1c', height: 1.82, build: 1.1 }),
      BG('bg_linda', [6.55, 5.0], yawTo([6.55, 5.0], [0, 7]), { skin: '#e0b98f', shirt: '#2b5f9e', dress: '#2b5f9e', hair: '#141414', pants: '#2b5f9e', height: 1.67 }),
      BG('bg_emily', emilyPos, yawTo(emilyPos, jakeTable.c), { skin: '#f3d3b5', shirt: '#8e3b46', dress: '#8e3b46', hair: '#b5442a', height: 1.65 }),
      BG('bg_sarah', sarahPos, yawTo(sarahPos, [9.1, 1.85]), { skin: '#f1cfae', shirt: '#1f3b5c', dress: '#1f3b5c', hair: '#7b3f20', height: 1.66 }),
      BG('bg_priya', [9.25, 3.3], yawTo([9.25, 3.3], [8.6, 1.9]), { skin: '#a0673d', shirt: '#e07a5f', dress: '#e07a5f', hair: '#1e1611', height: 1.62, build: 1.15 }),
      BG('bg_tom', [9.1, 1.85], yawTo([9.1, 1.85], [9.25, 3.3]), { skin: '#f1c27d', shirt: '#4a4a4a', suit: '#4a4a4a', tie: '#7a2236', hair: '#b8b8b8', height: 1.78 }),
      BG('bg_amina', aminaPos, yawTo(aminaPos, TABLES[1].c), { skin: '#c99a6e', shirt: '#5b3f7a', hijab: '#2f3e66', dress: '#3b2f55', height: 1.64 }),
      BG('bg_marcus', marcusPos, yawTo(marcusPos, aminaPos), { skin: '#5a3a22', shirt: '#f2f2f2', suit: '#2a2a35', tie: '#8e2b2b', hair: '#141414', height: 1.83 }),
      BG('bg_grace', gracePos, yawTo(gracePos, TABLES[2].c), { skin: '#f0d5b8', shirt: '#2e7d6b', dress: '#2e7d6b', hair: '#d4a76a', height: 1.66 }),
      BG('bg_kenji', kenjiPos, yawTo(kenjiPos, TABLES[4].c), { skin: '#e8c39e', shirt: '#d9d4c7', suit: '#3a4a5a', tie: '#c9a227', hair: '#111111', glasses: true, height: 1.74 })
    ];

    // ------------------------------------------------------------------ hotspots / spawn / exit
    const hotspots = [
      { id: 'gift_table', position: [-6.1, 0.9, 5.0], radius: 1.8, markerHeight: 1.35, label: { ar: 'طاولة تبادل الهدايا', en: 'Gift exchange table' } },
      { id: 'dinner_table', position: [0, 0.8, -1.0], radius: 2.0, markerHeight: 1.45, label: { ar: 'مائدة جيك', en: "Jake's table" } },
      { id: 'raffle_booth', position: [5.6, 0.9, 5.0], radius: 1.8, markerHeight: 1.35, label: { ar: 'كشك السحب الخيري', en: 'Charity raffle booth' } }
    ];

    // [Phase 3 perf] merge static decor per material: every plain (non-instanced) mesh directly in `group`
    // that shares a material with others becomes one mesh (positions, normals, uvs baked in world space).
    // The rotating star stays separate. Draw calls drop by ~40.
    {
      const buckets = new Map();
      for (const o of group.children) {
        if (!o.isMesh || o.isInstancedMesh || o === star) continue;
        const k = o.material.uuid;
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(o);
      }
      group.updateMatrixWorld(true);
      for (const list of buckets.values()) {
        if (list.length < 2) continue;
        const geos = list.map((o) => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); return g; });
        let n = 0; for (const g of geos) n += g.attributes.position.count;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
        let off = 0;
        for (const g of geos) {
          const c = g.attributes.position.count;
          pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
          off += c; g.dispose();
        }
        const geo = own(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        geo.computeBoundingSphere();
        const merged = new THREE.Mesh(geo, list[0].material);
        merged.castShadow = list.some((o) => o.castShadow);
        merged.receiveShadow = list.some((o) => o.receiveShadow);
        for (const o of list) { group.remove(o); o.geometry.dispose(); }
        group.add(merged);
      }
    }

    // [Content: the toast] the declined toast glass — a tall transparent flute of champagne on the cloth edge of
    // Jake's table, on Samir's side (dinner_table hotspot), beside the slot-0 plate. Added after the merge pass
    // so it stays its own mesh; taller than the instanced place glasses (0.15 m) so it reads as "the" glass.
    {
      const toastGlassMat = own(new THREE.MeshStandardMaterial({ color: '#eaf6fa', transparent: true, opacity: 0.4, roughness: 0.04, metalness: 0.15, depthWrite: false, side: THREE.DoubleSide }));
      const toastWineMat = own(new THREE.MeshStandardMaterial({ color: '#f2dc8c', transparent: true, opacity: 0.72, roughness: 0.1 }));
      const a = 56 * DEG, top = 0.765;
      const gx = jakeTable.c[0] + Math.cos(a) * 0.58, gz = jakeTable.c[1] + Math.sin(a) * 0.58;
      const o = { cast: false, receive: false };
      cylAt(0.042, 0.045, 0.008, toastGlassMat, gx, top, gz, { ...o, seg: 20 }); // foot
      cylAt(0.006, 0.007, 0.09, toastGlassMat, gx, top + 0.008, gz, { ...o, seg: 8 }); // stem
      const bowl = new THREE.Mesh(own(new THREE.CylinderGeometry(0.04, 0.022, 0.15, 20, 1, true)), toastGlassMat);
      bowl.position.set(gx, top + 0.098 + 0.075, gz);
      bowl.renderOrder = 2;
      add(bowl, o);
      cylAt(0.034, 0.022, 0.105, toastWineMat, gx, top + 0.1, gz, { ...o, seg: 16 }); // champagne
    }

    let flick = 0;
    return {
      group,
      spawn: { position: [0, 0, 6.6], yaw: 0 },
      colliders,
      hotspots,
      npcs,
      exit: { position: [10, 0, -6], radius: 1.5 },
      lights: 'evening',
      // [Phase 3 QA] the evening preset background (salmon) showed as a flat band below the floor edge at spawn;
      // a dark ballroom-lobby tone reads as "outside the dollhouse cut" instead.
      sky: '#24171a',
      update(dt, t) {
        uTime.value = t;
        flick = Math.sin(t * 13.0) * 0.18 + Math.sin(t * 7.3 + 1.7) * 0.12;
        flameMat.emissiveIntensity = 1.8 + flick;
        star.rotation.y = t * 0.4;
      },
      dispose() {
        for (const d of disposables) d?.dispose?.();
        for (const m of matCache.values()) m.dispose();
        disposables.length = 0;
        matCache.clear();
      }
    };
  }
};
