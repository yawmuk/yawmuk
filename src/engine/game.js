// Game controller: boot, screens, location sequence, exploration loop, situations, summary.
import * as THREE from 'three/webgpu'; // node materials for scenes (shares one core with 'three')
import { createWorld } from './world.js';
import { createMats } from './mats.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createSceneManager, countStats } from './sceneManager.js';
import { createHud } from './ui/hud.js';
import { setUiRoot, toast } from './ui/overlay.js';
import { startScreen, introScreen, locationIntro, outroScreen, exitConfirm, menuScreen, summaryScreen, preCheckScreen } from './ui/screens.js';
import { openAskPanel } from './ui/askPanel.js';
import { planJourney, defaultPlan } from './planner.js';
import { pickChecks } from './aiCore.js';
import { runSituation, revisitMenu, showRulingOnly } from './ui/situation.js';
import { getScript, allSituations, contentIssues, usingFixtures, setLocationOrder, locationOrder } from './content.js';
import { loadProgress, progress, setLocation, isDone, totalScore, resetProgress, setLangPref, setFlag, setPlan, getPlan, setPre } from './progress.js';
import { LOCATIONS, LOCATION_TITLES, HUB, ALL_LOCATIONS, isPlace } from './config.js';
import { setLang, getLang, tr, t, onLangChange } from './i18n.js';
import { createFeatureRegistry, doorSpawn, nextDestination } from './hub.js';
import { createWaypoint } from './waypoint.js';
import { h } from './dom.js';
import './ui/world.css';
import { events } from './events.js';
import { updateCharacters, preloadCharacters, liveCharacterCount, setCharacterDefaults } from './characters.js';
import { loadCatalog } from './assets.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
// Feature panels (src/features/<name>/index.js, written by feature owners): discovered at build time, loaded lazily.
// A missing module simply is not in the map (its scene spots stay hidden; opening it shows a short toast).
const features = createFeatureRegistry(import.meta.glob('../features/*/index.js'));

