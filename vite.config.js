import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' => dist/ works from any static host or sub-path (GitHub Pages, Netlify, file server).
// Two pages: the game (index.html) and the scholar review dashboard (experts.html, served at /experts by server.mjs).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), experts: resolve(import.meta.dirname, 'experts.html') },
      output: { manualChunks: { three: ['three', 'three/webgpu', 'three/tsl'] } }
    }
  }
});
