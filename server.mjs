#!/usr/bin/env node
// Production server for Google Cloud Run: serves the Vite build (dist/) and auto-mounts EVERY Netlify-style
// function in netlify/functions/*.mjs at its original path (/.netlify/functions/<name>), so the browser code is
// unchanged and new functions need no edit here. /experts serves the scholar dashboard (dist/experts.html).
// The handlers are Web-standard (Request) => Response; this file only adapts Node's http objects to them.
//   npm run build && node server.mjs      (PORT defaults to 8080, as Cloud Run expects)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, 'dist');
const FN_DIR = path.join(HERE, 'netlify', 'functions');

/** name -> handler for every netlify/functions/<name>.mjs with a default export (a broken file is skipped, not fatal). */
export async function loadFunctions(dir = FN_DIR) {
  const out = {};
  for (const f of fs.readdirSync(dir).filter((x) => /^[\w-]+\.mjs$/.test(x)).sort()) {
    try {
      const mod = await import(pathToFileURL(path.join(dir, f)).href);
      if (typeof mod.default === 'function') out[f.slice(0, -4)] = mod.default;
    } catch (e) { console.error(`function ${f} failed to load:`, e.message); }
  }
  return out;
}
const FUNCTIONS = await loadFunctions();
const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY = 16 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream',
  '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4'
};

async function runFunction(handler, req, res) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) { res.writeHead(413, { 'content-type': 'application/json' }).end('{"error":"too_large"}'); return; }
    chunks.push(chunk);
  }
  // x-yk-client: rate-limit key for the functions (never stored). Overwrites anything the client sent.
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
  const client = xff[xff.length - 1] || req.socket.remoteAddress || 'anon'; // Cloud Run's front end appends the real client last
  const headers = Object.entries(req.headers).filter(([k]) => k !== 'x-yk-client')
    .flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]]));
  headers.push(['x-yk-client', client]);
  const request = new Request(new URL(req.url, `http://${req.headers.host || 'localhost'}`), {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)
  });
  const response = await handler(request);
  const out = Object.fromEntries(response.headers);
  const cookies = response.headers.getSetCookie?.() || [];
  if (cookies.length) out['set-cookie'] = cookies;
  res.writeHead(response.status, out);
  if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(ROOT, urlPath);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
  // Vite puts content-hashed bundles under /assets/*-<hash>.js|css; everything else revalidates.
  const hashed = /\/assets\/.+-[\w-]{8,}\.(js|css)$/.test(urlPath);
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
  });
  fs.createReadStream(file).pipe(res);
}

// Scholar dashboard: no caching, no framing, no referrer (the queue holds questions from the public).
function serveExperts(res) {
  const file = path.join(ROOT, 'experts.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('dashboard not built (npm run build)'); return; }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow'
  });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://x').pathname;
    const fn = /^\/\.netlify\/functions\/([\w-]+)\/?$/.exec(pathname)?.[1];
    if (fn) {
      if (!Object.hasOwn(FUNCTIONS, fn)) { res.writeHead(404, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end('{"error":"not_found"}'); return; }
      await runFunction(FUNCTIONS[fn], req, res);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    if (pathname === '/experts/' || pathname === '/experts/index.html') { res.writeHead(301, { location: '/experts' }).end(); return; }
    if (pathname === '/experts' || pathname === '/experts.html') { serveExperts(res); return; }
    if (pathname === '/results' || pathname === '/results/') { req.url = '/results.html'; serveStatic(req, res); return; }
    serveStatic(req, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500).end('internal error');
  }
}).listen(PORT, '0.0.0.0', () => console.log(`yawmuk listening on :${PORT}`));
