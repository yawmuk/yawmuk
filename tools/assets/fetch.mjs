// Download, normalise and optimise the Yawmuk asset library.
//   node tools/assets/fetch.mjs            # everything
//   node tools/assets/fetch.mjs --only=sofa,car_police   # just some ids
//   node tools/assets/fetch.mjs --skip-props | --skip-hdri | --skip-tex
// Then run: node tools/assets/measure.mjs   (writes catalog.json, LICENSES.md, docs/ASSETS.md)
//
// Props are rescaled to real-world metres, re-pivoted to bottom-centre (x/z centred, min y = 0),
// +Y up, then optimised: dedup + prune + (optional simplify) + WebP textures <= 1024 px + meshopt
// compression (EXT_meshopt_compression + KHR_mesh_quantization). Load them in three.js with
// GLTFLoader.setMeshoptDecoder(MeshoptDecoder).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { KENNEY_KITS, PROPS, HDRIS, TEXTURES } from './assets.spec.mjs';
import { OUT, CACHE, ROOT, tool, download, text, rel } from './toolchain.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const only = args.only ? new Set(String(args.only).split(',')) : null;
const PROV_FILE = path.join(ROOT, 'tools', 'assets', 'provenance.json');
const prov = fs.existsSync(PROV_FILE) ? JSON.parse(fs.readFileSync(PROV_FILE, 'utf8')) : {};

const { NodeIO, Logger } = await tool('@gltf-transform/core');
const { ALL_EXTENSIONS } = await tool('@gltf-transform/extensions');
const F = await tool('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = await tool('meshoptimizer');
const sharp = (await tool('sharp')).default;
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// ---------------------------------------------------------------- sources
async function kenneyKit(kitKey) {
  const kit = KENNEY_KITS[kitKey];
  const dir = path.join(CACHE, 'kenney', kit.slug);
  if (!fs.existsSync(path.join(dir, 'License.txt'))) {
    const page = await text(`https://kenney.nl/assets/${kit.slug}`);
    const zipUrl = page.match(/https?:\/\/[^"']+\.zip/)?.[0];
    if (!zipUrl) throw new Error('No zip link on kenney.nl for ' + kit.slug);
    const zip = path.join(CACHE, 'kenney', kit.slug + '.zip');
    await download(zipUrl, zip);
    fs.mkdirSync(dir, { recursive: true });
    const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar';
    execFileSync(tar, ['-xf', zip, '-C', dir]); // bsdtar handles .zip on Windows 10+, macOS and most Linux
  }
  const lic = fs.readFileSync(path.join(dir, 'License.txt'), 'utf8');
  if (!/Creative Commons Zero|CC0/i.test(lic)) throw new Error(`Kenney ${kit.slug}: License.txt is not CC0`);
  return dir;
}

async function polyPizza(p) {
  const file = path.join(CACHE, 'polypizza', p.uuid + '.glb');
  await download(`https://static.poly.pizza/${p.uuid}.glb`, file);
  let meta = args['offline'] && prov[p.id]?.publicId === p.publicId ? prov[p.id] : null; // licence is re-read from poly.pizza unless --offline
  if (!meta) {
    const html = await text(`https://poly.pizza/m/${p.publicId}`);
    const licence = html.match(/"Licence":"([^"]+)"/)?.[1];
    const author = html.match(/"Username":"([^"]+)"/)?.[1];
    const title = html.match(/"Title":"([^"]+)"/)?.[1];
    if (!licence || !author) throw new Error('Could not read licence/author for ' + p.publicId);
    meta = { licence, author, title };
  } else {
    meta = { licence: meta.licence, author: meta.author, title: meta.title };
  }
  if (!/^CC0|^CC-BY/.test(meta.licence)) throw new Error(`${p.id}: unexpected licence ${meta.licence}`);
  return { file, ...meta };
}

// ---------------------------------------------------------------- normalisation
function bounds(doc) { return F.getBounds(doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0]); }

function normalise(doc, spec, baseScale) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() || root.listScenes()[0];
  root.setDefaultScene(scene);
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  // drop animations / skins (props only), cameras and lights
  for (const a of root.listAnimations()) a.dispose();
  for (const n of root.listNodes()) { n.setCamera(null); n.setExtension?.('KHR_lights_punctual', null); }
  if (spec.rotate) { // optional fix-up rotation, degrees [x, y, z] (e.g. stand a flat-lying frame upright)
    const [x, y, z] = spec.rotate.map(d => d * Math.PI / 180);
    const c = [Math.cos(x / 2), Math.cos(y / 2), Math.cos(z / 2)], s = [Math.sin(x / 2), Math.sin(y / 2), Math.sin(z / 2)];
    const q = [s[0] * c[1] * c[2] + c[0] * s[1] * s[2], c[0] * s[1] * c[2] - s[0] * c[1] * s[2], c[0] * c[1] * s[2] + s[0] * s[1] * c[2], c[0] * c[1] * c[2] - s[0] * s[1] * s[2]]; // XYZ order
    const rot = doc.createNode(spec.id + '_rot').setRotation(q);
    for (const child of scene.listChildren()) { scene.removeChild(child); rot.addChild(child); }
    scene.addChild(rot);
  }
  const b = bounds(doc);
  const size = [0, 1, 2].map(i => b.max[i] - b.min[i]);
  let f = spec.scale ?? baseScale ?? 1;
  if (spec.fit) {
    const [k, v] = Object.entries(spec.fit)[0];
    const cur = k === 'h' ? size[1] : k === 'w' ? size[0] : k === 'd' ? size[2] : Math.max(size[0], size[2]);
    f = v / cur;
  }
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const wrapper = doc.createNode(spec.id).setScale([f, f, f]).setTranslation([-cx * f, -b.min[1] * f, -cz * f]);
  for (const child of scene.listChildren()) { scene.removeChild(child); wrapper.addChild(child); }
  scene.addChild(wrapper).setName(spec.id);
  return f;
}

