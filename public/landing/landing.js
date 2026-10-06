// «يومك» landing: language + theme toggles, a live next-prayer chip (adhan-js, same settings as the game's
// src/features/prayer/times.js), and the «اسأل أهل العلم» form (same API and ticket storage as the in-game panel,
// so a ticket sent here appears in the game under «أسئلتي»). Arabic copy lives in the HTML; English below.
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from './vendor/adhan.esm.min.js';

const EN = {
  skip: 'Skip to content', navLabel: 'Main', themeLabel: 'Toggle theme', langSwitch: 'العربية', footerNav: 'Links',
  navDay: 'Neighbourhood', navInside: "What's inside", navTrust: 'Reliability', navAsk: 'Ask a scholar', navVerify: 'For judges',
  chipFallback: 'Prayer times', ctaPlayShort: 'Start your day', ctaPlay: 'Start your day', ctaHow: 'See how it works',
  ctaAsk: 'or send your question to the scholars’ review console',
  eyebrow: 'AI in Service of Islamic Content Challenge · Team Lemonada',
  heroL1: 'One day in the neighbourhood', heroL2: 'shows you Islam as it is lived',
  heroSub: 'A 3D browser game: leave home for the college, the office, the market, the bank and the mosque, and talk to people by voice or text. Every religious answer you read is quoted from an approved source, or referred to scholars.',
  pFajr: 'Fajr', pDhuhr: 'Dhuhr', pAsr: 'Asr', pMaghrib: 'Maghrib', pIsha: 'Isha',
  devTagGuide: 'Guide', devTagScene: 'The office',
  devQ: "Samir said 'inshallah' about the deadline. Does that mean 'probably not'?",
  devA: "Not at all. 'Inshallah' means 'if God wills'. … It expresses humility, not doubt.",
  devCite: 'Al-Kahf 18:23-24 · reviewed passage', devTalk: 'Talk to the guide',
  fPlacesN: '8 places', fPlaces: 'in one neighbourhood you walk through',
  fQuoteAv: 'E', fQuoteWho: 'Event hall · ruling card', fQuote: 'Alcohol: the party toast and protecting the mind',
  fMosque: 'The mosque · recitation & translated meanings', fVoice: 'By voice or by text',
  fSourcesLbl: 'cited references in the source base',
  sourcesTitle: 'Every religious text is quoted word for word from its source, with its citation',
  src1: 'Madinah Mushaf · King Fahd Complex', src2: 'Translated Quran Encyclopedia · QuranEnc', src3: 'Dorar.net',
  src4: 'Encyclopedia of Translated Hadiths · HadeethEnc', src5: 'International Islamic Fiqh Academy', src6: 'Assembly of Muslim Jurists of America · AMJA',
  howEyebrow: 'How it works', howTitle: 'Live the situation first, then ask',
  how1T: 'Walk the neighbourhood', how1: "Step out of Adam's home and choose where to go: the college, the office, the market, the bank or the mosque. Every door opens a real situation from a Muslim's day.",
  how2T: 'Talk to people', how2: 'A colleague in hijab at work, a neighbour making a marriage proposal, a toast at a party. Choose what to do, or ask with your voice, then see what your choice leads to.',
  how3T: 'Read the sourced answer', how3: 'The ruling card shows the original text, the source and the schools of law. When the sources hold no answer, the guide declines and refers the question to scholars.',
  dayEyebrow: 'One connected world', dayTitle: 'One neighbourhood you walk through, door to door',
  daySub: 'Seven situations in eight places on two streets, and four stations in the square: the guide desk, ask a scholar, prayer times and adhkar.',
  dayImgAlt: 'Illustration of a residential neighbourhood at golden hour',
  pl1: "Adam's home", pl1d: 'Purity and the mosque: wudu and shoes', pl2: 'College', pl2d: 'Abstaining from pork in obedience to God',
  pl3: 'The office', pl3d: 'Declining a lucky charm; hijab at work', pl4: 'Market street', pl4d: 'Gambling, the lottery and protecting society',
  pl5: 'Islamic bank', pl5d: 'Murabaha, ijara, takaful, sukuk and a zakat calculator', pl6: 'Mosque', pl6d: 'The imam, the recited mushaf, translated meanings',
  pl7: 'Event hall', pl7d: 'The party toast and alcohol', pl8: "The neighbours' home", pl8d: 'The proposal, the guardian and the mahr',
  insideEyebrow: "What's inside the neighbourhood", insideTitle: "A Muslim's whole day, from the adhan to the adhkar",
  ft1T: 'Voice and text conversation', ft1: 'Pick your reply to the characters by voice, and ask the guide by voice or text. The guide is bound to reviewed texts and refuses to go off topic.',
  ft2T: 'Prayer times and the adhan', ft2: 'Times are calculated astronomically on your device with the open-source adhan-js library, and the adhan plays when each prayer begins.',
  ft3T: 'Recited Quran with translated meanings', ft3: 'At the mosque, listen to all 114 surahs verse by verse, with translated meanings from QuranEnc, endorsed by the King Fahd Complex.',
  ft4T: 'Morning and evening adhkar', ft4: '27 adhkar for the morning, evening and the day, with their sources and repetitions, and a counter that keeps count for you.',
  ft5T: 'The Islamic bank', ft5: 'Nine cards explain riba and trade, murabaha, ijara, musharaka, takaful and sukuk, plus a zakat calculator.',
  ft6T: 'Ask a scholar', ft6: "A question the sources can't answer goes to a console of Sharia reviewers; you read the answer with a ticket code, no account needed.",
  trustEyebrow: 'Reliability and scholarly safety', trustTitle: 'The AI phrases. It does not issue fatwas.',
  trustSub: 'The model only sees reviewed passages chosen by the system, and the server checks every answer before it reaches you.',
  tr1T: 'Triage before the model', tr1: 'Personal fatwa requests and prompt-injection attempts are referred straight away; they never reach the model.',
  tr2T: 'Retrieval from reviewed texts only', tr2: 'The system searches verified passages and ruling cards. If nothing matches, there is no answer.',
  tr3T: 'Phrasing with mandatory citation', tr3: 'The model answers only from the passages it was given, and names the ID of every passage it relied on.',
  tr4T: 'Server-side checks', tr4: 'An answer is rejected if it cites a passage it was not given, or quotes a verse or hadith of its own.',
  tr5T: 'Abstain and refer to people', tr5: "When unsure, the guide says 'I don't know' and offers to send the question to scholars.",
  lvA: 'Definitive texts, quoted verbatim', lvB: 'Settled rulings, attributed to sources', lvC: 'Disputed issues, shown with their views', lvD: 'Personal fatwas, referred to scholars',
  levelsNote: "The four content levels defined by the challenge's scientific reference package.",
  askEyebrow: 'Human review', askTitle: 'Ask a scholar',
  askSub: 'Your question reaches the Sharia reviewers’ console. No email or phone needed: you get a ticket code and find the answer in the game under “My questions”.',
  askLabel: 'Your question', askPh: 'e.g. May I work at a restaurant that serves alcohol if I never serve it myself?', askSend: 'Send question',
  askNote: 'Don’t include your full name or anything that identifies you. You can delete your question at any time with the ticket code.',
  verifyEyebrow: 'Clear presentation, open to verification', verifyTitle: 'For the judges: verify it yourselves',
  v1T: 'Play a full day', v1: 'The live build, in Arabic and English, on phone and desktop.',
  v2T: 'Sharia reviewers’ console', v2: 'The question queue, triage by level, and answers with sources.',
  v3T: 'Short study mode', v3: 'A pre/post quiz to measure impact, with no personal data collected.',
  v4T: 'Measured results', v4: 'Aggregated results as they are, unpolished.',
  v5T: 'Reference-package case eval', v5: 'The twelve cases in both languages; failures are published alongside passes.',
  v6T: 'Source code', v6: 'A public repository: tests, sources and operations docs.',
  faqTitle: 'Frequently asked questions',
  q1: 'Does Yawmuk issue fatwas?', a1: 'No. It shows what the approved sources say, with their links, and refers personal fatwas to scholars.',
  q2: 'Who is it for?', a2: "Anyone who wants to see how a Muslim lives their day, especially non-Muslims in the West, and new Muslims. The game never asks about or infers your religion.",
  q3: "What if the guide can't find an answer?", a3: "It says so plainly and doesn't guess, then offers to send your question to the reviewers' console.",
  q4: 'Is my voice recorded?', a4: "No. Your browser's built-in speech recognition turns speech into text; the game never records, uploads or stores your voice.",
  q5: 'Do I need an account or an install?', a5: 'No. It runs in the browser on phone and desktop, and your progress is saved in your browser only.',
  footer1: 'Yawmuk by Team Lemonada, for the AI in Service of Islamic Content Challenge 2026.',
  footer2: 'Illustrations and icons are AI-generated and disclosed in the provenance file. Religious texts are quoted from their sources as they are.',
  footer3: 'The guide phrases its answers with Gemini on Google Vertex AI, from reviewed passages only.',
  fSources: 'Sources', fBrand: 'Brand book'
};
const UI = {
  ar: {
    next: (p, t, place) => `${p} ${t} · ${place}`, places: { columbus: 'كولومبس', riyadh: 'الرياض', makkah: 'مكة' },
    prayers: { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
    timesNote: (place, tmr) => `مواقيت ${tmr ? 'الغد' : 'اليوم'} في ${place}، محسوبة على جهازك. اتبع مسجدك المحلي إن اختلفت بدقائق.`,
    sent: 'وصل سؤالك إلى لوحة المراجعين. رمز التذكرة:', keep: 'حُفظ الرمز في متصفحك؛ ستجد الجواب في اللعبة: «اسأل أهل العلم» ← «أسئلتي».',
    play: 'افتح اللعبة', sending: 'جارٍ الإرسال…',
    errors: { too_short: 'السؤال قصير جداً.', too_long: 'السؤال طويل جداً.', rate_limited: 'أرسلت أسئلة كثيرة؛ انتظر قليلاً.', queue_full: 'القائمة ممتلئة الآن؛ حاول لاحقاً.', network: 'تعذّر الاتصال. جرّب مرة أخرى.', other: 'تعذّر الإرسال. جرّب مرة أخرى.' }
  },
  en: {
    next: (p, t, place) => `${p} ${t} · ${place}`, places: { columbus: 'Columbus', riyadh: 'Riyadh', makkah: 'Makkah' },
    prayers: { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
    timesNote: (place, tmr) => `${tmr ? "Tomorrow's" : "Today's"} times in ${place}, calculated on your device. Follow your local mosque if they differ by a few minutes.`,
    sent: 'Your question reached the reviewers’ console. Ticket code:', keep: 'The code is saved in this browser; find the answer in the game under “Ask a scholar” → “My questions”.',
    play: 'Open the game', sending: 'Sending…',
    errors: { too_short: 'The question is too short.', too_long: 'The question is too long.', rate_limited: 'Too many questions; please wait a little.', queue_full: 'The queue is full right now; please try later.', network: "Couldn't connect. Try again.", other: "Couldn't send. Try again." }
  }
};

const root = document.documentElement;
const AR = new Map(); // original Arabic copy, captured once so switching back needs no second dictionary
const store = (() => { try { return window.localStorage; } catch { return null; } })();
const save = (k, v) => { try { store?.setItem(k, v); } catch { /* private mode */ } };
const lang = () => (root.lang === 'en' ? 'en' : 'ar');

function captureArabic() {
  document.querySelectorAll('[data-i18n]').forEach((el) => AR.set(el, { text: el.textContent }));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => AR.set(el, { ...(AR.get(el) || {}), ph: el.placeholder }));
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => AR.set(el, { ...(AR.get(el) || {}), alt: el.alt }));
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => AR.set(el, { ...(AR.get(el) || {}), aria: el.getAttribute('aria-label') }));
}
function applyLang(l) {
  root.lang = l; root.dir = l === 'en' ? 'ltr' : 'rtl';
  const en = l === 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = en ? EN[el.dataset.i18n] ?? AR.get(el).text : AR.get(el).text; });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = en ? EN[el.dataset.i18nPh] : AR.get(el).ph; });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.alt = en ? EN[el.dataset.i18nAlt] : AR.get(el).alt; });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', en ? EN[el.dataset.i18nAria] : AR.get(el).aria); });
  const lt = document.getElementById('lang-toggle');
  lt.lang = en ? 'ar' : 'en';
  // the game reads ?lang= before first paint, so it opens in the same language
  document.querySelectorAll('[data-play]').forEach((a) => { a.href = en ? '/?lang=en' : '/'; });
  document.title = en ? 'Yawmuk · يومك' : 'يومك · Yawmuk';
  renderPrayer();
}

