// Integration checks (phase 5): level C card wording, human-review hooks, start-screen basics, ops hygiene.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRulings, readJson } from './helpers/content.mjs';
import { installDomShim } from './helpers/dom-shim.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const rulings = loadRulings().map((x) => x.ruling);

describe('ruling card: disputed (level C) rulings attribute, never weigh', () => {
  let render, setLang;
  before(async () => {
    installDomShim();
    ({ renderRulingCard: render } = await import('../src/engine/ui/rulingCard.js'));
    ({ setLang } = await import('../src/engine/i18n.js'));
  });
  test('level C: no confidence badge, seal says "majority view" only for a definite verdict (else "scholars differ"/"depends"); other levels keep "overall ruling"', () => {
    for (const lang of ['ar', 'en']) {
      setLang(lang);
      for (const r of rulings) {
        const card = render(r, r.id);
        const label = card.byClass('seal-label')[0]?.textContent;
        if (r.content_level === 'C') {
          assert.equal(card.byClass('conf').length, 0, `${r.id}: confidence badge on a level C ruling`);
          const want = r.verdict === 'disputed' ? (lang === 'ar' ? 'مسألة خلافية' : 'Scholars differ')
            : r.verdict === 'depends' ? (lang === 'ar' ? 'يختلف بحسب الحال' : 'Depends on the case')
              : (lang === 'ar' ? 'قول جمهور العلماء' : 'Majority scholarly view');
          assert.equal(label, want, `${r.id} seal label`);
        } else {
          assert.notEqual(label, lang === 'ar' ? 'قول جمهور العلماء' : 'Majority scholarly view', `${r.id} seal label`);
        }
      }
    }
  });
  test('the "reviewed by" slot exists on every card and stays hidden without a scholar review', () => {
    setLang('en');
    for (const r of rulings) {
      const slot = render(r, r.id).byClass('reviewed-by')[0];
      assert.ok(slot, `${r.id}: reviewed-by slot`);
      assert.ok('hidden' in slot.attributes || slot.hidden === true, `${r.id}: reviewed-by shown without a review`);
    }
  });
});

describe('integration hooks are wired', () => {
  test('start screen offers "basics first" (tawhid) and the opt-in study', () => {
    const ui = readJson('content/script/ui_strings.json');
    const qs = readJson('content/script/questions.json').items;
    assert.ok(qs.some((q) => q.id === ui.start.basics_item), 'basics_item resolves to a reviewed Q&A item');
    const s = src('src/engine/ui/screens.js');
    assert.match(s, /start-basics/);
    assert.match(s, /href: '\?study=1'/);
    assert.match(src('src/engine/i18n.js'), /startBasics: \['start\.basics'\]/);
  });
  test('ask panel: abstain/refer offers the scholars, outcomes feed the study (no question text)', () => {
    const s = src('src/engine/ui/askPanel.js');
    assert.match(s, /features\/experts\/index\.js/);
    assert.match(s, /m\.track\?\.\('ask', \{ outcome \}\)/);
    for (const o of ['answered', 'abstain', 'refer']) assert.ok(s.includes(`'${o}'`), `outcome ${o}`);
  });
  test('guide merges published scholar answers (x: ids) and the study module boots from main.js', () => {
    assert.match(src('src/features/guide/index.js'), /questions\?public=1/);
    assert.match(src('src/main.js'), /features\/study\/index\.js/);
    assert.match(src('src/engine/game.js'), /installChoiceVoice/);
  });
  test('server serves /results; data and secrets stay out of git and the image', () => {
    assert.match(src('server.mjs'), /pathname === '\/results'/);
    const gi = src('.gitignore').split(/\r?\n/);
    for (const want of ['dist/', '.env', '.env.*', '/data/*']) assert.ok(gi.includes(want), `.gitignore: ${want}`);
    const di = src('.dockerignore').split(/\r?\n/);
    for (const want of ['data', '.env', '.env.*']) assert.ok(di.includes(want), `.dockerignore: ${want}`);
  });
  test('world layer never swallows clicks meant for the HUD', () => {
    assert.match(src('src/engine/ui/world.css'), /#ui > \.yk-world-layer \{[^}]*pointer-events: none/);
  });
});
