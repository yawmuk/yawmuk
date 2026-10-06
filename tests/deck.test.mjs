// Submission deck: no leftover template text, every slot present, and fill.mjs never invents numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  replaceTokens, findTokens, parseTestSummary, parseSourcesSummary, xmlEscape, KPI_TOKENS, PENDING,
} from '../docs/deck/fill.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DECK = path.join(ROOT, 'docs', 'deck', 'yawmuk-deck.template.pptx');
const hasDeck = fs.existsSync(DECK);

function unzipText(file, pattern) {
  const list = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).split('\n').filter((n) => pattern.test(n));
  return list.map((n) => [n, execFileSync('unzip', ['-p', file, n], { encoding: 'utf8', maxBuffer: 64 << 20 })]);
}

test('deck: 12 slides, no leftover template guidance or bracket placeholders', { skip: !hasDeck }, () => {
  const slides = unzipText(DECK, /^ppt\/slides\/slide\d+\.xml$/);
  const pres = execFileSync('unzip', ['-p', DECK, 'ppt/presentation.xml'], { encoding: 'utf8' });
  assert.equal((pres.match(/<p:sldId /g) || []).length, 12);
  const banned = ['دليل الاستخدام', '[اسم', 'بيانات توضيحية', '[عنوان', '[وصف', '[قيمة', '[المرحلة', 'lorem'];
  const live = new Set([...pres.matchAll(/r:id="(rId\d+)"/g)].map((m) => m[1]));
  assert.ok(live.size >= 12);
  for (const [name, xml] of slides) {
    for (const b of banned) assert.ok(!xml.includes(b), `${name} still contains ${b}`);
  }
});

test('deck: every screenshot slot in slots.json is a named picture', { skip: !hasDeck }, () => {
  const slots = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'deck', 'slots.json'), 'utf8'));
  const xml = unzipText(DECK, /^ppt\/slides\/slide\d+\.xml$/).map(([, x]) => x).join('\n');
  assert.ok(Object.keys(slots).length >= 4);
  for (const slot of Object.keys(slots)) assert.ok(xml.includes(`name="SLOT:${slot}"`), slot);
});

test('deck: tokens are whole runs, and every token is listed in values.json', { skip: !hasDeck }, () => {
  const xml = unzipText(DECK, /^ppt\/(slides|notesSlides)\/\w+\.xml$/).map(([, x]) => x).join('\n');
  const tokens = findTokens(xml);
  const values = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'deck', 'values.json'), 'utf8')).tokens;
  for (const t of tokens) assert.ok(t in values, `values.json is missing ${t}`);
  assert.ok(!/\{\{[^}<]*<\/a:t>/.test(xml), 'a token is split across runs');
});

test('fill: unmeasured KPI shows a dash, never a number; values are XML-escaped', () => {
  const out = replaceTokens('<a:t>{{STUDY_N}}</a:t><a:t>{{STUDY_RESULTS}}</a:t><a:t>{{LIVE_URL}}</a:t>', {});
  assert.ok(KPI_TOKENS.has('STUDY_N'));
  assert.ok(out.includes(`<a:t>${PENDING.dash}</a:t>`));
  assert.ok(!/\d/.test(out.replace('{{LIVE_URL}}', '')));
  assert.ok(out.includes('{{LIVE_URL}}'), 'a missing URL stays visibly unfilled');
  assert.equal(replaceTokens('{{LIVE_URL}}', { LIVE_URL: 'https://a.b/?x=1&y=<2>' }), xmlEscape('https://a.b/?x=1&y=<2>'));
});

test('fill: parses node:test and SOURCES.md summaries', () => {
  assert.deepEqual(parseTestSummary('ℹ tests 605\nℹ suites 53\nℹ pass 604\nℹ fail 1\n'), { total: 605, pass: 604, fail: 1 });
  assert.equal(parseTestSummary('nothing'), null);
  assert.deepEqual(parseSourcesSummary('| **Total** | **246** | **128** | **118** |'), { total: 246, verified: 128 });
  const md = fs.readFileSync(path.join(ROOT, 'docs', 'SOURCES.md'), 'utf8');
  assert.ok(parseSourcesSummary(md), 'docs/SOURCES.md summary row format changed — update fill.mjs');
});
