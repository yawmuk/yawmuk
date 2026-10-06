// Scientific reference package compliance (المنتج العلمي — pages 2, 5, 7):
// content levels A–D, khilaf never shown as certain, no unsourced consensus, no self-admitting caveats shown
// to the player, gentle tone in story feedback, and the required glossary terms.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { LOCATIONS, loadRulings, loadScripts, readJson, walkStrings, nonEmptyStr, bilingual } from './helpers/content.mjs';
import { installDomShim } from './helpers/dom-shim.mjs';

const rulings = loadRulings().map((x) => x.ruling);
const scripts = loadScripts();
const ui = readJson('content/script/ui_strings.json');
const LEVELS = ['A', 'B', 'C', 'D'];
// Fields that are never shown to the player as our own claims (reviewer notes) or that are the citations themselves.
const NOT_PLAYER_FACING = new Set(['notes_for_reviewer']);
const CITATION_FIELDS = new Set(['quran', 'hadith', 'consensus_sources']);

/** Every player-facing string of a ruling, with its path. `skip` = extra top-level keys to leave out. */
function playerStrings(r, skip = new Set()) {
  const out = [];
  for (const [k, v] of Object.entries(r)) {
    if (NOT_PLAYER_FACING.has(k) || skip.has(k) || k.startsWith('_')) continue;
    walkStrings(v, (s, p) => out.push([s, p]), `$.${k}`);
  }
  return out;
}

describe('content levels (A–D)', () => {
  for (const r of rulings) {
    test(`${r.id}: has a valid content_level`, () => {
      assert.ok(LEVELS.includes(r.content_level), `content_level "${r.content_level}" must be one of ${LEVELS}`);
    });

    if (r.content_level === 'C') {
      test(`${r.id}: level C is never shown as a bare certain verdict`, () => {
        const ok = ['disputed', 'depends'].includes(r.verdict) || bilingual(r.verdict_scope);
        assert.ok(ok, `level C ruling with verdict "${r.verdict}" needs verdict disputed/depends or a bilingual verdict_scope`);
      });
    }
    if (r.content_level === 'D') {
      test(`${r.id}: level D gives no ruling of its own`, () => {
        assert.ok(['depends', 'disputed'].includes(r.verdict), 'level D must not carry a definitive verdict');
        assert.ok(bilingual(r.refer_to_scholar_when), 'level D must refer to a qualified authority');
      });
    }
    test(`${r.id}: optional fields are well-formed`, () => {
      if (r.verdict_scope !== undefined) assert.ok(bilingual(r.verdict_scope), 'verdict_scope {ar,en}');
      if (r.explanatory_notes !== undefined) {
        const n = r.explanatory_notes;
        assert.ok(Array.isArray(n.ar) && Array.isArray(n.en) && n.ar.length > 0 && n.ar.length === n.en.length, 'explanatory_notes {ar:[], en:[]} of equal length');
        for (const s of [...n.ar, ...n.en]) assert.ok(nonEmptyStr(s));
      }
      if (r.consensus_sources !== undefined) assert.ok(Array.isArray(r.consensus_sources) && r.consensus_sources.every(nonEmptyStr), 'consensus_sources: non-empty strings');
      for (const [m, d] of Object.entries(r.madhahib)) {
        if (d.reference_status !== undefined) assert.equal(d.reference_status, 'pending_verification', `${m}.reference_status`);
      }
    });
  }
});

describe('no consensus claim without a source', () => {
  const CONSENSUS = /إجماع|أجمع|باتفاق|consensus|all scholars|unanimous|all considered views/i;
  // A usable source names a URL or a volume/page (e.g. 29/418, ص175).
  const SOURCED = /https?:\/\/|\d+\s*\/\s*\d+|ص\s*\d+/;
  for (const r of rulings) {
    test(`${r.id}: consensus wording is backed by consensus_sources`, () => {
      const hits = playerStrings(r, CITATION_FIELDS).filter(([s]) => CONSENSUS.test(s)).map(([, p]) => p);
      if (!hits.length) return;
      const src = r.consensus_sources || [];
      assert.ok(src.some((s) => SOURCED.test(s)), `consensus wording at ${hits.join(', ')} but no consensus_sources entry with a URL or volume/page`);
    });
  }
  test('lint self-check', () => {
    for (const s of ['محرم بالإجماع', 'أجمعت الأمة', 'باتفاق الفقهاء', 'by consensus', 'all scholars agree', 'impermissible by all considered views']) assert.match(s, CONSENSUS);
  });
});

describe('player never sees a self-admitting caveat', () => {
  const CAVEAT = /يحتاج إلى توثيق|يحتاج مطابقة|لم نطّلع|لم نطلع|لم نطالع|نتائج البحث|نتائج بحث|search results/i;
  test('rulings (all player-facing fields, incl. madhhab references)', () => {
    const bad = [];
    for (const r of rulings) for (const [s, p] of playerStrings(r)) if (CAVEAT.test(s)) bad.push(`${r.id} ${p}: ${s.slice(0, 80)}`);
    assert.deepEqual(bad, []);
  });
  test('scripts and UI strings', () => {
    const bad = [];
    for (const [name, data] of [...Object.entries(scripts), ['ui_strings', ui]]) walkStrings(data, (s, p) => { if (CAVEAT.test(s)) bad.push(`${name} ${p}`); });
    assert.deepEqual(bad, []);
  });
});

