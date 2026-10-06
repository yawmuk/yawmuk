// Asset loading for scenes: glTF models (meshopt / Draco), PBR texture sets, HDR environments, the asset catalog.
// Everything is cached by URL and shared between clones (geometry/material/texture userData.shared = true, so the
// scene disposer skips them). Assets not used by the newly loaded scene are purged after each scene load (purge()).
// Loading progress is reported per "session" (one scene load) through events 'load:progress'.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { events } from './events.js';

const BASE = (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/');
/** Resolve a public-folder path ('assets/props/x.glb', 'props/x.glb', '/assets/…') to an absolute URL. */
export function assetUrl(p) {
  if (/^(https?:|data:|blob:)/.test(p)) return p;
  let s = String(p).replace(/^\.?\//, '');
  if (!s.startsWith('assets/')) s = `assets/${s}`;
  return new URL(s, BASE).href;
}

// ------------------------------------------------------------------ loaders
let gltfLoader = null;
function getGltfLoader() {
  if (gltfLoader) return gltfLoader;
  gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  gltfLoader.setDRACOLoader(new LazyDracoLoader());
  return gltfLoader;
}

/** Draco decoder files are bundled by Vite (?url) and only fetched if a model actually uses Draco. */
class LazyDracoLoader extends DRACOLoader {
  constructor() { super(); this.setDecoderConfig({ type: 'wasm' }); }
  async _loadLibrary(url, responseType) {
    const urls = {
      'draco_wasm_wrapper.js': () => import('three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url'),
      'draco_decoder.wasm': () => import('three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url')
    };
    const mod = await urls[url]?.();
    const loader = new THREE.FileLoader(this.manager);
    loader.setResponseType(responseType);
    return new Promise((res, rej) => loader.load(mod?.default || url, res, undefined, rej));
  }
}

// ------------------------------------------------------------------ sessions (progress) + cache bookkeeping
let session = 0;
let prog = { loaded: 0, total: 0, label: '' };
function track(promise, label) {
  prog.total++;
  emitProgress(label);
  return promise.finally(() => { prog.loaded++; emitProgress(label); });
}
function emitProgress(label) {
  if (label) prog.label = label;
  events.emit('load:progress', { loaded: prog.loaded, total: prog.total, label: prog.label });
}
/** Start counting a new scene load (progress resets). */
export function beginSession(label = '') { session++; prog = { loaded: 0, total: 0, label }; emitProgress(label); return session; }
/** Report a non-asset step (e.g. "building scene") as one unit of progress. */
export function trackStep(promise, label) { return track(Promise.resolve(promise), label); }

const cache = new Map(); // url -> { kind, promise, value, session, keep }
function cached(url, kind, make, keep = false) {
  let e = cache.get(url);
  if (!e) { e = { kind, promise: make(), session, keep }; cache.set(url, e); e.promise.then((v) => { e.value = v; }, () => cache.delete(url)); }
  e.session = session;
  return e.promise;
}

function markShared(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.userData.shared = true;
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      m.userData.shared = true;
      for (const v of Object.values(m)) if (v && v.isTexture) v.userData.shared = true;
    }
  });
}

function disposeEntry(e) {
  const v = e.value; if (!v) return;
  if (e.kind === 'gltf') {
    v.scene.traverse((o) => {
      o.geometry?.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { for (const t of Object.values(m)) if (t && t.isTexture) t.dispose(); m.dispose(); }
    });
  } else if (e.kind === 'texture') v.dispose();
  else if (e.kind === 'env') v.dispose();
}

/** Dispose cached assets not used by the current session (call after the new scene is built). */
export function purge() {
  for (const [url, e] of cache) {
    if (e.keep || e.session === session || !e.value) continue;
    disposeEntry(e);
    cache.delete(url);
  }
}

// ------------------------------------------------------------------ catalog
let catalog = { entries: {}, raw: null };
let catalogPromise = null;
/** Load public/assets/catalog.json once (tolerates a missing file and several layouts). */
export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(assetUrl('assets/catalog.json'))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((raw) => { catalog = { entries: indexCatalog(raw), raw }; return catalog; });
  }
  return catalogPromise;
}
export function getCatalog() { return catalog; }

