// Content contract tests: content/rulings/*.json and content/script/*.json against docs/TEAM_BRIEF.md.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, LOCATIONS, loadRulings, loadSituationRulings, loadScripts, briefCatalog, readJson, nonEmptyStr, bilingual } from './helpers/content.mjs';
import { CATALOG, LOCATIONS as ENGINE_LOCATIONS } from '../src/engine/config.js';

const VERDICTS = ['haram', 'halal', 'makruh', 'mubah', 'mustahab', 'wajib', 'disputed', 'depends'];
const CONFIDENCE = ['high', 'medium', 'low'];
const QUALITIES = ['best', 'acceptable', 'wrong'];
const MADHAHIB = ['hanafi', 'maliki', 'shafii', 'hanbali'];

const rulings = loadRulings();
const byId = Object.fromEntries(rulings.map(({ ruling }) => [ruling.id, ruling]));
const scripts = loadScripts();
const catalog = briefCatalog();

describe('catalog', () => {
  test('TEAM_BRIEF lists exactly 7 situation ids', () => {
    assert.equal(catalog.length, 7);
    assert.equal(new Set(catalog).size, 7);
  });
  test('engine CATALOG and LOCATIONS match TEAM_BRIEF', () => {
    assert.deepEqual(CATALOG.map((c) => c.id), catalog);
    assert.deepEqual(ENGINE_LOCATIONS, LOCATIONS);
    for (const c of CATALOG) assert.ok(bilingual(c.title), `${c.id} engine title must be bilingual`);
  });
});

