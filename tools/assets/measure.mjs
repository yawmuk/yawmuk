// Load every library asset with three.js GLTFLoader (in Node), measure its real bounding box and
// write public/assets/catalog.json, public/assets/LICENSES.md and docs/ASSETS.md.
//   node tools/assets/measure.mjs           # measure + write catalog/docs
//   node tools/assets/measure.mjs --check   # only verify (exit 1 on any problem)
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PROPS, HDRIS, TEXTURES, KENNEY_KITS, GAPS } from './assets.spec.mjs';
import { ROOT, OUT } from './toolchain.mjs';

const CHECK = process.argv.includes('--check');
const prov = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'assets', 'provenance.json'), 'utf8'));
const problems = [];

await MeshoptDecoder.ready;
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
// Node has no Image/DOM: stub texture decoding (geometry, materials and texture references are still parsed).
// EXT_texture_webp support detection creates an Image; answer "supported" so the stub below is reached.
globalThis.Image ??= class { set src(_) { this.height = 1; queueMicrotask(() => this.onload?.()); } };
loader.register(parser => {
  parser.loadTexture = async () => new THREE.Texture();
  parser.loadTextureImage = async () => new THREE.Texture();
  return { name: 'node_texture_stub' };
});

async function loadGlb(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => loader.parse(ab, path.dirname(file) + '/', res, rej));
}

const r = v => Math.round(v * 100) / 100;
const catalog = { version: 1, generated: new Date().toISOString().slice(0, 10), units: 'metres', up_axis: '+Y',
  notes: [
    'All props are pre-scaled to real-world metres and pre-pivoted to bottom-centre: add to the scene at scale 1, y = 0.',
    'GLBs use EXT_meshopt_compression + KHR_mesh_quantization (and EXT_texture_webp where textured): call loader.setMeshoptDecoder(MeshoptDecoder) from three/examples/jsm/libs/meshopt_decoder.module.js.',
    'Facing direction is whatever the source model used (Kenney furniture/vehicles mostly face +Z); rotate per scene as needed.',
    'HDRIs: load with RGBELoader and PMREMGenerator. Textures: diff = sRGB colour, nor = OpenGL normal map, rough = roughness (linear). real_size_m tells how many metres one texture tile covers.',
  ],
  assets: [] };

