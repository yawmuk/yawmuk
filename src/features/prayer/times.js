// Pure prayer-time logic for «يومك» — no DOM, no audio, no network.
// Computation is done locally with adhan-js (MIT licence, github.com/batoulapps/adhan-js).
// Times returned are absolute instants (Date); display them with the location's IANA time zone.
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const ALL_TIMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const METHODS = {
  NorthAmerica: { ar: 'الجمعية الإسلامية لأمريكا الشمالية (ISNA) — الفجر والعشاء ١٥°', en: 'Islamic Society of North America (ISNA) — Fajr & Isha 15°' },
  UmmAlQura: { ar: 'تقويم أم القرى (مكة المكرمة) — الفجر ١٨٫٥°، العشاء بعد المغرب بـ٩٠ دقيقة', en: 'Umm al-Qura (Makkah) — Fajr 18.5°, Isha 90 min after Maghrib' },
  MuslimWorldLeague: { ar: 'رابطة العالم الإسلامي — الفجر ١٨°، العشاء ١٧°', en: 'Muslim World League — Fajr 18°, Isha 17°' },
  Egyptian: { ar: 'الهيئة المصرية العامة للمساحة — الفجر ١٩٫٥°، العشاء ١٧٫٥°', en: 'Egyptian General Authority of Survey — Fajr 19.5°, Isha 17.5°' }
};

export const LOCATIONS = {
  columbus: { id: 'columbus', lat: 39.9612, lng: -82.9988, tz: 'America/New_York', method: 'NorthAmerica', name: { ar: 'كولومبس، أوهايو', en: 'Columbus, Ohio' } },
  makkah: { id: 'makkah', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh', method: 'UmmAlQura', name: { ar: 'مكة المكرمة', en: 'Makkah' } },
  riyadh: { id: 'riyadh', lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh', method: 'UmmAlQura', name: { ar: 'الرياض', en: 'Riyadh' } }
};
export const DEFAULT_LOCATION = 'columbus';

/** Round a coordinate for privacy (2 decimals ≈ 1 km — city level, enough for prayer times). */
export const roundCoord = (x) => Math.round(Number(x) * 100) / 100;

/** Pick a reasonable default method from an IANA time zone (user can still change it). */
export function methodForTz(tz = '') {
  if (/^America\//.test(tz)) return 'NorthAmerica';
  if (/^Asia\/(Riyadh|Aden|Qatar|Bahrain|Kuwait|Dubai|Muscat)$/.test(tz)) return 'UmmAlQura';
  if (tz === 'Africa/Cairo') return 'Egyptian';
  return 'MuslimWorldLeague';
}

/** Calendar date (y, m, d) of `instant` as seen in time zone `tz`. */
export function ymdInTz(instant, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: get('year'), m: get('month'), d: get('day') };
}
export const dayKey = (instant, tz) => { const { y, m, d } = ymdInTz(instant, tz); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };

/**
 * Prayer times for the calendar day that `date` falls on in `loc.tz`.
 * adhan-js reads the host-local Y/M/D of the Date it is given, so we build that Date from the
 * location's calendar date — correct no matter which time zone the player's device is in.
 */
export function computeTimes(loc, date = new Date(), dayOffset = 0) {
  const { y, m, d } = ymdInTz(date, loc.tz);
  const localDay = new Date(y, m - 1, d + dayOffset, 12);
  const methodFn = CalculationMethod[loc.method] || CalculationMethod.MuslimWorldLeague;
  const params = methodFn();
  params.madhab = Madhab.Shafi; // Asr when an object's shadow equals its length (the majority view)
  const pt = new PrayerTimes(new Coordinates(loc.lat, loc.lng), localDay, params);
  const out = {};
  for (const k of ALL_TIMES) out[k] = pt[k];
  return out;
}

/**
 * Next obligatory prayer after `now` (sunrise is never returned: it is not a prayer and has no adhan).
 * After Isha, rolls over to tomorrow's Fajr. Returns { prayer, time, msLeft }.
 */
export function nextPrayer(loc, now = new Date()) {
  const today = computeTimes(loc, now);
  for (const p of PRAYERS) if (today[p] > now) return { prayer: p, time: today[p], msLeft: today[p] - now };
  const tomorrow = computeTimes(loc, now, 1);
  return { prayer: 'fajr', time: tomorrow.fajr, msLeft: tomorrow.fajr - now };
}

/** The obligatory prayer whose time most recently began (null before today's Fajr). */
export function currentPrayer(loc, now = new Date()) {
  const today = computeTimes(loc, now);
  let cur = null;
  for (const p of PRAYERS) if (today[p] <= now) cur = p;
  return cur;
}

/**
 * Prayers whose adhan should start now: began within `windowMs` before `now` and not yet in `fired`.
 * A window (instead of exact equality) keeps throttled background tabs from missing the adhan.
 */
export function duePrayers(loc, now = new Date(), fired = new Set(), windowMs = 5 * 60 * 1000) {
  const today = computeTimes(loc, now);
  const key = dayKey(now, loc.tz);
  return PRAYERS.filter((p) => today[p] <= now && now - today[p] < windowMs && !fired.has(`${key}:${p}`)).map((p) => ({ prayer: p, key: `${key}:${p}`, time: today[p] }));
}

export function formatTime(instant, tz, lang = 'ar') {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(instant);
}
export function formatClock(instant, tz, lang = 'ar') {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(instant);
}
/** hh:mm:ss countdown (always Latin digits, LTR-isolated by the UI). */
export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${h}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
export function formatHijri(instant, tz, lang = 'ar') {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-US-u-ca-islamic-umalqura', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(instant);
  } catch { return ''; }
}
