// Integrated neighbourhood ("hub") helpers: doors between the walkable town and the interiors, feature spots,
// the journey waypoint and the feature-module registry. Pure functions (no three.js, no DOM) so they are node-testable.

const vec3 = (a, d = [0, 0, 0]) => {
  if (!Array.isArray(a) || a.length < 2) return d;
  if (a.length === 2) return [Number(a[0]) || 0, 0, Number(a[1]) || 0];
  return [Number(a[0]) || 0, Number(a[1]) || 0, Number(a[2]) || 0];
};

/**
 * Doors returned by a hub scene: [{ location, position, radius?, label?, spawn?: { position, yaw } }].
 * `knownLocations` limits targets to real scenes; bad entries are reported through warn() and skipped.
 */
export function normalizeDoors(list, knownLocations, warn = () => {}) {
  const out = [];
  const seen = new Set();
  for (const d of Array.isArray(list) ? list : []) {
    const loc = d && (d.location || d.to);
    if (!loc || !knownLocations.includes(loc)) { warn(`door to unknown location "${loc}" ignored`); continue; }
    if (seen.has(loc)) { warn(`duplicate door to "${loc}" ignored`); continue; }
    seen.add(loc);
    const position = vec3(d.position);
    const spawn = d.spawn && Array.isArray(d.spawn.position)
      ? { position: vec3(d.spawn.position), yaw: Number(d.spawn.yaw) || 0 }
      : { position: [position[0], 0, position[2] + 1.6], yaw: Math.PI }; // default: just outside, facing away (+Z)
    out.push({ kind: 'door', id: `door:${loc}`, location: loc, position, radius: Number(d.radius) || 1.6, label: d.label || null, spawn });
  }
  return out;
}

/** featureSpots: [{ feature, pos | position, label?: {ar,en}, radius? }] -> normalized list (kind 'spot'). */
export function normalizeFeatureSpots(list, warn = () => {}) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((s, i) => {
    if (!s || typeof s.feature !== 'string' || !/^[a-z0-9_-]+$/i.test(s.feature)) { warn(`featureSpot #${i} needs a feature name`); return; }
    out.push({ kind: 'spot', id: `spot:${s.feature}:${i}`, feature: s.feature, position: vec3(s.pos || s.position), radius: Number(s.radius) || 1.5, label: s.label || null });
  });
  return out;
}

/** Spawn point when arriving at the hub from `from` (the door of that building), else null. */
export function doorSpawn(doors, from) {
  const d = (doors || []).find((x) => x.location === from);
  return d ? d.spawn : null;
}

/** The planned next destination: first location of the day's order that is not complete yet (null = all done). */
export function nextDestination(order, isComplete) {
  for (const loc of order || []) if (!isComplete(loc)) return loc;
  return null;
}

/** Feature module registry from an import.meta.glob map ('../features/<name>/index.js' -> loader). */
export function createFeatureRegistry(globMap = {}) {
  const loaders = {};
  for (const [path, load] of Object.entries(globMap || {})) {
    const m = /\/features\/([^/]+)\/index\.js$/.exec(path);
    if (m && typeof load === 'function') loaders[m[1]] = load;
  }
  const cache = {};
  return {
    names: () => Object.keys(loaders),
    has: (name) => !!loaders[name],
    /** Resolves the module or null (missing module or import error never throws). */
    async load(name) {
      if (!loaders[name]) return null;
      if (cache[name]) return cache[name];
      try { cache[name] = await loaders[name](); return cache[name]; } catch (e) { console.error(`[feature:${name}] import failed`, e); return null; }
    }
  };
}
