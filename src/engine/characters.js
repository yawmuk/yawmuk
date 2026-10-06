// Animated human characters (CC0 Quaternius "Ultimate Modular Men/Women", see public/assets/characters/LICENSES.md).
//
// public/assets/characters/{male,female}.glb hold every modular part (Head / Body / Legs / Feet of several outfits)
// of one sex plus one set of clips, all on the same 62-joint rig. At load time every part is normalised into the
// rest pose of ONE "primary" skeleton (model space, metres, facing +Z), so any combination of parts can be merged
// per colour into a handful of SkinnedMeshes that share one cloned skeleton per character.
//
//   createCharacter(look, opts) -> Character      (sync; call after preloadCharacters() resolved)
//   character.root                                 THREE.Group you place in the scene (faces -Z at rotation.y = 0)
//   character.play('idle'|'talk'|'wave'|'sit'|'interact'|'walk'|'run')
//   character.setLocomotion(speed m/s)            blends idle/walk/run, foot speed matched to velocity
//   character.turnTo(yaw) / lookAt(Vector3|null)   smooth body turn / head tracking
//
// All characters are updated by updateCharacters(dt, camera) from the frame loop (only when visible).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadGLTF } from './assets.js';
import * as ACC from './accessories.js';

const FILES = { male: 'assets/characters/male.glb', female: 'assets/characters/female.glb' };
const PRIMARY = { male: 'man_casual', female: 'woman_casual' };
const SOURCE_HEIGHT = 1.78; // average top-of-head height of the source models (m) -> look.height scale

// Material roles of every part (source material name -> role). Roles get colours from the look.
const ROLES = {
  'man_casual-Head': { Skin: 'skin', Skin_Darker: 'skinDark', Eyebrows: 'brow', Eye: 'eye', Hair: 'hair' },
  'man_suit-Head': { Skin: 'skin', Hair: 'hair', Eyebrows: 'brow', Eye: 'eye' },
  'man_hoodie-Head': { Skin: 'skin', Hair: 'hair', Eyebrows: 'brow', Eye: 'eye' },
  'man_farmer-Head': { Skin: 'skin', Beige: 'hat', Eyebrows: 'brow', Red: 'hatBand', Eye: 'eye' },
  'woman_casual-Head': { Skin: 'skin', Hair_Blond: 'hair', Hair_Brown: 'brow', Brown: 'eye' },
  'woman_formal-Head': { Skin: 'skin', Red: 'hair', Brown: 'eye' },
  'man_casual-Body': { LightBrown: 'shirt', Skin: 'skin' },
  'man_suit-Body': { Suit: 'jacket', White: 'shirt', Tie: 'tie', Skin: 'skin' },
  'man_hoodie-Body': { Purple: 'shirt', Skin: 'skin' },
  'man_farmer-Body': { Brown: 'shirt', LightBlue: 'pants', Skin: 'skin', Beige: 'shirt2' },
  'woman_casual-Body': { White: 'shirt', Skin: 'skin' },
  'woman_formal-Body': { LimeGreen: 'dress', Gold: 'belt', Skin: 'skin' },
  'man_casual-Legs': { LightBlue: 'pants' },
  'man_suit-Legs': { Suit: 'pants' },
  'man_hoodie-Legs': { Skin: 'skin', LightBlue: 'pants' },
  'man_farmer-Pants': { LightBlue: 'pants' },
  'woman_casual-Legs': { Orange: 'pants' },
  'woman_formal-Legs': { Skin: 'skin', LimeGreen: 'dress' },
  'man_casual-Feet': { White: 'sole', Red_Dark: 'shoes' },
  'man_suit-Feet': { Black: 'shoes' },
  'man_hoodie-Feet': { White: 'sole', Purple: 'shoes' },
  'man_farmer-Feet': { Brown2: 'sole', Brown: 'shoes' },
  'woman_casual-Feet': { Skin: 'skin', Grey: 'shoes' },
  'woman_formal-Feet': { Skin: 'skin', Red: 'shoes' }
};
const ROUGH = { skin: 0.55, skinDark: 0.6, hair: 0.7, brow: 0.8, eye: 0.25, shoes: 0.45, sole: 0.8, tie: 0.55, jacket: 0.72, hat: 0.85, hatBand: 0.8, belt: 0.5 };

// Bone names as three.js sanitises them ('UpperArm.L' -> 'UpperArmL').
export const BONES = {
  hips: 'Hips', torso: 'Torso', chest: 'Chest', neck: 'Neck', head: 'Head', abdomen: 'Abdomen',
  armUpper: ['UpperArmL', 'UpperArmR'], armLower: ['LowerArmL', 'LowerArmR'], wrist: ['WristL', 'WristR'],
  legUpper: ['UpperLegL', 'UpperLegR'], legLower: ['LowerLegL', 'LowerLegR'], foot: ['FootL', 'FootR'], shoulder: ['ShoulderL', 'ShoulderR']
};

// ------------------------------------------------------------------ defaults (set from the quality tier)
/** single: merge every character into one vertex-coloured mesh; shadows: NPCs cast shadows. */
export const characterDefaults = { single: false, shadows: true };
export function setCharacterDefaults(o) { Object.assign(characterDefaults, o); }

// ------------------------------------------------------------------ library
const LIB = { male: null, female: null, promise: null, failed: null };
export const charactersReady = () => !!(LIB.male && LIB.female);
export const charactersFailed = () => LIB.failed;

