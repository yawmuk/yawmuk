// «المصحف المرتل مع ترجمة المعاني» — Recited Quran with translation of meanings (opened in the mosque).
// Contract: open({ lang, onClose }) -> close()
// Text: QPC Hafs (King Fahd Complex) from api.quran.com, cross-checked live against quranenc.com.
// Translation / concise tafsir: quranenc.com. Audio: everyayah.com (per ayah).
// Offline: surahs 1, 112, 113, 114 bundled in content/quran/offline.json (fetched by tools/quran/fetch.mjs).
import './quran.css';
import surahsData from '../../../content/quran/surahs.json';
import offlineData from '../../../content/quran/offline.json';
import {
  RECITERS, TRANSLATIONS, DEFAULT_TRANSLATION, OFFLINE_SURAHS, ATTRIBUTION,
  audioUrl, textUrl, translationUrl, mergeVerses, splitFootnotes, quranComLink, quranencLink
} from './lib.js';

const STR = {
  ar: {
    title: 'المصحف المرتل مع ترجمة المعاني',
    sub: 'استمع إلى التلاوة آيةً آية، واقرأ معنى كل آية تحتها.',
    close: 'إغلاق',
    surah: 'السورة',
    reciter: 'القارئ',
    translation: 'المعاني',
    play: 'تشغيل',
    pause: 'إيقاف مؤقت',
    resume: 'متابعة',
    prev: 'الآية السابقة',
    next: 'الآية التالية',
    showTr: 'إظهار المعاني',
    loading: 'جارٍ تحميل السورة…',
    offline: 'متاحة دون اتصال',
    offlineUsed: 'تعذّر الاتصال، فعُرضت النسخة المحفوظة في اللعبة (نُزّلت من المصادر نفسها).',
    errorNet: 'تعذّر تحميل هذه السورة الآن. السور المتاحة دون اتصال: الفاتحة، الإخلاص، الفلق، الناس.',
    retry: 'إعادة المحاولة',
    trMissing: 'تعذّر تحميل المعاني لهذه السورة؛ النص القرآني معروض وحده.',
    verified: 'النص مطابَق بين مصدرين',
    mismatch: 'تنبيه: اختلاف بين نسختي المصدرين في هذه الآية — المعروض نص مجمع الملك فهد',
    single: 'من مصدر واحد',
    nowPlaying: (s, a) => `يُتلى الآن: ${s}، الآية ${toArabicDigits(a)}`,
    basmalaPlaying: 'يُتلى الآن: البسملة',
    stopped: 'توقفت التلاوة.',
    finished: 'انتهت السورة.',
    tapToContinue: 'اضغط «متابعة» لإكمال التلاوة.',
    audioError: 'تعذّر تشغيل التلاوة (تحقق من الاتصال).',
    ayah: 'الآية',
    playFrom: 'استمع من هذه الآية',
    sourceTitle: 'المصادر',
    trNote: 'المعاني المعروضة شرح وترجمة بشرية منشورة، وليست من توليد الذكاء الاصطناعي.',
    openSource: 'افتح الآية في المصدر',
    footnotes: 'حواشي الترجمة',
    version: 'إصدار الترجمة',
    ayahs: 'آية'
  },
  en: {
    title: 'Recited Quran with translation of meanings',
    sub: 'Listen ayah by ayah and read the meaning under each one.',
    close: 'Close',
    surah: 'Surah',
    reciter: 'Reciter',
    translation: 'Meanings',
    play: 'Play',
    pause: 'Pause',
    resume: 'Resume',
    prev: 'Previous ayah',
    next: 'Next ayah',
    showTr: 'Show meanings',
    loading: 'Loading surah…',
    offline: 'available offline',
    offlineUsed: 'No connection — showing the copy bundled with the game (downloaded from the same sources).',
    errorNet: 'Could not load this surah right now. Available offline: Al-Fatihah, Al-Ikhlas, Al-Falaq, An-Nas.',
    retry: 'Retry',
    trMissing: 'Could not load the meanings for this surah; showing the Quran text only.',
    verified: 'Text matched across two sources',
    mismatch: 'Notice: the two source copies differ on this ayah — the King Fahd Complex text is shown',
    single: 'single source',
    nowPlaying: (s, a) => `Now reciting: ${s}, ayah ${a}`,
    basmalaPlaying: 'Now reciting: Basmalah',
    stopped: 'Recitation paused.',
    finished: 'End of surah.',
    tapToContinue: 'Press “Resume” to continue the recitation.',
    audioError: 'Could not play the recitation (check your connection).',
    ayah: 'Ayah',
    playFrom: 'Listen from this ayah',
    sourceTitle: 'Sources',
    trNote: 'Meanings shown are published human translations / tafsir, not AI-generated.',
    openSource: 'Open this ayah at the source',
    footnotes: 'Translator footnotes',
    version: 'Translation version',
    ayahs: 'ayahs'
  }
};

