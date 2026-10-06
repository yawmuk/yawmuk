// Prayer feature: local prayer-time computation (adhan-js), next-prayer logic, adhan triggering,
// level-أ content safety and "no network" guarantees. Pure node:test, no browser, no network.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCATIONS, PRAYERS, METHODS, computeTimes, nextPrayer, currentPrayer, duePrayers, dayKey, ymdInTz, roundCoord, methodForTz, formatCountdown, formatTime } from '../src/features/prayer/times.js';
import { S, NAMES, EXPLAIN, DORAR, ADHAN_CREDIT } from '../src/features/prayer/strings.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hm = (d, tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
// An instant at a given wall-clock time in a zone (good enough for zones without a DST change on that day).
const at = (iso, offset) => new Date(`${iso}${offset}`);

// Expected values = adhan-js 4.4.x output for 2026-10-06 (cross-checked against api.aladhan.com, same methods:
// all times equal except Columbus Dhuhr +1 min / Asr −2 min and Makkah/Riyadh Asr −1 min — rounding/parameter differences).
const EXPECTED = {
  columbus: { fajr: '06:19', sunrise: '07:33', dhuhr: '13:21', asr: '16:33', maghrib: '19:06', isha: '20:20' },
  makkah: { fajr: '04:57', sunrise: '06:13', dhuhr: '12:09', asr: '15:31', maghrib: '18:04', isha: '19:34' },
  riyadh: { fajr: '04:29', sunrise: '05:47', dhuhr: '11:41', asr: '15:03', maghrib: '17:35', isha: '19:05' }
};
const NOON = { columbus: at('2026-10-06T12:00:00', '-04:00'), makkah: at('2026-10-06T12:00:00', '+03:00'), riyadh: at('2026-10-06T12:00:00', '+03:00') };

describe('prayer times (adhan-js, computed locally)', () => {
  for (const [id, exp] of Object.entries(EXPECTED)) {
    test(`${id}: 2026-10-06 times match the expected adhan-js values`, () => {
      const loc = LOCATIONS[id];
      const t = computeTimes(loc, NOON[id]);
      for (const [k, v] of Object.entries(exp)) assert.equal(hm(t[k], loc.tz), v, `${id} ${k}`);
    });
  }
  test('times are in chronological order', () => {
    for (const id of Object.keys(LOCATIONS)) {
      const t = computeTimes(LOCATIONS[id], NOON[id]);
      const seq = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => t[k].getTime());
      assert.deepEqual([...seq].sort((a, b) => a - b), seq, id);
    }
  });
  test('the location calendar day is used, not the host day (late evening in Columbus = already next day in UTC/Riyadh)', () => {
    const loc = LOCATIONS.columbus;
    const lateEvening = at('2026-10-06T23:30:00', '-04:00'); // 03:30 UTC on Oct 7
    assert.equal(dayKey(lateEvening, loc.tz), '2026-10-06');
    assert.deepEqual(ymdInTz(lateEvening, loc.tz), { y: 2026, m: 10, d: 6 });
    assert.equal(hm(computeTimes(loc, lateEvening).fajr, loc.tz), '06:19');
  });
  test('default location is Columbus, Ohio with the ISNA method; Makkah/Riyadh use Umm al-Qura', () => {
    assert.equal(LOCATIONS.columbus.method, 'NorthAmerica');
    assert.equal(LOCATIONS.columbus.tz, 'America/New_York');
    assert.equal(LOCATIONS.makkah.method, 'UmmAlQura');
    assert.equal(LOCATIONS.riyadh.method, 'UmmAlQura');
    for (const l of Object.values(LOCATIONS)) assert.ok(METHODS[l.method], l.id);
  });
});

describe('next / current prayer', () => {
  const loc = LOCATIONS.columbus;
  test('mid-morning → next is Dhuhr, current is Fajr', () => {
    const now = at('2026-10-06T10:00:00', '-04:00');
    const n = nextPrayer(loc, now);
    assert.equal(n.prayer, 'dhuhr');
    assert.equal(hm(n.time, loc.tz), '13:21');
    assert.equal(n.msLeft, n.time - now);
    assert.equal(currentPrayer(loc, now), 'fajr');
  });
  test('sunrise is never the next prayer (between Fajr and sunrise → Dhuhr)', () => {
    const n = nextPrayer(loc, at('2026-10-06T07:00:00', '-04:00'));
    assert.equal(n.prayer, 'dhuhr');
  });
  test('before Fajr → next is today’s Fajr, no current prayer', () => {
    const now = at('2026-10-06T05:00:00', '-04:00');
    assert.equal(nextPrayer(loc, now).prayer, 'fajr');
    assert.equal(dayKey(nextPrayer(loc, now).time, loc.tz), '2026-10-06');
    assert.equal(currentPrayer(loc, now), null);
  });
  test('after Isha → rolls over to tomorrow’s Fajr with a positive countdown', () => {
    const now = at('2026-10-06T22:00:00', '-04:00');
    const n = nextPrayer(loc, now);
    assert.equal(n.prayer, 'fajr');
    assert.equal(dayKey(n.time, loc.tz), '2026-10-07');
    assert.ok(n.msLeft > 0 && n.msLeft < 10 * 3600 * 1000);
    assert.equal(currentPrayer(loc, now), 'isha');
  });
  test('exactly at a prayer time that prayer is current, and the next one is upcoming', () => {
    const t = computeTimes(loc, NOON.columbus);
    assert.equal(currentPrayer(loc, t.asr), 'asr');
    assert.equal(nextPrayer(loc, t.asr).prayer, 'maghrib');
  });
});

