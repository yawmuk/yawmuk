// Placeholder scene used for any location without src/scenes/<location>.js (or whose scene failed).
// It auto-places one hotspot per situation in the location's script, so the game is playable end-to-end.
// It doubles as a compact, working example of the scene contract — see src/engine/README.md.

const THEMES = {
  home: { wall: 'wallWarm', floor: 'floor', accent: '#c58b4c' },
  work: { wall: 'wallBlue', floor: 'carpet', accent: '#3a6ea5' },
  school: { wall: 'wallGreen', floor: 'floorTile', accent: '#3f7a5a' },
  street: { wall: 'brick', floor: 'sidewalk', accent: '#e8c33a' },
  public_events: { wall: 'wall', floor: 'floorTile', accent: '#a83a3a' },
  private_events: { wall: 'wallWarm', floor: 'woodLight', accent: '#6b4c8a' }
};

const LOOKS = [
  { skin: '#e0b48a', shirt: '#7a3b5e', hijab: '#2f4f6f', dress: '#3b3b55' },
  { skin: '#8d5524', shirt: '#d9d4c7', suit: '#2a3245', kufi: false, beard: true },
  { skin: '#f1c27d', shirt: '#4f8a8b', hair: '#6b4423' },
  { skin: '#c68642', shirt: '#b5651d', hijab: '#a64d4d', dress: '#5a4632' },
  { skin: '#a1665e', shirt: '#355c7d', kufi: true, beard: '#222' },
  { skin: '#ffdbac', shirt: '#6c5b7b', hair: '#d4a76a', glasses: true }
];

function hourOf(time) { const m = /^(\d{1,2})/.exec(time || ''); return m ? +m[1] : 12; }

export default {
  id: '_placeholder',
  title: { ar: 'غرفة مؤقتة', en: 'Placeholder room' },
  build(ctx) {
    const { THREE, mats, box, cyl, room, makeLabel, script, location } = ctx;
    const theme = THEMES[location] || THEMES.home;
    const sits = script?.situations || [];
    const n = Math.max(1, sits.length);
    const W = Math.max(14, n * 4.5 + 4), D = 14;

    room({ w: W, d: D, h: 3.2, wall: mats[theme.wall], floor: mats[theme.floor], doors: [{ side: 'n', at: 0, width: 1.6 }] });

    // door frame + "exit" at the north wall (z = -D/2)
    const doorZ = -D / 2;
    box(0.15, 2.3, 0.3, mats.woodDark, -0.88, 0, doorZ);
    box(0.15, 2.3, 0.3, mats.woodDark, 0.88, 0, doorZ);
    box(1.9, 0.15, 0.3, mats.woodDark, 0, 2.2, doorZ);
    box(1.6, 2.2, 0.05, mats.color('#20262c'), 0, 0, doorZ - 0.2); // dark doorway backing

    // decor
    box(W * 0.5, 0.02, 3, mats.color(theme.accent, { roughness: 1 }), 0, 0, 2.5, { cast: false });
    for (const sx of [-1, 1]) {
      const px = sx * (W / 2 - 1);
      cyl(0.3, 0.24, 0.5, mats.color('#8a5a3c'), px, 0, D / 2 - 1, { collide: true });
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mats.leaf);
      leaves.position.set(px, 1.0, D / 2 - 1); leaves.castShadow = true; ctx.group.add(leaves);
    }
    const title = makeLabel(script?.title || this.title, { size: 0.5 });
    title.position.set(0, 2.85, -D / 2 + 0.3); ctx.group.add(title);

    // one station per situation: a table + an NPC behind it + a hotspot in front of it
    const hotspots = [], npcs = [];
    const usedHotspots = new Set();
    sits.forEach((s, i) => {
      if (usedHotspots.has(s.hotspot)) return; // several situations may share one hotspot
      usedHotspots.add(s.hotspot);
      const x = (i - (n - 1) / 2) * 4.5;
      const z = -1.5;
      box(1.6, 0.75, 0.8, mats.wood, x, 0, z - 0.6, { collide: true });
      box(0.5, 0.32, 0.03, mats.screen, x, 0.75, z - 0.75, { rotY: 0 });
      hotspots.push({ id: s.hotspot, position: [x, 0, z + 0.4], radius: 1.6, label: s.npc?.role || s.npc?.name || { ar: `موقف ${i + 1}`, en: `Situation ${i + 1}` } });
      if (s.npc?.id) npcs.push({ id: s.npc.id, position: [x, 0, z - 1.5], yaw: Math.PI, look: LOOKS[i % LOOKS.length] });
    });

    const h = hourOf(script?.time_of_day);
    return {
      group: ctx.group,
      spawn: { position: [0, 0, D / 2 - 2.5], yaw: 0 },
      colliders: [],                      // walls/tables registered via collide:true / room()
      hotspots,
      npcs,
      exit: { position: [0, 0, doorZ + 1.0], radius: 1.4 },
      lights: h >= 20 || h < 5 ? 'night' : h >= 17 ? 'evening' : 'day',
      update() {},
      dispose() {}
    };
  }
};
