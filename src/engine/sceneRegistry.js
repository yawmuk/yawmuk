// Scene registry: discovers src/scenes/<location>.js lazily (code-split), falls back to the placeholder.
// A scene file that fails to import never breaks the game — the placeholder room is used instead.
import placeholder from '../scenes/_placeholder.js';

const loaders = import.meta.glob(['../scenes/*.js', '!../scenes/index.js', '!../scenes/_*.js']);

const byId = {};
for (const [path, load] of Object.entries(loaders)) {
  const id = path.split('/').pop().replace(/\.js$/, '');
  byId[id] = load;
}

export const placeholderScene = placeholder;

/** Location ids that have a real scene file. */
export function sceneIds() { return Object.keys(byId); }

/** Resolve the scene definition for a location: { def, isPlaceholder, error? }. Never throws. */
export async function getSceneDef(location) {
  const load = byId[location];
  if (!load) return { def: placeholder, isPlaceholder: true };
  try {
    const mod = await load();
    const def = mod.default || mod.scene || mod;
    if (!def || typeof def.build !== 'function') throw new Error(`src/scenes/${location}.js has no default export with build(ctx)`);
    return { def, isPlaceholder: false };
  } catch (error) {
    console.error(`[scene] failed to load "${location}", using placeholder`, error);
    return { def: placeholder, isPlaceholder: true, error };
  }
}
