#!/usr/bin/env node
// Minimal zero-dependency static file server for the production build (dist/).
// Used by the e2e test and for checking that `npm run build` output works without Vite.
//   node tools/serve.mjs [dir=dist] [port=4173]
// Exported startServer() is used by tests/e2e/playthrough.mjs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json'
};

export function startServer(dir = 'dist', port = 0) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.join(root, urlPath);
      if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir = 'dist', port = '4173'] = process.argv.slice(2);
  if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error(`${dir}/index.html not found: run "npm run build" first`); process.exit(1); }
  startServer(dir, Number(port)).then((s) => console.log(`Serving ${path.resolve(dir)} at ${s.url}  (Ctrl+C to stop)`));
}
