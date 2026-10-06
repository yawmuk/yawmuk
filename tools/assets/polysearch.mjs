// Search poly.pizza and list results (title | creator | licence | publicID | glb url).
// Usage: node tools/assets/polysearch.mjs "vending machine" [--cc0]
import { pathToFileURL } from 'node:url';
export async function polySearch(query) {
  const html = await (await fetch('https://poly.pizza/search/' + encodeURIComponent(query))).text();
  const m = html.match(/window\.__SERVER_APP_STATE__ =\s*(\{.*?\})<\/script>/s);
  if (!m) return [];
  const st = JSON.parse(m[1]);
  return (st.initialData?.result || []).map(r => ({
    title: r.title, creator: r.creator?.username, licence: r.licence, id: r.publicID,
    glb: r.previewUrl.replace(/\.webp$/, '.glb'), page: 'https://poly.pizza' + r.url,
  }));
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [q, ...rest] = process.argv.slice(2);
  const onlyCC0 = rest.includes('--cc0');
  for (const r of await polySearch(q)) if (!onlyCC0 || /CC0/i.test(r.licence))
    console.log([r.title, r.creator, r.licence, r.id, r.glb].join(' | '));
}