describe('rulings: contract', () => {
  test('every rulings file is a JSON array named after its location', () => {
    const files = fs.readdirSync(path.join(ROOT, 'content/rulings')).filter((f) => f.endsWith('.json')).sort();
    assert.deepEqual(files, [...LOCATIONS].sort().map((l) => `${l}.json`));
    for (const f of files) assert.ok(Array.isArray(readJson(`content/rulings/${f}`)), `${f} must be an array`);
  });

  test('ruling ids are unique and exactly match the 7-item catalog', () => {
    assert.equal(new Set(rulings.map(({ ruling }) => ruling.id)).size, rulings.length, 'duplicate ids across situations + library');
    const ids = loadSituationRulings().map(({ ruling }) => ruling.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ruling ids');
    assert.deepEqual([...ids].sort(), [...catalog].sort());
  });

  for (const { file, ruling: r } of rulings) {
    test(`${r.id}: required fields, both languages`, () => {
      const loc = r.id.split('.')[0];
      assert.equal(r.location, loc, 'location must equal id prefix');
      assert.equal(file, `${loc}.json`, 'ruling must live in its location file');
      for (const k of ['title', 'question', 'summary', 'refer_to_scholar_when']) assert.ok(bilingual(r[k]), `${k} must have non-empty ar and en`);
      assert.ok(VERDICTS.includes(r.verdict), `verdict "${r.verdict}" not in ${VERDICTS}`);
      assert.ok(CONFIDENCE.includes(r.confidence), `confidence "${r.confidence}"`);
      assert.ok(['A', 'B', 'C', 'D'].includes(r.content_level), `content_level "${r.content_level}" (see tests/levels.test.mjs)`);
      if (r.verdict_scope !== undefined) assert.ok(bilingual(r.verdict_scope), 'verdict_scope must have non-empty ar and en');
      if (r.explanatory_notes !== undefined) assert.ok(Array.isArray(r.explanatory_notes.ar) && Array.isArray(r.explanatory_notes.en) && r.explanatory_notes.ar.length === r.explanatory_notes.en.length, 'explanatory_notes must be {ar:[], en:[]} of equal length');
      if (r.consensus_sources !== undefined) assert.ok(Array.isArray(r.consensus_sources) && r.consensus_sources.every(nonEmptyStr), 'consensus_sources must be an array of strings');
      assert.ok(nonEmptyStr(r.review_status), 'review_status');
      assert.equal(typeof r.notes_for_reviewer, 'string', 'notes_for_reviewer must be a string');
      assert.ok(Array.isArray(r.quran), 'quran must be an array');
      assert.ok(Array.isArray(r.hadith), 'hadith must be an array');
      assert.ok(Array.isArray(r.contemporary), 'contemporary must be an array');
      for (const k of ['practical_guidance', 'halal_alternatives']) {
        assert.ok(r[k] && Array.isArray(r[k].ar) && Array.isArray(r[k].en), `${k} must be {ar:[], en:[]}`);
        assert.equal(r[k].ar.length, r[k].en.length, `${k}: ar and en must have the same number of items`);
        for (const s of [...r[k].ar, ...r[k].en]) assert.ok(nonEmptyStr(s), `${k}: empty item`);
      }
      assert.ok(r.practical_guidance.ar.length > 0, 'practical_guidance must not be empty');
      assert.ok(r.madhahib && typeof r.madhahib === 'object', 'madhahib');
      assert.deepEqual(Object.keys(r.madhahib).sort(), [...MADHAHIB].sort(), 'exactly the four madhhabs');
      for (const m of MADHAHIB) {
        const d = r.madhahib[m];
        for (const k of ['position_ar', 'position_en', 'reference']) assert.equal(typeof d[k], 'string', `${m}.${k} must be a string`);
        if (d.reference_status !== undefined) assert.equal(d.reference_status, 'pending_verification', `${m}.reference_status`);
      }
      for (const [i, c] of r.contemporary.entries()) {
        assert.ok(nonEmptyStr(c.body), `contemporary[${i}].body`);
        assert.ok(nonEmptyStr(c.position_ar) && nonEmptyStr(c.position_en), `contemporary[${i}] position ar/en`);
        assert.equal(typeof c.decision_ref, 'string', `contemporary[${i}].decision_ref`);
      }
    });
  }
});

describe('scripts: contract', () => {
  test('every location has a script; next_location chains home → … → private_events → null', () => {
    const chain = [];
    let loc = 'home';
    const seen = new Set();
    while (loc && !seen.has(loc)) { seen.add(loc); chain.push(loc); loc = scripts[loc].next_location; }
    assert.deepEqual(chain, LOCATIONS);
    assert.equal(scripts.private_events.next_location, null);
  });

  test('the 7 catalog situations are each played exactly once across all scripts', () => {
    const ids = LOCATIONS.flatMap((l) => scripts[l].situations.map((s) => s.ruling_id));
    assert.equal(ids.length, 7);
    assert.deepEqual([...ids].sort(), [...catalog].sort());
  });

  const hotspotsMd = fs.readFileSync(path.join(ROOT, 'docs/hotspots.md'), 'utf8');
  for (const loc of LOCATIONS) {
    const s = scripts[loc];
    test(`${loc}: script header`, () => {
      assert.equal(s.location, loc);
      assert.ok(bilingual(s.title), 'title');
      assert.ok(bilingual(s.intro), 'intro');
      assert.ok(bilingual(s.outro), 'outro');
      assert.match(s.time_of_day, /^([01]\d|2[0-3]):[0-5]\d$/, 'time_of_day HH:MM');
      assert.ok(Array.isArray(s.situations) && s.situations.length === catalog.filter((id) => id.startsWith(`${loc}.`)).length && s.situations.length > 0, 'the catalog situations of this location (at least one)');
    });

    // hotspot ids must exist in docs/hotspots.md (section of this location) and in the scene source
    const section = hotspotsMd.split(/^## \d\) /m).find((sec) => sec.startsWith(`\`${loc}\``)) || '';
    const sceneSrc = [path.join(ROOT, `src/scenes/${loc}.js`), ...(fs.existsSync(path.join(ROOT, `src/scenes/${loc}`)) ? fs.readdirSync(path.join(ROOT, `src/scenes/${loc}`)).map((f) => path.join(ROOT, `src/scenes/${loc}`, f)) : [])]
      .filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

    for (const [i, sit] of s.situations.entries()) {
      test(`${loc}[${i}] ${sit.ruling_id}: situation contract`, () => {
        assert.ok(byId[sit.ruling_id], `ruling_id ${sit.ruling_id} has no ruling in content/rulings`);
        assert.equal(sit.ruling_id.split('.')[0], loc, 'situation must belong to this location');
        assert.ok(nonEmptyStr(sit.hotspot), 'hotspot');
        assert.ok(section.includes(`\`${sit.hotspot}\``), `hotspot "${sit.hotspot}" not documented in docs/hotspots.md for ${loc}`);
        assert.ok(new RegExp(`id:\\s*['"]${sit.hotspot}['"]`).test(sceneSrc), `hotspot "${sit.hotspot}" not provided by src/scenes/${loc}.js`);
        assert.ok(sit.npc && nonEmptyStr(sit.npc.id) && bilingual(sit.npc.name) && bilingual(sit.npc.role), 'npc {id, name, role}');
        assert.ok(bilingual(sit.setup), 'setup');
        assert.ok(Array.isArray(sit.dialogue) && sit.dialogue.length > 0, 'dialogue');
        for (const [j, d] of sit.dialogue.entries()) {
          assert.ok(nonEmptyStr(d.ar) && nonEmptyStr(d.en), `dialogue[${j}] ar/en`);
          assert.ok(['adam', 'narrator', sit.npc.id].includes(d.speaker) || s.situations.some((o) => o.npc?.id === d.speaker), `dialogue[${j}] unknown speaker "${d.speaker}"`);
        }
        // choices
        assert.ok(Array.isArray(sit.choices) && sit.choices.length >= 2, 'at least 2 choices');
        assert.equal(new Set(sit.choices.map((c) => c.id)).size, sit.choices.length, 'unique choice ids');
        for (const c of sit.choices) {
          assert.ok(nonEmptyStr(c.id), 'choice id');
          assert.ok(bilingual(c.label), `choice ${c.id} label`);
          assert.ok(bilingual(c.consequence), `choice ${c.id} consequence`);
          assert.ok(QUALITIES.includes(c.quality), `choice ${c.id} quality "${c.quality}"`);
          assert.ok(Number.isInteger(c.points) && c.points >= 0, `choice ${c.id} points`);
        }
        const best = sit.choices.filter((c) => c.quality === 'best');
        assert.equal(best.length, 1, 'exactly one "best" choice');
        assert.equal(best[0].points, Math.max(...sit.choices.map((c) => c.points)), '"best" must give the most points');
        for (const c of sit.choices.filter((x) => x.quality === 'wrong')) assert.ok(c.points < best[0].points, `wrong choice ${c.id} scores as much as best`);
        // check question
        const cq = sit.check_question;
        assert.ok(cq && bilingual(cq.q), 'check_question.q');
        assert.ok(Array.isArray(cq.options) && cq.options.length >= 2, 'check options');
        for (const o of cq.options) assert.ok(nonEmptyStr(o.ar) && nonEmptyStr(o.en), 'check option ar/en');
        assert.equal(cq.options.filter((o) => o.correct === true).length, 1, 'exactly one correct check option');
      });
    }
  }

  test('ui_strings.json: every {ar,en} pair is complete', () => {
    const ui = readJson('content/script/ui_strings.json');
    const bad = [];
    const walk = (n, p) => {
      if (n && typeof n === 'object' && !Array.isArray(n)) {
        if ('ar' in n || 'en' in n) {
          const ok = (v) => (Array.isArray(v) ? v.length > 0 && v.every(nonEmptyStr) : nonEmptyStr(v));
          if (!ok(n.ar) || !ok(n.en)) bad.push(p);
          if (Array.isArray(n.ar) && Array.isArray(n.en) && n.ar.length !== n.en.length) bad.push(`${p} (list length)`);
        }
        for (const [k, v] of Object.entries(n)) if (k !== 'ar' && k !== 'en') walk(v, `${p}.${k}`);
      }
    };
    walk(ui, '$');
    assert.deepEqual(bad, []);
  });
});

describe('learner framing: newcomer_explainer, and no other religion named (owner decision 2026-10-06)', () => {
  for (const { ruling: r } of rulings) {
    test(`${r.id}: newcomer_explainer is complete in both languages; no common_ground section`, () => {
      assert.ok(bilingual(r.newcomer_explainer), 'newcomer_explainer {ar,en}');
      assert.equal(r.common_ground, undefined, 'common_ground was removed from the game');
    });
  }
  test('story scripts and UI strings never name another religion', () => {
    const OTHER = /مسيح|نصار|نصران|يهود|كنيس|كنائس|إنجيل|توراة|صليب|Christian|Jew|church|Bible|Gospel|Torah|synagogue|Abrahamic/i;
    const bad = [];
    for (const f of fs.readdirSync(path.join(ROOT, 'content/script')).filter((n) => n.endsWith('.json'))) {
      const walk = (o, at) => {
        if (typeof o === 'string') { if (OTHER.test(o)) bad.push(`${f}${at}: ${o.slice(0, 80)}`); }
        else if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], `${at}.${k}`);
      };
      walk(JSON.parse(fs.readFileSync(path.join(ROOT, 'content/script', f), 'utf8')), '$');
    }
    assert.deepEqual(bad, []);
  });
});

describe('README', () => {
  test('every local image/link in README.md exists', () => {
    const md = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const refs = [...md.matchAll(/\]\(([^)\s]+)\)|src="([^"]+)"/g)].map((m) => m[1] || m[2]).filter((u) => !/^(https?:|#|mailto:)/.test(u));
    assert.ok(refs.length > 5);
    const missing = refs.filter((u) => !fs.existsSync(path.join(ROOT, decodeURIComponent(u.split('#')[0]))));
    assert.deepEqual(missing, []);
  });
});
