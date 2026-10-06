// Node-only (never imported by the browser bundle): resolves the document store for the study + metrics functions.
// Prefers the shared netlify/lib/store.mjs (JSON files in DATA_DIR, or Firestore with STORE=firestore); if that module
// is missing or fails to load, falls back to a minimal JSON-file store in DATA_DIR (default ./data) with the same
// interface: get(coll,id), put(coll,id,doc), del(coll,id), list(coll).
import fs from 'node:fs/promises';
import path from 'node:path';

const SAFE = /^[A-Za-z0-9_-]{1,80}$/;

export function miniFileStore(dir = process.env.DATA_DIR || path.resolve('data')) {
  let chain = Promise.resolve();
  const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  const file = (c) => { if (!SAFE.test(c)) throw new Error('bad collection'); return path.join(dir, `study_fallback_${c}.json`); };
  const read = async (c) => { try { return JSON.parse(await fs.readFile(file(c), 'utf8')) || {}; } catch { return {}; } };
  const write = async (c, obj) => {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${file(c)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(obj), 'utf8');
    await fs.rename(tmp, file(c));
  };
  const idOk = (id) => { if (!SAFE.test(id)) throw new Error('bad id'); };
  return {
    kind: 'study-file',
    get: (c, id) => serial(async () => { idOk(id); return (await read(c))[id] ?? null; }),
    put: (c, id, doc) => serial(async () => { idOk(id); const o = await read(c); o[id] = doc; await write(c, o); return doc; }),
    del: (c, id) => serial(async () => { idOk(id); const o = await read(c); const had = Object.hasOwn(o, id); if (had) { delete o[id]; await write(c, o); } return had; }),
    list: (c) => serial(async () => Object.values(await read(c)))
  };
}

let injected = null;
let shared;
/** Tests inject a store here (null resets). */
export function setStudyStore(s) { injected = s; }

export async function studyStore() {
  if (injected) return injected;
  if (shared === undefined) {
    try {
      const mod = await import('../../../netlify/lib/store.mjs');
      shared = typeof mod.getStore === 'function' ? mod.getStore() : null;
    } catch (e) {
      console.error('study: shared store unavailable, using fallback', e?.message);
      shared = null;
    }
    shared ||= miniFileStore();
  }
  return shared;
}

/** Tiny fixed-window rate limiter keyed by client (in-memory, per instance). */
export function rateLimiter({ max, windowMs }) {
  const hits = new Map();
  return (key = 'anon') => {
    const t = Date.now();
    const h = hits.get(key);
    if (!h || t - h.start >= windowMs) {
      if (hits.size > 5000) hits.clear();
      hits.set(key, { start: t, n: 1 });
      return true;
    }
    h.n += 1;
    return h.n <= max;
  };
}
