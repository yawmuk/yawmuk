// Renderer, camera, lighting presets (HDRI image-based lighting + sun), post-processing, quality tiers, frame loop.
//
// three.js WebGPURenderer (r186): WebGPU when available, automatic WebGL2 fallback (Safari/iOS/older browsers).
// Force the WebGL2 backend with ?renderer=webgl. world.backend = 'webgpu' | 'webgl2' (also <html data-renderer>).
// createWorld() is async: the renderer must finish init() before PMREM / the first frame.
//
// Quality tiers (auto-detected; override with ?quality=low|medium|high or world.setQuality(tier), persisted):
//   low    — phones / software GPUs: no post-processing (renderer tone mapping + native MSAA), shadow map 1024,
//            pixel ratio ≤ 1.25, simple environment
//   medium — integrated GPUs: half-resolution GTAO, bloom, SMAA, shadow map 2048, pixel ratio ≤ 1.5
//   high   — discrete GPUs: full GTAO, bloom, SMAA, vignette, shadow map 2048 (PCF), pixel ratio ≤ 2
//   medium/high also get the "miniature" tilt-shift blur and a warm split-tone grade (golden-hour key art).
//   medium/high on the WebGPU backend also get sun light shafts (GodraysNode shadow-map raymarch + radial sun streaks
//   from the visible sun disc; medium = cheaper), strength per LIGHT_PRESETS[].shafts. WebGL2 renders without them.
// Post-processing is a TSL RenderPipeline:
//   pass(scene,camera)+MRT(output,normal) -> ×GTAO -> +light shafts -> tilt-shift band blur -> +bloom -> renderOutput (ACES+sRGB)
//   -> warm split-tone, saturation, contrast -> vignette (high) -> SMAA
import * as THREE from 'three/webgpu';
import {
  pass, mrt, output, normalView, renderOutput, saturation, luminance, mix, smoothstep, vec3, vec4, float,
  screenUV, abs, length, uniform, vec2, int, perspectiveDepthToViewZ
} from 'three/tsl';
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js';
import { denoise } from 'three/examples/jsm/tsl/display/DenoiseNode.js';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { smaa } from 'three/examples/jsm/tsl/display/SMAANode.js';
import { gaussianBlur } from 'three/examples/jsm/tsl/display/GaussianBlurNode.js';
import { godrays } from 'three/examples/jsm/tsl/display/GodraysNode.js';
import { radialBlur } from 'three/examples/jsm/tsl/display/radialBlur.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadEnvironment } from './assets.js';
import { events } from './events.js';
import { GOLDEN } from './goldenSky.js';

// Sky/fog colours, sun and image-based lighting per preset. `hdri` = catalog id of the environment map
// (public/assets/env/hdri); `env` = its intensity. Scenes can override the HDRI with `environment` in build().
export const LIGHT_PRESETS = {
  day: { bg: '#bfe0f2', fog: '#cfe6f2', fogNear: 35, fogFar: 110, hemiSky: '#e8f3ff', hemiGround: '#7a6a55', hemi: 0.25, sun: '#fff2dc', sunI: 2.4, sunDir: [0.55, 1, 0.35], exposure: 0.92, hdri: 'hdri_snow_day', env: 0.5, shafts: 0.25 },
  evening: { bg: '#e9a873', fog: '#d99a72', fogNear: 28, fogFar: 95, hemiSky: '#ffd3a8', hemiGround: '#4b3a4a', hemi: 0.25, sun: '#ff9a5a', sunI: 2.0, sunDir: [0.9, 0.42, 0.25], exposure: 0.95, hdri: 'hdri_suburb_dusk', env: 0.5, shafts: 0.55 },
  // golden hour (the key art): low warm sun from one side -> long shadows, peach haze, olive bounce light.
  // Default for every scene via config.LIGHTING; shadowHalf widens the shadow frustum for the long shadows.
  golden: { bg: GOLDEN.horizon, fog: GOLDEN.horizon, fogNear: 42, fogFar: 160, hemiSky: '#ffcf9a', hemiGround: '#4c5a2a', hemi: 0.3, sun: '#ffb26b', sunI: 3.5, sunDir: GOLDEN.sunDir, exposure: 0.92, hdri: 'hdri_suburb_dusk', env: 0.42, shadowHalf: 20, shafts: 0.65 },
  night: { bg: '#0e1630', fog: '#121b36', fogNear: 20, fogFar: 75, hemiSky: '#5a6c9e', hemiGround: '#151824', hemi: 0.3, sun: '#a9bcff', sunI: 0.8, sunDir: [-0.4, 1, 0.3], exposure: 1.1, hdri: 'hdri_city_night', env: 0.55, shafts: 0.15 }
};
/** Named environments scenes may request with `environment: { hdri: 'studio' }` (or any catalog id/path). */
export const HDRIS = { snow_day: 'hdri_snow_day', suburb_day: 'hdri_suburb_day', suburb_dusk: 'hdri_suburb_dusk', city_night: 'hdri_city_night', ballroom: 'hdri_ballroom', studio: 'hdri_studio' };

