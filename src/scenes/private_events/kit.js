// Helpers for the private_events scene: canvas textures, unit geometries and instance batchers.
// Everything here takes THREE as a parameter (the scene only relies on ctx.THREE).

/** Remap a BoxGeometry's UVs so a texture tile covers tileW × tileH metres on every face. */
export function boxUV(geo, w, h, d, tileW, tileH) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let i = 0; i < uv.count; i++) {
    const [du, dv] = dims[Math.floor(i / 4)] || [1, 1];
    uv.setXY(i, (uv.getX(i) * du) / tileW, (uv.getY(i) * dv) / tileH);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Unit triangular prism (gable): base width 1 on x, apex height 1, length 1 along z, base at y=0. */
export function prismGeometry(THREE, vScale = 1) {
  let g = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.5, 0);
  g.scale(1 / Math.sqrt(3), 1 / 1.5, 1);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) + 0.5, p.getY(i) * vScale);
  uv.needsUpdate = true;
  return g;
}

function canvasTex(THREE, w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

export function makeTextures(THREE) {
  // grass: soft winter mottling (tinted by the material colour)
  const grass = canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 900; i++) {
      const v = 200 + Math.floor(rnd() * 55);
      g.fillStyle = `rgb(${v},${v},${Math.max(0, v - 20)})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3);
    }
  }, [28, 28]);
  // horizontal lap siding (white base so the instance colour tints it)
  const siding = canvasTex(THREE, 16, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.85, '#eeeeee'); grd.addColorStop(1, '#c9c9c9');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b5b5b5'; g.fillRect(0, h - 4, w, 4);
  }, [1, 14]);
  // running-bond brick, 1.0 m × 0.6 m per tile
  const brick = canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#d6c8b6'; g.fillRect(0, 0, w, h);
    let s = 99; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const rows = 8, cols = 4, bh = h / rows, bw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c < cols + 1; c++) {
        const k = 0.85 + rnd() * 0.25;
        g.fillStyle = `rgb(${Math.min(255, 160 * k) | 0},${(82 * k) | 0},${(45 * k) | 0})`;
        g.fillRect(c * bw + off + 1.5, r * bh + 1.5, bw - 3, bh - 3);
      }
    }
  });
  // cheerful striped party tablecloth
  const cloth = canvasTex(THREE, 128, 64, (g, w, h) => {
    const cs = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ec407a', '#ff9800'];
    const n = 12;
    for (let i = 0; i < n; i++) { g.fillStyle = cs[i % cs.length]; g.fillRect((i * w) / n, 0, w / n + 1, h); }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = 6; y < h; y += 16) g.fillRect(0, y, w, 3);
  });
  return { grass, siding, brick, cloth, all: [grass, siding, brick, cloth] };
}

/**
 * Instance batchers. Each `.add(x,y,z, sx,sy,sz, {c, rx, ry, rz})` queues one instance;
 * `buildAll()` turns every non-empty batch into a single InstancedMesh in `group`.
 * Rotation order is YXZ (yaw applied last), so {rx: tilt, ry: heading} tilts a limb outward.
 */
export function buildInstancers(THREE, group, tex, own) {
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  const tmpC = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);
  const geos = {
    boxB: own(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 'geos'),
    boxC: own(new THREE.BoxGeometry(1, 1, 1), 'geos'),
    cylB: own(new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0), 'geos'),
    cylC: own(new THREE.CylinderGeometry(1, 1, 1, 4), 'geos'),
    discB: own(new THREE.CylinderGeometry(1, 1, 1, 40).translate(0, 0.5, 0), 'geos'),
    discLo: own(new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0), 'geos'),
    coneB: own(new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0), 'geos'),
    ico: own(new THREE.IcosahedronGeometry(1, 1), 'geos'),
    icoLo: own(new THREE.IcosahedronGeometry(1, 0), 'geos'),
    sph: own(new THREE.SphereGeometry(1, 12, 8), 'geos'),
    limb: own(new THREE.CylinderGeometry(0.55, 1, 1, 6).translate(0, 0.5, 0), 'geos'),
    prism: own(prismGeometry(THREE, 2.4 / 3.4), 'geos')
  };
  const std = (o) => own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, ...o }), 'mats');
  const basic = () => own(new THREE.MeshBasicMaterial({ color: '#ffffff' }), 'mats');

  const all = [];
  function batch(geo, mat, { cast = true, receive = true, defColor = '#ffffff' } = {}) {
    const items = [];
    const b = {
      items, mesh: null,
      add(x, y, z, sx = 1, sy = 1, sz = 1, o = {}) {
        items.push({ x, y, z, sx, sy, sz, rx: o.rx || 0, ry: o.ry || 0, rz: o.rz || 0, q: o.q || null, c: o.c || defColor });
        return items.length - 1;
      },
      build() {
        if (!items.length) return null;
        const m = new THREE.InstancedMesh(geo, mat, items.length);
        items.forEach((it, i) => {
          dummy.position.set(it.x, it.y, it.z);
          if (it.q) dummy.quaternion.copy(it.q); else dummy.rotation.set(it.rx, it.ry, it.rz);
          dummy.scale.set(it.sx, it.sy, it.sz);
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
          m.setColorAt(i, tmpC.set(it.c));
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.castShadow = cast; m.receiveShadow = receive;
        m.computeBoundingSphere();
        group.add(m);
        b.mesh = m;
        return m;
      }
    };
    all.push(b);
    return b;
  }

  const I = {
    cbox: batch(geos.boxB, std()),
    cslab: batch(geos.boxC, std()),
    ccyl: batch(geos.cylB, std()),
    ccone: batch(geos.coneB, std({ side: THREE.DoubleSide, flatShading: true })),
    flat: batch(geos.boxB, std({ roughness: 0.95 }), { cast: false }),
    glow: batch(geos.icoLo, basic(), { cast: false, receive: false }),
    glowBox: batch(geos.boxB, basic(), { cast: false, receive: false }),
    bodies: batch(geos.boxB, std({ map: tex.siding })),
    gables: batch(geos.prism, std({ map: tex.siding, flatShading: true })),
    glass: batch(geos.boxB, std({ roughness: 0.15, metalness: 0.2, emissive: '#1d2a36', emissiveIntensity: 0.4 }), { defColor: '#7d97ad' }),
    wood: batch(geos.limb, std({ flatShading: true }), { defColor: '#5d4632' })
  };

  // spheres: small ones (blooms, knobs, picket caps, eyes) use a 20-triangle icosahedron, big ones (shrubs) 80
  const sphHi = batch(geos.ico, std({ flatShading: true }));
  const sphLo = batch(geos.icoLo, std({ flatShading: true }));
  I.csph = { add: (x, y, z, sx, sy, sz, o) => (Math.max(sx, sy, sz) < 0.2 ? sphLo : sphHi).add(x, y, z, sx, sy, sz, o) };
  // discs: the road circle / ring sidewalk are smooth (40 segments), small snow patches use 10
  const discHi = batch(geos.discB, std({ roughness: 0.95 }), { cast: false });
  const discLo = batch(geos.discLo, std({ roughness: 0.95 }), { cast: false });
  I.disc = { add: (x, y, z, sx, sy, sz, o) => (Math.max(sx, sz) < 3 ? discLo : discHi).add(x, y, z, sx, sy, sz, o) };

  // thin cylinders between two points (wires, strings, bunting lines)
  const lineB = batch(geos.cylC, std({ roughness: 0.6 }), { cast: false });
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  I.line = {
    add(a, b, r, c) {
      va.fromArray(a); vb.fromArray(b);
      const len = va.distanceTo(vb);
      if (len < 1e-4) return;
      const q = new THREE.Quaternion().setFromUnitVectors(UP, vb.clone().sub(va).normalize());
      lineB.add((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2, r, len, r, { q, c });
    }
  };

  // balloons: glossy ellipsoids + strings, gently bobbing (matrices rewritten in tick, no allocations)
  const bl = [];
  const balloonMat = std({ roughness: 0.3, metalness: 0.05 });
  const stringMat = std({ roughness: 0.8 });
  let bMesh = null, sMesh = null;
  const p = new THREE.Vector3(), dir = new THREE.Vector3(), bottom = new THREE.Vector3(), anchor = new THREE.Vector3();
  const BR = 0.17, BY = 1.22;
  function writeBalloon(i, t) {
    const b = bl[i];
    const bob = Math.sin(t * 1.6 + b.ph) * 0.06, sway = Math.sin(t * 0.9 + b.ph) * 0.035;
    p.set(b.pos[0] + sway, b.pos[1] + bob, b.pos[2] + sway * 0.6);
    dummy.position.copy(p);
    dummy.rotation.set(0, 0, sway * 1.5);
    dummy.scale.set(BR, BR * BY, BR);
    dummy.updateMatrix();
    bMesh.setMatrixAt(i, dummy.matrix);
    anchor.fromArray(b.anchor);
    bottom.set(p.x, p.y - BR * BY, p.z);
    dir.subVectors(bottom, anchor);
    const len = dir.length();
    dir.multiplyScalar(1 / Math.max(len, 1e-4));
    dummy.position.addVectors(anchor, bottom).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(UP, dir);
    dummy.scale.set(0.006, len, 0.006);
    dummy.updateMatrix();
    sMesh.setMatrixAt(i, dummy.matrix);
  }
  I.balloons = {
    addBalloon(anchorArr, posArr, color) { bl.push({ anchor: anchorArr, pos: posArr, color, ph: bl.length * 1.7 }); },
    tick(t) {
      if (!bMesh) return;
      for (let i = 0; i < bl.length; i++) writeBalloon(i, t);
      bMesh.instanceMatrix.needsUpdate = true;
      sMesh.instanceMatrix.needsUpdate = true;
    },
    build() {
      if (!bl.length) return;
      bMesh = new THREE.InstancedMesh(geos.sph, balloonMat, bl.length);
      sMesh = new THREE.InstancedMesh(geos.cylC, stringMat, bl.length);
      bl.forEach((b, i) => { bMesh.setColorAt(i, tmpC.set(b.color)); sMesh.setColorAt(i, tmpC.set('#f2f2f2')); writeBalloon(i, 0); });
      bMesh.castShadow = true;
      for (const m of [bMesh, sMesh]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.computeBoundingSphere(); m.frustumCulled = false; group.add(m); }
    }
  };

  I.buildAll = () => { all.forEach((b) => b.build()); I.balloons.build(); };
  return I;
}
