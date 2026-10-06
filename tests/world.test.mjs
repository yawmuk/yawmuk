// Integrated neighbourhood (hub): config, hub helpers, and the town layout (doors/spawns/spots reachable).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LOCATIONS, LOCATION_TITLES, HUB, PLACES, ALL_LOCATIONS, isPlace, CATALOG } from '../src/engine/config.js';
import { normalizeDoors, normalizeFeatureSpots, doorSpawn, nextDestination, createFeatureRegistry } from '../src/engine/hub.js';
import town, { TOWN_DOORS, layoutOf } from '../src/scenes/town.js';

test('config: journey stops unchanged, hub + places registered separately', () => {
  assert.deepEqual(LOCATIONS, ['home', 'work', 'school', 'street', 'public_events', 'private_events']);
  assert.equal(HUB, 'town');
  assert.deepEqual(PLACES, ['town', 'mosque', 'bank']);
  assert.deepEqual(ALL_LOCATIONS, [...LOCATIONS, ...PLACES]);
  for (const loc of ALL_LOCATIONS) assert.ok(LOCATION_TITLES[loc]?.ar && LOCATION_TITLES[loc]?.en, `title for ${loc}`);
  assert.ok(isPlace('mosque') && isPlace('bank') && isPlace('town') && !isPlace('home'));
  // no situation belongs to a place; the 7-situation catalog is untouched
  assert.equal(CATALOG.length, 7);
  assert.ok(CATALOG.every((c) => LOCATIONS.includes(c.location)));
});

test('hub: doors are validated and default spawns are sane', () => {
  const warns = [];
  const doors = normalizeDoors([
    { location: 'school', position: [1, 0, 2] },
    { location: 'nowhere', position: [0, 0, 0] },
    { location: 'school', position: [5, 0, 5] },
    { to: 'mosque', position: [3, 4], spawn: { position: [3, 0, 6], yaw: 1 } }
  ], ALL_LOCATIONS, (w) => warns.push(w));
  assert.deepEqual(doors.map((d) => d.location), ['school', 'mosque']);
  assert.equal(warns.length, 2);
  assert.equal(doors[0].kind, 'door');
  assert.deepEqual(doors[1].position, [3, 0, 4]);
  assert.deepEqual(doorSpawn(doors, 'mosque'), { position: [3, 0, 6], yaw: 1 });
  assert.equal(doorSpawn(doors, 'bank'), null);
  assert.ok(Math.hypot(doors[0].spawn.position[0] - 1, doors[0].spawn.position[2] - 2) > 1);
});

test('hub: feature spots need a valid feature name', () => {
  const warns = [];
  const spots = normalizeFeatureSpots([{ feature: 'prayer', pos: [1, 0, 1], label: { ar: 'أ', en: 'a' } }, { feature: '../evil' }, null, { pos: [0, 0, 0] }], (w) => warns.push(w));
  assert.equal(spots.length, 1);
  assert.equal(spots[0].kind, 'spot');
  assert.equal(warns.length, 3);
});

test('hub: next destination follows the planned order and skips finished stops', () => {
  const done = new Set(['home', 'work']);
  assert.equal(nextDestination(['home', 'work', 'school', 'street'], (l) => done.has(l)), 'school');
  assert.equal(nextDestination(['home'], () => true), null);
  assert.equal(nextDestination(null, () => false), null);
});

test('hub: feature registry resolves present modules and fails gracefully', async () => {
  const reg = createFeatureRegistry({
    '../features/prayer/index.js': async () => ({ open: () => () => {} }),
    '../features/broken/index.js': async () => { throw new Error('boom'); },
    '../features/x/other.js': async () => ({})
  });
  assert.deepEqual(reg.names().sort(), ['broken', 'prayer']);
  assert.ok(reg.has('prayer') && !reg.has('guide'));
  assert.equal(typeof (await reg.load('prayer')).open, 'function');
  assert.equal(await reg.load('guide'), null);
  const orig = console.error; console.error = () => {};
  try { assert.equal(await reg.load('broken'), null); } finally { console.error = orig; }
});

// ---- the town scene itself, built headless with real three.js
function buildTown() {
  const group = new THREE.Group();
  const ctx = { THREE, group, quality: 'high', mats: {}, makeLabel: () => new THREE.Object3D() };
  const res = town.build(ctx);
  return { res, group };
}
const inside = (p, c, r = 0.3) => p[0] > c.min[0] - r && p[0] < c.max[0] + r && p[2] > c.min[2] - r && p[2] < c.max[2] + r;
const blocking = (c) => c.max[1] > 0.25 && c.min[1] < 1.7;

test('town: one door per non-hub location, each reachable and with a free spawn', () => {
  const { res } = buildTown();
  const want = ALL_LOCATIONS.filter((l) => l !== HUB).sort();
  assert.deepEqual(res.doors.map((d) => d.location).sort(), want);
  assert.equal(res.exit, null, 'the hub has doors instead of an exit');
  const cols = res.colliders.filter(blocking);
  for (const d of res.doors) {
    // the door point itself may touch the facade, but a spot within its radius must be standable
    const free = [[0, 0], [0, 0.6], [0, -0.6], [0.6, 0], [-0.6, 0]].some(([dx, dz]) => {
      const p = [d.position[0] + dx, 0, d.position[2] + dz];
      return !cols.some((c) => inside(p, c));
    });
    assert.ok(free, `door ${d.location} is reachable`);
    const sp = d.spawn.position;
    assert.ok(!cols.some((c) => inside(sp, c)), `spawn outside ${d.location} is not inside a collider`);
    assert.ok(Math.hypot(sp[0] - d.position[0], sp[2] - d.position[2]) > d.radius, `spawn outside ${d.location} is outside the door radius`);
  }
  assert.deepEqual(TOWN_DOORS.map((d) => d.location).sort(), want);
});

test('town: feature spots and the start spawn are free; layout stays within the outdoor budget', () => {
  const { res, group } = buildTown();
  const cols = res.colliders.filter(blocking);
  assert.ok(!cols.some((c) => inside(res.spawn.position, c)), 'start spawn is free');
  const spots = town.featureSpots;
  assert.ok(spots.length >= 3 && spots.some((s) => s.feature === 'guide') && spots.some((s) => s.feature === 'prayer'));
  for (const s of spots) assert.ok(!cols.some((c) => inside(s.pos, c, 0)), `spot ${s.feature} not inside a collider`);
  const bb = new THREE.Box3().setFromObject(group);
  assert.ok(bb.max.x - bb.min.x <= 66 && bb.max.z - bb.min.z <= 46, 'town footprint ~60 m across');
  let tris = 0, meshes = 0;
  group.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  assert.ok(meshes <= 8, `static geometry is merged (${meshes} meshes)`);
  assert.ok(tris < 100000, `triangle budget (${Math.round(tris)})`);
  assert.ok(res.npcs.every((n) => n.id.startsWith('bg_')), 'town people are background extras (1 draw call each)');
  res.dispose();
});

test('town: layoutOf puts north-row doors on the south side of the facade and vice versa', () => {
  const n = layoutOf({ x: 0, side: 'n', d: 8 });
  const s = layoutOf({ x: 0, side: 's', d: 8 });
  assert.ok(n.door[2] > n.zFace && s.door[2] < s.zFace);
  assert.ok(Math.abs(n.spawn.position[2]) < Math.abs(n.door[2]));
});
