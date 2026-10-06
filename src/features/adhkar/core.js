// «يومك» adhkar feature — pure logic (no DOM, no JSON import) so it can be tested in node.
// Data lives in content/adhkar/adhkar.json (built from Hisn al-Muslim + six-books check + dorar.net records).

export const TABS = ['morning', 'evening', 'daily'];
export const ALLOWED_GRADES = ['صحيح', 'حسن', 'حسن صحيح', 'صحيح لغيره', 'حسن لغيره'];

/**
 * Which tab to open by default.
 * With prayer times ({ fajr, dhuhr, asr } as Date): morning from Fajr until Dhuhr, evening from Asr until next Fajr,
 * daily in between. Without them: local hour < 12 → morning, ≥ 15 → evening, else daily.
 */
export function defaultTab(now = new Date(), times = null) {
  const t = +now;
  if (times && times.fajr && times.dhuhr && times.asr) {
    if (t >= +times.fajr && t < +times.dhuhr) return 'morning';
    if (t >= +times.asr || t < +times.fajr) return 'evening';
    return 'daily';
  }
  const h = now.getHours();
  if (h < 12) return h < 4 ? 'evening' : 'morning';
  if (h >= 15) return 'evening';
  return 'daily';
}

/** Items shown in a tab: 'both' items appear in morning and evening. Keeps file order. */
export function itemsForTab(items, tab) {
  return items.filter((it) => (tab === 'daily' ? it.tab === 'daily' : it.tab === tab || it.tab === 'both'));
}

/** Counter key: a 'both' item is recited separately in the morning and in the evening, so it counts per tab. */
export const counterKey = (item, tab) => (item.tab === 'both' ? `${tab}:${item.id}` : item.id);
/** Items of a tab with their counter key attached (does not mutate the data). */
export function keyedForTab(items, tab) {
  return itemsForTab(items, tab).map((it) => ({ ...it, key: counterKey(it, tab) }));
}

/** Arabic text to show for an item in a tab (evening wording only where the source supplies it). */
export function textFor(item, tab) {
  return { main: item.text_ar, eveningNote: tab === 'evening' && item.evening ? item.evening : null };
}

/** For multi-phrase counters (33/33/34): which phrase the n-th tap (0-based count done) is on. */
export function segmentAt(item, done) {
  if (!Array.isArray(item.segments) || !item.segments.length) return null;
  let acc = 0;
  for (let i = 0; i < item.segments.length; i++) {
    const s = item.segments[i];
    if (done < acc + s.count) return { index: i, phrase: s.ar, at: done - acc, of: s.count };
    acc += s.count;
  }
  const last = item.segments[item.segments.length - 1];
  return { index: item.segments.length - 1, phrase: last.ar, at: last.count, of: last.count };
}

/** Counter state helpers. state: { [itemId]: doneCount } */
const K = (item) => item.key || item.id;
export function tap(state, item) {
  const done = Math.min((state[K(item)] || 0) + 1, item.repeat);
  return { ...state, [K(item)]: done };
}
export function countOf(state, item) { return state[K(item)] || 0; }
export function remaining(state, item) { return Math.max(0, item.repeat - countOf(state, item)); }
export function isDone(state, item) { return remaining(state, item) === 0; }
export function progress(state, items) {
  const done = items.filter((it) => isDone(state, it)).length;
  return { done, total: items.length };
}

/** Local calendar day key, so counters reset each day. */
export function dayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Arabic-Indic digits for the Arabic UI. */
export function digits(n, lang) {
  const s = String(n);
  return lang === 'ar' ? s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : s;
}
