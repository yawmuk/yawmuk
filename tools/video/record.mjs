#!/usr/bin/env node
// Automated demo-video recorder for «يومك» Yawmuk (hackathon submission, <= 2:00 hard limit).
//
// Drives a real Chrome (puppeteer-core, Metal GPU, 1920x1080) through the shot list of docs/VIDEO_SCRIPT.md,
// records each shot with the CDP screencast (Page.startScreencast, timestamped JPEG frames), burns in an
// Arabic caption per shot (caption PNGs rendered by Chrome itself, so Arabic shaping is correct; this ffmpeg
// build has no freetype/drawtext), adds title/end cards (HTML pages screenshotted in Chrome) and joins all
// shots with ffmpeg into one H.264 yuv420p 30 fps faststart MP4. Loading waits are never recorded.
//
// Usage:
//   node tools/video/record.mjs --base=http://localhost:8095 --out=../../submission/video/yawmuk-demo-local.mp4
//   EXPERTS_PASSCODE=... node tools/video/record.mjs --base=https://yawmuk-851682870274.us-central1.run.app \
//        --out=/Users/abusham/Downloads/islamicaich/submission/video/yawmuk-demo.mp4
// Options: --base <url> (required) --out <mp4> --work <dir> --live-url <url shown on end card>
//          --only=<shot ids comma list> (debug) --headful
// Env: EXPERTS_PASSCODE (dashboard login, typed before recording starts, never on screen; skipped if unset),
//      CHROME_PATH, FFMPEG.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]; if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  if (v !== undefined) args[k] = v; else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[k] = argv[++i]; else args[k] = true;
}
const BASE = String(args.base || '').replace(/\/$/, '');
if (!BASE) { console.error('usage: node tools/video/record.mjs --base <url> [--out file.mp4]'); process.exit(2); }
const LIVE_URL = args['live-url'] || 'https://yawmuk-851682870274.us-central1.run.app';
const OUT = path.resolve(args.out || '/Users/abusham/Downloads/islamicaich/submission/video/yawmuk-demo.mp4');
const WORK = path.resolve(args.work || path.join(os.tmpdir(), `yawmuk-video-${Date.now()}`));
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';
const FFPROBE = FFMPEG.replace(/ffmpeg$/, 'ffprobe');
const PASS = process.env.EXPERTS_PASSCODE || '';
const TOWN_DOOR = args['town-door'] || 'bank'; // the door Adam walks toward in the opening shot
const ONLY = args.only ? String(args.only).split(',') : null;
const W = 1920, H = 1080, FPS = 30;
const HARD_LIMIT = 120;
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const ff = (a) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });

// ------------------------------------------------------------------ browser
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: args.headful ? false : 'new',
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
    '--no-first-run', `--window-size=${W},${H}`, '--hide-scrollbars', '--lang=ar',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
});
const page = (await browser.pages())[0] || await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const cdp = await page.createCDPSession();

// ------------------------------------------------------------------ recording (CDP screencast)
async function record(name, action, { hold = 2000, min = 0, max = 30000 } = {}) {
  const dir = path.join(WORK, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const onFrame = async (f) => {
    const idx = frames.length;
    const file = path.join(dir, `f${String(idx).padStart(5, '0')}.jpg`);
    frames.push({ file, t: Date.now() });
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  };
  cdp.on('Page.screencastFrame', onFrame);
  const t0 = Date.now();
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  let failed = null;
  try {
    await Promise.race([Promise.resolve().then(() => action()), sleep(max).then(() => { throw new Error(`action exceeded ${max} ms`); })]);
  } catch (e) { failed = e.message; log(`  ! ${name}: ${failed}`); }
  await sleep(hold);
  const elapsed = Date.now() - t0;
  if (elapsed < min) await sleep(min - elapsed);
  const tEnd = Math.min(Date.now(), t0 + max + hold);
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);
  if (!frames.length) { // a fully static page may send nothing: fall back to one screenshot
    const file = path.join(dir, 'f00000.jpg');
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
    frames.push({ file, t: t0 });
  }
  frames[0].t = t0; // the first frame stands for the start of the shot
  const lines = [];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : tEnd;
    const d = Math.max(0.001, (next - f.t) / 1000);
    lines.push(`file '${f.file}'`, `duration ${d.toFixed(3)}`);
  });
  lines.push(`file '${frames.at(-1).file}'`);
  fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'));
  const seconds = (tEnd - t0) / 1000;
  log(`  ● ${name}: ${seconds.toFixed(1)} s, ${frames.length} frames${failed ? ` (FAILED: ${failed})` : ''}`);
  return { name, list: path.join(dir, 'list.txt'), seconds, failed };
}

