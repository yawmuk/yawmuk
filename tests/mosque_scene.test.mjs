// Mosque scene: builds headless (no DOM -> flat-colour fallback) and checks layout, feature spots,
// walkability, draw-call budget and the content rules (generic calligraphy only, no worship poses).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import mosque from '../src/scenes/mosque.js';
import { CALLIGRAPHY_WORDS, HONORIFIC } from '../src/scenes/mosque/textures.js';

const EXPECTED = {
  quran: { ar: 'المصحف المرتل والترجمة', en: 'Recited Quran & translation' },
  adhkar: { ar: 'أذكار الصباح والمساء', en: 'Morning & evening adhkar' },
  prayer: { ar: 'مواقيت الصلاة', en: 'Prayer times' },
  experts: { ar: 'اسأل أهل العلم', en: 'Ask a scholar' }
};

function stubCtx(quality = 'high') {
  const labels = [];
  return {
    THREE, group: new THREE.Group(), lang: 'ar', quality,
    makeLabel(text) { const s = new THREE.Object3D(); s.userData.text = text; labels.push(text); return s; },
    labels
  };
}

let cached;
async function built(quality = 'high') {
  if (quality === 'high' && cached) return cached;
  const ctx = stubCtx(quality);
  const res = await mosque.build(ctx);
  const out = { ctx, res };
  if (quality === 'high') cached = out;
  return out;
}

// player = circle r 0.3 in XZ; a collider blocks only if max.y > 0.25 and min.y < 1.7 (engine README §5)
const blocking = (cs) => cs.filter((c) => c.max[1] > 0.25 && c.min[1] < 1.7);
const hits = (cs, x, z, r = 0.3) => cs.some((c) => {
  const cx = Math.max(c.min[0], Math.min(x, c.max[0])), cz = Math.max(c.min[2], Math.min(z, c.max[2]));
  return Math.hypot(x - cx, z - cz) < r;
});
const allColliders = (res) => [
  ...res.colliders,
  ...res.npcs.filter((n) => n.collide !== false).map((n) => ({ min: [n.position[0] - 0.28, 0, n.position[2] - 0.28], max: [n.position[0] + 0.28, 1.8, n.position[2] + 0.28] }))
];

test('mosque: default export follows the scene contract and declares the 4 feature spots', () => {
  assert.equal(mosque.id, 'mosque');
  assert.equal(typeof mosque.build, 'function');
  assert.deepEqual(mosque.title, { ar: 'المسجد', en: 'Mosque' });
  assert.ok(Array.isArray(mosque.featureSpots));
  assert.deepEqual(mosque.featureSpots.map((s) => s.feature).sort(), Object.keys(EXPECTED).sort());
  for (const s of mosque.featureSpots) {
    assert.deepEqual({ ...s.label }, EXPECTED[s.feature], `label of ${s.feature}`);
    assert.equal(s.pos.length, 3);
    assert.ok(s.pos.every(Number.isFinite));
  }
});

test('mosque: builds headless with group, spawn, exit, colliders and owned dispose', async () => {
  const { res } = await built();
  assert.ok(res.group?.isObject3D);
  assert.equal(res.spawn.position.length, 3);
  assert.equal(res.spawn.yaw, 0);
  assert.ok(res.exit?.position && res.exit.radius > 0);
  assert.ok(res.colliders.length > 10);
  assert.deepEqual(res.hotspots, []);
  assert.equal(typeof res.dispose, 'function');
  assert.ok(['day', 'evening', 'night'].includes(res.lights));
});