/** Load and prepare both character libraries once (cached for the whole session). */
export function preloadCharacters() {
  if (!LIB.promise) {
    LIB.promise = Promise.all(['male', 'female'].map((sex) => loadGLTF(FILES[sex], { keep: true }).then((g) => { LIB[sex] = makeTemplate(g, sex); })))
      .catch((e) => { LIB.failed = e; console.error('[characters] failed to load — using simple figures', e); });
  }
  return LIB.promise;
}

// ------------------------------------------------------------------ template (one per sex)
function partKeyOf(o) {
  for (let p = o; p; p = p.parent) {
    const m = /^([a-z]+_[a-z]+)-(Head|Body|Legs|Feet|Pants)/.exec(p.name);
    if (m) return `${m[1]}-${m[2]}`;
  }
  return null;
}

function makeTemplate(gltf, sex) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const skinned = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  const primary = skinned.find((m) => partKeyOf(m)?.startsWith(`${PRIMARY[sex]}-`));
  if (!primary) throw new Error(`characters: no primary part in ${sex}.glb`);
  const bones = primary.skeleton.bones;
  const strip = (n) => n.replace(/_\d+$/, ''); // GLTFLoader de-duplicates node names ("Head_1")
  const index = new Map(bones.map((b, i) => [strip(b.name), i]));
  const restWorld = bones.map((b) => b.matrixWorld.clone());
  const inverses = restWorld.map((m) => m.clone().invert());

  // the armature: top-most bone and the transform of everything above it
  let rootBone = bones[0];
  while (rootBone.parent?.isBone) rootBone = rootBone.parent;
  const rigMatrix = rootBone.parent ? rootBone.parent.matrixWorld.clone() : new THREE.Matrix4();

  // normalise every primitive into primary rest space
  const prims = {};
  const tmp = new THREE.Matrix4(), v = new THREE.Vector3(), n = new THREE.Vector3(), acc = new THREE.Vector3(), accN = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (const m of skinned) {
    const part = partKeyOf(m); if (!part) continue;
    const roles = ROLES[part] || {};
    const mat = m.material?.name || 'mat';
    const role = roles[mat] || 'misc';
    const S = m.skeleton;
    const map = S.bones.map((b) => index.get(b.name) ?? index.get(b.name.replace(/_\d+$/, '')) ?? 0);
    const M = S.bones.map((b, k) => new THREE.Matrix4().multiplyMatrices(restWorld[map[k]], S.boneInverses[k]).multiply(m.bindMatrix));
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
    const cnt = P.count;
    const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
    const dom = new Uint16Array(cnt);
    for (let i = 0; i < cnt; i++) {
      v.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i);
      acc.set(0, 0, 0); accN.set(0, 0, 0);
      let wsum = 0, best = -1, bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = SW.getComponent(i, k); const j = SI.getComponent(i, k);
        si[i * 4 + k] = map[j]; sw[i * 4 + k] = w;
        if (w <= 0) continue;
        wsum += w;
        if (w > bw) { bw = w; best = map[j]; }
        tmp.copy(M[j]);
        acc.addScaledVector(v.clone().applyMatrix4(tmp), w);
        nm.getNormalMatrix(tmp);
        accN.addScaledVector(n.clone().applyMatrix3(nm), w);
      }
      if (wsum > 0) acc.divideScalar(wsum);
      accN.normalize();
      pos.set([acc.x, acc.y, acc.z], i * 3); nor.set([accN.x, accN.y, accN.z], i * 3);
      dom[i] = best < 0 ? 0 : best;
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ng.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    ng.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    ng.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    ng.setIndex(g.index ? Array.from(g.index.array) : null);
    ng.userData.shared = true;
    const id = `${part}#${mat}`;
    prims[id] = { id, part, mat, role, geometry: ng, dom };
  }

  const clips = {};
  for (const c of gltf.animations) { for (const t of c.tracks) t.name = t.name.replace(/^([^.]+?)_\d+\./, '$1.'); clips[c.name] = c; }
  const tpl = { sex, bones, index, restWorld, inverses, rootBone, rigMatrix, prims, clips, headInfo: {}, cache: new Map() };
  tpl.bonePos = (name) => new THREE.Vector3().setFromMatrixPosition(restWorld[index.get(name)]);
  // leg measurements (model space, unscaled) for sitting
  const hipL = tpl.bonePos('UpperLegL'), kneeL = tpl.bonePos('LowerLegL'), footL = tpl.bonePos('FootL');
  tpl.legs = { hipY: hipL.y, thigh: hipL.distanceTo(kneeL), shin: kneeL.distanceTo(footL), ankleY: footL.y };
  tpl.speeds = measureSpeeds(tpl);
  return tpl;
}

/** Rest-pose clone of the armature (its own bones) + a Skeleton in primary bone order. */
function cloneRig(tpl) {
  const rig = new THREE.Group();
  rig.name = 'rig';
  tpl.rigMatrix.decompose(rig.position, rig.quaternion, rig.scale);
  const rb = tpl.rootBone.clone(true);
  rig.add(rb);
  const byName = {};
  rb.traverse((b) => { if (b.isBone) { b.name = b.name.replace(/_\d+$/, ''); byName[b.name] = b; } });
  const bones = tpl.bones.map((b) => byName[b.name.replace(/_\d+$/, '')]);
  return { rig, bones, byName, skeleton: new THREE.Skeleton(bones, tpl.inverses) };
}

