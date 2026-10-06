// Scene manager: builds a location scene through the scene contract, validates the result,
// auto-adds markers/NPCs/missing hotspots, and disposes everything on unload.
import * as THREE from 'three/webgpu'; // node materials for scenes (shares one core with 'three')
import { getSceneDef, placeholderScene } from './sceneRegistry.js';
import { makeNPC, makeCharacter, makeLabel, makeMarker, createKit, animateFigure } from './kit.js';
import { preloadCharacters } from './characters.js';
import { beginSession, trackStep, purge, loadCatalog, getCatalog } from './assets.js';
import { events } from './events.js';
import { getLang, tr } from './i18n.js';
import { ALL_LOCATIONS, LOCATION_TITLES, LIGHTING } from './config.js';
import { normalizeDoors, normalizeFeatureSpots } from './hub.js';
import { createTownContext } from './townContext.js';
import { createSkyDome } from './goldenSky.js';

const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

// Every THREE.Sprite (labels, smoke puffs…) shares ONE module-level quad geometry. Disposing it from one scene's
// sprite destroys the GPU vertex buffer every later sprite still draws with (WebGPU: "[Buffer] used in submit while
// destroyed" every frame; WebGL silently re-uploads), so flag it shared: the scene disposers must never free it.
new THREE.Sprite().geometry.userData.shared = true;

function hourOf(time) { const m = /^(\d{1,2})/.exec(time || ''); return m ? +m[1] : 12; }
const lightsForTime = (time) => { const h = hourOf(time); return h >= 20 || h < 5 ? 'night' : h >= 17 ? 'evening' : 'day'; };
const vec3 = (a, d = [0, 0, 0]) => {
  if (!Array.isArray(a) || a.length < 2) return d;
  if (a.length === 2) return [Number(a[0]) || 0, 0, Number(a[1]) || 0]; // [x, z] shorthand
  return [Number(a[0]) || 0, Number(a[1]) || 0, Number(a[2]) || 0];
};

