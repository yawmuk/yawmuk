// Scene-author toolkit: everything that ends up in `ctx` (see src/engine/README.md for the contract).
import * as THREE from 'three';
import { getLang, onLangChange, tr } from './i18n.js';
import { charactersReady, createCharacter } from './characters.js';
import { loadModel, loadTexture, forwardYaw, catalogEntry } from './assets.js';

// ---------------------------------------------------------------- labels
const liveLabels = new Set();

function drawLabel(sprite) {
  const { text, opts } = sprite.userData.label;
  const str = tr(text, getLang()) || '';
  const fontPx = 64;
  const font = `700 ${fontPx}px ${opts.font || 'Tajawal, "Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif'}`;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const pad = 28;
  const w = Math.ceil(g.measureText(str).width + pad * 2);
  const hgt = Math.ceil(fontPx * 1.6);
  c.width = Math.max(64, w); c.height = hgt;
  g.font = font;
  g.direction = getLang() === 'ar' ? 'rtl' : 'ltr';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (opts.background !== false) {
    g.fillStyle = opts.background || 'rgba(15,32,33,0.78)';
    const r = hgt / 2.4;
    g.beginPath();
    g.roundRect ? g.roundRect(2, 2, c.width - 4, hgt - 4, r) : g.rect(2, 2, c.width - 4, hgt - 4);
    g.fill();
  }
  g.fillStyle = opts.color || '#ffffff';
  g.fillText(str, c.width / 2, hgt / 2 + 3);
  const old = sprite.material.map;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  sprite.material.map = tex;
  // Only the first map changes the shader; later swaps (language change, fonts loaded) just rebind the texture,
  // so don't force every label's (node) material to rebuild.
  if (!old) sprite.material.needsUpdate = true;
  else old.dispose();
  const worldH = opts.size || 0.32;
  sprite.scale.set(worldH * (c.width / hgt), worldH, 1);
}

onLangChange(() => liveLabels.forEach(drawLabel));
if (document.fonts?.ready) document.fonts.ready.then(() => liveLabels.forEach(drawLabel));

/**
 * makeLabel(text, opts?) -> THREE.Sprite (always faces camera, re-renders on language change).
 * text: string | {ar, en}. opts: { size=0.32 (world height in m), color, background (css color | false), depthTest=true (false = visible through walls) }
 */
export function makeLabel(text, opts = {}) {
  // toneMapped:false keeps the label colours crisp (exactly the canvas colours) now that labels are drawn in the
  // main scene pass (default layer 0) instead of the old post-tone-mapping overlay pass.
  const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: opts.depthTest ?? true, depthWrite: false, toneMapped: false });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 10;
  sprite.userData.label = { text, opts };
  sprite.userData.isLabel = true;
  drawLabel(sprite);
  liveLabels.add(sprite);
  sprite.userData.disposeLabel = () => { liveLabels.delete(sprite); sprite.material.map?.dispose(); sprite.material.dispose(); };
  return sprite;
}
export function setLabelText(sprite, text) { sprite.userData.label.text = text; drawLabel(sprite); }

// ---------------------------------------------------------------- NPC / characters
const GEO = {};
function geo(key, make) { return GEO[key] || (GEO[key] = Object.assign(make(), { userData: { shared: true } })); }
const matCache = new Map();
function cmat(hex, o) {
  const k = hex + (o ? JSON.stringify(o) : '');
  if (!matCache.has(k)) { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, ...o }); m.userData.shared = true; matCache.set(k, m); }
  return matCache.get(k);
}

/**
 * makeNPC(look, opts?) -> THREE.Group: an animated, skinned character (see characters.js) once the character
 * library is loaded (the scene manager loads it before build()), otherwise the simple box figure below.
 * The group's userData.character is the Character (play('talk'|'wave'|'sit'|…)); userData.parts keeps the old
 * pose groups working (props added to parts.head follow the head bone, parts.legL.rotation.x seats the legs…).
 */