export async function startGame() {
  // the loading UI subscribes to window.yawmuk.events as early as possible
  window.yawmuk = Object.assign(window.yawmuk || {}, { events });
  const canvas = document.getElementById('stage');
  const ui = document.getElementById('ui');
  const fadeEl = document.getElementById('fade');
  setUiRoot(ui);
  loadProgress();
  setLang(params.get('lang') || progress().lang || 'ar');
  // restore the day's planned location order (journey planner); an old/invalid plan falls back to the default order
  if (!setLocationOrder(getPlan()?.order)) setLocationOrder(null);

  // low tier: characters are one merged mesh and NPCs cast no shadows (applies to characters built afterwards)
  events.on('quality:apply', (q) => setCharacterDefaults({ single: !!q.lightCharacters, shadows: !q.lightCharacters }));
  const world = await createWorld(canvas); // async: WebGPURenderer.init() (WebGPU or WebGL2 fallback)
  setCharacterDefaults({ single: world.quality === 'low', shadows: world.quality !== 'low' });
  loadCatalog(); preloadCharacters(); // start downloads right away (the scene manager awaits them)
  const mats = createMats();
  const input = createInput(canvas, ui);
  const player = createPlayer(world, input);
  const scenes = createSceneManager(world, mats, { hasFeature: (n) => features.has(n) });
  const waypoint = createWaypoint(world.scene);
  let featureOpen = null; // name of the feature panel currently open
  let mode = 'boot'; // boot | attract | play | ui | loading
  let menu = null;
  let near = null; // hotspot object or exit currently in range
  const TOTAL = allSituations().length;

  const hud = createHud(ui, { onMenu: () => openMenu(), onAsk: () => openAsk() });
  // speak a dialogue choice ("one", "the second", a label word); does nothing without browser speech recognition
  import('../features/voice/index.js').then((m) => m.installChoiceVoice?.()).catch(() => {});

  // ---- persistent world layer: prayer-times slot + floating "Ask the guide" button
  const prayerSlot = h('div', { id: 'yk-hud-prayer', 'aria-live': 'off' });
  const fabText = h('span', { class: 'yk-world-fab-text' }, t('guideFab'));
  const fab = h('button', { type: 'button', class: 'yk-world-fab', 'aria-label': t('guideFab'), onclick: () => openGuide() },
    h('span', { class: 'yk-world-fab-icon', 'aria-hidden': 'true' }, '🎙'), fabText);
  const worldLayer = h('div', { class: 'yk-world-layer hidden' }, prayerSlot, fab);
  ui.append(worldLayer);
  // the prayer widget's own button opens its panel through openFeature so player input pauses while it is open
  prayerSlot.addEventListener('click', (e) => {
    if (!e.target.closest?.('.yk-prayer-hud-main')) return;
    e.stopPropagation(); e.preventDefault();
    openFeature('prayer');
  }, true);
  onLangChange(() => { fabText.textContent = t('guideFab'); fab.setAttribute('aria-label', t('guideFab')); });
  startPrayerHud();

  /** Mount the prayer-times HUD from src/features/prayer (if that module exists). Re-mounts on language change. */
  async function startPrayerHud() {
    let handle = null;
    const mount = async () => {
      const mod = await features.load('prayer');
      if (!mod || typeof mod.startPrayerHud !== 'function') return;
      try { handle = await mod.startPrayerHud({ lang: getLang(), container: prayerSlot }); } catch (e) { console.error('[prayer] HUD failed', e); }
    };
    await mount();
    onLangChange(async () => {
      try {
        if (handle && typeof handle.setLang === 'function') return handle.setLang(getLang());
        const stop = typeof handle === 'function' ? handle : handle?.stop || handle?.destroy || handle?.close;
        if (typeof stop === 'function') { stop.call(handle); prayerSlot.replaceChildren(); await mount(); }
      } catch (e) { console.error('[prayer] language switch failed', e); }
    });
  }

  /** Open a feature panel (src/features/<name>/index.js -> open({ lang, onClose })). Player input pauses while open. */
  async function openFeature(name, extra = {}) {
    if (mode !== 'play' || featureOpen) return false;
    setMode('ui');
    featureOpen = name;
    const mod = await features.load(name);
    if (!mod || typeof mod.open !== 'function') {
      featureOpen = null;
      toast(t('featureMissing'), 2600);
      if (mode === 'ui') setMode('play');
      return false;
    }
    let closed = false;
    const onClose = () => {
      if (closed) return; closed = true;
      featureOpen = null;
      if (mode === 'ui') setMode('play');
      canvas.focus?.();
    };
    try { mod.open({ lang: getLang(), onClose, location: scenes.active?.location || null, ...extra }); } catch (e) { console.error(`[feature:${name}] open() threw`, e); toast(t('featureMissing'), 2600); onClose(); }
    return true;
  }
  /** The guide (voice + text) when its module exists; the reviewed-passages Ask panel otherwise. */
  async function openGuide() {
    const mod = features.has('guide') ? await features.load('guide') : null;
    return typeof mod?.open === 'function' ? openFeature('guide') : openAsk();
  }

  /** Per-location "Ask" panel (pre-authored questions + constrained AI answers from reviewed passages). */
  async function openAsk() {
    if (mode !== 'play' || !scenes.active) return;
    setMode('ui');
    try { await openAskPanel({ location: scenes.active.location }); } catch (e) { console.error('[ask]', e); }
    if (mode === 'ui') setMode('play');
  }

  /** Store the plan and follow its location order. */
  function applyPlan(plan) {
    const p = plan && setLocationOrder(plan.order) ? plan : defaultPlan();
    setLocationOrder(p.order);
    setPlan(p);
    refreshHud();
    return p;
  }
  input.state.onMenu = () => { if (mode === 'play') openMenu(); };
  input.state.onInteract = () => { if (mode === 'play') interact(); };

  const doneCount = () => allSituations().filter((s) => isDone(s.key)).length;
  /** The day's planned next destination (first stop of the journey order that still has unfinished situations). */
  const plannedNext = () => nextDestination(locationOrder(), locationComplete);
  function refreshHud() {
    const loc = scenes.active?.location;
    const s = loc ? getScript(loc) : null;
    const next = loc === HUB ? plannedNext() : null;
    hud.set({ title: s?.title || LOCATION_TITLES[loc], time: s?.time_of_day || '', score: totalScore(), done: doneCount(), total: TOTAL, plan: getPlan()?.source || 'default', next: next ? (getScript(next)?.title || LOCATION_TITLES[next]) : null });
    hud.setAskVisible(!(isPlace(loc) && features.has('guide')));
  }

  function setMode(m) {
    mode = m;
    const playing = m === 'play';
    input.setEnabled(playing);
    hud.show(playing || m === 'ui');
    worldLayer.classList.toggle('hidden', !playing);
    if (!playing) { hud.setPrompt(null); input.setInteractVisible(false); }
  }

  // door transition: a short warm fade (~0.3 s in, ~0.3 s out) while the next scene builds; the loading veil (bar)
  // only shows when the build takes longer than 1.5 s
  let slowTimer = 0;
  const fade = (on) => new Promise((r) => {
    clearTimeout(slowTimer);
    fadeEl.classList.add('door');
    fadeEl.classList.toggle('on', on);
    if (on) slowTimer = setTimeout(() => fadeEl.classList.add('busy'), 1500);
    else fadeEl.classList.remove('busy');
    setTimeout(r, on ? 300 : 50);
  });

  // ------------------------------------------------------------ locations
  /**
   * Load a location (journey stop, the hub or a free place). `from` = the location the player just left: arriving in
   * the hub puts Adam at that building's door. Places (hub, mosque, bank) never show the stop intro card.
   */
  async function enterLocation(loc, { intro = true, from = null } = {}) {
    if (!ALL_LOCATIONS.includes(loc)) loc = HUB;
    setMode('loading');
    near = null;
    await fade(true);
    const script = getScript(loc);
    const warns = [];
    // the hub loaded behind the start screen is reused as-is (no second load)
    const reuse = loc === HUB && scenes.active?.location === HUB && !scenes.active.isPlaceholder;
    const active = reuse ? scenes.active : await scenes.load(loc, script, (m) => warns.push(m));
    player.setColliders(active.colliders, active.bounds);
    player.setCameraOccluders(active.occluders);
    player.setLook(active.res.playerLook && typeof active.res.playerLook === 'object' ? active.res.playerLook : null);
    const sp = (from && doorSpawn(active.doors, from)) || active.spawn;
    player.teleport(sp.position, sp.yaw);
    active.completeOnEnter = !isPlace(loc) && locationComplete(loc);
    active.placeStationNpcs((hid) => { const ss = (script?.situations || []).filter((s) => s.hotspot === hid); return ss.length > 0 && ss.every((s) => isDone(s.key)); });
    setLocation(loc);
    refreshHud();
    updateMarkers();
    if (DEBUG) {
      warns.forEach((w) => toast(`⚠ ${w}`, 6000, 'warn'));
      console.info(`[scene:${loc}]`, active.isPlaceholder ? 'placeholder' : 'scene file', countStats(active.root));
    } else if (warns.length && !active.isPlaceholder) {
      console.warn(`[scene:${loc}] ${warns.length} warning(s); open with ?debug=1 to see them as toasts`);
    }
    document.body.classList.add('ready');
    await fade(false);
    if (intro && !isPlace(loc)) { setMode('ui'); await locationIntro(loc); }
    setMode('play');
    if (loc === HUB) {
      const next = plannedNext();
      if (!progress().townHintSeen) { toast(t(document.body.classList.contains('touch') ? 'townHintTouch' : 'townHint'), 4200); setFlag('townHintSeen', true); }
      if (next) toast(`${t('nextStop')}: ${tr(getScript(next)?.title || LOCATION_TITLES[next])}`, 3600);
      else if (allSituations().length) toast(t('dayDone'), 3600);
    }
  }

  // ------------------------------------------------------------ interaction
  function sitsAt(hsId) { return (getScript(scenes.active.location)?.situations || []).filter((s) => s.hotspot === hsId); }

  async function interact() {
    const a = scenes.active; if (!a || !near) return;
    if (near === a.exit) return tryExit();
    if (near.kind === 'door') return enterLocation(near.location, { from: a.location });
    if (near.kind === 'spot') return openFeature(near.feature);
    const sits = sitsAt(near.id);
    if (!sits.length) return;
    const script = getScript(a.location);
    const pending = sits.find((s) => !isDone(s.key));
    const wasComplete = locationComplete(a.location);
    setMode('ui');
    const npc = a.npcs[(pending || sits[0]).npc?.id];
    if (npc?.userData.stations?.[near.id] && npc.userData.station !== near.id) a.placeStationNpcs(() => false, { force: near.id });
    const restoreYaw = npc?.rotation.y;
    const npcCh = npc?.userData.character;
    if (npc) {
      const face = Math.atan2(-(player.pos.x - npc.position.x), -(player.pos.z - npc.position.z));
      if (npcCh) { if (npcCh.state !== 'sit') npcCh.turnTo(face); } else npc.rotation.y = face;
      player.faceTowards([npc.position.x, 0, npc.position.z]);
    }
    const stopTalk = watchDialogue(a, npc);
    try {
      const onPoints = () => { refreshHud(); hud.bump(); };
      if (pending) {
        await runSituation(pending, { script, onPoints });
      } else {
        const sit = sits[sits.length - 1];
        const choice = await revisitMenu(sit);
        if (choice === 'retry') await runSituation(sit, { script, onPoints, startAt: 'choices' });
        else if (choice === 'review') await showRulingOnly(sit);
      }
    } catch (e) {
      console.error('[situation] flow error', e);
      toast(String(e.message || e), 5000, 'warn');
    } finally {
      stopTalk();
      if (npc) { if (npcCh) { if (npcCh.state !== 'sit') npcCh.turnTo(restoreYaw); } else npc.rotation.y = restoreYaw; }
      // NPCs with stations move (behind a short fade) to the next unfinished situation that names them
      const done = (hid) => { const ss = sitsAt(hid); return ss.length > 0 && ss.every((s) => isDone(s.key)); };
      if (a.placeStationNpcs(done, { dryRun: true }).length) { await fade(true); a.placeStationNpcs(done); await fade(false); }
      refreshHud();
      updateMarkers();
      setMode('play');
      if (!wasComplete && locationComplete(a.location)) toast(t('exitReady'), 3500);
    }
  }

  /**
   * While the dialogue sheet is open, the character whose line is on screen plays 'talk' (Adam too), others listen.
   * Reads the dialogue markup's data-speaker attribute; falls back to "the situation NPC talks" if it is absent.
   */
  function watchDialogue(a, npc) {
    const started = performance.now();
    let lastKey = '', lineAt = 0;
    const chOf = (id) => (id === 'adam' ? player.character : a.npcs[id]?.userData.character) || null;
    const talking = new Set();
    const setTalk = (list) => {
      for (const c of talking) if (!list.includes(c)) c.play('listen');
      talking.clear();
      for (const c of list) { if (c) { c.play('talk'); talking.add(c); } }
    };
    const timer = setInterval(() => {
      const lines = ui.querySelectorAll('[data-speaker]');
      const line = lines[lines.length - 1];
      if (!line) { setTalk(performance.now() - started < 3500 && npc ? [npc.userData.character] : []); return; }
      const sp = line.getAttribute('data-speaker');
      const key = sp + '|' + (line.textContent || '').length;
      const typing = !!line.querySelector('.typing') || line.classList.contains('typing');
      if (key !== lastKey) { lastKey = key; if (typing || !lineAt) lineAt = performance.now(); }
      const active = typing || performance.now() - lineAt < 1200;
      setTalk(active ? [chOf(sp)].filter(Boolean) : []);
    }, 120);
    // the NPC keeps an eye on Adam during the conversation
    npc?.userData.character?.lookAt(new THREE.Vector3(player.pos.x, 1.6, player.pos.z));
    return () => { clearInterval(timer); setTalk([]); };
  }

  function locationComplete(loc) { return (getScript(loc)?.situations || []).every((x) => isDone(x.key)); }

  function updateMarkers() {
    const a = scenes.active; if (!a) return;
    for (const hs of a.hotspots) {
      if (!hs.marker) continue;
      const all = sitsAt(hs.id);
      hs.marker.setColor(all.length && all.every((s) => isDone(s.key)) ? '#7ddc8a' : '#ffd34d');
    }
    a.exit?.marker.setColor('#6fe3c1'); // the exit always leads back to the neighbourhood
    // hub doors: gold = planned next stop, green = all situations there done, teal = open
    const next = plannedNext();
    for (const d of a.doors || []) d.marker.setColor(d.location === next ? '#ffd34d' : !isPlace(d.location) && locationComplete(d.location) ? '#7ddc8a' : '#6fe3c1');
    const target = a.location === HUB && next ? (a.doors || []).find((d) => d.location === next) : null;
    waypoint.set(target ? target.position : null);
  }

  /** Every interior's exit leads back to the neighbourhood, at that building's door. */
  async function tryExit() {
    const a = scenes.active;
    const loc = a.location;
    if (isPlace(loc)) return enterLocation(HUB, { from: loc });
    const s = getScript(loc);
    const left = (s?.situations || []).filter((x) => !isDone(x.key));
    setMode('ui');
    if (left.length) {
      // leaving early is allowed (the hub is free to explore); remind what is left here first
      const r = await exitConfirm(loc);
      if (r !== 'go') return setMode('play');
    } else if (!a.completeOnEnter) {
      // finished here during this visit: closing card, then the planned next stop (or the end of the day)
      const r = await outroScreen(loc, plannedNext());
      if (r !== 'go') return setMode('play');
    }
    await enterLocation(HUB, { from: loc });
    if (!progress().finished && allSituations().every((x) => isDone(x.key))) await showSummary();
  }

  async function showSummary() {
    setMode('ui');
    // only a completed day counts as finished; the menu can open this screen mid-game as "progress so far"
    if (allSituations().every((s) => isDone(s.key))) setFlag('finished', true);
    const r = await summaryScreen();
    if (r === 'again') { const plan = getPlan(); resetProgress(); applyPlan(plan); await enterLocation(HUB, { from: 'home' }); }
    else if (typeof r === 'string' && r.startsWith('goto:')) await enterLocation(r.slice(5), { from: scenes.active?.location });
    else setMode('play');
  }

  function openMenu() {
    if ((menu && document.contains(menu.el)) || featureOpen) return;
    setMode('ui');
    menu = menuScreen({
      onClose: () => { menu = null; if (mode === 'ui') setMode('play'); },
      onJump: (loc) => enterLocation(loc, { from: scenes.active?.location, intro: loc !== HUB }),
      onLang: () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); setLangPref(getLang()); refreshHud(); near = null; },
      onSummary: () => showSummary(),
      onRestart: () => { const plan = getPlan(); resetProgress(); applyPlan(plan); enterLocation(HUB, { from: 'home' }); }
    });
  }

  // ------------------------------------------------------------ frame loop
  world.onTick((dt, time) => {
    const a = scenes.active;
    if (mode === 'play') {
      player.update(dt, time);
      // proximity
      let best = null, bestD = Infinity;
      if (a) {
        for (const hs of a.hotspots) {
          if (!hs.active) continue;
          const d = Math.hypot(player.pos.x - hs.position[0], player.pos.z - hs.position[2]);
          if (d < hs.radius && d < bestD) { best = hs; bestD = d; }
        }
        for (const x of [a.exit, ...(a.doors || []), ...(a.spots || [])]) {
          if (!x) continue;
          const d = Math.hypot(player.pos.x - x.position[0], player.pos.z - x.position[2]);
          if (d < x.radius && d < bestD) { best = x; bestD = d; }
        }
      }
      if (best !== near) {
        near = best;
        if (!near) { hud.setPrompt(null); input.setInteractVisible(false); }
        else {
          let label;
          if (near === a.exit) label = t('backToTown');
          else if (near.kind === 'door') {
            const title = tr(near.label || getScript(near.location)?.title || LOCATION_TITLES[near.location]);
            const ss = isPlace(near.location) ? [] : getScript(near.location)?.situations || [];
            const dn = ss.filter((x) => isDone(x.key)).length;
            label = `${t('enterPlace')}: ${title}${ss.length ? ` · ${dn}/${ss.length}` : ''}${near.location === plannedNext() ? ' ★' : ''}`;
          } else if (near.kind === 'spot') label = tr(near.label) || t('interact');
          else {
            const s = sitsAt(near.id);
            const sit = s.find((x) => !isDone(x.key)) || s[0];
            label = tr(near.label) || tr(sit?.npc?.name) || t('interact');
            if (s.length && s.every((x) => isDone(x.key))) label += ' ✓';
          }
          hud.setPrompt(label);
          input.setInteractVisible(true, label);
        }
      }
    } else if (mode === 'attract' && a) {
      const r = 9, ang = time * 0.08;
      world.camera.position.set(a.spawn.position[0] + Math.sin(ang) * r, 5.5, a.spawn.position[2] + Math.cos(ang) * r);
      world.camera.lookAt(a.spawn.position[0], 1.2, a.spawn.position[2]);
    }
    if (a) { a.update(dt, time, near); world.followShadow(mode === 'attract' ? new THREE.Vector3(...a.spawn.position) : player.pos); }
    if (mode === 'play') waypoint.update(player.pos, time);
    if (a && mode === 'play') ambientNpcs(a);
  });
  // skinned characters (NPCs + Adam) advance after the scene's own update so its poses apply the same frame
  world.onTick((dt) => updateCharacters(dt, world.camera));

  // NPCs nearby turn their head to Adam; a speaking NPC waves once the first time Adam comes close
  const headPos = new THREE.Vector3();
  function ambientNpcs(a) {
    headPos.set(player.pos.x, 1.6, player.pos.z);
    a.waved ||= new Set();
    for (const [id, fig] of Object.entries(a.npcs)) {
      const ch = fig.userData.character; if (!ch) continue;
      const d = Math.hypot(fig.position.x - player.pos.x, fig.position.z - player.pos.z);
      ch.lookAt(d < 4 && !fig.userData.background ? headPos : null);
      if (d < 3.2 && !fig.userData.background && !a.waved.has(id) && ch.state !== 'sit' && fig.userData.animate) { a.waved.add(id); ch.play('wave'); }
    }
  }

  // ------------------------------------------------------------ debug / test API
  const api = {
    world, scenes, player, progress, THREE, events,
    /** Render quality: yawmuk.setQuality('low'|'medium'|'high'); yawmuk.quality */
    setQuality: (q) => world.setQuality(q),
    get quality() { return world.quality; },
    perf: () => ({ ...world.stats, quality: world.quality, calls: world.renderer.info.render.drawCalls ?? world.renderer.info.render.calls, backend: world.backend, tris: world.renderer.info.render.triangles, characters: liveCharacterCount(), textures: world.renderer.info.memory.textures, geometries: world.renderer.info.memory.geometries }),
    goto: (loc, from = null) => enterLocation(loc, { intro: false, from }),
    /** Open a feature panel by name (src/features/<name>); yawmuk.features lists the modules found at build time. */
    openFeature: (name, extra = {}) => openFeature(name, extra && typeof extra === 'object' ? extra : {}),
    features: features.names(),
    teleport: (hotspotId) => {
      const a = scenes.active;
      const hs = a?.hotspots.find((x) => x.id === hotspotId) || (hotspotId === 'exit' ? a?.exit : null)
        || a?.doors?.find((d) => d.id === hotspotId || d.location === hotspotId) || a?.spots?.find((s) => s.id === hotspotId || s.feature === hotspotId);
      if (hs) player.teleport([hs.position[0], 0, hs.position[2] + 0.01], player.yaw);
      return !!hs;
    },
    interact: () => interact(),
    /** Free camera for inspecting a scene: yawmuk.inspect([x,y,z] camera, [x,y,z] target). yawmuk.resume() to play. */
    inspect: (from, to = [0, 1, 0]) => { setMode('inspect'); world.camera.position.set(...from); world.camera.lookAt(...to); },
    resume: () => setMode('play'),
    get mode() { return mode; },
    get near() { return near?.id || (near ? 'exit' : null); },
    get waypoint() { return waypoint.target; },
    stats: () => scenes.active && countStats(scenes.active.root),
    contentIssues, usingFixtures
  };
  window.yawmuk = Object.assign(window.yawmuk || {}, api);
  Object.defineProperty(window.yawmuk, 'mode', { get: () => mode, configurable: true });
  Object.defineProperty(window.yawmuk, 'near', { get: () => near?.id || (near ? 'exit' : null), configurable: true });
  Object.defineProperty(window.yawmuk, 'quality', { get: () => world.quality, configurable: true });
  Object.defineProperty(window.yawmuk, 'waypoint', { get: () => waypoint.target, configurable: true });

  // ------------------------------------------------------------ boot sequence
  const jump = params.get('scene');
  if (jump && ALL_LOCATIONS.includes(jump)) {
    if (!params.get('lang') && !progress().lang) setLang('ar');
    setFlag('introSeen', true);
    await enterLocation(jump, { intro: params.get('nointro') !== '1' });
    return api;
  }
  // attract mode: the neighbourhood behind the start screen (also where a new day starts)
  const bootLoc = progress().location && ALL_LOCATIONS.includes(progress().location) ? progress().location : HUB;
  const active = await scenes.load(HUB, null, () => {});
  player.setColliders(active.colliders, active.bounds);
  player.teleport(active.spawn.position, active.spawn.yaw);
  setMode('attract');
  document.body.classList.add('ready');
  const choice = await startScreen();
  setLangPref(choice.lang);
  if (choice.mode === 'new') {
    resetProgress();
    setLangPref(choice.lang);
    // the planner runs while the player reads the intro (6 s timeout, deterministic fallback; never throws)
    if (choice.context) toast(t('planning'), 2500);
    const planning = planJourney(choice.context, choice.lang).catch(() => defaultPlan());
    await introScreen();
    setFlag('introSeen', true);
    const plan = applyPlan(await planning);
    const bySit = Object.fromEntries(allSituations().map((s) => [s.ruling_id, s]));
    const pre = await preCheckScreen(pickChecks(plan.journey.map((j) => j.id), bySit, 3)).catch(() => null);
    setPre(pre);
    await enterLocation(HUB, { from: 'home' }); // Adam steps out of his front door
  } else {
    if (!progress().introSeen) { await introScreen(); setFlag('introSeen', true); }
    await enterLocation(bootLoc);
  }
  return api;
}
