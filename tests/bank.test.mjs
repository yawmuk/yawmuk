// Islamic bank: content rules for the advisor cards, the money maths (zakat, loan, murabaha, diminishing
// musharaka) and the headless scene build (feature spots reachable from spawn, nothing stuck in a collider).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { ROOT, readJson, loadRulings } from './helpers/content.mjs';
import { zakat, amortize, murabaha, diminishingMusharaka, compareHouse, NISAB_GOLD_G, NISAB_SILVER_G, ZAKAT_RATE } from '../src/features/bank/calc.js';
import bank from '../src/scenes/bank.js';

const data = readJson('content/bank/cards.json');
const CARDS = data.cards;
const RULING_IDS = new Set(loadRulings().map((x) => x.ruling.id));
const bi = (o) => o && typeof o.ar === 'string' && o.ar.trim() && typeof o.en === 'string' && o.en.trim();
const isUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s]+\.[a-z]{2,}/i.test(u);

// ------------------------------------------------------------------ content
test('bank cards: the nine required contracts are present, once each', () => {
  const ids = CARDS.map((c) => c.id);
  assert.deepEqual([...ids].sort(), ['diminishing_musharaka', 'ijara_muntahia', 'mudaraba', 'murabaha', 'riba_vs_bay', 'sukuk', 'takaful', 'tawarruq', 'zakat_savings'].sort());
  assert.equal(new Set(ids).size, ids.length);
});

test('bank cards: every card is bilingual and has definition, steps, conditions, status, attribution, sources, ask-a-scholar', () => {
  for (const c of CARDS) {
    for (const k of ['title', 'definition', 'status']) assert.ok(bi(c[k]), `${c.id}.${k} needs ar+en`);
    for (const k of ['steps', 'conditions', 'ask_scholar_when']) {
      assert.ok(Array.isArray(c[k]) && c[k].length, `${c.id}.${k} non-empty`);
      c[k].forEach((x, i) => assert.ok(bi(x), `${c.id}.${k}[${i}] ar+en`));
    }
    assert.ok(c.attributed_to.length >= 1, `${c.id} attributed`);
    for (const a of c.attributed_to) { assert.ok(bi(a.body) && bi(a.ref), `${c.id} attribution text`); assert.ok(isUrl(a.url), `${c.id} attribution url ${a.url}`); }
  }
});

