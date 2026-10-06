// «يومك» — WORK scene: open-plan office of Salam Freight Tech (حيّ السلام), Monday 10:00.
// Procedural Three.js only. Most static geometry is batched into a handful of InstancedMeshes
// (per-instance colour), so the whole office is ~40 draw calls. See docs/hotspots.md §2.
//
// Layout (metres, interior x∈[-9,9], z∈[-6,6], ceiling 3m):
//   west wall  : elevator (spawn side) + kitchenette with coffee machine (hotspot coffee_machine)
//   north wall : teal accent wall, quiet/reflection room door, whiteboards, wall clock, dashboard TV
//   centre     : two rows of 6 bench desks with dual monitors; Adam's desk = front-row west end
//   NE corner  : glass HR office (hotspot hr_desk), door on its south side
//   east wall  : floor-to-ceiling windows over a winter city skyline
//   south wall : lounge sofa, stairwell EXIT door (exit)

const TAU = Math.PI * 2;

export default {
  id: 'work',
  title: { ar: 'العمل', en: 'Work' },

  build(ctx) {
    const THREE = ctx.THREE;
    const group = ctx.group || new THREE.Group();
    group.name = group.name || 'scene:work';
    const own = [];
    const track = (o) => { own.push(o); return o; };
    const colliders = [];
    const C = (x0, x1, z0, z1, h = 2) => colliders.push({ min: [x0, 0, z0], max: [x1, h, z1] });

    // deterministic PRNG for decor
    let seed = 20261005;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

    // ------------------------------------------------------------ batch lists
    const MATTE = [], GLOSS = [], CYL = [], CYLG = [], POT = [], ICO = [], GLOW = [], DOWN = [], GLASS = [], CITY = [];
    // bottom-based box: (x, y0, z) = bottom centre
    const box = (L, x, y0, z, sx, sy, sz, color, ry = 0, rx = 0, rz = 0) => L.push({ x, y: y0 + sy / 2, z, sx, sy, sz, ry, rx, rz, color });
    const cyl = (L, x, y0, z, r, h, color) => L.push({ x, y: y0 + h / 2, z, sx: r * 2, sy: h, sz: r * 2, ry: 0, rx: 0, rz: 0, color });
    const ico = (x, y, z, r, color, sy = 1) => ICO.push({ x, y, z, sx: r * 2, sy: r * 2 * sy, sz: r * 2, ry: rnd() * TAU, rx: 0, rz: 0, color });

    // ------------------------------------------------------------ canvas textures
    function canvasTex(w, h, draw, repeat) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      draw(g, w, h);
      const t = track(new THREE.CanvasTexture(c));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
      return t;
    }
    const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const squiggle = (g, x, y, len, color, lw = 2) => {
      g.strokeStyle = color; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < len; i += 6) g.lineTo(x + i, y + Math.sin(i * 0.7 + x) * 2.5 + (rnd() - 0.5) * 2);
      g.stroke();
    };

    const texCarpet = canvasTex(128, 128, (g) => {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const v = 70 + ((i + j) % 2) * 6 + Math.floor(rnd() * 4);
        g.fillStyle = `rgb(${v},${v + 5},${v + 13})`; g.fillRect(i * 64, j * 64, 64, 64);
        g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 1;
        for (let k = 0; k < 64; k += 4) { g.beginPath(); if ((i + j) % 2) { g.moveTo(i * 64 + k, j * 64); g.lineTo(i * 64 + k, j * 64 + 64); } else { g.moveTo(i * 64, j * 64 + k); g.lineTo(i * 64 + 64, j * 64 + k); } g.stroke(); }
      }
    }, [18 / 1.2, 12 / 1.2]);

    const texCode = canvasTex(256, 160, (g, w, h) => {
      g.fillStyle = '#1d2330'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2a3242'; g.fillRect(0, 0, w, 14);
      ['#e06c75', '#e6c07b', '#98c379'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(9 + i * 10, 7, 3, 0, TAU); g.fill(); });
      g.fillStyle = '#252c3a'; g.fillRect(0, 14, 22, h);
      const cols = ['#7fb8ff', '#e6c07b', '#98c379', '#c678dd', '#e06c75', '#abb2bf', '#56b6c2'];
      let indent = 0;
      for (let i = 0; i < 12; i++) {
        const y = 21 + i * 11.5;
        g.fillStyle = '#4b5263'; g.fillRect(6, y, 10, 5);
        indent = Math.max(0, Math.min(3, indent + (rnd() < 0.3 ? 1 : rnd() < 0.3 ? -1 : 0)));
        let x = 30 + indent * 14;
        const n = 1 + Math.floor(rnd() * 4);
        for (let k = 0; k < n && x < w - 20; k++) { const len = 12 + rnd() * 42; g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(x, y, len, 5); x += len + 6; }
      }
    });

    const texSheet = canvasTex(256, 160, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1f7a4a'; g.fillRect(0, 0, w, 14);
      g.fillStyle = '#eef1ee'; g.fillRect(0, 14, 20, h); g.fillRect(0, 14, w, 11);
      g.fillStyle = '#d9f2e1'; g.fillRect(20, 25 + 11 * 4, w, 11);
      g.strokeStyle = '#cfd8d0'; g.lineWidth = 1;
      for (let x = 20; x < w; x += 39) { g.beginPath(); g.moveTo(x + 0.5, 14); g.lineTo(x + 0.5, h); g.stroke(); }
      for (let y = 25; y < h; y += 11) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
      for (let r = 0; r < 12; r++) for (let c = 0; c < 6; c++) {
        if (rnd() < 0.2) continue;
        g.fillStyle = c === 0 ? '#5b6670' : '#8a949c';
        g.fillRect(24 + c * 39 + (c ? 39 - 10 - rnd() * 22 : 0), 28 + r * 11, c ? 8 + rnd() * 14 : 22, 4);
      }
      // mini bar chart
      g.fillStyle = '#ffffff'; g.fillRect(170, 92, 80, 62); g.strokeStyle = '#b8c4ba'; g.strokeRect(170.5, 92.5, 79, 61);
      [30, 42, 26, 50, 38].forEach((v, i) => { g.fillStyle = i === 3 ? '#1f7a4a' : '#6cbf8b'; g.fillRect(178 + i * 14, 150 - v, 9, v); });
    });

    const texForm = canvasTex(256, 160, (g, w, h) => {
      g.fillStyle = '#f7f9fb'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#24527a'; g.fillRect(0, 0, w, 24);
      g.fillStyle = '#ffffff'; g.fillRect(8, 7, 50, 10); g.fillStyle = '#9fc1de'; g.fillRect(190, 9, 56, 6);
      for (let i = 0; i < 5; i++) {
        const y = 34 + i * 22;
        g.fillStyle = '#7a8794'; g.fillRect(12, y, 40 + rnd() * 30, 4);
        g.strokeStyle = '#b7c3cf'; g.lineWidth = 1.5; rr(g, 12, y + 7, 150, 10, 2); g.stroke();
      }
      // contribution slider + pie
      g.fillStyle = '#dfe6ec'; g.fillRect(12, 148, 150, 4); g.fillStyle = '#2f8f5b'; g.fillRect(12, 148, 60, 4);
      g.fillStyle = '#2f8f5b'; g.beginPath(); g.moveTo(212, 82); g.arc(212, 82, 30, -Math.PI / 2, Math.PI * 0.7); g.fill();
      g.fillStyle = '#e8a33a'; g.beginPath(); g.moveTo(212, 82); g.arc(212, 82, 30, Math.PI * 0.7, Math.PI * 1.15); g.fill();
      g.fillStyle = '#4f7fb0'; g.beginPath(); g.moveTo(212, 82); g.arc(212, 82, 30, Math.PI * 1.15, Math.PI * 1.5); g.fill();
      g.fillStyle = '#2f8f5b'; rr(g, 186, 132, 54, 18, 4); g.fill();
    });

    const texBoard = (kind) => canvasTex(512, 288, (g, w, h) => {
      g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(0, h - 30, w, 30);
      if (kind === 0) { // architecture flowchart
        const bx = [[40, 50], [200, 50], [360, 50], [200, 170]];
        bx.forEach(([x, y], i) => { g.strokeStyle = i === 3 ? '#2a9d6f' : '#2e6fb7'; g.lineWidth = 4; rr(g, x, y, 110, 58, 10); g.stroke(); squiggle(g, x + 14, y + 24, 80, '#333', 2); squiggle(g, x + 14, y + 40, 55, '#333', 2); });
        g.strokeStyle = '#222'; g.lineWidth = 3;
        const arrow = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); const a = Math.atan2(y2 - y1, x2 - x1); g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 12 * Math.cos(a - 0.4), y2 - 12 * Math.sin(a - 0.4)); g.moveTo(x2, y2); g.lineTo(x2 - 12 * Math.cos(a + 0.4), y2 - 12 * Math.sin(a + 0.4)); g.stroke(); };
        arrow(152, 79, 196, 79); arrow(312, 79, 356, 79); arrow(255, 110, 255, 166);
        g.strokeStyle = '#d9483b'; g.lineWidth = 3; g.beginPath(); g.ellipse(420, 205, 60, 34, -0.1, 0, TAU); g.stroke();
        squiggle(g, 380, 205, 70, '#d9483b', 3);
      } else { // sprint board with sticky notes
        g.strokeStyle = '#555'; g.lineWidth = 3;
        for (let c = 1; c < 4; c++) { g.beginPath(); g.moveTo(c * 128, 20); g.lineTo(c * 128, h - 40); g.stroke(); }
        for (let c = 0; c < 4; c++) squiggle(g, c * 128 + 30, 26, 60, '#2e6fb7', 3);
        const notes = ['#ffe066', '#ff9ebb', '#b6f0a8', '#9ad0ff'];
        for (let c = 0; c < 4; c++) for (let r = 0; r < 3 - (c === 3 ? 1 : 0); r++) {
          if (rnd() < 0.15) continue;
          const x = c * 128 + 18 + rnd() * 30, y = 50 + r * 64 + rnd() * 8;
          g.fillStyle = notes[Math.floor(rnd() * 4)]; g.save(); g.translate(x + 28, y + 26); g.rotate((rnd() - 0.5) * 0.12); g.fillRect(-28, -26, 56, 52); g.restore();
          squiggle(g, x + 8, y + 22, 38, '#444', 1.5); squiggle(g, x + 8, y + 34, 28, '#444', 1.5);
        }
      }
      // magnets / marker tray hint
      g.fillStyle = '#d9483b'; g.beginPath(); g.arc(w - 26, 22, 8, 0, TAU); g.fill();
    });
    const texBoardA = texBoard(0), texBoardB = texBoard(1);

    const ROUTE = [[34, 228], [96, 196], [150, 204], [206, 150], [252, 132], [300, 74]];
    const texDash = canvasTex(512, 288, (g, w, h) => {
      g.fillStyle = '#0d1826'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#12273d';
      g.beginPath(); g.moveTo(10, 40); g.bezierCurveTo(120, 10, 260, 30, 330, 20); g.lineTo(336, 270); g.bezierCurveTo(240, 280, 90, 260, 12, 272); g.closePath(); g.fill();
      g.strokeStyle = '#183451'; g.lineWidth = 1;
      for (let x = 0; x < 340; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(340, y); g.stroke(); }
      g.strokeStyle = '#2d4a68'; g.lineWidth = 3;
      [[[0, 120], [340, 160]], [[160, 0], [180, 288]], [[20, 280], [320, 30]]].forEach(([a, b]) => { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); });
      g.strokeStyle = '#2fd1c5'; g.lineWidth = 5; g.lineJoin = 'round';
      g.beginPath(); ROUTE.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      [[60, 90], [250, 240], [120, 60]].forEach(([x, y]) => { g.fillStyle = '#ffa53c'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); });
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(300, 74, 8, 0, TAU); g.fill();
      // side panel KPIs
      g.fillStyle = '#132235'; g.fillRect(350, 0, 162, h);
      for (let i = 0; i < 3; i++) { g.fillStyle = '#1b3049'; rr(g, 362, 14 + i * 58, 138, 48, 6); g.fill(); g.fillStyle = ['#2fd1c5', '#ffa53c', '#7fb8ff'][i]; g.fillRect(374, 26 + i * 58, 40 + i * 18, 10); g.fillStyle = '#5c7a99'; g.fillRect(374, 44 + i * 58, 90, 5); }
      [40, 62, 48, 80, 70, 92].forEach((v, i) => { g.fillStyle = '#2fd1c5'; g.fillRect(368 + i * 22, 276 - v, 14, v); });
    });

    const texClock = canvasTex(128, 128, (g) => {
      g.fillStyle = '#2b2f33'; g.beginPath(); g.arc(64, 64, 63, 0, TAU); g.fill();
      g.fillStyle = '#fbfbf8'; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.fill();
      g.strokeStyle = '#2b2f33';
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.lineWidth = i % 3 ? 2 : 4; g.beginPath(); g.moveTo(64 + Math.sin(a) * 44, 64 - Math.cos(a) * 44); g.lineTo(64 + Math.sin(a) * 52, 64 - Math.cos(a) * 52); g.stroke(); }
      g.lineCap = 'round';
      const hand = (a, len, lw, c) => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len); g.stroke(); };
      hand((10 / 12) * TAU, 28, 5, '#2b2f33'); hand(0, 42, 3, '#2b2f33'); hand(0.6 * TAU, 44, 1.5, '#d9483b');
    });

    const texFacade = canvasTex(64, 128, (g, w, h) => {
      g.fillStyle = '#c9ced4'; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 12; r++) for (let c = 0; c < 4; c++) {
        const p = rnd();
        g.fillStyle = p < 0.08 ? '#f2dca6' : p < 0.4 ? '#7d93aa' : p < 0.75 ? '#62798f' : '#a9bccd';
        g.fillRect(3 + c * 15, 3 + r * 10.5, 11, 7);
      }
    }, [2, 4]);

    // ------------------------------------------------------------ materials
    const std = (o) => track(new THREE.MeshStandardMaterial(o));
    const matMatte = std({ color: '#ffffff', roughness: 0.85, metalness: 0 });
    const matGloss = std({ color: '#ffffff', roughness: 0.32, metalness: 0.55 });
    const matLeaf = std({ color: '#ffffff', roughness: 0.9, flatShading: true });
    const matGlow = track(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    const matGlass = std({ color: '#d6eef5', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const matCity = std({ color: '#ffffff', map: texFacade, roughness: 0.9 });
    const matScreen = track(new THREE.MeshBasicMaterial({ color: '#ffffff', map: texCode }));
    const basicMap = (map) => track(new THREE.MeshBasicMaterial({ map }));

    // ------------------------------------------------------------ geometries
    const gBox = track(new THREE.BoxGeometry(1, 1, 1));
    const gCyl = track(new THREE.CylinderGeometry(0.5, 0.5, 1, 14));
    const gPot = track(new THREE.CylinderGeometry(0.5, 0.36, 1, 12));
    const gIco = track(new THREE.IcosahedronGeometry(0.5, 0));
    const gPlane = track(new THREE.PlaneGeometry(1, 1));
    const gDown = track(new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2)); // faces -Y (invisible from above)

    // ================================================================ STRUCTURE
    const WALL = '#eceeed', TEAL = '#2f6f7e', FRAME = '#c3c8cc';
    // floor (textured carpet) + building slab underneath
    const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(18, 12)), std({ color: '#ffffff', map: texCarpet, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
    box(MATTE, 0, -12.02, 0, 18.4, 12, 12.4, '#6f7a84');
    // ceiling (single-sided, facing down: hidden when the camera is above it)
    const ceil = new THREE.Mesh(gDown, std({ color: '#f2f2ef', emissive: '#d8d8d4', emissiveIntensity: 0.35, roughness: 1 }));
    ceil.scale.set(18, 1, 12); ceil.position.y = 3; group.add(ceil);
    for (const x of [-6, -2, 2, 6]) for (const z of [-3.4, 0.2, 3.6]) DOWN.push({ x, y: 2.985, z, sx: 0.16, sy: 1, sz: 3.0, ry: 0, rx: 0, rz: 0, color: '#fffdf4' });

    // walls (outside the 18x12 interior)
    // [Phase 3 QA] the walls are instanced, so the engine never used them as camera occluders: at spawn the
    // camera sat outside the west wall and the grey wall filled the view. Each wall is mirrored in OCC and
    // returned as invisible proxy boxes through `cameraOccluders` (see src/engine/README.md §4).
    const OCC = [];
    const wallBox = (...a) => { box(MATTE, ...a); OCC.push(MATTE[MATTE.length - 1]); };
    wallBox(-2.1, 0, -6.1, 14.2, 3, 0.2, TEAL);             // north accent (x -9.2..5)
    wallBox(7.1, 0, -6.1, 4.2, 3, 0.2, WALL);               // north, HR part
    wallBox(0, 0, 6.1, 18.4, 3, 0.2, WALL);                 // south
    wallBox(-9.1, 0, 0, 0.2, 3, 12, WALL);                  // west
    C(-9.2, 9.2, -6.3, -6, 3); C(-9.2, 9.2, 6, 6.3, 3); C(-9.3, -9, -6, 6, 3);
    // skirting
    box(MATTE, -2.1, 0, -5.99, 14.2, 0.08, 0.02, '#244f59');
    box(MATTE, 0, 0, 5.99, 18, 0.08, 0.02, '#c9cccb');
    box(MATTE, -8.99, 0, 0, 0.02, 0.08, 12, '#c9cccb');
    // east window wall: sill, header, glass, mullions
    box(GLOSS, 9.0, 0, 0, 0.3, 0.42, 12, '#d9dcdf');
    box(MATTE, 9.05, 2.85, 0, 0.3, 0.15, 12, WALL);
    GLASS.push({ x: 9.02, y: 1.635, z: 0, sx: 12, sy: 2.43, sz: 1, ry: -Math.PI / 2, rx: 0, rz: 0 });
    for (let z = -6; z <= 6.01; z += 1.5) box(GLOSS, 8.98, 0.42, z, 0.08, 2.43, 0.07, '#3b4148');
    box(GLOSS, 8.98, 2.1, 0, 0.06, 0.05, 12, '#3b4148');
    C(8.85, 9.4, -6, 6, 3);

    // ================================================================ CITY VIEW (beyond the east windows)
    box(MATTE, 60, -12.1, 0, 300, 0.1, 300, '#d7dde2');      // snowy ground (third floor = 12 m up)
    box(MATTE, 38, -12.06, 0, 7, 0.05, 300, '#6d8ba3');       // Scioto river
    box(MATTE, 18, -12.06, 0, 3.5, 0.05, 300, '#6b7178');     // street below
    for (let i = 0; i < 52; i++) {
      let x = 23 + rnd() * 85; if (x > 33 && x < 43) x += 12;
      const z = -75 + rnd() * 150;
      const near = x < 33;
      const hgt = near ? 6 + rnd() * 12 : 14 + rnd() * (x > 60 ? 50 : 30);
      const w = 4 + rnd() * 7, d = 4 + rnd() * 7;
      const tint = ['#d9dde2', '#c4ccd4', '#e2d6c8', '#b9c4cf', '#cfd5cc'][Math.floor(rnd() * 5)];
      box(CITY, x, -12, z, w, hgt, d, tint);
    }

    // ================================================================ ELEVATOR (west wall, spawn)
    box(GLOSS, -8.96, 0, 4.35, 0.08, 2.3, 0.1, '#9aa3ab');
    box(GLOSS, -8.96, 0, 5.65, 0.08, 2.3, 0.1, '#9aa3ab');
    box(GLOSS, -8.96, 2.2, 5.0, 0.08, 0.12, 1.4, '#9aa3ab');
    box(GLOSS, -8.97, 0, 4.7, 0.03, 2.2, 0.595, '#c9ced3');
    box(GLOSS, -8.97, 0, 5.3, 0.03, 2.2, 0.595, '#c9ced3');
    box(MATTE, -8.98, 1.0, 5.95, 0.04, 0.26, 0.12, '#3a3f45');
    box(GLOW, -8.955, 1.06, 5.95, 0.02, 0.05, 0.05, '#7fd3ff');
    box(GLOW, -8.955, 2.38, 5.0, 0.02, 0.08, 0.22, '#ff9a3c');

    // ================================================================ KITCHENETTE (west wall)
    box(MATTE, -7.1, 0, -2.3, 3.8, 0.01, 7.2, '#c4a27c');           // wood floor zone x -9..-5.2, z -5.9..1.3
    box(MATTE, -8.675, 0, -1.5, 0.65, 0.86, 4.2, '#b98d5f');       // base cabinets
    for (let z = -3.1; z < 0.6; z += 0.7) box(MATTE, -8.345, 0.1, z, 0.01, 0.66, 0.012, '#8f6a45'); // door seams
    box(MATTE, -8.65, 0.86, -1.5, 0.7, 0.04, 4.3, '#ecebe7');      // quartz top
    box(MATTE, -8.99, 0.9, -1.5, 0.02, 0.6, 4.2, '#8cc2b8');       // sage backsplash
    box(MATTE, -8.81, 1.55, -1.5, 0.38, 0.7, 4.2, '#f1f0ec');      // upper cabinets
    box(GLOSS, -8.61, 1.6, -1.5, 0.01, 0.02, 4.0, '#9aa3ab');      // handle rail
    box(GLOSS, -8.33, 0.06, 0.28, 0.03, 0.76, 0.56, '#b9c0c6');    // mini fridge front
    box(GLOSS, -8.31, 0.6, 0.06, 0.02, 0.18, 0.025, '#5c6670');    // fridge handle
    box(GLOSS, -8.62, 0.895, -2.6, 0.4, 0.012, 0.5, '#5d646b');    // sink
    cyl(CYLG, -8.88, 0.9, -2.6, 0.015, 0.3, '#c9ced3');
    box(GLOSS, -8.8, 1.17, -2.6, 0.18, 0.025, 0.025, '#c9ced3');
    // coffee machine (hotspot)
    box(MATTE, -8.71, 0.9, -1.0, 0.42, 0.5, 0.42, '#22252a');
    box(GLOSS, -8.495, 1.1, -1.0, 0.02, 0.27, 0.32, '#c9ced3');
    box(GLOSS, -8.56, 0.9, -1.0, 0.18, 0.03, 0.24, '#55595e');
    box(MATTE, -8.52, 1.02, -1.0, 0.08, 0.06, 0.06, '#2a2d31');
    box(GLOW, -8.484, 1.3, -0.92, 0.01, 0.04, 0.07, '#7fd3ff');
    cyl(CYLG, -8.75, 1.4, -1.08, 0.1, 0.13, '#3a2a20');
    cyl(CYL, -8.55, 0.93, -1.0, 0.04, 0.09, '#f4f1ea');           // cup under spout
    cyl(CYLG, -8.62, 0.9, -0.55, 0.07, 0.22, '#4a3b30');          // carafe
    ['#d9483b', '#e8c33a', '#2f8f8a', '#f4f1ea'].forEach((c, i) => cyl(CYL, -8.55, 0.9, -1.45 - i * 0.13, 0.042, 0.1, c));
    // brass Arabic coffee pot (dallah) + small finjan cups — Samir brews Arabic coffee for the team
    {
      const BR = '#b87333', DX = -8.6, DZ = -0.15;
      cyl(CYLG, DX, 0.9, DZ, 0.085, 0.02, BR);                                   // foot
      POT.push({ x: DX, y: 0.99, z: DZ, sx: 0.17, sy: 0.14, sz: 0.17, ry: 0, rx: Math.PI, rz: 0, color: BR }); // belly (wide at bottom)
      cyl(CYLG, DX, 1.06, DZ, 0.045, 0.03, BR);                                  // waist
      POT.push({ x: DX, y: 1.14, z: DZ, sx: 0.11, sy: 0.13, sz: 0.11, ry: 0, rx: 0, rz: 0, color: BR });       // flared neck
      cyl(CYLG, DX, 1.205, DZ, 0.05, 0.02, BR);                                  // lid
      ICO.push({ x: DX, y: 1.24, z: DZ, sx: 0.035, sy: 0.05, sz: 0.035, ry: 0, rx: 0, rz: 0, color: '#d9a066' }); // finial
      box(GLOSS, DX + 0.1, 1.04, DZ, 0.16, 0.022, 0.022, BR, 0, 0, 0.75);           // beak spout (toward the room)
      box(GLOSS, DX - 0.09, 0.98, DZ, 0.02, 0.16, 0.02, BR, 0, 0, -0.25);           // handle
      for (let i = 0; i < 3; i++) cyl(CYL, -8.6 + (i % 2) * 0.08, 0.9, 0.12 + i * 0.1, 0.028, 0.045, '#f4f1ea');
      cyl(CYLG, -8.56, 0.9, 0.22, 0.11, 0.008, '#c9a227');                        // small tray
    }
    cyl(CYL, -8.62, 0.9, -3.15, 0.15, 0.06, '#e8e3da');           // fruit bowl
    ico(-8.66, 1.0, -3.18, 0.055, '#f39c12'); ico(-8.57, 1.0, -3.1, 0.055, '#f39c12'); ico(-8.62, 1.05, -3.2, 0.05, '#c0392b');
    C(-9, -8.28, -3.65, 0.65, 1.2);
    // high table + 2 stools
    cyl(CYL, -6.0, 1.0, -2.9, 0.42, 0.04, '#ecebe7');
    cyl(CYLG, -6.0, 0, -2.9, 0.035, 1.0, '#5c6670');
    cyl(CYLG, -6.0, 0, -2.9, 0.24, 0.03, '#5c6670');
    for (const sx of [-0.62, 0.62]) {
      cyl(CYL, -6.0 + sx, 0.7, -2.9, 0.18, 0.06, '#b98d5f');
      cyl(CYLG, -6.0 + sx, 0, -2.9, 0.025, 0.7, '#5c6670');
      cyl(CYLG, -6.0 + sx, 0, -2.9, 0.17, 0.025, '#5c6670');
    }
    C(-6.85, -5.15, -3.35, -2.45, 1.1);

    // ================================================================ NORTH WALL: quiet room, clock, whiteboards, dashboard
    // quiet / reflection room door (Adam's prayer spot)
    box(MATTE, -4.2, 0, -5.97, 1.15, 2.25, 0.06, '#f2f1ec');
    box(MATTE, -4.2, 0, -5.93, 0.95, 2.12, 0.04, '#b98b5e');
    box(GLOSS, -3.85, 1.0, -5.89, 0.12, 0.025, 0.04, '#c9ced3');
    box(MATTE, -4.2, 1.5, -5.9, 0.28, 0.12, 0.02, '#f2f1ec');
    box(MATTE, -5.35, 0, -5.8, 1.0, 0.42, 0.34, '#d2b48c');       // shoe bench
    box(MATTE, -5.5, 0, -5.78, 0.11, 0.07, 0.24, '#3b3b3b');      // shoes under the bench
    box(MATTE, -5.36, 0, -5.78, 0.11, 0.07, 0.24, '#3b3b3b');
    box(MATTE, -5.1, 0.42, -5.82, 0.36, 0.04, 0.26, '#3f7a5a');   // folded prayer rug on the bench
    C(-5.9, -4.8, -6, -5.6, 0.6);
    // wall clock (10:00)
    const clock = new THREE.Mesh(track(new THREE.CircleGeometry(0.22, 24)), basicMap(texClock));
    clock.position.set(-2.55, 2.3, -5.975); group.add(clock);
    // whiteboards
    for (const [x, tex] of [[-0.7, texBoardA], [1.45, texBoardB]]) {
      box(GLOSS, x, 0.98, -5.985, 1.92, 1.16, 0.03, '#b8bec4');
      const wb = new THREE.Mesh(gPlane, std({ map: tex, roughness: 0.35, color: '#ffffff' }));
      wb.scale.set(1.84, 1.08, 1); wb.position.set(x, 1.56, -5.965); wb.receiveShadow = true; group.add(wb);
      box(GLOSS, x, 0.93, -5.92, 1.4, 0.04, 0.08, '#b8bec4');
      ['#2e6fb7', '#d9483b', '#222'].forEach((c, i) => box(MATTE, x - 0.4 + i * 0.12, 0.97, -5.92, 0.1, 0.018, 0.018, c));
    }
    // freight-tracking dashboard TV
    box(MATTE, 3.6, 1.12, -5.975, 1.68, 0.98, 0.05, '#111316');
    const tv = new THREE.Mesh(gPlane, basicMap(texDash));
    tv.scale.set(1.6, 0.9, 1); tv.position.set(3.6, 1.61, -5.945); group.add(tv);
    const truckDot = new THREE.Mesh(track(new THREE.CircleGeometry(0.022, 12)), track(new THREE.MeshBasicMaterial({ color: '#ffd34d' })));
    truckDot.position.set(3.6, 1.61, -5.94); group.add(truckDot);
    box(MATTE, 3.6, 0, -5.78, 1.7, 0.62, 0.4, '#b98d5f');          // low credenza under TV
    box(MATTE, 3.6, 0.62, -5.78, 1.74, 0.03, 0.42, '#ecebe7');
    C(2.75, 4.45, -6, -5.55, 0.7);
    // company sign (label sprite, depth-tested so it sits on the wall)
    let sign = null;
    if (typeof ctx.makeLabel === 'function') {
      sign = ctx.makeLabel({ ar: 'Salam Freight Tech', en: 'Salam Freight Tech' }, { size: 0.3, background: false, color: '#f3f6f6', depthTest: true });
      sign.position.set(0.4, 2.62, -5.9); group.add(sign);
      const q = ctx.makeLabel({ ar: 'غرفة هادئة', en: 'Quiet Room' }, { size: 0.15, background: 'rgba(31,79,89,0.9)', depthTest: true });
      q.position.set(-4.2, 2.45, -5.85); group.add(q);
    }

    // ================================================================ BENCH DESKS (2 rows x 6 stations)
    const STATIONS = [-1, 0.15, 1.3, 2.45, 3.6, 4.75];
    const ROWS = [1.5, -1.4];                         // z of desk centre; front row first
    const ROW_X0 = -1.575, ROW_X1 = 5.325, ROW_L = ROW_X1 - ROW_X0, ROW_C = (ROW_X0 + ROW_X1) / 2;
    const CODE_SCREENS = [];
    const chair = (x, z, ry) => {
      const s = Math.sin(ry), c = Math.cos(ry);
      cyl(CYL, x, 0.02, z, 0.27, 0.04, '#2a2c30');
      cyl(CYLG, x, 0.06, z, 0.03, 0.38, '#8a9198');
      box(MATTE, x, 0.44, z, 0.48, 0.07, 0.46, '#26282c', ry);
      box(MATTE, x + s * 0.23, 0.55, z + c * 0.23, 0.46, 0.52, 0.05, '#26282c', ry);
      box(GLOSS, x + s * 0.25, 0.5, z + c * 0.25, 0.06, 0.06, 0.06, '#8a9198', ry);
    };
    for (let r = 0; r < 2; r++) {
      const z = ROWS[r];
      box(MATTE, ROW_C, 0.71, z, ROW_L, 0.04, 0.84, '#f3f2ef');
      for (const lx of [ROW_X0 + 0.08, ROW_C, ROW_X1 - 0.08]) box(GLOSS, lx, 0, z, 0.05, 0.71, 0.72, '#d9dcdf');
      box(GLOSS, ROW_C, 0.55, z - 0.3, ROW_L - 0.2, 0.05, 0.03, '#d9dcdf');
      box(MATTE, ROW_C, 0.75, z - 0.405, ROW_L - 0.06, 0.3, 0.03, '#5f8a86');   // fabric divider
      C(ROW_X0, ROW_X1, z - 0.43, z + 0.43, 1.1);
      STATIONS.forEach((sx, i) => {
        // dual monitors, angled slightly inward
        for (const side of [-1, 1]) {
          const mx = sx + side * 0.27, mz = z - 0.2, ry = -side * 0.14;
          box(GLOSS, mx, 0.75, mz - 0.03, 0.2, 0.015, 0.14, '#2b2e33', ry);
          box(GLOSS, mx, 0.75, mz - 0.04, 0.045, 0.16, 0.03, '#2b2e33', ry);
          box(MATTE, mx, 0.86, mz, 0.54, 0.33, 0.025, '#16181b', ry);
          const isAdamSheet = r === 0 && i === 0 && side === 1;
          if (!isAdamSheet) CODE_SCREENS.push({ x: mx + Math.sin(ry) * 0.014, y: 1.025, z: mz + Math.cos(ry) * 0.014, sx: 0.5, sy: 0.29, sz: 1, ry, rx: 0, rz: 0, color: rnd() < 0.25 ? '#cfe3ff' : '#ffffff' });
        }
        box(MATTE, sx, 0.75, z + 0.12, 0.42, 0.02, 0.14, '#2a2d31');
        box(MATTE, sx + 0.3, 0.75, z + 0.14, 0.06, 0.02, 0.1, '#2a2d31');
        chair(sx, z + 0.8, 0);
        C(sx - 0.26, sx + 0.26, z + 0.56, z + 1.06, 1.0);
        if (!(r === 0 && i === 0)) {
          const p = rnd();
          if (p < 0.45) cyl(CYL, sx - 0.42, 0.75, z + 0.05, 0.04, 0.1, ['#d9483b', '#f4f1ea', '#2f8f8a', '#e8c33a'][Math.floor(rnd() * 4)]);
          if (p > 0.6) box(MATTE, sx - 0.4, 0.75, z + 0.1, 0.2, 0.025, 0.28, ['#2e6fb7', '#c0392b', '#3f7a5a'][Math.floor(rnd() * 3)], rnd() * 0.5);
          if (p > 0.3 && p < 0.42) { cyl(POT, sx + 0.45, 0.75, z - 0.05, 0.06, 0.09, '#f3f2ee'); ico(sx + 0.45, 0.9, z - 0.05, 0.09, '#4c8c46'); }
        }
      });
    }
    // Adam's desk props (hotspot adam_desk): spreadsheet monitor, mug, black gift box w/ silver ribbon
    const ADX = -1, ADZ = 1.5;
    const sheet = new THREE.Mesh(gPlane, basicMap(texSheet));
    { const ry = -0.14, mx = ADX + 0.27, mz = ADZ - 0.2; sheet.scale.set(0.5, 0.29, 1); sheet.rotation.y = ry; sheet.position.set(mx + Math.sin(ry) * 0.014, 1.025, mz + Math.cos(ry) * 0.014); group.add(sheet); }
    cyl(CYL, ADX - 0.42, 0.75, ADZ + 0.08, 0.042, 0.1, '#2f8f8a');
    box(MATTE, ADX + 0.36, 0.75, ADZ + 0.1, 0.2, 0.1, 0.2, '#111214', 0.25);
    box(GLOSS, ADX + 0.36, 0.75, ADZ + 0.1, 0.205, 0.103, 0.03, '#dfe3e8', 0.25);
    box(GLOSS, ADX + 0.36, 0.75, ADZ + 0.1, 0.03, 0.103, 0.205, '#dfe3e8', 0.25);
    box(GLOSS, ADX + 0.33, 0.853, ADZ + 0.1, 0.07, 0.03, 0.02, '#dfe3e8', 0.25, 0, 0.5);
    box(GLOSS, ADX + 0.39, 0.853, ADZ + 0.1, 0.07, 0.03, 0.02, '#dfe3e8', 0.25, 0, -0.5);
    box(MATTE, ADX - 0.15, 0.75, ADZ + 0.32, 0.16, 0.012, 0.22, '#fbfaf5', 0.1);  // notepad
    // second smartwatch box, on the front edge of the desk next to Samir
    { const gx = ADX + 0.52, gz = ADZ + 0.3, gr = -0.4;
      box(MATTE, gx, 0.75, gz, 0.2, 0.1, 0.2, '#111214', gr);
      box(GLOSS, gx, 0.75, gz, 0.205, 0.103, 0.03, '#dfe3e8', gr);
      box(GLOSS, gx, 0.75, gz, 0.03, 0.103, 0.205, '#dfe3e8', gr); }
    // lucky-charm necklace (situation work.amulet): thin gold chain (torus, lying flat) + blue bead (sphere)
    { const ax = ADX + 0.06, az = ADZ + 0.3;
      const chain = new THREE.Mesh(track(new THREE.TorusGeometry(0.065, 0.004, 6, 28)), track(new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 0.8, roughness: 0.3 })));
      chain.rotation.x = Math.PI / 2; chain.position.set(ax, 0.755, az); group.add(chain);
      const bead = new THREE.Mesh(track(new THREE.SphereGeometry(0.019, 14, 10)), track(new THREE.MeshStandardMaterial({ color: '#1f5fbf', metalness: 0.1, roughness: 0.25 })));
      bead.position.set(ax, 0.77, az + 0.068); group.add(bead);
      box(MATTE, ax + 0.13, 0.75, az - 0.02, 0.07, 0.004, 0.07, '#ffe680', 0.3);  // Jake's sticky note
    }

    // ================================================================ HR GLASS OFFICE (x 5..9, z -6..-2.8)
    const HZ = -2.8;
    GLASS.push({ x: 5, y: 1.45, z: -4.4, sx: 3.2, sy: 2.9, sz: 1, ry: Math.PI / 2, rx: 0, rz: 0 });
    GLASS.push({ x: 5.6, y: 1.45, z: HZ, sx: 1.2, sy: 2.9, sz: 1, ry: 0, rx: 0, rz: 0 });
    GLASS.push({ x: 8.3, y: 1.45, z: HZ, sx: 1.4, sy: 2.9, sz: 1, ry: 0, rx: 0, rz: 0 });
    GLASS.push({ x: 6.9, y: 2.55, z: HZ, sx: 1.4, sy: 0.7, sz: 1, ry: 0, rx: 0, rz: 0 });
    // aluminium frames
    box(GLOSS, 5, 2.9, -4.4, 0.07, 0.1, 3.2, FRAME); box(GLOSS, 5, 0, -4.4, 0.07, 0.06, 3.2, FRAME);
    box(GLOSS, 7, 2.9, HZ, 4.0, 0.1, 0.07, FRAME);
    box(GLOSS, 5.6, 0, HZ, 1.2, 0.06, 0.07, FRAME); box(GLOSS, 8.3, 0, HZ, 1.4, 0.06, 0.07, FRAME);
    for (const [x, z] of [[5, -6], [5, -4.4], [5, HZ], [6.2, HZ], [7.6, HZ]]) box(GLOSS, x, 0, z, 0.07, 2.95, 0.07, FRAME);
    box(GLOSS, 6.9, 2.18, HZ, 1.4, 0.06, 0.07, FRAME);
    box(MATTE, 5.6, 1.0, HZ + 0.005, 1.2, 0.08, 0.02, '#5f8a86');   // frosted manifestation band
    box(MATTE, 8.3, 1.0, HZ + 0.005, 1.4, 0.08, 0.02, '#5f8a86');
    box(MATTE, 5.005, 1.0, -4.4, 0.02, 0.08, 3.2, '#5f8a86');
    C(4.95, 5.05, -6, HZ, 2.9); C(5, 6.2, HZ - 0.05, HZ + 0.05, 2.9); C(7.6, 9, HZ - 0.05, HZ + 0.05, 2.9);
    // Maryam's desk (hotspot hr_desk)
    const HX = 6.5, HDZ = -4.0;
    box(MATTE, HX, 0.71, HDZ, 1.5, 0.04, 0.72, '#f4f4f2');
    box(GLOSS, HX - 0.71, 0, HDZ, 0.04, 0.71, 0.66, '#d9dcdf'); box(GLOSS, HX + 0.71, 0, HDZ, 0.04, 0.71, 0.66, '#d9dcdf');
    box(MATTE, HX, 0.2, HDZ + 0.33, 1.38, 0.45, 0.02, '#e2e4e3');
    C(HX - 0.75, HX + 0.75, HDZ - 0.36, HDZ + 0.36, 1.1);
    { // monitor turned toward the visitor, showing the 401(k) form
      const ry = -0.64, mx = HX + 0.45, mz = HDZ - 0.12;
      box(GLOSS, mx, 0.75, mz, 0.2, 0.015, 0.14, '#2b2e33', ry);
      box(GLOSS, mx - Math.sin(ry) * 0.02, 0.75, mz - Math.cos(ry) * 0.02, 0.045, 0.16, 0.03, '#2b2e33', ry);
      box(MATTE, mx, 0.86, mz, 0.56, 0.34, 0.025, '#16181b', ry);
      const form = new THREE.Mesh(gPlane, basicMap(texForm));
      form.scale.set(0.52, 0.3, 1); form.rotation.y = ry; form.position.set(mx + Math.sin(ry) * 0.014, 1.03, mz + Math.cos(ry) * 0.014); group.add(form);
    }
    box(MATTE, HX - 0.05, 0.75, HDZ - 0.2, 0.42, 0.02, 0.14, '#2a2d31');
    [['#c0392b', 0.1], ['#2e6fb7', -0.08], ['#e8c33a', 0.2]].forEach(([c, ry], i) => box(MATTE, HX - 0.5, 0.75 + i * 0.026, HDZ + 0.08, 0.24, 0.025, 0.32, c, ry));
    cyl(POT, HX - 0.58, 0.75, HDZ - 0.22, 0.05, 0.08, '#f3f2ee'); ico(HX - 0.58, 0.88, HDZ - 0.22, 0.08, '#4c8c46');
    box(MATTE, HX - 0.28, 0.75, HDZ - 0.26, 0.15, 0.19, 0.015, '#3a3a3a', Math.PI - 0.3, -0.15);
    box(GLOSS, 8.55, 0, -5.55, 0.5, 0.72, 0.55, '#b9bfc5'); C(8.3, 8.85, -5.85, -5.25, 0.8);  // filing cabinet
    for (let i = 0; i < 2; i++) box(GLOSS, 8.55, 0.2 + i * 0.32, -5.27, 0.16, 0.02, 0.02, '#5c6670');
    // folded turquoise headscarf on Maryam's desk (situation work.hijab): two folded layers + a soft rounded fold
    { const sx = HX + 0.22, sz = HDZ + 0.18;
      box(MATTE, sx, 0.75, sz, 0.26, 0.022, 0.2, '#2a9d8f', 0.12);
      box(MATTE, sx + 0.005, 0.772, sz - 0.005, 0.23, 0.02, 0.17, '#38b2a3', 0.08);
      const fold = new THREE.Mesh(track(new THREE.SphereGeometry(0.1, 16, 10)), track(new THREE.MeshStandardMaterial({ color: '#3fbfae', roughness: 0.9 })));
      fold.scale.set(1.1, 0.18, 0.8); fold.position.set(sx + 0.005, 0.795, sz - 0.005); fold.rotation.y = 0.08; group.add(fold);
    }
    chair(5.85, -5.0, Math.PI + 0.5);                                 // Maryam's chair (pushed aside)
    chair(5.55, -3.3, -0.25); C(5.3, 5.8, -3.55, -3.05, 1.0);         // visitor chair
    // framed poster on HR back wall
    box(MATTE, 7.4, 1.3, -5.985, 1.0, 0.7, 0.02, '#2b2f33');
    box(MATTE, 7.2, 1.36, -5.97, 0.5, 0.58, 0.01, '#e8a33a'); box(MATTE, 7.66, 1.36, -5.97, 0.38, 0.28, 0.01, '#2f6f7e'); box(MATTE, 7.66, 1.66, -5.97, 0.38, 0.26, 0.01, '#f1e9e0');

    // ================================================================ LOUNGE + EXIT (south wall)
    box(MATTE, -4, 0, 4.95, 2.8, 0.012, 1.9, '#d8c9ae');                // rug
    box(MATTE, -4, 0.08, 5.5, 2.0, 0.36, 0.85, '#b5654a');             // sofa seat
    box(MATTE, -4, 0.44, 5.81, 2.0, 0.48, 0.22, '#b5654a');            // back
    box(MATTE, -4.92, 0.08, 5.5, 0.18, 0.52, 0.85, '#a3573e'); box(MATTE, -3.08, 0.08, 5.5, 0.18, 0.52, 0.85, '#a3573e');
    for (const x of [-4.85, -3.15]) for (const z of [5.15, 5.85]) box(GLOSS, x, 0, z, 0.05, 0.08, 0.05, '#2b2e33');
    box(MATTE, -4.5, 0.44, 5.6, 0.36, 0.34, 0.12, '#e8c33a', 0.2, -0.2);   // cushion
    box(MATTE, -4, 0.36, 4.5, 0.95, 0.04, 0.5, '#b98d5f');              // coffee table
    for (const x of [-4.4, -3.6]) box(GLOSS, x, 0, 4.5, 0.03, 0.36, 0.42, '#2b2e33');
    box(MATTE, -3.85, 0.4, 4.5, 0.22, 0.02, 0.3, '#2e6fb7', 0.3);
    C(-5.05, -2.95, 5.05, 6, 1.0); C(-4.5, -3.5, 4.24, 4.76, 0.5);
    // floor lamp
    cyl(CYLG, -5.45, 0, 5.6, 0.14, 0.03, '#2b2e33'); cyl(CYLG, -5.45, 0, 5.6, 0.015, 1.5, '#2b2e33');
    cyl(CYL, -5.45, 1.42, 5.6, 0.17, 0.26, '#fff1d0');
    // stairwell EXIT door
    box(GLOSS, 7.5, 0, 5.97, 1.2, 2.25, 0.06, '#9aa3ab');
    box(MATTE, 7.5, 0, 5.93, 1.0, 2.12, 0.04, '#6f7d8a');
    box(GLOSS, 7.5, 1.0, 5.88, 0.8, 0.05, 0.05, '#c9ced3');
    box(MATTE, 7.5, 2.3, 5.96, 0.42, 0.18, 0.06, '#1b2a1f');
    box(GLOW, 7.5, 2.32, 5.925, 0.36, 0.13, 0.02, '#2ecc71');

    // ================================================================ PLANTS
    const plant = (x, z, s = 1) => {
      cyl(POT, x, 0, z, 0.22 * s, 0.45 * s, '#f3f2ee');
      cyl(CYL, x, 0.45 * s - 0.02, z, 0.19 * s, 0.03, '#4a3a2c');
      const greens = ['#3f7d3a', '#4c8c46', '#2f6b3a', '#5a9a4e'];
      ico(x, 0.8 * s, z, 0.3 * s, greens[Math.floor(rnd() * 4)]);
      ico(x + 0.08 * s, 1.1 * s, z - 0.05 * s, 0.26 * s, greens[Math.floor(rnd() * 4)]);
      ico(x - 0.06 * s, 1.36 * s, z + 0.04 * s, 0.18 * s, greens[Math.floor(rnd() * 4)]);
      C(x - 0.24 * s, x + 0.24 * s, z - 0.24 * s, z + 0.24 * s, 1.2);
    };
    plant(5.95, 1.5); plant(5.95, -1.4); plant(-2.15, -1.4);
    plant(8.5, 3.6); plant(8.45, -1.9); plant(-8.5, 3.4); plant(-3.25, -5.55, 0.9);
    plant(8.5, -4.6, 0.8); plant(-2.6, 5.55, 0.85);

    // ================================================================ BUILD BATCHES
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const batch = (geo, mat, list, { cast = true, receive = true, name } = {}) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((s, i) => {
        dummy.position.set(s.x, s.y, s.z);
        dummy.rotation.set(s.rx || 0, s.ry || 0, s.rz || 0);
        dummy.scale.set(s.sx, s.sy, s.sz);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        im.setColorAt(i, col.set(s.color || '#ffffff'));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = cast; im.receiveShadow = receive;
      if (name) im.name = name;
      group.add(im);
      own.push(im);
      return im;
    };
    batch(gBox, matMatte, MATTE, { name: 'work:matte' });
    batch(gBox, matGloss, GLOSS, { name: 'work:gloss' });
    batch(gCyl, matMatte, CYL, { name: 'work:cyl' });
    batch(gCyl, matGloss, CYLG, { name: 'work:cylGloss' });
    batch(gPot, matMatte, POT, { name: 'work:pots' });
    batch(gIco, matLeaf, ICO, { name: 'work:leaves' });
    batch(gBox, matGlow, GLOW, { cast: false, receive: false, name: 'work:glow' });
    batch(gDown, matGlow, DOWN, { cast: false, receive: false, name: 'work:lightStrips' });
    batch(gPlane, matGlass, GLASS, { cast: false, receive: false, name: 'work:glass' });
    batch(gPlane, matScreen, CODE_SCREENS, { cast: false, receive: false, name: 'work:screens' });
    batch(gBox, matCity, CITY, { cast: false, receive: false, name: 'work:skyline' });

    // invisible camera-occluder proxies for the walls (raycast only: never rendered, not in the group)
    const occMat = track(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
    const cameraOccluders = OCC.map((s) => {
      const m = new THREE.Mesh(gBox, occMat);
      m.position.set(s.x, s.y, s.z); m.scale.set(s.sx, s.sy, s.sz); m.visible = false;
      m.updateMatrixWorld(true);
      return m;
    });

    // ================================================================ STEAM (ambience)
    const steamGeo = track(new THREE.SphereGeometry(1, 8, 6));
    const steam = [];
    for (let i = 0; i < 3; i++) {
      const m = track(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false }));
      const p = new THREE.Mesh(steamGeo, m);
      p.position.set(-8.6, 1.22, -0.15); p.scale.setScalar(0.03);
      group.add(p); steam.push(p);
    }

    // ================================================================ NPCs
    const yawTo = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));
    const typists = [];
    function seated(id, look, x, z, headphones) {
      const base = { id, position: [x, 0, z], yaw: 0, look, showName: false };
      if (typeof ctx.makeNPC !== 'function') return base;
      try {
        const fig = ctx.makeNPC(look);
        const p = fig.userData.parts || {};
        const s = (look.height || 1.75) / 1.75;
        if (p.body) p.body.position.y = 0.52 / s - 0.86;
        if (p.legL) p.legL.rotation.x = 1.35;
        if (p.legR) p.legR.rotation.x = 1.35;
        if (p.armL) p.armL.rotation.x = 0.95;
        if (p.armR) p.armR.rotation.x = 0.95;
        if (headphones && p.head) {
          const hm = track(new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.5 }));
          const band = new THREE.Mesh(track(new THREE.TorusGeometry(0.145, 0.016, 6, 16, Math.PI)), hm);
          band.position.y = 0.01; p.head.add(band);
          const cupG = track(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10));
          for (const sx of [-1, 1]) { const cup = new THREE.Mesh(cupG, hm); cup.rotation.z = Math.PI / 2; cup.position.set(sx * 0.14, 0, 0); p.head.add(cup); }
        }
        if (p.armL) typists.push({ p, ph: rnd() * 6 });
        return { ...base, object: fig, animate: false, collide: false };
      } catch (e) {
        console.warn('[scene:work] seated NPC fallback', e);
        return base;
      }
    }

    const SAMIR_COFFEE = [-7.45, 0, -0.25], SAMIR_COFFEE_YAW = yawTo([-7.45, -0.25], [-5.8, 3.2]);
    const SAMIR_DESK = [-0.2, 0, 2.45], SAMIR_DESK_YAW = yawTo([-0.2, 2.45], [-2.6, 4.2]);
    const npcs = [
      // Samir (Muslim colleague) is the NPC of two situations. `stations` lets the engine move him to the
      // next unfinished one; `position`/`yaw` (= coffee_machine station) is the fallback.
      { id: 'samir', position: SAMIR_COFFEE, yaw: SAMIR_COFFEE_YAW,
        stations: {
          coffee_machine: { position: SAMIR_COFFEE, yaw: SAMIR_COFFEE_YAW },
          adam_desk: { position: SAMIR_DESK, yaw: SAMIR_DESK_YAW }
        },
        look: { skin: '#c99a6e', shirt: '#f2f2f2', suit: '#6d7278', tie: '#f2f2f2', pants: '#2f3542', hair: '#141110', beard: '#141110', glasses: true, height: 1.78 } },
      { id: 'bg_jake', position: [-5, 0, 1.5], yaw: yawTo([-5, 1.5], [-3.2, -3.5]), showName: false,
        look: { skin: '#f1c27d', shirt: '#a83232', pants: '#3b4a5e', hair: '#c9a45c', beard: '#c9a45c', build: 1.15, height: 1.84 } },
      { id: 'bg_mike', position: [-7.6, 0, 3.4], yaw: yawTo([-7.6, 3.4], [-9, 5]), showName: false,
        look: { skin: '#e8b98a', shirt: '#f2f2f2', suit: '#1f2d4d', tie: '#7fb3e0', pants: '#1f2d4d', hair: '#5a3d2b', height: 1.8 } },
      // Maryam (Muslim HR colleague, hijab) — situation work.hijab; same spot the former 'linda' NPC used
      { id: 'maryam', position: [6.55, 0, -4.85], yaw: yawTo([6.55, -4.85], [6.9, -2.8]),
        look: { skin: '#e0b98f', shirt: '#f1e9e0', suit: '#7a2236', tie: '#f1e9e0', hijab: true, hijabColor: '#3d4f73', pants: '#2b2b33', dress: '#2b2b33', height: 1.66 } },
      seated('bg_coworker1', { skin: '#5a3a22', shirt: '#d4a017', pants: '#2f3542', hair: '#1a1410', height: 1.66 }, 1.3, ROWS[1] + 0.78, false),
      seated('bg_coworker2', { skin: '#f0c8a0', shirt: '#3f7a4a', pants: '#3a3f47', hair: '#7a5232', height: 1.78 }, 3.6, ROWS[1] + 0.78, true)
    ];

    // ================================================================ HOTSPOTS / SPAWN / EXIT
    const hotspots = [
      { id: 'coffee_machine', position: [-8.6, 0.95, -1.0], radius: 1.9, markerHeight: 1.35, label: { ar: 'آلة القهوة', en: 'Coffee machine' } },
      { id: 'adam_desk', position: [-1.0, 0.78, 1.5], radius: 1.9, markerHeight: 1.4, label: { ar: 'مكتب آدم', en: "Adam's desk" } },
      { id: 'hr_desk', position: [6.5, 0.78, -4.0], radius: 1.8, markerHeight: 1.4, label: { ar: 'مكتب الموارد البشرية', en: 'HR office' } }
    ];

    // ================================================================ AMBIENT UPDATE (no allocations)
    const RW = 512, RH = 288, TVX = 3.6, TVY = 1.61, TVW = 1.6, TVH = 0.9;
    const segLen = [];
    let routeTotal = 0;
    for (let i = 1; i < ROUTE.length; i++) { const l = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]); segLen.push(l); routeTotal += l; }

    function update(dt, t) {
      // truck dot travelling along the dashboard route
      let d = ((t * 0.07) % 1) * routeTotal, i = 0;
      while (i < segLen.length - 1 && d > segLen[i]) { d -= segLen[i]; i++; }
      const k = Math.min(1, d / segLen[i]);
      const px = ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * k, py = ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * k;
      truckDot.position.x = TVX + (px / RW - 0.5) * TVW;
      truckDot.position.y = TVY + (0.5 - py / RH) * TVH;
      truckDot.scale.setScalar(1 + Math.sin(t * 6) * 0.25);
      // steam over the dallah
      for (let j = 0; j < steam.length; j++) {
        const f = (t * 0.32 + j / steam.length) % 1;
        const p = steam[j];
        p.position.y = 1.22 + f * 0.35;
        p.position.x = -8.6 + Math.sin(t * 1.3 + j * 2) * 0.03 * f;
        p.scale.setScalar(0.025 + f * 0.05);
        p.material.opacity = 0.32 * (1 - f) * Math.min(1, f * 5);
      }
      // seated coworkers typing
      for (let j = 0; j < typists.length; j++) {
        const { p, ph } = typists[j];
        p.armL.rotation.x = 0.95 + Math.sin(t * 13 + ph) * 0.035;
        p.armR.rotation.x = 0.95 + Math.sin(t * 11 + ph + 1.7) * 0.035;
        if (p.head) p.head.rotation.y = Math.sin(t * 0.4 + ph) * 0.12;
      }
    }

    function dispose() {
      for (const o of own) { try { o.dispose?.(); } catch (e) { /* already freed */ } }
      own.length = 0;
    }

    return {
      group,
      spawn: { position: [-6.6, 0, 4.7], yaw: -Math.PI / 2 },
      colliders,
      hotspots,
      npcs,
      exit: { position: [7.5, 0, 5.0], radius: 1.5 },
      lights: 'day',
      cameraOccluders,
      update,
      dispose
    };
  }
};