export function makeNPC(look = {}, opts) {
  if (charactersReady()) {
    try { return createCharacter(look, opts).root; } catch (e) { console.warn('[npc] character failed, using box figure', e); }
  }
  return makeBoxNPC(look);
}

/** makeCharacter(look, opts?) -> Character | null ({ root, play, setLocomotion, turnTo, lookAt, … }). */
export function makeCharacter(look = {}, opts) {
  if (!charactersReady()) return null;
  return createCharacter(look, opts);
}

/**
 * makeBoxNPC(look) -> THREE.Group (legacy procedural figure, used as fallback). Feet at y=0, faces -Z when rotation.y = 0.
 * look: { skin, shirt, pants, shoes, hair, hijab: bool|color, hijabColor: color (default neutral slate), kufi: bool|color, beard: bool|color,
 *         suit: bool|color (jacket+tie), jacket: bool|color (open coat, no tie), tie: color|false, dress: bool|color (long skirt/abaya), glasses: bool,
 *         height: 1.75, build: 1 (width factor) }
 * The group exposes userData.parts = { legL, legR, armL, armR, head } (pivot groups) for animation.
 */
export function makeBoxNPC(look = {}) {
  const L = {
    skin: '#c68642', shirt: '#3a6ea5', pants: '#2f3542', shoes: '#1e1e1e', hair: '#2b1d14',
    height: 1.75, build: 1, ...look
  };
  const col = (v, d) => (typeof v === 'string' ? v : d);
  const root = new THREE.Group();
  root.name = 'npc';
  const body = new THREE.Group();
  root.add(body);
  const skin = cmat(L.skin), shirt = cmat(L.shirt), pants = cmat(L.pants), shoes = cmat(L.shoes), hair = cmat(L.hair);
  const mesh = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };

  const legG = geo('leg', () => new THREE.CylinderGeometry(0.075, 0.065, 0.82, 7).translate(0, -0.41, 0));
  const shoeG = geo('shoe', () => new THREE.BoxGeometry(0.13, 0.08, 0.24));
  const torsoG = geo('torso', () => new THREE.CylinderGeometry(0.2, 0.17, 0.62, 8));
  const armG = geo('arm', () => new THREE.CylinderGeometry(0.055, 0.05, 0.6, 6).translate(0, -0.3, 0));
  const handG = geo('hand', () => new THREE.SphereGeometry(0.055, 6, 5));
  const headG = geo('head', () => new THREE.SphereGeometry(0.13, 12, 10));
  const neckG = geo('neck', () => new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6));
  const eyeG = geo('eye', () => new THREE.SphereGeometry(0.016, 5, 4));

  const hipY = 0.86;
  const mkLeg = (x) => {
    const p = new THREE.Group(); p.position.set(x, hipY, 0);
    p.add(mesh(legG, pants, 0, 0, 0));
    p.add(mesh(shoeG, shoes, 0, -0.82, -0.04));
    body.add(p); return p;
  };
  const legL = mkLeg(0.09), legR = mkLeg(-0.09);

  if (L.dress) {
    const dressG = geo('dress', () => new THREE.CylinderGeometry(0.17, 0.3, 0.9, 9).translate(0, -0.45, 0));
    body.add(mesh(dressG, cmat(col(L.dress, L.shirt)), 0, hipY + 0.05, 0));
  }
  const torso = mesh(torsoG, shirt, 0, hipY + 0.31, 0);
  torso.scale.x = L.build;
  body.add(torso);
  const coat = L.suit || L.jacket; // jacket = open coat without a tie (e.g. a winter jacket)
  if (coat) {
    const jacketG = geo('jacket', () => new THREE.CylinderGeometry(0.215, 0.185, 0.6, 8, 1, true, Math.PI * 0.12, Math.PI * 1.76));
    const jacket = mesh(jacketG, cmat(col(coat, '#22293a'), { side: THREE.DoubleSide }), 0, hipY + 0.31, 0);
    jacket.rotation.y = Math.PI; // opening faces -Z
    jacket.scale.x = L.build;
    body.add(jacket);
    if (L.suit && L.tie !== false) {
      const tieG = geo('tie', () => new THREE.BoxGeometry(0.05, 0.36, 0.02));
      body.add(mesh(tieG, cmat(col(L.tie, '#8e2b2b')), 0, hipY + 0.38, -0.2));
    }
  }
  body.add(mesh(neckG, skin, 0, hipY + 0.66, 0));

  const armColor = coat ? cmat(col(coat, '#22293a')) : shirt;
  const mkArm = (x) => {
    const p = new THREE.Group(); p.position.set(x * L.build, hipY + 0.58, 0);
    p.add(mesh(armG, armColor, 0, 0, 0));
    p.add(mesh(handG, skin, 0, -0.62, 0));
    p.rotation.z = Math.sign(x) * 0.08;
    body.add(p); return p;
  };
  const armL = mkArm(0.25), armR = mkArm(-0.25);

  const head = new THREE.Group(); head.position.set(0, hipY + 0.82, 0); body.add(head);
  if (L.hijab) {
    // Hood with a real face opening: the skin head shows through, so it reads correctly from every angle.
    const hc = cmat(col(L.hijabColor, col(L.hijab, '#6b7a8f')), { side: THREE.DoubleSide });
    head.add(mesh(headG, skin, 0, 0, 0));
    const R = 0.148, gap = 0.78, front = Math.PI * 1.5; // -Z is phi = 3π/2
    const sideG = geo('hoodSide', () => new THREE.SphereGeometry(R, 18, 10, front + gap, Math.PI * 2 - gap * 2, Math.PI * 0.2, Math.PI * 0.62));
    const topG = geo('hoodTop', () => new THREE.SphereGeometry(R, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.3));
    const chinG = geo('hoodChin', () => new THREE.SphereGeometry(R, 18, 6, 0, Math.PI * 2, Math.PI * 0.74, Math.PI * 0.26));
    for (const g of [sideG, topG, chinG]) head.add(mesh(g, hc, 0, 0.004, 0.006));
    const drapeG = geo('drape', () => new THREE.CylinderGeometry(0.135, 0.27, 0.3, 14, 1, true));
    head.add(mesh(drapeG, hc, 0, -0.2, 0.01));
  } else {
    head.add(mesh(headG, skin, 0, 0, 0));
    if (L.hair !== false && !L.kufi) {
      const capG = geo('hairCap', () => new THREE.SphereGeometry(0.137, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42));
      head.add(mesh(capG, hair, 0, 0.012, 0.012));
    }
    if (L.kufi) {
      const kufiG = geo('kufi', () => new THREE.CylinderGeometry(0.125, 0.135, 0.08, 12));
      head.add(mesh(kufiG, cmat(col(L.kufi, '#f4f1ea')), 0, 0.09, 0));
    }
    if (L.beard) {
      const beardG = geo('beard', () => new THREE.SphereGeometry(0.115, 10, 6, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5));
      const b = mesh(beardG, cmat(col(L.beard, L.hair)), 0, -0.02, -0.025); b.scale.set(1, 0.9, 1); head.add(b);
    }
  }
  const eyeM = cmat('#141414');
  const zFace = -0.122;
  head.add(mesh(eyeG, eyeM, 0.042, 0.02, zFace));
  head.add(mesh(eyeG, eyeM, -0.042, 0.02, zFace));
  if (L.glasses) {
    const gl = new THREE.Mesh(geo('glasses', () => new THREE.TorusGeometry(0.03, 0.006, 4, 10)), cmat('#222'));
    const g2 = gl.clone();
    gl.position.set(0.045, 0.02, zFace - 0.006); g2.position.set(-0.045, 0.02, zFace - 0.006);
    head.add(gl, g2);
  }

  const s = L.height / 1.75;
  root.scale.setScalar(s);
  root.userData.parts = { legL, legR, armL, armR, head, body };
  root.userData.isNPC = true;
  return root;
}

