// Shared helpers for the asset pipeline. The heavy tools (gltf-transform, sharp, meshoptimizer) are
// installed on demand into an OS temp folder so they never touch the project's package.json.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = path.join(ROOT, 'public', 'assets');
export const CACHE = path.join(os.tmpdir(), 'yawmuk-asset-cache');
export const TOOLS = path.join(os.tmpdir(), 'yawmuk-asset-tools');

const DEPS = ['@gltf-transform/core@4', '@gltf-transform/extensions@4', '@gltf-transform/functions@4', 'sharp', 'meshoptimizer', 'draco3dgltf'];

export function ensureToolchain() {
  const marker = path.join(TOOLS, 'node_modules', '@gltf-transform', 'functions');
  if (fs.existsSync(marker) && fs.existsSync(path.join(TOOLS, 'node_modules', 'sharp'))) return;
  fs.mkdirSync(TOOLS, { recursive: true });
  if (!fs.existsSync(path.join(TOOLS, 'package.json'))) fs.writeFileSync(path.join(TOOLS, 'package.json'), '{"name":"yawmuk-asset-tools","private":true}');
  console.log('[toolchain] installing', DEPS.join(' '), 'into', TOOLS);
  execSync(`npm install --no-audit --no-fund ${DEPS.join(' ')}`, { cwd: TOOLS, stdio: 'inherit' });
}

const req = createRequire(path.join(TOOLS, 'package.json'));
export async function tool(name) {
  ensureToolchain();
  return import(pathToFileURL(req.resolve(name)).href);
}

export async function download(url, dest, { force = false } = {}) {
  if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'yawmuk-asset-pipeline/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return dest;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

export async function text(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'yawmuk-asset-pipeline/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export const rel = p => path.relative(OUT, p).split(path.sep).join('/');