async function processProp(spec) {
  let srcFile, meta;
  if (spec.src === 'kenney') {
    const kit = KENNEY_KITS[spec.kit];
    const dir = await kenneyKit(spec.kit);
    srcFile = path.join(dir, kit.dir, spec.name + '.glb');
    meta = { licence: 'CC0 1.0', author: 'Kenney (kenney.nl)', title: `${kit.title} / ${spec.name}`, source_url: `https://kenney.nl/assets/${kit.slug}` };
  } else {
    const pp = await polyPizza(spec);
    srcFile = pp.file;
    meta = { licence: pp.licence, author: pp.author, title: pp.title, publicId: spec.publicId, source_url: `https://poly.pizza/m/${spec.publicId}` };
  }
  const doc = await io.read(srcFile);
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const factor = normalise(doc, spec, KENNEY_KITS[spec.kit]?.scale);
  const steps = [F.dedup(), F.prune()];
  if (spec.simplify) steps.push(F.weld(), F.simplify({ simplifier: MeshoptSimplifier, ratio: spec.simplify, error: 0.002 }));
  steps.push(
    F.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
    F.prune(),
    F.meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await doc.transform(...steps);
  doc.getRoot().getAsset().generator = 'yawmuk tools/assets/fetch.mjs (glTF-Transform)';
  const kitDir = spec.src === 'kenney' ? 'kenney-' + spec.kit : spec.kit;
  const out = path.join(OUT, 'props', kitDir, spec.id + '.glb');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await io.write(out, doc);
  prov[spec.id] = { ...meta, file: rel(out), baked_scale: +factor.toFixed(5), source_file: path.basename(srcFile) };
  console.log(`  ${spec.id.padEnd(28)} ${(fs.statSync(out).size / 1024).toFixed(0).padStart(5)} KB  x${factor.toFixed(3)}  ${meta.licence}  ${meta.author}`);
}

// ---------------------------------------------------------------- Poly Haven
async function phInfo(id) {
  const info = JSON.parse(await text(`https://api.polyhaven.com/info/${id}`));
  const files = JSON.parse(await text(`https://api.polyhaven.com/files/${id}`));
  return { info, files };
}

async function processHdri(h) {
  const { info, files } = await phInfo(h.ph);
  const url = files.hdri['1k'].hdr.url;
  const out = path.join(OUT, 'env', 'hdri', h.id + '.hdr');
  await download(url, out, { force: true });
  prov[h.id] = { licence: 'CC0 1.0', author: Object.keys(info.authors || {}).join(', '), title: info.name, source_url: `https://polyhaven.com/a/${h.ph}`, file: rel(out), resolution: '1k' };
  console.log(`  ${h.id.padEnd(28)} ${(fs.statSync(out).size / 1024).toFixed(0).padStart(5)} KB  ${info.name}`);
}

async function processTexture(t) {
  const { info, files } = await phInfo(t.ph);
  const maps = { diff: files.Diffuse, nor: files.nor_gl, rough: files.Rough };
  const dir = path.join(OUT, 'textures', t.id.replace(/^tex_/, ''));
  fs.mkdirSync(dir, { recursive: true });
  const written = {};
  for (const [k, m] of Object.entries(maps)) {
    if (!m) continue;
    const src = path.join(CACHE, 'polyhaven', `${t.ph}_${k}_1k.jpg`);
    await download(m['1k'].jpg.url, src);
    const out = path.join(dir, k + '.webp');
    const px = k === 'rough' ? 512 : 1024; // roughness detail is low-frequency; halve it to save bytes
    await sharp(src).resize(px, px, { fit: 'inside' }).webp({ quality: k === 'diff' ? 80 : 70 }).toFile(out);
    written[k] = rel(out);
  }
  const dims = info.dimensions ? info.dimensions.map(v => +(v / 1000).toFixed(2)) : null; // mm -> m
  prov[t.id] = { licence: 'CC0 1.0', author: Object.keys(info.authors || {}).join(', '), title: info.name, source_url: `https://polyhaven.com/a/${t.ph}`, maps: written, real_size_m: dims, normal: 'OpenGL (+Y)' };
  const kb = Object.values(written).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0) / 1024;
  console.log(`  ${t.id.padEnd(28)} ${kb.toFixed(0).padStart(5)} KB  ${info.name}  ${dims?.join('x')} m`);
}

// ---------------------------------------------------------------- main
const sel = list => list.filter(x => !only || only.has(x.id));
if (!args['skip-props']) { console.log('Props'); for (const p of sel(PROPS)) await processProp(p); }
if (!args['skip-hdri']) { console.log('HDRIs'); for (const h of sel(HDRIS)) await processHdri(h); }
if (!args['skip-tex']) { console.log('Textures'); for (const t of sel(TEXTURES)) await processTexture(t); }
fs.writeFileSync(PROV_FILE, JSON.stringify(prov, null, 1) + '\n');
console.log('provenance ->', path.relative(ROOT, PROV_FILE));