/** Natural ground speed (m/s, unscaled) of Walk and Run from the foot motion inside each clip. */
function measureSpeeds(tpl) {
  const out = { Walk: 1.4, Run: 3.6 };
  const { rig, byName } = cloneRig(tpl);
  const holder = new THREE.Group(); holder.add(rig);
  for (const name of ['Walk', 'Run']) {
    const clip = tpl.clips[name]; if (!clip) continue;
    const mixer = new THREE.AnimationMixer(holder);
    const a = mixer.clipAction(clip); a.play();
    let minZ = Infinity, maxZ = -Infinity;
    const steps = 40, p = new THREE.Vector3();
    for (let i = 0; i <= steps; i++) {
      mixer.setTime((clip.duration * i) / steps);
      holder.updateMatrixWorld(true);
      p.setFromMatrixPosition(byName.FootL.matrixWorld);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    if (maxZ > minZ && clip.duration > 0) out[name] = (2 * (maxZ - minZ)) / clip.duration;
    mixer.stopAllAction(); mixer.uncacheRoot(holder);
  }
  return out;
}

// ------------------------------------------------------------------ look -> parts & colours
const isHex = (s) => typeof s === 'string' && /^#?[0-9a-f]{3,8}$/i.test(s.trim());
const col = (v, d) => (isHex(v) ? v : d);
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }

/** Infer the sex of a legacy look that does not say (documented heuristic; new scenes should pass look.sex). */
export function lookSex(L) {
  const s = String(L.sex || L.gender || '').toLowerCase();
  if (s.startsWith('f') || s === 'woman' || s === 'girl') return 'female';
  if (s.startsWith('m') || s === 'man' || s === 'boy') return 'male';
  if (L.hijab || L.dress || L.skirt) return 'female';
  if (L.beard || L.kufi || L.suit || L.tie) return 'male';
  const h = Number(L.height) || 1.75;
  return h < 1.4 ? 'male' : h < 1.7 ? 'female' : 'male';
}

export function resolveLook(look = {}) {
  const L = { skin: '#c68642', shirt: '#3a6ea5', pants: '#2f3542', shoes: '#1e1e1e', hair: '#2b1d14', height: 1.75, build: 1, ...look };
  const sex = lookSex(L);
  const seed = hash(JSON.stringify([L.skin, L.shirt, L.pants, L.hair, L.height]));
  const hairCol = col(L.hair, '#2b1d14');
  const coat = L.suit || L.jacket;
  const colors = {
    skin: col(L.skin, '#c68642'), hair: hairCol, brow: shade(hairCol === '#2b1d14' ? hairCol : hairCol, 0.75), eye: '#1b1511',
    shirt: col(L.shirt, '#3a6ea5'), pants: col(L.pants, '#2f3542'), shoes: col(L.shoes, '#1e1e1e'), sole: '#d9d4c9',
    jacket: col(coat, '#22293a'), tie: col(L.tie, '#8e2b2b'), dress: col(L.dress, col(L.shirt, '#3a3b55')), belt: '#a88449', shirt2: '#d8cfb8', hat: '#d8ccb0', hatBand: '#7a2a2a'
  };
  colors.skinDark = shade(colors.skin, 0.86);
  if (L.hair === false) colors.brow = shade(colors.skin, 0.55);
  const parts = {}; const drop = new Set(); const acc = [];
  const hijab = L.hijab ? col(L.hijabColor, col(L.hijab, '#6b7a8f')) : null;
  if (sex === 'male') {
    const style = L.hair === false ? 'bald' : L.hairStyle || (L.kufi || L.beanie || L.santaHat ? 'short' : ['short', 'spiky', 'short'][seed % 3]);
    parts.head = { bald: 'man_farmer-Head', spiky: 'man_hoodie-Head', bun: 'man_casual-Head', short: 'man_suit-Head' }[style] || 'man_suit-Head';
    if (style === 'bald') { drop.add('hat'); drop.add('hatBand'); }
    if (L.suit || L.jacket) {
      parts.body = 'man_suit-Body';
      if (!L.suit || L.tie === false) colors.tie = colors.shirt; // open jacket: no tie
    } else if (L.hoodie) parts.body = 'man_hoodie-Body';
    else parts.body = 'man_casual-Body';
    parts.legs = L.suit ? 'man_suit-Legs' : L.shorts ? 'man_hoodie-Legs' : 'man_casual-Legs';
    parts.feet = L.boots ? 'man_farmer-Feet' : L.suit ? 'man_suit-Feet' : 'man_casual-Feet';
    if (L.suit) colors.pants = col(L.pants, colors.jacket);
  } else {
    const style = L.hairStyle || (seed % 2 ? 'long' : 'bun');
    parts.head = style === 'bun' ? 'woman_formal-Head' : 'woman_casual-Head';
    parts.body = 'woman_casual-Body';
    parts.legs = 'woman_casual-Legs';
    parts.feet = 'woman_casual-Feet';
    if (coat) colors.shirt = colors.jacket;
  }
  if (hijab || L.beanie || L.santaHat) drop.add('hair'); // covered by the wrap / hat
  if (L.hair === false) drop.add('hair');
  // long sleeves by default (everyone dresses for an Ohio winter); look.sleeves = 'short' keeps bare forearms
  const sleeves = L.sleeves !== 'short' && parts.body !== 'man_suit-Body' && parts.body !== 'man_hoodie-Body';
  if (sleeves) acc.push({ kind: 'sleeves', color: parts.body === 'man_suit-Body' ? colors.jacket : colors.shirt });
  if (parts.legs === 'man_hoodie-Legs' && L.shorts !== true) acc.push({ kind: 'trousers', color: colors.pants });
  const longSkirt = sex === 'female' && (L.dress || L.skirt);
  if (longSkirt) { acc.push({ kind: 'skirt', color: colors.dress }); colors.pants = colors.dress; }
  if (hijab) acc.push({ kind: 'hijab', color: hijab, rim: col(L.hijabRim, shade(hijab, 0.78)) });
  if (L.kufi) acc.push({ kind: 'kufi', color: col(L.kufi, '#f4f1ea') });
  if (L.beanie) acc.push({ kind: 'beanie', color: col(L.beanie, '#7d8086') });
  if (L.santaHat) acc.push({ kind: 'santa', color: col(L.santaHat, '#c0262e') });
  if (L.beard && sex === 'male') acc.push({ kind: 'beard', color: col(L.beard, hairCol), style: L.beardStyle || 'full' });
  if (L.glasses) acc.push({ kind: 'glasses', color: col(L.glasses, '#1d1d1f') });
  const height = Math.max(0.8, Number(L.height) || 1.75);
  return { sex, parts, colors, drop, acc, height, build: Number(L.build) || 1, child: height < 1.4, seated: !!(L.seated || L.pose === 'sit') };
}

