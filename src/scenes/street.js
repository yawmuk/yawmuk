// «يومك» — Street at night (21:00), حيّ السلام.
// One situation: street.lottery at Tariq's mart counter (lottery ticket + promo die on the counter, lottery billboard
// outside). Omar waits at the bus stop bench (his car = exit); Yusuf and the e-bike remain as ambient set dressing.
// Procedural geometry only. Static props are merged per material bucket (see street/batcher.js);
// repeated props (lamps, trees, snow piles, light pools) are InstancedMeshes.
import { createBatcher } from './street/batcher.js';
import { createTextures } from './street/textures.js';

const PI = Math.PI;

export default {
  id: 'street',
  title: { ar: 'الشارع', en: 'Street' },

  build(ctx) {
    const { THREE } = ctx;
    const group = ctx.group || new THREE.Group();
    const rand = ctx.rand || ((seed = 1) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); });
    const yawTo = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));

    const owned = { mats: [], geos: [], tex: [] };
    const own = (m) => { owned.mats.push(m); return m; };
    const { T, bag } = createTextures(THREE, rand);
    owned.tex.push(...bag);

    // ------------------------------------------------------------ materials
    const M = {
      vc: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 })),
      gloss: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35 })),
      paint: own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
      glow: own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
      glass: own(new THREE.MeshStandardMaterial({ color: '#8fb8cc', transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.3, depthWrite: false })),
      ground: own(new THREE.MeshStandardMaterial({ color: '#59606b', roughness: 0.95 })),
      asphalt: own(new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.38, metalness: 0.15 })),
      sidewalk: own(new THREE.MeshStandardMaterial({ map: T.sidewalk, roughness: 0.6, metalness: 0.05 })),
      lot: own(new THREE.MeshStandardMaterial({ map: T.lot, roughness: 0.5, metalness: 0.08 })),
      tiles: own(new THREE.MeshStandardMaterial({ map: T.tiles, roughness: 0.35 })),
      products: own(new THREE.MeshStandardMaterial({ map: T.products, roughness: 0.6 })),
      tea: own(new THREE.MeshStandardMaterial({ map: T.tea, emissiveMap: T.tea, emissive: '#3a3a3a', roughness: 0.6 })),
      cooler: own(new THREE.MeshBasicMaterial({ map: T.cooler, toneMapped: false, color: '#cfd8df' })),
      jackpot: own(new THREE.MeshBasicMaterial({ map: T.jackpot, toneMapped: false })),
      price: own(new THREE.MeshBasicMaterial({ map: T.price, toneMapped: false, color: '#d8d8d8' })),
      storeSign: own(new THREE.MeshBasicMaterial({ map: T.storeSign, toneMapped: false, color: '#e6e6e6' })),
      ad: own(new THREE.MeshBasicMaterial({ map: T.ad, toneMapped: false, color: '#bfc8d0' })),
      sirenR: own(new THREE.MeshBasicMaterial({ color: '#ff2020', toneMapped: false })),
      sirenB: own(new THREE.MeshBasicMaterial({ color: '#2050ff', toneMapped: false })),
      lampHead: own(new THREE.MeshBasicMaterial({ color: '#ffd890', toneMapped: false })),
      pole: own(new THREE.MeshStandardMaterial({ color: '#3b4048', roughness: 0.5, metalness: 0.5 })),
      tree: own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true })),
      trunk: own(new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 1 })),
      snow: own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, flatShading: true })),
      pool: own(new THREE.MeshBasicMaterial({ map: T.pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }))
    };

    const B = createBatcher(THREE);
    B.bucket('vc', M.vc);
    B.bucket('gloss', M.gloss);
    B.bucket('paint', M.paint, { cast: false });
    B.bucket('glow', M.glow, { cast: false, receive: false });
    B.bucket('glass', M.glass, { cast: false, receive: false });

    const colliders = [];
    const C = (x0, y0, z0, x1, y1, z1) => colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1] });

    // single meshes (textured planes etc.)
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, opts = {}) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      m.castShadow = !!opts.cast; m.receiveShadow = opts.receive ?? true;
      group.add(m);
      return m;
    };
    const plane = (w, h) => new THREE.PlaneGeometry(w, h);
    const flatMesh = (w, d, mat, x, y, z) => add(plane(w, d), mat, x, y, z, -PI / 2);

    // ------------------------------------------------------------ ground
    // lot z -11.5..2.5 | sidewalk 2.5..5.5 | curb 5.5..5.7 | road 5.7..13.7 | far curb | far sidewalk 13.9..17.5
    flatMesh(170, 130, M.ground, 0, -0.16, -5).receiveShadow = true;
    flatMesh(34, 14, M.lot, 0, 0, -4.5);
    flatMesh(120, 3, M.sidewalk, 0, 0.006, 4.0);
    flatMesh(120, 8, M.asphalt, 0, -0.11, 9.7);
    flatMesh(120, 3.6, M.sidewalk, 0, 0.006, 15.7);
    B.box('vc', '#a9a9a4', 120, 0.14, 0.2, 0, -0.12, 5.6);
    B.box('vc', '#a9a9a4', 120, 0.14, 0.2, 0, -0.12, 13.8);

    // road paint: double yellow, white edges, crosswalk
    B.flat('paint', '#d9b23a', 120, 0.1, 0, -0.104, 9.62);
    B.flat('paint', '#d9b23a', 120, 0.1, 0, -0.104, 9.82);
    B.flat('paint', '#d8d8d2', 120, 0.12, 0, -0.104, 6.05);
    B.flat('paint', '#d8d8d2', 120, 0.12, 0, -0.104, 13.35);
    for (let i = 0; i < 6; i++) B.flat('paint', '#e2e2dc', 0.45, 7.4, -3.0 + i * 0.9, -0.1, 9.7);
    // parking stalls (right)
    for (const x of [6.0, 8.8, 11.6, 14.4]) B.flat('paint', '#e4e4de', 0.12, 5, x, 0.008, -4.1);
    B.flat('paint', '#d9b23a', 8.4, 0.12, 10.2, 0.008, -6.6);
    // manhole
    B.cyl('gloss', '#1d1f22', 0.45, 0.45, 0.02, -2.0, -0.1, 9.0, 14);

    // ------------------------------------------------------------ the mart (x -4..4, z -10..-4)
    const STUCCO = '#b5a690';
    B.box('vc', STUCCO, 8.2, 3.2, 0.2, 0, 0, -10);
    B.box('vc', STUCCO, 0.2, 3.2, 6.2, -4, 0, -7);
    B.box('vc', STUCCO, 0.2, 3.2, 6.2, 4, 0, -7);
    // front: sill, glass, header, mullions; door gap x -1.6..0
    B.box('vc', '#3a3f46', 2.4, 0.4, 0.22, -2.8, 0, -4);
    B.box('vc', '#3a3f46', 4.0, 0.4, 0.22, 2.0, 0, -4);
    B.box('glass', 0, 2.4, 2.2, 0.04, -2.8, 0.4, -4);
    B.box('glass', 0, 4.0, 2.2, 0.04, 2.0, 0.4, -4);
    B.box('vc', STUCCO, 8.2, 0.6, 0.22, 0, 2.6, -4);
    for (const x of [-4, -2.8, -1.6, 0, 1.3, 2.65, 4]) B.box('gloss', '#2a2e33', 0.08, 2.6, 0.12, x, 0, -4);
    B.box('gloss', '#2a2e33', 1.6, 0.08, 0.12, -0.8, 2.52, -4);
    B.box('glass', 0, 0.75, 2.4, 0.04, -1.95, 0.05, -3.35, PI / 2.3); // door swung open
    B.box('vc', '#2b2e33', 1.8, 0.01, 1.0, -0.8, 0.008, -3.4); // door mat
    // roof + fascia + sign
    B.box('vc', '#33363b', 8.6, 0.3, 6.6, 0, 3.2, -7);
    B.box('vc', '#b8322a', 8.7, 0.6, 0.14, 0, 3.0, -3.66);
    B.box('vc', '#f2f2f2', 8.7, 0.06, 0.15, 0, 3.0, -3.66);
    add(plane(3.6, 0.48), M.storeSign, 0, 3.3, -3.58);
    // [Phase 3 QA] the mart is part of a big merged mesh, which the engine skips for camera occlusion, so at the
    // counter the camera stayed outside/above the store and the walls + roof hid Adam completely. Invisible proxy
    // boxes (walls, front header, roof) are returned as `cameraOccluders` to keep the camera inside the store.
    const occMat = own(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
    const occGeo = new THREE.BoxGeometry(1, 1, 1); owned.geos.push(occGeo);
    const cameraOccluders = [
      [8.2, 3.2, 0.2, 0, 0, -10], [0.2, 3.2, 6.2, -4, 0, -7], [0.2, 3.2, 6.2, 4, 0, -7], // back + sides
      [8.2, 0.6, 0.22, 0, 2.6, -4],                                                     // front header
      [8.6, 0.3, 6.6, 0, 3.2, -7]                                                       // roof
    ].map(([w, h, d, x, y, z]) => {
      const m = new THREE.Mesh(occGeo, occMat);
      m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); m.visible = false; m.updateMatrixWorld(true);
      return m;
    });
    // interior
    flatMesh(7.8, 5.8, M.tiles, 0, 0.012, -7);
    for (const [x, z] of [[-2, -5.5], [2, -5.5], [-2, -8.5], [2, -8.5], [0, -7]]) B.box('glow', '#f4f7ff', 1.2, 0.04, 0.35, x, 3.13, z);
    // counter (front x -1.5..1.5, z -7.35..-6.75) + returns
    B.box('vc', '#6e4428', 3.0, 1.0, 0.6, 0, 0, -7.05);
    B.box('gloss', '#d6d6d6', 3.1, 0.05, 0.7, 0, 1.0, -7.05);
    B.box('vc', '#6e4428', 0.2, 1.0, 2.85, -1.6, 0, -8.18);
    B.box('vc', '#6e4428', 0.2, 1.0, 2.85, 1.6, 0, -8.18);
    B.box('gloss', '#c8a24a', 3.0, 0.06, 0.04, 0, 0.5, -6.74); // brass trim
    // register + card-payment terminal (Tariq sells no lottery: no ticket machine; the ticket below is a rep's sample)
    B.box('gloss', '#23262b', 0.42, 0.22, 0.36, 0.7, 1.05, -7.2);
    B.box('glow', '#7fe0a0', 0.3, 0.14, 0.02, 0.7, 1.29, -7.05, 0, -0.3);
    B.box('gloss', '#2a2d33', 0.1, 0.05, 0.16, 0.15, 1.05, -6.95, 0.2, -0.35);
    B.box('glow', '#9fd1ff', 0.07, 0.005, 0.07, 0.15, 1.1, -6.97, 0.2, -0.35);
    // small tea & snacks rack on the counter (wooden stepped stand + tea-box face)
    B.box('vc', '#7a5232', 0.95, 0.08, 0.42, -0.75, 1.05, -7.05);
    B.box('vc', '#7a5232', 0.95, 0.3, 0.06, -0.75, 1.05, -7.24);
    add(plane(0.92, 0.42), M.tea, -0.75, 1.32, -7.0, -0.35);
    // hot tea kettle + paper cups
    B.cyl('gloss', '#b9bec4', 0.11, 0.13, 0.26, 1.2, 1.18, -7.1, 12);
    B.cyl('gloss', '#2a2d31', 0.03, 0.03, 0.06, 1.2, 1.34, -7.1, 8);
    B.cyl('gloss', '#b9bec4', 0.018, 0.018, 0.16, 1.07, 1.2, -7.0, 6, 0.9, 0.6);
    for (const [x, z] of [[1.38, -6.92], [1.42, -7.12]]) B.cyl('vc', '#efe6d4', 0.035, 0.028, 0.09, x, 1.095, z, 8);
    // street.lottery prop: the sample lottery ticket + promo die a lottery company rep left on the counter
    // (Tariq turned the offer down and is returning them). Counter top surface is y 1.05; clear of the rack
    // (x <= -0.275), the card terminal (x ~0.15) and the register (x >= 0.49).
    B.box('vc', '#f3d34a', 0.17, 0.004, 0.09, -0.12, 1.05, -6.9, 0.35);            // ticket card
    B.box('vc', '#c0322a', 0.15, 0.002, 0.022, -0.115, 1.054, -6.9, 0.35);          // red banner strip
    B.box('gloss', '#b9bec4', 0.07, 0.002, 0.04, -0.15, 1.054, -6.875, 0.35);       // scratch panel
    B.box('vc', '#f3d34a', 0.17, 0.004, 0.09, -0.04, 1.05, -6.94, -0.2);            // second ticket, fanned
    {
      const DX = 0.36, DZ = -6.86, S = 0.06, top = 1.05 + S;                         // promo die (axis-aligned)
      B.box('vc', '#f4f2ec', S, S, S, DX, 1.05, DZ);
      const pip = (x, y, z, w, h, d) => B.box('vc', '#1c1c1f', w, h, d, x, y, z);
      for (const [px, pz] of [[-0.016, -0.016], [0.016, 0.016], [0, 0], [-0.016, 0.016], [0.016, -0.016]]) {
        pip(DX + px, top, DZ + pz, 0.011, 0.002, 0.011);                              // five on top
      }
      for (const [px, py] of [[-0.016, 0.016], [0, 0], [0.016, -0.016]]) {
        pip(DX + px, 1.05 + S / 2 + py - 0.0055, DZ + S / 2, 0.011, 0.011, 0.002);    // three facing the player
      }
      for (const py of [-0.012, 0.012]) pip(DX + S / 2, 1.05 + S / 2 + py - 0.0055, DZ, 0.002, 0.011, 0.011); // two on the side
    }
    // snacks behind the counter, tea shelf above it
    B.box('vc', '#2c2f35', 3.0, 2.2, 0.35, 0, 0, -9.73);
    add(plane(2.9, 1.5), M.products, 0, 1.05, -9.54);
    add(plane(2.0, 0.6), M.tea, 0, 2.05, -9.54);
    if (typeof ctx.makeLabel === 'function') {                   // small house-rule sign (optional per hotspots.md)
      const noLotto = ctx.makeLabel({ ar: 'لا نبيع اليانصيب هنا', en: 'No lottery sold here' }, { size: 0.16, depthTest: true, background: 'rgba(120,20,20,0.85)' });
      noLotto.position.set(0, 2.62, -9.45); group.add(noLotto);
    }
    // cooler (left wall) + gondola (right)
    B.box('vc', '#2a2f36', 0.6, 2.3, 3.6, -3.6, 0, -7.5);
    add(plane(3.4, 1.9), M.cooler, -3.29, 1.12, -7.5, 0, PI / 2);
    add(new THREE.BoxGeometry(0.7, 1.5, 3.0), M.products, 2.9, 0.75, -7.2, 0, 0, 0, { cast: true });
    B.box('gloss', '#c9ced4', 0.75, 0.05, 3.05, 2.9, 1.5, -7.2);
    // outside the mart: ice chest, propane cage, bin
    B.box('vc', '#e7edf2', 1.3, 1.0, 0.6, -3.0, 0, -3.3);
    B.box('glow', '#4fb3ff', 1.31, 0.18, 0.61, -3.0, 0.62, -3.3);
    B.box('gloss', '#848b92', 1.2, 1.3, 0.6, 3.1, 0, -3.3);
    B.box('vc', '#2f5aa0', 0.5, 0.06, 0.62, 3.1, 0.9, -3.3);
    B.cyl('vc', '#2c3b33', 0.28, 0.25, 0.9, 0.8, 0.45, -3.35, 10);

    // ------------------------------------------------------------ fuel canopy + pumps
    const CX = -0.8, CZ = -0.5;
    B.box('vc', '#e6e6e6', 9.2, 0.5, 4.8, CX, 4.3, CZ);
    B.box('vc', '#c0322a', 9.32, 0.42, 0.06, CX, 4.34, CZ + 2.43);
    B.box('vc', '#c0322a', 9.32, 0.42, 0.06, CX, 4.34, CZ - 2.43);
    B.box('vc', '#c0322a', 0.06, 0.42, 4.9, CX + 4.63, 4.34, CZ);
    B.box('vc', '#c0322a', 0.06, 0.42, 4.9, CX - 4.63, 4.34, CZ);
    for (const x of [-3.6, -0.8, 2.0]) for (const z of [-1.7, 0.7]) B.box('glow', '#e9f1ff', 1.6, 0.03, 0.6, x, 4.27, z);
    for (const ix of [-3.2, 1.6]) {
      B.box('vc', '#9a9a96', 1.1, 0.15, 3.4, ix, 0, -0.5);
      for (const z of [-1.9, 0.9]) { B.box('vc', '#e6e6e6', 0.32, 4.3, 0.32, ix, 0, z); B.box('vc', '#c0322a', 0.42, 0.6, 0.42, ix, 0, z); }
      B.box('vc', '#d9d9d6', 0.55, 1.6, 0.9, ix, 0.15, -0.5);
      B.box('vc', '#c0322a', 0.57, 0.28, 0.92, ix, 1.6, -0.5);
      for (const s of [-1, 1]) {
        B.box('glow', '#7fd6ff', 0.02, 0.26, 0.42, ix + s * 0.285, 1.08, -0.5);
        B.box('gloss', '#18191c', 0.06, 0.7, 0.06, ix + s * 0.3, 0.55, -0.15);
      }
      for (const z of [-2.1, 1.1]) B.cyl('vc', '#e3b52a', 0.09, 0.09, 0.9, ix, 0.6, z, 8);
    }

    // price pylon
    B.box('gloss', '#3a3e44', 0.25, 3.3, 0.25, 4.8, 0, 2.2);
    B.box('vc', '#1d2025', 1.8, 1.2, 0.26, 4.8, 3.2, 2.2);
    add(plane(1.7, 1.06), M.price, 4.8, 3.8, 2.335);
    add(plane(1.7, 1.06), M.price, 4.8, 3.8, 2.065, 0, PI);

    // ------------------------------------------------------------ lottery billboard by the road (outside the store)
    // hotspots.md asks for ~[-4, 4, 9]; z 9 is the middle of the road, so it stands on the far sidewalk (z 15.3),
    // facing the lot / bus stop, readable from the whole play area.
    const BBX = -4, BBZ = 15.3;
    for (const x of [BBX - 2.2, BBX + 2.2]) B.box('gloss', '#3a3e44', 0.22, 3.45, 0.22, x, 0, BBZ);
    B.box('gloss', '#15171b', 5.9, 2.35, 0.3, BBX, 3.3, BBZ);
    add(plane(5.6, 2.1), M.jackpot, BBX, 4.475, BBZ - 0.16, 0, PI);
    B.box('gloss', '#2a2d31', 5.9, 0.08, 0.6, BBX, 3.22, BBZ - 0.2);           // catwalk
    for (const x of [-1.8, 0, 1.8]) {                                           // flood lamps
      B.box('gloss', '#2a2d31', 0.05, 0.05, 0.5, BBX + x, 5.68, BBZ - 0.35);
      B.box('glow', '#fff1c4', 0.3, 0.06, 0.14, BBX + x, 5.62, BBZ - 0.62);
    }

    // ------------------------------------------------------------ bus stop (x -11.6..-8.4)
    for (const [x, z] of [[-11.6, 2.5], [-8.4, 2.5], [-11.6, 4.03], [-8.4, 4.03]]) B.box('gloss', '#4a525c', 0.08, 2.5, 0.08, x, 0, z);
    B.box('gloss', '#3a4048', 3.45, 0.08, 1.9, -10, 2.5, 3.25);
    B.box('glow', '#cfe6ff', 3.0, 0.02, 0.12, -10, 2.48, 3.9); // under-roof strip light
    B.box('glass', 0, 3.2, 2.1, 0.04, -10, 0.3, 2.5);
    B.box('glass', 0, 0.04, 2.1, 1.4, -11.6, 0.3, 3.22);
    B.box('vc', '#2c3036', 0.12, 2.1, 1.2, -8.4, 0.2, 3.15);
    add(plane(1.1, 1.9), M.ad, -8.33, 1.25, 3.15, 0, PI / 2);
    add(plane(1.1, 1.9), M.ad, -8.47, 1.25, 3.15, 0, -PI / 2);
    B.box('glow', '#d9ecff', 0.55, 0.75, 0.02, -11.0, 0.95, 2.53); // schedule
    // bench
    for (const z of [2.9, 3.03, 3.16]) B.box('gloss', '#7d8590', 2.0, 0.04, 0.11, -10, 0.43, z);
    for (const y of [0.58, 0.74]) B.box('gloss', '#7d8590', 2.0, 0.1, 0.03, -10, y, 2.78);
    for (const x of [-10.9, -10, -9.1]) B.box('gloss', '#3a3f46', 0.05, 0.43, 0.4, x, 0, 3.02);
    // the wallet is in Omar's hands (see NPCs); a dropped receipt hints where it was found
    B.box('vc', '#efe9dc', 0.08, 0.004, 0.14, -10.2, 0.47, 3.05, 0.5);
    // bus stop sign
    B.box('gloss', '#4a525c', 0.07, 2.6, 0.07, -12.2, 0, 4.9);
    B.box('glow', '#2f7fd8', 0.45, 0.55, 0.03, -12.2, 2.1, 4.9);
    B.box('vc', '#f2f2f2', 0.46, 0.1, 0.04, -12.2, 2.3, 4.9);

    // ------------------------------------------------------------ cars
    function car(x, z, ry, o) {
      B.frame(x, o.y || 0, z, ry);
      const L = o.len || 4.2, W = 1.8, body = o.body;
      B.box('gloss', body, L, 0.62, W, 0, 0.3, 0);
      const cabL = o.hatch ? 2.3 : 2.1, cabX = o.hatch ? -0.6 : -0.15;
      B.box('gloss', '#121a22', cabL, 0.55, W - 0.14, cabX, 0.92, 0);
      B.box('gloss', o.roof || body, cabL - 0.12, 0.07, W - 0.2, cabX, 1.44, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.cyl('vc', '#121214', 0.34, 0.34, 0.24, sx * L * 0.31, 0.34, sz * (W / 2 - 0.1), 12, PI / 2);
        B.cyl('gloss', '#9aa1a8', 0.18, 0.18, 0.25, sx * L * 0.31, 0.34, sz * (W / 2 - 0.1), 8, PI / 2);
      }
      for (const sz of [-0.6, 0.6]) {
        B.box('glow', o.lightsOn ? '#fff4d6' : '#7d7b72', 0.05, 0.14, 0.36, L / 2, 0.62, sz);
        B.box('glow', o.lightsOn ? '#ff2a2a' : '#5e1414', 0.05, 0.14, 0.36, -L / 2, 0.62, sz);
      }
      for (const sx of [-1, 1]) B.box('vc', '#202226', 0.14, 0.22, W + 0.02, sx * L / 2, 0.26, 0);
      if (o.police) {
        for (const sz of [-1, 1]) B.box('gloss', '#f2f2f2', 2.0, 0.5, 0.02, -0.1, 0.36, sz * (W / 2 + 0.005));
        B.box('gloss', '#1a1c22', 0.6, 0.1, 1.3, -0.1, 1.51, 0);
      }
      B.end();
    }
    car(-5.8, 6.75, PI, { body: '#15171c', roof: '#f2f2f2', police: true, y: -0.11 });
    car(6.0, 12.6, 0, { body: '#8f969d', y: -0.11 });
    car(7.4, -4.2, PI / 2, { body: '#6e1f2a' });
    car(13.0, -4.0, -PI / 2, { body: '#2f4a3a', hatch: true, lightsOn: true, len: 4.0 }); // Omar's hatchback
    // police light bar (animated)
    const sirenGeo = new THREE.BoxGeometry(0.34, 0.12, 0.5);
    add(sirenGeo, M.sirenR, -5.9, 1.52, 6.45);
    add(sirenGeo, M.sirenB, -5.9, 1.52, 7.05);

    // ------------------------------------------------------------ e-bike (for sale) at (8, 1), along x
    B.frame(8, 0, 1, 0);
    for (const wx of [-0.55, 0.55]) {
      B.geo('vc', '#141416', new THREE.TorusGeometry(0.32, 0.05, 8, 20), wx, 0.37, 0);
      B.cyl('gloss', '#b8bec4', 0.04, 0.04, 0.1, wx, 0.37, 0, 6, PI / 2);
    }
    const tube = (a, b, r, color = '#4fa3d1', bucket = 'gloss') => {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      B.cyl(bucket, color, r, r, len, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, 8, 0, Math.atan2(dy, dx) - PI / 2);
    };
    const R = [-0.55, 0.37], F = [0.55, 0.37], BB = [-0.05, 0.36], S = [-0.25, 0.95], H = [0.4, 0.97], HB = [0.45, 0.72];
    tube(BB, S, 0.035); tube(S, H, 0.03); tube(BB, HB, 0.045); tube(HB, F, 0.025, '#2a2d31');
    tube(H, HB, 0.035); tube(BB, R, 0.022); tube(S, R, 0.02);
    tube(H, [0.36, 1.12], 0.022, '#2a2d31');
    tube([-0.27, 1.0], [-0.3, 1.1], 0.02, '#2a2d31');
    B.cyl('vc', '#1b1c1f', 0.02, 0.02, 0.6, 0.36, 1.12, 0, 6, PI / 2);
    B.box('vc', '#1b1c1f', 0.28, 0.07, 0.13, -0.32, 1.1, 0);
    // battery on the down tube
    B.geo('vc', '#18191b', new THREE.BoxGeometry(0.4, 0.12, 0.12), 0.2, 0.58, 0, 0, 0, Math.atan2(HB[1] - BB[1], HB[0] - BB[0]));
    B.cyl('glow', '#fff3c0', 0.045, 0.045, 0.06, 0.47, 0.92, 0, 8, 0, PI / 2);
    B.box('vc', '#2a2d31', 0.32, 0.03, 0.14, -0.5, 0.7, 0); // rear rack
    B.end();

    // ------------------------------------------------------------ sidewalk furniture
    B.cyl('gloss', '#b3271f', 0.13, 0.15, 0.62, 3.2, 0.31, 4.95, 10);
    B.cyl('gloss', '#b3271f', 0.09, 0.13, 0.12, 3.2, 0.68, 4.95, 10);
    B.cyl('gloss', '#b3271f', 0.05, 0.05, 0.34, 3.2, 0.42, 4.95, 6, PI / 2);
    B.cyl('vc', '#2e4a3a', 0.3, 0.27, 0.95, -2.3, 0.475, 4.95, 10);
    B.cyl('vc', '#1f3328', 0.32, 0.32, 0.06, -2.3, 0.98, 4.95, 10);

    // planter strip (left lot) + dumpster + fences
    B.box('vc', '#7d7f82', 7.5, 0.3, 3.3, -11.25, 0, -6.15);
    B.box('vc', '#c3cad4', 7.3, 0.05, 3.1, -11.25, 0.3, -6.15);
    B.box('gloss', '#2d5a3d', 2.0, 1.25, 1.3, -6.5, 0.05, -7.6);
    B.box('gloss', '#21412c', 2.05, 0.08, 1.35, -6.5, 1.3, -7.6, 0, -0.08);
    const fence = (x0, z0, x1, z1, h) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0);
      B.box('vc', '#4f3a2a', len, h, 0.08, (x0 + x1) / 2, 0, (z0 + z1) / 2, ry);
      const n = Math.max(1, Math.round(len / 2.5));
      for (let i = 0; i <= n; i++) B.box('vc', '#3a2a1e', 0.14, h + 0.1, 0.14, x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n);
    };
    fence(-15.6, -8.5, -4.1, -8.5, 1.7);
    fence(4.1, -8.5, 15.6, -8.5, 1.7);
    fence(-15.6, -8.5, -15.6, 2.3, 1.1);
    fence(15.6, -8.5, 15.6, 2.3, 1.1);

    // ------------------------------------------------------------ across the street: storefronts
    const r = rand(21);
    const BLDG = [
      [-36, -22, 9, '#5b3a2e', '#ff4f6d', '#7a2030'],
      [-22, -12, 7, '#6b6256', '#3fd0ff', '#1f4f6f'],
      [-12, -3, 11, '#4e3b33', '#ffb347', null],
      [-3, 7, 8, '#5d5148', '#7dff9a', '#2c5e3a'],
      [7, 16, 10, '#443f45', '#ff7ad9', '#5a2a55'],
      [16, 30, 7.5, '#5a4232', '#ffd84d', '#6f5420']
    ];
    const FZ = 17.6;
    for (const [x0, x1, h, wallC, signC, awnC] of BLDG) {
      const w = x1 - x0, cx = (x0 + x1) / 2;
      B.box('vc', wallC, w - 0.1, h, 7, cx, 0, FZ + 3.5);
      B.box('vc', '#2a2622', w + 0.1, 0.4, 0.3, cx, h - 0.4, FZ - 0.1);
      B.geo('glow', r() > 0.4 ? '#e6c18a' : '#b9d3e8', plane(w - 2.4, 2.1), cx, 1.45, FZ - 0.02, 0, PI, 0);
      B.box('vc', '#24211e', w - 2.2, 0.12, 0.1, cx, 0.3, FZ - 0.05);
      B.box('glow', signC, Math.min(6, w * 0.6), 0.45, 0.1, cx, 2.85, FZ - 0.08);
      if (awnC) B.box('vc', awnC, w - 1.6, 0.08, 1.2, cx, 2.6, FZ - 0.6, 0, -0.28);
      for (let y = 4.2; y < h - 1.2; y += 3) {
        for (let x = x0 + 1.4; x < x1 - 1; x += 2.2) {
          const k = r();
          const c = k < 0.45 ? '#1b1f28' : k < 0.8 ? '#d9b77a' : k < 0.92 ? '#f0d9a8' : '#7fa7d6';
          B.geo('glow', c, plane(1.1, 1.4), x + 0.55, y + 0.7, FZ - 0.02, 0, PI, 0);
        }
      }
    }
    // houses behind the lot
    for (const [x, z, w, h] of [[-22, -20, 8, 5], [-9, -22, 9, 6], [4, -21, 8, 5.5], [17, -20, 9, 5], [30, -22, 8, 6]]) {
      B.box('vc', '#2f3440', w, h, 6, x, 0, z);
      B.geo('vc', '#22252c', new THREE.CylinderGeometry(0, w * 0.75, 2.4, 4, 1), x, h + 1.2, z, 0, PI / 4, 0, 1, 1, 6 / w);
      B.geo('glow', r() > 0.5 ? '#d9b77a' : '#7fa7d6', plane(1.1, 1.2), x - w * 0.25, h * 0.55, z + 3.02);
      if (r() > 0.4) B.geo('glow', '#d9b77a', plane(1.1, 1.2), x + w * 0.22, h * 0.55, z + 3.02);
    }

    B.flush(group);

    // ------------------------------------------------------------ instanced: lamps, trees, snow, light pools
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const setI = (im, i, x, y, z, ry, sx, sy = sx, sz = sx) => { q.setFromAxisAngle(yAxis, ry); pv.set(x, y, z); sv.set(sx, sy, sz); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); };
    const inst = (geo, mat, n, cast = true) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = cast; im.receiveShadow = true; group.add(im); return im; };

    const LAMPS = [[-14.5, 5.15, 0], [-3.4, 5.15, 0], [6.6, 5.15, 0], [-20, 14.25, PI], [-8.5, 14.25, PI], [2.5, 14.25, PI], [13.5, 14.25, PI]];
    const poleI = inst(new THREE.CylinderGeometry(0.07, 0.11, 6, 8).translate(0, 3, 0), M.pole, LAMPS.length);
    const armI = inst(new THREE.BoxGeometry(0.08, 0.08, 1.35).translate(0, 5.9, 0.62), M.pole, LAMPS.length);
    const headI = inst(new THREE.BoxGeometry(0.55, 0.12, 0.3).translate(0, 5.82, 1.25), M.lampHead, LAMPS.length, false);
    LAMPS.forEach(([x, z, ry], i) => {
      const y = 0;
      setI(poleI, i, x, y, z, ry, 1); setI(armI, i, x, y, z, ry, 1); setI(headI, i, x, y, z, ry, 1);
      if (z < 10) C(x - 0.15, 0, z - 0.15, x + 0.15, 3, z + 0.15);
    });
    const lights = [];
    const pl = (color, intensity, distance, x, y, z) => { const L = new THREE.PointLight(color, intensity, distance, 2); L.position.set(x, y, z); group.add(L); lights.push(L); return L; };
    // [Phase 3 QA] 5 -> 3 point lights (README budget). Only the lamp over the bus stop keeps a real light; the
    // other lamps rely on their additive light-pool decals (POOLS), and the canopy light reaches a little further.
    pl('#ffb35c', 38, 16, LAMPS[0][0], 5.6, LAMPS[0][1] + 1.25);
    pl('#eef4ff', 66, 19, CX, 4.0, CZ);      // canopy (also spills onto the e-bike corner and the sidewalk)
    pl('#f4f7ff', 14, 11, 0, 2.9, -6.8);     // mart interior

    const TREES = [
      [-13.6, -6.5, 1.0], [-11.0, -5.5, 0.85], [-8.6, -6.9, 0.95],
      [-14, -10.6, 1.2], [-10.5, -10.8, 1.05], [-7, -10.4, 1.15], [7, -10.6, 1.1], [10.5, -10.4, 1.25], [14, -10.8, 1.0],
      [-2.5, -12.2, 1.3], [2, -12.6, 1.15], [5.5, -12.0, 1.0],
      [-14, 15.9, 0.8], [0.4, 15.9, 0.75], [8.5, 15.9, 0.8], [19, 15.9, 0.8],
      [17.2, -5, 1.1], [17.6, 0.8, 0.95], [-17.4, -3, 1.05]
    ];
    const trunkI = inst(new THREE.CylinderGeometry(0.12, 0.17, 1.2, 6).translate(0, 0.6, 0), M.trunk, TREES.length);
    const coneI = inst(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), M.tree, TREES.length * 3);
    const tr = rand(5);
    TREES.forEach(([x, z, s], i) => {
      const ry = tr() * PI;
      setI(trunkI, i, x, 0, z, ry, s);
      setI(coneI, i * 3, x, 0.8 * s, z, ry, 1.35 * s, 2.2 * s, 1.35 * s);
      setI(coneI, i * 3 + 1, x, 2.0 * s, z, ry + 0.4, 1.0 * s, 1.9 * s, 1.0 * s);
      setI(coneI, i * 3 + 2, x, 3.1 * s, z, ry + 0.8, 0.6 * s, 1.4 * s, 0.6 * s);
      col.set(tr() > 0.5 ? '#2b4a37' : '#24402f'); coneI.setColorAt(i * 3, col); coneI.setColorAt(i * 3 + 1, col);
      col.set('#8fa39a'); coneI.setColorAt(i * 3 + 2, col); // snow-dusted tops
    });

    const SNOW = [
      [-14.6, 1.8, 1.1, 0.0], [14.6, 2.0, 1.0, 0], [-6.0, -8.0, 0.9, 0], [5.5, -8.0, 1.0, 0], [9.5, -8.0, 0.9, 0], [14.6, -8.0, 1.2, 0],
      [-9.0, -4.8, 0.7, 0], [-18, 5.9, 0.9, -0.11], [3.6, 5.95, 0.8, -0.11], [11, 5.95, 1.0, -0.11], [18, 5.95, 0.9, -0.11],
      [-12, 13.4, 1.0, -0.11], [10, 13.4, 0.9, -0.11], [-6, 13.4, 0.8, -0.11], [4.6, 1.4, 0.6, 0]
    ];
    const snowI = inst(new THREE.IcosahedronGeometry(1, 0), M.snow, SNOW.length);
    const sr = rand(9);
    SNOW.forEach(([x, z, s, y], i) => {
      setI(snowI, i, x, y, z, sr() * PI, 1.0 * s, 0.38 * s, 0.75 * s);
      col.set(sr() > 0.5 ? '#b9c1cc' : '#a3abb7'); snowI.setColorAt(i, col);
    });

    const POOLS = [
      ...LAMPS.map(([x, z]) => [x, z < 10 ? 0.014 : 0.014, z < 10 ? 5.4 : 14.6, 8, '#6a4417']),
      [CX, 0.012, CZ, 11, '#3d4552'], [-0.6, 0.012, -2.9, 6, '#33414c'], [-10, 0.014, 3.6, 4, '#24303d'],
      [13.0, 0.012, -0.6, 4.5, '#4a4433'], [BBX, 0.014, BBZ - 0.8, 6, '#5a4310'], [-0.8, 0.014, -6.6, 6, '#3a3f45']
    ];
    const poolI = inst(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), M.pool, POOLS.length, false);
    poolI.receiveShadow = false;
    POOLS.forEach(([x, y, z, s, c], i) => { setI(poolI, i, x, y, z, 0, s, 1, s); col.set(c); poolI.setColorAt(i, col); });
    for (const im of [poleI, armI, headI, trunkI, coneI, snowI, poolI]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }

    // ------------------------------------------------------------ steam from the manhole
    const steam = [];
    for (let i = 0; i < 4; i++) {
      const sm = own(new THREE.SpriteMaterial({ map: T.puff, color: '#c9ced8', transparent: true, depthWrite: false, opacity: 0.3 }));
      const sp = new THREE.Sprite(sm);
      sp.position.set(-2.0, 0, 9.0);
      group.add(sp);
      steam.push(sp);
    }

    // ------------------------------------------------------------ colliders
    // invisible boundary (1 m tall so the follow-camera is not blocked by it)
    C(-16.2, 0, 5.55, 16.2, 1, 6.3);
    C(-16.2, 0, -12, -15.3, 1, 6.3);
    C(15.3, 0, -12, 16.2, 1, 6.3);
    C(-16.2, 0, -8.8, -4.1, 1, -8.3);
    C(4.1, 0, -8.8, 16.2, 1, -8.3);
    // mart walls (tall: also stop the camera) + camera-only roof/canopy slabs (start above player height)
    C(-4.1, 0, -10.1, 4.1, 3.2, -9.9);
    C(-4.1, 0, -10.1, -3.9, 3.2, -3.9);
    C(3.9, 0, -10.1, 4.1, 3.2, -3.9);
    C(-4.1, 0, -4.12, -1.6, 3.2, -3.88);
    C(0, 0, -4.12, 4.1, 3.2, -3.88);
    C(-4.3, 3.05, -10.3, 4.3, 4.45, -3.6);
    C(-5.45, 4.25, -2.95, 3.85, 5.6, 1.95);
    // mart interior
    C(-1.5, 0, -7.35, 1.5, 1.05, -6.75);
    C(-1.7, 0, -9.6, -1.5, 1.05, -6.75);
    C(1.5, 0, -9.6, 1.7, 1.05, -6.75);
    C(-1.5, 0, -9.9, 1.5, 2.2, -9.55);
    C(-3.9, 0, -9.3, -3.3, 2.3, -5.7);
    C(2.55, 0, -8.7, 3.25, 1.55, -5.7);
    // lot props
    C(-3.65, 0, -3.6, -2.35, 1.0, -3.0);
    C(2.5, 0, -3.6, 3.7, 1.3, -3.0);
    C(0.52, 0, -3.63, 1.08, 0.9, -3.07);
    C(-3.75, 0, -2.2, -2.65, 1.8, 1.2);
    C(1.05, 0, -2.2, 2.15, 1.8, 1.2);
    C(4.67, 0, 2.07, 4.93, 3.3, 2.33);
    C(-15, 0, -7.8, -7.5, 0.4, -4.5);
    C(-7.5, 0, -8.25, -5.5, 1.4, -6.95);
    C(6.5, 0, -6.3, 8.3, 1.45, -2.1);
    C(12.1, 0, -6.1, 13.9, 1.45, -1.9);
    C(7.2, 0, 0.85, 8.8, 1.0, 1.15);
    // bus shelter
    C(-11.65, 0, 2.45, -8.35, 2.4, 2.55);
    C(-11.65, 0, 2.5, -11.55, 2.4, 3.92);
    C(-8.46, 0, 2.55, -8.34, 2.4, 3.75);
    C(-11.66, 0, 3.98, -11.54, 2.5, 4.08);
    C(-8.46, 0, 3.98, -8.34, 2.5, 4.08);
    C(-11.0, 0, 2.75, -9.0, 0.6, 3.25);
    C(-12.25, 0, 4.85, -12.15, 2.6, 4.95);
    // sidewalk furniture
    C(3.05, 0, 4.8, 3.35, 0.8, 5.1);
    C(-2.6, 0, 4.65, -2.0, 1.0, 5.25);

    // ------------------------------------------------------------ NPCs (engine builds them from `look`; we add small accessories)
    const accMat = (hex) => own(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 }));
    const accGeo = (g) => { owned.geos.push(g); return g; };
    const dress = (look, extra) => {
      if (typeof ctx.makeNPC !== 'function') return undefined;
      const fig = ctx.makeNPC(look);
      const parts = fig.userData.parts;
      if (parts && extra) extra(parts);
      return fig;
    };
    const mesh = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };

    const LOOK = {
      officer: { skin: '#8d5524', shirt: '#1f2a44', pants: '#1f2a44', shoes: '#111', hair: '#1a1410', hijab: false, height: 1.82, build: 1.08 },
      omar: { skin: '#5a3a22', shirt: '#556b2f', pants: '#2e2f33', hair: '#141010', beard: '#141010', hijab: false, height: 1.85, build: 0.92 },
      tariq: { skin: '#b88a5e', shirt: '#c0392b', pants: '#2d2f36', hair: '#8f8f8f', hijab: false, height: 1.74, build: 1.15 },
      yusuf: { skin: '#8d5524', shirt: '#6b4f3a', dress: '#6b4f3a', pants: '#2b2b33', hair: '#15100c', beard: '#15100c', hijab: false, height: 1.8 }
    };
    // background: Officer Daniels by his cruiser (hi-vis vest, cap, duty belt)
    const officer = dress(LOOK.officer, (p) => {
      const navy = accMat('#1b2338');
      p.head.add(mesh(accGeo(new THREE.CylinderGeometry(0.15, 0.14, 0.09, 12)), navy, 0, 0.11, 0));
      p.head.add(mesh(accGeo(new THREE.BoxGeometry(0.2, 0.02, 0.12)), accMat('#0e121c'), 0, 0.075, -0.15));
      p.body.add(mesh(accGeo(new THREE.CylinderGeometry(0.225, 0.2, 0.5, 8)), accMat('#c6e33a'), 0, 1.2, 0));
      p.body.add(mesh(accGeo(new THREE.CylinderGeometry(0.228, 0.215, 0.05, 8)), accMat('#d9dde2'), 0, 1.12, 0));
      p.body.add(mesh(accGeo(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 8)), accMat('#121212'), 0, 0.88, 0)); // duty belt
    });
    // Omar sits on the bus-stop bench holding the found wallet (static seated pose: animate:false)
    const omar = dress(LOOK.omar, (p) => {
      p.head.add(mesh(accGeo(new THREE.SphereGeometry(0.145, 12, 6, 0, PI * 2, 0, PI * 0.5)), accMat('#7d8086'), 0, 0.015, 0.005));
      p.legL.rotation.x = p.legR.rotation.x = 1.05;              // thighs forward/down from the seat
      p.armL.rotation.x = p.armR.rotation.x = 0.95;              // forearms over the lap
      p.armL.rotation.z = -0.25; p.armR.rotation.z = 0.25;
      p.head.rotation.x = 0.12;                                  // looking at the wallet / up at Adam
      const wallet = mesh(accGeo(new THREE.BoxGeometry(0.2, 0.05, 0.14)), accMat('#6b3a1c'), 0, -0.66, -0.05);
      p.armR.add(wallet);
      wallet.add(mesh(accGeo(new THREE.BoxGeometry(0.09, 0.006, 0.07)), accMat('#2e86de'), 0.05, 0.03, 0.01)); // a card peeking out
    });
    // Tariq, the Muslim owner, behind the counter: grey hair + grey moustache
    const tariq = dress(LOOK.tariq, (p) => {
      p.head.add(mesh(accGeo(new THREE.BoxGeometry(0.11, 0.025, 0.03)), accMat('#8a8580'), 0, -0.045, -0.12));
    });
    // Yusuf at the e-bike: brown winter coat (long), light beard (makeNPC)
    const yusuf = dress(LOOK.yusuf, (p) => {
      p.body.add(mesh(accGeo(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 10)), accMat('#4d3828'), 0, 1.5, 0)); // coat collar
    });

    const OMAR_SEAT = [-9.35, 3.02];
    const omarDrop = -0.43 * (LOOK.omar.height / 1.75);          // hip (0.86 m, scaled) down to the bench seat
    const npcs = [
      { id: 'omar', position: [OMAR_SEAT[0], omarDrop, OMAR_SEAT[1]], yaw: PI, look: LOOK.omar, object: omar, animate: false },
      { id: 'tariq', position: [0, 0, -8], yaw: yawTo([0, -8], [-0.8, -4]), look: LOOK.tariq, object: tariq },
      { id: 'yusuf', position: [9, 0, 2], yaw: yawTo([9, 2], [6, 2.6]), look: LOOK.yusuf, object: yusuf },
      { id: 'bg_officer_daniels', position: [-8, 0, 4.5], yaw: yawTo([-8, 4.5], [-9.6, 3.4]), look: LOOK.officer, object: officer }
    ];
    for (const n of npcs) if (!n.object) delete n.object;

    // ------------------------------------------------------------ hotspots / spawn / exit
    const hotspots = [
      { id: 'bus_bench', position: [-10, 0.5, 3.0], radius: 1.7, label: { ar: 'مقعد محطة الحافلات', en: 'Bus stop bench' } },
      { id: 'gas_station_counter', position: [0, 1.0, -7.0], radius: 1.8, markerHeight: 1.95, label: { ar: 'كاونتر متجر طارق', en: "Tariq's counter" } },
      { id: 'ebike', position: [8, 0.6, 1.0], radius: 1.8, label: { ar: 'الدراجة الكهربائية', en: 'The e-bike' } }
    ];

    // ------------------------------------------------------------ animation (no allocations)
    function update(dt, t) {
      // police light bar: alternating double flash, kept dim
      const ph = (t * 1.6) % 1;
      const red = (ph < 0.12 || (ph > 0.2 && ph < 0.32)) ? 1 : 0.15;
      const blue = ((ph > 0.5 && ph < 0.62) || (ph > 0.7 && ph < 0.82)) ? 1 : 0.15;
      M.sirenR.color.setRGB(red, 0.05 * red, 0.05 * red);
      M.sirenB.color.setRGB(0.08 * blue, 0.2 * blue, blue);
      // lottery billboard pulse
      M.jackpot.color.setScalar(0.82 + 0.18 * Math.sin(t * 5));
      // steam
      for (let i = 0; i < steam.length; i++) {
        const k = (t * 0.28 + i / steam.length) % 1;
        const sp = steam[i];
        sp.position.set(-2.0 + Math.sin(t * 0.7 + i) * 0.15 + k * 0.4, -0.05 + k * 2.4, 9.0 + k * 0.2);
        sp.scale.setScalar(0.7 + k * 1.9);
        sp.material.opacity = 0.32 * Math.sin(k * PI);
      }
    }

    function dispose() {
      for (const L of lights) { L.dispose?.(); }
      for (const g of owned.geos) g.dispose();
      for (const m of owned.mats) m.dispose();
      for (const t of owned.tex) t.dispose();
      sirenGeo.dispose();
      group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
      owned.geos.length = owned.mats.length = owned.tex.length = 0;
      steam.length = 0;
    }

    return {
      group,
      spawn: { position: [-13, 0, 4], yaw: -PI / 2 },
      colliders,
      hotspots,
      npcs,
      exit: { position: [11.2, 0, -3.4], radius: 1.6 },
      playerLook: { jacket: '#1f2d4d' },   // Adam in a navy winter jacket (optional engine field)
      lights: 'night',
      cameraOccluders,
      update,
      dispose
    };
  }
};
