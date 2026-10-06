// Procedural surface detail for the batched, vertex-coloured town (TSL, no texture files).
// Each factory returns a MeshStandardNodeMaterial whose colour is the batch's vertex colour × an in-shader variation
// in world space; when `THREE` has no node materials (headless tests with plain 'three') it returns the plain
// MeshStandardMaterial the scene used before, so geometry/tests never depend on the GPU path.
// Vertex colours are linear (THREE.Color converts sRGB hex), so every threshold below is in linear space.
import {
  vertexColor, positionWorld, normalWorld, vec2, vec3, float, max, min, mix, smoothstep, saturate,
  fract, floor, hash, fwidth, dot, luminance, mx_noise_float, mx_fractal_noise_float
} from 'three/tsl';

const make = (THREE, params) => new (THREE.MeshStandardNodeMaterial ?? THREE.MeshStandardMaterial)({ vertexColors: true, ...params });

/** 1 while a pattern of `freq` cycles/metre spans several pixels, fading to 0 before it would alias. */
const aa = (fw, freq) => saturate(float(1).sub(fw.mul(freq).mul(3)));

/** Rec. "saturation" proxy (max - min) / max of a linear colour. */
const satOf = (c) => max(c.r, max(c.g, c.b)).sub(min(c.r, min(c.g, c.b))).div(max(max(c.r, max(c.g, c.b)), 0.001));

/**
 * Ground (grass, asphalt, sidewalks, forecourts in ONE batch): the surface type is read from the vertex colour —
 * green-dominant → lawn (two-scale patches + dry-yellow hints + blade grain), dark grey → asphalt (fine grain +
 * darker patches), warm light → paving (slab joints + per-slab tint). Other colours (markings, soil) pass through.
 */
export function groundMaterial(THREE, { roughness = 0.95 } = {}) {
  const m = make(THREE, { roughness });
  if (!m.isNodeMaterial) return m;
  m.vertexColors = false;                     // colorNode reads the vertex colour itself (else it is multiplied in twice)
  const vc = vertexColor().rgb;
  const p = positionWorld, xz = p.xz;
  const fw = max(fwidth(p.x), fwidth(p.z));   // metres per pixel
  const lum = luminance(vc);
  const rb = vc.r.div(max(vc.b, 0.001));

  const grassW = smoothstep(0.015, 0.07, vc.g.sub(max(vc.r, vc.b)));
  const notGrass = float(1).sub(grassW);
  const asphaltW = notGrass.mul(smoothstep(0.14, 0.08, lum));
  const paveW = notGrass.mul(float(1).sub(asphaltW)).mul(smoothstep(1.2, 1.45, rb)).mul(smoothstep(3.0, 2.4, rb))
    .mul(smoothstep(0.16, 0.24, lum)).mul(smoothstep(0.74, 0.62, lum));

  // ---- lawn: big sunlit / shaded patches, mid clumps, dry-yellow hints, fine blade grain
  const big = mx_fractal_noise_float(vec3(xz.mul(0.075), 0.0), 3, 2, 0.5);
  const mid = mx_noise_float(xz.mul(0.55).add(vec2(13.1, 7.7)));
  const fine = mx_noise_float(xz.mul(3.2)).mul(aa(fw, 3.2));
  const blade = mx_noise_float(xz.mul(11.0).add(vec2(3.3, 9.1))).mul(aa(fw, 11.0));
  const lightG = vc.mul(vec3(1.45, 1.32, 0.95));
  const darkG = vc.mul(vec3(0.55, 0.68, 0.62));
  let grass = mix(darkG, lightG, saturate(big.mul(0.75).add(0.5).add(mid.mul(0.28))));
  const dryN = mx_noise_float(xz.mul(0.16).add(vec2(41.0, -17.0)));
  grass = mix(grass, vec3(0.34, 0.29, 0.075), smoothstep(0.2, 0.75, dryN).mul(0.5));
  grass = grass.mul(fine.mul(0.14).add(1)).mul(blade.mul(0.1).add(1));

  // ---- asphalt: fine aggregate grain, darker patched / oil areas, a few lighter worn areas
  const agg = mx_noise_float(xz.mul(14.0)).mul(aa(fw, 14.0));
  const agg2 = mx_noise_float(xz.mul(4.0).add(vec2(5.0, 1.0))).mul(aa(fw, 4.0));
  const patch = mx_fractal_noise_float(vec3(xz.mul(0.3), 3.7), 3, 2, 0.5);
  const asphalt = vc.mul(agg.mul(0.2).add(1)).mul(agg2.mul(0.1).add(1))
    .mul(mix(float(1), float(0.55), smoothstep(0.05, 0.45, patch)))
    .mul(mix(float(1), float(1.3), smoothstep(0.2, 0.6, patch.negate())));

  // ---- paving: 0.6 m slabs with soft dark joints, per-slab tint, a little wear
  const S = 0.6;
  const q = xz.div(S), cell = floor(q), f = fract(q);
  const edge = min(min(f.x, f.y), min(float(1).sub(f.x), float(1).sub(f.y))).mul(S);   // metres to the nearest joint
  const joint = float(1).sub(smoothstep(0.012, fw.mul(1.5).add(0.02), edge)).mul(smoothstep(0.04, 0.012, fw));
  const slab = hash(cell.x.mul(17.0).add(cell.y.mul(131.0)).add(20000.0));
  const wear = mx_noise_float(xz.mul(1.1).add(vec2(-3.0, 8.0)));
  const pave = vc.mul(slab.sub(0.5).mul(0.12).add(1)).mul(wear.mul(0.07).add(1)).mul(joint.mul(-0.2).add(1));

  let col = mix(vc, grass, grassW);
  col = mix(col, asphalt, asphaltW);
  col = mix(col, pave, paveW);
  m.colorNode = col;

  m.roughnessNode = float(roughness)
    .sub(asphaltW.mul(smoothstep(0.1, 0.6, patch)).mul(0.18))
    .sub(paveW.mul(0.07).mul(float(1).sub(joint)))
    .sub(grassW.mul(mid.mul(0.04)));
  return m;
}