let triTotal = 0;
for (const spec of PROPS) {
  const p = prov[spec.id];
  if (!p) { problems.push(`${spec.id}: not in provenance (run fetch.mjs)`); continue; }
  const file = path.join(OUT, p.file);
  if (!fs.existsSync(file)) { problems.push(`${spec.id}: missing file ${p.file}`); continue; }
  let gltf;
  try { gltf = await loadGlb(file); } catch (e) { problems.push(`${spec.id}: GLTFLoader failed: ${e.message}`); continue; }
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  let tris = 0, meshes = 0;
  gltf.scene.traverse(o => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  triTotal += tris;
  if (!isFinite(size.x) || size.y <= 0) problems.push(`${spec.id}: empty/invalid bounds`);
  const off = Math.max(Math.abs(box.min.y), Math.abs((box.min.x + box.max.x) / 2), Math.abs((box.min.z + box.max.z) / 2));
  if (off > 0.02 * Math.max(size.x, size.y, size.z) + 0.005) problems.push(`${spec.id}: pivot not bottom-centre (offset ${off.toFixed(3)})`);
  catalog.assets.push({
    id: spec.id, file: 'assets/' + p.file, kind: 'prop', tags: spec.tags, suggested_locations: spec.locs,
    dims_m: [r(size.x), r(size.y), r(size.z)], scale_to_meters: 1, baked_scale: p.baked_scale,
    up_axis: '+Y', pivot: 'bottom-center', triangles: tris, meshes, bytes: fs.statSync(file).size,
    license: p.licence, author: p.author, source_url: p.source_url, source_title: p.title,
    ...(spec.note ? { note: spec.note } : {}),
  });
}
for (const h of HDRIS) {
  const p = prov[h.id]; const file = p && path.join(OUT, p.file);
  if (!p || !fs.existsSync(file)) { problems.push(`${h.id}: missing HDRI`); continue; }
  const head = fs.readFileSync(file).subarray(0, 11).toString();
  if (!head.startsWith('#?RADIANCE') && !head.startsWith('#?RGBE')) problems.push(`${h.id}: not a Radiance .hdr`);
  catalog.assets.push({ id: h.id, file: 'assets/' + p.file, kind: 'hdri', tags: h.tags, suggested_locations: h.locs,
    dims_m: null, scale_to_meters: null, up_axis: '+Y', pivot: null, resolution: '1k (1024x512)', bytes: fs.statSync(file).size,
    license: p.licence, author: p.author, source_url: p.source_url, source_title: p.title });
}
for (const t of TEXTURES) {
  const p = prov[t.id];
  if (!p) { problems.push(`${t.id}: missing texture`); continue; }
  let bytes = 0;
  for (const f of Object.values(p.maps)) { const fp = path.join(OUT, f); if (!fs.existsSync(fp)) problems.push(`${t.id}: missing ${f}`); else bytes += fs.statSync(fp).size; }
  catalog.assets.push({ id: t.id, file: 'assets/' + path.posix.dirname(p.maps.diff) + '/', kind: 'texture', maps: Object.fromEntries(Object.entries(p.maps).map(([k, v]) => [k, 'assets/' + v])),
    tags: t.tags, suggested_locations: t.locs, dims_m: p.real_size_m ? [p.real_size_m[0], 0, p.real_size_m[1]] : null, real_size_m: p.real_size_m,
    scale_to_meters: null, up_axis: null, pivot: null, normal_convention: 'OpenGL', bytes,
    license: p.licence, author: p.author, source_url: p.source_url, source_title: p.title });
}

// every file on disk must be catalogued (no stray / unlicensed files)
const known = new Set(catalog.assets.flatMap(a => a.maps ? Object.values(a.maps) : [a.file]).map(f => f.replace(/^assets\//, '')));
const walk = d => !fs.existsSync(d) ? [] : fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
// Only the library folders owned by this pipeline (other agents own e.g. assets/characters/).
const OWNED = ['props', 'env', 'textures', 'thumbs'].map(d => path.join(OUT, d));
const ownedFiles = [...OWNED.flatMap(walk), path.join(OUT, 'catalog.json'), path.join(OUT, 'LICENSES.md')].filter(f => fs.existsSync(f));
for (const f of ownedFiles) {
  const rp = path.relative(OUT, f).split(path.sep).join('/');
  if (/^(catalog\.json|LICENSES\.md|thumbs\/)/.test(rp)) continue;
  if (!known.has(rp)) problems.push(`stray file not in catalog: ${rp}`);
}

const totalBytes = ownedFiles.reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(`${catalog.assets.length} assets (${PROPS.length} props, ${HDRIS.length} HDRIs, ${TEXTURES.length} textures), ${(totalBytes / 1048576).toFixed(2)} MB on disk, ${triTotal} prop triangles`);
if (problems.length) { console.error('PROBLEMS:\n  ' + problems.join('\n  ')); }
if (CHECK) process.exit(problems.length ? 1 : 0);

fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 1) + '\n');

// ---------------------------------------------------------------- docs
const LOCS = ['home', 'work', 'school', 'street', 'public_events', 'private_events'];
const LOC_TITLE = { home: 'home — suburban house interior (snowy morning)', work: 'work — open-plan tech office', school: 'school — community college (evening)', street: 'street — city street at night', public_events: 'public_events — hotel ballroom holiday party', private_events: 'private_events — suburban neighbourhood (condolence, birthday, wedding)' };
const byLic = {};
for (const a of catalog.assets) (byLic[a.license] ||= []).push(a);
const ccby = catalog.assets.filter(a => /BY/.test(a.license));
const fmtDims = a => a.dims_m ? a.dims_m.join(' × ') : '—';
const thumb = id => fs.existsSync(path.join(OUT, 'thumbs', id + '.webp')) ? `<img src="../public/assets/thumbs/${id}.webp" width="64">` : '';

let md = `# Yawmuk 3D asset library\n\n` +
  `Generated by \`node tools/assets/measure.mjs\` from \`tools/assets/assets.spec.mjs\`. Do not edit by hand. Re-run \`node tools/assets/fetch.mjs && node tools/assets/thumbs.mjs && node tools/assets/measure.mjs\` to rebuild (gltf-transform/sharp/meshoptimizer are installed on demand into the OS temp folder, never into package.json). \`node tools/assets/measure.mjs --check\` only verifies. Find more models with \`node tools/assets/polysearch.mjs "query" --cc0\`.\n\n` +
  `**${catalog.assets.length} assets** (${PROPS.length} props, ${HDRIS.length} HDRIs, ${TEXTURES.length} PBR textures), **${(totalBytes / 1048576).toFixed(1)} MB** on disk. ` +
  `Machine-readable catalogue: [\`public/assets/catalog.json\`](../public/assets/catalog.json). Runtime URL: \`import.meta.env.BASE_URL + file\` — Vite uses \`base: './'\`, so catalogue \`file\` values (\`assets/props/…\`) are relative; they are served from \`public/\`.\n\n` +
  `**Licences (unique assets):** ${Object.entries(byLic).map(([l, arr]) => `${arr.length} × ${l}`).join(', ')}. An asset can be suggested for several locations, so it can appear in more than one table below (the ${ccby.length} CC-BY models fill ${ccby.reduce((n, a) => n + a.suggested_locations.filter(l => LOCS.includes(l)).length, 0)} table rows). The authoritative list is [\`public/assets/LICENSES.md\`](../public/assets/LICENSES.md); the in-game Credits screen is built from it. The animated characters are licensed separately in [\`public/assets/characters/LICENSES.md\`](../public/assets/characters/LICENSES.md) (Quaternius, CC0 1.0).\n\n` +
  `## How to use\n\n` + catalog.notes.map(n => `- ${n}`).join('\n') + `\n\n` +
  '```js\nimport { GLTFLoader } from \'three/examples/jsm/loaders/GLTFLoader.js\';\nimport { MeshoptDecoder } from \'three/examples/jsm/libs/meshopt_decoder.module.js\';\nconst loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);\nconst { scene: sofa } = await loader.loadAsync(\'assets/props/kenney-furniture/sofa.glb\');\nsofa.position.set(x, 0, z); // already metres, bottom-centre pivot\n```\n\n' +
  `Dimensions below are **width (x) × height (y) × depth (z) in metres**, measured with three.js after loading at scale 1.\n\n`;
for (const loc of LOCS) {
  const items = catalog.assets.filter(a => a.suggested_locations.includes(loc));
  md += `## ${LOC_TITLE[loc]}\n\n| | id | kind | dims (m) | file | licence |\n|---|---|---|---|---|---|\n`;
  for (const a of items) md += `| ${thumb(a.id)} | \`${a.id}\` | ${a.kind} | ${fmtDims(a)} | \`${a.file.replace(/^assets\//, '')}\` | ${a.license}${/BY/.test(a.license) ? ' ⚠️' : ''} |\n`;
  md += '\n';
}
md += `## Gaps — still to build procedurally\n\n` + GAPS.map(g => `- ${g}`).join('\n') + '\n\n';
md += `## Credits & licences\n\n` +
  `- **Kenney** (kenney.nl) — ${Object.values(KENNEY_KITS).map(k => k.title).join(', ')}. CC0 1.0 (public domain). Credit appreciated, not required.\n` +
  `- **Poly Haven** (polyhaven.com) — all HDRIs and PBR textures. CC0 1.0.\n` +
  `- **poly.pizza** CC0 models by: ${[...new Set(catalog.assets.filter(a => a.license.startsWith('CC0') && a.source_url.includes('poly.pizza')).map(a => a.author))].join(', ')}.\n` +
  `- **CC-BY 3.0 models (attribution REQUIRED in the game credits)** — ${ccby.length} models, see \`public/assets/LICENSES.md\`:\n` +
  ccby.map(a => `  - \`${a.id}\`: "${a.source_title}" by ${a.author} — ${a.source_url} — CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Modified: rescaled, re-pivoted, compressed.`).join('\n') + '\n';
fs.writeFileSync(path.join(ROOT, 'docs', 'ASSETS.md'), md);

let lic = `# Licences for public/assets\n\nEvery file in this folder is listed in catalog.json with its licence, author and source URL.\n\n` +
  `## Summary\n\n` + Object.entries(byLic).map(([l, arr]) => `- ${l}: ${arr.length} assets`).join('\n') + '\n\n' +
  `CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/ — no attribution required.\n\n` +
  `## Attribution required (CC-BY 3.0, https://creativecommons.org/licenses/by/3.0/)\n\nThe following models must be credited in the game's credits/about screen. All were modified (rescaled, re-pivoted, mesh-compressed).\n\n` +
  ccby.map(a => `- "${a.source_title}" by ${a.author} (${a.source_url}), licensed under CC-BY 3.0 — file \`${a.file}\``).join('\n') + '\n\n' +
  `## CC0 sources\n\n` +
  `- Kenney (https://kenney.nl): ${Object.values(KENNEY_KITS).map(k => `${k.title} (https://kenney.nl/assets/${k.slug})`).join(', ')}\n` +
  `- Poly Haven (https://polyhaven.com/license): ` + catalog.assets.filter(a => a.kind !== 'prop').map(a => `${a.source_title} by ${a.author}`).join('; ') + '\n' +
  `- poly.pizza CC0 models: ` + catalog.assets.filter(a => a.license.startsWith('CC0') && a.source_url.includes('poly.pizza')).map(a => `${a.id} ("${a.source_title}" by ${a.author}, ${a.source_url})`).join('; ') + '\n';
fs.writeFileSync(path.join(OUT, 'LICENSES.md'), lic);
console.log('wrote public/assets/catalog.json, public/assets/LICENSES.md, docs/ASSETS.md');
if (problems.length) process.exit(1);
