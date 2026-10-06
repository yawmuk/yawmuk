// «يومك» — School scene: Scioto Valley Community College, Monday 18:30 (evening).
// A mint-green corridor (x -12..10, z -2..2) linking:
//   • exam classroom 114 (left, x -10..-2, z -9..-2)  → hotspot `exam_desk`  (Kareem; Tyler seated in front)
//   • Financial Aid office (right, x -1..3, z 2..6)   → hotspot `aid_office` (Omar in scrubs; Ms. Rodriguez behind)
//   • library corner + EMPTY glass study room (left end, x 2..10, z -8..-2) → hotspot `study_room` (Noor)
// Premise: Adam is learning about Islam from his Muslim friends.
// Exit: glass doors to the parking lot at the corridor's east end.
//
// Procedural geometry only. Almost every static box goes through per-material InstancedMesh
// "batches" (one draw call per material), so the whole building is ~70 meshes.
// An invisible merged occluder mesh (ceiling + full-height walls) keeps the third-person camera indoors.

const H = 3; // ceiling height

export default {
  id: 'school',
  title: { ar: 'الكلية', en: 'College' },

  build(ctx) {
    const { THREE } = ctx;
    const group = ctx.group;
    const colliders = [];
    const owned = { tex: [], mat: [], geo: [] }; // everything we create (disposed in dispose())

    // ------------------------------------------------------------------ helpers
    const mat = (color, o = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
      owned.mat.push(m);
      return m;
    };
    const basic = (o) => { const m = new THREE.MeshBasicMaterial(o); owned.mat.push(m); return m; };
    const canvasTex = (w, h, draw, repeat) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      draw(g, w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
      owned.tex.push(t);
      return t;
    };
    const rand = ctx.rand ? ctx.rand(1830) : (() => { let s = 1830; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    const camBoxes = []; // full-height walls → merged invisible camera-occluder mesh (see end of build)
    const col = (x0, z0, x1, z1, y0 = 0, y1 = H, camBlock = true) => {
      colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1] });
      if (camBlock && y1 - y0 >= 2.5) camBoxes.push([x0, z0, x1, z1]);
    };

    const unitBox = new THREE.BoxGeometry(1, 1, 1); owned.geo.push(unitBox);
    const unitPlane = new THREE.PlaneGeometry(1, 1); owned.geo.push(unitPlane);

    // Box batches: one InstancedMesh per material.
    const batches = new Map();
    const C = (m, cx, cy, cz, w, h, d, rotY = 0) => {
      if (!batches.has(m)) batches.set(m, []);
      batches.get(m).push([cx, cy, cz, w, h, d, rotY]);
    };
    const B = (m, x0, y0, z0, x1, y1, z1, collide = false) => {
      C(m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
      if (collide) col(x0, z0, x1, z1, y0, y1);
    };
    const dummy = new THREE.Object3D();
    const instanced = (geo, m, items, { cast = true, receive = true } = {}) => {
      const im = new THREE.InstancedMesh(geo, m, items.length);
      items.forEach(([cx, cy, cz, w, h, d, ry], i) => {
        dummy.position.set(cx, cy, cz);
        dummy.rotation.set(0, ry || 0, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = cast; im.receiveShadow = receive;
      im.computeBoundingSphere?.();
      group.add(im);
      return im;
    };
    // Vertical plane, centre (x,y,z); faces +Z at rotY=0, +X at PI/2, -X at -PI/2, -Z at PI.
    const plane = (m, w, h, x, y, z, rotY = 0) => {
      const p = new THREE.Mesh(unitPlane, m);
      p.scale.set(w, h, 1); p.position.set(x, y, z); p.rotation.y = rotY;
      p.receiveShadow = false; p.castShadow = false;
      group.add(p);
      return p;
    };
    const mesh = (geo, m, x, y, z, { cast = true } = {}) => {
      owned.geo.push(geo);
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true;
      group.add(o);
      return o;
    };

    // ------------------------------------------------------------------ palette
    const M = {
      mint: mat('#cfe3d8'),
      white: mat('#f1efe9'),
      office: mat('#efe6d6'),
      lib: mat('#eadcc4'),
      trim: mat('#4f6d63', { roughness: 0.6 }),
      teal: mat('#2f7a78', { roughness: 0.6 }),
      woodL: mat('#c9a47a', { roughness: 0.6 }),
      woodD: mat('#6b4a33', { roughness: 0.6 }),
      metal: mat('#8f99a3', { metalness: 0.6, roughness: 0.4 }),
      alu: mat('#c3cad1', { metalness: 0.7, roughness: 0.3 }),
      dark: mat('#2a2f36', { roughness: 0.5 }),
      navy: mat('#2e4566', { roughness: 0.55 }),
      rust: mat('#b5452f', { roughness: 0.5 }),
      paper: mat('#fbfaf3', { roughness: 0.9 }),
      cork: mat('#b98a5a', { roughness: 1 }),
      orange: mat('#e08a2e'), green: mat('#4f9a5e'), blue: mat('#3f7fc0'), yellow: mat('#e8c33a'),
      frost: mat('#ffffff', { transparent: true, opacity: 0.45, depthWrite: false, roughness: 0.3 }),
      glow: mat('#ffffff', { emissive: '#f4f8ff', emissiveIntensity: 1.1 }),
      warmGlow: mat('#fff1d0', { emissive: '#ffd58a', emissiveIntensity: 1.3 }),
      screen: mat('#16263a', { emissive: '#4f8fe0', emissiveIntensity: 0.6, roughness: 0.3 })
    };
    const glass = ctx.mats?.glass || mat('#a9d6e5', { transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false });

    // ------------------------------------------------------------------ textures
    const floorTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#d8cfbf'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        const r = rand();
        g.fillStyle = r < 0.45 ? 'rgba(120,105,85,0.35)' : r < 0.8 ? 'rgba(250,246,236,0.6)' : 'rgba(90,110,100,0.35)';
        g.fillRect(rand() * w, rand() * h, 1 + rand() * 2.2, 1 + rand() * 2.2);
      }
      g.strokeStyle = 'rgba(110,98,80,0.35)'; g.lineWidth = 2;
      g.strokeRect(1, 1, w / 2 - 2, h / 2 - 2); g.strokeRect(w / 2 + 1, 1, w / 2 - 2, h / 2 - 2);
      g.strokeRect(1, h / 2 + 1, w / 2 - 2, h / 2 - 2); g.strokeRect(w / 2 + 1, h / 2 + 1, w / 2 - 2, h / 2 - 2);
    }, [22 / 1.2, 15 / 1.2]);
    const ceilTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#eeebe4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(150,145,135,0.25)'; g.fillRect(rand() * w, rand() * h, 1, 1); }
      g.strokeStyle = '#b9b5ac'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
    }, [22.4 / 0.6, 15.4 / 0.6]);
    // Dusk view through windows: deep blue sky, last orange glow, parking-lot lamps.
    const duskTex = canvasTex(256, 192, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.7);
      sky.addColorStop(0, '#141b36'); sky.addColorStop(0.55, '#2c3566'); sky.addColorStop(0.85, '#7a4f6a'); sky.addColorStop(1, '#d07a4a');
      g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.7);
      g.fillStyle = '#1a1c26';
      for (let x = 0; x < w; x += 10) { const th = 10 + rand() * 22; g.beginPath(); g.ellipse(x, h * 0.7, 9, th, 0, Math.PI, 0); g.fill(); }
      g.fillStyle = '#20222b'; g.fillRect(0, h * 0.7, w, h * 0.3);
      for (const lx of [40, 128, 210]) {
        g.fillStyle = '#3a3c46'; g.fillRect(lx - 1, h * 0.38, 2, h * 0.35);
        const glow = g.createRadialGradient(lx, h * 0.38, 0, lx, h * 0.38, 16);
        glow.addColorStop(0, 'rgba(255,214,120,1)'); glow.addColorStop(1, 'rgba(255,214,120,0)');
        g.fillStyle = glow; g.fillRect(lx - 16, h * 0.38 - 16, 32, 32);
        g.fillStyle = 'rgba(255,200,110,0.18)'; g.beginPath(); g.moveTo(lx, h * 0.39); g.lineTo(lx - 26, h); g.lineTo(lx + 26, h); g.fill();
      }
      for (let i = 0; i < 6; i++) { // parked cars + tail lights
        const cx = 15 + i * 42 + rand() * 10, cy = h * 0.8 + rand() * 8;
        g.fillStyle = ['#3b4252', '#56303a', '#2f4a5a'][i % 3]; g.fillRect(cx, cy, 28, 11);
        g.fillStyle = '#ff4a3a'; g.fillRect(cx + 1, cy + 4, 3, 2); g.fillRect(cx + 24, cy + 4, 3, 2);
      }
      for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(255,255,230,0.8)'; g.fillRect(rand() * w, rand() * h * 0.35, 1, 1); }
      g.strokeStyle = '#c9cfd4'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    });
    const duskOpen = canvasTex(256, 256, (g, w, h) => g.drawImage(duskTex.image, 6, 6, 244, 180, 0, 0, w, h));
    const lockerTex = canvasTex(64, 256, (g, w, h) => {
      g.fillStyle = '#3d5a80'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2c4362'; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
      g.fillStyle = '#26394f';
      for (let i = 0; i < 5; i++) { g.fillRect(14, 14 + i * 7, 36, 3); g.fillRect(14, 206 + i * 7, 36, 3); }
      g.fillStyle = '#c3cad1'; g.fillRect(46, 112, 6, 30);
      g.fillStyle = '#e8e4d8'; g.fillRect(18, 60, 20, 10);
    });
    const poster = (w, h, bg, lines, accent) => canvasTex(w, h, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      if (accent) { g.fillStyle = accent; g.fillRect(0, h * 0.72, w, h * 0.28); }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const [txt, y, size, color, weight] of lines) {
        g.fillStyle = color; g.font = `${weight || 700} ${size}px "Segoe UI", Tahoma, sans-serif`;
        g.fillText(txt, w / 2, y);
      }
    });
    const whiteboardTex = canvasTex(512, 160, (g, w, h) => {
      g.fillStyle = '#f7f8f6'; g.fillRect(0, 0, w, h);
      g.font = '700 26px "Segoe UI", Tahoma, sans-serif'; g.fillStyle = '#1d4f91';
      g.fillText('CS 1100 — Week 6 Quiz (online)', 18, 38);
      g.font = '600 19px "Segoe UI", Tahoma, sans-serif'; g.fillStyle = '#b3261e';
      g.fillText('• Individual work only — no collaboration', 22, 74);
      g.fillStyle = '#1f6b3a';
      g.fillText('• Open 24 h · due 11:59 PM', 22, 102);
      g.fillStyle = '#333';
      g.fillText('• Cite any AI tool you use', 22, 130);
      g.strokeStyle = 'rgba(29,79,145,0.5)'; g.lineWidth = 3;
      g.beginPath(); g.arc(440, 100, 30, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#1d4f91'; g.font = '700 20px sans-serif'; g.fillText('A+', 426, 107);
    });
    const slideTex = poster(256, 160, '#eef3fb', [
      ['Quiz 6 opens tonight', 40, 22, '#1d3f73'], ['Academic Integrity Policy', 82, 16, '#333', 600],
      ['Scioto Valley CC', 140, 14, '#fff', 600]
    ], '#2f7a78');
    const quizTex = poster(128, 80, '#ffffff', [
      ['SVCC Online · Quiz 6', 16, 11, '#1d3f73'], ['Q3 of 20 ___________', 40, 10, '#444', 500], ['○ A   ○ B   ○ C', 60, 10, '#444', 500]
    ]);
    const clockTex = canvasTex(128, 128, (g, w) => {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#222';
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(64 + Math.sin(a) * 52, 64 - Math.cos(a) * 52); g.rotate(a); g.fillRect(-2, -6, 4, 12); g.restore(); }
      g.font = '700 11px sans-serif'; g.textAlign = 'center'; g.fillText('SVCC', w / 2, 42);
    });
    const corkTex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#b98a5a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = rand() < 0.5 ? 'rgba(90,60,30,0.35)' : 'rgba(230,200,150,0.35)'; g.fillRect(rand() * w, rand() * h, 2, 2); }
      const notes = ['#fdf6c8', '#ffd6d6', '#d6ecff', '#ffffff', '#d9f2d0', '#ffe2b8', '#ffffff', '#e8dcff'];
      notes.forEach((c, i) => {
        const x = 10 + (i % 4) * 62 + rand() * 6, y = 10 + Math.floor(i / 4) * 58 + rand() * 6;
        g.save(); g.translate(x + 25, y + 22); g.rotate((rand() - 0.5) * 0.2);
        g.fillStyle = c; g.fillRect(-25, -22, 50, 44);
        g.fillStyle = 'rgba(40,40,40,0.55)';
        for (let l = 0; l < 4; l++) g.fillRect(-19, -12 + l * 8, 30 + rand() * 8, 2);
        g.fillStyle = ['#c0392b', '#2e6fb7', '#27ae60'][i % 3]; g.beginPath(); g.arc(0, -18, 3, 0, Math.PI * 2); g.fill();
        g.restore();
      });
    });
    const collegeSignTex = poster(512, 80, '#2f5d55', [
      ['SCIOTO VALLEY COMMUNITY COLLEGE', 32, 30, '#f4efe2'], ['Evening Programs · Columbus, Ohio', 64, 16, '#cfe3d8', 600]
    ]);
    const aidSignTex = poster(384, 64, '#f4efe2', [['FINANCIAL AID OFFICE', 33, 30, '#2f5d55']]);
    const libSignTex = poster(320, 64, '#3b2c22', [['LIBRARY · Quiet Study', 33, 26, '#f3e3c3']]);
    const roomSignTex = poster(128, 64, '#2a2f36', [['114', 26, 26, '#fff'], ['CS 1100', 50, 13, '#cfe3d8', 600]]);
    const studySignTex = poster(192, 48, '#2a2f36', [['Study Room 2', 25, 22, '#ffffff']]);
    const exitTex = poster(128, 48, '#b3261e', [['EXIT', 25, 30, '#ffffff']]);
    const fafsaTex = poster(160, 208, '#1d3f73', [
      ['FAFSA', 50, 40, '#ffffff'], ['2027–28 is OPEN', 92, 16, '#ffd34d'], ['Grants · Work-Study', 124, 13, '#cfe3d8', 600],
      ['Ask us!', 170, 18, '#1d3f73']
    ], '#ffd34d');
    const scholTex = poster(160, 208, '#2f7a78', [
      ['Scholarships', 46, 22, '#ffffff'], ['& Grants', 74, 20, '#ffffff'], ['Apply by Nov 15', 112, 14, '#ffe2b8', 600],
      ['$ free money', 170, 16, '#2f7a78']
    ], '#f4efe2');
    const tutorTex = poster(192, 96, '#e08a2e', [['Tutoring Center', 34, 20, '#ffffff'], ['Free · Room 120 →', 68, 14, '#2a2f36', 600]]);
    const vendTex = canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = '#0f1820'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#cfe8ff'; g.fillRect(6, 8, 84, 200);
      const cols = ['#c0392b', '#e8c33a', '#27ae60', '#2e6fb7', '#e08a2e', '#8e44ad'];
      for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { g.fillStyle = cols[(r + c * 2) % 6]; g.fillRect(12 + c * 20, 16 + r * 32, 14, 22); }
      g.fillStyle = '#334'; g.fillRect(98, 30, 22, 60); g.fillStyle = '#7cf'; g.fillRect(101, 34, 16, 10);
      g.fillStyle = '#222'; g.fillRect(10, 216, 80, 28);
    });
    const tvTex = poster(256, 144, '#f5f7fb', [['Study Room 2', 34, 20, '#1d3f73'], ['Door stays open · 4 seats', 80, 15, '#2f7a78', 600], ['Room free · book at the desk', 120, 13, '#555', 600]]);
    const lapTex = poster(128, 80, '#e9f1ff', [['notes.md', 20, 12, '#1d3f73'], ['— — — — —', 44, 10, '#666', 500]]);

    const emis = (tex, intensity = 0.9) => mat('#ffffff', { map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: intensity, roughness: 0.5 });
    const flat = (tex) => mat('#ffffff', { map: tex, roughness: 0.75 });

    group.userData.cameraRooms = [
      { x0: -12, x1: 10, z0: -2, z1: 2, height: H },
      { x0: -10, x1: -2, z0: -9, z1: -2, height: H },
      { x0: 2, x1: 10, z0: -8, z1: -2, height: H },
      { x0: -1, x1: 3, z0: 2, z1: 6, height: H }
    ];

    // ------------------------------------------------------------------ floor, carpets, ceiling
    const floor = new THREE.Mesh(unitPlane, mat('#ffffff', { map: floorTex, roughness: 0.45 }));
    floor.scale.set(22.4, 15.4, 1); floor.rotation.x = -Math.PI / 2; floor.position.set(-1, 0, -1.5);
    floor.receiveShadow = true; group.add(floor);
    const rug = (m, x0, z0, x1, z1) => {
      const r = new THREE.Mesh(unitPlane, m);
      r.scale.set(x1 - x0, z1 - z0, 1); r.rotation.x = -Math.PI / 2; r.position.set((x0 + x1) / 2, 0.006, (z0 + z1) / 2);
      r.receiveShadow = true; group.add(r);
    };
    rug(mat('#6f5a4c', { roughness: 1 }), 2.1, -7.9, 9.9, -2.1);   // library carpet
    rug(mat('#5f6e7c', { roughness: 1 }), -0.9, 2.1, 2.9, 5.9);    // aid office carpet
    rug(mat('#34383e', { roughness: 1 }), -11.9, -1.4, -10.4, 1.4); // entrance mat

    const ceilMat = mat('#ffffff', { map: ceilTex, roughness: 0.95, side: THREE.DoubleSide });
    ceilMat.shadowSide = THREE.DoubleSide;
    const ceil = new THREE.Mesh(unitPlane, ceilMat);
    ceil.scale.set(22.4, 15.4, 1); ceil.rotation.x = Math.PI / 2; ceil.position.set(-1, H, -1.5);
    ceil.castShadow = true; ceil.receiveShadow = false; group.add(ceil);

    // ------------------------------------------------------------------ walls
    // west entrance (x = -12)
    B(M.mint, -12.2, 0, -2.2, -12, H, -1, true);
    B(M.mint, -12.2, 0, 1, -12, H, 2.2, true);
    B(M.mint, -12.2, 2.4, -1, -12, H, 1);
    // east exit (x = 10)
    B(M.mint, 10, 0, -2.1, 10.2, H, -1, true);
    B(M.mint, 10, 0, 1, 10.2, H, 2.2, true);
    B(M.mint, 10, 2.4, -1, 10.2, H, 1);
    for (const x of [-12.1, 10.1]) {
      B(glass, x - 0.02, 0, -1, x + 0.02, 2.4, 1);
      col(x - 0.1, -1, x + 0.1, 1);
      for (const z of [-1, 0, 1]) B(M.alu, x - 0.04, 0, z - 0.04, x + 0.04, 2.4, z + 0.04);
      B(M.alu, x - 0.04, 2.36, -1, x + 0.04, 2.44, 1);
      for (const s of [-1, 1]) B(M.alu, x - 0.09 * Math.sign(x), 0.95, s * 0.5 - 0.3, x - 0.05 * Math.sign(x), 1.0, s * 0.5 + 0.3); // push bars
      const view = plane(basic({ map: duskOpen }), 3.0, 2.8, x + Math.sign(x) * 0.6, 1.3, 0, x < 0 ? Math.PI / 2 : -Math.PI / 2);
      view.castShadow = true; // also stops the low evening sun from streaking in through the glass doors
      view.material.shadowSide = THREE.DoubleSide;
    }
    plane(emis(exitTex, 1.4), 0.6, 0.24, 9.98, 2.68, 0, -Math.PI / 2);
    plane(emis(exitTex, 1.4), 0.6, 0.24, -1.6, 2.6, -1.885);

    // corridor south side (-z): vestibule, classroom wall (two-tone skins), plain wall, library header
    B(M.mint, -12, 0, -2.1, -10, H, -1.9, true);
    const skin2 = (x0, y0, x1, y1) => { B(M.mint, x0, y0, -2.0, x1, y1, -1.9); B(M.white, x0, y0, -2.1, x1, y1, -2.0); };
    skin2(-10, 0, -9.5, H);
    skin2(-9.5, 0, -4.4, 1.0); skin2(-9.5, 2.2, -4.4, H);
    B(glass, -9.5, 1.0, -2.03, -4.4, 2.2, -1.97);
    for (const x of [-9.5, -7.8, -6.1, -4.4]) B(M.alu, x - 0.03, 1.0, -2.05, x + 0.03, 2.2, -1.95);
    B(M.alu, -9.5, 0.97, -2.07, -4.4, 1.03, -1.93);
    skin2(-4.4, 0, -3.9, H); skin2(-3.9, 2.25, -2.3, H); skin2(-2.3, 0, -1.9, H);
    col(-10, -2.1, -3.9, -1.9); col(-2.3, -2.1, -1.9, -1.9);
    for (const x of [-3.9, -2.3]) B(M.trim, x - 0.04, 0, -2.13, x + 0.04, 2.25, -1.87);
    B(M.trim, -3.94, 2.2, -2.13, -2.26, 2.28, -1.87);
    // open classroom door (swung inside) with narrow glass strip
    B(M.woodL, -2.37, 0, -3.05, -2.32, 2.2, -2.15);
    plane(M.dark, 0.14, 0.8, -2.375, 1.45, -2.6, -Math.PI / 2);
    plane(emis(roomSignTex, 0.5), 0.28, 0.14, -4.15, 1.6, -1.885);
    B(M.mint, -1.9, 0, -2.0, 3.4, H, -1.9, true); B(M.lib, -1.9, 0, -2.1, 3.4, H, -2.0);
    B(M.trim, 3.36, 0, -2.12, 3.44, H, -1.88);
    B(M.mint, 3.4, 2.6, -2.0, 10, H, -1.9); B(M.lib, 3.4, 2.6, -2.1, 10, H, -2.0);
    B(M.trim, 3.4, 2.56, -2.12, 10, 2.62, -1.88);

    // corridor north side (+z): lockers wall, aid office opening, window wall
    B(M.mint, -12.2, 0, 1.9, -1, H, 2.1, true);
    B(M.mint, -1, 0, 1.9, -0.6, H, 2.1, true);
    B(M.mint, -0.6, 2.4, 1.9, 2.6, H, 2.1);
    B(M.mint, 2.6, 0, 1.9, 3, H, 2.1, true);
    B(M.mint, 3, 0, 1.9, 10.2, H, 2.1, true);
    for (const x of [-0.6, 2.6]) B(M.trim, x - 0.04, 0, 1.87, x + 0.04, 2.4, 2.13);
    B(M.trim, -0.64, 2.36, 1.87, 2.64, 2.44, 2.13);
    plane(emis(aidSignTex, 0.35), 2.1, 0.35, 1.0, 2.72, 1.885, Math.PI);

    // chair rail + baseboards along the corridor (school-hall look)
    for (const [x0, x1] of [[-12, -9.5], [-4.4, -3.9], [-2.3, 3.4]]) {
      B(M.trim, x0, 0.98, -1.9, x1, 1.06, -1.87); B(M.trim, x0, 0, -1.9, x1, 0.1, -1.87);
    }
    for (const [x0, x1] of [[-12, -9.4], [-2.2, -0.6], [2.6, 10]]) {
      B(M.trim, x0, 0.98, 1.87, x1, 1.06, 1.9); B(M.trim, x0, 0, 1.87, x1, 0.1, 1.9);
    }

    // classroom shell (x -10..-2, z -9..-2): white walls
    B(M.white, -10.2, 0, -9.2, -10, H, -2.1, true);
    B(M.white, -10.2, 0, -9.2, -1.9, H, -9, true);
    B(M.white, -2.1, 0, -9.0, -1.9, H, -2.1, true);
    // aid office shell (x -1..3, z 2..6)
    B(M.office, -1.1, 0, 2.1, -0.9, H, 6.2, true);
    B(M.office, 2.9, 0, 2.1, 3.1, H, 6.2, true);
    B(M.office, -1.1, 0, 6, 3.1, H, 6.2, true);
    // library shell (x 2..10, z -8..-2)
    B(M.lib, 1.9, 0, -8.2, 2.1, H, -2.1, true);
    B(M.lib, 1.9, 0, -8.2, 10.2, H, -8, true);
    B(M.lib, 10, 0, -8.2, 10.2, H, -2.1, true);

    // windows (dusk) — one InstancedMesh: [x, y, z, w, h, rotY]
    const windows = [
      [-9.885, 1.65, -7.3, Math.PI / 2], [-9.885, 1.65, -4.6, Math.PI / 2],   // classroom west
      [5.6, 1.65, 1.885, Math.PI], [8.0, 1.65, 1.885, Math.PI],               // corridor north
      [6.4, 1.65, -7.885, 0], [8.7, 1.65, -7.885, 0],                         // library north
      [9.885, 1.65, -5.6, -Math.PI / 2], [9.885, 1.65, -3.4, -Math.PI / 2]    // library east
    ];
    const winMat = basic({ map: duskTex });
    const winMesh = instanced(unitPlane, winMat, windows.map(([x, y, z, r]) => [x, y, z, 1.7, 1.35, 1, r]), { cast: false, receive: false });
    winMesh.name = 'windows';
    for (const [x, , z, r] of windows) { // sills
      const along = Math.abs(Math.sin(r)) > 0.5; // faces ±x → sill runs along z
      if (along) C(M.white, x + Math.sign(-x) * 0.05, 0.94, z, 0.12, 0.05, 1.85);
      else C(M.white, x, 0.94, z + Math.sign(-z) * 0.05, 1.85, 0.05, 0.12);
    }

    // ------------------------------------------------------------------ corridor props
    // lockers (InstancedMesh, textured front only)
    const lockerFront = mat('#ffffff', { map: lockerTex, roughness: 0.45, metalness: 0.2 });
    const lockerSide = mat('#34507a', { roughness: 0.5, metalness: 0.2 });
    const lockerItems = [];
    for (let i = 0; i < 16; i++) lockerItems.push([-9.4 + 0.225 + i * 0.45, 0.925 + 0.08, 1.675, 0.44, 1.85, 0.45, 0]);
    instanced(unitBox, [lockerSide, lockerSide, lockerSide, lockerSide, lockerSide, lockerFront], lockerItems);
    B(M.trim, -9.4, 0, 1.45, -2.2, 0.08, 1.9);
    col(-9.4, 1.45, -2.2, 1.9);

    // vending machine
    B(M.rust, 3.25, 0, 1.25, 4.15, 1.95, 1.9, true);
    plane(emis(vendTex, 0.8), 0.78, 1.75, 3.7, 1.0, 1.245, Math.PI);
    // bench under the windows
    B(M.woodL, 5.0, 0.42, 1.45, 6.6, 0.47, 1.85, true);
    for (const x of [5.15, 6.45]) B(M.metal, x - 0.03, 0, 1.5, x + 0.03, 0.42, 1.8);
    // bins near the bulletin board
    const binG = new THREE.CylinderGeometry(0.2, 0.17, 0.72, 12);
    mesh(binG, M.dark, -1.45, 0.36, -1.62); mesh(binG, M.blue, -1.0, 0.36, -1.62);
    col(-1.67, -1.85, -0.78, -1.4, 0, 0.72);
    // bulletin board + college sign + tutoring poster
    B(M.woodL, -0.5, 1.05, -1.9, 1.5, 2.05, -1.87);
    plane(flat(corkTex), 1.9, 0.9, 0.5, 1.55, -1.865);
    plane(emis(collegeSignTex, 0.25), 3.6, 0.56, 0.75, 2.55, -1.885);
    plane(flat(tutorTex), 1.2, 0.6, 2.5, 1.6, -1.885);
    // fire alarm pull + small red light near exit
    B(M.rust, 9.3, 1.3, 1.85, 9.45, 1.5, 1.9);

    // ceiling light panels
    const panels = [];
    for (let x = -11; x <= 9.2; x += 2.5) panels.push([x, H - 0.02, 0, 0.5, 0.03, 1.2, 0]);
    for (const x of [-8.2, -6, -3.8]) for (const z of [-4, -7]) panels.push([x, H - 0.02, z, 1.2, 0.03, 0.5, 0]);
    panels.push([1, H - 0.02, 4.2, 1.2, 0.03, 0.5, 0], [9.2, H - 0.02, -3.2, 0.5, 0.03, 1.2, 0]);
    instanced(unitBox, M.glow, panels, { cast: false, receive: false });

    // ------------------------------------------------------------------ classroom 114
    const deskCols = [-8.85, -7.4, -5.95, -4.5];
    const deskRows = [-3.45, -4.5, -5.55, -6.6];
    for (const dx of deskCols) for (const dz of deskRows) {
      C(M.navy, dx, 0.45, dz + 0.12, 0.45, 0.05, 0.42);           // seat
      C(M.navy, dx, 0.72, dz + 0.33, 0.42, 0.34, 0.04);           // backrest
      C(M.woodL, dx + 0.02, 0.735, dz - 0.25, 0.62, 0.03, 0.42);  // desk top
      C(M.metal, dx, 0.21, dz + 0.12, 0.04, 0.42, 0.04);           // seat post
      C(M.metal, dx + 0.28, 0.36, dz - 0.1, 0.03, 0.72, 0.5);      // side frame
      C(M.metal, dx, 0.01, dz + 0.0, 0.5, 0.02, 0.7);              // floor skid
      col(dx - 0.31, dz - 0.46, dx + 0.33, dz + 0.36, 0, 0.9);
    }
    // closed laptops / notebooks on a few desks
    for (const [dx, dz] of [[-8.85, -3.45], [-4.5, -5.55], [-7.4, -6.6]]) C(M.dark, dx + 0.02, 0.76, dz - 0.25, 0.32, 0.02, 0.22);
    for (const [dx, dz] of [[-7.4, -4.5], [-8.85, -5.55]]) C(M.blue, dx, 0.757, dz - 0.25, 0.2, 0.015, 0.27);

    // the exam desk (column x=-5.95, row z=-4.5): open laptop with the quiz + a lit phone
    const ex = -5.95, ez = -4.5;
    C(M.dark, ex, 0.76, ez - 0.22, 0.34, 0.018, 0.24);
    const lid = new THREE.Group();
    lid.position.set(ex, 0.77, ez - 0.34); lid.rotation.x = -0.28; group.add(lid);
    const lidBox = new THREE.Mesh(unitBox, M.dark); lidBox.scale.set(0.34, 0.23, 0.012); lidBox.position.set(0, 0.115, 0); lidBox.castShadow = true; lid.add(lidBox);
    const quiz = new THREE.Mesh(unitPlane, emis(quizTex, 1.0)); quiz.scale.set(0.31, 0.2, 1); quiz.position.set(0, 0.118, 0.007); lid.add(quiz);
    const phoneM = mat('#0d0f14', { emissive: '#9fd0ff', emissiveIntensity: 1.2, roughness: 0.3 });
    C(phoneM, ex + 0.24, 0.756, ez - 0.16, 0.07, 0.01, 0.14, 0.3);
    C(M.rust, ex - 0.55, 0.15, ez + 0.3, 0.3, 0.3, 0.18); // Tyler's backpack on the floor

    // teacher's desk, whiteboard, projector screen, clock
    B(M.woodD, -8.0, 0, -8.3, -6.4, 0.76, -7.6, true);
    C(M.dark, -7.6, 0.98, -8.05, 0.5, 0.32, 0.03); C(M.dark, -7.6, 0.79, -7.98, 0.18, 0.06, 0.14);
    C(M.paper, -6.9, 0.775, -7.9, 0.3, 0.03, 0.22);
    plane(flat(whiteboardTex), 4.2, 1.3, -6.8, 1.55, -8.885);
    B(M.alu, -8.95, 0.86, -8.9, -4.65, 0.9, -8.8);
    B(M.alu, -8.95, 2.2, -8.9, -4.65, 2.24, -8.86);
    plane(emis(slideTex, 0.55), 1.6, 1.0, -3.2, 1.75, -8.88);
    B(M.dark, -4.05, 2.28, -8.95, -2.35, 2.36, -8.83);
    const projector = new THREE.Group(); projector.position.set(-3.2, 2.72, -5.4); group.add(projector);
    const projBox = new THREE.Mesh(unitBox, M.white); projBox.scale.set(0.35, 0.12, 0.3); projector.add(projBox);
    const projPole = new THREE.Mesh(unitBox, M.metal); projPole.scale.set(0.04, 0.22, 0.04); projPole.position.y = 0.16; projector.add(projPole);

    const clock = new THREE.Group(); clock.position.set(-6.8, 2.6, -8.86); group.add(clock);
    const rimG = new THREE.CylinderGeometry(0.19, 0.19, 0.05, 24); owned.geo.push(rimG);
    const rim = new THREE.Mesh(rimG, M.dark); rim.rotation.x = Math.PI / 2; clock.add(rim);
    const face = new THREE.Mesh(unitPlane, flat(clockTex)); face.scale.set(0.34, 0.34, 1); face.position.z = 0.027; clock.add(face);
    const handG = (len, wd) => { const g = new THREE.BoxGeometry(wd, len, 0.006).translate(0, len / 2 - 0.015, 0); owned.geo.push(g); return g; };
    const hourHand = new THREE.Mesh(handG(0.09, 0.016), M.dark); hourHand.position.z = 0.032; clock.add(hourHand);
    const minHand = new THREE.Mesh(handG(0.13, 0.011), M.dark); minHand.position.z = 0.036; clock.add(minHand);
    const secHand = new THREE.Mesh(handG(0.14, 0.005), M.rust); secHand.position.z = 0.04; clock.add(secHand);

    // ------------------------------------------------------------------ financial aid office
    B(M.woodL, -0.75, 0, 2.85, 2.75, 1.0, 3.35);
    B(M.woodD, -0.8, 1.0, 2.8, 2.8, 1.05, 3.45);
    B(M.teal, -0.75, 0.15, 2.835, 2.75, 0.25, 2.85);
    col(-0.8, 2.8, 2.8, 3.45, 0, 1.05);
    // service bell
    mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.015, 14), M.metal, 2.3, 1.058, 3.0);
    mesh(new THREE.SphereGeometry(0.04, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d8b23a', { metalness: 0.8, roughness: 0.25 }), 2.3, 1.065, 3.0);
    // pile of white forms (aid / loan paperwork) in front of Omar
    for (let i = 0; i < 5; i++) C(M.paper, 1.15 + (i % 2) * 0.01, 1.055 + i * 0.008, 3.05, 0.22, 0.007, 0.29, (i - 2) * 0.05);
    // brochure stand: three tilted pockets (orange / green / blue)
    B(M.alu, 0.0, 1.05, 3.12, 0.75, 1.08, 3.3);
    [[0.12, M.orange], [0.37, M.green], [0.62, M.blue]].forEach(([x, m], i) => {
      const b = new THREE.Mesh(unitBox, m);
      b.scale.set(0.2, 0.26, 0.02); b.position.set(x, 1.2 + (i % 2) * 0.015, 3.18); b.rotation.x = -0.32; b.castShadow = true;
      group.add(b);
    });
    // desk behind Rosa, monitor, brochure piles, filing cabinet, plant
    B(M.woodL, 0.0, 0, 5.15, 2.2, 0.75, 5.8, true);
    C(M.dark, 1.3, 1.0, 5.6, 0.55, 0.34, 0.03); C(M.dark, 1.3, 0.79, 5.62, 0.16, 0.08, 0.12);
    plane(M.screen, 0.5, 0.29, 1.3, 1.0, 5.584, Math.PI);
    C(M.orange, 0.35, 0.78, 5.4, 0.22, 0.06, 0.3); C(M.green, 0.62, 0.77, 5.4, 0.22, 0.04, 0.3); C(M.yellow, 2.0, 0.77, 5.35, 0.22, 0.04, 0.3);
    B(M.metal, 2.3, 0, 5.3, 2.85, 1.3, 5.9, true);
    const potG = new THREE.CylinderGeometry(0.2, 0.15, 0.4, 10);
    mesh(potG, M.woodD, -0.55, 0.2, 5.55);
    mesh(new THREE.IcosahedronGeometry(0.42, 0), ctx.mats?.leaf || M.green, -0.55, 0.78, 5.55);
    col(-0.8, 5.3, -0.3, 5.85, 0, 1.0);
    // posters + bulletin board
    plane(flat(fafsaTex), 0.9, 1.17, -0.885, 1.75, 4.2, Math.PI / 2);
    plane(flat(scholTex), 0.9, 1.17, 2.885, 1.75, 4.2, -Math.PI / 2);
    B(M.woodL, 0.1, 1.45, 5.97, 1.9, 2.35, 6.0);
    plane(flat(corkTex), 1.7, 0.8, 1.0, 1.9, 5.965, Math.PI);

    // ------------------------------------------------------------------ library corner
    plane(emis(libSignTex, 0.3), 1.7, 0.34, 6.2, 2.8, -1.885);
    // books (one InstancedMesh, per-instance colours)
    const bookItems = [], bookCols = [];
    const palette = ['#8e2b2b', '#2e4566', '#3f7a5a', '#c9a227', '#6b4c8a', '#d9822b', '#efe8d8', '#4a6f8a', '#5e3d22', '#a83a3a'];
    const shelfLevels = [0.08, 0.53, 0.98, 1.43];
    const fillRow = (alongX, fixed, from, to, y) => {
      let p = from + 0.02;
      while (p < to - 0.06) {
        const t = 0.03 + rand() * 0.035, h = 0.24 + rand() * 0.12, d = 0.2 + rand() * 0.06;
        if (rand() < 0.07) { p += 0.08; continue; }
        bookItems.push(alongX ? [p + t / 2, y + h / 2, fixed, t, h, d, 0] : [fixed, y + h / 2, p + t / 2, d, h, t, 0]);
        bookCols.push(palette[(rand() * palette.length) | 0]);
        p += t + 0.004;
      }
    };
    const shelfUnit = (alongX, x0, z0, x1, z1) => { // back against wall; opens toward +x (west unit) or +z (north unit)
      const hgt = 2.05;
      if (alongX) {
        B(M.woodD, x0, 0, z0, x1, hgt, z0 + 0.03);
        for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 2) B(M.woodD, x - 0.02, 0, z0, x + 0.02, hgt, z1);
        for (const y of [0, ...shelfLevels.slice(1), 1.88]) B(M.woodD, x0, y + 0.03, z0, x1, y + 0.08, z1);
        shelfLevels.forEach((y) => fillRow(true, (z0 + z1) / 2 + 0.03, x0, x1, y + 0.08));
      } else {
        B(M.woodD, x0, 0, z0, x0 + 0.03, hgt, z1);
        for (let z = z0; z <= z1 + 1e-6; z += (z1 - z0) / 2) B(M.woodD, x0, 0, z - 0.02, x1, hgt, z + 0.02);
        for (const y of [0, ...shelfLevels.slice(1), 1.88]) B(M.woodD, x0, y + 0.03, z0, x1, y + 0.08, z1);
        shelfLevels.forEach((y) => fillRow(false, (x0 + x1) / 2 + 0.03, z0, z1, y + 0.08));
      }
      col(x0, z0, x1, z1, 0, hgt);
    };
    shelfUnit(false, 2.1, -7.6, 2.5, -2.6);
    shelfUnit(true, 2.6, -7.97, 5.2, -7.57);
    const books = instanced(unitBox, mat('#ffffff', { roughness: 0.8 }), bookItems);
    const cTmp = new THREE.Color();
    bookCols.forEach((c, i) => books.setColorAt(i, cTmp.set(c)));
    if (books.instanceColor) books.instanceColor.needsUpdate = true;

    // chairs (seat + back + legs as batched boxes); yaw: direction the sitter faces
    const chair = (x, z, yaw, seatM = M.teal) => {
      const s = Math.sin(yaw), c = Math.cos(yaw);
      C(seatM, x, 0.45, z, 0.42, 0.05, 0.42, yaw);
      C(seatM, x + s * 0.2, 0.7, z + c * 0.2, 0.4, 0.4, 0.04, yaw);
      C(M.metal, x, 0.22, z, 0.36, 0.44, 0.36, yaw);
    };
    // open study table at [4, 0, -4]: four chairs, two laptops (placed below, once lapLid exists)
    B(M.woodL, 3.2, 0.72, -4.4, 4.8, 0.76, -3.6);
    for (const [x, z] of [[3.3, -4.3], [4.7, -4.3], [3.3, -3.7], [4.7, -3.7]]) B(M.metal, x - 0.03, 0, z - 0.03, x + 0.03, 0.72, z + 0.03);
    col(3.2, -4.4, 4.8, -3.6, 0, 0.76);
    chair(3.6, -3.1, 0); chair(4.4, -3.1, 0); chair(3.6, -4.9, Math.PI); chair(4.4, -4.9, Math.PI);
    C(M.blue, 3.37, 0.79, -3.75, 0.22, 0.06, 0.3, 0.2); C(M.orange, 4.62, 0.78, -3.8, 0.2, 0.04, 0.28, -0.3);
    for (const [x, z, r] of [[3.95, -3.95, 0.4], [4.1, -4.1, -0.3]]) C(M.paper, x, 0.765, z, 0.21, 0.004, 0.29, r);
    const lampShade = mesh(new THREE.ConeGeometry(0.12, 0.14, 12, 1, true), M.warmGlow, 3.35, 1.05, -4.25, { cast: false });
    lampShade.material.side = THREE.DoubleSide;
    B(M.dark, 3.33, 0.76, -4.27, 3.37, 0.98, -4.23);

    // glass study room 2 (x 5.6..8.6, z -6.8..-3.8), door open toward the corridor
    const GX0 = 5.6, GX1 = 8.6, GZ0 = -6.8, GZ1 = -3.8, DX0 = 6.55, DX1 = 7.55, GH = 2.7;
    B(glass, GX0, 0, GZ0 - 0.02, GX1, GH, GZ0 + 0.02); col(GX0, GZ0 - 0.05, GX1, GZ0 + 0.05, 0, H, false);
    B(glass, GX0 - 0.02, 0, GZ0, GX0 + 0.02, GH, GZ1); col(GX0 - 0.05, GZ0, GX0 + 0.05, GZ1, 0, H, false);
    B(glass, GX1 - 0.02, 0, GZ0, GX1 + 0.02, GH, GZ1); col(GX1 - 0.05, GZ0, GX1 + 0.05, GZ1, 0, H, false);
    B(glass, GX0, 0, GZ1 - 0.02, DX0, GH, GZ1 + 0.02); col(GX0, GZ1 - 0.05, DX0, GZ1 + 0.05, 0, H, false);
    B(glass, DX1, 0, GZ1 - 0.02, GX1, GH, GZ1 + 0.02); col(DX1, GZ1 - 0.05, GX1, GZ1 + 0.05, 0, H, false);
    B(M.lib, GX0 - 0.05, GH, GZ0 - 0.05, GX1 + 0.05, H, GZ1 + 0.05); // soffit
    for (const [x, z] of [[GX0, GZ0], [GX1, GZ0], [GX0, GZ1], [GX1, GZ1], [DX0, GZ1], [DX1, GZ1]]) B(M.alu, x - 0.035, 0, z - 0.035, x + 0.035, GH, z + 0.035);
    // frosted privacy band
    B(M.frost, GX0 + 0.04, 1.15, GZ0 - 0.025, GX1 - 0.04, 1.3, GZ0 + 0.025);
    B(M.frost, GX0 - 0.025, 1.15, GZ0 + 0.04, GX0 + 0.025, 1.3, GZ1 - 0.04);
    B(M.frost, GX1 - 0.025, 1.15, GZ0 + 0.04, GX1 + 0.025, 1.3, GZ1 - 0.04);
    B(M.frost, GX0 + 0.04, 1.15, GZ1 - 0.025, DX0 - 0.04, 1.3, GZ1 + 0.025);
    B(M.frost, DX1 + 0.04, 1.15, GZ1 - 0.025, GX1 - 0.04, 1.3, GZ1 + 0.025);
    // door swung inward on its hinge at DX1
    B(glass, DX1 - 0.05, 0.02, GZ1 - 0.95, DX1 - 0.01, 2.2, GZ1 - 0.04);
    B(M.alu, DX1 - 0.06, 0.02, GZ1 - 0.98, DX1, 2.22, GZ1 - 0.92);
    B(M.alu, DX1 - 0.1, 0.9, GZ1 - 0.9, DX1 - 0.07, 1.2, GZ1 - 0.86);
    plane(emis(studySignTex, 0.5), 0.6, 0.15, (DX0 + DX1) / 2, 2.85, GZ1 + 0.055);
    // round table + chairs; the room is EMPTY now (no people, laptops or papers); wall screen
    mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 28), M.white, 7.1, 0.74, -5.3);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), M.metal, 7.1, 0.36, -5.3);
    mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.03, 16), M.metal, 7.1, 0.015, -5.3);
    col(6.5, -5.9, 7.7, -4.7, 0, 0.76);
    chair(6.25, -5.3, -Math.PI / 2, M.orange); chair(7.95, -5.3, Math.PI / 2, M.orange);
    chair(7.1, -6.2, Math.PI, M.orange); chair(7.1, -4.4, 0, M.orange);
    const lapLid = (x, z, yaw) => {
      const s = Math.sin(yaw), c = Math.cos(yaw);
      C(M.metal, x, 0.77, z, 0.32, 0.015, 0.22, yaw);
      const g = new THREE.Group(); g.position.set(x - s * 0.11, 0.775, z - c * 0.11); g.rotation.set(0, yaw, 0, 'YXZ'); group.add(g);
      const inner = new THREE.Group(); inner.rotation.x = -0.3; g.add(inner);
      const l = new THREE.Mesh(unitBox, M.metal); l.scale.set(0.32, 0.21, 0.01); l.position.y = 0.105; l.castShadow = true; inner.add(l);
      const sc = new THREE.Mesh(unitPlane, lapM); sc.scale.set(0.29, 0.18, 1); sc.position.set(0, 0.108, 0.006); inner.add(sc);
    };
    const lapM = emis(lapTex, 0.8);
    // two laptops on the open study table (yaw 0 → screen faces a sitter on the +z side)
    lapLid(3.6, -3.85, 0);
    lapLid(4.4, -4.15, Math.PI);
    // situation prop (school.pork): Tyler's sandwich on a paper plate on the open study table (table top y 0.76)
    mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.012, 20), M.white, 4.25, 0.766, -3.76);
    const breadM = mat('#d9a25e'), hamM = mat('#e59a9a'), lettuceM = mat('#7fb24a');
    C(breadM, 4.25, 0.788, -3.76, 0.17, 0.03, 0.11, 0.35);   // bottom slice
    C(lettuceM, 4.25, 0.807, -3.76, 0.18, 0.008, 0.12, 0.35);
    C(hamM, 4.25, 0.817, -3.76, 0.175, 0.014, 0.115, 0.35);
    C(breadM, 4.25, 0.839, -3.76, 0.17, 0.03, 0.11, 0.35);   // top slice
    C(M.dark, 7.1, 1.4, GZ0 + 0.1, 1.1, 0.65, 0.04);
    plane(emis(tvTex, 0.7), 1.02, 0.58, 7.1, 1.4, GZ0 + 0.125);
    B(M.metal, 7.07, 0, GZ0 + 0.06, 7.13, 1.1, GZ0 + 0.12);
    // pendant lights (warm)
    const pendG = new THREE.CylinderGeometry(0.16, 0.22, 0.14, 14, 1, true);
    for (const [x, z] of [[4.0, -4.0], [7.1, -5.3]]) {
      const p = mesh(pendG, M.warmGlow, x, 2.55, z, { cast: false }); p.material.side = THREE.DoubleSide;
      B(M.dark, x - 0.01, 2.62, z - 0.01, x + 0.01, H, z + 0.01);
    }
    owned.geo.push(pendG);

    // ------------------------------------------------------------------ interior lights (no shadows)
    // [Phase 3 QA] 7 -> 3 lights (README budget of 3 Point/Spot lights). Each remaining light sits between a room
    // and the corridor (point lights pass through walls) with a longer range: exam hall + west corridor,
    // financial-aid office + centre corridor, study room + east corridor.
    const lights = [
      ['#eef4ff', 11, -7.0, -1.6],
      ['#fff0da', 8, 1.0, 2.4],
      ['#ffdcae', 8, 5.6, -3.4]
    ];
    for (const [c, i, x, z] of lights) {
      const L = new THREE.PointLight(c, i, 14, 1.6);
      L.position.set(x, 2.6, z);
      group.add(L);
    }

    // ------------------------------------------------------------------ flush batches
    for (const [m, items] of batches) instanced(unitBox, m, items, { cast: !m.transparent, receive: true });

    // ------------------------------------------------------------------ camera occluder proxy
    // The engine pulls the follow camera in front of large NON-instanced meshes (raycast). Our walls are
    // instanced, so we add ONE merged, never-drawn mesh (colorWrite off): the ceiling + every full-height wall.
    // Result: an interior third-person camera that stays under the ceiling and inside the current room.
    {
      const pos = [];
      const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      const CY = H - 0.05;
      quad([-12.2, CY, -9.2], [10.2, CY, -9.2], [10.2, CY, 6.2], [-12.2, CY, 6.2]);
      for (const [x0, z0, x1, z1] of camBoxes) {
        quad([x0, 0, z0], [x1, 0, z0], [x1, CY, z0], [x0, CY, z0]);
        quad([x0, 0, z1], [x1, 0, z1], [x1, CY, z1], [x0, CY, z1]);
        quad([x0, 0, z0], [x0, 0, z1], [x0, CY, z1], [x0, CY, z0]);
        quad([x1, 0, z0], [x1, 0, z1], [x1, CY, z1], [x1, CY, z0]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeBoundingSphere();
      owned.geo.push(g);
      const proxy = new THREE.Mesh(g, basic({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
      proxy.name = 'cameraOccluders';
      proxy.castShadow = false; proxy.receiveShadow = false;
      group.add(proxy);
    }

    // ------------------------------------------------------------------ NPCs
    const npcObj = (look, decorate) => {
      if (typeof ctx.makeNPC !== 'function') return undefined;
      const fig = ctx.makeNPC(look);
      try { decorate?.(fig.userData.parts || {}); } catch (e) { console.warn('[school] npc decoration skipped', e); }
      return fig;
    };
    const addTo = (parent, geo, m, x, y, z) => {
      owned.geo.push(geo);
      const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent?.add(o); return o;
    };
    const yawTo = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));
    const capM = mat('#b33a3a', { roughness: 0.7 });

    const blackM = mat('#151515', { roughness: 0.9 });
    const tylerLook = { skin: '#f3d3b5', shirt: '#3a6ea5', pants: '#3b4250', hair: '#8a6a3a' };
    const rosaLook = { skin: '#c68642', shirt: '#d9822b', pants: '#3a3340', hair: '#3b2416', height: 1.64 };
    const kareemLook = { skin: '#6b4226', shirt: '#4b5320', pants: '#2f3542', hair: '#141010', beard: '#141010', height: 1.83 };
    const omarLook = { skin: '#5a3a22', shirt: '#4a7fb5', pants: '#4a7fb5', shoes: '#e8e8e8', hair: '#151010', beard: '#151010', height: 1.8 };
    const noorLook = { sex: 'female', skin: '#c68642', shirt: '#4a6fa5', sleeves: 'long', hijab: true, hijabColor: '#7fb3d5', pants: '#3a4660', dress: '#3a4660', height: 1.64 };
    const curlyLook = { skin: '#8d5524', shirt: '#b5517a', pants: '#2f3542', hair: '#24160e', height: 1.66 };
    const workerLook = { skin: '#e0b98f', shirt: '#f07a1a', pants: '#3b4a5e', hair: '#7a7470', beard: '#8a8580', build: 1.1 };

    const npcs = [
      { // situation NPC: Muslim classmate in the aisle next to the exam desk (olive jacket, trimmed beard, black beanie)
        id: 'kareem', position: [-5.22, 0, -3.95], yaw: yawTo([-5.22, -3.95], [-4.2, -2.6]), look: kareemLook,
        object: npcObj(kareemLook, (p) => {
          addTo(p.head, new THREE.SphereGeometry(0.145, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), blackM, 0, 0.02, 0.005);
          addTo(p.head, new THREE.CylinderGeometry(0.146, 0.146, 0.035, 12), blackM, 0, 0.035, 0.005);
        })
      },
      { // situation NPC: Adam's neighbour in blue nursing scrubs, in front of the aid counter
        id: 'omar', position: [1, 0, 1.8], yaw: yawTo([1, 1.8], [-1.5, 0.6]), look: omarLook,
        object: npcObj(omarLook, (p) => { // hospital ID badge
          addTo(p.body, new THREE.BoxGeometry(0.07, 0.09, 0.01), mat('#f2f2f2'), 0.1, 1.3, -0.19);
        })
      },
      { // situation NPC: study-group partner at the open study-room door, holding a notebook
        id: 'noor', position: [6, 0, -2.85], yaw: yawTo([6, -2.85], [7.05, -3.0]), look: noorLook,
        object: npcObj(noorLook, (p) => {
          addTo(p.armL, new THREE.BoxGeometry(0.03, 0.26, 0.2), M.yellow, 0.04, -0.45, -0.06);
          if (p.armL) p.armL.rotation.x = -0.35;
        })
      },
      { // background: Tyler (red cap) seated in the row in front of Kareem — desk (-4.5, -5.55)
        id: 'bg_tyler', position: [-4.5, -0.4, -5.43], yaw: 0, look: tylerLook, showName: false, animate: false, collide: false,
        object: npcObj(tylerLook, (p) => {
          if (p.legL && p.legR) p.legL.rotation.x = p.legR.rotation.x = Math.PI / 2; // thighs forward (figure faces -z)
          addTo(p.head, new THREE.SphereGeometry(0.142, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), capM, 0, 0.025, 0.005);
          addTo(p.head, new THREE.BoxGeometry(0.17, 0.014, 0.13), capM, 0, 0.03, -0.17);
        })
      },
      { // background: Ms. Rodriguez behind the counter
        id: 'bg_rosa', position: [1, 0, 4.2], yaw: 0, look: rosaLook, showName: false,
        object: npcObj(rosaLook, (p) => { addTo(p.head, new THREE.SphereGeometry(0.07, 10, 8), mat('#3b2416'), 0, 0.11, 0.1); })
      },
      { // background: student beside the lockers, with clearance and facing into the corridor
        id: 'bg_student_curly', position: [-6.6, 0, 0.65], yaw: 0, look: curlyLook, showName: false,
        object: npcObj(curlyLook, (p) => {
          const hairM = mat('#24160e', { roughness: 1 });
          for (const [x, y, z] of [[0.1, 0.06, 0.02], [-0.1, 0.06, 0.02], [0, 0.1, 0.08], [0.08, -0.02, 0.09], [-0.08, -0.02, 0.09], [0, 0.13, -0.02]]) {
            addTo(p.head, new THREE.IcosahedronGeometry(0.075, 0), hairM, x, y, z);
          }
        })
      },
      { // background: man in his forties, orange work jacket with reflective band, reading the bulletin board
        id: 'bg_worker', position: [0.1, 0, -1.35], yaw: Math.PI, look: workerLook, showName: false,
        object: npcObj(workerLook, (p) => {
          addTo(p.body, new THREE.CylinderGeometry(0.208, 0.19, 0.045, 10), mat('#e6eef0', { emissive: '#9aa5a8', emissiveIntensity: 0.4 }), 0, 1.25, 0);
        })
      }
    ];
    for (const n of npcs) if (!n.object) delete n.object;

    // ------------------------------------------------------------------ update / dispose
    let minuteBase = 30;
    const TAU = Math.PI * 2;
    function update(dt, t) {
      const minutes = minuteBase + t / 60;
      secHand.rotation.z = -((t % 60) / 60) * TAU;
      minHand.rotation.z = -((minutes % 60) / 60) * TAU;
      hourHand.rotation.z = -(((6 + minutes / 60) % 12) / 12) * TAU;
    }
    update(0, 0);

    function dispose() {
      for (const t of owned.tex) t.dispose();
      for (const m of owned.mat) m.dispose();
      for (const g of owned.geo) g.dispose();
      owned.tex.length = owned.mat.length = owned.geo.length = 0;
      batches.clear();
      minuteBase = 30;
    }

    return {
      group,
      spawn: { position: [-9, 0, 0], yaw: -Math.PI / 2 },
      colliders,
      hotspots: [
        { id: 'exam_desk', position: [-5.95, 0, -3.9], radius: 1.6, label: { ar: 'طاولة الاختبار', en: 'Exam desk' } },
        { id: 'aid_office', position: [0.3, 0, 2.35], radius: 1.6, label: { ar: 'المساعدات المالية', en: 'Financial Aid' }, markerHeight: 1.9 },
        { id: 'study_room', position: [7.05, 0, -3.0], radius: 1.6, label: { ar: 'غرفة الدراسة', en: 'Study room' } }
      ],
      npcs,
      exit: { position: [9.5, 0, 0], radius: 1.5 },
      lights: 'evening',
      sky: '#151b30',                                  // dusk outside (only visible through gaps)
      fog: { color: '#1c2238', near: 30, far: 90 },
      update,
      dispose
    };
  }
};