/** Simple procedural walk/idle animation for a makeNPC() figure. speed: 0..1 */
export function animateFigure(fig, t, speed = 0, phase = 0) {
  const p = fig.userData.parts; if (!p) return;
  const sw = Math.sin(t * 9 + phase) * 0.6 * speed;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.8; p.armR.rotation.x = sw * 0.8;
  const breathe = Math.sin(t * 2 + phase) * 0.008;
  p.body.position.y = Math.abs(Math.sin(t * 9 + phase)) * 0.03 * speed + breathe;
}

// ---------------------------------------------------------------- geometry helpers (bound to a ctx)
export function createKit(ctx) {
  const { colliders } = ctx;

  function finish(m, opts) {
    m.castShadow = opts.cast ?? true;
    m.receiveShadow = opts.receive ?? true;
    if (opts.rotY) m.rotation.y = opts.rotY;
    if (opts.name) m.name = opts.name;
    (opts.parent || ctx.group).add(m);
    if (opts.collide) addCollider(m);
    return m;
  }

  /** box(w,h,d, mat, x,y,z, opts?) — (x,y,z) is the BOTTOM-CENTER (y=0 sits on the floor). */
  function box(w, h, d, mat, x = 0, y = 0, z = 0, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || ctx.mats.wall);
    m.position.set(x, y + h / 2, z);
    return finish(m, opts);
  }
  /** cyl(rTop, rBottom, h, mat, x,y,z, opts?) — bottom-center; opts.segments (default 12). */
  function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, opts = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, opts.segments || 12), mat || ctx.mats.metal);
    m.position.set(x, y + h / 2, z);
    return finish(m, opts);
  }
  /** sphere(r, mat, x,y,z, opts?) — (x,y,z) is the CENTER. */
  function sphere(r, mat, x = 0, y = 0, z = 0, opts = {}) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, opts.segments || 12, Math.max(6, (opts.segments || 12) * 0.75 | 0)), mat || ctx.mats.plastic);
    m.position.set(x, y, z);
    return finish(m, opts);
  }
  /** ground(w, d, mat, x=0, z=0, y=0) — horizontal plane that receives shadows (not a collider). */
  function ground(w, d, mat, x = 0, z = 0, y = 0, opts = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat || ctx.mats.floor);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    return finish(m, { cast: false, receive: true, ...opts });
  }
  /** wall(x1,z1, x2,z2, h=3, thick=0.2, mat, opts?) — straight wall between two floor points; collides by default. */
  function wall(x1, z1, x2, z2, h = 3, thick = 0.2, mat, opts = {}) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    if (len < 1e-3) return null;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), mat || ctx.mats.wall);
    m.position.set((x1 + x2) / 2, (opts.y || 0) + h / 2, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(dz, dx);
    return finish(m, { collide: true, ...opts, rotY: undefined });
  }
  /**
   * room({ w=10, d=10, h=3, x=0, z=0, floor, wall, ceiling=false, doors: [{ side:'n'|'s'|'e'|'w', at=0, width=1.4 }] })
   * Builds floor + 4 colliding walls (with door gaps). n = -Z side, s = +Z, e = +X, w = -X. Returns {floor, walls}.
   */
  function room(o = {}) {
    const { w = 10, d = 10, h = 3, x = 0, z = 0, thick = 0.2 } = o;
    const wm = o.wall || ctx.mats.wall;
    const floorMesh = ground(w, d, o.floor || ctx.mats.floor, x, z);
    const walls = [];
    const sides = {
      n: [x - w / 2, z - d / 2, x + w / 2, z - d / 2],
      s: [x - w / 2, z + d / 2, x + w / 2, z + d / 2],
      w: [x - w / 2, z - d / 2, x - w / 2, z + d / 2],
      e: [x + w / 2, z - d / 2, x + w / 2, z + d / 2]
    };
    for (const [side, [ax, az, bx, bz]] of Object.entries(sides)) {
      const doors = (o.doors || []).filter((dd) => dd.side === side).sort((a, b) => (a.at || 0) - (b.at || 0));
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      let cur = 0;
      for (const dd of doors) {
        const center = len / 2 + (dd.at || 0), half = (dd.width || 1.4) / 2;
        const a = Math.max(0, center - half), b = Math.min(len, center + half);
        if (a > cur) walls.push(wall(ax + ux * cur, az + uz * cur, ax + ux * a, az + uz * a, h, thick, wm));
        const lintel = h - (dd.height || 2.2);
        if (lintel > 0.05) walls.push(wall(ax + ux * a, az + uz * a, ax + ux * b, az + uz * b, lintel, thick, wm, { y: h - lintel, collide: false }));
        cur = b;
      }
      if (cur < len) walls.push(wall(ax + ux * cur, az + uz * cur, bx, bz, h, thick, wm));
    }
    if (o.ceiling) {
      const c = ground(w, d, o.ceiling === true ? ctx.mats.ceiling : o.ceiling, x, z, h, { cast: false, receive: false });
      c.rotation.x = Math.PI / 2;
    }
    return { floor: floorMesh, walls: walls.filter(Boolean) };
  }

  /**
   * addCollider(target) — target: Object3D (its world AABB is used) | THREE.Box3 | {min:[x,y,z], max:[x,y,z]}.
   * Returns the stored {min,max}. Colliders added here are merged with the ones you return from build().
   */
  function addCollider(target, maxArr) {
    let c;
    if (Array.isArray(target) && Array.isArray(maxArr)) c = { min: target, max: maxArr };
    else if (target?.isObject3D) {
      target.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(target);
      c = { min: b.min.toArray(), max: b.max.toArray() };
    } else if (target?.isBox3) c = { min: target.min.toArray(), max: target.max.toArray() };
    else if (target?.min && target?.max) c = { min: [...target.min], max: [...target.max] };
    else { console.warn('[scene] addCollider: unsupported target', target); return null; }
    colliders.push(c);
    return c;
  }

  /** Deterministic PRNG for decor: const r = rand(42); r() -> [0,1) */
  function rand(seed = 1) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /** yaw that makes something at `from` [x,z] face `to` [x,z] (yaw=0 faces -Z). */
  function yawTo(from, to) { return Math.atan2(-(to[0] - from[0]), -(to[1] - from[1])); }

  // ---------------------------------------------------------------- loaded assets (async)
  const pending = (ctx._pending ||= []);
  /**
   * place(id, { position:[x,y,z], yaw, scale, castShadow=true, receiveShadow=true, collider=false|true|'auto',
   *             occluder=false|'box', parent, name, faceCorrect=true }) -> Group (filled when the model arrives)
   * The returned group has .ready (Promise). The scene manager waits for every place() before the scene shows.
   */
  function place(id, o = {}) {
    const holder = new THREE.Group();
    holder.name = o.name || `place:${id}`;
    const p = o.position || [0, 0, 0];
    holder.position.set(p[0] || 0, p[1] || 0, p[2] || 0);
    holder.rotation.y = o.yaw || 0;
    if (o.scale != null) Array.isArray(o.scale) ? holder.scale.set(...o.scale) : holder.scale.setScalar(o.scale);
    (o.parent || ctx.group).add(holder);
    holder.ready = loadModel(id).then((model) => {
      if (o.faceCorrect !== false) model.rotation.y += forwardYaw(id);
      model.traverse((m) => { if (m.isMesh) { m.castShadow = o.castShadow ?? true; m.receiveShadow = o.receiveShadow ?? true; } });
      holder.add(model);
      if (o.collider) addModelColliders(holder, o.collider);
      if (o.occluder === 'box') addOccluderBox(holder);
      return holder;
    }).catch((e) => {
      console.warn(`[scene] place("${id}") failed:`, e?.message || e);
      ctx.warn?.(`asset "${id}" failed to load`);
      if (ctx.debug) holder.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: '#ff00ff' })));
      return holder;
    });
    pending.push(holder.ready);
    return holder;
  }
  /** loadModel(id) -> Promise<Object3D> (a clone; tracked so the scene waits for it). */
  function loadModelTracked(id, opts) { const pr = loadModel(id, opts); pending.push(pr.catch(() => null)); return pr; }
  /** loadTexture(name, { size:[w,d] metres | repeat }) -> Promise<{ map, normalMap, roughnessMap, … }> */
  function loadTextureTracked(name, opts) { const pr = loadTexture(name, opts); pending.push(pr.catch(() => null)); return pr; }
  /**
   * pbr(name, { size:[w,d] | repeat, color, roughness, metalness, ...MeshStandardMaterial params }) -> MeshStandardMaterial
   * Returned immediately (flat colour); its maps are filled in when the textures arrive. Owned by the scene.
   */
  function pbr(name, o = {}) {
    const { size, repeat, tile, ...params } = o;
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, ...params });
    m.name = `pbr:${name}`;
    const pr = loadTexture(name, { size, repeat, tile }).then((maps) => {
      Object.assign(m, maps);
      if (maps.normalMap && params.normalScale == null) m.normalScale.set(1, 1);
      m.needsUpdate = true;
    }).catch((e) => { console.warn(`[scene] texture "${name}" failed:`, e?.message || e); if (!params.color) m.color.set('#9a9a9a'); });
    pending.push(pr);
    return m;
  }

  /** Collider(s) from a loaded model: true = one AABB; 'auto' = one AABB per mesh, overlapping boxes merged. */
  function addModelColliders(obj, mode) {
    obj.updateWorldMatrix(true, true);
    if (mode !== 'auto') return addCollider(new THREE.Box3().setFromObject(obj));
    const boxes = [];
    obj.traverse((m) => {
      if (!m.isMesh) return;
      const b = new THREE.Box3().setFromObject(m);
      const s = b.getSize(new THREE.Vector3());
      if (Math.max(s.x, s.z) < 0.15 || b.min.y > 1.7) return;
      boxes.push(b);
    });
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < boxes.length && !merged; i++) for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i].intersectsBox(boxes[j])) { boxes[i].union(boxes[j]); boxes.splice(j, 1); merged = true; break; }
      }
    }
    return boxes.map((b) => addCollider(b));
  }
  /** Invisible box proxy (model bounds) used by the camera occlusion ray. */
  function addOccluderBox(obj) {
    obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    proxy.position.copy(c); proxy.visible = false; proxy.userData.cameraCollide = true;
    (ctx.extraOccluders ||= []).push(proxy);
    return proxy;
  }

  return { box, cyl, sphere, ground, wall, room, addCollider, rand, yawTo, place, loadModel: loadModelTracked, loadTexture: loadTextureTracked, pbr, addModelColliders, catalogEntry };
}

