// Tiny document store for the scholar-review loop (questions, answers, ruling review records).
// One interface, two adapters:
//   - JSON files (default): one file per collection in DATA_DIR (default ./data). Writes are serialised in-process
//     and atomic (tmp + rename). Good for local dev, tests and a single Cloud Run instance with a mounted volume.
//     On plain Cloud Run the disk is ephemeral and per-instance: data is lost on restart/scale -> use Firestore there.
//   - Firestore (STORE=firestore): REST API with an Application Default Credentials token from the Cloud Run
//     metadata server (no SDK dependency). Each document is stored as one string field "json".
//     Project from GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT / FIRESTORE_PROJECT, else from the metadata server.
// Interface: get(coll, id) -> doc|null, put(coll, id, doc) -> doc, del(coll, id) -> bool, list(coll) -> doc[]
// Collections and ids are restricted to [A-Za-z0-9_-] so neither adapter can be steered to another path.
import fs from 'node:fs/promises';
import path from 'node:path';

const SAFE = /^[A-Za-z0-9_-]{1,80}$/;
function check(coll, id) {
  if (!SAFE.test(coll)) throw new Error('bad collection');
  if (id !== undefined && !SAFE.test(id)) throw new Error('bad id');
}

// ---------------------------------------------------------------- JSON file adapter
export function fileStore(dir = process.env.DATA_DIR || path.resolve('data')) {
  const cache = new Map(); // coll -> Map(id -> doc)
  let chain = Promise.resolve();
  const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  const fileOf = (coll) => path.join(dir, `${coll}.json`);

  async function load(coll) {
    if (cache.has(coll)) return cache.get(coll);
    let m = new Map();
    try {
      const obj = JSON.parse(await fs.readFile(fileOf(coll), 'utf8'));
      if (obj && typeof obj === 'object') m = new Map(Object.entries(obj));
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('store: unreadable', coll, e.message);
    }
    cache.set(coll, m);
    return m;
  }
  async function save(coll) {
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${fileOf(coll)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(Object.fromEntries(cache.get(coll))), 'utf8');
    await fs.rename(tmp, fileOf(coll));
  }
  return {
    kind: 'file',
    async get(coll, id) { check(coll, id); return serial(async () => structuredClone((await load(coll)).get(id) ?? null)); },
    async put(coll, id, doc) {
      check(coll, id);
      return serial(async () => { (await load(coll)).set(id, structuredClone(doc)); await save(coll); return doc; });
    },
    async del(coll, id) {
      check(coll, id);
      return serial(async () => { const m = await load(coll); const had = m.delete(id); if (had) await save(coll); return had; });
    },
    async list(coll) { check(coll); return serial(async () => [...(await load(coll)).values()].map((d) => structuredClone(d))); }
  };
}

// ---------------------------------------------------------------- Firestore REST adapter (Cloud Run, ADC)
// Not exercised by the unit tests (needs Google credentials); the JSON adapter is the tested default.
export function firestoreStore() {
  const META = 'http://metadata.google.internal/computeMetadata/v1';
  let token = null, tokenExp = 0, project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIRESTORE_PROJECT || null;
  const meta = async (p) => {
    const r = await fetch(`${META}/${p}`, { headers: { 'Metadata-Flavor': 'Google' } });
    if (!r.ok) throw new Error(`metadata ${r.status}`);
    return r;
  };
  async function auth() {
    if (!token || Date.now() > tokenExp) {
      const t = await (await meta('instance/service-accounts/default/token')).json();
      token = t.access_token; tokenExp = Date.now() + (Number(t.expires_in) - 60) * 1000;
    }
    project ||= (await (await meta('project/project-id')).text()).trim();
    return { token, base: `https://firestore.googleapis.com/v1/projects/${project}/databases/${encodeURIComponent(process.env.FIRESTORE_DATABASE || "(default)")}/documents` };
  }
  async function call(method, sub, body) {
    const { token: tk, base } = await auth();
    const r = await fetch(`${base}/${sub}`, {
      method, headers: { authorization: `Bearer ${tk}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`firestore ${method} ${r.status}`);
    return r.json();
  }
  const decode = (d) => { try { return JSON.parse(d?.fields?.json?.stringValue ?? 'null'); } catch { return null; } };
  return {
    kind: 'firestore',
    async get(coll, id) { check(coll, id); return decode(await call('GET', `yawmuk_${coll}/${id}`)); },
    async put(coll, id, doc) { check(coll, id); await call('PATCH', `yawmuk_${coll}/${id}`, { fields: { json: { stringValue: JSON.stringify(doc) } } }); return doc; },
    async del(coll, id) { check(coll, id); const had = !!(await call('GET', `yawmuk_${coll}/${id}`)); if (had) await call('DELETE', `yawmuk_${coll}/${id}`); return had; },
    async list(coll) {
      check(coll);
      const out = [];
      let pageToken = '';
      for (let i = 0; i < 20; i++) { // <= 6000 docs; plenty for a review queue
        const r = await call('GET', `yawmuk_${coll}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
        for (const d of r?.documents || []) { const v = decode(d); if (v) out.push(v); }
        pageToken = r?.nextPageToken;
        if (!pageToken) break;
      }
      return out;
    }
  };
}

let store = null;
export function getStore() {
  store ||= process.env.STORE === 'firestore' ? firestoreStore() : fileStore();
  return store;
}
/** Tests: inject a store (or null to reset to env default). */
export function setStore(s) { store = s; }