/** Layer for world labels. Kept for importers; labels now render in the main pass (layer enabled on the camera). */
export const OVERLAY_LAYER = 1;

export const QUALITY_TIERS = {
  low: { post: false, ao: false, bloom: false, shadow: 1024, pixelRatio: 1.25, smaa: false, lightCharacters: true },
  medium: { post: true, ao: 'half', bloom: true, shadow: 2048, pixelRatio: 1.5, smaa: true, tiltShift: 'small', godrays: 'half' },
  high: { post: true, ao: 'full', bloom: true, shadow: 2048, pixelRatio: 2, smaa: true, vignette: true, tiltShift: 'medium', godrays: 'full' }
};
const QKEY = 'yawmuk.quality';

// World labels (kit.makeLabel: SpriteMaterial with toneMapped:false) write a 'label' mask into the scene pass MRT,
// so the pipeline can put their untouched colours back after AO/tilt-shift/bloom/tone mapping/grade (crisp text,
// like the old post-tone-mapping overlay pass, without a second scene render). Other sprites (smoke puffs) are
// tone mapped and keep mrtNode = null. NodeMaterial conversion copies enumerable (incl. inherited) properties.
// Only while a pipeline with the 'label' attachment is active: a material MRT on the plain (low tier) path would
// replace the colour output of the renderer's internal framebuffer target.
const LABEL_MRT = mrt({ label: output.a });
let labelMask = false;
if (!Object.prototype.hasOwnProperty.call(THREE.SpriteMaterial.prototype, 'mrtNode')) {
  Object.defineProperty(THREE.SpriteMaterial.prototype, 'mrtNode', {
    enumerable: true, configurable: true,
    get() { return labelMask && this.toneMapped === false ? LABEL_MRT : null; },
    set(v) { Object.defineProperty(this, 'mrtNode', { value: v, writable: true, enumerable: true, configurable: true }); }
  });
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render|mesa offscreen|lavapipe/i;
const INTEGRATED_GPU = /intel|uhd|iris|mali|adreno|powervr|apple/i;

async function detectTier(renderer, isMobile) {
  if (isMobile) return 'low';
  let gpu = '';
  try {
    const gl = renderer.backend?.gl;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } else if (renderer.backend?.isWebGPUBackend) {
      const info = renderer.backend.device?.adapterInfo || (await navigator.gpu?.requestAdapter?.({ powerPreference: 'high-performance' }))?.info;
      if (info) {
        if (info.isFallbackAdapter) return 'low';
        gpu = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' ');
      }
    }
  } catch { /* ignore */ }
  if (SOFTWARE_GPU.test(gpu)) return 'low';
  if (INTEGRATED_GPU.test(gpu) && !/\barc\b/i.test(gpu)) return 'medium';
  return 'high';
}