// ── theme ──
function currentTheme() {
  const t = root.getAttribute('data-theme');
  if (t) return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  save('yawmuk.landing.theme', next);
});
document.getElementById('lang-toggle').addEventListener('click', () => {
  const next = lang() === 'en' ? 'ar' : 'en';
  save('yawmuk.landing.lang', next);
  applyLang(next);
});

// ── prayer times (no location prompt on the landing: city chosen from the visitor's time zone) ──
const LOCS = {
  columbus: { id: 'columbus', lat: 39.9612, lng: -82.9988, tz: 'America/New_York', method: 'NorthAmerica' },
  riyadh: { id: 'riyadh', lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh', method: 'UmmAlQura' },
  makkah: { id: 'makkah', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh', method: 'UmmAlQura' }
};
const ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
function pickLoc() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* */ }
  if (tz.startsWith('America/')) return LOCS.columbus;
  if (tz === 'Asia/Riyadh') return LOCS.riyadh;
  return LOCS.makkah;
}
/** Calendar day in the location's own time zone, as a local Date at noon (adhan-js reads y/m/d only). */
function dayIn(tz, offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = parts.split('-').map(Number);
  return new Date(y, m - 1, d + offsetDays, 12);
}
function timesFor(loc, offsetDays = 0) {
  const params = (CalculationMethod[loc.method] || CalculationMethod.MuslimWorldLeague)();
  params.madhab = Madhab.Shafi; // same as the game: Asr at shadow = height (the majority view)
  return new PrayerTimes(new Coordinates(loc.lat, loc.lng), dayIn(loc.tz, offsetDays), params);
}
const fmt = (d, tz, l) => new Intl.DateTimeFormat(l === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);