test('bank cards: every card has sources with URLs and a valid level tag', () => {
  for (const c of CARDS) {
    assert.ok(['A', 'B', 'C'].includes(c.content_level), `${c.id} level`);
    assert.ok(data.meta.levels[c.content_level], `${c.id} level is described`);
    assert.ok(c.sources.length >= 1, `${c.id} sources`);
    for (const s of c.sources) { assert.ok(isUrl(s.url), `${c.id} source url ${s.url}`); assert.ok(bi(s.title), `${c.id} source title`); }
    assert.ok(c.sources.some((s) => /dorar\.net\/feqhia\//.test(s.url)), `${c.id} cites the Dorar fiqh encyclopedia`);
  }
});

const CERTAINTY = [/إجماع/, /أجمع/, /قطع/, /بلا خلاف/, /لا خلاف/, /بالاتفاق/, /\bcertain/i, /\bconsensus\b/i, /\bdefinitely\b/i, /\bundisputed\b/i, /\bunanimous/i, /ثقة/, /\bconfidence\b/i];
test('bank cards: level C (ج) items never claim certainty and show attributed disagreement', () => {
  const cItems = CARDS.filter((c) => c.content_level === 'C');
  assert.ok(cItems.length >= 2, 'tawarruq and takaful are level C');
  for (const c of cItems) {
    assert.equal(c.disputed, true, `${c.id} disputed`);
    assert.ok(c.attributed_to.length >= 2, `${c.id} at least two attributed bodies`);
    assert.ok(c.disputed_points?.length >= 1 && c.disputed_points.every(bi), `${c.id} disputed points`);
    const txt = [c.status.ar, c.status.en, ...c.disputed_points.flatMap((p) => [p.ar, p.en])].join(' ');
    for (const re of CERTAINTY) assert.ok(!re.test(txt), `${c.id} level-C text must not match ${re}`);
    assert.ok(!('confidence' in c), `${c.id} carries no confidence field`);
  }
  const note = data.compare.contested_note;
  assert.equal(note.content_level, 'C');
  for (const re of CERTAINTY) assert.ok(!re.test(`${note.ar} ${note.en}`), `contested note must not match ${re}`);
});

test('bank cards: disputed cards carry their disagreement points', () => {
  for (const c of CARDS.filter((x) => x.disputed)) assert.ok(c.disputed_points?.length, `${c.id}`);
});

test('bank cards: verdicts are reused from existing rulings by id (no new AI verdicts, no retyped scripture)', () => {
  for (const c of CARDS) {
    assert.ok(!('verdict' in c), `${c.id} has no verdict field`);
    for (const k of ['quran', 'hadith', 'text_ar']) assert.ok(!(k in c), `${c.id} must not embed ${k}`);
    for (const rid of c.related_rulings || []) assert.ok(RULING_IDS.has(rid), `${c.id} links unknown ruling ${rid}`);
  }
  const linked = new Set(CARDS.flatMap((c) => c.related_rulings || []).concat(data.compare.contested_note.ruling));
  for (const rid of ['home.mortgage', 'home.credit_card', 'work.retirement_401k', 'school.student_loan']) assert.ok(linked.has(rid), `links ${rid}`);
});

test('bank: no sources from outside the approved reference set (islamqa / islamhouse) in bank files', () => {
  const files = ['content/bank/cards.json', 'src/features/bank/index.js', 'src/features/bank/calc.js', 'src/scenes/bank.js', 'docs/BANK_SOURCES.md'];
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8');
    assert.ok(!/islamqa|islamhouse/i.test(t), `${f} references a non-approved site`);
  }
});

// ------------------------------------------------------------------ zakat
test('zakat: nisab uses 85 g gold / 595 g silver and 2.5%', () => {
  assert.equal(NISAB_GOLD_G, 85);
  assert.equal(NISAB_SILVER_G, 595);
  assert.equal(ZAKAT_RATE, 0.025);
  const r = zakat({ cash: 20000, goldPrice: 100, silverPrice: 1, basis: 'gold' });
  assert.equal(r.nisabGold, 8500);
  assert.equal(r.nisabSilver, 595);
  assert.equal(r.nisab, 8500);
  assert.equal(r.reached, true);
  assert.equal(r.due, 500);
});

test('zakat: "lower of the two" picks the smaller threshold; gold basis can leave the same money below nisab', () => {
  const base = { cash: 5000, goldPrice: 100, silverPrice: 1.2 };
  const lower = zakat({ ...base, basis: 'lower' });
  assert.equal(lower.nisab, 714);
  assert.equal(lower.basisUsed, 'silver');
  assert.equal(lower.due, 125);
  const gold = zakat({ ...base, basis: 'gold' });
  assert.equal(gold.reached, false);
  assert.equal(gold.due, 0);
});

test('zakat: gold/silver holdings are valued, debts subtracted, never negative', () => {
  const r = zakat({ cash: '1,000', goldGrams: 100, goldPrice: 60, debts: 2000, deductDebts: true, basis: 'gold' });
  assert.equal(r.wealth, 5000);
  assert.equal(r.reached, false);         // nisab 5100
  assert.equal(zakat({ cash: 10, debts: 1000, deductDebts: true, goldPrice: 1, basis: 'gold' }).wealth, 0);
  // disputed: debts are NOT subtracted unless the user opts in
  const d = zakat({ cash: 10, debts: 1000, goldPrice: 1, basis: 'gold' });
  assert.equal(d.wealth, 10);
  assert.ok(d.notes.includes('debts_not_deducted'));
  const ar = zakat({ cash: '١٠٠٠٠', goldPrice: '١٠٠', basis: 'gold' });
  assert.equal(ar.wealth, 10000);         // Arabic-Indic digits accepted
  assert.equal(ar.due, 250);
});

test('zakat: no price -> asks for one; year not passed -> nothing due yet', () => {
  const r = zakat({ cash: 100000 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'need_price');
  assert.equal(r.due, 0);
  const y = zakat({ cash: 100000, goldPrice: 100, basis: 'gold', yearPassed: false });
  assert.equal(y.reached, true);
  assert.equal(y.due, 0);
  assert.ok(y.notes.includes('wait_for_year'));
  const one = zakat({ cash: 100000, goldPrice: 100, basis: 'lower' });
  assert.ok(one.notes.includes('lower_needs_both'));
  assert.equal(one.nisab, 8500);
  assert.ok(zakat({ cash: 1, goldGrams: 10, basis: 'gold', goldPrice: '' }).notes.includes('metal_without_price'));
});

// ------------------------------------------------------------------ finance comparison
test('amortize: standard annuity (100k, 6%, 30y -> 599.55/month)', () => {
  const r = amortize(100000, 6, 30);
  assert.equal(r.monthly, 599.55);
  assert.equal(r.months, 360);
  assert.ok(Math.abs(r.yearly.at(-1).balance) < 0.01);
  assert.ok(r.extra > 115000 && r.extra < 116000);
  assert.equal(amortize(1200, 0, 1).monthly, 100);
  assert.equal(amortize(0, 5, 10), null);
});

test('murabaha: one fixed price set at signing, equal instalments, nothing added later', () => {
  const r = murabaha(100000, 6, 30);
  const loan = amortize(100000, 6, 30);
  assert.equal(r.monthly, loan.monthly);            // same number, different contract
  assert.ok(Math.abs(r.price - r.monthly * 360) < 1);
  assert.ok(Math.abs(r.yearly.at(-1).remainingPrice) < 0.01);
  assert.equal(murabaha(1200, 0, 1).price, 1200);
});

test('diminishing musharaka: ownership rises to 100%, rent falls, total = financed + rent', () => {
  const r = diminishingMusharaka(500000, 20, 6, 25);
  assert.equal(r.startOwnershipPct, 20);
  assert.equal(r.down, 100000);
  assert.equal(r.yearly.at(-1).clientOwnershipPct, 100);
  assert.ok(r.firstMonthly > r.lastMonthly);
  for (let i = 1; i < r.yearly.length; i++) assert.ok(r.yearly[i].clientOwnershipPct > r.yearly[i - 1].clientOwnershipPct);
  assert.ok(Math.abs(r.total - (400000 + r.extra)) < 0.05);
});

test('compareHouse: all three finance the same amount', () => {
  const c = compareHouse({ price: 400000, downPct: 20, ratePct: 6, years: 25 });
  assert.equal(c.financed, 320000);
  assert.ok(c.loan && c.murabaha && c.musharaka);
  assert.equal(c.murabaha.monthly, c.loan.monthly);
});

// ------------------------------------------------------------------ scene
const EXPECTED = { bank: { ar: 'مستشار التمويل الإسلامي', en: 'Islamic finance advisor' }, experts: { ar: 'اسأل أهل العلم', en: 'Ask a scholar' } };
function stubCtx(quality = 'high') {
  return { THREE, group: new THREE.Group(), lang: 'ar', quality, makeLabel(text) { const s = new THREE.Object3D(); s.userData.text = text; return s; } };
}
const blocking = (cs) => cs.filter((c) => c.max[1] > 0.25 && c.min[1] < 1.7);
const hits = (cs, x, z, r = 0.3) => cs.some((c) => {
  const cx = Math.max(c.min[0], Math.min(x, c.max[0])), cz = Math.max(c.min[2], Math.min(z, c.max[2]));
  return Math.hypot(x - cx, z - cz) < r;
});
const allColliders = (res) => blocking([
  ...res.colliders,
  ...res.npcs.filter((n) => n.collide !== false).map((n) => ({ min: [n.position[0] - 0.28, 0, n.position[2] - 0.28], max: [n.position[0] + 0.28, 1.8, n.position[2] + 0.28] }))
]);

test('bank scene: contract + the two feature spots with the required labels', () => {
  assert.equal(bank.id, 'bank');
  assert.equal(typeof bank.build, 'function');
  assert.deepEqual(bank.featureSpots.map((s) => s.feature).sort(), ['bank', 'experts']);
  for (const s of bank.featureSpots) {
    assert.deepEqual({ ...s.label }, EXPECTED[s.feature]);
    assert.equal(s.pos.length, 3);
    assert.ok(s.pos.every(Number.isFinite));
  }
});

test('bank scene: builds headless, low draw calls, owned dispose, works on low quality', () => {
  for (const q of ['high', 'low']) {
    const res = bank.build(stubCtx(q));
    assert.ok(res.group.isObject3D);
    assert.deepEqual(res.hotspots, []);
    assert.ok(res.exit.radius > 0);
    assert.equal(res.lights, 'day');
    let meshes = 0, lights = 0;
    res.group.traverse((o) => { if (o.isMesh) meshes++; if (o.isLight) { lights++; assert.equal(o.castShadow, false); } });
    assert.ok(meshes <= 12, `meshes ${meshes}`);
    assert.ok(lights <= 3);
    assert.ok(res.npcs.length <= 12);
    assert.ok(res.npcs.filter((n) => n.id.startsWith('bg_')).length <= 10);
    res.dispose();
  }
});

test('bank scene: spawn, exit and every feature spot are free and reachable on foot', () => {
  const res = bank.build(stubCtx());
  const cs = allColliders(res);
  const pts = { spawn: res.spawn.position, exit: res.exit.position, ...Object.fromEntries(bank.featureSpots.map((s) => [s.feature, s.pos])) };
  for (const [k, p] of Object.entries(pts)) assert.ok(!hits(cs, p[0], p[2]), `${k} inside a collider`);
  // flood fill on a 0.1 m grid from spawn
  const step = 0.1, x0 = -8, z0 = -6, nx = 160, nz = 120;
  const seen = new Uint8Array(nx * nz);
  const idx = (i, j) => j * nx + i;
  const toCell = (x, z) => [Math.round((x - x0) / step), Math.round((z - z0) / step)];
  const [si, sj] = toCell(res.spawn.position[0], res.spawn.position[2]);
  const q = [[si, sj]]; seen[idx(si, sj)] = 1;
  while (q.length) {
    const [i, j] = q.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz || seen[idx(a, b)]) continue;
      if (hits(cs, x0 + a * step, z0 + b * step)) { seen[idx(a, b)] = 2; continue; }
      seen[idx(a, b)] = 1; q.push([a, b]);
    }
  }
  for (const [k, p] of Object.entries(pts)) {
    const [i, j] = toCell(p[0], p[2]);
    // within interaction radius of a reachable cell
    let ok = false;
    for (let a = -10; a <= 10 && !ok; a++) for (let b = -10; b <= 10 && !ok; b++) if (seen[idx(i + a, j + b)] === 1 && Math.hypot(a, b) * step < 1.2) ok = true;
    assert.ok(ok, `${k} reachable from spawn`);
  }
});
