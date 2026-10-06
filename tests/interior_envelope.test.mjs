import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import home from '../src/scenes/home.js';
import { addInteriorRoof } from '../src/scenes/interiorRoof.js';
import { INTERIOR_ANCHORS, TOWN_DOORS } from '../src/scenes/town.js';

test('interior roof blocks the camera from above and below with two draw calls', () => {
  const group = new THREE.Group();
  const roof = addInteriorRoof(THREE, group, { x0: -6, x1: 6, z0: -4.5, z1: 4.5, height: 2.7, name: 'test' });
  group.updateMatrixWorld(true);
  assert.equal(group.children.length, 2);
  assert.equal(roof.userData.cameraCollide, true);
  for (const [y, direction] of [[5, -1], [1.5, 1]]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(0, y, 0), new THREE.Vector3(0, direction, 0));
    assert.ok(ray.intersectObject(roof).length > 0);
  }
  group.traverse(o => { if(o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
});

test('interior entrances align with the actual town facade and face the street', () => {
  const entrances = { home: [4.5, 4.5], bank: [0, 6], mosque: [0, 9], work: [0, 6.1], school: [10, 0], public_events: [0, 8] };
  for (const [loc, [x, z]] of Object.entries(entrances)) {
    const a = INTERIOR_ANCHORS[loc], door = TOWN_DOORS.find(d => d.location === loc);
    const c = Math.cos(a.yaw), s = Math.sin(a.yaw);
    assert.ok(Math.abs(a.x + x * c + z * s - door.doorX) < 1e-8, loc);
    assert.ok(Math.abs(a.z - x * s + z * c - door.zFace) < 1e-8, loc);
  }
});

test('home scene imports its shared exterior layout successfully', () => {
  assert.equal(home.id, 'home');
  assert.equal(typeof home.build, 'function');
});