/**
 * Building walls & props (the solid batch): large-scale plaster weathering + fine grain (less on saturated
 * paint like cars), a grime band and an ambient-occlusion-like darkening near the ground so buildings sit into it,
 * and a faint sky-lit lift higher up.
 */
export function wallMaterial(THREE, { roughness = 0.82 } = {}) {
  const m = make(THREE, { roughness });
  if (!m.isNodeMaterial) return m;
  m.vertexColors = false;
  const vc = vertexColor().rgb;
  const p = positionWorld;
  const fw = max(fwidth(p.x), max(fwidth(p.y), fwidth(p.z)));
  const weather = float(1).sub(smoothstep(0.45, 0.85, satOf(vc)).mul(0.7));         // painted metal / flowers: less

  const blot = mx_fractal_noise_float(p.mul(0.5), 3, 2, 0.5);
  const grain = mx_noise_float(p.mul(6.0)).mul(aa(fw, 6.0));
  const streak = mx_noise_float(vec3(p.x.mul(2.2), p.y.mul(0.18), p.z.mul(2.2)));   // vertical rain streaks
  let c = vc.mul(blot.mul(0.2).mul(weather).add(1)).mul(grain.mul(0.07).mul(weather).add(1))
    .mul(smoothstep(0.25, 0.8, streak).mul(-0.12).mul(weather).add(1));

  const y = p.y;
  const vertical = float(1).sub(normalWorld.y.abs());
  const aoW = vertical.mul(0.7).add(0.3);
  const ao = mix(float(0.58), float(1), smoothstep(0.0, 0.6, y));
  c = c.mul(mix(float(1), ao, aoW));
  // grime / rising damp: warm-dark band up to ~1 m with a noisy upper edge
  const grimeEdge = y.add(mx_noise_float(p.xz.mul(1.3)).mul(0.25));
  const grime = smoothstep(1.1, 0.25, grimeEdge).mul(0.22).mul(weather).mul(vertical);
  c = mix(c, c.mul(vec3(0.78, 0.72, 0.64)), grime);
  c = c.mul(mix(float(0.95), float(1.05), smoothstep(0.5, 9.0, y)));
  m.colorNode = c;
  m.roughnessNode = float(roughness).add(blot.mul(0.06));
  return m;
}

/**
 * Tree canopies: per-tree colour jitter (hash of a ~3 m world cell), leaf-clump dapples, and a warm wrap-lit
 * "subsurface" glow on the side facing the sun (emissive, small) so canopies glow at golden hour.
 * Returns the colour/emissive nodes on an existing node material (keeps its maskNode untouched).
 */
export function applyLeafSurface(m, { sunDir = [0.79, 0.36, 0.5], glow = 0.32 } = {}) {
  if (!m.isNodeMaterial) return m;
  m.vertexColors = false;
  const vc = vertexColor().rgb;
  const p = positionWorld;
  const cellH = hash(floor(p.x.div(3.2)).mul(71.0).add(floor(p.z.div(3.2)).mul(13.0)).add(5077.0));
  const cellH2 = hash(floor(p.x.div(3.2)).mul(29.0).add(floor(p.z.div(3.2)).mul(53.0)).add(5011.0));
  // jitter brightness ±14% and hue between yellow-green and blue-green
  let c = vc.mul(cellH.sub(0.5).mul(0.28).add(1));
  c = mix(c.mul(vec3(1.18, 1.06, 0.62)), c.mul(vec3(0.85, 0.98, 1.2)), cellH2);
  const clump = mx_noise_float(p.mul(1.7));
  const clump2 = mx_noise_float(p.mul(4.5).add(vec3(2.0, 5.0, 1.0)));
  c = c.mul(clump.mul(0.38).add(1)).mul(clump2.mul(0.14).add(1));
  m.colorNode = c;

  const len = Math.hypot(...sunDir);
  const sun = vec3(sunDir[0] / len, sunDir[1] / len, sunDir[2] / len);
  const wrap = saturate(dot(normalWorld, sun).add(0.35).div(1.35));
  m.emissiveNode = mix(c, vec3(1.0, 0.58, 0.18), 0.4).mul(wrap.mul(wrap)).mul(glow);
  return m;
}
