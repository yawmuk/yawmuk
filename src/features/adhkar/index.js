// «يومك» adhkar feature: morning / evening / daily remembrance with tap counters, references and grades.
// Contract: open({ lang, onClose }) -> close().
// Content: content/adhkar/adhkar.json — quoted from Hisn al-Muslim; every item carries book+number, grade, grader,
// and links (sunnah.com, dorar.net, QuranEnc). No religious text is generated or typed in this file.
import './adhkar.css';
import data from '../../../content/adhkar/adhkar.json';
import { TABS, defaultTab, keyedForTab, tap, remaining, isDone, progress, dayKey, digits, segmentAt, countOf } from './core.js';
import { S, SURAH, tr } from './strings.js';

const STORE_KEY = 'yk-adhkar-progress';

// ---------- per-day counter state (browser storage is a convenience only; failures are ignored) ----------
function loadState(today) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return raw && raw.day === today && raw.counts ? raw.counts : {};
  } catch { return {}; }
}
function saveState(today, counts) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ day: today, counts })); } catch { /* private mode */ }
}

// ---------- tiny DOM helper ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const L = (obj, lang) => (obj ? (obj[lang] ?? obj.en ?? obj.ar ?? '') : '');
const extLink = (href, label) => h('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'yk-adhkar-link' }, label);

async function prayerTimesNow() {
  // Optional: use the prayer feature's location + times so "morning/evening" follows Fajr/Dhuhr/Asr.
  try {
    const [p, t] = await Promise.all([import('../prayer/index.js'), import('../prayer/times.js')]);
    const loc = p.activeLocation();
    return { times: t.computeTimes(loc, new Date()), name: loc.name || null };
  } catch { return null; }
}

let current = null;

export function open({ lang = 'ar', onClose } = {}) {
  if (current) current.close();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const today = dayKey(new Date());
  let counts = loadState(today);
  let tab = defaultTab(new Date());
  const suggested = { tab };
  const opener = document.activeElement;
  let audio = null;
  let playingBtn = null;
  let showTr = lang === 'en';

  const titleId = 'yk-adhkar-title';
  const listEl = h('div', { class: 'yk-adhkar-list', role: 'tabpanel', tabindex: '-1' });
  const progressEl = h('div', { class: 'yk-adhkar-progress', role: 'status', 'aria-live': 'polite' });
  const suggestEl = h('p', { class: 'yk-adhkar-suggest' });
  let suggestBasis = null; // prayer-location name once known
  function renderSuggest() {
    const t = data.tabs.find((x) => x.id === suggested.tab);
    const basis = suggestBasis ? tr('basisPrayer', lang, { c: L(suggestBasis, lang) }) : tr('basisClock', lang);
    suggestEl.textContent = `${tr('suggested', lang)}: ${L(t.label, lang)} (${basis})`;
  }
  const tabBtns = {};
  const tablist = h('div', { class: 'yk-adhkar-tabs', role: 'tablist', 'aria-label': tr('tabs', lang) },
    TABS.map((id) => {
      const t = data.tabs.find((x) => x.id === id);
      const b = h('button', { type: 'button', role: 'tab', id: `yk-adhkar-tab-${id}`, class: 'yk-adhkar-tab', onclick: () => setTab(id) },
        h('span', { class: 'yk-adhkar-tab-label' }, L(t.label, lang)),
        h('span', { class: 'yk-adhkar-tab-badge', 'aria-hidden': 'true' }));
      tabBtns[id] = b;
      return b;
    }));
  tablist.addEventListener('keydown', (e) => {
    const i = TABS.indexOf(tab);
    const fwd = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let n = null;
    if (e.key === fwd) n = TABS[(i + 1) % TABS.length];
    else if (e.key === back) n = TABS[(i + TABS.length - 1) % TABS.length];
    else if (e.key === 'Home') n = TABS[0];
    else if (e.key === 'End') n = TABS[TABS.length - 1];
    if (n) { e.preventDefault(); setTab(n); tabBtns[n].focus(); }
  });

  const trToggle = h('button', { type: 'button', class: 'yk-adhkar-chip', 'aria-pressed': String(showTr), onclick: () => {
    showTr = !showTr; trToggle.setAttribute('aria-pressed', String(showTr));
    trToggle.textContent = showTr ? tr('hideTranslation', lang) : tr('showTranslation', lang);
    panel.classList.toggle('yk-adhkar-show-tr', showTr);
  } }, showTr ? tr('hideTranslation', lang) : tr('showTranslation', lang));
  const resetBtn = h('button', { type: 'button', class: 'yk-adhkar-chip', onclick: () => {
    const ids = new Set(keyedForTab(data.items, tab).map((i) => i.key));
    counts = Object.fromEntries(Object.entries(counts).filter(([k]) => !ids.has(k)));
    saveState(today, counts); render();
  } }, tr('reset', lang));

  const closeBtn = h('button', { type: 'button', class: 'yk-adhkar-close', 'aria-label': tr('close', lang), onclick: () => close() }, '×');

  const about = h('details', { class: 'yk-adhkar-about' },
    h('summary', {}, tr('howVerified', lang)),
    h('p', {}, tr('howVerifiedBody', lang)),
    h('p', { class: 'yk-adhkar-muted' }, L(data.meta.disclosure, lang)),
    h('h3', {}, tr('excludedTitle', lang)),
    h('ul', { class: 'yk-adhkar-excluded' }, data.meta.excluded.map((x) => h('li', { dir: 'auto' }, x.reason))),
    h('p', { class: 'yk-adhkar-muted' }, tr('disclaimer', lang)));

  const panel = h('section', { class: `yk-adhkar-panel${showTr ? ' yk-adhkar-show-tr' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, dir, lang },
    h('header', { class: 'yk-adhkar-head' },
      h('div', { class: 'yk-adhkar-head-text' },
        h('h2', { id: titleId, class: 'yk-adhkar-title' }, tr('title', lang)),
        h('p', { class: 'yk-adhkar-sub' }, tr('subtitle', lang))),
      closeBtn),
    tablist,
    suggestEl,
    h('div', { class: 'yk-adhkar-toolbar' }, progressEl, h('div', { class: 'yk-adhkar-tools' }, trToggle, resetBtn)),
    listEl,
    about);
  const backdrop = h('div', { class: 'yk-adhkar-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } }, panel);

  function stopAudio() {
    if (audio) { try { audio.pause(); } catch { /* ignore */ } }
    if (playingBtn) { playingBtn.textContent = tr('listen', lang); playingBtn.setAttribute('aria-pressed', 'false'); playingBtn = null; }
  }
  function toggleAudio(btn, url) {
    if (playingBtn === btn) { stopAudio(); return; }
    stopAudio();
    if (typeof Audio === 'undefined') return;
    if (!audio) { audio = new Audio(); audio.preload = 'none'; audio.addEventListener('ended', () => stopAudio()); }
    audio.src = url;
    const p = audio.play();
    playingBtn = btn; btn.textContent = tr('pause', lang); btn.setAttribute('aria-pressed', 'true');
    if (p && p.catch) p.catch(() => { btn.textContent = tr('audioError', lang); playingBtn = null; });
  }

  function counterLabel(item) {
    const r = remaining(counts, item);
    return tr('counterLabel', lang, { r: digits(r, lang), n: digits(item.repeat, lang) });
  }

  function refBlock(item) {
    const rows = item.refs.map((r) => h('li', { class: 'yk-adhkar-ref' },
      h('span', { class: 'yk-adhkar-ref-book' }, `${lang === 'ar' ? r.book_ar : r.book_en} ${digits(r.number, lang)}`),
      h('span', { class: `yk-adhkar-grade yk-adhkar-grade-${/حسن/.test(r.grade) && !/^صحيح$/.test(r.grade) ? 'hasan' : 'sahih'}` }, r.grade),
      h('span', { class: 'yk-adhkar-ref-grader' }, `${tr('grader', lang)}: ${r.grader}`),
      r.dorar ? h('span', { class: 'yk-adhkar-ref-dorar', dir: 'rtl' }, `${tr('dorarRecord', lang)}: ${r.dorar.muhaddith} — ${r.dorar.source} ${r.dorar.number} — ${r.dorar.grade}`) : null,
      h('span', { class: 'yk-adhkar-ref-links' },
        extLink(r.sunnah_url, tr('openSunnah', lang)),
        extLink(r.dorar ? r.dorar.search_url : r.dorar_search_url, tr('openDorar', lang)))));
    const extra = item.dorar_extra ? h('li', { class: 'yk-adhkar-ref' },
      h('span', { class: 'yk-adhkar-ref-dorar', dir: 'rtl' }, `${tr('dorarRecord', lang)}: ${item.dorar_extra.muhaddith} — ${item.dorar_extra.source} ${item.dorar_extra.number} — ${item.dorar_extra.grade}`),
      h('span', { class: 'yk-adhkar-ref-links' }, extLink(item.dorar_extra.search_url, tr('openDorar', lang)))) : null;
    const quranLinks = item.quran ? h('li', { class: 'yk-adhkar-ref' }, item.quran.map((q) => extLink(q.source_url, `${tr('openQuran', lang)} — ${tr('ayah', lang, { s: L(SURAH[q.sura], lang) })}`))) : null;
    return h('details', { class: 'yk-adhkar-refs' },
      h('summary', {}, tr('reference', lang), ' · ', h('span', { class: 'yk-adhkar-muted' }, tr('hisn', lang, { n: digits(item.hisn.item_id, lang) }))),
      h('ul', {}, rows, extra, quranLinks,
        h('li', { class: 'yk-adhkar-ref' }, extLink(item.hisn.source_url_ar, 'hisnmuslim.com (ar)'), ' ', extLink(item.hisn.source_url_en, 'hisnmuslim.com (en)'))),
      item.notes ? h('p', { class: 'yk-adhkar-muted', dir: 'ltr', lang: 'en' }, item.notes) : null,
      item.erratum ? h('p', { class: 'yk-adhkar-muted', dir: 'ltr', lang: 'en' }, item.erratum) : null);
  }

  function arabicBody(item) {
    if (item.kind === 'quran') {
      return h('div', { class: 'yk-adhkar-quran', lang: 'ar', dir: 'rtl' },
        item.instruction ? h('p', { class: 'yk-adhkar-instr' }, item.instruction.ar) : null,
        item.quran.map((s) => h('div', { class: 'yk-adhkar-surah' },
          h('div', { class: 'yk-adhkar-surah-name' }, `${tr('ayah', 'ar', { s: SURAH[s.sura].ar })}`),
          h('p', { class: 'yk-adhkar-quran-text' }, s.ayat.map((a) => [a.text_ar, h('span', { class: 'yk-adhkar-aya-no', 'aria-hidden': 'true' }, ` ﴿${digits(a.aya, 'ar')}﴾ `)])))));
    }
    return h('p', { class: 'yk-adhkar-text', lang: 'ar', dir: 'rtl' }, item.text_ar);
  }

  function card(item, idx, list) {
    const r = remaining(counts, item);
    const done = r === 0;
    const seg = segmentAt(item, countOf(counts, item));
    const counter = h('button', {
      type: 'button', class: 'yk-adhkar-counter', 'aria-label': counterLabel(item), 'aria-describedby': `yk-adhkar-occ-${item.id}`,
      disabled: done ? true : null,
      onclick: () => {
        counts = tap(counts, item); saveState(today, counts);
        try { if (navigator.vibrate) navigator.vibrate(12); } catch { /* ignore */ }
        const nowDone = isDone(counts, item);
        render(item.id);
        if (nowDone) {
          const next = list.slice(idx + 1).find((it) => !isDone(counts, it));
          const target = next && listEl.querySelector(`[data-id="${next.id}"] .yk-adhkar-counter`);
          if (target) { target.focus({ preventScroll: true }); target.closest('.yk-adhkar-card').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        } else {
          const again = listEl.querySelector(`[data-id="${item.id}"] .yk-adhkar-counter`);
          if (again) again.focus({ preventScroll: true });
        }
      },
    },
    done ? h('span', { class: 'yk-adhkar-check', 'aria-hidden': 'true' }, '✓') : h('span', { class: 'yk-adhkar-count', 'aria-hidden': 'true' }, digits(r, lang)),
    h('span', { class: 'yk-adhkar-count-of', 'aria-hidden': 'true' }, done ? tr('done', lang) : `/ ${digits(item.repeat, lang)}`));
    const ring = h('div', { class: 'yk-adhkar-ring', style: `--p:${((item.repeat - r) / item.repeat).toFixed(3)}` }, counter);

    const evening = tab === 'evening' && item.evening ? h('div', { class: 'yk-adhkar-evening' },
      h('span', { class: 'yk-adhkar-label' }, tr('evening', lang)),
      h('p', { class: 'yk-adhkar-text yk-adhkar-text-sm', lang: 'ar', dir: 'rtl' }, item.evening.ar),
      h('p', { class: 'yk-adhkar-tr', lang: 'en', dir: 'ltr' }, item.evening.en)) : null;

    const audioBtn = item.hisn.audio_url ? h('button', { type: 'button', class: 'yk-adhkar-chip yk-adhkar-audio', 'aria-pressed': 'false', title: tr('audioCredit', lang), onclick: (e) => toggleAudio(e.currentTarget, item.hisn.audio_url) }, tr('listen', lang)) : null;

    const repeatTxt = item.repeat === 1 ? tr('once', lang) : `${digits(item.repeat, lang)} ${tr('times', lang)}`;
    return h('article', { class: `yk-adhkar-card${done ? ' is-done' : ''}${item.kind === 'quran' ? ' is-quran' : ''}`, 'data-id': item.id },
      h('div', { class: 'yk-adhkar-card-top' },
        h('span', { class: 'yk-adhkar-occ', id: `yk-adhkar-occ-${item.id}` }, L(item.occasion, lang), ' · ', repeatTxt),
        item.kind === 'quran' ? h('span', { class: 'yk-adhkar-tag' }, tr('quranLabel', lang)) : null,
        audioBtn),
      arabicBody(item),
      seg && !done ? h('p', { class: 'yk-adhkar-seg', lang: 'ar', dir: 'rtl', 'aria-live': 'polite' }, `${seg.phrase} — ${digits(seg.at, 'ar')}/${digits(seg.of, 'ar')}`) : null,
      evening,
      h('div', { class: 'yk-adhkar-trblock' },
        h('span', { class: 'yk-adhkar-label' }, L(item.translation_label, lang)),
        h('p', { class: 'yk-adhkar-tr', lang: 'en', dir: 'ltr' }, item.text_en),
        item.instruction && item.instruction.en ? h('p', { class: 'yk-adhkar-tr yk-adhkar-muted', lang: 'en', dir: 'ltr' }, item.instruction.en) : null,
        item.translit ? h('p', { class: 'yk-adhkar-translit', lang: 'en', dir: 'ltr' }, h('span', { class: 'yk-adhkar-label' }, tr('translit', lang)), ' ', item.translit) : null),
      item.virtue ? h('div', { class: 'yk-adhkar-virtue' },
        h('span', { class: 'yk-adhkar-label' }, tr('virtue', lang)),
        h('p', { class: 'yk-adhkar-text yk-adhkar-text-sm', lang: 'ar', dir: 'rtl' }, `«${item.virtue.ar}»`),
        h('p', { class: 'yk-adhkar-tr', lang: 'en', dir: 'ltr' }, item.virtue.en)) : null,
      item.repeat_note || item.grade_note ? h('div', { class: 'yk-adhkar-note' },
        h('span', { class: 'yk-adhkar-label' }, tr('note', lang)),
        item.repeat_note ? h('p', {}, L(item.repeat_note, lang)) : null,
        item.grade_note ? h('p', {}, L(item.grade_note, lang)) : null) : null,
      h('div', { class: 'yk-adhkar-card-foot' }, ring, refBlock(item)));
  }

  function render(keepId) {
    const list = keyedForTab(data.items, tab);
    for (const id of TABS) {
      const sel = id === tab;
      tabBtns[id].setAttribute('aria-selected', String(sel));
      tabBtns[id].setAttribute('tabindex', sel ? '0' : '-1');
      tabBtns[id].classList.toggle('is-suggested', id === suggested.tab);
      const pr = progress(counts, keyedForTab(data.items, id));
      tabBtns[id].querySelector('.yk-adhkar-tab-badge').textContent = `${digits(pr.done, lang)}/${digits(pr.total, lang)}`;
      if (id === suggested.tab) tabBtns[id].setAttribute('title', tr('suggested', lang));
    }
    listEl.setAttribute('aria-labelledby', `yk-adhkar-tab-${tab}`);
    const scroll = listEl.scrollTop;
    listEl.replaceChildren(...list.map((it, i) => card(it, i, list)));
    if (keepId) listEl.scrollTop = scroll;
    const pr = progress(counts, list);
    progressEl.replaceChildren(
      h('span', {}, pr.done === pr.total ? tr('allDone', lang) : tr('progress', lang, { d: digits(pr.done, lang), t: digits(pr.total, lang) })),
      h('span', { class: 'yk-adhkar-bar', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round((pr.done / pr.total) * 100)}%` })));
  }
  function setTab(id) { if (!TABS.includes(id)) return; stopAudio(); tab = id; render(); listEl.scrollTop = 0; }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll('button:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    stopAudio();
    document.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    if (current && current.close === close) current = null;
    try { if (opener && opener.focus) opener.focus(); } catch { /* ignore */ }
    if (typeof onClose === 'function') onClose();
  }

  document.addEventListener('keydown', onKey, true);
  document.body.append(backdrop);
  render();
  renderSuggest();
  (tabBtns[tab] || closeBtn).focus();

  // refine the suggested tab with real prayer times (Fajr/Dhuhr/Asr) when the prayer feature is present
  prayerTimesNow().then((res) => {
    if (closed || !res) return;
    suggestBasis = res.name;
    const t = defaultTab(new Date(), res.times);
    renderSuggest();
    if (t !== suggested.tab) {
      const untouched = tab === suggested.tab && !Object.keys(counts).length;
      suggested.tab = t;
      renderSuggest();
      if (untouched) setTab(t); else render();
    }
  });

  current = { close };
  return close;
}

export default { open };
