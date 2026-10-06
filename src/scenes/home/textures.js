// Canvas-painted textures for the home scene (no external image files, no text).

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function toTex(THREE, c, { repeat = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/** Light oak plank floor. One texture tile = 8 plank rows. */
export function woodFloor(THREE) {
  const [c, g] = canvas(1024, 1024);
  const r = rng(7);
  const rowH = 128;
  for (let row = 0; row < 8; row++) {
    let x = -Math.floor(r() * 400);
    while (x < 1024) {
      const len = 300 + Math.floor(r() * 380);
      const k = 0.9 + r() * 0.18;
      g.fillStyle = shade('#c8a27a', k);
      g.fillRect(x, row * rowH, len, rowH);
      // grain
      g.globalAlpha = 0.16;
      for (let i = 0; i < 9; i++) {
        g.strokeStyle = shade('#8f6a45', 0.9 + r() * 0.2);
        g.lineWidth = 1 + r() * 2;
        const y = row * rowH + 8 + r() * (rowH - 16);
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 10, x + len * 0.6, y + (r() - 0.5) * 10, x + len, y + (r() - 0.5) * 6);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(70,45,25,0.55)';
      g.fillRect(x, row * rowH, 3, rowH); // end seam
      x += len;
    }
    g.fillStyle = 'rgba(70,45,25,0.45)';
    g.fillRect(0, row * rowH, 1024, 3); // long seam
  }
  return toTex(THREE, c, { repeat: true });
}

/** White subway tiles. One texture unit = 4 tiles across x 8 rows. */
export function subwayTile(THREE) {
  const [c, g] = canvas(256, 256);
  const r = rng(3);
  g.fillStyle = '#cfc9bf';
  g.fillRect(0, 0, 256, 256);
  const tw = 64, th = 32;
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? tw / 2 : 0;
    for (let col = -1; col < 5; col++) {
      const x = col * tw + off, y = row * th;
      g.fillStyle = shade('#f5f4f0', 0.97 + r() * 0.04);
      g.fillRect(x + 2, y + 2, tw - 4, th - 4);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(x + 4, y + 4, tw - 12, 3);
    }
  }
  return toTex(THREE, c, { repeat: true });
}

/** Living-room rug: red-orange field with geometric diamonds and banded border. */
export function livingRug(THREE) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#f0d9b5'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#9e3b2b'; g.fillRect(14, 14, 484, 484);
  g.fillStyle = '#e39a52'; g.fillRect(34, 34, 444, 444);
  g.fillStyle = '#b8472f'; g.fillRect(48, 48, 416, 416);
  const diamond = (cx, cy, rw, rh, col) => {
    g.fillStyle = col; g.beginPath();
    g.moveTo(cx, cy - rh); g.lineTo(cx + rw, cy); g.lineTo(cx, cy + rh); g.lineTo(cx - rw, cy); g.closePath(); g.fill();
  };
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = 100 + i * 104, cy = 100 + j * 104;
    diamond(cx, cy, 40, 40, '#f0d9b5');
    diamond(cx, cy, 28, 28, '#2f5d62');
    diamond(cx, cy, 12, 12, '#e39a52');
  }
  diamond(256, 256, 70, 70, 'rgba(240,217,181,0.25)');
  // border teeth
  g.fillStyle = '#f0d9b5';
  for (let k = 40; k < 472; k += 24) {
    g.fillRect(k, 22, 10, 6); g.fillRect(k, 484, 10, 6);
    g.fillRect(22, k, 6, 10); g.fillRect(484, k, 6, 10);
  }
  return toTex(THREE, c);
}

/** Family snapshot: a group of simple figures in front of a snowy yard (shapes only, no faces/text). */
export function familyPhoto(THREE) {
  const [c, g] = canvas(256, 192);
  const sky = g.createLinearGradient(0, 0, 0, 120);
  sky.addColorStop(0, '#9cc9ea'); sky.addColorStop(1, '#e3f1fa');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#2f5a43';
  for (const [x, h] of [[24, 70], [214, 84], [236, 60]]) { g.beginPath(); g.moveTo(x - 22, 128); g.lineTo(x, 128 - h); g.lineTo(x + 22, 128); g.closePath(); g.fill(); }
  g.fillStyle = '#f4f7fa'; g.fillRect(0, 124, 256, 68);
  const person = (x, h, shirt, hair, skin) => {
    const top = 176 - h;
    g.fillStyle = shirt; g.beginPath(); g.roundRect ? g.roundRect(x - h * 0.17, top + h * 0.26, h * 0.34, h * 0.74, 8) : g.rect(x - h * 0.17, top + h * 0.26, h * 0.34, h * 0.74); g.fill();
    g.fillStyle = skin; g.beginPath(); g.arc(x, top + h * 0.13, h * 0.12, 0, 7); g.fill();
    g.fillStyle = hair; g.beginPath(); g.arc(x, top + h * 0.1, h * 0.125, Math.PI, 0); g.fill();
  };
  person(70, 96, '#6b7a3a', '#c9c9c9', '#f0c8a8');   // Carol
  person(112, 110, '#2f4a6d', '#5a3b24', '#e8c4a0');  // Adam
  person(152, 98, '#9c3d54', '#8a4b2a', '#f1cfae');   // Sarah
  person(192, 104, '#8a8f98', '#8b6b3d', '#f3d3b5');  // Ben
  g.fillStyle = 'rgba(255,240,210,0.12)'; g.fillRect(0, 0, 256, 192);   // warm print tint
  return toTex(THREE, c, { aniso: 4 });
}

