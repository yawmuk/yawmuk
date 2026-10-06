// Character lab: renders a lineup of looks with the engine's character system (visual QA).
// http://localhost:5173/tools/characters/lab.html?set=main&anim=idle&cam=front&t=1.2
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { preloadCharacters, createCharacter, updateCharacters } from '../../src/engine/characters.js';
import { loadCatalog } from '../../src/engine/assets.js';

const q = new URLSearchParams(location.search);
const SETS = {
  main: [
    { name: 'Adam', look: { skin: '#e8c4a0', hair: '#5a3b24', shirt: '#2f4a6d', pants: '#5b6270', shoes: '#6b4a2f', height: 1.78 } },
    { name: 'Omar', look: { skin: '#5a3a22', shirt: '#556b2f', pants: '#3b3d42', hair: '#1a1410', beard: '#1a1410', height: 1.85 } },
    { name: 'Sara hijab', look: { skin: '#c68642', shirt: '#e8dcc4', hijab: true, hijabColor: '#5b7b5a', dress: '#3b3b55', height: 1.65 } },
    { name: 'Noor', look: { skin: '#c68642', shirt: '#f5f5f5', suit: '#4a6fa5', tie: '#f5f5f5', hijab: true, hijabColor: '#7fb3d5', pants: '#3a3f55', dress: '#3a4660', height: 1.64 } },
    { name: 'Imam', look: { skin: '#a1665e', shirt: '#e9e4d8', kufi: true, beard: '#222', pants: '#d9d4c7', height: 1.76 } },
    { name: 'Carol', look: { skin: '#f0c8a8', shirt: '#6b7a3a', pants: '#4a4a52', hair: '#c9c9c9', glasses: true, height: 1.62 } },
    { name: 'Yusuf', look: { skin: '#8d5524', shirt: '#f4f4f4', suit: '#6e6e73', tie: '#e9e4d8', beard: '#1d1410', hair: '#1d1410', pants: '#5d5d62', height: 1.8 } },
    { name: 'Dave', look: { skin: '#f0c8a8', shirt: '#2e6b3f', pants: '#3b3a36', hair: '#9a9a9a', height: 1.78, build: 1.08, santaHat: true } },
    { name: 'Leo', look: { skin: '#d1a17a', shirt: '#4caf50', pants: '#2f4f7f', hair: '#3b2414', height: 1.15 } },
    { name: 'Hodan', look: { skin: '#5a3a22', shirt: '#c19a6b', dress: '#c19a6b', hijab: '#2c3550', height: 1.65 } }
  ],
  poses: [
    { look: { skin: '#e8c4a0', hair: '#5a3b24', shirt: '#2f4a6d', pants: '#5b6270', height: 1.78 }, speed: 1.4 },
    { look: { skin: '#e8c4a0', hair: '#5a3b24', shirt: '#2f4a6d', pants: '#5b6270', height: 1.78 }, speed: 5 },
    { look: { skin: '#5a3a22', shirt: '#556b2f', beard: '#1a1410', beanie: '#7d8086', height: 1.85 }, anim: 'wave' },
    { look: { skin: '#c68642', shirt: '#e8dcc4', hijab: '#5b7b5a', dress: '#3b3b55', height: 1.65 }, anim: 'talk' },
    { look: { skin: '#a1665e', shirt: '#e9e4d8', kufi: true, beard: '#222', height: 1.76, glasses: true }, anim: 'sit' },
    { look: { skin: '#f1cfae', shirt: '#9c3d54', hijab: '#e9e1d3', dress: '#2f3542', height: 1.66, seated: true } }
  ],
  hijab: [
    { look: { skin: '#c68642', shirt: '#e8dcc4', hijab: true, hijabColor: '#5b7b5a', dress: '#3b3b55', height: 1.65 } },
    { look: { skin: '#5a3a22', shirt: '#c19a6b', dress: '#c19a6b', hijab: '#2c3550', height: 1.65 } },
    { look: { skin: '#f1cfae', shirt: '#9c3d54', hijab: '#e9e1d3', dress: '#2f3542', height: 1.66 } }
  ]
};
const list = SETS[q.get('set') || 'main'];
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(innerWidth, innerHeight);
r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#b9c3cc');
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.set(3, 6, 4); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); sun.shadow.normalBias = 0.02;
scene.add(sun, new THREE.HemisphereLight('#dfe8f5', '#6b5a48', 0.5));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#9a9184', roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
await loadCatalog();
await preloadCharacters();
const { charactersReady } = await import('../../src/engine/characters.js');
const sp = +(q.get('sp') || 0.85);
const chars = list.map((e, i) => {
  const c = createCharacter(e.look);
  c.root.position.x = (i - (list.length - 1) / 2) * sp;
  c.root.rotation.y = Math.PI + +(q.get('ry') || 0); // face the camera (+Z)
  scene.add(c.root);
  const a = e.anim || q.get('anim'); if (a) c.play(a, { once: false });
  if (e.speed) c.setLocomotion(e.speed);
  if (q.get('speed')) c.setLocomotion(+q.get('speed'));
  return c;
});
const cam = new THREE.PerspectiveCamera(+(q.get('fov') || 28), innerWidth / innerHeight, 0.05, 100);
const views = { front: [0, 1.25, 9.5, 0, 0.95, 0], close: [0, 1.6, 2.2, 0, 1.5, 0], side: [6, 1.3, 4, 0, 0.95, 0], top: [0, 3.2, 5, 0, 1, 0] };
const v = (q.get('view') || q.get('cam') || 'front').split(',').map(Number);
const vv = views[q.get('cam') || 'front'] || v;
cam.position.set(+(q.get('cx') ?? vv[0]), +(q.get('cy') ?? vv[1]), +(q.get('cz') ?? vv[2])); cam.lookAt(+(q.get('tx') ?? vv[3]), +(q.get('ty') ?? vv[4]), +(q.get('tz') ?? vv[5]));
scene.updateMatrixWorld(true);
const T = +(q.get('t') || 0.5); const steps = Math.max(1, Math.round(T / (1 / 30)));
for (let i = 0; i < steps; i++) updateCharacters(1 / 30, null);
r.render(scene, cam);
window.done = true;
console.log('speeds', JSON.stringify(chars[0].tpl.speeds), 'legs', JSON.stringify(chars[0].tpl.legs));
