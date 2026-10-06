# Yawmuk engine: guide for scene authors

This guide is for anyone writing `src/scenes/<location>.js`. The scene contract is defined in `docs/TEAM_BRIEF.md`. Hotspot IDs, NPC IDs and layouts come from `docs/hotspots.md`. The asset library (props, HDRIs, PBR textures) is described in `docs/ASSETS.md` and indexed by `public/assets/catalog.json`. This file covers the API the engine provides and the rules it enforces.

> **Rule 1:** your file is the only one you touch. Do not edit `src/engine/**`, `src/scenes/index.js` or `_placeholder.js`. If you need something from the engine, write it in your report.
> **Rule 2 (phase 4):** use the asset library through `ctx.place` / `ctx.loadModel` / `ctx.pbr` / `ctx.loadTexture`, and the engine's characters through `npcs` / `ctx.makeCharacter`. Never load files from outside `public/assets/` and never from the network. Procedural geometry (`box`, `wall`, `room`…) is still fine for walls, floors and anything the library lacks.

---

## 1. Quick start

```bash
npm install
npm run dev                                   # http://localhost:5173
# jump straight into your location (skips the start screen):
http://localhost:5173/?scene=home
http://localhost:5173/?scene=home&nointro=1&lang=en&debug=1&quality=high
npm run build                                 # must stay error-free
```

| URL param | Effect |
|---|---|
| `scene=<location>` | Skip the start screen and load that location directly. |
| `nointro=1` | Skip the location intro card. |
| `lang=ar` / `lang=en` | Force the language. The default is Arabic (RTL). |
| `quality=low\|medium\|high` | Force a render quality tier (see §7). It is remembered in localStorage. |
| `debug=1` | Draw every collider as a magenta box and every hotspot or exit radius as a cyan ring. Scene warnings appear as toasts, and the console logs mesh and triangle counts. A model that fails to load shows as a magenta cube. |
| `fixtures=1` | Ignore `content/` and use the engine test fixtures. |
| `scene=town` | Start in the neighbourhood hub (also `scene=mosque`, `scene=bank`). |

Debug helpers are available in the browser console as `window.yawmuk`:

```js
yawmuk.goto('school')        // load a location (no intro card)
yawmuk.teleport('exam_desk') // put Adam on a hotspot ('exit' works too)
yawmuk.interact()            // same as pressing E
yawmuk.stats()               // { meshes, tris } of the active scene
yawmuk.perf()                // { fps, frameMs, quality, calls, tris, characters, textures, geometries } (whole frame)
yawmuk.setQuality('medium')  // switch tier live; yawmuk.quality reads it
yawmuk.inspect([x,y,z], [x,y,z]) / yawmuk.resume()   // free camera for screenshots
yawmuk.scenes.active         // the validated scene: hotspots, colliders, npcs, exit, bounds, occluders…
yawmuk.events                // event hub: 'load:progress' {loaded,total,label}, 'load:done', 'quality', …
yawmuk.contentIssues         // problems found in content/*.json
```

**Visual QA tools** (need `npm run dev` running):

```bash
node tools/characters/gameshot.mjs --out=scratch/shots --tag=mine --quality=high --scenes=home   # spawn / overview / NPC close-up + perf
open http://localhost:5173/tools/characters/lab.html?set=main     # character lineup (sets: main, hijab, poses)
```

**Headless check:** the Chrome extension cannot reach localhost. Use local headless Chrome (puppeteer-core, as the tools above and `npm run test:e2e` do).

---

## 2. The contract