// ------------------------------------------------------------------ materials (shared, cached by colour + roughness)
const matCache = new Map();
export function charMaterial(hex, rough = 0.85, opts = {}) {
  const k = `${hex}|${rough}|${opts.side || 0}|${opts.vc ? 1 : 0}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: opts.vc ? '#ffffff' : hex, roughness: rough, metalness: 0, side: opts.side || THREE.FrontSide, vertexColors: !!opts.vc });
    m.name = `char:${hex}`;
    m.userData.shared = true;
    matCache.set(k, m);
  }
  return m;
}

// ------------------------------------------------------------------ assembly
// skinIndex is always copied into a fresh Uint16 attribute: the WebGPU backend swaps a rendered
// non-normalized Uint16/Uint8 attribute's .array for a Uint32Array in place, so sharing the template's
// skinIndex would let a previously rendered prim break later mergeGeometries() calls (mixed array types).
// position/normal/skinWeight are Float32 (never rewritten by the backend) and stay shared.
function u16SkinIndex(attr) {
  const n = attr.count, s = attr.itemSize, out = new Uint16Array(n * s);
  for (let i = 0; i < n; i++) for (let k = 0; k < s; k++) out[i * s + k] = attr.getComponent(i, k);
  return new THREE.BufferAttribute(out, s);
}

function stripGeo(g) {
  const o = new THREE.BufferGeometry();
  for (const a of ['position', 'normal', 'skinIndex', 'skinWeight']) o.setAttribute(a, a === 'skinIndex' ? u16SkinIndex(g.attributes[a]) : g.attributes[a]);
  if (g.index) o.setIndex(g.index);
  else o.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
  return o;
}

function buildPieces(tpl, R) {
  // primitives of the chosen parts, minus dropped roles, grouped by final colour
  const pieces = [];
  for (const part of Object.values(R.parts)) {
    for (const p of Object.values(tpl.prims)) {
      if (p.part !== part || R.drop.has(p.role)) continue;
      const hex = R.colors[p.role] || '#808080';
      pieces.push({ key: p.id, geometry: p.geometry, hex, rough: ROUGH[p.role] ?? 0.85, prim: p });
    }
  }
  const ctx = accessoryContext(tpl, R);
  for (const a of R.acc) {
    const key = `${a.kind}|${R.parts.head}|${R.parts.body}|${R.parts.legs}|${a.style || ''}`;
    let built = tpl.cache.get(key);
    if (built === undefined) {
      try { built = ACC.build(a.kind, ctx, a) || null; } catch (e) { console.warn(`[characters] accessory ${a.kind} failed`, e); built = null; }
      tpl.cache.set(key, built);
    }
    if (!built) continue;
    for (const piece of built) {
      const hex = piece.color === 'rim' ? a.rim : piece.color === 'white' ? '#f4f2ec' : piece.color || a.color;
      pieces.push({ key: `${key}:${piece.name}`, geometry: piece.geometry, hex, rough: piece.rough ?? 0.85, side: piece.side });
    }
  }
  return pieces;
}

function accessoryContext(tpl, R) {
  const prims = Object.values(tpl.prims);
  return {
    THREE, tpl, index: tpl.index,
    head: prims.filter((p) => p.part === R.parts.head),
    body: prims.filter((p) => p.part === R.parts.body),
    legs: prims.filter((p) => p.part === R.parts.legs),
    feet: prims.filter((p) => p.part === R.parts.feet),
    headInfo: headInfo(tpl, R.parts.head)
  };
}

/** Measurements of a head part (model space, unscaled, facing +Z): centre, half sizes, eyes, chin, top. */
export function headInfo(tpl, part) {
  if (tpl.headInfo[part]) return tpl.headInfo[part];
  const headIdx = tpl.index.get('Head');
  const prims = Object.values(tpl.prims).filter((p) => p.part === part);
  const box = new THREE.Box3(), hairBox = new THREE.Box3(), v = new THREE.Vector3();
  const eyes = [];
  for (const p of prims) {
    const P = p.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      if (p.role === 'skin' && p.dom[i] === headIdx) box.expandByPoint(v);
      if (p.role === 'hair' || p.role === 'hat') hairBox.expandByPoint(v);
      if (p.role === 'eye') eyes.push(v.clone());
    }
  }
  const c = box.getCenter(new THREE.Vector3()), half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  let eyeY = c.y + half.y * 0.12, eyeZ = box.max.z - 0.02, eyeX = half.x * 0.42;
  if (eyes.length) {
    // eyes are the front-most cluster of the "eye" role (eyebrows sit higher); use the lower half of that set
    eyes.sort((a, b) => a.y - b.y);
    const lower = eyes.slice(0, Math.max(1, Math.ceil(eyes.length / 2)));
    eyeY = lower.reduce((s, e) => s + e.y, 0) / lower.length;
    eyeZ = Math.max(...lower.map((e) => e.z));
    eyeX = lower.reduce((s, e) => s + Math.abs(e.x - c.x), 0) / lower.length;
  }
  const info = {
    center: c, half, min: box.min.clone(), max: box.max.clone(), eyeY, eyeZ, eyeX,
    chinY: box.min.y, topY: box.max.y, hairTop: hairBox.isEmpty() ? box.max.y : hairBox.max.y,
    neck: tpl.bonePos('Neck'), headBone: tpl.bonePos('Head'), chest: tpl.bonePos('Chest'),
    shoulders: [tpl.bonePos('UpperArmL'), tpl.bonePos('UpperArmR')]
  };
  tpl.headInfo[part] = info;
  return info;
}

function assemble(tpl, R, single) {
  const pieces = buildPieces(tpl, R);
  const groups = new Map();
  if (single) {
    groups.set('single', { pieces, hex: '#ffffff', rough: 0.8 });
  } else {
    for (const p of pieces) {
      const k = `${p.hex}|${p.rough}|${p.side || 0}`;
      if (!groups.has(k)) groups.set(k, { pieces: [], hex: p.hex, rough: p.rough, side: p.side });
      groups.get(k).pieces.push(p);
    }
  }
  const out = [];
  for (const [, g] of groups) {
    const ckey = single ? `vc|${g.pieces.map((p) => `${p.key}=${p.hex}`).join(',')}` : `g|${g.pieces.map((p) => p.key).join(',')}`;
    let geo = tpl.cache.get(ckey);
    if (!geo) {
      const geos = g.pieces.map((p) => {
        const s = stripGeo(p.geometry);
        if (single) {
          const c = new THREE.Color(p.hex), n = s.attributes.position.count, arr = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
          s.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        }
        return s;
      });
      geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.3);
      geo.userData.shared = true;
      tpl.cache.set(ckey, geo);
    }
    out.push({ geometry: geo, material: single ? charMaterial('#ffffff', 0.8, { vc: true, side: THREE.DoubleSide }) : charMaterial(g.hex, g.rough, { side: g.side }) });
  }
  return out;
}

// ------------------------------------------------------------------ character instances
const live = new Set();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const smooth = (a, b, k) => a + (b - a) * k;
function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; }

export class Character {
  constructor(look = {}, opts = {}) {
    const R = resolveLook(look);
    const tpl = LIB[R.sex];
    if (!tpl) throw new Error('characters not loaded');
    this.look = look; this.R = R; this.tpl = tpl;
    this.root = new THREE.Group();
    this.root.name = opts.name || 'character';
    this.model = new THREE.Group();
    this.model.rotation.y = Math.PI; // source faces +Z, engine convention faces -Z
    this.root.add(this.model);
    const { rig, bones, byName, skeleton } = cloneRig(tpl);
    this.rig = rig; this.bones = byName; this.skeleton = skeleton;
    this.model.add(rig);
    this.meshes = [];
    const single = opts.single ?? characterDefaults.single;
    const shadows = opts.castShadow ?? characterDefaults.shadows;
    for (const { geometry, material } of assemble(tpl, R, !!single)) {
      const m = new THREE.SkinnedMesh(geometry, material);
      m.bind(skeleton, new THREE.Matrix4());
      m.castShadow = shadows; m.receiveShadow = true;
      m.frustumCulled = true;
      m.userData.noCameraCollide = true;
      this.model.add(m);
      this.meshes.push(m);
    }
    // scale: height (and head size for children), width
    this.scale = R.height / SOURCE_HEIGHT * (R.child ? 1.12 : 1);
    this.root.scale.set(this.scale * R.build, this.scale, this.scale * R.build);
    if (R.child) { const h = byName.Head; h.scale.setScalar(1.22); this.scale *= 1; }
    // animation
    this.mixer = new THREE.AnimationMixer(this.rig);
    this.actions = {};
    for (const [name, clip] of Object.entries(tpl.clips)) this.actions[name] = this.mixer.clipAction(clip);
    const rnd = (hash(JSON.stringify(look)) % 1000) / 1000;
    this.idleName = opts.idle || (rnd < 0.55 ? 'Idle' : 'Idle_Neutral');
    this.phase = rnd * 10;
    this.w = { idle: 1, walk: 0, run: 0, gesture: 0 };
    for (const [k, a] of Object.entries(this.actions)) { a.enabled = true; a.setEffectiveWeight(0); a.play(); a.time = (rnd * 7.3) % (a.getClip().duration || 1); }
    this.actions[this.idleName].setEffectiveWeight(1);
    this.actions[this.idleName].timeScale = 0.85 + rnd * 0.3;
    this.speed = 0;
    this.state = R.seated ? 'sit' : 'idle';
    this.gesture = null; // 'wave' | 'interact' (clip one-shots)
    this.talk = 0; this.talkTarget = 0;
    this.targetYaw = null;
    this.lookTarget = null; this.headYaw = 0; this.headPitch = 0;
    this.sitW = this.state === 'sit' ? 1 : 0;
    this.rest = new Map();
    this.root.userData.isNPC = true;
    this.root.userData.isCharacter = true;
    Object.defineProperty(this.root.userData, 'character', { value: this, enumerable: false, configurable: true });
    const self = this;
    Object.defineProperty(this.root.userData, 'parts', { get() { return self.compatParts(); }, enumerable: false, configurable: true });
    this.hidden = 0;
    live.add(this);
    this.update(0);
  }

  /** Resolved outfit: { sex, parts, colors (role -> '#hex'), shirt, jacket, beard, kufi, hijab, accessories[] } */
  get appearance() {
    const R = this.R, kinds = R.acc.map((a) => a.kind);
    const low = (h) => (h ? String(h).toLowerCase() : null);
    return {
      sex: R.sex, parts: { ...R.parts }, colors: { ...R.colors }, accessories: kinds,
      shirt: low(R.colors.shirt), jacket: this.look.suit || this.look.jacket ? low(R.colors.jacket) : null,
      beard: kinds.includes('beard'), kufi: kinds.includes('kufi'), hijab: kinds.includes('hijab'), seated: this.state === 'sit'
    };
  }

  /** play('idle'|'talk'|'wave'|'sit'|'stand'|'interact'|'walk'|'run', { once }) */
  play(name, o = {}) {
    switch (name) {
      case 'idle': this.talkTarget = 0; this.gesture = null; if (this.state !== 'sit') this.state = 'idle'; break;
      case 'stand': this.state = 'idle'; break;
      case 'sit': this.state = 'sit'; break;
      case 'talk': this.talkTarget = 1; break;
      case 'listen': this.talkTarget = 0; break;
      case 'wave': case 'interact': {
        const clip = name === 'wave' ? 'Wave' : 'Interact';
        const a = this.actions[clip]; if (!a) break;
        this.gesture = clip; a.reset(); a.play(); a.setLoop(o.once === false ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true;
        this.gestureEnd = o.once === false ? Infinity : a.getClip().duration * (name === 'wave' ? 2 : 1);
        if (name === 'wave' && o.once !== false) a.setLoop(THREE.LoopRepeat, 2);
        this.gestureT = 0;
        break;
      }
      case 'walk': this.setLocomotion(1.4); break;
      case 'run': this.setLocomotion(4.5); break;
      default: break;
    }
    return this;
  }
  /** Locomotion speed in m/s (world). 0 = idle. */
  setLocomotion(v) { this.speed = Math.max(0, v || 0); }
  turnTo(yaw, instant = false) { this.targetYaw = yaw; if (instant) { this.root.rotation.y = yaw; } }
  /** Head (and a little neck) follow a world position; null releases. */
  lookAt(p) { this.lookTarget = p ? (this.lookTarget || new THREE.Vector3()).copy(p) : null; }

  // -------------------------------------------------------------- per-frame
  update(dt) {
    const a = this.actions;
    // locomotion weights (scaled speeds)
    const s = this.scale;
    // clip ground speeds (measured from the foot motion, scaled to this character); the walk clip is played up to
    // ~1.75x before blending into the run, so a brisk 2.2 m/s still reads as walking
    const walkV = (this.tpl.speeds.Walk || 1.3) * s, runV = (this.tpl.speeds.Run || 2.6) * s;
    const blendA = walkV * 1.75, blendB = Math.max(blendA + 0.6, runV * 1.45);
    let wi = 1, ww = 0, wr = 0;
    const v = this.state === 'sit' ? 0 : this.speed;
    if (v > 0.05) {
      if (v <= blendA) { ww = Math.min(1, v / (walkV * 0.5)); wi = 1 - ww; }
      else { const t = Math.min(1, (v - blendA) / (blendB - blendA)); ww = 1 - t; wr = t; wi = 0; }
    }
    const k = dt > 0 ? Math.min(1, dt * 8) : 1;
    this.w.idle = smooth(this.w.idle, wi, k); this.w.walk = smooth(this.w.walk, ww, k); this.w.run = smooth(this.w.run, wr, k);
    // foot speed matched to velocity: timeScale = v / clip ground speed
    if (a.Walk) a.Walk.timeScale = v > 0.05 ? THREE.MathUtils.clamp(v / walkV, 0.5, 2.0) : 1;
    if (a.Run) a.Run.timeScale = v > blendA ? THREE.MathUtils.clamp(v / runV, 0.8, 2.3) : 1;
    // gestures (Wave / Interact) override the upper body via weight
    let gw = 0;
    if (this.gesture) {
      this.gestureT += dt;
      gw = Math.min(1, this.gestureT / 0.25);
      if (this.gestureT > this.gestureEnd) { gw = Math.max(0, 1 - (this.gestureT - this.gestureEnd) / 0.3); if (gw <= 0) this.gesture = null; }
    }
    this.w.gesture = gw;
    const base = 1 - gw;
    const idleOther = this.idleName === 'Idle' ? 'Idle_Neutral' : 'Idle';
    if (a[this.idleName]) a[this.idleName].setEffectiveWeight(this.w.idle * base);
    if (a[idleOther]) a[idleOther].setEffectiveWeight(0);
    if (a.Walk) a.Walk.setEffectiveWeight(this.w.walk * base);
    if (a.Run) a.Run.setEffectiveWeight(this.w.run * base);
    for (const g of ['Wave', 'Interact']) if (a[g]) a[g].setEffectiveWeight(this.gesture === g ? gw : 0);

    // restore bones touched by procedural overlays (some have no animation track)
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    this.mixer.update(dt);

    // smooth body turn
    if (this.targetYaw != null && dt > 0) {
      this.root.rotation.y = lerpAngle(this.root.rotation.y, this.targetYaw, Math.min(1, dt * 6));
      if (Math.abs(lerpAngle(this.root.rotation.y, this.targetYaw, 1) - this.root.rotation.y) < 0.002) { this.root.rotation.y = this.targetYaw; this.targetYaw = null; }
    }
    this.t = (this.t || 0) + dt;
    this.sitW = smooth(this.sitW, this.state === 'sit' ? 1 : 0, dt > 0 ? Math.min(1, dt * 5) : 1);
    this.talk = smooth(this.talk, this.talkTarget, dt > 0 ? Math.min(1, dt * 4) : 1);
    let lower = 0;
    if (this.sitW > 0.001) lower += this.applySit(this.sitW);
    if (this._parts) lower += this.applyCompat();
    this.model.position.y = -lower;
    if (this.talk > 0.01) this.applyTalk(this.talk);
    this.applyLook(dt);
  }

  /** Rotate a bone about a character-space axis (root frame: Y up, faces -Z) around its own pivot. */
  rotChar(name, axis, angle) {
    const b = this.bones[name]; if (!b || !angle) return;
    if (!this.rest.has(b)) this.rest.set(b, b.quaternion.clone());
    _qp.identity();
    const chain = [];
    for (let p = b.parent; p && p !== this.root; p = p.parent) chain.push(p);
    for (let i = chain.length - 1; i >= 0; i--) _qp.multiply(chain[i].quaternion);
    _q.setFromAxisAngle(axis, angle);
    // q_local' = Qp^-1 * R * Qp * q_local
    _q2.copy(_qp).invert().multiply(_q).multiply(_qp);
    b.quaternion.premultiply(_q2);
  }

  applySit(w) {
    const L = this.tpl.legs;
    const arms = this.R.sitArms || 'lap';
    for (const side of [0, 1]) {
      this.rotChar(BONES.legUpper[side], AX, 1.5 * w);
      this.rotChar(BONES.legLower[side], AX, -1.5 * w);
      this.rotChar(BONES.armUpper[side], AX, (arms === 'desk' ? 0.55 : 0.32) * w);
      this.rotChar(BONES.armLower[side], AX, (arms === 'desk' ? 0.75 : 0.85) * w);
    }
    // lower the body so the knees sit at shin height (feet on the floor)
    return (L.hipY - (L.shin + L.ankleY)) * w;
  }

  applyTalk(w) {
    const t = this.t + this.phase;
    const g1 = Math.sin(t * 2.1) * 0.5 + 0.5, g2 = Math.sin(t * 1.3 + 1.7) * 0.5 + 0.5;
    // right forearm comes up for gestures, left joins now and then; small nods and head turns
    // open-palm gestures out to the side (the source rig's .R arm is on the character's right = root +X)
    const sr = Math.sign(this.tpl.bonePos('UpperArmR').x) < 0 ? 1 : -1; // model -X -> root +X
    this.rotChar('UpperArmR', AX, (0.28 + 0.2 * g1) * w);
    this.rotChar('UpperArmR', AZ, sr * (0.22 + 0.12 * g2) * w);
    this.rotChar('LowerArmR', AX, (0.75 + 0.3 * Math.sin(t * 3.3)) * w);
    this.rotChar('UpperArmL', AX, (0.1 + 0.18 * g2) * w);
    this.rotChar('UpperArmL', AZ, -sr * (0.12 + 0.08 * g1) * w);
    this.rotChar('LowerArmL', AX, (0.3 + 0.35 * g2) * w);
    this.rotChar('Head', AX, (0.05 * Math.sin(t * 4.1) + 0.03) * w);
    this.rotChar('Head', AY, 0.06 * Math.sin(t * 1.1) * w);
    this.rotChar('Chest', AY, 0.04 * Math.sin(t * 1.7) * w);
  }

  applyLook(dt) {
    let ty = 0, tp = 0;
    if (this.lookTarget) {
      _v.copy(this.lookTarget);
      this.root.worldToLocal(_v);
      _v.x *= this.root.scale.x; _v.z *= this.root.scale.z; _v.y *= this.root.scale.y;
      const headY = (this.tpl.bonePos('Head').y - this.model.position.y * 0) * this.scale;
      ty = Math.atan2(-_v.x, -_v.z);
      if (Math.abs(ty) > 1.9) ty = 0; // behind: do not twist the neck
      ty = THREE.MathUtils.clamp(ty, -0.9, 0.9);
      tp = THREE.MathUtils.clamp(Math.atan2(_v.y - headY, Math.hypot(_v.x, _v.z)), -0.35, 0.3);
    }
    const k = dt > 0 ? Math.min(1, dt * 4) : 1;
    this.headYaw = smooth(this.headYaw, ty, k); this.headPitch = smooth(this.headPitch, tp, k);
    if (Math.abs(this.headYaw) > 0.002) { this.rotChar('Neck', AY, this.headYaw * 0.35); this.rotChar('Head', AY, this.headYaw * 0.65); }
    if (Math.abs(this.headPitch) > 0.002) this.rotChar('Head', AX, -this.headPitch);
  }

  // -------------------------------------------------------------- legacy makeNPC compatibility: userData.parts
  /**
   * parts = { head, body, armL, armR, legL, legR }: pose groups in the old figure's frames. Children added to them
   * follow the matching bone; their rotation/position is applied to the bone (seated legs, raised arms…).
   */
  compatParts() {
    if (this._parts) return this._parts;
    const tpl = this.tpl, hi = headInfo(tpl, this.R.parts.head);
    const oldS = this.R.height / 1.75;
    const sideBone = (names, wantPlusX) => {
      // old "L" parts sat at +X of the figure (root frame); root +X = model -X
      const [a, b] = names; const xa = tpl.bonePos(a).x;
      return (wantPlusX ? xa < 0 : xa > 0) ? a : b;
    };
    const armLen = tpl.bonePos('UpperArmL').distanceTo(tpl.bonePos('WristL'));
    const legLen = tpl.bonePos('UpperLegL').distanceTo(tpl.bonePos('FootL')) + tpl.legs.ankleY;
    const defs = {
      // the old head was a 0.13 m sphere centred just below eye level; fit its frame to this head (+hair)
      head: { bone: 'Head', anchor: new THREE.Vector3(hi.center.x, hi.eyeY + 0.01, hi.center.z + 0.005), scale: (Math.max(hi.half.x, hi.half.z * 0.85) / 0.13) * 1.08 },
      body: { bone: 'Torso', anchor: new THREE.Vector3(), scale: oldS / this.scale },
      armL: { bone: sideBone(BONES.armUpper, true), arm: true, scale: armLen / 0.62 },
      armR: { bone: sideBone(BONES.armUpper, false), arm: true, scale: armLen / 0.62 },
      legL: { bone: sideBone(BONES.legUpper, true), scale: legLen / 0.86 },
      legR: { bone: sideBone(BONES.legUpper, false), scale: legLen / 0.86 }
    };
    const parts = {};
    this._compat = [];
    const ry = new THREE.Matrix4().makeRotationY(Math.PI);
    for (const [key, d] of Object.entries(defs)) {
      const bone = this.bones[d.bone];
      const A = new THREE.Group(); A.name = `part:${key}`;
      const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.name = `holder:${key}`;
      holder.add(A); bone.add(holder);
      const anchor = d.anchor || tpl.bonePos(d.bone);
      let R = new THREE.Matrix4();
      if (d.arm) {
        const wrist = d.bone.replace('UpperArm', 'Wrist');
        const dirModel = tpl.bonePos(wrist).sub(tpl.bonePos(d.bone)).normalize();
        const dirRoot = dirModel.clone().applyMatrix4(ry);
        R.makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirRoot));
      }
      const desired = new THREE.Matrix4().makeTranslation(anchor.x, anchor.y, anchor.z).multiply(ry).multiply(R).multiply(new THREE.Matrix4().makeScale(d.scale, d.scale, d.scale));
      const boneRest = tpl.restWorld[tpl.index.get(d.bone)];
      const offset = boneRest.clone().invert().multiply(desired);
      parts[key] = A;
      this._compat.push({ key, A, holder, offset, bone: d.bone });
    }
    this._parts = parts;
    this._oldHip = 0.86 * oldS;
    this._oldS = oldS;
    this.update(0);
    return parts;
  }

  applyCompat() {
    let lower = 0;
    for (const c of this._compat) {
      const { A, holder, offset, key } = c;
      A.updateMatrix();
      holder.matrix.copy(offset).multiply(_m.copy(A.matrix).invert());
      holder.matrixWorldNeedsUpdate = true;
      const r = A.rotation;
      if (key === 'body') { lower += -A.position.y * this._oldS / this.scale; continue; }
      if (key === 'legL' || key === 'legR') {
        if (r.x) {
          this.rotChar(c.bone, AX, r.x);
          const knee = -r.x * THREE.MathUtils.smoothstep(r.x, 0.3, 0.9);
          this.rotChar(c.bone.replace('UpperLeg', 'LowerLeg'), AX, knee);
        }
        continue;
      }
      if (r.x) this.rotChar(c.bone, AX, r.x);
      if (r.y) this.rotChar(c.bone, AY, r.y);
      if (r.z) this.rotChar(c.bone, AZ, r.z);
    }
    // a scene that seats a legacy figure lowers it by the OLD hip height; correct for the new hip height
    const legs = this._parts.legL.rotation.x + this._parts.legR.rotation.x;
    if (legs > 1.2) lower += (this.tpl.legs.hipY * this.scale - this._oldHip) / this.scale * THREE.MathUtils.smoothstep(legs / 2, 0.6, 1.2);
    return lower;
  }

  dispose() {
    live.delete(this);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.rig);
  }
}

// ------------------------------------------------------------------ global update
const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere();
function inScene(o) { for (let p = o; p; p = p.parent) if (p.isScene) return true; return false; }
/** Advance every live character that is in the scene graph and near the camera's view. */
export function updateCharacters(dt, camera) {
  if (camera) { pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm); }
  for (const c of live) {
    if (!inScene(c.root)) { if ((c.hidden += dt) > 30) live.delete(c); continue; }
    c.hidden = 0;
    if (camera) {
      c.root.getWorldPosition(sph.center); sph.center.y += 0.9; sph.radius = 1.6;
      if (!frustum.intersectsSphere(sph)) { c.skipped = (c.skipped || 0) + dt; continue; }
    }
    const step = dt + (c.skipped || 0); c.skipped = 0;
    c.update(Math.min(step, 0.1));
  }
}
export function liveCharacterCount() { return live.size; }

/** createCharacter(look, { single, name, idle }) -> Character (needs preloadCharacters() first). */
export function createCharacter(look, opts) { return new Character(look, opts); }