/** opts.hasFeature(name): only feature spots whose module exists get a marker (missing modules stay invisible). */
export function createSceneManager(world, mats, opts = {}) {
  const hasFeature = typeof opts.hasFeature === 'function' ? opts.hasFeature : () => true;
  let active = null;

  function makeCtx(location, script) {
    const group = new THREE.Group();
    group.name = `scene:${location}`;
    const ctx = {
      THREE, mats, makeNPC, makeCharacter, makeLabel, group, colliders: [],
      location, script, lang: getLang(), tr, debug: DEBUG,
      isMobile: world.isMobile, quality: world.quality, catalog: getCatalog(), renderer: world.renderer,
      _pending: [], extraOccluders: []
    };
    Object.assign(ctx, createKit(ctx));
    return ctx;
  }

  /** build() may be sync or async; every ctx.place/loadModel/loadTexture/pbr started inside it is awaited too. */
  async function runBuild(def, location, script, onWarn) {
    const ctx = makeCtx(location, script);
    ctx.warn = onWarn;
    let res;
    try {
      res = await def.build.call(def, ctx);
      if (!res || typeof res !== 'object') throw new Error('build(ctx) must return an object');
    } catch (e) {
      if (e && typeof e === 'object') e.__ctx = { ctx, res };
      throw e;
    }
    // wait for assets started during build (and anything those start in turn)
    for (let i = 0; i < 4 && ctx._pending.length; i++) { const list = ctx._pending.splice(0); await Promise.all(list.map((pr) => Promise.resolve(pr).catch(() => null))); }
    return { ctx, res };
  }

  function disposeBuilt(built) {
    try { built.res?.dispose?.(); } catch { /* ignore */ }
    if (built.ctx?.group) disposeTree(built.ctx.group);
    if (built.res?.group?.isObject3D && built.res.group !== built.ctx.group) disposeTree(built.res.group);
  }

  /**
   * Load a location. Returns the active-scene object used by the game loop.
   * onWarn(msg) receives non-fatal problems (shown as a toast in ?debug=1).
   */
  async function load(location, script, onWarn = () => {}) {
    unload();
    beginSession(location);
    // shared libraries first (characters are needed synchronously by makeNPC inside build)
    await Promise.all([trackStep(loadCatalog(), 'catalog'), trackStep(preloadCharacters(), 'characters')]);
    const { def, isPlaceholder, error: importError } = await trackStep(getSceneDef(location), 'scene');
    if (importError) onWarn(`scene import failed: ${importError.message}`);
    let built, usedPlaceholder = isPlaceholder;
    try {
      built = await trackStep(runBuild(def, location, script, onWarn), 'build');
    } catch (e) {
      console.error(`[scene] build() of "${location}" threw — using placeholder`, e);
      onWarn(`build() failed: ${e.message}`);
      if (e && e.__ctx) disposeBuilt(e.__ctx);
      built = await runBuild(placeholderScene, location, script, onWarn);
      usedPlaceholder = true;
    }
    const { ctx, res } = built;
    const warn = (m) => { console.warn(`[scene:${location}]`, m); onWarn(m); };

    // ---- group
    const root = new THREE.Group();
    root.name = `root:${location}`;
    if (res.group?.isObject3D) root.add(res.group); else warn('build() returned no THREE.Group in `group`; using ctx.group');
    if (res.group !== ctx.group && ctx.group.children.length) root.add(ctx.group);
    // far-field scenery (sky dome, hills, the suburb around the hub): lives in the root so it is disposed with the
    // scene, but is never part of the player bounds or the camera occluders (those only look at the scene group)
    for (const b of res.backdrop ? [res.backdrop].flat() : []) {
      if (b?.isObject3D) { b.traverse((o) => { o.userData.noCameraCollide = true; }); root.add(b); } else warn('backdrop entries must be THREE.Object3D');
    }
    // one integrated environment: under the global golden-hour look every interior gets the town's sky dome (same
    // shared uniforms), so the sky above the walls and through the windows is the same sky as outdoors
    if (LIGHTING === 'golden' && !res.backdrop && res.lights !== 'night') root.add(createSkyDome({ quality: world.quality }));
    // same season as the town (golden autumn): no falling snow; the snowy yard reads as lawn
    if (LIGHTING === 'golden') root.traverse((o) => {
      if (/snowfall$/i.test(o.name)) o.visible = false;
      else if (/:snow$/i.test(o.name) && o.material?.color) { o.material = o.material.clone(); o.material.color.set('#6f9a4e'); }
    });
    world.scene.add(root);
    root.updateMatrixWorld(true);

    // ---- colliders
    const colliders = [...ctx.colliders];
    for (const c of Array.isArray(res.colliders) ? res.colliders : []) {
      if (c && Array.isArray(c.min) && Array.isArray(c.max)) colliders.push({ min: vec3(c.min), max: vec3(c.max) });
      else warn('ignored malformed collider (need {min:[x,y,z], max:[x,y,z]})');
    }

    // ---- spawn
    const spawn = { position: vec3(res.spawn?.position), yaw: Number(res.spawn?.yaw) || 0 };

    // ---- npcs (scene decides placement & look; engine builds the meshes)
    const npcObjects = {};
    const scriptNpcNames = {};
    (script?.situations || []).forEach((s) => { if (s.npc?.id) scriptNpcNames[s.npc.id] = s.npc.name; });
    for (const n of Array.isArray(res.npcs) ? res.npcs : []) {
      if (!n || !n.id) { warn('npc without id ignored'); continue; }
      const look = { ...(n.look || {}) };
      if (n.pose === 'sit' || n.seated) look.seated = true;
      if (n.sitArms) look.sitArms = n.sitArms;
      // background extras built from a look use one merged mesh (1 draw call); script NPCs get full colour pieces
      const fig = n.object?.isObject3D ? n.object : makeNPC(look, { single: String(n.id).startsWith('bg_') || undefined, name: n.id });
      const p = vec3(n.position);
      fig.position.set(p[0], p[1], p[2]);
      fig.rotation.y = Number(n.yaw) || 0;
      if (!fig.parent) root.add(fig);
      fig.userData.npcId = n.id;
      fig.userData.baseYaw = fig.rotation.y;
      fig.userData.phase = Math.random() * 6;
      fig.userData.animate = n.animate !== false;
      const ch = fig.userData.character;
      if (ch) {
        if (n.pose === 'sit' || n.seated || look.seated) ch.play('sit');
        if (typeof n.anim === 'string') ch.play(n.anim, { once: false });
      }
      const name = n.name || scriptNpcNames[n.id];
      const isBg = String(n.id).startsWith('bg_'); // background, non-speaking extras
      fig.userData.background = isBg;
      if (name && n.showName !== false && !isBg) {
        const lbl = makeLabel(name, { size: 0.22, background: 'rgba(0,0,0,0.45)' });
        const lh = fig.userData.character ? (fig.userData.character.R.height + 0.22) / fig.scale.y : 2.02;
        lbl.position.set(0, ch?.state === 'sit' ? lh - 0.45 / fig.scale.y : lh, 0);
        fig.add(lbl);
      }
      if (n.collide !== false) {
        const c = { min: [p[0] - 0.28, 0, p[2] - 0.28], max: [p[0] + 0.28, 1.8, p[2] + 0.28] };
        colliders.push(c);
        fig.userData.collider = c; // mutated in place when the NPC moves between stations
      }
      // optional stations: { <hotspotId>: { position:[x,0,z], yaw } } — one NPC serving several situations
      if (n.stations && typeof n.stations === 'object') {
        const st = {};
        for (const [hid, s] of Object.entries(n.stations)) {
          if (s && Array.isArray(s.position)) st[hid] = { position: vec3(s.position), yaw: Number(s.yaw) || 0 };
          else warn(`npc "${n.id}": station "${hid}" needs { position:[x,0,z], yaw }`);
        }
        if (Object.keys(st).length) fig.userData.stations = st;
      }
      npcObjects[n.id] = fig;
    }

    // ---- hotspots: keep scene ones, auto-place any that the script needs but the scene lacks
    const hotspots = [];
    const seen = new Set();
    for (const hs of Array.isArray(res.hotspots) ? res.hotspots : []) {
      if (!hs || !hs.id) { warn('hotspot without id ignored'); continue; }
      if (seen.has(hs.id)) { warn(`duplicate hotspot id "${hs.id}"`); continue; }
      seen.add(hs.id);
      hotspots.push({ id: hs.id, position: vec3(hs.position), radius: Number(hs.radius) || 1.5, label: hs.label || null, markerHeight: hs.markerHeight });
    }
    const needed = [...new Set((script?.situations || []).map((s) => s.hotspot))];
    const missing = needed.filter((id) => !seen.has(id));
    missing.forEach((id, i) => {
      const ang = (i / Math.max(1, missing.length)) * Math.PI * 2;
      const pos = [spawn.position[0] + Math.sin(ang) * 3.2, 0, spawn.position[2] - 3 + Math.cos(ang) * 2];
      warn(`script hotspot "${id}" not provided by scene — auto-placed at [${pos.map((v) => v.toFixed(1))}]`);
      hotspots.push({ id, position: pos, radius: 1.5, label: null, auto: true });
    });
    const unused = hotspots.filter((hs) => !needed.includes(hs.id)).map((hs) => hs.id);
    if (unused.length) warn(`hotspots not used by script (no marker shown): ${unused.join(', ')}`);

    // ---- markers
    for (const hs of hotspots) {
      hs.active = needed.includes(hs.id);
      if (!hs.active) continue;
      const m = makeMarker('#ffd34d', 'hotspot');
      // ring sits on the floor; the floating gem hovers above the object (position[1] = object height)
      m.position.set(hs.position[0], 0, hs.position[2]);
      m.userData.gemY = hs.markerHeight || Math.max(2.1, (hs.position[1] || 0) + 1.2);
      root.add(m);
      hs.marker = m;
      const sit = (script?.situations || []).find((s) => s.hotspot === hs.id);
      const lblText = hs.label || sit?.npc?.name || null;
      if (lblText) {
        const lbl = makeLabel(lblText, { size: 0.26 });
        lbl.position.set(0, m.userData.gemY + 0.42, 0);
        m.add(lbl);
      }
    }
    // exit: `exit: null` means "no exit" (the walkable hub uses doors instead)
    let exit = null;
    if (res.exit?.position) {
      exit = { position: vec3(res.exit.position), radius: Number(res.exit.radius) || 1.5 };
    } else if (res.exit !== null) {
      warn('no exit provided — auto-placing behind spawn');
      exit = { position: [spawn.position[0], 0, spawn.position[2] + 2.5], radius: 1.5 };
    }
    if (exit) {
      exit.kind = 'exit';
      exit.marker = makeMarker('#6fe3c1', 'exit');
      exit.marker.position.set(exit.position[0], 0, exit.position[2]);
      root.add(exit.marker);
    }

    // ---- doors (hub scene -> another location) and feature spots (open a src/features/<name> panel)
    const doors = normalizeDoors(res.doors, ALL_LOCATIONS, warn);
    for (const d of doors) {
      d.marker = makeMarker('#6fe3c1', 'exit');
      d.marker.position.set(d.position[0], 0, d.position[2]);
      d.marker.userData.gemY = 3.0;
      const lbl = makeLabel(d.label || LOCATION_TITLES[d.location] || d.location, { size: 0.34 });
      lbl.position.set(0, 3.55, 0);
      d.marker.add(lbl);
      root.add(d.marker);
    }
    // static `featureSpots` on the default export (contract) and/or on the build result; the same spot listed in both counts once
    const spotDefs = [...(Array.isArray(def.featureSpots) ? def.featureSpots : []), ...(Array.isArray(res.featureSpots) && res.featureSpots !== def.featureSpots ? res.featureSpots : [])];
    const spotKeys = new Set();
    const spots = normalizeFeatureSpots(spotDefs, warn).filter((sp) => {
      const key = `${sp.feature}@${sp.position.map((v) => v.toFixed(2)).join(',')}`;
      if (spotKeys.has(key)) return false;
      spotKeys.add(key);
      if (hasFeature(sp.feature)) return true;
      console.info(`[scene:${location}] feature "${sp.feature}" has no module yet — spot hidden`);
      return false;
    });
    for (const sp of spots) {
      sp.marker = makeMarker('#b9a2ff', 'hotspot');
      sp.marker.position.set(sp.position[0], 0, sp.position[2]);
      sp.marker.userData.gemY = Math.max(1.9, (sp.position[1] || 0) + 1.1);
      if (sp.label) {
        const lbl = makeLabel(sp.label, { size: 0.24 });
        lbl.position.set(0, sp.marker.userData.gemY + 0.4, 0);
        sp.marker.add(lbl);
      }
      root.add(sp.marker);
    }

    // ---- bounds (player clamp): scene bbox, excluding markers/labels
    const bb = new THREE.Box3();
    for (const child of [res.group, ctx.group]) if (child?.isObject3D) bb.expandByObject(child);
    for (const c of colliders) { bb.expandByPoint(new THREE.Vector3(...c.min)); bb.expandByPoint(new THREE.Vector3(...c.max)); }
    bb.expandByPoint(new THREE.Vector3(...spawn.position));
    const bounds = bb.isEmpty() ? null : { minX: bb.min.x - 0.5, maxX: bb.max.x + 0.5, minZ: bb.min.z - 0.5, maxZ: bb.max.z + 0.5 };

    // ---- town context: every interior sits inside «حيّ السلام» — the neighbourhood ring (houses, trees, lamps, the
    // mosque on the skyline) outside its bounds + the town's golden sky, so windows/doors look onto the main map.
    // Root-only (like res.backdrop): never in the player bounds or the camera occluders. Scenes opt out with townContext:false.
    if (!res.backdrop && !res.doors && res.townContext !== false && bounds) {
      const night = res.lights === 'night' || !LIGHTING;
      const tc = createTownContext({ bounds: res.townBounds || bounds, front: exit ? [exit.position[0], exit.position[2]] : null, location, quality: world.quality, night });
      tc.traverse((o) => { o.userData.noCameraCollide = true; });
      root.add(tc);
      root.updateMatrixWorld(true);
    }

    // ---- camera occluders: large, opaque, static meshes (walls, big furniture); see player.js
    const occluders = [];
    const sphere = new THREE.Sphere();
    for (const src of [res.group, ctx.group]) {
      if (!src?.isObject3D) continue;
      src.traverse((o) => {
        if (!o.isMesh || !o.visible || o.userData.noCameraCollide || o.isSkinnedMesh) return;
        if (o.isInstancedMesh) { if (o.userData.cameraCollide) occluders.push(o); return; } // instanced: opt-in only
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!mat || (mat.transparent && mat.opacity < 0.6) || mat.side === THREE.BackSide) return;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        sphere.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
        const g = o.geometry, tris = (g.index ? g.index.count : g.attributes.position?.count || 0) / 3;
        // big merged meshes are too costly to raycast every frame — supply cheap proxies via cameraOccluders instead
        if (o.userData.cameraCollide || (sphere.radius >= 0.9 && tris <= 2000)) occluders.push(o);
      });
    }

    // explicit occluders from the scene (any mesh type, may be invisible proxies; not required to be in the group)
    const extraOcc = [...(res.cameraOccluders ? [res.cameraOccluders].flat() : []), ...(ctx.extraOccluders || [])];
    for (const o of extraOcc) {
      if (o?.isObject3D) { if (!o.parent) o.updateMatrixWorld(true); occluders.push(o); }
      else warn('cameraOccluders entries must be THREE.Object3D');
    }

    // ---- lights
    // global look (config.LIGHTING): every scene gets the golden-hour preset unless it explicitly asks for night
    const asked = ['day', 'evening', 'night', 'golden'].includes(res.lights) ? res.lights : null;
    // one synchronized day: every place shares the town's golden-hour look (no separate night scene)
    const forced = LIGHTING || null;
    const lights = forced || asked || lightsForTime(script?.time_of_day);
    // environment: { hdri: 'studio' | catalog id | path, intensity, background:false, blur } (optional)
    await trackStep(world.applyLights(lights, res.environment && typeof res.environment === 'object' ? res.environment : null), 'lighting');
    // optional per-scene overrides of the preset sky colour / fog (ignored while a global look is forced)
    if (!forced) try {
      if (typeof res.sky === 'string') world.scene.background = new THREE.Color(res.sky);
      if (res.fog && typeof res.fog === 'object') {
        if (res.fog.color) world.scene.fog.color.set(res.fog.color);
        if (Number.isFinite(res.fog.near)) world.scene.fog.near = res.fog.near;
        if (Number.isFinite(res.fog.far)) world.scene.fog.far = res.fog.far;
      }
    } catch (e) { warn(`bad sky/fog override: ${e.message}`); }

    // ---- debug helpers
    if (DEBUG) {
      for (const c of colliders) {
        const helper = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...c.min), new THREE.Vector3(...c.max)), 0xff00ff);
        root.add(helper);
      }
      for (const hs of [...hotspots, ...(exit ? [exit] : []), ...doors, ...spots]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(hs.radius - 0.03, hs.radius, 48), new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(hs.position[0], 0.05, hs.position[2]);
        root.add(ring);
      }
      console.info(`[scene:${location}] meshes/tris:`, countStats(root));
    }

    active = {
      location, def, ctx, res, root, colliders, occluders, spawn, hotspots, exit, doors, spots, npcs: npcObjects, bounds, lights,
      isPlaceholder: usedPlaceholder,
      talkingTo: null,
      /** Move every NPC that has stations to the station of its first unfinished hotspot. Returns ids that moved. */
      placeStationNpcs(isHotspotDone, { dryRun = false, force = null } = {}) {
        const moved = [];
        const order = [...new Set((script?.situations || []).map((s) => s.hotspot))];
        for (const [id, fig] of Object.entries(npcObjects)) {
          const st = fig.userData.stations; if (!st) continue;
          if (force && !st[force]) continue;
          const ids = order.filter((h) => st[h]).concat(Object.keys(st).filter((h) => !order.includes(h)));
          if (!ids.length) continue;
          const target = force && st[force] ? force : ids.find((h) => !isHotspotDone(h)) || ids[ids.length - 1];
          if (fig.userData.station === target) continue;
          if (dryRun) { moved.push(id); continue; }
          const { position: p, yaw } = st[target];
          fig.position.set(p[0], p[1], p[2]);
          fig.rotation.y = yaw; fig.userData.baseYaw = yaw;
          if (fig.userData.character) fig.userData.character.targetYaw = null;
          const c = fig.userData.collider;
          if (c) { c.min[0] = p[0] - 0.28; c.min[2] = p[2] - 0.28; c.max[0] = p[0] + 0.28; c.max[2] = p[2] + 0.28; }
          if (fig.userData.station !== undefined) moved.push(id);
          fig.userData.station = target;
        }
        return moved;
      },
      update(dt, t, near) {
        for (const hs of hotspots) hs.marker?.tick(t, near === hs);
        exit?.marker.tick(t, near === exit);
        for (const d of doors) d.marker.tick(t, near === d);
        for (const sp of spots) sp.marker.tick(t, near === sp);
        for (const fig of Object.values(npcObjects)) {
          if (fig.userData.character) continue; // skinned characters are updated by updateCharacters()
          if (fig.userData.animate) animateFigure(fig, t, 0, fig.userData.phase);
        }
        if (typeof res.update === 'function') {
          try { res.update(dt, t); } catch (e) { console.error(`[scene:${location}] update() threw — disabled`, e); res.update = null; }
        }
      }
    };
    purge(); // free cached assets the previous location used but this one does not
    // shader warm-up is optional; WebGPURenderer.compile is compileAsync (returns a promise)
    try { Promise.resolve(world.renderer.compileAsync?.(world.scene, world.camera)).catch(() => {}); } catch { /* ignore */ }
    events.emit('load:done', { location, placeholder: usedPlaceholder });
    return active;
  }

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.userData?.character) o.userData.character.dispose();
      if (o.userData?.disposeLabel) { o.userData.disposeLabel(); return; }
      if (o.geometry && !o.isSprite && !o.geometry.userData?.shared) o.geometry.dispose(); // sprites: shared quad (see top)
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        if (m.userData?.shared) continue;
        for (const v of Object.values(m)) if (v && v.isTexture && !v.userData?.shared) v.dispose();
        m.dispose();
      }
    });
  }

  function unload() {
    if (!active) return;
    try { active.res.dispose?.(); } catch (e) { console.error('[scene] dispose() threw', e); }
    world.scene.remove(active.root);
    disposeTree(active.root);
    active = null;
  }

  return { load, unload, get active() { return active; } };
}

export function countStats(root) {
  let meshes = 0, tris = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry; if (!g) return;
    tris += g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
  });
  return { meshes, tris: Math.round(tris) };
}
