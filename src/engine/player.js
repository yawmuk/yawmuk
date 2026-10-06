// Third-person player "Adam": movement, AABB collision, follow/orbit camera.
import * as THREE from 'three';
import { makeNPC, animateFigure } from './kit.js';
import { charactersReady } from './characters.js';
import { PLAYER } from './config.js';

const RADIUS = 0.3;
const WALK = 2.3, RUN = 5.2; // m/s; the character's walk/run clips are time-scaled to match (no foot sliding)

function lerpAngle(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

export function createPlayer(world, input) {
  const make = (look) => { const f = makeNPC({ sex: 'male', hairStyle: 'short', ...look }, { name: 'Adam', idle: 'Idle', single: false, castShadow: true }); f.name = 'Adam'; return f; };
  let figure = make(PLAYER.look); // edit PLAYER in config.js to change Adam's look
  world.scene.add(figure);
  let lookKey = JSON.stringify(PLAYER.look);
  let isCharacter = !!figure.userData.character;

  /** Rebuild Adam with a look (PLAYER.look merged with a scene's optional playerLook). No-op if unchanged. */
  function setLook(look) {
    const full = { ...PLAYER.look, ...(look || {}) };
    const key = JSON.stringify(full);
    if (key === lookKey && (isCharacter || !charactersReady())) return;
    lookKey = key;
    const next = make(full); // geometries/materials are shared+cached, nothing to dispose
    next.position.copy(figure.position); next.rotation.y = figure.rotation.y;
    figure.userData.character?.dispose();
    world.scene.remove(figure);
    world.scene.add(next);
    figure = next;
    isCharacter = !!figure.userData.character;
  }

  const pos = new THREE.Vector3();
  let yaw = 0, camYaw = 0, camPitch = 0.42, camDist = 5.2, speedNow = 0, dirX = 0, dirZ = -1;
  let colliders = [];
  let bounds = null; // {minX,maxX,minZ,maxZ}
  const camTarget = new THREE.Vector3();
  const desired = new THREE.Vector3();

  function setColliders(list, b) {
    colliders = (list || []).filter((c) => c && c.max[1] > 0.25 && c.min[1] < 1.7);
    bounds = b;
  }

  function teleport(p, y = 0) {
    pos.set(p[0] || 0, 0, p[2] || 0);
    yaw = y; camYaw = y;
    figure.position.copy(pos); figure.rotation.y = yaw;
    resolve();
    snapCamera();
  }

  function resolve() {
    for (let pass = 0; pass < 3; pass++) {
      for (const c of colliders) {
        const cxp = Math.max(c.min[0], Math.min(pos.x, c.max[0]));
        const czp = Math.max(c.min[2], Math.min(pos.z, c.max[2]));
        let dx = pos.x - cxp, dz = pos.z - czp;
        const d2 = dx * dx + dz * dz;
        if (d2 >= RADIUS * RADIUS) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = RADIUS - d;
          pos.x += (dx / d) * push; pos.z += (dz / d) * push;
        } else { // centre inside the box: push out along the shallowest axis
          const ox = [pos.x - c.min[0] + RADIUS, c.max[0] - pos.x + RADIUS];
          const oz = [pos.z - c.min[2] + RADIUS, c.max[2] - pos.z + RADIUS];
          const m = Math.min(...ox, ...oz);
          if (m === ox[0]) pos.x -= ox[0]; else if (m === ox[1]) pos.x += ox[1];
          else if (m === oz[0]) pos.z -= oz[0]; else pos.z += oz[1];
        }
      }
    }
    if (bounds) {
      pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x));
      pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z));
    }
  }

  // Camera occlusion: ray from the desired camera spot toward Adam against the scene's big meshes.
  // Raycasting honours material.side, so a single-sided (FrontSide) wall only blocks the camera when its
  // VISIBLE face points at the camera. Cut-away / dollhouse walls that are invisible from outside therefore
  // never pull the camera in, while normal and DoubleSide walls do. Opt a mesh out with userData.noCameraCollide.
  const ray = new THREE.Raycaster();
  const toTarget = new THREE.Vector3();
  let occluders = [];
  function setCameraOccluders(list) { occluders = list || []; }
  function computeCamera() {
    camTarget.set(pos.x, 1.45, pos.z);
    const cp = Math.cos(camPitch);
    desired.set(camTarget.x + Math.sin(camYaw) * camDist * cp, camTarget.y + Math.sin(camPitch) * camDist, camTarget.z + Math.cos(camYaw) * camDist * cp);
    if (!occluders.length) return;
    toTarget.subVectors(camTarget, desired);
    const dist = toTarget.length();
    toTarget.divideScalar(dist);
    ray.set(desired, toTarget);
    ray.far = dist - 0.25;
    ray.camera = world.camera; // needed if an occluder group contains sprites
    const hits = ray.intersectObjects(occluders, true).filter((h) => !h.object.isSprite);
    if (hits.length) {
      const last = hits[hits.length - 1]; // occluder closest to Adam
      desired.copy(last.point).addScaledVector(toTarget, 0.2);
    }
  }
  function snapCamera() { computeCamera(); world.camera.position.copy(desired); world.camera.lookAt(camTarget); }

  function update(dt, t) {
    const o = input.consumeOrbit();
    camYaw -= o.dx * 0.006;
    camPitch = Math.max(0.08, Math.min(1.25, camPitch + o.dy * 0.004));
    camDist = Math.max(2.4, Math.min(10, camDist + o.zoom * 0.5));
    const a = input.axes();
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let mx = fx * a.y + rx * a.x, mz = fz * a.y + rz * a.x;
    const mag = Math.hypot(mx, mz);
    const target = mag > 0.05 ? (a.run ? RUN : WALK) * Math.min(1, mag) : 0;
    speedNow += (target - speedNow) * Math.min(1, dt * 10);
    if (mag > 0.05) {
      mx /= mag; mz /= mag; dirX = mx; dirZ = mz;
      yaw = lerpAngle(yaw, Math.atan2(-mx, -mz), Math.min(1, dt * 12));
      if (a.y > 0.3 && o.dx === 0) camYaw = lerpAngle(camYaw, yaw, Math.min(1, dt * 1.2));
    }
    if (speedNow > 0.01) {
      pos.x += dirX * speedNow * dt; pos.z += dirZ * speedNow * dt;
      resolve();
    }
    figure.position.copy(pos);
    figure.rotation.y = yaw;
    const ch = figure.userData.character;
    if (ch) ch.setLocomotion(speedNow < 0.05 ? 0 : speedNow);
    else animateFigure(figure, t, Math.min(1, speedNow / WALK));
    computeCamera();
    world.camera.position.lerp(desired, 1 - Math.exp(-dt * 12));
    world.camera.lookAt(camTarget);
  }

  function faceTowards(p) { yaw = Math.atan2(-(p[0] - pos.x), -(p[2] - pos.z)); figure.rotation.y = yaw; figure.userData.character?.setLocomotion(0); speedNow = 0; }

  return { get figure() { return figure; }, get character() { return figure.userData.character || null; }, setLook, pos, update, teleport, setColliders, setCameraOccluders, faceTowards, get yaw() { return yaw; } };
}
