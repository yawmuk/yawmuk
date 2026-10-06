// Golden-hour backdrop (key art: public/brand/imagery/keyart-town-golden-hour.jpg).
// A sky dome (gradient + sun disc + painterly clouds, one TSL MeshBasicNodeMaterial) and the far field: three rings of hazy
// hills, a small city skyline and a sea strip with a sun glint (one vertex-coloured mesh + one sea mesh).
// 3 draw calls in total; nothing here reads the DOM, so scenes can build it headless (tests run in Node).
// The visual sun sits on the horizon down `sunAz` while the light (GOLDEN.sunDir) stays ~20° up so shadows are
// long but still land on the ground; the two azimuths are allowed to differ (the art does the same).
import * as THREE from 'three/webgpu';
import {
  Fn, If, uniform, vec3, vec4, float, mix, smoothstep, pow, max, dot, clamp, fract, floor, normalize,
  positionLocal, cameraPosition, cameraProjectionMatrix, cameraViewMatrix
} from 'three/tsl';

/** Shared golden-hour constants (world.js builds the `golden` light preset from these). */
export const GOLDEN = {
  sunDir: [0.79, 0.36, 0.5],     // towards the sun light (elevation ~21°, from +X/+Z: lights the north-row facades)
  sunAz: 0.14,                   // azimuth (rad, from +X towards +Z) of the visible sun disc: down the avenue's east end
  sunEl: 0.035,                  // elevation (rad) of the visible disc: resting on the horizon
  horizon: '#e57a32',            // = fog colour, so fogged ground melts into the sky (deep amber, as in the key art)
  low: '#f08d3c',
  mid: '#f2a670',
  zenith: '#6c9bd6',
  sun: '#ffa030',
  cloudLit: '#ffa04c',
  cloudShade: '#b46a66',
  haze: '#e57a32',               // far-field haze = horizon = fog (hills/sea melt into the sky)
  glow: [0.7, 1.2, 3.0],         // sun glow strengths: wide low side-glow, halo (pow 30), core (pow 400)
  cloud: [0.38, 0.58, 0.96, 1.0],// cloud coverage smoothstep lo/hi (lower = denser), opacity, sun-side under-light
  disc: [0.99955, 0.99968]       // sun disc: cos-angle smoothstep edges (lower = bigger disc)
};

// ---- sky dome shader (TSL; WebGPURenderer on WebGPU or its WebGL2 backend). 1:1 port of the old GLSL.
// Value noise: hash -> trilinear noise -> 4-octave fbm. setLayout() emits each as a real shader function instead
// of inlining 2 x 4 x 8 hash expressions into one giant graph.
const skyHash = /*@__PURE__*/ Fn(([p0]) => {
  const p = fract(p0.mul(0.3183099).add(0.1)).mul(17.0).toVar();
  return fract(p.x.mul(p.y).mul(p.z).mul(p.x.add(p.y).add(p.z)));
}).setLayout({ name: 'goldenSkyHash', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });

const skyNoise = /*@__PURE__*/ Fn(([x]) => {
  const i = floor(x).toVar();
  const f = fract(x).toVar();
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0))).toVar();
  const h = (a, b, c) => skyHash(i.add(vec3(a, b, c)));
  return mix(
    mix(mix(h(0, 0, 0), h(1, 0, 0), u.x), mix(h(0, 1, 0), h(1, 1, 0), u.x), u.y),
    mix(mix(h(0, 0, 1), h(1, 0, 1), u.x), mix(h(0, 1, 1), h(1, 1, 1), u.x), u.y),
    u.z
  );
}).setLayout({ name: 'goldenSkyNoise', type: 'float', inputs: [{ name: 'x', type: 'vec3' }] });

