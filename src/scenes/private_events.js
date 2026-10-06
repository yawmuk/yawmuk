// «يومك» — private_events: Saturday on Adam's cul-de-sac in Columbus, Ohio.
// Three zones along one walkable street: the Harris porch (condolence, muted),
// the Garcia front yard (Leo's birthday, cheerful) and the community hall at the end of
// the cul-de-sac (Yusuf & Mariam's wedding). Procedural geometry only; repeated props are
// batched into a handful of InstancedMeshes to keep the draw-call count low.
//
// Layout (metres, +x right, +z toward the camera at spawn):
//   road x∈[-3.5,3.5] from z=+30 down to a turning circle centred at z=-8.5 (r=6.8)
//   left : Harris house x∈[-15.5,-8.5] z∈[2,10] (porch faces +x), sage house, Omar's (plain beige) house
//   right: the Reed house (Adam's family) x∈[9.5,15.5] z∈[9,15], Garcia house x≥10.5 z∈[-1.5,5.5] + fenced yard x∈[5.4,10.5]
//   end  : community hall x∈[-6,6] z∈[-25,-17], door at z=-17, parking lot on its east side
import { buildInstancers, makeTextures, boxUV } from './private_events/kit.js';

const HOUSE_WALL_H = 3.4;
const ROOF_RISE = 2.4;