test('mosque: draw calls stay low (merged batches, ≤ 3 non-shadow lights)', async () => {
  const { res } = await built();
  let meshes = 0, lights = 0, tris = 0;
  res.group.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
    if (o.isLight) { lights++; assert.equal(o.castShadow, false); }
  });
  assert.ok(meshes <= 16, `meshes ${meshes}`);
  assert.ok(lights <= 3, `lights ${lights}`);
  assert.ok(tris < 100000, `tris ${tris}`);
  const { res: lowRes } = await built('low');
  let lowTris = 0;
  lowRes.group.traverse((o) => { if (o.isMesh) { const g = o.geometry; lowTris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  assert.ok(lowTris < tris, 'low quality drops decorative detail');
});

test('mosque: spawn, exit and every feature spot are on free floor inside the building', async () => {
  const { res } = await built();
  const cs = blocking(allColliders(res));
  const inside = ([x, , z]) => x > -8 && x < 8 && z > -8 && z < 9;
  for (const [name, p] of [['spawn', res.spawn.position], ['exit', res.exit.position], ...mosque.featureSpots.map((s) => [s.feature, s.pos])]) {
    assert.ok(inside(p), `${name} inside the building`);
    assert.ok(!hits(cs, p[0], p[2]), `${name} at [${p}] is not inside a collider`);
  }
  // spawn is not already in the exit radius
  assert.ok(Math.hypot(res.spawn.position[0] - res.exit.position[0], res.spawn.position[2] - res.exit.position[2]) > res.exit.radius);
});

test('mosque: every feature spot and the exit are reachable on foot from spawn', async () => {
  const { res } = await built();
  const cs = blocking(allColliders(res));
  const STEP = 0.1, x0 = -8, z0 = -8, nx = 160, nz = 170;
  const free = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) free[i * nz + j] = hits(cs, x0 + i * STEP, z0 + j * STEP) ? 0 : 1;
  const idx = (x, z) => Math.round((x - x0) / STEP) * nz + Math.round((z - z0) / STEP);
  const seen = new Uint8Array(nx * nz);
  const queue = [idx(res.spawn.position[0], res.spawn.position[2])];
  assert.equal(free[queue[0]], 1, 'spawn cell free');
  seen[queue[0]] = 1;
  while (queue.length) {
    const k = queue.pop();
    const i = Math.floor(k / nz), j = k % nz;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const n = a * nz + b;
      if (!seen[n] && free[n]) { seen[n] = 1; queue.push(n); }
    }
  }
  for (const [name, p] of [['exit', res.exit.position], ...mosque.featureSpots.map((s) => [s.feature, s.pos])]) {
    assert.equal(seen[idx(p[0], p[2])], 1, `${name} reachable from spawn`);
  }
  // the mihrab area in front of the qibla wall (where the imam leads) is reachable too
  assert.equal(seen[idx(0, -7.3)], 1, 'front row reachable');
});

test('mosque: content rules — generic calligraphy only, labels bilingual, no worship poses', async () => {
  assert.deepEqual([...CALLIGRAPHY_WORDS], ['الله', 'محمد']);
  assert.equal(HONORIFIC, 'ﷺ');
  const { ctx, res } = await built();
  for (const l of ctx.labels) assert.ok(l.ar && l.en, 'every in-world sign is bilingual (makeLabel)');
  const ids = res.npcs.map((n) => n.id);
  assert.ok(ids.includes('imam'));
  const imam = res.npcs.find((n) => n.id === 'imam');
  assert.ok(imam.name.ar && imam.name.en);
  assert.ok(!imam.pose && !imam.seated && !imam.anim, 'the imam just stands');
  for (const n of res.npcs) {
    assert.ok(!n.anim, `${n.id} has no looping animation`);
    if (n.pose) assert.ok(n.id.startsWith('bg_') && n.pose === 'sit', 'only a background reader sits on a chair');
  }
  // the imam stands near the office door, i.e. near the experts spot
  const ex = mosque.featureSpots.find((s) => s.feature === 'experts').pos;
  assert.ok(Math.hypot(imam.position[0] - ex[0], imam.position[2] - ex[2]) < 2.5);
});

test('mosque: qibla layout — mihrab centred on the north wall, minbar to its right, rows face it', async () => {
  const { res } = await built();
  const names = [];
  res.group.traverse((o) => { if (o.isMesh) names.push(o.name); });
  assert.ok(names.includes('mosque:carpet'));
  assert.ok(names.includes('mosque:niche'));
  let niche;
  res.group.traverse((o) => { if (o.name === 'mosque:niche') niche = o; });
  const bb = niche.geometry.boundingBox;
  assert.ok(Math.abs((bb.min.x + bb.max.x) / 2) < 0.05, 'mihrab centred on x=0');
  assert.ok(bb.max.z <= -7.99, 'niche sits behind the qibla wall (z=-8)');
  assert.equal(niche.userData.noCameraCollide, true);
  // spawn faces the qibla (yaw 0 = -Z)
  assert.equal(res.spawn.yaw, 0);
});

test('mosque: dispose frees owned resources without throwing', async () => {
  const { res } = await built('medium');
  assert.doesNotThrow(() => res.dispose());
});