const SURAHS = surahsData.surahs;
const OFFLINE = new Map(offlineData.surahs.map((s) => [s.n, s]));
const BASMALA = OFFLINE.get(1)?.ayahs?.[0]?.ar || '';
const cache = new Map();
let lastState = null; // remember surah/reciter/translation between openings

const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}

async function getJson(url, signal) {
  const r = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Returns { rows, mode: 'live'|'offline', trOk } */
async function loadSurah(n, trKey, signal) {
  const ck = `${n}:${trKey}`;
  if (cache.has(ck)) return cache.get(ck);
  const meta = SURAHS[n - 1];
  const [qpc, enc] = await Promise.allSettled([
    getJson(textUrl(n), signal),
    getJson(translationUrl(trKey, n), signal)
  ]);
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  let result;
  const encRows = enc.status === 'fulfilled' ? enc.value.result : null;
  if (qpc.status === 'fulfilled' && qpc.value.verses?.length === meta.ayahs) {
    const rows = mergeVerses(qpc.value.verses, encRows);
    if (!encRows) rows.forEach((r) => { r.verified = null; });
    result = { rows, mode: 'live', trOk: !!encRows };
  } else if (OFFLINE.has(n)) {
    const off = OFFLINE.get(n);
    const field = off.ayahs[0][trKey] !== undefined ? trKey : null;
    result = {
      rows: off.ayahs.map((a) => ({
        n: a.n, ar: a.ar, tr: field ? a[field] : '', fn: field ? splitFootnotes(a[`${field}_footnotes`]) : [], verified: true
      })),
      mode: 'offline',
      trOk: !!field
    };
  } else if (encRows?.length === meta.ayahs) {
    // quranenc's arabic_text is the same KFGQPC text; used only if api.quran.com is unreachable.
    result = {
      rows: mergeVerses(encRows.map((r) => ({ verse_number: Number(r.aya), text_qpc_hafs: r.arabic_text })), encRows)
        .map((r) => ({ ...r, verified: null })),
      mode: 'live',
      trOk: true
    };
  } else {
    throw new Error('network');
  }
  if (result.mode === 'live') cache.set(ck, result);
  return result;
}

export function open({ lang = 'ar', onClose } = {}) {
  const L = lang === 'ar' ? 'ar' : 'en';
  const t = STR[L];
  const prevFocus = document.activeElement;
  const state = {
    surah: lastState?.surah || 1,
    reciter: lastState?.reciter || RECITERS[0].id,
    tr: lastState?.tr && lastState.trLang === L ? lastState.tr : DEFAULT_TRANSLATION[L],
    showTr: lastState?.showTr ?? true,
    rows: [],
    idx: -1, // -1 = basmala (when applicable) / not started
    playing: false,
    abort: null
  };

  const audio = new Audio();
  audio.preload = 'auto';
  const prefetch = new Audio();
  prefetch.preload = 'auto';

  // ---------- DOM ----------
  const live = el('p', { class: 'yk-quran-live', role: 'status', 'aria-live': 'polite' });
  const surahSel = el('select', { class: 'yk-quran-select', id: 'yk-quran-surah' },
    SURAHS.map((s) => el('option', { value: s.n, text: `${L === 'ar' ? toArabicDigits(s.n) : s.n}. ${L === 'ar' ? s.ar : `${s.en} — ${s.meaningEn}`} (${L === 'ar' ? toArabicDigits(s.ayahs) : s.ayahs} ${t.ayahs})${OFFLINE.has(s.n) ? ` • ${t.offline}` : ''}` })));
  const recSel = el('select', { class: 'yk-quran-select', id: 'yk-quran-reciter' },
    RECITERS.map((r) => el('option', { value: r.id, text: r.name[L] })));
  const trSel = el('select', { class: 'yk-quran-select', id: 'yk-quran-tr' },
    Object.entries(TRANSLATIONS).map(([k, v]) => el('option', { value: k, text: v.label[L] })));
  surahSel.value = String(state.surah);
  recSel.value = state.reciter;
  trSel.value = state.tr;

  const playBtn = el('button', { type: 'button', class: 'yk-quran-btn yk-quran-play' });
  const prevBtn = el('button', { type: 'button', class: 'yk-quran-btn', 'aria-label': t.prev, title: t.prev, text: L === 'ar' ? '›' : '‹' });
  const nextBtn = el('button', { type: 'button', class: 'yk-quran-btn', 'aria-label': t.next, title: t.next, text: L === 'ar' ? '‹' : '›' });
  const trToggle = el('input', { type: 'checkbox', id: 'yk-quran-showtr' });
  trToggle.checked = state.showTr;

  const list = el('ol', { class: 'yk-quran-list', 'aria-label': t.title });
  const notice = el('p', { class: 'yk-quran-notice', hidden: true });
  const retryBtn = el('button', { type: 'button', class: 'yk-quran-btn', text: t.retry, hidden: true });
  const body = el('div', { class: 'yk-quran-body', tabindex: '-1' }, notice, retryBtn, list);

  const field = (id, label, control) => el('label', { class: 'yk-quran-field', for: id }, el('span', { text: label }), control);
  const closeBtn = el('button', { type: 'button', class: 'yk-quran-close', 'aria-label': t.close, title: t.close, text: '×' });

  const attr = ATTRIBUTION[L];
  const versionLine = el('p', { class: 'yk-quran-ver' });
  const footer = el('footer', { class: 'yk-quran-foot' },
    el('p', { text: `${attr.text} ${attr.translation} ${attr.audio}` }),
    versionLine,
    el('p', { class: 'yk-quran-note', text: `${attr.note} ${t.trNote}` }),
    el('p', { class: 'yk-quran-links' }, ATTRIBUTION.links.map((l) => el('a', { href: l.href, target: '_blank', rel: 'noopener noreferrer', text: l.label[L] })))
  );

  const panel = el('div', {
    class: 'yk-quran-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'yk-quran-title',
    dir: L === 'ar' ? 'rtl' : 'ltr', lang: L
  },
    el('header', { class: 'yk-quran-head' },
      el('div', {}, el('h2', { id: 'yk-quran-title', text: t.title }), el('p', { class: 'yk-quran-sub', text: t.sub })),
      closeBtn),
    el('div', { class: 'yk-quran-controls' },
      field('yk-quran-surah', t.surah, surahSel),
      field('yk-quran-reciter', t.reciter, recSel),
      field('yk-quran-tr', t.translation, trSel),
      el('div', { class: 'yk-quran-transport' }, prevBtn, playBtn, nextBtn,
        el('label', { class: 'yk-quran-check', for: 'yk-quran-showtr' }, trToggle, el('span', { text: t.showTr })))),
    live,
    body,
    footer
  );
  const root = el('div', { class: 'yk-quran-backdrop' }, panel);
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });

  // ---------- rendering ----------
  const surahName = () => (L === 'ar' ? SURAHS[state.surah - 1].ar : SURAHS[state.surah - 1].en);
  const hasBasmala = () => !!SURAHS[state.surah - 1].bismillahPre && !!BASMALA;

  function setPlayLabel() {
    const label = state.playing ? t.pause : (state.idx >= 0 || state.idx === -2 ? t.resume : t.play);
    playBtn.textContent = state.playing ? '❚❚' : '▶';
    playBtn.setAttribute('aria-label', label);
    playBtn.title = label;
    playBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
  }

  function render(result) {
    list.replaceChildren();
    const trMeta = TRANSLATIONS[state.tr];
    const ver = offlineData.translations?.[state.tr]?.version;
    versionLine.textContent = `${trMeta.label[L]} — quranenc.com/${trMeta.lang === 'ar' ? 'ar' : 'en'}/browse/${state.tr}${ver ? ` — ${t.version} ${ver}` : ''}`;
    if (hasBasmala()) {
      list.append(el('li', { class: 'yk-quran-basmala', 'data-idx': '-2' },
        el('p', { class: 'yk-quran-ar', lang: 'ar', dir: 'rtl', text: BASMALA })));
    }
    result.rows.forEach((r, i) => {
      const badge = r.verified === true ? null
        : r.verified === false ? el('span', { class: 'yk-quran-badge warn', text: t.mismatch })
          : el('span', { class: 'yk-quran-badge', text: t.single });
      const li = el('li', { class: 'yk-quran-ayah', 'data-idx': String(i) },
        el('p', { class: 'yk-quran-ar', lang: 'ar', dir: 'rtl' },
          r.ar, ' ', el('span', { class: 'yk-quran-num', 'aria-label': `${t.ayah} ${r.n}`, text: `﴿${toArabicDigits(r.n)}﴾` })),
        r.tr ? el('div', { class: 'yk-quran-trwrap', hidden: !state.showTr },
          el('p', { class: 'yk-quran-tr', lang: trMeta.lang, dir: trMeta.dir }, r.tr),
          r.fn?.length ? el('details', { class: 'yk-quran-fn' },
            el('summary', { text: t.footnotes }),
            r.fn.map((f) => el('p', { lang: trMeta.lang, dir: trMeta.dir, text: f }))) : null) : null,
        el('div', { class: 'yk-quran-row-tools' },
          el('button', { type: 'button', class: 'yk-quran-mini', 'aria-label': `${t.playFrom} ${r.n}`, text: `▶ ${t.playFrom}`, onclick: () => playFrom(i) }),
          el('a', { class: 'yk-quran-mini', href: r.tr ? quranencLink(state.tr, state.surah, r.n) : quranComLink(state.surah, r.n), target: '_blank', rel: 'noopener noreferrer', text: t.openSource }),
          badge));
      list.append(li);
    });
  }

  async function loadCurrent() {
    stopAudio();
    state.idx = -1;
    state.abort?.abort();
    const ac = new AbortController();
    state.abort = ac;
    notice.hidden = false;
    notice.className = 'yk-quran-notice';
    notice.textContent = t.loading;
    retryBtn.hidden = true;
    list.replaceChildren();
    list.setAttribute('aria-busy', 'true');
    try {
      const res = await loadSurah(state.surah, state.tr, ac.signal);
      if (ac.signal.aborted) return;
      state.rows = res.rows;
      render(res);
      const msgs = [];
      if (res.mode === 'offline') msgs.push(t.offlineUsed);
      if (!res.trOk) msgs.push(t.trMissing);
      notice.hidden = msgs.length === 0;
      notice.textContent = msgs.join(' ');
      body.scrollTop = 0;
    } catch (e) {
      if (e?.name === 'AbortError') return;
      state.rows = [];
      notice.className = 'yk-quran-notice error';
      notice.textContent = t.errorNet;
      retryBtn.hidden = false;
    } finally {
      if (!ac.signal.aborted) list.removeAttribute('aria-busy');
      setPlayLabel();
    }
  }

  // ---------- audio ----------
  function highlight() {
    for (const li of list.children) li.removeAttribute('aria-current');
    const cur = list.querySelector(`[data-idx="${state.idx}"]`);
    if (cur) {
      cur.setAttribute('aria-current', 'true');
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      cur.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  function srcFor(idx) {
    if (idx === -2) return audioUrl(state.reciter, 1, 1); // basmala recitation
    return audioUrl(state.reciter, state.surah, state.rows[idx].n);
  }

  function playIdx(idx) {
    if (!state.rows.length) return;
    state.idx = idx;
    highlight();
    audio.src = srcFor(idx);
    live.textContent = idx === -2 ? t.basmalaPlaying : t.nowPlaying(surahName(), state.rows[idx].n);
    const nxt = idx + 1 < state.rows.length ? (idx === -2 ? 0 : idx + 1) : null;
    if (nxt != null) prefetch.src = srcFor(nxt);
    state.playing = true;
    setPlayLabel();
    audio.play().catch((err) => {
      state.playing = false;
      setPlayLabel();
      live.textContent = err?.name === 'NotAllowedError' ? t.tapToContinue : t.audioError;
    });
  }

  function playFrom(i) {
    playIdx(i === 0 && hasBasmala() ? -2 : i);
  }

  function stopAudio() {
    audio.pause();
    state.playing = false;
    setPlayLabel();
  }

  audio.addEventListener('ended', () => {
    const next = state.idx === -2 ? 0 : state.idx + 1;
    if (next < state.rows.length) playIdx(next);
    else {
      state.playing = false;
      state.idx = -1;
      setPlayLabel();
      live.textContent = t.finished;
    }
  });
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src') && !audio.src) return;
    state.playing = false;
    setPlayLabel();
    live.textContent = t.audioError;
  });

  playBtn.addEventListener('click', () => {
    if (state.playing) { stopAudio(); live.textContent = t.stopped; return; }
    if (state.idx === -1) playFrom(0);
    else if (audio.src && audio.currentTime > 0 && !audio.ended) {
      state.playing = true;
      setPlayLabel();
      audio.play().catch(() => { state.playing = false; setPlayLabel(); live.textContent = t.audioError; });
    } else playIdx(state.idx);
  });
  prevBtn.addEventListener('click', () => {
    if (!state.rows.length) return;
    const i = state.idx <= 0 ? 0 : state.idx - 1;
    playIdx(i);
  });
  nextBtn.addEventListener('click', () => {
    if (!state.rows.length) return;
    const i = state.idx === -2 ? 0 : Math.min(state.rows.length - 1, state.idx + 1);
    playIdx(i);
  });

  surahSel.addEventListener('change', () => { state.surah = Number(surahSel.value); remember(); loadCurrent(); });
  trSel.addEventListener('change', () => { state.tr = trSel.value; remember(); loadCurrent(); });
  recSel.addEventListener('change', () => {
    state.reciter = recSel.value;
    remember();
    if (state.playing) playIdx(state.idx);
  });
  trToggle.addEventListener('change', () => {
    state.showTr = trToggle.checked;
    remember();
    for (const p of list.querySelectorAll('.yk-quran-trwrap')) p.hidden = !state.showTr;
  });
  retryBtn.addEventListener('click', loadCurrent);

  function remember() {
    lastState = { surah: state.surah, reciter: state.reciter, tr: state.tr, trLang: L, showTr: state.showTr };
  }

  // ---------- a11y: Esc + focus trap ----------
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...panel.querySelectorAll('button, a[href], select, input, [tabindex]:not([tabindex="-1"])')]
      .filter((x) => !x.hidden && !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
  // Keep game controls from reacting while the panel is open.
  const swallow = (e) => { if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation(); };
  document.addEventListener('keydown', onKey, true);
  root.addEventListener('keydown', swallow);
  root.addEventListener('keyup', (e) => e.stopPropagation());

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    state.abort?.abort();
    audio.pause();
    audio.removeAttribute('src');
    prefetch.removeAttribute('src');
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    try { prevFocus?.focus?.(); } catch { /* ignore */ }
    onClose?.();
  }
  closeBtn.addEventListener('click', close);

  document.body.append(root);
  setPlayLabel();
  closeBtn.focus();
  loadCurrent();
  return close;
}

export default { open };