function indexCatalog(raw) {
  const out = {};
  const add = (e, kindHint, idHint) => {
    if (!e || typeof e !== 'object') return;
    const id = e.id || idHint; if (!id) return;
    out[id] = { kind: e.kind || e.type || kindHint || null, ...e, id };
  };
  const walk = (v, hint) => {
    if (Array.isArray(v)) v.forEach((e) => add(e, hint));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (Array.isArray(x)) walk(x, singular(k));
        else if (x && typeof x === 'object' && !('id' in x) && Object.values(x).some((y) => y && typeof y === 'object' && !Array.isArray(y) && (y.path || y.file || y.url || y.maps))) walk(Object.entries(x).map(([id, y]) => ({ id, ...y })), singular(k));
        else if (x && typeof x === 'object' && (x.path || x.file || x.url || x.maps || x.glb)) add(x, hint, k);
      }
    }
  };
  walk(raw, null);
  return out;
}
const singular = (k) => ({ models: 'model', props: 'model', textures: 'texture', materials: 'texture', hdris: 'hdri', hdri: 'hdri', environments: 'hdri', env: 'hdri', characters: 'model' }[k] || null);
const entryPath = (e) => e && (e.path || e.file || e.url || e.glb || e.hdr || e.src);
/** Catalog entry for an id (the 'tex_' / 'hdri_' prefixes may be omitted). */
export function catalogEntry(id) { return catalog.entries[id] || catalog.entries[`tex_${id}`] || catalog.entries[`hdri_${id}`] || null; }

/**
 * Yaw (radians) that turns an asset so that its FRONT faces the engine's forward (-Z) when placed with yaw 0.
 * Uses the catalog's per-asset forward axis (forward | forward_axis | facing | front, e.g. '+Z', '-X');
 * an asset without that field is left as authored (0).
 */
export function forwardYaw(id) {
  const e = catalogEntry(id); if (!e) return 0;
  const f = String(e.forward ?? e.forward_axis ?? e.facing ?? e.front ?? e.front_axis ?? '').toUpperCase().replace(/\s/g, '');
  return { '-Z': 0, '+Z': Math.PI, Z: Math.PI, '+X': Math.PI / 2, X: Math.PI / 2, '-X': -Math.PI / 2 }[f] ?? 0;
}

// ------------------------------------------------------------------ models
/** Raw (cached) glTF for a catalog id or a path. */
export function loadGLTF(idOrPath, { keep = false } = {}) {
  const e = catalog.entries[idOrPath];
  const p = entryPath(e) || (/[./]/.test(idOrPath) ? idOrPath : `assets/props/${idOrPath}.glb`);
  const url = assetUrl(p);
  return cached(url, 'gltf', () => track(getGltfLoader().loadAsync(url), idOrPath).then((g) => { markShared(g.scene); return g; }), keep);
}

/**
 * loadModel(id) -> Promise<Object3D>: a fresh clone (shares geometry/materials with the cache).
 * Skinned models are cloned with SkeletonUtils; `model.userData.animations` holds the glTF clips.
 */
export async function loadModel(idOrPath, opts = {}) {
  const g = await loadGLTF(idOrPath, opts);
  let skinned = false;
  g.scene.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
  const m = skinned ? skeletonClone(g.scene) : g.scene.clone(true);
  m.name = `model:${idOrPath}`;
  m.userData.animations = g.animations;
  m.userData.assetId = idOrPath;
  return m;
}

// ------------------------------------------------------------------ textures
const texLoader = new THREE.TextureLoader();
function loadTex(url, srgb) {
  return cached(url, 'texture', () => track(texLoader.loadAsync(url), url.split('/').slice(-2).join('/')).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.userData.shared = true;
    return t;
  }));
}

const MAP_KEYS = {
  map: ['map', 'color', 'albedo', 'diff', 'diffuse', 'baseColor', 'basecolor', 'col'],
  normalMap: ['normalMap', 'normal', 'nor', 'nor_gl', 'normal_gl'],
  roughnessMap: ['roughnessMap', 'roughness', 'rough'],
  aoMap: ['aoMap', 'ao'],
  metalnessMap: ['metalnessMap', 'metalness', 'metal'],
  arm: ['arm', 'orm']
};