export async function createWorld(canvas) {
  const params = new URLSearchParams(location.search);
  const isMobile = matchMedia('(pointer: coarse)').matches || /Mobi|Android/i.test(navigator.userAgent);
  let saved = null;
  try { saved = localStorage.getItem(QKEY); } catch { /* storage may be blocked */ }
  const forced = ['low', 'medium', 'high'].includes(params.get('quality')) ? params.get('quality') : ['low', 'medium', 'high'].includes(saved) ? saved : null;
  const preTier = forced || (isMobile ? 'low' : null);
  // native MSAA only on the low tier (the post-processing tiers use SMAA)
  const renderer = new THREE.WebGPURenderer({
    canvas, antialias: preTier === 'low', powerPreference: 'high-performance', stencil: false,
    forceWebGL: params.get('renderer') === 'webgl'
  });
  await renderer.init();
  const backend = renderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';
  document.documentElement.dataset.renderer = backend;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.info.autoReset = false; // count every pass of a frame (reset once per frame below)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = forced || await detectTier(renderer, isMobile);
  const auto = !forced;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#cfe6f2', 35, 110);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  camera.position.set(0, 4, 8);
  camera.layers.enable(OVERLAY_LAYER); // labels draw in the main pass

  const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.castShadow = true;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.025;
  let SH = 16; // shadow frustum half-size (m), follows the player (presets may widen it: golden's long shadows)
  const setShadowHalf = (h) => {
    SH = h;
    Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 0.5, far: 90 });
    sun.shadow.camera.updateProjectionMatrix();
  };
  setShadowHalf(16);
  scene.add(sun, sun.target);

  // ---------------------------------------------------------------- environment (IBL)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  roomEnv.userData.shared = true;
  scene.environment = roomEnv;
  let envToken = 0;
  /** Use an HDRI (catalog id / short name / path) as image-based lighting; falls back to RoomEnvironment. */
  async function setEnvironment(id, intensity = 0.7, { background = false, blur = 0.25 } = {}) {
    const my = ++envToken;
    scene.environmentIntensity = intensity;
    if (!id) { scene.environment = roomEnv; return roomEnv; }
    try {
      const tex = await loadEnvironment(renderer, HDRIS[id] || id);
      if (my !== envToken) return tex;
      scene.environment = tex;
      if (background) { scene.background = tex; scene.backgroundBlurriness = blur; scene.backgroundIntensity = intensity; }
      return tex;
    } catch (e) {
      console.warn('[world] HDRI failed, using RoomEnvironment', e?.message || e);
      if (my === envToken) scene.environment = roomEnv;
      return roomEnv;
    }
  }

  let sunDir = new THREE.Vector3(0.5, 1, 0.3).normalize();
  let skySunDir = sunDir.clone();
  const shaftK = uniform(0.5); // light-shaft strength of the current preset (live uniform for the pipeline)
  /** Apply a lighting preset (sync part) and start loading its HDRI (returns a promise). */
  function applyLights(name, env = null) {
    const p = LIGHT_PRESETS[name] || LIGHT_PRESETS.day;
    scene.background = new THREE.Color(p.bg);
    scene.backgroundBlurriness = 0;
    scene.fog.color.set(p.fog); scene.fog.near = p.fogNear; scene.fog.far = p.fogFar;
    hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); hemi.intensity = p.hemi;
    sun.color.set(p.sun); sun.intensity = p.sunI;
    sunDir = new THREE.Vector3(...p.sunDir).normalize();
    shaftK.value = p.shafts ?? 0.5;
    // where the sun is SEEN (golden: the disc rests on the horizon, below the ~21° light) -> centre of the sun streaks
    skySunDir = p === LIGHT_PRESETS.golden
      ? new THREE.Vector3(Math.cos(GOLDEN.sunEl) * Math.cos(GOLDEN.sunAz), Math.sin(GOLDEN.sunEl), Math.cos(GOLDEN.sunEl) * Math.sin(GOLDEN.sunAz))
      : sunDir.clone();
    if ((p.shadowHalf || 16) !== SH) setShadowHalf(p.shadowHalf || 16);
    renderer.toneMappingExposure = p.exposure; // live uniform: used by renderOutput() in the pipeline too
    const e = env && typeof env === 'object' ? env : {};
    return setEnvironment(e.hdri ?? p.hdri, e.intensity ?? p.env, { background: !!e.background, blur: e.blur ?? 0.25 });
  }

  const texel = () => (SH * 2) / sun.shadow.mapSize.x;
  const tmp = new THREE.Vector3();
  /** Keep the single shadow frustum centred on `focus`, snapped to texels to avoid shimmering. */
  function followShadow(focus) {
    const t = texel();
    tmp.set(Math.round(focus.x / t) * t, 0, Math.round(focus.z / t) * t);
    sun.target.position.copy(tmp);
    sun.position.copy(tmp).addScaledVector(sunDir, 45);
    sun.target.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- post-processing (TSL RenderPipeline)
  let pipeline = null;
  let pipelineNodes = []; // pass/effect nodes that own render targets (RenderPipeline.dispose() does not free them)
  const _sunProj = new THREE.Vector3();
  let godPending = false, shadowRT = null; // light shafts wanted but the sun's shadow map does not exist yet -> rebuild after a frame
  function setLabelMask(on) {
    if (labelMask === on) return;
    labelMask = on; // rebuild the label materials so they pick up / drop the label MRT output
    scene.traverse((o) => { if (o.isSprite && o.material?.toneMapped === false) o.material.needsUpdate = true; });
  }
  function buildPipeline() {
    disposePipeline();
    godPending = false;
    // applyTier() drops sun.shadow.map on a shadow size change, but the WebGPU ShadowNode keeps rendering into the
    // same (re-allocated, resized) target and never re-assigns it -> keep a handle so the light shafts can find it
    if (sun.shadow.map) shadowRT = sun.shadow.map; else if (shadowRT) sun.shadow.map = shadowRT;
    const Q = QUALITY_TIERS[tier];
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    setLabelMask(!!Q.post);
    if (!Q.post) return; // low: plain renderer.render() with renderer tone mapping
    pipeline = new THREE.RenderPipeline(renderer);
    pipeline.outputColorTransform = false; // tone mapping + sRGB happen in renderOutput() below, before grade/SMAA

    const scenePass = pass(scene, camera);
    const own = (n) => { pipelineNodes.push(n); return n; };
    own(scenePass);
    const outs = { output, label: float(0) };
    // normals for GTAO; alpha = material alpha so transparent meshes (light shafts) blend instead of overwriting
    if (Q.ao) outs.normal = vec4(normalView, output.a);
    const sceneMRT = mrt(outs);
    if (Q.ao) sceneMRT.setBlendMode('normal', new THREE.BlendMode(THREE.MaterialBlending));
    scenePass.setMRT(sceneMRT);
    scenePass.getTexture('label').type = THREE.UnsignedByteType;
    const sceneColor = scenePass.getTextureNode('output');
    let color = sceneColor;
    if (Q.ao) {
      const depth = scenePass.getTextureNode('depth'), normal = scenePass.getTextureNode('normal');
      const aoNode = own(ao(depth, normal, camera));
      const half = Q.ao === 'half';
      aoNode.resolutionScale = half ? 0.5 : 1;
      aoNode.samples.value = half ? 8 : 12;
      aoNode.radius.value = 0.6;
      aoNode.distanceFallOff.value = 0.8;
      aoNode.scale.value = 1.2;
      const aoTex = own(denoise(aoNode.getTextureNode(), depth, normal, camera));
      color = vec4(color.rgb.mul(aoTex.r), color.a);
    }
    // volumetric light shafts (WebGPU only): per pixel, raymarch the view ray through the sun's shadow map ->
    // warm in-scattered light where the ray crosses sunlit air, dark gaps behind trees and buildings.
    // GodraysNode reads sun.shadow.map at build time, which only exists after a frame -> built lazily (frame()).
    if (Q.godrays && renderer.backend?.isWebGPUBackend) {
      if (!sun.shadow.map?.depthTexture) godPending = true;
      else {
        const half = Q.godrays === 'half';
        const g = own(godrays(scenePass.getTextureNode('depth'), camera, sun));
        g.resolutionScale = half ? 0.35 : 0.5;
        g.raymarchSteps.value = half ? 32 : 48;
        g.density.value = 2.0;
        g.maxDensity.value = 0.45;
        g.distanceAttenuation.value = 1;
        const shafts = own(gaussianBlur(g.getTextureNode(), null, 2, { resolutionScale: 0.5 }));
        // forward scattering: shafts glow most when looking towards the sun (sun projected to screen each frame)
        // sunScr = (u, v) of the visible sun on screen + z = how much the camera faces it (0 = sun behind)
        // (frame.camera is the pipeline's quad camera here -> project with the scene camera)
        const sunScr = uniform(new THREE.Vector3(0.5, -1, 0));
        sunScr.onFrameUpdate(() => {
          const facing = THREE.MathUtils.smoothstep(camera.getWorldDirection(_sunProj).dot(skySunDir), 0.05, 0.55);
          const v = _sunProj.copy(camera.position).addScaledVector(skySunDir, 100).project(camera);
          sunScr.value.set((v.x + 1) / 2, (1 - v.y) / 2, v.z > 1 ? 0 : facing);
        });
        const sunUV = sunScr.xy, sunDist = length(screenUV.sub(sunUV).mul(vec2(1.6, 1)));
        const phase = mix(float(0.08), float(1.0), smoothstep(1.3, 0.0, sunDist).mul(sunScr.z));
        const warm = uniform(sun.color).mul(shaftK).mul(half ? 0.55 : 1); // medium: lighter (coarser buffers)
        color = vec4(color.rgb.add(warm.mul(phase).mul(shafts.r)), color.a);
        // sun streaks: the bright sky (and far field) around the visible sun, radially smeared from it -> rays cut by
        // tree, roof and minaret silhouettes (near geometry = occluder)
        const near = smoothstep(1.0, 0.0, sunDist).mul(sunScr.z);
        const far = smoothstep(90, 180, perspectiveDepthToViewZ(scenePass.getTextureNode('depth'), float(camera.near), float(camera.far)).negate());
        const src = sceneColor.rgb.mul(smoothstep(0.3, 1.2, luminance(sceneColor.rgb))).mul(near).mul(far);
        const mask = own(gaussianBlur(vec4(src, 1), null, 1, { resolutionScale: half ? 0.25 : 0.5 }));
        const rays = radialBlur(mask.getTextureNode(), { center: sunUV, weight: float(0.9), decay: float(0.972), count: int(half ? 24 : 48), exposure: float(3.2) });
        color = vec4(color.rgb.add(rays.rgb.mul(warm)), color.a);
      }
    }
    // "miniature" tilt-shift: sharp horizontal band around the player, blur grows to the top and bottom
    if (Q.tiltShift) {
      const blurred = own(gaussianBlur(color, null, Q.tiltShift === 'small' ? 3 : 4, { resolutionScale: 0.5 }));
      const band = smoothstep(0.2, 0.45, abs(screenUV.y.sub(0.55)));
      color = mix(color, blurred, band);
    }
    if (Q.bloom) {
      const b = own(bloom(sceneColor, 0.32, 0.35, 0.9));
      if (Q.ao === 'half') b.setResolutionScale(0.5);
      color = vec4(color.rgb.add(b.rgb), color.a);
    }
    let out = renderOutput(color, THREE.ACESFilmicToneMapping, THREE.SRGBColorSpace);
    // warm split-tone grade: cool-violet shadows, honey highlights
    const l = luminance(out.rgb);
    let rgb = out.rgb.mul(mix(vec3(0.95, 0.94, 1.05), vec3(1.06, 1.0, 0.9), smoothstep(0.08, 0.7, l)));
    rgb = saturation(rgb, 1.16);
    rgb = rgb.sub(0.5).mul(1.11).add(0.5).clamp(0, 1);
    if (Q.vignette) {
      const d = length(screenUV.sub(0.5)).mul(1.4142);
      rgb = rgb.mul(float(1).sub(smoothstep(0.35, 1.05, d).mul(0.38)));
    }
    // labels: original (not tone mapped, not blurred) colours, sRGB-encoded
    const crisp = renderOutput(sceneColor, THREE.NoToneMapping, THREE.SRGBColorSpace);
    rgb = mix(rgb, crisp.rgb, scenePass.getTextureNode('label').r);
    out = vec4(rgb, 1);
    pipeline.outputNode = Q.smaa ? own(smaa(out)) : out;
  }
  function disposePipeline() {
    if (pipeline) pipeline.dispose();
    for (const n of pipelineNodes) {
      try {
        // gaussianBlur()/smaa() wrap a non-texture input in an implicit RTTNode (own render target) — free it too
        if (n.textureNode?.isRTTNode) n.textureNode.dispose();
        n.dispose?.();
      } catch { /* ignore */ }
    }
    pipelineNodes = [];
    pipeline = null;
  }

  function applyTier() {
    const Q = QUALITY_TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
    if (sun.shadow.mapSize.x !== Q.shadow) {
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      sun.shadow.map?.dispose(); sun.shadow.map = null;
    }
    buildPipeline();
    resize();
    document.documentElement.dataset.quality = tier;
    events.emit('quality:apply', { tier, ...Q });
  }

  /** Switch the quality tier at runtime ('low'|'medium'|'high'); persists unless { persist:false }. */
  function setQuality(t, { persist = true } = {}) {
    if (!QUALITY_TIERS[t]) return tier;
    tier = t;
    if (persist) { try { localStorage.setItem(QKEY, t); } catch { /* ignore */ } }
    applyTier();
    events.emit('quality', { tier, auto: !persist && auto });
    return tier;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 68 : 55; // wider FOV in portrait (phones)
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  applyTier();
  applyLights('day', { hdri: null }); // boot: neutral room environment until a scene picks its HDRI

  // ---------------------------------------------------------------- frame loop (+ adaptive downgrade when auto)
  const tickers = new Set();
  const timer = new THREE.Timer(); // THREE.Clock is deprecated in r186
  let elapsed = 0, running = true;
  let slow = 0, frames = 0, acc = 0;
  const stats = { fps: 0, frameMs: 0 };
  function frame() {
    if (!running) return;
    timer.update();
    const raw = timer.getDelta();
    const dt = Math.min(raw, 0.05);
    elapsed += dt;
    tickers.forEach((fn) => { try { fn(dt, elapsed); } catch (e) { console.error('[tick]', e); } });
    renderer.info.reset();
    if (pipeline) pipeline.render();
    else renderer.render(scene, camera);
    if (godPending && sun.shadow.map?.depthTexture) buildPipeline();
    frames++; acc += raw;
    if (acc >= 1) {
      stats.fps = frames / acc; stats.frameMs = (acc / frames) * 1000;
      // auto tier: 4 consecutive seconds under 28 fps -> step down once per tier
      if (auto && !document.hidden && stats.fps < 28 && tier !== 'low') { if (++slow >= 4) { slow = 0; setQuality(tier === 'high' ? 'medium' : 'low', { persist: false }); } } else slow = 0;
      frames = 0; acc = 0;
    }
  }
  renderer.setAnimationLoop(frame);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; timer.update(); });

  return {
    renderer, scene, camera, hemi, sun, isMobile, backend,
    applyLights, setEnvironment, followShadow, setQuality,
    get quality() { return tier; }, get qualityAuto() { return auto; }, stats,
    get composer() { return pipeline; },
    get pipeline() { return pipeline; },
    onTick: (fn) => { tickers.add(fn); return () => tickers.delete(fn); },
    time: () => elapsed
  };
}