describe('tone: story feedback never shames the player', () => {
  // Arabic words are matched as whole words (optionally with ال / و / ف / يا) so «تتجاهل» does not trip «جاهل».
  const HARSH = /\bshame(ful|d)?\b|\bstupid\b|\bidiot|\bdumb\b|\bignorant\b|(?:^|[\s«"“(،.!؟])(?:يا\s*)?[وف]?(?:ال)?(?:جاهل|كافر|غبي|أحمق)|عار عليك/i;
  test('lint self-check', () => {
    for (const s of ['You are stupid', 'what a shame', 'أنت جاهل', 'يا جاهل', 'الكافر']) assert.match(s, HARSH);
    for (const s of ['الهدية التي تتجاهل ما قاله', 'shameless-free', 'a friendly reminder']) assert.doesNotMatch(s, HARSH);
  });
  for (const loc of LOCATIONS) {
    test(`${loc}: choice consequences and check questions`, () => {
      const bad = [];
      for (const sit of scripts[loc].situations) {
        for (const c of sit.choices) walkStrings(c.consequence, (s, p) => { if (HARSH.test(s)) bad.push(`${sit.ruling_id} ${c.id}.consequence${p.slice(1)}: ${s.slice(0, 60)}`); });
        walkStrings(sit.check_question, (s, p) => { if (HARSH.test(s)) bad.push(`${sit.ruling_id} check${p.slice(1)}: ${s.slice(0, 60)}`); });
      }
      assert.deepEqual(bad, []);
    });
  }
});

describe('glossary (package page 7 wording)', () => {
  const g = ui.glossary || {};
  const REQUIRED = {
    tawhid: [/ربوبية|الربوبية/, /عددية|العددية/, /numerical|numeric/i],
    sharia: [/العقوبات|الجنائي/, /penal|criminal/i],
    hadith: [/درجة/, /grade/i],
    sunnah: [/هدي/, /way|guidance/i],
    fatwa: [/المعلومة العامة/, /general information/i],
    ibadah: [/القلب/, /heart/i],
    ijtihad: [/اجتهاد|الاجتهاد/, /ijtihad/i],
    khilaf: [/تناقض/, /contradiction/i],
    qibla: [/الكعبة/, /Ka.?bah/i]
  };
  for (const [k, checks] of Object.entries(REQUIRED)) {
    test(`glossary.${k}: present in ar + en with the package's key idea`, () => {
      assert.ok(bilingual(g[k]), `glossary.${k} {ar,en}`);
      for (const re of checks) assert.ok(re.test(g[k].ar) || re.test(g[k].en), `glossary.${k} should mention ${re}`);
    });
  }
});

describe('ruling card renders the compliance badges', () => {
  let render, setLang, t;
  before(async () => {
    installDomShim();
    ({ renderRulingCard: render } = await import('../src/engine/ui/rulingCard.js'));
    ({ setLang, t } = await import('../src/engine/i18n.js'));
  });
  const text = (el) => el.textContent;

  test('content level badge with tooltip; scope; explanatory heading; pending reference badge; AI badge beside high confidence', () => {
    for (const lang of ['ar', 'en']) {
      setLang(lang);
      const r = structuredClone(rulings[0]);
      r.content_level = 'C';
      r.verdict_scope = { ar: 'نطاق', en: 'scope' };
      r.explanatory_notes = { ar: ['شرح منا'], en: ['our note'] };
      for (const d of Object.values(r.madhahib)) delete d.reference_status;
      r.madhahib.maliki.reference = r.madhahib.maliki.reference || 'x';
      r.madhahib.maliki.reference_status = 'pending_verification';
      r.confidence = 'high';
      r.review_status = 'ai_verified';
      const card = render(r, r.id);
      const lv = card.byClass('level')[0];
      assert.ok(lv, 'level badge');
      assert.equal(lv.getAttribute('data-level'), 'C');
      assert.ok(nonEmptyStr(lv.getAttribute('title')), 'level badge has a tooltip');
      assert.ok(text(card.byClass('rc-scope')[0]).includes(lang === 'ar' ? 'نطاق' : 'scope'));
      const ex = card.byClass('rc-explanatory')[0];
      assert.ok(ex && text(ex).includes(t('explanatory')) && text(ex).includes(lang === 'ar' ? 'شرح منا' : 'our note'));
      assert.match(t('explanatory'), lang === 'ar' ? /شرح توضيحي — ليس نصاً شرعياً/ : /Explanatory note — not a scriptural text/);
      assert.equal(card.byClass('ref-pending').length, 1, 'one pending-reference badge');
      assert.ok(text(card.byClass('ref-pending')[0]).includes(t('refPending')));
      assert.equal(card.byClass('ai-prepared').length, 1, 'high confidence shown with the AI-prepared badge');
    }
  });

  test('every real ruling card shows its level badge; high confidence always comes with the AI-prepared badge', () => {
    setLang('en');
    for (const r of rulings) {
      const card = render(r, r.id);
      assert.equal(card.byClass('level')[0]?.getAttribute('data-level'), r.content_level, r.id);
      if (r.confidence === 'high') assert.equal(card.byClass('ai-prepared').length, 1, `${r.id}: AI-prepared badge`);
      const pending = Object.values(r.madhahib).filter((d) => d.reference_status === 'pending_verification' && d.reference).length;
      assert.equal(card.byClass('ref-pending').length, pending, `${r.id}: pending badges`);
    }
  });
});
