// Canvas-generated textures for the street scene (no image files). Every texture is pushed to `bag`
// so the scene can dispose it.

export function createTextures(THREE, rand) {
  const bag = [];
  function tex(w, h, draw, { srgb = true, repeat = null } = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    bag.push(t);
    return t;
  }
  const speckle = (g, w, h, n, colors, r) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[(r() * colors.length) | 0];
      const s = 1 + r() * 2;
      g.fillRect(r() * w, r() * h, s, s);
    }
  };
  const blob = (g, x, y, rad, color) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  };

  const r = rand(7);
  const T = {};

  T.asphalt = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#2b2d31'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2600, ['#36393e', '#232528', '#3d4046', '#1d1f22'], r);
    for (let i = 0; i < 5; i++) blob(g, r() * w, r() * h, 20 + r() * 50, 'rgba(10,12,16,0.45)');
  }, { repeat: [24, 2] });

  T.sidewalk = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#8f8f8b'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1800, ['#9a9a96', '#85857f', '#a3a39e', '#7c7c77'], r);
    for (let i = 0; i < 3; i++) blob(g, r() * w, r() * h, 30 + r() * 40, 'rgba(40,44,52,0.25)');
    g.strokeStyle = 'rgba(40,40,40,0.75)'; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
  }, { repeat: [80, 2] });

  T.lot = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#5d5f62'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2200, ['#66686b', '#54565a', '#6e7073', '#4b4d50'], r);
    for (let i = 0; i < 4; i++) blob(g, r() * w, r() * h, 12 + r() * 26, 'rgba(15,15,18,0.55)'); // oil stains
    g.strokeStyle = 'rgba(30,30,32,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 1); g.lineTo(w, 1); g.moveTo(1, 0); g.lineTo(1, h); g.stroke();
  }, { repeat: [8.5, 3.5] });

  T.tiles = tex(128, 128, (g, w, h) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#c9c4b6' : '#e9e4d6';
      g.fillRect(x * 64, y * 64, 64, 64);
    }
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  }, { repeat: [6, 5] });

  const BRIGHT = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#ff6fa8', '#ecf0f1'];
  T.products = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3b3f46'; g.fillRect(0, 0, w, h);
    const rows = 4, rh = h / rows;
    for (let row = 0; row < rows; row++) {
      let x = 4;
      while (x < w - 8) {
        const bw = 10 + r() * 16, bh = rh * (0.45 + r() * 0.4);
        g.fillStyle = BRIGHT[(r() * BRIGHT.length) | 0];
        g.fillRect(x, (row + 1) * rh - 8 - bh, bw, bh);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 2, (row + 1) * rh - 8 - bh + 3, bw - 4, 3);
        x += bw + 2;
      }
      g.fillStyle = '#c8ccd2'; g.fillRect(0, (row + 1) * rh - 8, w, 8); // shelf lip
    }
  });

  // tea boxes & snack packs (shelf on / behind the counter)
  const TEA = ['#2e7d32', '#c62828', '#f9a825', '#6a1b9a', '#00838f', '#ef6c00', '#8d6e63', '#ad1457'];
  T.tea = tex(256, 128, (g, w, h) => {
    g.fillStyle = '#4a3324'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 2; row++) {
      const base = (row + 1) * (h / 2) - 6;
      let x = 4, i = row * 3;
      while (x < w - 20) {
        const bw = 22 + (i % 3) * 4, bh = 34 + (i % 2) * 8;
        const c = TEA[i % TEA.length];
        g.fillStyle = c; g.fillRect(x, base - bh, bw, bh);
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x + 3, base - bh + 6, bw - 6, 9);   // label band
        g.fillStyle = '#f5e6c8'; g.beginPath(); g.arc(x + bw / 2, base - bh * 0.35, 5, 0, Math.PI * 2); g.fill(); // cup/leaf mark
        x += bw + 3; i++;
      }
      g.fillStyle = '#c8a46a'; g.fillRect(0, base, w, 6); // shelf lip
    }
  });

  T.cooler = tex(256, 128, (g, w, h) => {
    g.fillStyle = '#1e2329'; g.fillRect(0, 0, w, h);
    const doors = 3, dw = w / doors;
    for (let d = 0; d < doors; d++) {
      const x0 = d * dw + 5, x1 = (d + 1) * dw - 5;
      g.fillStyle = '#dff3ff'; g.fillRect(x0, 6, x1 - x0, h - 12);
      for (let row = 0; row < 4; row++) {
        const y = 14 + row * ((h - 24) / 4);
        for (let x = x0 + 3; x < x1 - 6; x += 7) {
          // soft drinks and water only (no beer in Tariq's store)
          g.fillStyle = row % 2 ? (r() > 0.5 ? '#7fc8ff' : '#bfe6ff') : BRIGHT[(r() * BRIGHT.length) | 0];
          g.fillRect(x, y, 5, 18);
        }
        g.fillStyle = '#9fb4c4'; g.fillRect(x0, y + 19, x1 - x0, 2);
      }
      g.fillStyle = '#aab3bb'; g.fillRect(x1 - 9, h * 0.35, 3, h * 0.3); // handle
    }
  });

  T.jackpot = tex(512, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2a1600'); gr.addColorStop(1, '#5a3300');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffcc33'; g.lineWidth = 10; g.strokeRect(6, 6, w - 12, h - 12);
    for (let i = 0; i < 22; i++) { g.fillStyle = i % 2 ? '#ffe680' : '#ff9f1a'; g.beginPath(); g.arc(14 + i * 22.5, 14, 4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(14 + i * 22.5, h - 14, 4, 0, Math.PI * 2); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffe680'; g.font = '800 46px "Segoe UI", Arial, sans-serif';
    g.fillText('JACKPOT', w / 2, 62);
    g.fillStyle = '#ffffff'; g.font = '900 64px "Segoe UI", Arial, sans-serif';
    g.fillText('TRY YOUR LUCK', w / 2, 128);
  });

  T.price = tex(256, 160, (g, w, h) => {
    g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, 44);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(40, 22, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c0392b'; g.beginPath(); g.arc(40, 22, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(64, 16, 170, 12);
    g.fillStyle = '#0b0d10'; g.fillRect(0, 44, w, h - 44);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillStyle = '#ffb21a'; g.font = '800 46px "Consolas", "Courier New", monospace';
    g.fillText('3.19', w - 18, 76); g.fillText('3.59', w - 18, 128);
    g.fillStyle = '#e9e9e9'; g.fillRect(18, 70, 60, 10); g.fillRect(18, 122, 60, 10);
  });

  T.storeSign = tex(512, 96, (g, w, h) => {
    g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.fillRect(0, h * 0.42, w, h * 0.16);
    g.fillStyle = '#ffd43b'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(w / 2, h * 0.2); g.quadraticCurveTo(w / 2 + 22, h * 0.6, w / 2, h * 0.78); g.quadraticCurveTo(w / 2 - 22, h * 0.6, w / 2, h * 0.2); g.fill();
  });

  T.ad = tex(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1f6fb2'); gr.addColorStop(1, '#9fd8ff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(w / 2, h * 0.4, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffcf3a'; g.fillRect(16, h * 0.72, w - 32, 18);
    g.fillStyle = '#ffffff'; g.fillRect(24, h * 0.82, w - 48, 8);
  });

  T.pool = tex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });

  T.puff = tex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });

  return { T, bag };
}