const skyFbm = /*@__PURE__*/ Fn(([p0]) => {
  const p = vec3(p0).toVar();
  const s = float(0.0).toVar();
  let a = 0.5;
  for (let k = 0; k < 4; k++) {           // unrolled at graph-build time
    s.addAssign(skyNoise(p).mul(a));
    if (k < 3) p.assign(p.mul(2.07).add(vec3(1.7, 9.2, 3.1)));
    a *= 0.5;
  }
  return s;
}).setLayout({ name: 'goldenSkyFbm', type: 'float', inputs: [{ name: 'p', type: 'vec3' }] });

/** Colour graph of the dome. `U` holds the uniform nodes (.value = THREE.Color / THREE.Vector3, updatable live). */
function skyColorNode(U) {
  return Fn(() => {
    const d = normalize(positionLocal).toVar();                  // = old vDir (the dome's model matrix is identity)
    const e = d.y;
    const h = max(e, 0.0).toVar();
    const s = normalize(U.uSunDir);
    const sd = dot(d, s).toVar();
    const cs = max(sd, 0.0).toVar();
    // vertical gradient: deep orange horizon -> peach -> pale cream -> soft blue zenith
    const col = mix(U.uHorizon, U.uLow, smoothstep(0.0, 0.09, h)).toVar();
    col.assign(mix(col, U.uMid, smoothstep(0.07, 0.3, h)));
    col.assign(mix(col, U.uZenith, smoothstep(0.22, 0.85, h)));
    // warm glow around the sun, strongest low on the horizon
    const side = pow(cs, 3.0).toVar();
    col.addAssign(U.uSun.mul(
      side.mul(U.uGlow.x).mul(float(1.0).sub(smoothstep(0.0, 0.45, h)))
        .add(pow(cs, 30.0).mul(U.uGlow.y))
        .add(pow(cs, 400.0).mul(U.uGlow.z))
    ));
    // painterly cloud streaks (horizontally stretched fbm), lit warm from below / from the sun side.
    // Only evaluated inside the cloud band (0.03 < e < 0.5): the rest of the dome skips the 8 noise lookups.
    const band = smoothstep(0.03, 0.08, e).mul(float(1.0).sub(smoothstep(0.26, 0.5, e))).toVar();
    const cov = float(0.0).toVar();
    If(band.greaterThan(0.0), () => {
      const q = vec3(d.x.mul(2.6), e.mul(19.0), d.z.mul(2.6)).toVar();
      const n = skyFbm(q).toVar();
      const nUp = skyFbm(q.add(vec3(0.0, 0.55, 0.0)));
      cov.assign(smoothstep(U.uCloud.x, U.uCloud.y, n).mul(band));
      const under = clamp(n.sub(nUp).mul(3.0).add(0.45), 0.0, 1.0).toVar();   // denser above than below -> lit underside
      const cloud = mix(U.uCloudShade, U.uCloudLit, clamp(under.mul(0.7).add(side.mul(0.6)), 0.0, 1.0)).toVar();
      cloud.addAssign(U.uSun.mul(pow(cs, 8.0)).mul(U.uCloud.w).mul(under));
      col.assign(mix(col, cloud, cov.mul(U.uCloud.z)));
    });
    // the sun disc (HDR so bloom catches it), slightly behind the lowest cloud wisps
    const disc = smoothstep(U.uDisc.x, U.uDisc.y, sd);
    col.assign(mix(col, U.uSun.mul(7.0).add(vec3(1.5, 1.2, 0.6)), disc.mul(float(1.0).sub(cov.mul(0.6)))));
    // below the horizon: the haze colour (= fog colour)
    col.assign(mix(col, U.uHorizon, float(1.0).sub(smoothstep(-0.03, 0.0, e))));
    return vec4(col, 1.0);
  })();
}

/** Direction of the visible sun disc (on the horizon, down `sunAz`). */
const sunVisDir = () => new THREE.Vector3(Math.cos(GOLDEN.sunAz) * Math.cos(GOLDEN.sunEl), Math.sin(GOLDEN.sunEl), Math.sin(GOLDEN.sunAz) * Math.cos(GOLDEN.sunEl));