/** Framed geometric art: eight-pointed star tessellation (no text). */
export function starArt(THREE) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f3ead8'; g.fillRect(0, 0, 256, 256);
  const star = (cx, cy, rr, col) => {
    g.fillStyle = col;
    for (const a of [0, Math.PI / 4]) {
      g.save(); g.translate(cx, cy); g.rotate(a); g.fillRect(-rr, -rr, rr * 2, rr * 2); g.restore();
    }
  };
  star(128, 128, 70, '#2f6b6b');
  star(128, 128, 52, '#d6b46a');
  star(128, 128, 34, '#2f6b6b');
  star(128, 128, 14, '#f3ead8');
  for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) star(x, y, 46, '#c46a4a');
  return toTex(THREE, c, { aniso: 4 });
}

/** Laptop screen: real-estate listing — house photo + panel with "pre-approved" badge (shapes only). */
export function laptopScreen(THREE) {
  const [c, g] = canvas(512, 320);
  g.fillStyle = '#eef2f6'; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#d5dbe2'; g.fillRect(0, 0, 512, 26);
  for (let i = 0; i < 3; i++) { g.fillStyle = ['#e25b4f', '#f0b43c', '#58b55d'][i]; g.beginPath(); g.arc(14 + i * 16, 13, 5, 0, 7); g.fill(); }
  g.fillStyle = '#ffffff'; g.fillRect(70, 6, 300, 14);
  // photo
  const sky = g.createLinearGradient(0, 36, 0, 236);
  sky.addColorStop(0, '#8cc4ef'); sky.addColorStop(1, '#d9eefb');
  g.fillStyle = sky; g.fillRect(14, 38, 300, 200);
  g.fillStyle = '#6fae5a'; g.fillRect(14, 186, 300, 52);
  g.fillStyle = '#4e8a44'; g.beginPath(); g.arc(270, 160, 34, 0, 7); g.fill();
  g.fillStyle = '#6b4a2f'; g.fillRect(266, 170, 8, 30);
  g.fillStyle = '#f2eadb'; g.fillRect(80, 120, 150, 76);
  g.fillStyle = '#7d4b3a'; g.beginPath(); g.moveTo(68, 122); g.lineTo(155, 70); g.lineTo(242, 122); g.closePath(); g.fill();
  g.fillStyle = '#3d5f7a'; g.fillRect(146, 150, 22, 46);
  g.fillStyle = '#9fd0ef'; g.fillRect(96, 138, 30, 24); g.fillRect(188, 138, 30, 24);
  // side panel
  g.fillStyle = '#ffffff'; g.fillRect(326, 38, 172, 270);
  g.fillStyle = '#2b3a4a'; g.fillRect(340, 54, 120, 14);
  g.fillStyle = '#9aa6b2'; for (let i = 0; i < 4; i++) g.fillRect(340, 82 + i * 18, 140 - i * 16, 8);
  g.fillStyle = '#e5f5e8'; g.fillRect(338, 170, 148, 46);
  g.strokeStyle = '#3c9a5a'; g.lineWidth = 3; g.strokeRect(338, 170, 148, 46);
  g.fillStyle = '#3c9a5a'; g.beginPath(); g.arc(358, 193, 10, 0, 7); g.fill();
  g.fillStyle = '#3c9a5a'; g.fillRect(376, 186, 96, 6); g.fillRect(376, 198, 70, 6);
  g.fillStyle = '#2f6fd1'; g.fillRect(338, 236, 148, 34);
  g.fillStyle = '#ffffff'; g.fillRect(372, 250, 80, 6);
  // thumbnails
  for (let i = 0; i < 4; i++) { g.fillStyle = ['#c9dcc2', '#e7d6bf', '#cfd9e6', '#e3c9c0'][i]; g.fillRect(14 + i * 76, 250, 68, 56); }
  return toTex(THREE, c, { aniso: 4 });
}
