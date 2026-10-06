#!/usr/bin/env node
// Builds the runtime character assets from the CC0 Quaternius sources (see sources.json, LICENSES.md).
//
//   node tools/characters/fetch.mjs     # downloads the sources into scratch/characters-src/ (git-ignored)
//   node tools/characters/build.mjs     # writes public/assets/characters/{male,female}.glb
//
// For each sex, all modular parts (Head / Body / Legs / Feet of every outfit) are merged into ONE file that
// keeps one copy of the animation clips. Every source has the identical 62-joint "CharacterArmature" rig, so the
// runtime (src/engine/characters.js) binds every part to a single cloned skeleton by bone name.
// Mesh nodes are renamed "<sourceId>-<Part>" (e.g. "man_suit-Body"). Clips are renamed without the armature
// prefix and reduced to the set the game uses. Output is meshopt-compressed (three's MeshoptDecoder).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, resample, meshopt, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'scratch/characters-src');
const OUT = path.join(ROOT, 'public/assets/characters');
const KEEP_CLIPS = ['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Wave', 'Interact'];

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/characters/sources.json'), 'utf8')).models;
fs.mkdirSync(OUT, { recursive: true });

for (const sex of ['male', 'female']) {
  const list = sources.filter((m) => m.sex === sex);
  const target = new Document();
  target.createBuffer();
  let first = true;
  for (const m of list) {
    const doc = await io.read(path.join(SRC, `${m.id}.glb`));
    const r = doc.getRoot();
    for (const n of r.listNodes()) {
      if (!n.getMesh()) continue;
      const part = n.getName().split('_').pop(); // Casual2_Body -> Body, Formad_Head -> Head
      n.setName(`${m.id}-${part}`);
      n.getMesh().setName(`${m.id}-${part}`);
    }
    for (const a of r.listAnimations()) {
      const name = a.getName().split('|').pop();
      if (!first || !KEEP_CLIPS.includes(name)) a.dispose(); else a.setName(name);
    }
    // the armature of non-first sources is only needed for its skin (inverse bind matrices); rename for clarity
    if (!first) for (const s of r.listScenes()) for (const c of s.listChildren()) c.setName(`${m.id}-rig`);
    mergeDocuments(target, doc);
    first = false;
  }
  // one scene with all roots
  const scenes = target.getRoot().listScenes();
  const main = scenes[0];
  for (const s of scenes.slice(1)) { for (const c of s.listChildren()) main.addChild(c); s.dispose(); }
  target.getRoot().setDefaultScene(main);
  await target.transform(unpartition(), dedup(), resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const file = path.join(OUT, `${sex}.glb`);
  await io.write(file, target);
  const meshes = target.getRoot().listMeshes().map((x) => x.getName());
  console.log(`${sex}.glb  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  parts: ${meshes.join(', ')}  clips: ${target.getRoot().listAnimations().map((a) => a.getName()).join(', ')}`);
}
