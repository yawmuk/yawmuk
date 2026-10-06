#!/usr/bin/env node
// Headless screenshots of the running game (dev server on :5173 or any URL base).
//   node tools/characters/gameshot.mjs --out=docs/phase-4/screenshots/engine --tag=after --quality=high [--scenes=home,work] [--base=http://localhost:5173/]
// For each scene: the spawn view, an elevated overview, and a close-up of the nearest speaking NPC. Prints perf numbers.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const base = args.base || 'http://localhost:5173/';
const out = path.resolve(args.out || 'scratch/shots');
const tag = args.tag || 'shot';
const scenes = String(args.scenes || 'home,work,school,street,public_events,private_events').split(',');
const W = +(args.w || 1366), H = +(args.h || 768);
fs.mkdirSync(out, { recursive: true });
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`, 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => p && fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = {};
for (const sc of scenes) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /warn/.test(m.type())) errs.push(`[${m.type()}] ${m.text()}`); });
  const q = args.quality ? `&quality=${args.quality}` : '';
  await page.goto(`${base}?scene=${sc}&nointro=1&lang=en${q}${args.extra ? '&' + args.extra : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.yawmuk?.mode === 'play', { timeout: 120000 });
  await sleep(+(args.settle || 2500));
  await page.screenshot({ path: path.join(out, `${sc}-${tag}-spawn.jpg`), type: 'jpeg', quality: 80 });
  const info = await page.evaluate(async () => {
    const y = window.yawmuk, a = y.scenes.active;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const perf = y.perf ? y.perf() : y.stats();
    const b = a.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    return { perf, stats: y.stats(), center: [cx, cz], span, npcs: Object.entries(a.npcs).filter(([id]) => !id.startsWith('bg_')).map(([id, f]) => [id, f.position.x, f.position.y, f.position.z, f.rotation.y]) };
  });
  // overview
  await page.evaluate((c, s) => { window.yawmuk.inspect([c[0], Math.min(16, s * 0.55), c[1] + s * 0.55], [c[0], 0, c[1]]); }, info.center, info.span);
  await sleep(900);
  await page.screenshot({ path: path.join(out, `${sc}-${tag}-overview.jpg`), type: 'jpeg', quality: 80 });
  // npc close-up (front)
  if (info.npcs.length) {
    const [id, x, y, z, yaw] = info.npcs[0];
    await page.evaluate((x, y, z, yaw) => {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      window.yawmuk.inspect([x + fx * 2.2 + fz * 0.6, y + 1.65, z + fz * 2.2 - fx * 0.6], [x, y + 1.25, z]);
    }, x, y, z, yaw);
    await sleep(900);
    await page.screenshot({ path: path.join(out, `${sc}-${tag}-npc.jpg`), type: 'jpeg', quality: 82 });
  }
  report[sc] = { ...info, errors: errs.slice(0, 8) };
  console.log(sc, JSON.stringify({ perf: info.perf, stats: info.stats, errors: errs.slice(0, 5) }));
  await page.close();
}
fs.writeFileSync(path.join(out, `report-${tag}.json`), JSON.stringify(report, null, 2));
await browser.close();