/** Fresh set of sky uniform nodes from GOLDEN (`.value` = THREE.Color / Vector2-4, updatable live). */
export function createSkyUniforms() {
  const C = (hex) => new THREE.Color(hex);
  return {
    uZenith: uniform(C(GOLDEN.zenith)), uMid: uniform(C(GOLDEN.mid)), uLow: uniform(C(GOLDEN.low)), uHorizon: uniform(C(GOLDEN.horizon)),
    uSun: uniform(C(GOLDEN.sun)), uCloudLit: uniform(C(GOLDEN.cloudLit)), uCloudShade: uniform(C(GOLDEN.cloudShade)),
    uSunDir: uniform(sunVisDir()),
    uGlow: uniform(new THREE.Vector3(...GOLDEN.glow)), uCloud: uniform(new THREE.Vector4(...GOLDEN.cloud)), uDisc: uniform(new THREE.Vector2(...GOLDEN.disc))
  };
}

/** The ONE set of sky uniforms shared by every dome (outdoor backdrop + interior domes): change a `.value` once, every sky follows. */
export const SKY_UNIFORMS = createSkyUniforms();

/**
 * Just the golden sky dome (no hills/skyline/sea): 1 draw call, follows the camera, drawn first and behind
 * everything (depthTest/depthWrite off, renderOrder -1000, never frustum-culled), independent of the camera's
 * near/far (pinned just inside the far plane). For interiors: add it to the scene so windows/openings show the
 * same sky as outdoors. Call as createSkyDome(opts) or createSkyDome(THREE, opts) (the THREE arg is ignored;
 * this module uses 'three/webgpu'). opts: { quality: 'high'|'low', uniforms (default SKY_UNIFORMS), name }.
 * Returns a THREE.Mesh; `mesh.userData.uniforms` = the uniform nodes, `mesh.userData.dispose()` frees it.
 */
