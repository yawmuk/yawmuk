import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
const q = new URLSearchParams(location.search);
const files = (q.get('f') || '').split(',').filter(Boolean);
const anim = q.get('anim') || '';
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(innerWidth, innerHeight); r.toneMapping = THREE.ACESFilmicToneMapping; document.body.append(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#9aa4ae');
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight('#fff', 2); sun.position.set(2, 4, 3); scene.add(sun);
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
const y = +(q.get('y') || 1), d = +(q.get('d') || 6);
cam.position.set(+(q.get('cx') || 0), y + 0.3, d); cam.lookAt(0, y, 0);
const loader = new GLTFLoader();
const mixers = [];
let i = 0;
for (const f of files) {
  const g = await loader.loadAsync(f);
  const o = g.scene; o.position.x = (i - (files.length - 1) / 2) * 1.0; o.rotation.y = +(q.get('ry') || 0); scene.add(o); i++;
  if (anim) { const clip = g.animations.find((a) => a.name.endsWith(anim)); if (clip) { const m = new THREE.AnimationMixer(o); m.clipAction(clip).play(); m.update(+(q.get('t') || 0.3)); mixers.push(m); } }
  const b = new THREE.Box3().setFromObject(o); console.log(f, 'size', b.getSize(new THREE.Vector3()).toArray().map(v=>v.toFixed(2)).join(','));
}
r.render(scene, cam);
window.done = true;