```js
// src/scenes/home.js
export default {
  id: 'home',
  title: { ar: 'المنزل', en: 'Home' },
  async build(ctx) {                                      // may be async (or return a plain object, as before)
    ctx.room({ w: 12, d: 10, h: 2.8, floor: ctx.pbr('wood_floor', { size: [12, 10] }), wall: ctx.pbr('plaster', { size: [12, 2.8], color: '#efe6d8' }) });
    ctx.place('sofa', { position: [2, 0, -3], yaw: Math.PI, collider: true });
    // …create meshes, add them to ctx.group…
    return {
      group: ctx.group,                                   // THREE.Group (required; ctx.group is ready-made)
      spawn: { position: [0, 0, 3], yaw: 0 },             // where Adam appears; yaw 0 = facing -Z
      colliders: [{ min: [x, y, z], max: [x, y, z] }],    // extra AABBs (merged with addCollider/collide:true/place collider)
      hotspots: [{ id: 'laptop', position: [0, 0.85, -1.5], radius: 1.6, label: { ar: 'اللابتوب', en: 'Laptop' } }],
      npcs: [{ id: 'sara', position: [0.9, 0, -2.2], yaw: Math.PI, look: { sex: 'female', skin: '#c68642', shirt: '#e8dcc4', hijab: '#5b7b5a', dress: '#3b3b55' } }],
      exit: { position: [4.5, 0, 4.3], radius: 1.5 },
      lights: 'day',                                      // 'day' | 'evening' | 'night'
      environment: { hdri: 'studio', intensity: 0.5 },    // optional: image-based lighting override (see §6)
      sky: '#cfd9e6',                                     // optional: overrides the preset background colour
      fog: { color: '#cfd9e6', near: 30, far: 100 },      // optional: overrides the preset fog (any subset)
      cameraOccluders: [wallProxyMesh],                   // optional: Mesh/Group or array; extra camera blockers (see §5)
      playerLook: { jacket: '#1f2d4d' },                  // optional: merged over PLAYER.look for this scene only (see §10)
      update(dt, t) {},                                   // optional, every frame (dt seconds, t elapsed seconds)
      dispose() {}                                        // optional, free anything the engine can't see
    };
  }
};
```

### Loading order (what happens when a location loads)

1. The loading veil appears; `yawmuk.events` emits `load:progress { loaded, total, label }` as things arrive (the UI draws the bar).
2. The asset catalog and the character library are loaded (once per session; cached).
3. `build(ctx)` runs. It may be `async` and `await` assets. **Every `ctx.place / loadModel / loadTexture / pbr` started inside `build` is awaited automatically** before the scene is shown, so you can fire them without awaiting.
4. The engine validates the result, builds NPCs, markers and colliders, applies lights + the HDRI environment, pre-compiles shaders, frees cached assets the previous location used but this one does not, and emits `load:done`.
5. If your module fails to import, `build()` throws/rejects, or returns nothing, the engine logs the error, disposes what was built and loads the placeholder room. A single asset that fails to load only produces a warning (magenta cube in `?debug=1`); the scene still loads.

### What the engine does with the result (you do not need to do these)

- **Hotspot markers.** For every hotspot that the location script uses, the engine places a glowing ring on the floor, a floating gem and a name label. Markers turn green once that hotspot's situation is done. **Do not draw your own marker.** Draw the object itself.
  - `position[1]` is the object's height. The ring is always at y=0; the gem floats at `max(2.1, y + 1.2)`. `markerHeight` sets the gem height.
  - Distance checks are 2D (XZ only). Interaction is possible when Adam is within `radius` (default 1.5).
  - A hotspot your scene defines but the script does not use gets no marker and only a warning. A hotspot the script needs but your scene lacks is **auto-placed** near spawn with a warning (treat as a bug).
- **NPCs.** The engine builds each NPC as an animated character from `look` (§4), places it, adds a 0.56 m collider (`collide: false` skips it), plays a subtly varied idle (`animate: false` keeps it still-ish: no wave/ambient reactions) and shows the name from the script's `npc.name` (or your `name`; `showName: false` hides it).
  - **During a situation** the speaking NPC smoothly turns to face Adam (seated NPCs only turn their head), keeps looking at him, and plays a talking gesture **while their line is on screen**; Adam gestures on his own lines.
  - **While exploring**, NPCs within 4 m follow Adam with their head, and a speaking NPC waves the first time Adam comes within 3 m.
  - NPC entry options: `pose: 'sit'` (or `seated: true`, or `look.seated`) seats the character (see §4), `sitArms: 'lap' | 'desk'`, `anim: 'wave' | 'talk' | 'interact'` loops that animation.
  - IDs starting with `bg_` are background extras: no name label, never speak, and they are built as **one merged mesh (1 draw call)**.
  - `object: someObject3D` uses your own figure (e.g. one from `ctx.makeCharacter` that you dressed with props); the engine positions it. If it is a character, talking/turning still work.