// ---------------------------------------------------------------- markers (engine-owned)
export function makeMarker(color = '#ffd34d', kind = 'hotspot') {
  const g = new THREE.Group();
  g.name = `marker:${kind}`;
  const ringM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 32), ringM);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  g.add(ring);
  const gemM = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.3 });
  const gem = new THREE.Mesh(kind === 'exit' ? new THREE.ConeGeometry(0.16, 0.32, 4) : new THREE.OctahedronGeometry(0.16, 0), gemM);
  if (kind === 'exit') gem.rotation.x = Math.PI;
  gem.position.y = 2.25;
  g.add(gem);
  const beamM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.32, 2.2, 12, 1, true), beamM);
  beam.position.y = 1.1;
  g.add(beam);
  g.userData = { ring, gem, beam, mats: [ringM, gemM, beamM], phase: Math.random() * 6 };
  g.setColor = (c) => { ringM.color.set(c); gemM.color.set(c); gemM.emissive.set(c); beamM.color.set(c); };
  g.userData.gemY = 2.25;
  g.tick = (t, near) => {
    gem.position.y = g.userData.gemY + Math.sin(t * 2.2 + g.userData.phase) * 0.08;
    gem.rotation.y = t * 1.5;
    const s = near ? 1.15 + Math.sin(t * 6) * 0.05 : 1;
    ring.scale.setScalar(s);
    ringM.opacity = near ? 0.85 : 0.5;
  };
  return g;
}