/**
 * loadTexture(name, { repeat:[u,v] | number }) -> Promise<{ map, normalMap?, roughnessMap?, aoMap?, metalnessMap? }>
 * name: a catalog texture id (entry.maps = { diff|color, nor|normal, rough|roughness, ao, arm }) or a folder under
 * assets/textures/<name>/ containing diff.webp, nor.webp, rough.webp. Missing maps are skipped.
 * The returned textures are per-call clones (own repeat) that share the GPU image.
 */
export async function loadTexture(name, opts = {}) {
  const e = catalog.entries[name] || catalog.entries[`tex_${name}`];
  let files = {};
  if (e?.maps && typeof e.maps === 'object') {
    for (const [slot, keys] of Object.entries(MAP_KEYS)) {
      const k = keys.find((x) => e.maps[x]);
      if (k) files[slot] = e.maps[k];
    }
    const dir = e.dir || e.path || '';
    for (const s of Object.keys(files)) if (!/[/]/.test(files[s]) && dir) files[s] = `${dir.replace(/\/$/, '')}/${files[s]}`;
  } else if (e && entryPath(e) && /\.(png|jpe?g|webp|ktx2)$/i.test(entryPath(e))) {
    files.map = entryPath(e);
  } else {
    const dir = e?.dir || `assets/textures/${name}`;
    files = { map: `${dir}/diff.webp`, normalMap: `${dir}/nor.webp`, roughnessMap: `${dir}/rough.webp` };
  }
  const out = {};
  // repeat: explicit, or from a surface size in metres and the texture's real tile size (catalog real_size_m)
  const tile = Array.isArray(e?.real_size_m) ? e.real_size_m : Array.isArray(opts.tile) ? opts.tile : [1, 1];
  let rep = opts.repeat == null ? null : Array.isArray(opts.repeat) ? opts.repeat : [opts.repeat, opts.repeat];
  if (!rep && opts.size) { const sz = Array.isArray(opts.size) ? opts.size : [opts.size, opts.size]; rep = [sz[0] / (tile[0] || 1), sz[1] / (tile[1] || tile[0] || 1)]; }
  Object.defineProperty(out, 'tileSize', { value: tile, enumerable: false });
  await Promise.all(Object.entries(files).map(async ([slot, f]) => {
    try {
      const base = await loadTex(assetUrl(f), slot === 'map');
      const t = base.clone();
      t.userData.shared = false; // the clone is owned by the scene (disposing it does not free the shared image)
      if (rep) t.repeat.set(rep[0], rep[1]);
      if (slot === 'arm') { out.aoMap = t; out.roughnessMap = t; out.metalnessMap = t; } else out[slot] = t;
    } catch (err) {
      if (slot === 'map') throw new Error(`texture "${name}": ${err?.message || err}`);
    }
  }));
  return out;
}

// ------------------------------------------------------------------ HDR environments
/**
 * loadEnvironment(renderer, idOrPath) -> Promise<Texture> (equirectangular HDR, cached, kept across scenes).
 * id: catalog hdri id, or a name resolved as assets/env/hdri/hdri_<name>.hdr (or <name>.hdr), or a path.
 * The texture is returned with EquirectangularReflectionMapping and is NOT pre-filtered here: assigned to
 * `scene.environment` (or a material's envMap) it is PMREM-processed on first use by the renderer itself
 * (WebGPURenderer's node system on both the WebGPU and WebGL2 backends; WebGLRenderer's cube-UV cache too),
 * so this needs no initialised renderer. `renderer` is kept for API compatibility and is unused.
 */
export function loadEnvironment(renderer, idOrPath) {
  const e = catalog.entries[idOrPath] || catalog.entries[`hdri_${idOrPath}`];
  const p = entryPath(e) || (/[./]/.test(idOrPath) ? idOrPath : `assets/env/hdri/${idOrPath.startsWith('hdri_') ? idOrPath : `hdri_${idOrPath}`}.hdr`);
  const url = assetUrl(p);
  return cached(url, 'env', () => track(new HDRLoader().loadAsync(url), 'environment').then((hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    hdr.userData.shared = true;
    return hdr;
  }), true);
}
