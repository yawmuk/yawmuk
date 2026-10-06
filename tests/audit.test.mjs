// Wrapper around the independent citation verifier (tools/audit/verify.mjs).
// verify.mjs re-fetches every ayah (api.quran.com + Tanzil) and every six-book hadith (hadith-api) and
// compares them letter-by-letter (with harakat) to content/rulings. It caches downloads in
// tools/audit/.cache/. Offline-tolerant: exit code 2 (network/setup error) => the test is SKIPPED with a
// clear message; exit code 1 (a citation mismatch) => FAIL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './helpers/content.mjs';

test('tools/audit/verify.mjs: every Quran/hadith text matches its source', (t) => {
  if (process.env.SKIP_AUDIT === '1') { t.skip('SKIP_AUDIT=1'); return; }
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/audit/verify.mjs'), '--quiet'], { cwd: ROOT, encoding: 'utf8', timeout: 240000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.error?.code === 'ETIMEDOUT' || r.signal) { t.skip(`verify.mjs timed out (slow/no network?) — skipped. Run "node tools/audit/verify.mjs" manually.`); return; }
  if (r.status === 2) { t.skip(`verify.mjs could not reach its sources and has no cache (offline) — skipped.\n${out.split('\n').slice(0, 3).join('\n')}`); return; }
  const summary = out.split('\n').filter((l) => /checks:|Summary|FAIL/.test(l)).slice(0, 12).join('\n');
  t.diagnostic(summary);
  assert.equal(r.status, 0, `verify.mjs reported failures:\n${summary || out.slice(-2000)}`);
  assert.match(out, /FAIL 0/);
});