- **NPC stations (one NPC in several situations).** Add `stations: { <hotspotId>: { position, yaw } }`. The NPC stands at the station of the first unfinished hotspot (script order), moves behind a short fade when a situation finishes, and is moved instantly if the player triggers a later station first. Collider and label follow.
- **Exit.** Teal marker, **locked (grey) until every situation in the location is done**; then the outro card leads to `next_location` (`null` → final summary).
- **Bounds.** The player is clamped to the bounding box of your group plus colliders, with a 0.5 m margin.
- **Lighting.** See §6. Without `lights`, the preset comes from the script's `time_of_day` (17:00+ evening, 20:00+ night).
- **Disposal.** On unload the engine disposes every geometry, material and texture in your group **except shared ones** (`userData.shared = true`: `ctx.mats.*`, `mats.color()`, character parts, and everything loaded through the asset cache). Cached assets that the next location does not use are freed automatically. Use `dispose()` only for things outside the group.
- **Fault tolerance.** If `update()` throws, it is disabled for that scene.

---

## 3. The `ctx` API

| Member | Signature | Notes |
|---|---|---|
| `THREE` | the `three` module | Use this. Do not import a second copy. |
| `group` | `THREE.Group` | The default parent for all helpers. Return it as `group`. |
| **`place(id, opts)`** | `→ Group` (filled when loaded; `.ready` is a Promise) | Puts a library model in the scene. `opts: { position:[x,y,z], yaw, scale, castShadow=true, receiveShadow=true, collider=false\|true\|'auto', occluder=false\|'box', parent, name, faceCorrect=true }`. Props are already in metres with a bottom-centre pivot: place at y = 0 (floor) or the top of what they stand on. `collider: true` adds one AABB from the model's world bounds (after yaw/scale); `'auto'` adds one AABB per mesh part (overlapping parts merged; parts above 1.7 m or under 0.15 m ignored). `occluder: 'box'` adds an invisible bounds box to the camera-occlusion set. If the catalog records the asset's forward axis (`forward: '+Z'` etc.), the model is pre-rotated so that **yaw 0 = its front faces −Z** (pass `faceCorrect: false` to keep the source orientation). |
| **`loadModel(id)`** | `→ Promise<Object3D>` | A fresh clone of a catalog id (`'sofa'`) or a path under `public/` (`'assets/props/kenney-furniture/sofa.glb'`). Geometry/materials are shared with the cache: to recolour, use `mesh.material = mesh.material.clone()` and set `userData.shared = false` on the clone. Skinned models are cloned with `SkeletonUtils`; clips are in `model.userData.animations`. Meshopt/Draco/quantized GLBs all work. |
| **`pbr(name, opts)`** | `→ MeshStandardMaterial` | A PBR material from a texture set (`'wood_floor'`, `'plaster'`, `'brick'`… or `'tex_wood_floor'`). Returned immediately; the maps fill in when they arrive (the scene waits for them). `opts: { size:[w,h] metres` (repeat computed from the texture's real tile size) `\| repeat:[u,v], color, roughness, metalness, … }`. Owned by your scene (disposed on unload). |
| **`loadTexture(name, opts)`** | `→ Promise<{ map, normalMap, roughnessMap, aoMap?, metalnessMap? }>` | The raw maps (each a per-call clone with its own repeat; `opts.size` / `opts.repeat` as above). `map` is sRGB, the rest linear. |
| **`catalog`** | `{ entries, raw }` | The parsed `public/assets/catalog.json` (`entries[id] = { file, kind: 'prop'\|'texture'\|'hdri', dims_m, tags, triangles, … }`). Use `ctx.catalogEntry(id)` for lookups (accepts ids without the `tex_` / `hdri_` prefix). |
| **`makeCharacter(look, opts?)`** | `→ Character` | An animated character (see §4). Add `character.root` to your group. Use it for figures that are not script NPCs (crowds, seated extras), or build an NPC yourself and pass `object: character.root`. |
| `makeNPC(look)` | `→ Group` | Compatibility wrapper: returns `makeCharacter(look).root` (falls back to the old box figure if the character library failed to load). Its `userData.parts` still works (§4.4). |
| `mats` | object of shared `MeshStandardMaterial`s | See the list below. **Never mutate them.** Use `.clone()` or `mats.color()`. |
| `mats.color(hex, opts?)` | `→ Material` | A cached shared material for any colour, e.g. `mats.color('#2f6f7e', { roughness: .5 })`. |
| `box(w,h,d, mat, x,y,z, opts?)` | `→ Mesh` | **(x,y,z) is the bottom centre**, so `y=0` sits on the floor. |
| `cyl(rTop,rBot,h, mat, x,y,z, opts?)` | `→ Mesh` | Bottom centre. `opts.segments` defaults to 12. |
| `sphere(r, mat, x,y,z, opts?)` | `→ Mesh` | (x,y,z) is the centre. |
| `ground(w,d, mat, x=0, z=0, y=0, opts?)` | `→ Mesh` | A horizontal plane that receives shadows. Not a collider. |
| `wall(x1,z1, x2,z2, h=3, thick=0.2, mat, opts?)` | `→ Mesh` | A straight wall between two floor points; **collides by default**. Keep walls axis-aligned. |
| `room({ w, d, h, x, z, floor, wall, ceiling, thick, doors })` | `→ { floor, walls }` | Floor + 4 colliding walls. `doors: [{ side: 'n'\|'s'\|'e'\|'w', at: 0, width: 1.4, height: 2.2 }]` (n = −Z, s = +Z, e = +X, w = −X; `at` = offset from the wall centre). |
| `addCollider(target)` | `→ {min,max}` | `Object3D` (world AABB), `THREE.Box3`, `{min,max}` or `(minArr, maxArr)`. |
| `addModelColliders(obj, mode)` | `→ collider(s)` | What `place(..., {collider})` uses, for models you loaded yourself. |
| `makeLabel(text, opts?)` | `→ Sprite` | `text` is a string or `{ar,en}`; re-renders on language change. `opts: { size=0.32, color, background (css \| false), depthTest=true }`. Label materials skip tone mapping (`toneMapped: false`, crisp colours) and are still hidden behind walls. |
| `rand(seed)` | `→ () => [0,1)` | Deterministic PRNG for scattering decor. |
| `yawTo([x,z], [x,z])` | `→ yaw` | The yaw that makes something at A face B. |
| `script` | the location script JSON | Includes `situations[].hotspot`, `npc`, `time_of_day` and so on. |
| `location`, `lang`, `tr(obj)`, `debug`, `isMobile`, `quality` | | `quality` is the render tier (`'low'\|'medium'\|'high'`): drop decorative detail on `'low'`. |
| `renderer` | `THREE.WebGPURenderer` (WebGPU or WebGL2 backend) | Read-only use (e.g. `getMaxAnisotropy()`). |
| `colliders` | array | Raw access to the collider list. |

**`opts` shared by `box`, `cyl`, `sphere`, `ground` and `wall`:** `{ collide: bool, cast: true, receive: true, rotY: radians, parent: Object3D, name }`.

**`ctx.mats` palette:** `wall, wallWarm, wallBlue, wallGreen, ceiling, floor (wood), floorTile, carpet, concrete, sidewalk, asphalt, brick, roofTile, grass, leaf, trunk, water, dirt, wood, woodDark, woodLight, metal, steel, chrome, gold, glass (transparent), plastic, black, white, paper, screen (emissive blue), screenOff, lampGlow (emissive), fabricRed, fabricBlue, fabricGreen, fabricBeige, fabricGray, fabricPurple, paintWhite, paintYellow, paintRed, paintGreen, paintBlue`.

**Texture sets** (catalog, `real_size_m` = metres per tile): `wood_floor`, `laminate`, `parquet`, `floor_tiles`, `carpet`, `plaster`, `asphalt`, `sidewalk`, `brick`, `siding`, `grass`, `snow`. Always pass `size` (the surface size in metres) so tiles have real-world scale.

---

## 4. Characters

Rigged, animated low-poly humans: **Quaternius "Ultimate Modular Men / Women" (CC0)**, see `public/assets/characters/LICENSES.md`. All characters share one rig per sex and one set of clips; the engine assembles each look from modular parts (head / body / legs / feet), tints them, adds fitted accessories and merges pieces by colour (≈ 4–7 draw calls per character, 1 for `bg_` extras). Feet are at y = 0 and the character **faces −Z at `rotation.y = 0`** (same convention as `yaw`).

### 4.1 `look`

```js
{
  sex: 'male' | 'female',          // RECOMMENDED. If missing it is guessed: hijab/dress/skirt -> female; beard/kufi/suit/tie -> male;
                                   //   otherwise height < 1.4 -> boy, < 1.7 -> woman, else man
  skin: '#c68642', hair: '#2b1d14' | false,      // hair:false = bald
  hairStyle: 'short' | 'spiky' | 'bun' | 'bald'  (men) | 'long' | 'bun' (women)   // default: varied per look
  shirt: '#3a6ea5', pants: '#2f3542', shoes: '#1e1e1e',
  sleeves: 'long' (default) | 'short',
  suit: true | '#hex', tie: '#hex' | false,      // men: suit jacket + trousers (+ tie)
  jacket: true | '#hex',                         // open jacket, no tie (e.g. winter coat). Women: jacket-coloured long-sleeve top
  hoodie: true,                                  // men: hoodie top (colour = shirt)
  shorts: true, boots: true,                     // men
  dress: true | '#hex', skirt: true,             // women: long A-line skirt to the ankles (colour = dress)
  hijab: true | '#hex', hijabColor: '#hex', hijabRim: '#hex',   // head + neck wrap with face opening and shoulder drape,
                                                 //   plus a thin underscarf band (hijabRim, default: darker shade)
  kufi: true | '#hex', beanie: true | '#hex', santaHat: true | '#hex',
  beard: true | '#hex', beardStyle: 'full' | 'short',
  glasses: true | '#hex',
  height: 1.75,                                  // metres. < 1.4 = child (larger head ratio)
  build: 1,                                      // width factor (0.9 slim … 1.15 broad)
  seated: true, sitArms: 'lap' | 'desk'          // or use the NPC entry's pose:'sit'
}
```

Heights from `docs/hotspots.md`: men 1.75–1.85, women 1.62–1.70, elderly a little shorter, children 1.1–1.2. Muslim women characters should get `hijab` + `dress` (long skirt and long sleeves, the default).

### 4.2 The `Character` object

```js
const c = ctx.makeCharacter({ sex: 'male', skin: '#8d5524', suit: '#6e6e73', beard: '#1d1410', height: 1.8 });
c.root.position.set(2, 0, -1); c.root.rotation.y = Math.PI; ctx.group.add(c.root);
c.play('idle' | 'talk' | 'listen' | 'wave' | 'interact' | 'sit' | 'stand');   // 'wave'/'interact' play once; play('wave', { once:false }) loops
c.setLocomotion(1.3);         // m/s: blends idle -> walk -> run, playback speed matched to the speed (if you move a character yourself)
c.turnTo(yaw);                // smooth turn; c.lookAt(vector3 | null) head tracking
c.bones.Head                  // THREE.Bone (names: Hips, Torso, Chest, Neck, Head, UpperArmL/R, LowerArmL/R, WristL/R, UpperLegL/R, LowerLegL/R, FootL/R…)
c.appearance                  // { sex, parts, colors, shirt, jacket, beard, kufi, hijab, accessories, seated }
```

- **Props in hands / on heads:** attach to a bone, e.g. `c.bones.WristR.add(mug)`. Bone space is not metres-up-Y (the rig has its own axes): for simple cases prefer the legacy `parts` groups below, which give you a normal metre frame that follows the bone.
- **Seated:** `play('sit')` bends hips and knees and lowers the body so the feet rest on the floor (seat height ≈ 0.47 m × height/1.78). Place the character at the chair's floor position (y = 0), facing away from the backrest. The upper body keeps breathing and can still `talk`.
- Characters are updated by the engine every frame (only when on screen). Do not call `update()` yourself.

### 4.3 Animations available

Idle (two variants, randomly chosen and time-offset per character), Walk, Run, Wave, Interact (reach forward) — from the pack. Talk (open-hand gestures, nods), Listen, Sit and head look-at are procedural layers on top.

### 4.4 Legacy `makeNPC(look).userData.parts`

Old scenes posed `parts = { head, body, armL, armR, legL, legR }`. These still work: each is a group in the old figure's frame (metres, old proportions) that **follows the matching bone**. Children you add move with the bone; their transforms are applied to the skeleton:
`legL/legR.rotation.x` (≈ π/2) seats the legs (knees bend automatically; keep lowering the figure as before), `armL/armR.rotation.x/z` swing the arm, `head.rotation` turns the head, `body.position.y` lowers the body. Prefer the new API (`pose: 'sit'`, `look.beanie`, `look.santaHat`…) in new code.

---

## 5. Conventions

- **Units:** metres. **Y is up. The floor is y=0.** +X is right and +Z is toward the camera at spawn when spawn yaw is 0.
- **Yaw:** radians around +Y. `0` faces −Z, `Math.PI` faces +Z, `Math.PI/2` faces −X and `-Math.PI/2` faces +X. `ctx.yawTo(from, to)` computes it for you.
- **Colliders:** axis-aligned boxes. The player is a circle with r = 0.3 in XZ. A collider only blocks the player if `max.y > 0.25` and `min.y < 1.7`. Leave walkways **at least 1.2 m** wide. For rotated library props prefer `collider: 'auto'` or explicit boxes (a 45° AABB is large).
- **Camera:** third person, orbiting at 2.4–10 m. Occlusion uses a ray from the camera to Adam against your scene's **large opaque meshes** (bounding-sphere radius ≥ 0.9 m and ≤ 2000 triangles) plus `cameraOccluders` and `place(..., { occluder: 'box' })` proxies. The ray honours `material.side` (single-sided cut-away walls never pull the camera in; `DoubleSide` always blocks; `BackSide` and transparent < 0.6 never block). `mesh.userData.noCameraCollide = true` excludes a mesh; `cameraCollide = true` includes a small/instanced one. Characters never block the camera. Library models above 2000 triangles (houses, cars) need `occluder: 'box'` or a proxy if they should block.
- **Text in the world:** only `makeLabel`. Do not bake text into textures (it would not switch language).

## 6. Lighting and environment

Each preset = sun (shadow-casting directional light following Adam, 32 × 32 m frustum) + a weak hemisphere fill + **image-based lighting from an HDRI** (PMREM) + fog/background colour:

| `lights` | HDRI (`public/assets/env/hdri`) | Notes |
|---|---|---|
| `day` | `hdri_snow_day` (snowy park) | Ohio winter morning |
| `evening` | `hdri_suburb_dusk` | warm low sun |
| `night` | `hdri_city_night` | cool, low sun intensity |

Override per scene with `environment: { hdri: 'studio' | 'ballroom' | 'suburb_day' | 'snow_day' | 'suburb_dusk' | 'city_night' | <catalog id or path>, intensity: 0.5, background: false, blur: 0.25 }`. `background: true` shows the (blurred) HDRI as the sky; otherwise `sky` / the preset colour is used. Interiors usually look best with `studio` (neutral) or `ballroom` (warm) at 0.4–0.6. If an HDRI fails, a neutral RoomEnvironment is used.

Materials: use `MeshStandardMaterial` (the IBL needs it). Emissive surfaces with `emissiveIntensity` > 1 (lamps, screens, candles) get a soft **bloom** on medium/high. Keep metals rare (`metalness` 0–0.2 for most props); fully metallic surfaces reflect the HDRI.

## 7. Rendering and quality tiers

Tone mapping ACES Filmic, sRGB output, PCF soft shadows. Post-processing via `postprocessing` + N8AO:

| Tier | Auto-selected for | Post-processing | Shadow map | Pixel ratio |
|---|---|---|---|---|
| `low` | phones/tablets (coarse pointer), software GPUs | none (renderer tone mapping, native MSAA); characters merged into one mesh each, NPCs cast no shadows | 1024 | ≤ 1.25 |
| `medium` | integrated GPUs (Intel/Apple/Mali/Adreno) | half-res N8AO (ambient occlusion), bloom, SMAA, mild grade | 2048 | ≤ 1.5 |
| `high` | other desktop GPUs | full-res N8AO, bloom, SMAA, mild grade, vignette | 2048 | ≤ 2 |

Override with `?quality=` or `yawmuk.setQuality()` (persisted). In auto mode the engine steps down one tier after 4 s below 28 fps. Measured on an Intel UHD 620 (1366×768): low 60 fps (vsync), medium 38–45 fps, high 27–33 fps.

## 8. Performance budget (one scene)

| Item | Budget |
|---|---|
| Scene triangles (`yawmuk.stats().tris`, incl. characters) | **≤ 150k** on high, aim for ≤ 100k. One character ≈ 6–8k tris (with accessories). Current scenes: 34k–101k. |
| Draw calls (`yawmuk.perf().calls`, whole frame incl. shadow + post passes) | ≤ 350 desktop; ≤ 250 on `low`. A character costs 4–7 calls (+ the same in the shadow pass); `bg_` extras cost 1. Merge or instance repeated procedural props; library props are usually 1–3 meshes. |
| Characters | ≤ 12 full NPCs + ≤ 10 `bg_` extras in view. |
| Lights | Use the engine's sun + IBL. Add **no shadow-casting lights**; at most 3 `PointLight`/`SpotLight` for mood (`castShadow = false`). Prefer emissive materials + bloom for lamps. |
| Textures | Library texture sets are 1k WebP; keep ≤ 6 sets per scene (≈ 4 MB each in GPU memory). Canvas textures ≤ 512 px. |
| Footprint | Interiors 10–25 m. Outdoor maps ≤ 60 m across. |
| Per-frame `update` | Cheap. Do not allocate in the loop and do not create geometry per frame. |

## 9. A minimal complete example

```js
// src/scenes/work.js — minimal but complete (phase 4 style)
export default {
  id: 'work',
  title: { ar: 'العمل', en: 'Work' },
  async build(ctx) {
    const { mats, room, place, pbr, makeLabel } = ctx;
    room({ w: 18, d: 12, h: 3, floor: pbr('carpet', { size: [18, 12] }), wall: pbr('plaster', { size: [18, 3], color: '#e8edf2' }),
           doors: [{ side: 's', at: 7, width: 1.6 }] });
    place('desk', { position: [-1, 0, 1.5], collider: true });
    place('office_chair', { position: [-1, 0, 2.2], yaw: Math.PI });
    place('drinks_fridge', { position: [-8.4, 0, -1], yaw: Math.PI / 2, collider: true });

    const sign = makeLabel({ ar: 'مخرج', en: 'EXIT' }, { size: 0.3, background: '#1e8449' });
    sign.position.set(7.5, 2.6, 5.8); ctx.group.add(sign);

    return {
      group: ctx.group,
      spawn: { position: [-7, 0, 5], yaw: -Math.PI / 2 },
      hotspots: [
        { id: 'coffee_machine', position: [-7.5, 1.1, -0.2], radius: 1.6 },
        { id: 'adam_desk', position: [-1, 0.8, 2.3], radius: 1.6 },
        { id: 'hr_desk', position: [6.5, 0.8, -3.2], radius: 1.8 }
      ],
      npcs: [
        { id: 'jake', position: [-6.7, 0, -0.2], yaw: ctx.yawTo([-6.7, -0.2], [-7, 5]), look: { sex: 'male', skin: '#f1c27d', shirt: '#a83232', beard: '#c9a45c', build: 1.1 } },
        { id: 'bg_coworker1', position: [2, 0, -2], yaw: 0, pose: 'sit', sitArms: 'desk', look: { sex: 'female', skin: '#5a3a22', shirt: '#c9a227', hijab: '#3a3a5a', dress: '#2f3542', height: 1.65 } }
      ],
      exit: { position: [7.5, 0, 5], radius: 1.5 },
      lights: 'day',
      environment: { hdri: 'studio', intensity: 0.5 }
    };
  }
};
```

## 10. Checklist before you hand in

1. `?scene=<you>&debug=1` loads with **no** "auto-placed", "not provided" or "asset … failed" toasts.
2. Every hotspot ID and NPC ID matches `content/script/<you>.json` and `docs/hotspots.md` exactly.
3. You can walk from spawn to each hotspot and then to the exit without getting stuck. Magenta boxes match the visible geometry.
4. The camera never ends up inside a wall that hides Adam (orbit with the mouse near walls).
5. `yawmuk.stats()` / `yawmuk.perf()` are within budget on `?quality=high` and the scene stays playable on `?quality=low`; `npm run build` passes.
6. Switch the language (menu ☰). Your labels switch with it.
7. `goto` another location and back three times: memory (`yawmuk.perf().geometries/textures`) should not grow, and the console shows no errors.

## 11. The player character, ruling-card extras and end screen

- **Adam's look** is `PLAYER` in `src/engine/config.js` (`look` takes any option of §4.1). A scene can return `playerLook: { jacket: '#1f2d4d' }`, merged over `PLAYER.look` while that scene is loaded. Adam uses the same character system: idle → walk → run blending with foot speed matched to his velocity (walk 2.3 m/s, run 5.2 m/s, no root motion).
- The **ruling card** shows `newcomer_explainer` ("In plain words") when present. (`common_ground` was removed on 2026-10-06 and is never rendered.)
- Scientific-reference-package fields: `content_level` (A–D) renders as a badge with a tooltip; `verdict_scope` renders under the verdict seal; `explanatory_notes` render under «شرح توضيحي — ليس نصاً شرعياً» / "Explanatory note — not a scriptural text"; `consensus_sources` render as "Sources reporting consensus"; a madhhab entry with `reference_status: "pending_verification"` shows a "Reference pending verification" badge. `confidence: high` is only shown next to an "AI-prepared, not scholar-reviewed" badge (unless a scholar review is recorded).
- The **end screen** shows what Adam learned, a suggested next topic (`THEMES` in `config.js`) and a referral to a local mosque or Islamic center. The game never asks about or stores the player's beliefs.
- Label keys come from `content/script/ui_strings.json` (`i18n.js` `UI_MAP` lists them; each falls back to a built-in default).

## 12. Engine architecture (for reference)

```
src/main.js                 boot -> engine/game.js
src/engine/
  game.js                   flow controller: start -> intro -> location loop -> summary; frame loop; window.yawmuk;
                            dialogue watcher (talk/listen), NPC look-at/wave
  world.js                  renderer, camera, LIGHT_PRESETS (+HDRI), quality tiers, postprocessing (N8AO, bloom, SMAA,
                            tone mapping, grade, vignette), label overlay pass, adaptive tier, tick loop
  assets.js                 glTF (meshopt/Draco) / texture / HDR loading with cache, purge, catalog, progress sessions
  characters.js             character library (male/female.glb), look -> parts/colours, assembly, Character (mixer,
                            locomotion, talk/sit/look-at layers, legacy parts), updateCharacters()
  accessories.js            fitted hijab, kufi, beanie, Santa hat, beard, glasses, skirt, sleeves, trousers
  events.js                 window.yawmuk.events hub (load:progress, load:done, quality)
  sceneManager.js           async build, validation, NPCs, markers, bounds, occluders, environment, dispose
  sceneRegistry.js          lazy import.meta.glob of src/scenes/*.js -> placeholder fallback
  kit.js                    ctx helpers (box/…/room, place/loadModel/pbr/loadTexture, makeNPC/makeCharacter, makeLabel),
                            legacy box figure (makeBoxNPC, fallback), markers
  mats.js                   shared material palette
  player.js                 Adam: movement, collision, follow/orbit camera, occlusion raycast, character locomotion
  input.js, content.js, progress.js, i18n.js, ui/   (unchanged roles)
public/assets/characters/   male.glb, female.glb (built by tools/characters/build.mjs), LICENSES.md
tools/characters/           fetch.mjs + build.mjs (asset pipeline), lab.html (character lineup), gameshot.mjs (screenshots)
```

Situation flow: setup and dialogue (bottom sheet) -> choices (**shuffled each time**) -> consequence and points -> **ruling card** -> check question (+5 if correct) -> done, with "Try another choice". Score keeps the **best** points per situation.


## 13. The neighbourhood hub, doors and feature spots (2026-10-06)

- **One walkable world.** `src/scenes/town.js` is the hub. The player starts there (new day: at Adam's front door) and walks
  to a glowing door; E/Interact enters that building's scene. Every interior's exit returns to the hub **at that building's
  door** (`enterLocation(HUB, { from })`). Leaving a location early is allowed (a reminder lists what is left); finishing it
  shows the outro once, then the hub. When all 18 situations are done the summary opens over the hub.
- **Config.** `LOCATIONS` stays the 6 journey stops (planner order, catalog, tests). `PLACES = ['town','mosque','bank']`
  are scenes without situations; `ALL_LOCATIONS = [...LOCATIONS, ...PLACES]`; `LOCATION_TITLES` covers all of them.
- **Doors** (hub scenes only): return `doors: [{ location, position, radius?, label?, spawn: { position, yaw } }]` and
  `exit: null`. The engine draws a teal door marker + label (gold = the planned next stop, green = all situations done).
- **Waypoint.** In the hub a gold chevron at Adam's feet points to the planned next stop (first stop of the journey order
  with unfinished situations); the HUD shows "Next stop: …".
- **Feature spots.** A scene's default export may declare `featureSpots: [{ feature: '<name>', pos: [x,y,z], label: {ar,en} }]`
  (also accepted on the build result). The engine draws a violet marker; E opens
  `src/features/<name>/index.js` → `open({ lang, onClose, location })` and pauses player input until `onClose()`.
  Modules are discovered with `import.meta.glob` at build time; a spot whose module does not exist is hidden, and a
  failing import shows a short toast. Console: `yawmuk.features`, `yawmuk.openFeature('quran')`, `yawmuk.teleport('door:school' | 'school' | 'prayer')`.
- **Persistent HUD slots.** `#yk-hud-prayer` (top corner) mounts `features/prayer` `startPrayerHud({ lang, container })`;
  the floating "Ask the guide" button opens feature `guide` (falls back to the Ask panel if that module is missing).