export default {
  id: 'private_events',
  title: { ar: 'الحي: التعزية وعيد الميلاد والعرس', en: 'The Neighborhood: Condolence, Birthday, Wedding' },

  build(ctx) {
    const { THREE, mats, group } = ctx;
    const colliders = [];
    const owned = { geos: [], mats: [], texs: [], lights: [] };
    const own = (o, list) => { owned[list].push(o); return o; };
    const col = (x0, x1, z0, z1, y0 = 0, y1 = 2) => colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1] });

    const tex = makeTextures(THREE);
    tex.all.forEach((t) => own(t, 'texs'));
    const I = buildInstancers(THREE, group, tex, own);
    const { cbox, cslab, ccyl, ccone, csph, flat, disc, line, glow, glowBox, bodies, gables, glass, wood, balloons } = I;

    // ------------------------------------------------------------------ ground & street
    const grassMat = own(new THREE.MeshStandardMaterial({ color: '#b3b07a', map: tex.grass, roughness: 1 }), 'mats');
    const groundGeo = own(new THREE.PlaneGeometry(96, 96), 'geos');
    const ground = new THREE.Mesh(groundGeo, grassMat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -2); ground.receiveShadow = true;
    group.add(ground);

    const ASPH = '#45484d', WALK = '#c4c0b6', CURB = '#d3cfc5';
    const CZ = -8.5; // turning-circle centre
    flat.add(0, 0, 11.5, 7, 0.035, 40, { c: ASPH });                  // straight road (z -8.5 .. 31.5)
    disc.add(0, 0, CZ, 6.8, 0.035, 6.8, { c: ASPH });                  // cul-de-sac
    disc.add(0, 0, CZ, 8.3, 0.025, 8.3, { c: WALK });                  // ring sidewalk
    for (const s of [-1, 1]) {
      flat.add(s * 4.45, 0, 14.5, 1.7, 0.04, 33, { c: WALK });         // sidewalks z -2 .. 31
      flat.add(s * 3.55, 0, 14.5, 0.12, 0.07, 33, { c: CURB });        // curbs
      for (let z = 2; z < 30; z += 6) flat.add(s * 0.0, 0, z, 0.14, 0.04, 2.2, { c: '#d9cf9a' }); // faded centre dashes
    }
    flat.add(0, 0, -16.2, 12.4, 0.05, 2.0, { c: '#d9d1c1' });          // hall plaza (pavers)
    flat.add(-7.1, 0, 6, 3.2, 0.045, 1.2, { c: WALK });                // Harris front walk
    flat.add(7.4, 0, 12, 4.2, 0.045, 1.2, { c: WALK });                // Adam's front walk
    flat.add(7.9, 0, 1.2, 5.0, 0.03, 1.4, { c: '#cdbf9f' });           // Garcia yard path (pavers)
    flat.add(-12.5, 0, -6.5, 6.0, 0.04, 1.2, { c: WALK });             // sage house walk
    flat.add(-12.2, 0, 15.5, 6.6, 0.04, 1.2, { c: WALK });             // Omar's house walk
    flat.add(-7.75, 0, 1.0, 4.9, 0.05, 1.9, { c: '#eef2f6' });          // snow-covered Harris driveway
    for (const dz of [-0.45, 0.45]) flat.add(-7.75, 0, 1.0 + dz, 4.9, 0.055, 0.22, { c: '#c9ced3' }); // tyre tracks
    flat.add(9.8, 0, -21.2, 6.4, 0.04, 7.6, { c: '#55585d' });         // parking lot
    for (const z of [-17.8, -20.3, -22.8, -25.0]) flat.add(10.2, 0, z, 4.8, 0.05, 0.1, { c: '#e9e6dc' });

    // patchy snow on the lawns (deterministic scatter, kept off paved areas)
    const r = ctx.rand(7);
    const paved = (x, z) =>
      (Math.abs(x) < 5.6 && z > -3) || Math.hypot(x, z - CZ) < 8.8 || (Math.abs(x) < 6.6 && z < -15) ||
      (x > 6.4 && x < 13.2 && z < -17) || (x > 5.2 && x < 10.6 && z > -1.8 && z < 5.7) || (x > -10.6 && x < -5 && z > -0.2 && z < 2.2);
    for (let n = 0, tries = 0; n < 46 && tries < 400; tries++) {
      const x = -13 + r() * 26, z = -27 + r() * 46;
      if (paved(x, z)) continue;
      const s = 0.35 + r() * 1.1;
      disc.add(x, 0, z, s * (1 + r() * 0.6), 0.012, s, { c: '#eef2f6', ry: r() * 3 });
      n++;
    }

    // ------------------------------------------------------------------ houses
    // front: +1 → façade faces +x (left side of the street), -1 → faces -x (right side)
    const houses = [
      { key: 'harris', x0: -15.5, x1: -8.5, z0: 2, z1: 10, front: 1, doorZ: 6, wall: '#8fa3b5', roof: '#4a4f57', door: '#eeeae2', shutter: '#5d6b78', chimney: true },
      { key: 'sage', x0: -16, x1: -9.5, z0: -10, z1: -3, front: 1, doorZ: -6.5, wall: '#b6c4a6', roof: '#5a4636', door: '#6b3b2a', shutter: '#4f5d45' },
      { key: 'omar', x0: -15.5, x1: -9, z0: 12, z1: 19, front: 1, doorZ: 15.5, wall: '#d8c8a8', roof: '#5a4636', door: '#5e3d22', shutter: '#8a7a62' }, // plain, no decorations
      { key: 'reed', x0: 9.5, x1: 15.5, z0: 9, z1: 15, front: -1, doorZ: 12, wall: '#f1efe8', roof: '#5b4a42', door: '#2f7a4a', shutter: '#3e5a48' },
      { key: 'garcia', x0: 10.5, x1: 17, z0: -1.5, z1: 5.5, front: -1, doorZ: 2, wall: '#f2d98b', roof: '#7a4b3a', door: '#b5452f', shutter: '#5f8fb0', chimney: true },
      { key: 'rose', x0: 10, x1: 16, z0: -12, z1: -4.5, front: -1, doorZ: -8.2, wall: '#d6c2bd', roof: '#4d4a48', door: '#2f4a6a', shutter: '#7a5a5a' }
    ];
    const WHITE = '#f4f2ec';
    // invisible DoubleSide proxy boxes: the orbit camera pulls in front of them (houses etc. are instanced,
    // which the engine's automatic camera occlusion skips)
    const camProxies = [];
    const proxyMat = own(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 'mats');
    const proxyGeo = own(new THREE.BoxGeometry(1, 1, 1), 'geos');
    const proxy = (x0, x1, y0, y1, z0, z1) => {
      const m = new THREE.Mesh(proxyGeo, proxyMat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.scale.set(x1 - x0, y1 - y0, z1 - z0);
      m.visible = false; m.updateMatrixWorld(true); camProxies.push(m); return m;
    };
    for (const h of houses) {
      const W = h.x1 - h.x0, D = h.z1 - h.z0, cx = (h.x0 + h.x1) / 2, cz = (h.z0 + h.z1) / 2;
      bodies.add(cx, 0, cz, W, HOUSE_WALL_H, D, { c: h.wall });
      gables.add(cx, HOUSE_WALL_H, cz, W, ROOF_RISE, D, { c: h.wall });
      // roof: two slabs + a dusting of snow on each
      const a = Math.atan2(ROOF_RISE, W / 2), ov = 0.45, t = 0.16;
      const slope = Math.hypot(W / 2, ROOF_RISE) + ov;
      for (const s of [-1, 1]) {
        const lowX = cx + s * (W / 2 + ov * Math.cos(a)), lowY = HOUSE_WALL_H - ov * Math.sin(a);
        const mx = (lowX + cx) / 2, my = (lowY + HOUSE_WALL_H + ROOF_RISE) / 2;
        const nx = s * Math.sin(a), ny = Math.cos(a);
        cslab.add(mx + nx * t / 2, my + ny * t / 2, cz, slope, t, D + 0.6, { rz: -s * a, c: h.roof });
        cslab.add(mx + nx * (t + 0.02) - s * 0.25 * Math.cos(a), my + ny * (t + 0.02) + 0.25 * Math.sin(a), cz,
          slope * 0.62, 0.05, D + 0.5, { rz: -s * a, c: '#f1f4f7' });
      }
      cslab.add(cx, HOUSE_WALL_H + ROOF_RISE + 0.1, cz, 0.22, 0.12, D + 0.62, { c: h.roof }); // ridge cap
      if (h.chimney) cbox.add(cx - h.front * W * 0.22, HOUSE_WALL_H + 0.6, h.z0 + D * 0.25, 0.7, 2.9, 0.7, { c: '#8a4b3a' });
      col(h.x0, h.x1, h.z0, h.z1, 0, HOUSE_WALL_H + ROOF_RISE);
      proxy(h.x0 - 0.45, h.x1 + 0.45, 0, HOUSE_WALL_H + ROOF_RISE + 0.3, h.z0 - 0.3, h.z1 + 0.3);

      // façade: door, frame, stoop, windows with shutters
      const fx = h.front > 0 ? h.x1 : h.x0, s = h.front;
      cbox.add(fx + s * 0.03, 0, h.doorZ, 0.08, 2.15, 1.0, { c: h.door });
      cbox.add(fx + s * 0.012, 0, h.doorZ, 0.04, 2.32, 1.24, { c: WHITE });
      csph.add(fx + s * 0.09, 1.05, h.doorZ - 0.32, 0.045, 0.045, 0.045, { c: '#c9a227' }); // knob
      if (h.key !== 'harris') cbox.add(fx + s * 0.45, 0, h.doorZ, 0.9, 0.15, 1.6, { c: '#b9b4aa' });
      const winZ = [h.doorZ - 2.0, h.doorZ + 2.0].filter((z) => z > h.z0 + 0.9 && z < h.z1 - 0.9);
      for (const z of winZ) window_(fx, z, 1.0, s, 'x', h.shutter);
      // gable-end (z faces) windows + attic window
      for (const zf of [h.z0, h.z1]) {
        const sz = zf === h.z0 ? -1 : 1;
        for (const x of [cx - W * 0.22, cx + W * 0.22]) window_(x, zf, 1.0, sz, 'z', h.shutter);
        window_(cx, zf, HOUSE_WALL_H + 0.45, sz, 'z', null, 0.7, 0.8);
      }
      // foundation shrubs either side of the door
      for (const dz of [-1.05, 1.05]) csph.add(fx + s * 0.5, 0.32, h.doorZ + dz * (h.key === 'harris' ? 2.8 : 1), 0.5, 0.42, 0.45, { c: '#4f6b45' });
    }

    // window helper: glass + white frame + sill (+ optional shutters). axis = which axis the wall's normal follows.
    function window_(px, pz, y0, s, axis, shutter, w = 1.0, hgt = 1.3) {
      const ry = axis === 'x' ? Math.PI / 2 : 0;
      const o = (d) => (axis === 'x' ? [px + s * d, pz] : [px, pz + s * d]);
      let [x, z] = o(0.015); cbox.add(x, y0 - 0.08, z, w + 0.18, hgt + 0.16, 0.04, { ry, c: WHITE });
      [x, z] = o(0.04); glass.add(x, y0, z, w, hgt, 0.04, { ry });
      [x, z] = o(0.07); cbox.add(x, y0 - 0.12, z, w + 0.3, 0.07, 0.1, { ry, c: WHITE });
      if (shutter) {
        for (const side of [-1, 1]) {
          const off = side * (w / 2 + 0.24);
          const sx = axis === 'x' ? px + s * 0.04 : px + off, sz = axis === 'x' ? pz + off : pz + s * 0.04;
          cbox.add(sx, y0 - 0.04, sz, 0.32, hgt + 0.08, 0.04, { ry, c: shutter });
        }
      }
    }

    // ------------------------------------------------------------------ zone 1: the Harris porch (muted, respectful)
    const PORCH_Y = 0.4, PX0 = -8.5, PX1 = -6.6, PZ0 = 3.4, PZ1 = 8.6;
    cbox.add((PX0 + PX1) / 2, 0, 6, PX1 - PX0, PORCH_Y, PZ1 - PZ0, { c: '#e7e3da' });       // deck
    cbox.add(-6.45, 0, 6, 0.32, 0.27, 1.6, { c: '#e7e3da' });                                  // step 2
    cbox.add(-6.1, 0, 6, 0.4, 0.13, 1.6, { c: '#e7e3da' });                                    // step 1
    cslab.add(-7.5, 3.0, 6, 2.5, 0.14, 5.6, { c: '#5a5f66' });                                 // porch roof
    cslab.add(-6.32, 2.86, 6, 0.08, 0.2, 5.6, { c: WHITE });                                   // fascia
    for (const z of [3.55, 5.1, 6.9, 8.45]) cbox.add(-6.75, PORCH_Y, z, 0.16, 2.55, 0.16, { c: WHITE }); // posts
    const rail = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      cbox.add((x0 + x1) / 2, PORCH_Y + 0.78, (z0 + z1) / 2, alongX ? len : 0.08, 0.07, alongX ? 0.08 : len, { c: WHITE });
      const n = Math.floor(len / 0.22);
      for (let i = 1; i < n; i++) {
        const f = i / n; cbox.add(x0 + (x1 - x0) * f, PORCH_Y, z0 + (z1 - z0) * f, 0.045, 0.78, 0.045, { c: WHITE });
      }
    };
    rail(-6.75, 3.55, -6.75, 5.1); rail(-6.75, 6.9, -6.75, 8.45);
    rail(-8.45, 3.5, -6.75, 3.5); rail(-8.45, 8.5, -6.75, 8.5);
    col(PX0, -6.3, PZ0, PZ1, 0, 3);
    proxy(-8.8, -6.2, 2.8, 3.2, 3.15, 8.85);                                                  // porch roof camera proxy
    // white wreath on the door
    const wreathGeo = own(new THREE.TorusGeometry(0.27, 0.07, 6, 18), 'geos');
    const wreath = new THREE.Mesh(wreathGeo, mats.color('#f3f1ea', { roughness: 0.9 }));
    wreath.position.set(-8.4, 1.55, 6); wreath.rotation.y = Math.PI / 2; wreath.castShadow = true;
    // (funeral wreath removed: the porch now hosts the marriage-proposal situation)
    for (let i = 0; i < 10; i++) {
      const a2 = (i / 10) * Math.PI * 2;
      csph.add(-8.36, 1.55 + Math.sin(a2) * 0.27, 6 + Math.cos(a2) * 0.27, 0.06, 0.06, 0.06, { c: i % 2 ? '#f7f5ee' : '#e9edf0' });
    }
    csph.add(-8.35, 1.3, 6, 0.05, 0.08, 0.05, { c: '#cfd5da' }); // ribbon tail
    // the Reed family's Christmas wreath: evergreen ring with a red bow (front door faces -x at x=9.5)
    const xmas = new THREE.Mesh(wreathGeo, mats.color('#2f6b3c', { roughness: 0.9 }));
    xmas.position.set(9.4, 1.55, 12); xmas.rotation.y = Math.PI / 2; xmas.castShadow = true; group.add(xmas);
    for (const dz of [-0.09, 0.09]) csph.add(9.35, 1.83, 12 + dz, 0.06, 0.05, 0.09, { c: '#c0392b' });
    csph.add(9.34, 1.83, 12, 0.04, 0.04, 0.04, { c: '#a93226' });
    for (const dz of [-0.05, 0.05]) cslab.add(9.35, 1.7, 12 + dz, 0.02, 0.22, 0.04, { c: '#c0392b', rx: dz * 3 });
    // rocking chair
    const RC = { x: -7.75, z: 7.55 };
    for (const dz of [-0.24, 0.24]) {
      cslab.add(RC.x, PORCH_Y + 0.06, RC.z + dz, 0.8, 0.05, 0.05, { c: '#5e3d22', rz: 0.05 });          // runner
      cbox.add(RC.x - 0.2, PORCH_Y + 0.06, RC.z + dz, 0.05, 0.42, 0.05, { c: '#6b4a2f' });
      cbox.add(RC.x + 0.2, PORCH_Y + 0.06, RC.z + dz, 0.05, 0.42, 0.05, { c: '#6b4a2f' });
    }
    cbox.add(RC.x, PORCH_Y + 0.46, RC.z, 0.5, 0.05, 0.52, { c: '#6b4a2f' });                            // seat
    cslab.add(RC.x - 0.27, PORCH_Y + 0.82, RC.z, 0.05, 0.75, 0.5, { c: '#6b4a2f', rz: -0.18 });         // back
    cbox.add(RC.x - 0.02, PORCH_Y + 0.51, RC.z, 0.4, 0.08, 0.44, { c: '#8a8f96' });                     // grey cushion
    // small side table with a covered (foil) dish
    cbox.add(-7.7, PORCH_Y, 4.35, 0.06, 0.6, 0.06, { c: '#5e3d22' });
    cbox.add(-7.7, PORCH_Y + 0.6, 4.35, 0.62, 0.05, 0.62, { c: '#6b4a2f' });
    cbox.add(-7.7, PORCH_Y + 0.65, 4.35, 0.44, 0.09, 0.32, { c: '#c9ced3' });
    cslab.add(-7.7, PORCH_Y + 0.76, 4.35, 0.42, 0.05, 0.3, { c: '#dde1e5', rx: 0.04 });
    // proposal prop (private_events.proposal): a ring in a small open box on a tall side table by the porch steps
    cbox.add(-6.05, 0, 4.85, 0.06, 0.98, 0.06, { c: '#5e3d22' });                                     // table leg
    cbox.add(-6.05, 0, 4.85, 0.34, 0.03, 0.34, { c: '#5e3d22' });                                     // foot
    cbox.add(-6.05, 0.98, 4.85, 0.46, 0.04, 0.46, { c: '#6b4a2f' });                                  // top (y 1.02)
    cbox.add(-6.05, 1.02, 4.85, 0.11, 0.055, 0.11, { c: '#7a1f2b' });                                 // ring box base
    cslab.add(-6.1, 1.1, 4.85, 0.012, 0.1, 0.11, { c: '#7a1f2b', rz: 0.35 });                       // lid, tipped open
    cbox.add(-6.05, 1.072, 4.85, 0.09, 0.006, 0.09, { c: '#f2ede4' });                                // satin insert
    const ringProp = new THREE.Mesh(own(new THREE.TorusGeometry(0.024, 0.006, 8, 20), 'geos'), mats.color('#d4af37', { roughness: 0.25, metalness: 0.9 }));
    ringProp.position.set(-6.03, 1.1, 4.85); ringProp.rotation.y = Math.PI / 2; ringProp.castShadow = true;
    group.add(ringProp);
    col(-6.3, -5.8, 4.6, 5.1, 0, 1.1);
    // sympathy bouquets: white & soft yellow blooms in plain vases
    const bouquet = (x, y, z, seed) => {
      const rr = ctx.rand(seed);
      ccyl.add(x, y, z, 0.11, 0.26, 0.11, { c: '#dfe3e6' });
      csph.add(x, y + 0.34, z, 0.16, 0.12, 0.16, { c: '#6f8f5a' });
      for (let i = 0; i < 6; i++) {
        const a2 = i * 1.05 + rr(), rad = 0.07 + rr() * 0.07;
        const c = ['#f7f5ee', '#f7f5ee', '#f3e9c6', '#f2d16b'][i % 4];
        csph.add(x + Math.cos(a2) * rad, y + 0.4 + rr() * 0.1, z + Math.sin(a2) * rad, 0.065, 0.06, 0.065, { c });
      }
    };
    // sympathy bouquets removed with the funeral situation (the ring table stands at -6.05, 4.85)
    bouquet(-7.0, PORCH_Y, 3.85, 13); bouquet(-7.0, PORCH_Y, 8.15, 14); bouquet(-8.15, PORCH_Y, 5.15, 15);

    // ------------------------------------------------------------------ zone 2: Garcia yard (Leo's birthday)
    const FX = 5.4, YZ0 = -1.6, YZ1 = 5.5, GATE0 = 0.0, GATE1 = 2.4, YX1 = 10.5;
    const picket = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const n = Math.max(2, Math.round(len / 0.19));
      for (let i = 0; i <= n; i++) {
        const f = i / n; cbox.add(x0 + (x1 - x0) * f, 0, z0 + (z1 - z0) * f, 0.07, 0.82, 0.07, { c: WHITE });
        csph.add(x0 + (x1 - x0) * f, 0.84, z0 + (z1 - z0) * f, 0.045, 0.045, 0.045, { c: WHITE });
      }
      for (const y of [0.22, 0.6]) cbox.add((x0 + x1) / 2, y, (z0 + z1) / 2, alongX ? len : 0.04, 0.07, alongX ? 0.04 : len, { c: '#e8e5dd' });
      col(Math.min(x0, x1) - 0.06, Math.max(x0, x1) + 0.06, Math.min(z0, z1) - 0.06, Math.max(z0, z1) + 0.06, 0, 0.9);
    };
    picket(FX, YZ0, FX, GATE0); picket(FX, GATE1, FX, YZ1);
    picket(FX, YZ0, YX1, YZ0); picket(FX, YZ1, YX1, YZ1);
    for (const z of [GATE0, GATE1]) cbox.add(FX, 0, z, 0.14, 1.05, 0.14, { c: WHITE }); // gate posts

    // party table: bright striped cloth, green cake with candles, an open pizza box and a straw gift basket
    const TX = 7.6, TZ = 1.2;
    const clothGeo = own(new THREE.BoxGeometry(0.96, 0.42, 1.9), 'geos');
    boxUV(clothGeo, 0.96, 0.42, 1.9, 0.5, 0.42);
    const cloth = new THREE.Mesh(clothGeo, own(new THREE.MeshStandardMaterial({ map: tex.cloth, roughness: 0.95 }), 'mats'));
    cloth.position.set(TX, 0.57, TZ); cloth.castShadow = cloth.receiveShadow = true; group.add(cloth);
    for (const [dx, dz] of [[-0.4, -0.85], [0.4, -0.85], [-0.4, 0.85], [0.4, 0.85]]) cbox.add(TX + dx, 0, TZ + dz, 0.05, 0.38, 0.05, { c: '#8a8f96' });
    col(TX - 0.5, TX + 0.5, TZ - 0.97, TZ + 0.97, 0, 0.8);
    ccyl.add(TX, 0.78, TZ - 0.15, 0.24, 0.035, 0.24, { c: '#fafafa' });     // cake board
    ccyl.add(TX, 0.815, TZ - 0.15, 0.2, 0.17, 0.2, { c: '#6cc04a' });       // cake
    ccyl.add(TX, 0.985, TZ - 0.15, 0.17, 0.02, 0.17, { c: '#e9f7d9' });     // frosting
    for (let i = 0; i < 5; i++) {
      const a2 = (i / 5) * Math.PI * 2, x = TX + Math.cos(a2) * 0.1, z = TZ - 0.15 + Math.sin(a2) * 0.1;
      ccyl.add(x, 1.0, z, 0.012, 0.09, 0.012, { c: ['#ef5350', '#42a5f5', '#ffca28', '#ab47bc', '#26a69a'][i] });
      glow.add(x, 1.115, z, 0.016, 0.03, 0.016, { c: '#ffcf6b' });
    }
    // open pizza box (base + lid standing open at the back) with a pepperoni pizza
    const PZx = TX - 0.12, PZz = TZ + 0.56;
    cbox.add(PZx, 0.78, PZz, 0.42, 0.04, 0.42, { c: '#c8a26b' });
    cslab.add(PZx + 0.22, 0.99, PZz, 0.02, 0.42, 0.42, { c: '#d2b07a', rz: -0.12 });
    ccyl.add(PZx, 0.82, PZz, 0.18, 0.015, 0.18, { c: '#e3b55b' });
    for (let i = 0; i < 7; i++) {
      const a2 = i * 0.9 + 0.3, rad = i ? 0.11 : 0;
      ccyl.add(PZx + Math.cos(a2) * rad, 0.835, PZz + Math.sin(a2) * rad, 0.03, 0.006, 0.03, { c: '#b23a2a' });
    }
    // straw gift basket: a dark wine bottle, little coloured boxes and a folded scarf
    const BKx = TX + 0.2, BKz = TZ - 0.66;
    ccyl.add(BKx, 0.78, BKz, 0.17, 0.15, 0.17, { c: '#d8b46a' });
    ccyl.add(BKx, 0.93, BKz, 0.175, 0.02, 0.175, { c: '#b8914a' });                                    // woven rim
    ccyl.add(BKx + 0.06, 0.8, BKz - 0.04, 0.035, 0.24, 0.035, { c: '#3a0d14' });                       // wine bottle
    ccyl.add(BKx + 0.06, 1.04, BKz - 0.04, 0.013, 0.09, 0.013, { c: '#2a0a0f' });
    cbox.add(BKx - 0.07, 0.86, BKz + 0.05, 0.09, 0.1, 0.07, { c: '#1e88e5' });
    cbox.add(BKx - 0.05, 0.86, BKz - 0.08, 0.07, 0.12, 0.06, { c: '#fdd835' });
    cslab.add(BKx - 0.02, 0.97, BKz + 0.03, 0.2, 0.03, 0.1, { c: '#c0504d', rz: 0.3 });               // scarf
    for (const [dx, dz, c] of [[-0.25, 0.25, '#f4f4f4'], [-0.28, 0.0, '#ffd54f'], [0.28, 0.35, '#f48fb1']]) {
      ccyl.add(TX + dx, 0.78, TZ + dz, 0.05, 0.1, 0.05, { c }); // party cups
    }
    for (const [dx, dz] of [[-0.2, 0.22], [-0.25, -0.6]]) ccyl.add(TX + dx, 0.78, TZ + dz, 0.1, 0.012, 0.1, { c: '#ffffff' }); // plates

    // green dinosaur bounce house
    const BX0 = 7.0, BX1 = 10.2, BZ0 = 2.9, BZ1 = 5.25, bcx = (BX0 + BX1) / 2, bcz = (BZ0 + BZ1) / 2;
    cbox.add(bcx, 0, bcz, BX1 - BX0, 0.5, BZ1 - BZ0, { c: '#43a047' });
    cbox.add(bcx, 0.5, BZ1 - 0.12, BX1 - BX0, 1.3, 0.24, { c: '#66bb6a' });          // back wall
    for (const x of [BX0 + 0.1, BX1 - 0.1]) cbox.add(x, 0.5, bcz, 0.2, 1.0, BZ1 - BZ0, { c: '#81c784' });
    for (const [x, z] of [[BX0, BZ0], [BX1, BZ0], [BX0, BZ1], [BX1, BZ1]]) {
      ccyl.add(x, 0, z, 0.26, 1.95, 0.26, { c: '#2e7d32' });
      csph.add(x, 2.05, z, 0.24, 0.24, 0.24, { c: '#fdd835' });
    }
    cbox.add(BX0 - 0.35, 0, bcz, 0.7, 0.25, 1.4, { c: '#fdd835' });                   // entry ramp
    // dinosaur rising from the back-right corner, looking toward the street
    ccyl.add(9.45, 1.6, BZ1 - 0.25, 0.28, 1.2, 0.28, { c: '#4caf50' });
    cslab.add(9.15, 3.0, BZ1 - 0.25, 0.95, 0.5, 0.55, { c: '#4caf50', rz: -0.12 });     // head
    cslab.add(8.72, 2.86, BZ1 - 0.25, 0.25, 0.08, 0.5, { c: '#2e7d32' });               // mouth line
    for (const dz of [-0.18, 0.18]) {
      csph.add(8.92, 3.22, BZ1 - 0.25 + dz, 0.09, 0.09, 0.09, { c: '#ffffff' });
      csph.add(8.85, 3.22, BZ1 - 0.25 + dz, 0.045, 0.045, 0.045, { c: '#1d1d1d' });
    }
    for (let i = 0; i < 6; i++) ccone.add(BX0 + 0.5 + i * 0.42, 1.8, BZ1 - 0.12, 0.13, 0.32, 0.13, { c: i % 2 ? '#fdd835' : '#2e7d32' });
    ccone.add(9.45, 3.25, BZ1 - 0.25, 0.1, 0.25, 0.1, { c: '#fdd835' });
    col(BX0 - 0.1, BX1 + 0.1, BZ0, BZ1 + 0.05, 0, 2.2);

    // pennant bunting from the eaves to the gate posts
    const bunting = (a, b, n) => {
      line.add(a, b, 0.008, '#ececec');
      for (let i = 1; i < n; i++) {
        const f = i / n, sag = Math.sin(f * Math.PI) * 0.25;
        ccone.add(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - sag * 0.2 - 0.02, a[2] + (b[2] - a[2]) * f, 0.1, -0.24, 0.02,
          { c: ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ec407a', '#8e24aa'][i % 6], ry: Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2 });
      }
    };
    bunting([10.45, 3.1, -0.7], [FX, 1.05, GATE0], 9);
    bunting([10.45, 3.1, 4.4], [FX, 1.05, GATE1], 9);

    // balloons (green, white and gold) tied to the gate posts, the table and the bounce house
    const B_COLORS = ['#3fae49', '#7ccf5a', '#2e8b57', '#a5d65f', '#f4f4f4', '#e8c547'];
    const tie = (x, y, z, list) => list.forEach(([dx, dh, dz], i) => balloons.addBalloon([x, y, z], [x + dx, y + dh, z + dz], B_COLORS[(i * 2 + Math.round(x * 3)) % B_COLORS.length]));
    // (kept to the outside of the gate and away from the table side, so they don't sit on the camera line)
    tie(FX, 1.05, GATE0, [[-0.3, 1.0, -0.3], [-0.12, 1.25, -0.45], [-0.4, 0.85, -0.1], [-0.05, 1.05, -0.65]]);
    tie(FX, 1.05, GATE1, [[-0.3, 1.1, 0.3], [-0.12, 1.3, 0.5], [-0.42, 0.9, 0.1], [-0.05, 1.2, 0.7]]);
    tie(TX + 0.45, 0.8, TZ + 0.9, [[0.25, 1.05, 0.1], [0.4, 1.25, -0.1], [0.55, 1.35, 0.2]]);
    tie(BX1, 2.0, BZ0, [[0.1, 0.85, -0.1], [-0.12, 1.05, 0.0]]);
    tie(BX1, 2.0, BZ1, [[0.15, 0.8, 0.1], [-0.1, 1.0, 0.05]]);
    proxy(BX0 - 0.3, BX1 + 0.3, 0, 2.3, BZ0 - 0.25, BZ1 + 0.25);                     // bounce house camera proxy

    // ------------------------------------------------------------------ zone 3: the community / wedding hall
    const HX0 = -6, HX1 = 6, HZ0 = -25, HZ1 = -17, HH = 4.4, WT = 0.3, DOOR = 1.3;
    const brickMat = own(new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 0.92 }), 'mats');
    const wallBox = (x0, x1, y0, y1, z0, z1) => {
      const w = x1 - x0, h = y1 - y0, d = z1 - z0;
      const g = own(new THREE.BoxGeometry(w, h, d), 'geos'); boxUV(g, w, h, d, 1.0, 0.6);
      const m = new THREE.Mesh(g, brickMat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.castShadow = m.receiveShadow = true; group.add(m); return m;
    };
    wallBox(HX0, -DOOR, 0, HH, HZ1 - WT / 2, HZ1 + WT / 2);
    wallBox(DOOR, HX1, 0, HH, HZ1 - WT / 2, HZ1 + WT / 2);
    wallBox(-DOOR, DOOR, 2.75, HH, HZ1 - WT / 2, HZ1 + WT / 2);
    wallBox(HX0 - WT / 2, HX0 + WT / 2, 0, HH, HZ0, HZ1 + WT / 2);
    wallBox(HX1 - WT / 2, HX1 + WT / 2, 0, HH, HZ0, HZ1 + WT / 2);
    wallBox(HX0, HX1, 0, HH, HZ0 - WT / 2, HZ0 + WT / 2);
    col(HX0, -DOOR, HZ1 - WT / 2, HZ1 + WT / 2, 0, HH); col(DOOR, HX1, HZ1 - WT / 2, HZ1 + WT / 2, 0, HH);
    col(HX0 - WT / 2, HX0 + WT / 2, HZ0, HZ1, 0, HH); col(HX1 - WT / 2, HX1 + WT / 2, HZ0, HZ1, 0, HH);
    col(HX0, HX1, HZ0 - WT / 2, HZ0 + WT / 2, 0, HH);
    colliders.push({ min: [HX0, HH, HZ0], max: [HX1, HH + 1.6, HZ1] }); // roof: keeps the orbit camera inside
    // façade proxy (doorway included): keeps the camera in front of the trims instead of inside the wall
    proxy(HX0 - 0.3, HX1 + 0.3, 0, HH + 0.5, HZ1 - 0.35, HZ1 + 0.35);
    cbox.add(0, HH, (HZ0 + HZ1) / 2, HX1 - HX0 + 0.5, 0.3, HZ1 - HZ0 + 0.5, { c: '#5b4b44' });          // roof slab
    cbox.add(0, HH - 0.1, HZ1 + 0.2, HX1 - HX0 + 0.6, 0.45, 0.14, { c: '#efe8da' });                   // cornice
    cbox.add(0, 2.75, HZ1 + 0.18, 2 * DOOR + 0.3, 0.18, 0.08, { c: '#efe8da' });                       // door head trim
    for (const x of [-DOOR, DOOR]) cbox.add(x, 0, HZ1 + 0.18, 0.18, 2.8, 0.08, { c: '#efe8da' });       // door jambs
    flat.add(0, 0, (HZ0 + HZ1) / 2, HX1 - HX0 - 0.2, 0.06, HZ1 - HZ0 - 0.2, { c: '#b88a5a' });          // wooden floor
    // double doors swung open inward
    for (const s of [-1, 1]) cbox.add(s * (DOOR - 0.12) , 0, HZ1 - 0.55, 0.06, 2.6, 1.05, { c: '#f1ede4', ry: -s * 0.25 });
    // glowing windows (front & sides)
    for (const x of [-3.7, 3.7]) {
      glowBox.add(x, 1.0, HZ1 + 0.17, 1.7, 1.6, 0.04, { c: '#ffe2a8' });
      cbox.add(x, 0.9, HZ1 + 0.18, 1.95, 0.12, 0.12, { c: '#efe8da' });
      cbox.add(x, 2.6, HZ1 + 0.18, 1.95, 0.12, 0.08, { c: '#efe8da' });
    }
    for (const z of [-19.5, -22.5]) for (const s of [-1, 1]) glowBox.add(s * (HX1 + WT / 2 + 0.01), 1.0, z, 0.03, 1.6, 1.6, { c: '#ffe2a8' });
    // planters with white blooms flanking the door
    for (const s of [-1, 1]) {
      ccyl.add(s * 2.25, 0, HZ1 + 0.7, 0.32, 0.55, 0.32, { c: '#e8e2d6' });
      csph.add(s * 2.25, 0.72, HZ1 + 0.7, 0.36, 0.3, 0.36, { c: '#55704a' });
      for (let i = 0; i < 7; i++) {
        const a2 = i * 0.9; csph.add(s * 2.25 + Math.cos(a2) * 0.2, 0.86 + (i % 2) * 0.07, HZ1 + 0.7 + Math.sin(a2) * 0.2, 0.08, 0.07, 0.08, { c: i % 3 ? '#fbf8f1' : '#f4dfe0' });
      }
      col(s * 2.25 - 0.33, s * 2.25 + 0.33, HZ1 + 0.37, HZ1 + 1.03, 0, 0.9);
    }
    // flower arch (white half-torus) over the approach
    const ARCH_Z = HZ1 + 0.75, ARCH_R = 1.75, ARCH_Y = 1.0;
    const archGeo = own(new THREE.TorusGeometry(ARCH_R, 0.1, 6, 28, Math.PI), 'geos');
    const arch = new THREE.Mesh(archGeo, mats.color('#f6f3ec', { roughness: 0.7 }));
    arch.position.set(0, ARCH_Y, ARCH_Z); arch.castShadow = true; group.add(arch);
    for (const s of [-1, 1]) {
      ccyl.add(s * ARCH_R, 0, ARCH_Z, 0.09, ARCH_Y, 0.09, { c: '#f6f3ec' });
      col(s * ARCH_R - 0.15, s * ARCH_R + 0.15, ARCH_Z - 0.15, ARCH_Z + 0.15, 0, 2.5);
    }
    const ar = ctx.rand(31);
    for (let i = 0; i <= 26; i++) {
      const a2 = (i / 26) * Math.PI, x = Math.cos(a2) * ARCH_R, y = ARCH_Y + Math.sin(a2) * ARCH_R;
      const c = ['#fbf8f1', '#fbf8f1', '#f4dfe0', '#eae6d8', '#7f9a6c'][i % 5];
      const k = c === '#7f9a6c' ? 0.12 : 0.1 + ar() * 0.04;
      csph.add(x + (ar() - 0.5) * 0.06, y + (ar() - 0.5) * 0.06, ARCH_Z + (ar() - 0.5) * 0.12, k, k, k, { c });
    }
    for (let i = 0; i < 6; i++) csph.add(Math.sign(i - 2.5) * ARCH_R + (ar() - 0.5) * 0.1, 0.3 + (i % 3) * 0.3, ARCH_Z, 0.11, 0.11, 0.11, { c: i % 2 ? '#7f9a6c' : '#fbf8f1' });
    // sign board above the door (couple's names via makeLabel, occluded by geometry)
    cbox.add(0, 3.0, HZ1 + 0.2, 3.5, 0.95, 0.06, { c: '#c9a227' });
    cbox.add(0, 3.05, HZ1 + 0.24, 3.36, 0.85, 0.04, { c: '#f7f1e3' });
    const sign = ctx.makeLabel({ ar: 'زفاف يوسف ومريم', en: 'Yusuf & Mariam' }, { size: 0.5, background: false, color: '#7a5a1e', depthTest: true });
    sign.position.set(0, 3.48, HZ1 + 0.32); group.add(sign);
    // string lights: swags across the façade and along the arch approach
    const swag = (a, b, n, sag) => {
      let prev = a;
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - Math.sin(f * Math.PI) * sag, a[2] + (b[2] - a[2]) * f];
        line.add(prev, p, 0.008, '#3a3a3a');
        if (i < n) glow.add(p[0], p[1] - 0.05, p[2], 0.045, 0.06, 0.045, { c: '#fff4d6' });
        prev = p;
      }
    };
    const LZ = HZ1 + 0.28;
    swag([HX0, 4.2, LZ], [-2.0, 4.2, LZ], 9, 0.45);
    swag([2.0, 4.2, LZ], [HX1, 4.2, LZ], 9, 0.45);
    swag([-2.0, 4.2, LZ], [2.0, 4.2, LZ], 9, 0.25);
    swag([-ARCH_R, 2.6, ARCH_Z], [HX0 + 0.2, 4.2, LZ], 7, 0.3);
    swag([ARCH_R, 2.6, ARCH_Z], [HX1 - 0.2, 4.2, LZ], 7, 0.3);

    // interior: round tables in white & gold, chairs, pendant lights, a softly lit dance floor at the back
    const tables = [[-3.4, -19.3], [3.4, -19.3], [-3.6, -21.9], [3.6, -21.9]];
    for (const [x, z] of tables) {
      ccyl.add(x, 0, z, 0.78, 0.76, 0.78, { c: '#fbfaf6' });
      ccyl.add(x, 0.76, z, 0.6, 0.012, 0.6, { c: '#d9b75a' });
      ccyl.add(x, 0.77, z, 0.08, 0.22, 0.08, { c: '#c9a227' });
      csph.add(x, 1.06, z, 0.16, 0.13, 0.16, { c: '#fbf8f1' });
      for (let i = 0; i < 6; i++) {
        const a2 = (i / 6) * Math.PI * 2 + 0.3, cxx = x + Math.cos(a2) * 1.05, czz = z + Math.sin(a2) * 1.05;
        cbox.add(cxx, 0, czz, 0.4, 0.46, 0.4, { c: '#d8c38a', ry: -a2 });
        cslab.add(x + Math.cos(a2) * 1.25, 0.75, z + Math.sin(a2) * 1.25, 0.06, 0.6, 0.4, { c: '#d8c38a', ry: -a2 });
      }
      col(x - 1.3, x + 1.3, z - 1.3, z + 1.3, 0, 1.0);
    }
    // welcome table with a guest book near the entrance
    cbox.add(-2.6, 0, -17.75, 1.5, 0.76, 0.6, { c: '#fbfaf6' });
    cbox.add(-2.6, 0.76, -17.75, 0.4, 0.04, 0.3, { c: '#c9a227' });
    col(-3.4, -1.8, -18.1, -17.4, 0, 1.0);
    const tr = ctx.rand(5);
    const DANCE = ['#6b3f8a', '#2f4f8a', '#8a5a2f', '#3f7a7a', '#7a3f5a'];
    for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 3; iz++) {
      glowBox.add(-2.5 + ix + 0.5, 0.06, -24.5 + iz * 0.75 + 0.375, 0.96, 0.02, 0.71, { c: DANCE[Math.floor(tr() * DANCE.length)] });
    }
    cbox.add(0, 0, -24.75, 5.0, 2.6, 0.12, { c: '#f7f1e3' });                 // floral backdrop panel
    for (let i = 0; i < 18; i++) csph.add(-2.3 + (i % 9) * 0.575, 2.45 + Math.floor(i / 9) * 0.22, -24.66, 0.14, 0.14, 0.1, { c: i % 3 ? '#fbf8f1' : '#f4dfe0' });
    for (const [x, z] of [[-3, -18.7], [3, -18.7], [-3, -21.3], [3, -21.3], [0, -23.5], [0, -19.9]]) {
      line.add([x, HH, z], [x, 3.55, z], 0.01, '#3a3a3a');
      glow.add(x, 3.45, z, 0.16, 0.16, 0.16, { c: '#ffe6b0' });
    }
    const hallLight = own(new THREE.PointLight('#ffd49a', 22, 13, 1.6), 'lights');
    hallLight.position.set(0, 3.4, -20.5); group.add(hallLight);
    const danceLight = own(new THREE.PointLight('#b58ad9', 6, 6, 2), 'lights');
    danceLight.position.set(0, 2.2, -23.6); group.add(danceLight);

    // parking lot beside the hall: two parked cars
    const car = (x, z, body) => {
      cbox.add(x, 0.25, z, 4.1, 0.65, 1.8, { c: body });
      cbox.add(x - 0.2, 0.9, z, 2.2, 0.55, 1.6, { c: body });
      glass.add(x - 0.2, 0.93, z, 2.24, 0.42, 1.64, {});
      for (const dx of [-1.3, 1.3]) for (const dz of [-0.82, 0.82]) ccyl.add(x + dx, 0.36, z + dz - 0.11, 0.36, 0.22, 0.36, { c: '#1f2124', rx: Math.PI / 2 });
      col(x - 2.1, x + 2.1, z - 0.95, z + 0.95, 0, 1.5);
    };
    car(10.0, -19.05, '#8e9aa6'); car(10.6, -24.0, '#7a2f35');

    // ------------------------------------------------------------------ street furniture & trees
    for (const [x, z, c] of [[-5.75, 7.6, '#2c2f33'], [5.75, 13.6, '#2f5f9e'], [5.75, 6.0, '#2c2f33'], [-5.75, -4.6, '#3b4d3b'], [-5.75, 14.0, '#2c2f33'], [8.6, -4.6, '#6b3a2e']]) {
      cbox.add(x, 0, z, 0.1, 1.0, 0.1, { c: '#5e3d22' });
      cbox.add(x, 1.0, z, 0.26, 0.24, 0.48, { c });
      cbox.add(x + 0.14, 1.12, z + 0.1, 0.02, 0.2, 0.05, { c: '#c0392b' });
    }
    for (const [x, z] of [[-5.75, 0.5], [5.75, 8.0], [-7.0, -15.0], [7.2, -16.0]]) {
      ccyl.add(x, 0, z, 0.08, 3.8, 0.08, { c: '#3a3f45' });
      cbox.add(x, 3.75, z, 0.34, 0.12, 0.34, { c: '#3a3f45' });
      glow.add(x, 3.68, z, 0.14, 0.1, 0.14, { c: '#fff1c9' });
      col(x - 0.12, x + 0.12, z - 0.12, z + 0.12, 0, 3);
    }
    // bare winter trees (trunk + angled limbs), instanced
    const tree = (x, z, h, seed) => {
      const rr = ctx.rand(seed);
      wood.add(x, 0, z, 0.2 * h / 4.5, h, 0.2 * h / 4.5, {});
      for (let i = 0; i < 6; i++) {
        const y = h * (0.45 + 0.08 * i), L = h * (0.32 + rr() * 0.18);
        wood.add(x, y, z, 0.07, L, 0.07, { rx: 0.55 + rr() * 0.45, ry: i * 1.9 + rr() });
      }
      col(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 0, 3);
    };
    [[-6.6, 13.5, 5.2], [-6.7, -0.6, 4.6], [-6.8, -9.6, 4.8], [6.7, 10.2, 5.0], [9.2, -3.2, 4.4], [-9.0, -20.0, 5.4], [-8.4, -24.6, 4.6], [-11.0, -14.2, 5.0], [12.4, -14.8, 4.2]]
      .forEach(([x, z, h], i) => tree(x, z, h, 50 + i));
    // evergreens framing the edges (two stacked cones)
    const pine = (x, z, h) => {
      wood.add(x, 0, z, 0.12, 0.8, 0.12, {});
      ccone.add(x, 0.6, z, h * 0.28, h * 0.62, h * 0.28, { c: '#2f5240' });
      ccone.add(x, 0.6 + h * 0.38, z, h * 0.2, h * 0.55, h * 0.2, { c: '#365c47' });
      csph.add(x, 0.6 + h * 0.62, z, h * 0.08, h * 0.05, h * 0.08, { c: '#eef2f6' }); // snow cap
      col(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 0, 3);
    };
    [[-12.2, -0.9, 6], [-12.4, 11.0, 5.5], [12.6, 7.3, 6], [-8.6, -27.6, 7], [-3.2, -27.4, 6.2], [3.0, -27.8, 6.8], [8.4, -27.2, 6.4],
      [14.6, -18.5, 6], [-7.3, 19.4, 6], [7.6, 19.0, 6.4], [-12.4, -25.2, 6.4], [16.0, 9.0, 5]]
      .forEach(([x, z, h]) => pine(x, z, h));
    // low hedges between the Adam and Garcia lots and around the parking lot
    cbox.add(12.6, 0, 6.6, 6.0, 0.9, 0.7, { c: '#4c6542' });
    cbox.add(9.8, 0, -25.6, 6.6, 0.9, 0.7, { c: '#4c6542' });
    cbox.add(13.4, 0, -21.2, 0.7, 0.9, 8.2, { c: '#4c6542' });

    // ------------------------------------------------------------------ boundary colliders (invisible)
    col(-10.8, -10.2, -27, 22, 0, 3);    // west
    col(10.6, 11.2, -16, 22, 0, 3);      // east (houses side)
    col(13.4, 14.0, -27, -15.4, 0, 3);   // east (parking lot)
    col(10.6, 14.0, -16.0, -15.4, 0, 3); // close the corner between the two east walls
    col(-11, 14, 16.8, 17.4, 0, 3);      // south
    col(-11, 14, -26.9, -26.3, 0, 3);    // north

    // ------------------------------------------------------------------ finalize instanced meshes
    I.buildAll();

    // ------------------------------------------------------------------ NPCs
    const yusuf = ctx.makeNPC({ skin: '#8d5524', shirt: '#f4f4f4', suit: '#6e6e73', tie: '#e9e4d8', beard: '#1d1410', hair: '#1d1410', pants: '#5d5d62', height: 1.8 });
    const rose = new THREE.Mesh(own(new THREE.IcosahedronGeometry(0.045, 0), 'geos'), mats.color('#fbf8f1'));
    rose.position.set(0.12, 1.53, -0.19); yusuf.add(rose);
    const leo = ctx.makeNPC({ skin: '#d1a17a', shirt: '#4caf50', pants: '#2f4f7f', hair: '#3b2414', height: 1.15 });
    const dinoCap = new THREE.Mesh(own(new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 'geos'), mats.color('#43a047'));
    dinoCap.position.set(0, 1.69, 0.01); leo.add(dinoCap);                                   // dinosaur hat
    // Omar on the porch steps with the snow shovel he used to clear the Harris walk
    const omar = ctx.makeNPC({ skin: '#5a3a22', shirt: '#556b2f', pants: '#3a3f47', kufi: '#7a7a7a', beard: '#1d1410', hair: '#1d1410', height: 1.85 });
    const shovelH = new THREE.Mesh(own(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 6), 'geos'), mats.woodDark);
    shovelH.position.set(-0.36, 0.72, -0.1); shovelH.rotation.z = 0.1; shovelH.castShadow = true; omar.add(shovelH);
    const shovelB = new THREE.Mesh(own(new THREE.BoxGeometry(0.36, 0.3, 0.03), 'geos'), mats.black);
    shovelB.position.set(-0.42, 0.15, -0.1); shovelB.castShadow = true; omar.add(shovelB);
    // Hodan beside him, carrying a covered dish
    const hodan = ctx.makeNPC({ skin: '#5a3a22', shirt: '#c19a6b', dress: '#c19a6b', hijab: '#2c3550', height: 1.65 });
    const tray = new THREE.Mesh(own(new THREE.BoxGeometry(0.4, 0.07, 0.3), 'geos'), mats.color('#c9ced3', { roughness: 0.35, metalness: 0.5 }));
    tray.position.set(0, 1.08, -0.5); tray.castShadow = true; hodan.add(tray);
    hodan.userData.parts.armL.rotation.x = 1.0; hodan.userData.parts.armR.rotation.x = 1.0; // arms forward under the tray
    const LEO_BASE = 0.5;

    const npcs = [
      { id: 'omar', object: omar, position: [-6.0, 0, 7.2], yaw: ctx.yawTo([-6.0, 7.2], [-4.2, 5.6]) },
      { id: 'bg_hodan', object: hodan, position: [-5.2, 0, 7.45], yaw: ctx.yawTo([-5.2, 7.45], [-4.0, 6.0]), animate: false },
      { id: 'bg_margaret', position: [-7.25, PORCH_Y, 6.55], yaw: -Math.PI / 2,
        look: { skin: '#f3d3b5', shirt: '#6d6d72', dress: '#1a1a1a', pants: '#1a1a1a', hair: '#e8e6e1', shoes: '#111111', height: 1.58 } },
      { id: 'maria', position: [6.35, 0, 2.75], yaw: ctx.yawTo([6.35, 2.75], [4.4, 1.2]),
        look: { skin: '#d1a17a', shirt: '#d46a8c', hair: '#5a3a22', pants: '#3b4a6b', height: 1.66 } },
      { id: 'yusuf', object: yusuf, position: [1.45, 0, -15.3], yaw: ctx.yawTo([1.45, -15.3], [0.5, -11]) },
      { id: 'bg_mariam', position: [-1.45, 0, -15.4], yaw: ctx.yawTo([-1.45, -15.4], [-0.3, -11]),
        look: { skin: '#a0673d', shirt: '#f5f0e6', dress: '#f5f0e6', pants: '#f5f0e6', hijab: '#f5f0e6', shoes: '#e8e0d0', height: 1.65 } },
      { id: 'bg_imam_hamza', position: [3.5, 0, -16.0], yaw: ctx.yawTo([3.5, -16.0], [1.4, -14.5]),
        look: { skin: '#4a2f1d', shirt: '#f2f2f2', dress: '#f2f2f2', suit: '#6b4a2f', tie: '#f2f2f2', kufi: '#ffffff', beard: '#9a9a9a', height: 1.78 } },
      { id: 'bg_jake', position: [-2.2, 0, -18.55], yaw: ctx.yawTo([-2.2, -18.55], [-3.3, -18.6]),
        look: { skin: '#f1c27d', shirt: '#f2f2f2', suit: '#1f2a44', hair: '#8a5a2b', pants: '#1f2a44', height: 1.82 } },
      { id: 'bg_emily', position: [-3.3, 0, -18.6], yaw: ctx.yawTo([-3.3, -18.6], [-2.2, -18.55]),
        look: { skin: '#ffdbac', shirt: '#2f7d4f', dress: '#2f7d4f', hair: '#d4a76a', height: 1.66 } },
      { id: 'bg_carol', position: [9.3, 0, 1.1], yaw: ctx.yawTo([9.3, 1.1], [7.6, 1.2]),
        look: { skin: '#f0c8a8', shirt: '#6b7a3a', pants: '#4a4a52', hair: '#c9c9c9', glasses: true, height: 1.62 } },
      { id: 'bg_idris', position: [6.05, 0, 3.75], yaw: ctx.yawTo([6.05, 3.75], [8.5, 4.05]),
        look: { skin: '#5a3a22', shirt: '#e67e22', pants: '#2f3542', hair: '#1d1410', height: 1.15 } },
      { id: 'bg_leo', object: leo, position: [8.5, LEO_BASE, 4.05], yaw: ctx.yawTo([8.5, 4.05], [6, 1.5]), collide: false },
    ];

    // ------------------------------------------------------------------ hotspots / spawn / exit
    const hotspots = [
      { id: 'harris_porch', position: [-5.45, 0, 6.0], radius: 1.8, label: { ar: 'بيت العمّ صالح', en: "Uncle Saleh's home" } },
      { id: 'garcia_yard', position: [6.55, 0, 1.15], radius: 1.8, label: { ar: 'فناء آل غارسيا', en: 'Garcia yard' } },
      { id: 'wedding_hall', position: [0, 0, -14.9], radius: 1.9, label: { ar: 'قاعة الزفاف', en: 'Wedding hall' } }
    ];

    return {
      group,
      spawn: { position: [5, 0, 12], yaw: 0 },
      colliders,
      hotspots,
      npcs,
      exit: { position: [0, 0, -20.8], radius: 1.5 },
      lights: 'day',
      sky: '#cfd9e6',
      fog: { color: '#cfd9e6', near: 35, far: 110 },
      cameraOccluders: camProxies,
      update(dt, t) {
        balloons.tick(t);
        leo.position.y = LEO_BASE + Math.abs(Math.sin(t * 3.2)) * 0.38;
      },
      dispose() {
        camProxies.length = 0;
        owned.lights.forEach((l) => { group.remove(l); l.dispose?.(); });
        owned.geos.forEach((g) => g.dispose());
        owned.mats.forEach((m) => m.dispose());
        owned.texs.forEach((tx) => tx.dispose());
        owned.geos.length = owned.mats.length = owned.texs.length = owned.lights.length = 0;
      }
    };
  }
};
