// Build 96 px WebP thumbnails (public/assets/thumbs/<id>.webp) from each source's own preview image:
// Kenney kit preview PNGs, poly.pizza preview renders and Poly Haven thumbnails. Run after fetch.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { PROPS, HDRIS, TEXTURES, KENNEY_KITS } from './assets.spec.mjs';
import { OUT, CACHE, tool, download } from './toolchain.mjs';

const sharp = (await tool('sharp')).default;
const dir = path.join(OUT, 'thumbs');
fs.mkdirSync(dir, { recursive: true });
const S = 96;

async function make(id, src) {
  await sharp(src).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 70 }).toFile(path.join(dir, id + '.webp'));
}
for (const p of PROPS) {
  let src;
  if (p.src === 'kenney') {
    const kd = path.join(CACHE, 'kenney', KENNEY_KITS[p.kit].slug);
    src = [path.join(kd, 'Previews', p.name + '.png'), path.join(kd, 'Isometric', p.name + '_SE.png')].find(f => fs.existsSync(f));
  } else {
    src = await download(`https://static.poly.pizza/${p.uuid}.webp`, path.join(CACHE, 'polypizza', p.uuid + '.webp'));
  }
  if (src) await make(p.id, src); else console.warn('no preview for', p.id);
}
for (const t of [...HDRIS, ...TEXTURES]) {
  const src = await download(`https://cdn.polyhaven.com/asset_img/thumbs/${t.ph}.png?width=256&height=256`, path.join(CACHE, 'polyhaven', t.ph + '_thumb.png'));
  await make(t.id, src);
}
const files = fs.readdirSync(dir);
console.log(files.length, 'thumbnails,', (files.reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0) / 1024).toFixed(0), 'KB');
