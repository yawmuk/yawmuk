// Canvas-generated textures for the public_events ballroom (no text — signage goes through makeLabel).
export function canvasTex(THREE, w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/** Burgundy carpet with a gold lattice + medallions (one 2m tile). */
export function carpetTex(THREE) {
  return canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#6b1f2a'; g.fillRect(0, 0, w, h);
    // subtle pile noise
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,220,200,0.04)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = 'rgba(201,162,39,0.55)'; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.lineTo(0, h / 2); g.closePath();
    g.stroke();
    g.strokeStyle = 'rgba(201,162,39,0.3)'; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(w / 2, 18); g.lineTo(w - 18, h / 2); g.lineTo(w / 2, h - 18); g.lineTo(18, h / 2); g.closePath();
    g.stroke();
    const medal = (x, y, r) => {
      g.fillStyle = 'rgba(201,162,39,0.5)';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a1822';
      g.beginPath(); g.arc(x, y, r * 0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(201,162,39,0.6)';
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.beginPath(); g.arc(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35, r * 0.18, 0, Math.PI * 2); g.fill();
      }
    };
    medal(w / 2, h / 2, 22);
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) medal(x, y, 12);
  }, { repeat: [11, 8] });
}

/** Wall elevation strip (5m tall): wainscot + chair rail + cream field + crown band. */
export function wallTex(THREE) {
  return canvasTex(THREE, 8, 512, (g, w, h) => {
    const y = (m) => h - (m / 5) * h; // metres -> px (0 at bottom)
    g.fillStyle = '#efe3c8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d7c19a'; g.fillRect(0, y(1.1), w, y(0) - y(1.1));
    g.fillStyle = '#c9a227'; g.fillRect(0, y(1.16), w, y(1.1) - y(1.16));
    g.fillStyle = '#5e3d22'; g.fillRect(0, y(0.14), w, y(0) - y(0.14));
    g.fillStyle = '#f7f1e2'; g.fillRect(0, y(5), w, y(4.7) - y(5));
    g.fillStyle = '#c9a227'; g.fillRect(0, y(4.72), w, 4);
  });
}

/** Coffered ceiling tile. */
export function ceilingTex(THREE) {
  return canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#f3e8d0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e2d2b0'; g.fillRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#f3e8d0'; g.fillRect(18, 18, w - 36, h - 36);
    g.strokeStyle = 'rgba(201,162,39,0.6)'; g.lineWidth = 2; g.strokeRect(10, 10, w - 20, h - 20);
  }, { repeat: [7, 5] });
}

/** Velvet curtain folds. */
export function curtainTex(THREE) {
  return canvasTex(THREE, 256, 32, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 16; i++) grd.addColorStop(i / 16, i % 2 ? '#7a1c2a' : '#3e0d16');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}

/** Dusk window with downtown lights. */
export function windowTex(THREE) {
  return canvasTex(THREE, 128, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#141c3a'); grd.addColorStop(0.55, '#3a3a6a'); grd.addColorStop(0.85, '#b0607a'); grd.addColorStop(1, '#e09a6a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    let x = 0;
    while (x < w) {
      const bw = 12 + Math.random() * 22, bh = 50 + Math.random() * 110;
      g.fillStyle = '#1a1c2e'; g.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 6; yy < h - 4; yy += 8) for (let xx = x + 3; xx < x + bw - 3; xx += 6)
        if (Math.random() < 0.45) { g.fillStyle = Math.random() < 0.8 ? '#ffd98a' : '#bfe0ff'; g.fillRect(xx, yy, 2, 3); }
      x += bw + 2;
    }
    // mullions
    g.fillStyle = '#f2ead8';
    g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4); g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
    g.fillRect(w / 2 - 2, 0, 4, h); g.fillRect(0, h * 0.33, w, 3); g.fillRect(0, h * 0.66, w, 3);
  });
}

/** Panelled double doors (entrance). */
export function doorTex(THREE, single = false) {
  return canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#5e3d22'; g.fillRect(0, 0, w, h);
    const leaves = single ? 1 : 2, lw = w / leaves;
    for (let i = 0; i < leaves; i++) {
      const x0 = i * lw;
      g.fillStyle = '#7a5132'; g.fillRect(x0 + 6, 6, lw - 12, h - 6);
      g.strokeStyle = '#c9a227'; g.lineWidth = 3;
      g.strokeRect(x0 + 20, 22, lw - 40, h * 0.42);
      g.strokeRect(x0 + 20, h * 0.52, lw - 40, h * 0.42);
      g.fillStyle = '#e0c060';
      const hx = single ? x0 + lw - 30 : (i === 0 ? x0 + lw - 18 : x0 + 12);
      g.fillRect(hx, h * 0.45, 6, 34);
    }
    if (single) { g.fillStyle = '#c8ccd0'; g.fillRect(14, h * 0.48, w - 28, 10); }
  });
}

/** Sky-blue charity banner with hearts and raffle tickets (no text). */
export function bannerTex(THREE) {
  return canvasTex(THREE, 512, 160, (g, w, h) => {
    g.fillStyle = '#8ec9e8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    const heart = (x, y, s, col) => {
      g.fillStyle = col; g.beginPath();
      g.moveTo(x, y + s * 0.35);
      g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.35);
      g.bezierCurveTo(x - s * 0.5, y + s * 0.65, x, y + s * 0.8, x, y + s);
      g.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.65, x + s * 0.5, y + s * 0.35);
      g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35); g.fill();
    };
    const ticket = (x, y, col) => {
      g.save(); g.translate(x, y); g.rotate(-0.2);
      g.fillStyle = col; g.fillRect(-34, -18, 68, 36);
      g.fillStyle = '#8ec9e8';
      g.beginPath(); g.arc(-34, 0, 7, 0, Math.PI * 2); g.arc(34, 0, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.setLineDash([4, 4]); g.lineWidth = 2;
      g.beginPath(); g.moveTo(14, -16); g.lineTo(14, 16); g.stroke();
      g.restore();
    };
    heart(w / 2, 30, 100, '#e0505e');
    g.fillStyle = '#ffffff'; g.fillRect(w / 2 - 6, 62, 12, 36); g.fillRect(w / 2 - 18, 74, 36, 12);
    ticket(110, 80, '#d64545'); ticket(400, 80, '#ffffff');
    heart(40, 50, 40, '#ffffff'); heart(w - 40, 50, 40, '#ffffff');
  });
}

/** TV prize screen: warm gradient with a ribboned gift silhouette. */
export function tvTex(THREE) {
  return canvasTex(THREE, 256, 160, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#1d4f8a'); grd.addColorStop(1, '#5fb3e0');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#f2c94c'; g.fillRect(w / 2 - 40, h / 2 - 20, 80, 60);
    g.fillStyle = '#e0505e'; g.fillRect(w / 2 - 6, h / 2 - 20, 12, 60); g.fillRect(w / 2 - 40, h / 2 + 4, 80, 10);
    g.beginPath(); g.ellipse(w / 2 - 14, h / 2 - 28, 14, 9, -0.4, 0, Math.PI * 2); g.ellipse(w / 2 + 14, h / 2 - 28, 14, 9, 0.4, 0, Math.PI * 2); g.fill();
  });
}