// ------------------------------------------------------------------ captions + cards (rendered by Chrome)
const FONT_CSS = `@import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@500;700&family=Noto+Kufi+Arabic:wght@600;800&display=swap');`;
const capPage = await browser.newPage();
await capPage.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
async function renderHtml(html, file, transparent) {
  await capPage.setContent(html, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
  await capPage.evaluate(() => Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 4000))]));
  await sleep(150);
  await capPage.screenshot({ path: file, omitBackground: !!transparent });
}
async function captionPng(text, en, file, top = false) {
  await renderHtml(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${FONT_CSS}
    html,body{margin:0;width:${W}px;height:${H}px;background:transparent;overflow:hidden}
    .cap{position:absolute;left:50%;${top ? 'top:96px' : 'bottom:40px'};transform:translateX(-50%);max-width:1500px;box-sizing:border-box;
      background:rgba(10,22,30,.82);color:#fff;border-radius:22px;padding:18px 40px 20px;text-align:center;
      box-shadow:0 8px 30px rgba(0,0,0,.35);border:2px solid rgba(232,190,92,.55)}
    .ar{font:700 40px/1.5 'Noto Naskh Arabic','Geeza Pro',serif}
    .en{font:500 24px/1.35 -apple-system,'Helvetica Neue',Arial,sans-serif;color:#e8d9a8;direction:ltr;margin-top:4px}
    </style></head><body><div class="cap"><div class="ar">${text}</div>${en ? `<div class="en">${en}</div>` : ''}</div></body></html>`, file, true);
}
const CARD_CSS = `${FONT_CSS}
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
  body{background:radial-gradient(ellipse at 50% 35%,#1f5a5a 0%,#0e2a33 55%,#08161c 100%);color:#fff;display:flex;
    flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:'Noto Kufi Arabic','Geeza Pro',sans-serif}
  .logo{font:800 190px/1.1 'Noto Kufi Arabic','Geeza Pro',sans-serif;color:#f3d27a;text-shadow:0 10px 40px rgba(0,0,0,.4)}
  .latin{font:600 64px/1.2 -apple-system,'Helvetica Neue',sans-serif;letter-spacing:.12em;color:#cfe7e0;margin-top:6px}
  .tag{font:600 50px/1.6 'Noto Naskh Arabic',serif;margin-top:34px}
  .sub{font:500 30px/1.5 -apple-system,'Helvetica Neue',sans-serif;color:#b9d3cc;margin-top:6px}
  .url{font:600 40px/1.4 ui-monospace,Menlo,monospace;color:#fff;background:rgba(255,255,255,.08);padding:14px 30px;border-radius:16px;margin-top:40px;direction:ltr}
  .team{font:700 54px/1.5 'Noto Kufi Arabic',sans-serif;color:#f3d27a;margin-top:40px}
  .disc{font:500 26px/1.5 'Noto Naskh Arabic',serif;color:#b9d3cc;margin-top:26px;max-width:1500px}
  .bar{position:absolute;bottom:0;left:0;right:0;height:14px;background:linear-gradient(90deg,#f3d27a,#2f8f83,#f3d27a)}`;
async function titleCard(file) {
  await renderHtml(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${CARD_CSS}</style></head><body>
    <div class="logo">يومك</div><div class="latin">YAWMUK</div>
    <div class="tag">تعرَّف على الإسلام في يومك — لعبة ثلاثية الأبعاد في المتصفح</div>
    <div class="sub">Discover Islam through one everyday day · Islamic AI Challenge · Track 3</div><div class="bar"></div></body></html>`, file);
}
async function endCard(file) {
  await renderHtml(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${CARD_CSS}</style></head><body>
    <div class="logo" style="font-size:150px">يومك</div>
    <div class="tag">جرّبها الآن في المتصفح</div>
    <div class="url">${LIVE_URL.replace(/^https?:\/\//, '')}</div>
    <div class="team">فريق Lemonada</div>
    <div class="disc">مسودّات معدّة بمساعدة الذكاء الاصطناعي بانتظار مراجعة أهل العلم، وليست فتوى · AI-prepared drafts pending scholarly review. Not a fatwa.</div>
    <div class="bar"></div></body></html>`, file);
}

// ------------------------------------------------------------------ game helpers
async function gotoGame(q) {
  await page.goto(`${BASE}/?${q}&nointro=1&lang=ar&quality=high`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    if (await page.evaluate(() => window.yawmuk?.mode).catch(() => null) === 'play') break;
    await sleep(250);
  }
  const ph = await page.evaluate(() => !!window.yawmuk?.scenes?.active?.isPlaceholder).catch(() => null);
  if (ph) log(`  ! ${q}: PLACEHOLDER scene loaded`);
  await sleep(2500); // let textures/characters settle (not recorded)
}
const waitFor = (fn, timeout = 20000, ...a) => page.waitForFunction(fn, { timeout, polling: 100 }, ...a);
async function openFeature(name, extra = {}) {
  const ok = await page.evaluate((n, e) => window.yawmuk.openFeature(n, e), name, extra).catch((e) => `err ${e.message}`);
  if (ok !== true) throw new Error(`openFeature(${name}) -> ${ok}`);
}
async function closeAll() { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(250); } }
/** Smooth-move the mouse to the centre of the first visible element matching sel (+ optional text) and click it. */
async function clickEl(sel, text = null, { last = false } = {}) {
  const r = await page.evaluate((s, t, l) => {
    const els = [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null && !e.disabled && (!t || e.textContent.includes(t)));
    const e = l ? els.at(-1) : els[0]; if (!e) return null;
    e.scrollIntoView({ block: 'center', inline: 'nearest' });
    const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, sel, text, last);
  if (!r) throw new Error(`no element ${sel}${text ? ` "${text}"` : ''}`);
  await page.mouse.move(r.x, r.y, { steps: 12 });
  await sleep(150);
  await page.mouse.click(r.x, r.y);
}
async function holdKeys(keys, ms) {
  await page.evaluate(() => document.activeElement?.blur?.());
  for (const k of keys) await page.keyboard.down(k);
  await sleep(ms);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
}
async function scrollIn(sel, px, steps = 10, delay = 60) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate((s, d) => { const e = [...document.querySelectorAll(s)].find((x) => x.offsetParent !== null && x.scrollHeight > x.clientHeight + 4); if (e) e.scrollTop += d; }, sel, px / steps);
    await sleep(delay);
  }
}

// ------------------------------------------------------------------ the shot list (docs/VIDEO_SCRIPT.md)
const SHOTS = [
  { id: 'town', cap: 'يومٌ واحد في حيٍّ واحد: من بيتك إلى عملك ومدرستك ومسجدك', en: 'One day, one neighbourhood: home, work, school and the mosque',
    prep: async () => {
      await gotoGame('scene=town');
      await page.evaluate((want) => {
        const y = window.yawmuk, a = y.scenes.active, p = y.player.pos;
        const d = a.doors.find((x) => x.location === want) || a.doors[0];
        y.player.teleport([p.x, 0, p.z], Math.atan2(-(d.position[0] - p.x), -(d.position[2] - p.z)));
      }, TOWN_DOOR);
      await sleep(1200);
    },
    run: async () => {
      await sleep(500);
      await holdKeys(['KeyW'], 7000);
    }, hold: 600 },
  { id: 'prayer', cap: 'مواقيت الصلاة تُحسب على جهازك، ويُرفع الأذان في وقته', en: 'Prayer times computed on your device; the adhan plays on time',
    prep: async () => { await gotoGame('scene=mosque'); },
    run: async () => {
      await sleep(1600);
      await openFeature('prayer');
      await sleep(2200);
      await clickEl('button', 'استماع للأذان').catch((e) => log('   (adhan button)', e.message));
    }, hold: 2600 },
  { id: 'quran', cap: 'المصحف المرتّل مع ترجمة المعاني — النص من مجمع الملك فهد، ولا يكتب الذكاء الاصطناعي منه حرفاً', en: 'Recited Quran with translated meanings; text from the King Fahd Complex, none of it written by AI',
    prep: async () => { await closeAll(); },
    run: async () => {
      await openFeature('quran');
      await sleep(2600);
      await clickEl('.yk-quran-ayah').catch((e) => log('   (ayah)', e.message));
      await sleep(1800);
      await clickEl('.yk-quran-play').catch((e) => log('   (play)', e.message));
      await sleep(1500);
      await scrollIn('[class*="yk-quran"]', 420, 14, 90);
    }, hold: 1600 },
  { id: 'adhkar', cap: 'أذكار الصباح والمساء بنصّها الموثّق ومصدرها', en: 'Morning and evening adhkar, verified text with sources',
    prep: async () => { await closeAll(); },
    run: async () => {
      await openFeature('adhkar');
      await sleep(2400);
      await scrollIn('[class*="yk-adhkar"]', 360, 12, 90);
    }, hold: 1500 },
  { id: 'bank', cap: 'في البنك: عقود التمويل الإسلامي، كل قول منسوب إلى جهته، وحاسبة للزكاة', en: 'At the bank: Islamic finance contracts, each position attributed, and a zakat calculator',
    prep: async () => { await closeAll(); await gotoGame('scene=bank'); },
    run: async () => {
      await sleep(1000);
      await openFeature('bank');
      await sleep(2600);
      await scrollIn('[class*="yk-bank"]', 300, 8, 80);
      await clickEl('.yk-bank-tab', 'حاسبة الزكاة');
      await sleep(900);
      const inputs = await page.evaluate(() => [...document.querySelectorAll('[class*="yk-bank"] input:not([type=checkbox])')].filter((e) => e.offsetParent !== null)
        .map((e, i) => ({ i, label: (document.querySelector(`label[for="${e.id}"]`)?.textContent || e.placeholder || e.getAttribute('aria-label') || '').trim() })));
      log('   zakat inputs:', JSON.stringify(inputs));
      for (const inp of inputs) {
        const v = /سعر.*ذهب/.test(inp.label) ? '95' : /سعر.*فض/.test(inp.label) ? '1.1' : inp.i === 0 ? '25000' : null;
        if (!v) continue;
        const h = (await page.$$('[class*="yk-bank"] input:not([type=checkbox])')).filter(Boolean);
        const vis = []; for (const e of h) if (await e.evaluate((n) => n.offsetParent !== null)) vis.push(e);
        const el = vis[inp.i]; if (!el) continue;
        await el.click({ count: 3 }); await el.type(v, { delay: 90 });
        await page.keyboard.press('Tab');
        await sleep(300);
      }
      await sleep(600);
      await page.evaluate(() => document.querySelector('.yk-bank-due')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }, hold: 2200 },
  { id: 'ruling', top: true, cap: 'كل موقف ينتهي ببطاقة حكم: آيات وأحاديث بنصّها ورقمها ودرجتها، والمذاهب الأربعة', en: 'Each situation ends with a ruling card: verified Quran and hadith, and the four madhhabs',
    prep: async () => {
      await closeAll(); await gotoGame('scene=home');
      // walk-teleport to the first situation (not recorded) and start its dialogue
      const id = await page.evaluate(() => { const a = window.yawmuk.scenes.active; const h = a.hotspots[0]; window.yawmuk.teleport(h.id); return h.id; });
      await waitFor((h) => window.yawmuk.near === h, 8000, id).catch(() => log('   (near not reached)'));
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.keyboard.press('KeyE');
      await page.waitForSelector('.overlay:not(.leaving) .dialogue', { visible: true, timeout: 8000 })
        .catch(async () => { await page.evaluate(() => window.yawmuk.interact()); await page.waitForSelector('.overlay:not(.leaving) .dialogue', { visible: true, timeout: 8000 }); });
      log('   home hotspot', id);
    },
    run: async () => {
      const OPEN = '.overlay:not(.leaving)';
      for (let g = 0; g < 20; g++) {
        const st = await page.evaluate(() => (document.querySelector('.overlay:not(.leaving) .dialogue .choices') ? 'choices' : document.querySelector('.overlay:not(.leaving) .dialogue .line') ? 'line' : 'wait'));
        if (st === 'choices') break;
        if (st === 'line') { await sleep(650); await clickEl(`${OPEN} .dialogue .row.end .btn.primary`); }
        await sleep(250);
      }
      await sleep(900);
      await clickEl(`${OPEN} .dialogue .choices .choice`);
      await page.waitForSelector(`${OPEN} .dialogue .consequence`, { visible: true, timeout: 10000 });
      await sleep(1100);
      await clickEl(`${OPEN} .dialogue .row.end .btn.primary`);
      await page.waitForSelector(`${OPEN} .ruling-modal .ruling-card`, { visible: true, timeout: 10000 });
      await sleep(1800);
      await scrollIn(`${OPEN} .ruling-modal`, 800, 12, 100);
      await sleep(500);
      await page.evaluate(() => document.querySelector('.overlay:not(.leaving) .ruling-card .rc-madhahib')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }, hold: 2000, max: 30000 },
  { id: 'guide', cap: 'اسأل المرشد: يجيب من المصادر المراجَعة وحدها، ويُريك ما اعتمد عليه', en: 'Ask the guide: it answers only from reviewed sources and shows what it relied on',
    prep: async () => { await closeAll(); await gotoGame('scene=town'); },
    run: async () => {
      await sleep(600);
      await openFeature('guide');
      await page.waitForSelector('.yk-guide-input', { visible: true, timeout: 10000 });
      await sleep(900);
      await page.click('.yk-guide-input');
      await page.type('.yk-guide-input', 'لماذا يتجنب المسلمون الفائدة؟', { delay: 70 });
      await sleep(400);
      await clickEl('.yk-guide-send');
      await sleep(800);
      await waitFor(() => !document.querySelector('.yk-guide-thinking') && !document.querySelector('.yk-guide-send')?.disabled, 25000);
      await sleep(2500);
      await page.evaluate(() => { const d = [...document.querySelectorAll('.yk-guide-sources')].at(-1); if (d) { d.open = true; d.scrollIntoView({ block: 'end', behavior: 'smooth' }); } });
    }, hold: 3200, max: 40000 },
  { id: 'personal', cap: 'أما سؤالك عن حالتك الخاصة فلا يُفتي فيه الذكاء الاصطناعي، بل يُحال إلى أهل العلم', en: 'A question about your own case is never answered by AI: it goes to qualified scholars',
    prep: async () => {},
    run: async () => {
      await page.click('.yk-guide-input');
      await page.type('.yk-guide-input', 'أنا وزوجتي نريد أخذ قرض عقاري لبيتنا في أوهايو، هل يجوز لنا؟', { delay: 45 });
      await sleep(300);
      const nBefore = await page.evaluate(() => document.querySelectorAll('.yk-guide-scholars').length);
      await clickEl('.yk-guide-send');
      await waitFor((n) => document.querySelectorAll('.yk-guide-scholars').length > n, 20000, nBefore);
      await sleep(2600);
      await clickEl('.yk-guide-scholars', null, { last: true });
      await page.waitForSelector('#yk-experts-q', { visible: true, timeout: 10000 });
      await sleep(2000);
      await clickEl('.yk-experts-primary');
      await page.waitForSelector('.yk-experts-code', { visible: true, timeout: 15000 });
    }, hold: 2600, max: 40000 },
  { id: 'experts', cap: 'في لوحة المراجعة يجيب العالِم بنفسه ومع المصدر، ويعود الجواب إلى السائل', en: 'In the review dashboard a scholar answers, with sources, and the answer returns to the player',
    prep: async () => {
      await closeAll();
      await page.goto(`${BASE}/experts?lang=ar`, { waitUntil: 'networkidle2', timeout: 60000 });
      await sleep(800);
      if (PASS && await page.$('#pc')) { // passcode typed off-screen (nothing is recorded during prep)
        await page.type('#pc', PASS);
        await page.click('.yk-dash-login button[type=submit]');
        await sleep(2500);
      }
      await sleep(800);
    },
    run: async () => {
      await sleep(1800);
      const r = await page.evaluate(() => {
        const all = [...document.querySelectorAll('main *')].filter((e) => e.offsetParent !== null && e.textContent.includes('أوهايو'));
        const leaf = all.filter((e) => ![...e.children].some((c) => c.textContent.includes('أوهايو'))).pop();
        const t = leaf?.closest('button, li, [role=button], article, a') || leaf; if (!t) return null;
        const b = t.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      });
      if (r) { await page.mouse.move(r.x, r.y, { steps: 15 }); await page.mouse.click(r.x, r.y); } else log('   (question not found in queue)');
      await sleep(2500);
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    }, hold: 2500 },
  { id: 'results', cap: 'ونقيس الأثر بتجربة اختيارية قبل اللعب وبعده', en: 'We measure the benefit with an opt-in pre/post study',
    prep: async () => { await page.goto(`${BASE}/results`, { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(1200); },
    run: async () => { await sleep(2500); await page.evaluate(() => window.scrollBy({ top: 260, behavior: 'smooth' })); await sleep(1200); }, hold: 1800 }
];

// ------------------------------------------------------------------ run
const segs = [];
const failures = [];
const still = (png, sec, name) => {
  const out = path.join(WORK, `${name}.mp4`);
  ff(['-loop', '1', '-framerate', String(FPS), '-t', String(sec), '-i', png, '-vf', `scale=${W}:${H},format=yuv420p,fade=t=in:st=0:d=0.4`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(FPS), out]);
  return { name, file: out, seconds: sec };
};

const titlePng = path.join(WORK, 'title.png'); await titleCard(titlePng);
const endPng = path.join(WORK, 'end.png'); await endCard(endPng);
for (const s of SHOTS) await captionPng(s.cap, s.en, path.join(WORK, `${s.id}-cap.png`), !!s.top);
await capPage.close();
await page.bringToFront();
if (!ONLY || ONLY.includes('title')) segs.push(still(titlePng, 2.5, 'title'));

for (const s of SHOTS) {
  if (ONLY && !ONLY.includes(s.id)) continue;
  log(`shot ${s.id}`);
  try { await s.prep(); } catch (e) { log(`  ! prep ${s.id}: ${e.message}`); failures.push(`prep ${s.id}: ${e.message}`); }
  await page.bringToFront();
  const rec = await record(s.id, s.run, { hold: s.hold, max: s.max || 25000 });
  if (rec.failed) failures.push(`${s.id}: ${rec.failed}`);
  const cap = path.join(WORK, `${s.id}-cap.png`);
  const out = path.join(WORK, `${s.id}.mp4`);
  ff(['-f', 'concat', '-safe', '0', '-i', rec.list, '-i', cap, '-t', rec.seconds.toFixed(3),
    '-filter_complex', `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${FPS},format=yuv420p[v];[v][1:v]overlay=0:0:format=auto,format=yuv420p,fade=t=in:st=0:d=0.25[o]`,
    '-map', '[o]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', String(FPS), out]);
  segs.push({ name: s.id, file: out, seconds: rec.seconds });
}
if (!ONLY || ONLY.includes('end')) segs.push(still(endPng, 5.5, 'end'));
// thumbnail: the title card
fs.copyFileSync(titlePng, OUT.replace(/\.mp4$/, '-thumbnail.png'));
await browser.close();

const concat = path.join(WORK, 'concat.txt');
fs.writeFileSync(concat, segs.map((s) => `file '${s.file}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', concat, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an', OUT]);
const dur = Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT]).toString().trim());
const size = fs.statSync(OUT).size;
console.log('\nsegments:'); for (const s of segs) console.log(`  ${s.name.padEnd(9)} ${s.seconds.toFixed(1)} s`);
console.log(`\nOUT ${OUT}\nduration ${dur.toFixed(2)} s, size ${(size / 1048576).toFixed(1)} MB, work dir ${WORK}`);
if (errors.length) console.log(`page errors (${errors.length}):`, errors.slice(0, 5));
if (failures.length) console.log('shot failures:', failures);
if (dur > HARD_LIMIT) { console.error(`FAIL: ${dur.toFixed(1)} s is over the ${HARD_LIMIT} s hard limit`); process.exit(1); }