describe('adhan triggering window', () => {
  const loc = LOCATIONS.makkah;
  const t = computeTimes(loc, NOON.makkah);
  test('fires once within 5 minutes after the prayer time, never for sunrise', () => {
    const fired = new Set();
    const due = duePrayers(loc, new Date(t.maghrib.getTime() + 30 * 1000), fired);
    assert.deepEqual(due.map((d) => d.prayer), ['maghrib']);
    fired.add(due[0].key);
    assert.equal(duePrayers(loc, new Date(t.maghrib.getTime() + 60 * 1000), fired).length, 0, 'not twice');
    assert.equal(duePrayers(loc, new Date(t.sunrise.getTime() + 1000), new Set()).length, 0, 'no adhan at sunrise');
  });
  test('does not fire before the time or long after it', () => {
    assert.equal(duePrayers(loc, new Date(t.dhuhr.getTime() - 1000), new Set()).length, 0);
    assert.equal(duePrayers(loc, new Date(t.dhuhr.getTime() + 6 * 60 * 1000), new Set()).length, 0);
  });
  test('fired keys are per calendar day', () => {
    const [d] = duePrayers(loc, new Date(t.fajr.getTime() + 1000), new Set());
    assert.equal(d.key, '2026-10-06:fajr');
  });
});

describe('helpers', () => {
  test('roundCoord keeps city-level precision only', () => {
    assert.equal(roundCoord(39.961178), 39.96);
    assert.equal(roundCoord(-82.998795), -83);
  });
  test('methodForTz picks a sensible default', () => {
    assert.equal(methodForTz('America/Chicago'), 'NorthAmerica');
    assert.equal(methodForTz('Asia/Riyadh'), 'UmmAlQura');
    assert.equal(methodForTz('Africa/Cairo'), 'Egyptian');
    assert.equal(methodForTz('Europe/London'), 'MuslimWorldLeague');
  });
  test('formatCountdown', () => {
    assert.equal(formatCountdown(0), '0:00:00');
    assert.equal(formatCountdown(3723000), '1:02:03');
    assert.equal(formatCountdown(-5), '0:00:00');
  });
  test('formatTime renders in the location time zone with Latin digits', () => {
    const s = formatTime(computeTimes(LOCATIONS.riyadh, NOON.riyadh).fajr, 'Asia/Riyadh', 'ar');
    assert.match(s, /4:29/);
  });
});

describe('content safety & privacy', () => {
  const featureDir = path.join(ROOT, 'src/features/prayer');
  const src = fs.readdirSync(featureDir).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(featureDir, f), 'utf8')).join('\n');
  test('no network calls: no fetch/XHR/beacon/websocket; geolocation never leaves the device', () => {
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/);
    const times = fs.readFileSync(path.join(featureDir, 'times.js'), 'utf8');
    assert.doesNotMatch(times, /https?:\/\//, 'times.js has no URLs at all');
  });
  test('every ar/en string pair is present', () => {
    for (const [k, v] of Object.entries(S)) { assert.ok(v.ar && v.en, `S.${k}`); }
    for (const k of [...PRAYERS, 'sunrise']) assert.ok(NAMES[k].ar && NAMES[k].en, k);
    for (const k of ['intro', ...PRAYERS]) assert.ok(EXPLAIN[k].ar && EXPLAIN[k].en, `EXPLAIN.${k}`);
  });
  test('each explanation links to its dorar.net Fiqh Encyclopedia chapter (approved source)', () => {
    for (const p of PRAYERS) assert.match(DORAR[p], /^https:\/\/dorar\.net\/feqhia\/\d+\//, p);
    for (const u of EXPLAIN.intro.links) assert.match(u, /^https:\/\/dorar\.net\/feqhia\/\d+\//);
  });
  test('explanations contain no quoted scripture (no Quran/hadith text generated from memory)', () => {
    const all = Object.values(EXPLAIN).flatMap((e) => [e.ar, e.en]).join('\n');
    assert.doesNotMatch(all, /[﴿﴾«»"]|قال (الله|رسول|النبي)|صلى الله عليه وسلم|the Prophet said|Allah says/);
  });
  test('location consent text promises local-only use', () => {
    assert.match(S.consent.ar, /لا نرسلها/);
    assert.match(S.consent.en, /never send/);
  });
  test('bundled adhan audio exists, is small, and its licence is recorded', () => {
    const f = path.join(ROOT, 'public/audio/adhan/adhan.mp3');
    assert.ok(fs.existsSync(f), 'adhan.mp3 present');
    assert.ok(fs.statSync(f).size < 1.5 * 1024 * 1024, 'under 1.5 MB');
    const lic = fs.readFileSync(path.join(ROOT, 'public/assets/LICENSES.md'), 'utf8');
    assert.ok(lic.includes(ADHAN_CREDIT.sourceUrl), 'source URL in LICENSES.md');
    assert.ok(lic.includes(ADHAN_CREDIT.license), 'licence in LICENSES.md');
    assert.ok(lic.includes(ADHAN_CREDIT.author), 'author in LICENSES.md');
  });
});
