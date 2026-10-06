// Judge-facing documentation: README, DEPLOY, OPERATIONS, VIDEO_SCRIPT stay complete, honest and link-safe.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const README = read('README.md');

/** Local markdown links / src= targets of a file, resolved relative to that file. */
function localLinks(file) {
  const md = read(file);
  return [...md.matchAll(/\]\(([^)\s]+)\)|src="([^"]+)"/g)]
    .map((m) => m[1] || m[2])
    .filter((u) => !/^(https?:|#|mailto:|\{\{)/.test(u))
    .map((u) => path.join(path.dirname(path.join(ROOT, file)), decodeURIComponent(u.split('#')[0])));
}

describe('judge documentation', () => {
  test('the new docs exist', () => {
    for (const f of ['docs/DEPLOY.md', 'docs/OPERATIONS.md', 'docs/VIDEO_SCRIPT.md']) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  });

  test('README links are filled (or still show the integrator marker), never stale placeholders', () => {
    for (const [m, label] of [['{{LIVE_URL}}', 'Live demo'], ['{{VIDEO_URL}}', 'Video'], ['{{DECK_URL}}', 'Deck']]) {
      const row = README.split('\n').find((l) => l.includes(label)) || '';
      assert.ok(row.includes(m) || /https:\/\/\S+/.test(row) || /submission form/.test(row), `${label}: marker, a real https link, or 'attached to the submission form'`);
    }
    assert.doesNotMatch(README, /_TBD>|<LIVE_URL|<VIDEO_URL|<DECK_TBD/);
  });

  test('README judge section has the deep links and keeps the honesty disclaimers', () => {
    for (const s of ['?scene=town&nointro=1', '?scene=mosque', '?scene=bank', '?study=1', '/experts', '/results.html']) assert.ok(README.includes(s), s);
    assert.match(README, /not a fatwa/i);
    assert.match(README, /pending scholarly review|have not been reviewed by a human scholar|No human scholar has reviewed/i);
    assert.match(README, /AI coding agents/);
    assert.match(README, /Abubakr Abusham/);
    assert.match(README, /Mohamed Al-Mubarak/);
    assert.match(README, /```mermaid/);
  });

  test('no secret-looking values in the docs', () => {
    for (const f of ['README.md', 'docs/DEPLOY.md', 'docs/OPERATIONS.md', 'docs/VIDEO_SCRIPT.md']) {
      const t = read(f);
      assert.doesNotMatch(t, /sk-ant-[A-Za-z0-9_-]{8,}/, f);
      assert.doesNotMatch(t, /AIza[0-9A-Za-z_-]{20,}/, f);
    }
  });

  test('local links in DEPLOY / OPERATIONS / VIDEO_SCRIPT resolve', () => {
    for (const f of ['docs/DEPLOY.md', 'docs/OPERATIONS.md', 'docs/VIDEO_SCRIPT.md']) {
      const missing = localLinks(f).filter((p) => !fs.existsSync(p));
      assert.deepEqual(missing, [], f);
    }
  });

  test('video shot list fits in 115 seconds and every row matches its time range', () => {
    const rows = read('docs/VIDEO_SCRIPT.md').split('\n').filter((l) => /^\|\s*\d+\s*\|\s*\d:\d\d–\d:\d\d/.test(l));
    assert.ok(rows.length >= 8, 'shot rows');
    const sec = (s) => { const [m, x] = s.split(':').map(Number); return m * 60 + x; };
    let total = 0, prevEnd = 0;
    for (const r of rows) {
      const cells = r.split('|').map((c) => c.trim());
      const [a, b] = cells[2].split('–').map(sec);
      const n = Number(cells[3]);
      assert.equal(a, prevEnd, `contiguous at ${cells[2]}`);
      assert.equal(b - a, n, `seconds column at ${cells[2]}`);
      prevEnd = b; total += n;
    }
    assert.ok(total <= 115, `total ${total}s`);
  });

  test('DEPLOY covers the Cloud Run essentials', () => {
    const d = read('docs/DEPLOY.md');
    for (const s of ['gcloud run deploy', '--source', 'us-central1', '--min-instances 1', 'ANTHROPIC_API_KEY', 'EXPERTS_PASSCODE', 'SESSION_SECRET', 'STORE=firestore', 'Secret Manager']) {
      assert.ok(d.includes(s), s);
    }
  });

  test('OPERATIONS labels its cost figures as estimates and claims no partnership', () => {
    const o = read('docs/OPERATIONS.md');
    assert.match(o, /estimate/i);
    assert.match(o, /no signed partner/i);
    for (const s of ['Claude', 'quranenc', 'Web Speech', 'fallback']) assert.ok(o.toLowerCase().includes(s.toLowerCase()), s);
  });
});
