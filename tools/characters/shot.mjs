#!/usr/bin/env node
// Screenshot helper: node tools/characters/shot.mjs <url-path-and-query> <out.png> [w] [h]
// Needs a running vite dev server (npm run dev) on http://localhost:5173 and a local Chrome.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [,, url, out, w = 1200, h = 700] = process.argv;
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`, 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => p && fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.setViewport({ width: +w, height: +h });
p.on('console', (m) => console.log('[page]', m.text()));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(`http://localhost:5173${url}`, { waitUntil: 'load' });
await p.waitForFunction(() => window.done === true, { timeout: 60000 });
await p.screenshot({ path: out });
await b.close();