function renderPrayer() {
  const chip = document.getElementById('prayer-chip-text');
  const list = document.getElementById('live-times');
  let loc, shown, nextName, tomorrow = false;
  try {
    loc = pickLoc();
    shown = timesFor(loc);
    const now = new Date();
    nextName = ORDER.find((p) => shown[p] > now);
    if (!nextName) { shown = timesFor(loc, 1); nextName = 'fajr'; tomorrow = true; } // after isha: show tomorrow's day
  } catch {
    return; // the static fallback copy stays
  }
  const l = lang(), S = UI[l], place = S.places[loc.id];
  chip.textContent = S.next(S.prayers[nextName], fmt(shown[nextName], loc.tz, l), place);
  document.querySelectorAll('.arc-point').forEach((el) => el.classList.toggle('is-next', el.dataset.prayer === nextName));
  list.replaceChildren(
    ...ORDER.map((p) => {
      const s = document.createElement('span');
      s.textContent = `${S.prayers[p]} ${fmt(shown[p], loc.tz, l)}`;
      if (p === nextName) s.className = 'is-next';
      s.dir = 'auto';
      return s;
    }),
    Object.assign(document.createElement('small'), { textContent: S.timesNote(place, tomorrow) })
  );
}

// ── ask a scholar ──
const TICKETS_KEY = 'yawmuk.experts.tickets.v1'; // shared with src/features/experts/core.js
const TICKET_RE = /^[A-HJ-NP-Z2-9]{12}$/;
function keepTicket(t) {
  if (!TICKET_RE.test(t)) return;
  let list = [];
  try { list = JSON.parse(store?.getItem(TICKETS_KEY) || '[]'); } catch { /* */ }
  if (!Array.isArray(list)) list = [];
  save(TICKETS_KEY, JSON.stringify([t, ...list.filter((x) => x !== t)].slice(0, 20)));
}
const form = document.getElementById('ask-form');
const q = document.getElementById('ask-q');
const count = document.getElementById('ask-count');
const out = document.getElementById('ask-result');
const btn = document.getElementById('ask-submit');
q.addEventListener('input', () => { count.textContent = `${q.value.length} / 1000`; });
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const S = UI[lang()];
  const text = q.value.trim();
  const show = (cls, nodes) => { out.hidden = false; out.className = `ask-result ${cls}`; out.replaceChildren(...nodes); };
  if (text.length < 8) { show('is-err', [S.errors.too_short]); q.focus(); return; }
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = S.sending;
  try {
    const res = await fetch('/.netlify/functions/questions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'submit', question: text, lang: lang() }),
      signal: AbortSignal.timeout?.(15000)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ticket) {
      keepTicket(data.ticket);
      const code = Object.assign(document.createElement('span'), { className: 'ticket', textContent: data.ticket.replace(/(.{4})(?=.)/g, '$1-') });
      const play = Object.assign(document.createElement('a'), { href: lang() === 'en' ? '/?lang=en' : '/', textContent: S.play, className: 'btn btn-ghost btn-sm' });
      show('is-ok', [S.sent, document.createElement('br'), code, document.createElement('br'), S.keep, document.createElement('br'), play]);
      q.value = ''; count.textContent = '0 / 1000';
    } else {
      show('is-err', [S.errors[data.error] || S.errors.other]);
    }
  } catch {
    show('is-err', [S.errors.network]);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

captureArabic();
applyLang(lang());
setInterval(renderPrayer, 30_000);
