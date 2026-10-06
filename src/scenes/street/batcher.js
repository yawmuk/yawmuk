// Geometry batcher for the street scene: collects transformed primitives per material bucket and
// merges each bucket into ONE mesh (keeps the draw-call / mesh count tiny). Vertex colors are filled
// automatically for buckets whose material has `vertexColors: true`.

export function createBatcher(THREE) {
  const buckets = new Map();
  const parent = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  const yAxis = new THREE.Vector3(0, 1, 0);

  function bucket(name, mat, opts = {}) {
    buckets.set(name, { mat, items: [], cast: opts.cast ?? true, receive: opts.receive ?? true, name });
  }

  /** set the parent frame (position + yaw) for following primitives */
  function frame(x = 0, y = 0, z = 0, ry = 0) {
    q.setFromAxisAngle(yAxis, ry);
    p.set(x, y, z); s.set(1, 1, 1);
    parent.compose(p, q, s);
  }
  function end() { parent.identity(); }

  /** add a geometry (centered at its own origin) at local center (x,y,z) with rotation and scale */
  function geo(name, color, g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const b = buckets.get(name);
    let gg = g.index ? g.toNonIndexed() : g;
    if (gg !== g) g.dispose();
    e.set(rx, ry, rz); q.setFromEuler(e); p.set(x, y, z); s.set(sx, sy, sz);
    local.compose(p, q, s);
    local.premultiply(parent);
    gg.applyMatrix4(local);
    b.items.push({ g: gg, color });
    return gg;
  }
  /** box with BOTTOM at y */
  function box(name, color, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
    return geo(name, color, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, rx, ry, rz);
  }
  /** cylinder centered at (x,yc,z) */
  function cyl(name, color, rt, rb, h, x, yc, z, seg = 10, rx = 0, rz = 0, ry = 0) {
    return geo(name, color, new THREE.CylinderGeometry(rt, rb, h, seg), x, yc, z, rx, ry, rz);
  }
  /** flat plane lying on the ground (facing +y) */
  function flat(name, color, w, d, x, y, z, ry = 0) {
    // Euler XYZ applies Rz first, then Rx(-90°) lays the plane down -> rz acts as a yaw.
    return geo(name, color, new THREE.PlaneGeometry(w, d), x, y, z, -Math.PI / 2, 0, ry);
  }

  function flush(group) {
    const meshes = [];
    for (const b of buckets.values()) {
      if (!b.items.length) continue;
      let n = 0;
      for (const it of b.items) n += it.g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      const vc = b.mat.vertexColors ? new Float32Array(n * 3) : null;
      let o = 0;
      for (const it of b.items) {
        const a = it.g.attributes, c = a.position.count;
        pos.set(a.position.array, o * 3);
        if (a.normal) nor.set(a.normal.array, o * 3);
        if (a.uv) uv.set(a.uv.array, o * 2);
        if (vc) {
          col.set(it.color || '#ffffff');
          for (let i = 0; i < c; i++) { const k = (o + i) * 3; vc[k] = col.r; vc[k + 1] = col.g; vc[k + 2] = col.b; }
        }
        o += c;
        it.g.dispose();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      if (vc) g.setAttribute('color', new THREE.BufferAttribute(vc, 3));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, b.mat);
      m.name = `street:${b.name}`;
      m.castShadow = b.cast; m.receiveShadow = b.receive;
      group.add(m);
      meshes.push(m);
      b.items.length = 0;
    }
    return meshes;
  }

  return { bucket, frame, end, geo, box, cyl, flat, flush };
}