export function createSkyDome(a, b) {
  const { quality = 'high', uniforms = SKY_UNIFORMS, name = 'golden:dome' } = (a && a.Mesh ? b : a) || {};
  const U = uniforms;
  const domeMat = new THREE.MeshBasicNodeMaterial({ name: 'goldenSky', side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  // follows the camera (old VERT: projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0)); z is then
  // pinned to 0.9999 w so the dome is never clipped by a short interior far plane (depth is irrelevant: no depth test)
  const clip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(positionLocal.add(cameraPosition), 1.0)).toVar();
  domeMat.vertexNode = vec4(clip.x, clip.y, clip.w.mul(0.9999), clip.w);
  // colorNode (not fragmentNode) keeps the renderer's output/MRT hooks; tone mapping + sRGB happen in the output pass
  domeMat.colorNode = skyColorNode(U);
  domeMat.userData.uniforms = U;
  const low = quality === 'low';
  const dome = new THREE.Mesh(new THREE.SphereGeometry(200, low ? 32 : 48, low ? 16 : 24), domeMat);
  dome.name = name;
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  dome.matrixAutoUpdate = false;
  dome.castShadow = false; dome.receiveShadow = false;
  dome.userData.noCameraCollide = true;
  dome.userData.uniforms = U;
  dome.userData.dispose = () => { dome.geometry.dispose(); domeMat.dispose(); };
  return dome;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** GLSL-style smoothstep (edges may be reversed). */
const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/** Angular distance between two azimuths (rad, 0..PI). */
const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * Build the golden-hour backdrop. Returns a THREE.Group (add it to the scene root, NOT to the scene's bounds
 * group). opts: { quality, seaHalf (rad half-angle of the sea sector), seaInner, seed, farField (false = dome only),
 * uniforms (default SKY_UNIFORMS) }. `group.userData.seaSector`
 * describes where the sea is, so scenes can keep that view open: { az, half, inner }.
 */
export function createGoldenSky({ quality = 'high', seaHalf = 0.62, seaInner = 64, seed = 11, farField = true, uniforms = SKY_UNIFORMS } = {}) {
  const C = (hex) => new THREE.Color(hex);
  const group = new THREE.Group();
  group.name = 'backdrop:golden';
  const sunAz = GOLDEN.sunAz;

  // ---------------------------------------------------------------- sky dome (drawn first, behind everything)
  group.add(createSkyDome({ quality, uniforms }));
  group.userData.seaSector = { az: sunAz, half: seaHalf, inner: seaInner };
  group.userData.dispose = () => group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  if (!farField) return group;

  // ---------------------------------------------------------------- far field: hills + skyline (fog:false, haze baked in)
  const R = rng(seed);
  const P = [], Cl = [];
  const haze = C(GOLDEN.haze);
  const tmp = new THREE.Color();
  const tri = (a, b, c, ca, cb, cc) => { P.push(...a, ...b, ...c); Cl.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); };
  // three rings, far = palest; the near/mid rings dip away where the sea is
  const rings = [
    { r: 232, h: 26, top: '#b6929c', seaDip: 0.35 },
    { r: 192, h: 17, top: '#94809e', seaDip: 0 },
    { r: 152, h: 10, top: '#76708f', seaDip: 0 }
  ];
  const SEG = quality === 'low' ? 72 : 120;
  rings.forEach((ring, k) => {
    const ph = R() * 10, ph2 = R() * 10;
    const top = C(ring.top);
    let prev = null;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const sea = angDist(a, sunAz);
      const dip = THREE.MathUtils.lerp(ring.seaDip, 1, sstep(seaHalf + 0.02, seaHalf + 0.38, sea));
      let hgt = ring.h * (0.55 + 0.3 * Math.sin(a * 3 + ph) + 0.18 * Math.sin(a * 7.3 + ph2) + 0.08 * Math.sin(a * 17 + k));
      hgt = Math.max(0.5, hgt) * dip;
      // warmer/hazier towards the sun, cooler away from it
      const warm = Math.pow(Math.max(0, Math.cos(a - sunAz)), 2);
      tmp.copy(top).lerp(haze, 0.15 + warm * 0.45);
      const cTop = tmp.clone();
      const x = Math.cos(a) * ring.r, z = Math.sin(a) * ring.r;
      const cur = { b: [x, -1, z], t: [x, hgt, z], c: cTop };
      if (prev) { tri(prev.b, cur.b, cur.t, haze, haze, cur.c); tri(prev.b, cur.t, prev.t, haze, cur.c, prev.c); }
      prev = cur;
    }
  });
  // city skyline on the far shore, to the left of the sun (blocky towers, hazy blue-grey)
  const cityAz = sunAz - seaHalf * 0.72, cityR = 176;
  const cityTop = C('#7f7c9c'), cityLit = C('#c08f86');
  const nB = quality === 'low' ? 16 : 26;
  for (let i = 0; i < nB; i++) {
    const t = i / (nB - 1);
    const a = cityAz - 0.13 + t * 0.26 + (R() - 0.5) * 0.01;
    const r = cityR + (R() - 0.5) * 14;
    const w = 3 + R() * 5, dpt = 4 + R() * 3;
    const centre = 1 - Math.abs(t - 0.45) * 1.7;
    const hgt = 3 + R() * 5 + Math.max(0, centre) * (5 + R() * 11);
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    // a box facing the origin: front face + the side that looks at the sun
    const fx = -Math.cos(a), fz = -Math.sin(a);           // towards the origin
    const sx = -fz, sz = fx;                              // tangent
    const c0 = [cx - sx * w / 2 + fx * dpt / 2, cz - sz * w / 2 + fz * dpt / 2];
    const c1 = [cx + sx * w / 2 + fx * dpt / 2, cz + sz * w / 2 + fz * dpt / 2];
    const c2 = [cx + sx * w / 2 - fx * dpt / 2, cz + sz * w / 2 - fz * dpt / 2];
    const c3 = [cx - sx * w / 2 - fx * dpt / 2, cz - sz * w / 2 - fz * dpt / 2];
    const topC = cityTop.clone().lerp(haze, 0.32 + R() * 0.15);
    const sideC = topC.clone().lerp(cityLit, 0.45);
    const face = (p, q, cT) => { const a0 = [p[0], -1, p[1]], b0 = [q[0], -1, q[1]], b1 = [q[0], hgt, q[1]], a1 = [p[0], hgt, p[1]]; tri(a0, b0, b1, haze, haze, cT); tri(a0, b1, a1, haze, cT, cT); };
    face(c0, c1, topC); face(c1, c2, sideC); face(c3, c0, sideC);
    tri([c0[0], hgt, c0[1]], [c1[0], hgt, c1[1]], [c2[0], hgt, c2[1]], topC, topC, topC);
    tri([c0[0], hgt, c0[1]], [c2[0], hgt, c2[1]], [c3[0], hgt, c3[1]], topC, topC, topC);
  }
  const farGeo = new THREE.BufferGeometry();
  farGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  farGeo.setAttribute('color', new THREE.Float32BufferAttribute(Cl, 3));
  farGeo.computeBoundingSphere();
  const far = new THREE.Mesh(farGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  far.name = 'golden:far';
  far.matrixAutoUpdate = false;
  group.add(far);

  // ---------------------------------------------------------------- sea strip with a sun-glint streak (HDR via material colour)
  const GAIN = 1.7;
  const seaGeo = new THREE.BufferGeometry();
  const SP = [], SC = [];
  const AS = 56, RS = 8, r0 = seaInner, r1 = 226;
  const seaBase = C('#c99a8e'), seaFar = C('#e8b48c'), glint = C('#fff0c0');
  const col = (a, r) => {
    const da = angDist(a, sunAz);
    const edge = sstep(seaHalf, seaHalf * 0.7, da);          // fade into the haze at the sides
    const near = sstep(r0, r0 + 16, r);                       // ... and at the shore
    const g = Math.exp(-Math.pow(da / (0.025 + 0.05 * (1 - (r - r0) / (r1 - r0))), 2)) * (0.35 + 0.65 * (r - r0) / (r1 - r0));
    const c = seaBase.clone().lerp(seaFar, (r - r0) / (r1 - r0));
    c.lerp(haze, 1 - edge * near);
    c.multiplyScalar(1 / GAIN).lerp(glint, Math.min(1, g * 1.1));
    return c;
  };
  for (let i = 0; i < AS; i++) {
    const a0 = sunAz - seaHalf + (i / AS) * seaHalf * 2, a1 = sunAz - seaHalf + ((i + 1) / AS) * seaHalf * 2;
    for (let j = 0; j < RS; j++) {
      const ra = r0 + (j / RS) * (r1 - r0), rb = r0 + ((j + 1) / RS) * (r1 - r0);
      const v = [[a0, ra], [a1, ra], [a1, rb], [a0, rb]];
      const pts = v.map(([a, r]) => [Math.cos(a) * r, 0.03, Math.sin(a) * r]);
      const cs = v.map(([a, r]) => col(a, r));
      for (const k of [0, 2, 1, 0, 3, 2]) { SP.push(...pts[k]); SC.push(cs[k].r, cs[k].g, cs[k].b); }
    }
  }
  seaGeo.setAttribute('position', new THREE.Float32BufferAttribute(SP, 3));
  seaGeo.setAttribute('color', new THREE.Float32BufferAttribute(SC, 3));
  seaGeo.computeBoundingSphere();
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, color: new THREE.Color(GAIN, GAIN, GAIN) }));
  sea.name = 'golden:sea';
  sea.matrixAutoUpdate = false;
  group.add(sea);

  group.traverse((o) => { if (o.isMesh) { o.userData.noCameraCollide = true; o.castShadow = false; o.receiveShadow = false; o.updateMatrix(); } });
  return group;
}
