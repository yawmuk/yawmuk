// Static-geometry batcher for the home scene: many primitives -> one vertex-coloured mesh per material.
// Keeps the draw-call / mesh count tiny while still allowing a rich, cohesive low-poly interior.

export function createBatcher(THREE) {
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const nrm = new THREE.Matrix3();

  const compose = (out, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    e.set(rx, ry, rz, 'YXZ');
    q.setFromEuler(e);
    p.set(x, y, z);
    s.set(sx, sy, sz);
    return out.compose(p, q, s);
  };

  return function makeBatch(name = 'batch') {
    const P = [], N = [], C = [], U = [];
    const stack = [new THREE.Matrix4()];
    const top = () => stack[stack.length - 1];

    const api = {
      /** push a local frame: position + yaw (ry) / pitch (rx) / roll (rz). */
      push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
        const m = compose(new THREE.Matrix4(), x, y, z, ry, rx, rz);
        stack.push(top().clone().multiply(m));
        return api;
      },
      pop() { if (stack.length > 1) stack.pop(); return api; },

      /** add any BufferGeometry (consumed + disposed) with transform & colour. uvScale [su, sv].
       *  If the geometry carries its own `color` attribute, each vertex colour is multiplied by `color`. */
      geo(g, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1, uvScale) {
        const gg = g.index ? g.toNonIndexed() : g;
        compose(local, x, y, z, ry, rx, rz, sx, sy, sz);
        world.multiplyMatrices(top(), local);
        nrm.getNormalMatrix(world);
        c.set(color);
        const pa = gg.attributes.position, na = gg.attributes.normal, ua = gg.attributes.uv, ca = gg.attributes.color;
        const su = uvScale ? uvScale[0] : 1, sv = uvScale ? uvScale[1] : 1;
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(world);
          P.push(v.x, v.y, v.z);
          if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nrm).normalize(); N.push(v.x, v.y, v.z); } else N.push(0, 1, 0);
          if (ca) C.push(c.r * ca.getX(i), c.g * ca.getY(i), c.b * ca.getZ(i)); else C.push(c.r, c.g, c.b);
          if (ua) U.push(ua.getX(i) * su, ua.getY(i) * sv); else U.push(0, 0);
        }
        if (gg !== g) gg.dispose();
        g.dispose();
        return api;
      },
      /** centre-based box */
      box(color, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
        return api.geo(new THREE.BoxGeometry(w, h, d), color, x, y, z, ry, rx, rz);
      },
      /** floor-based box: y0 is the bottom */
      fbox(color, w, h, d, x, y0, z, ry = 0) {
        return api.geo(new THREE.BoxGeometry(w, h, d), color, x, y0 + h / 2, z, ry);
      },
      /** box spanning two corners (axis aligned) */
      span(color, x0, y0, z0, x1, y1, z1) {
        return api.box(color, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      },
      cyl(color, rt, rb, h, x, y, z, seg = 10, ry = 0, rx = 0, rz = 0) {
        return api.geo(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, ry, rx, rz);
      },
      fcyl(color, rt, rb, h, x, y0, z, seg = 10) {
        return api.geo(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y0 + h / 2, z);
      },
      sph(color, r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 8, hs = 6) {
        return api.geo(new THREE.SphereGeometry(r, ws, hs), color, x, y, z, 0, 0, 0, sx, sy, sz);
      },
      ico(color, r, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) {
        return api.geo(new THREE.IcosahedronGeometry(r, 0), color, x, y, z, ry, 0, 0, sx, sy, sz);
      },
      torus(color, r, tube, x, y, z, ry = 0, rx = 0, rz = 0, arc = Math.PI * 2) {
        return api.geo(new THREE.TorusGeometry(r, tube, 5, 14, arc), color, x, y, z, ry, rx, rz);
      },
      /** centre-based plane; default normal +Z (rotate with ry / rx). uv scaled by [su, sv]. */
      quad(color, w, h, x, y, z, ry = 0, rx = 0, uvScale) {
        return api.geo(new THREE.PlaneGeometry(w, h), color, x, y, z, ry, rx, 0, 1, 1, 1, uvScale);
      },
      get empty() { return P.length === 0; },

      /** Build the mesh (null if empty). */
      build(material, { cast = true, receive = true } = {}) {
        if (!P.length) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
        g.computeBoundingSphere();
        g.computeBoundingBox();
        const m = new THREE.Mesh(g, material);
        m.name = `home:${name}`;
        m.castShadow = cast;
        m.receiveShadow = receive;
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        P.length = N.length = C.length = U.length = 0;
        return m;
      }
    };
    return api;
  };
}
