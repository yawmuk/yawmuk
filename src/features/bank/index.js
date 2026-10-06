// «مستشار التمويل الإسلامي» — Islamic finance advisor panel (bank scene).
// open({ lang, onClose }) -> close()
// Three tabs: contract cards (content/bank/cards.json, every position attributed + linked), a zakat-on-savings
// calculator (general education, not a fatwa) and a house-finance comparison (loan vs murabaha vs diminishing
// musharaka). No AI-written verdicts: rulings are reused from content/rulings by id.
import './bank.css';
import data from '../../../content/bank/cards.json';
import { zakat, compareHouse, NISAB_GOLD_G, NISAB_SILVER_G } from './calc.js';

export const CARDS = data.cards;

export const S = {
  ar: {
    title: 'مستشار التمويل الإسلامي', sub: 'تعليم عام عن العقود، وليس فتوى. كل قول منسوب إلى جهته مع رابط المصدر.',
    close: 'إغلاق', back: 'رجوع إلى العقود',
    tabs: { cards: 'العقود', zakat: 'حاسبة الزكاة', compare: 'قارن تمويل البيت' },
    level: 'مستوى المحتوى', disputed: 'مسألة فيها خلاف', disputedHead: 'مواضع الخلاف (لا نرجّح بينها)',
    def: 'التعريف', how: 'كيف يعمل؟', cond: 'الضوابط', status: 'الموقف العلمي', who: 'منسوب إلى', src: 'المصادر',
    askWhen: 'اسأل أهل العلم إذا…', askBtn: 'اسأل أهل العلم', related: 'بطاقات أحكام مرتبطة في اللعبة', hideRuling: 'إخفاء البطاقة',
    aiNote: 'مسودة أعدّها الذكاء الاصطناعي من المصادر المذكورة، ولم يراجعها عالم بعد.',
    z: {
      intro: 'أدخل الأرقام بعملتك. أسعار الذهب والفضة تكتبها أنت من مصدر موثوق ليوم الحساب؛ لا نجلبها تلقائياً.',
      cash: 'النقد والمدخرات والحسابات', gold: 'ذهب مدّخر (غرام خالص)', silver: 'فضة مدّخرة (غرام خالص)', debts: 'ديون حالّة عليك الآن',
      gp: 'سعر غرام الذهب اليوم', sp: 'سعر غرام الفضة اليوم', basis: 'النصاب المعتمد في الحساب',
      lower: 'أدنى النصابين (قول المجمع الفقهي بالرابطة وهيئة كبار العلماء)', goldB: 'نصاب الذهب (قول بعض المعاصرين)', silverB: 'نصاب الفضة',
      year: 'مرّ على هذا المال حول هجري كامل', nisabG: `نصاب الذهب = ${NISAB_GOLD_G} غ ×  السعر`, nisabS: `نصاب الفضة = ${NISAB_SILVER_G} غ × السعر`,
      wealth: 'المال الخاضع للزكاة', nisab: 'النصاب المستخدم', due: 'الزكاة الواجبة (2.5٪)', notReached: 'لم يبلغ المال النصاب: لا زكاة عليه الآن.',
      needPrice: 'اكتب سعر الذهب أو الفضة لمعرفة النصاب.', waitYear: 'بلغ النصاب، والزكاة تجب بعد تمام الحول.',
      lowerNeedsBoth: 'لحساب «أدنى النصابين» اكتب السعرين كليهما؛ استُخدم المتاح منهما.', metalNoPrice: 'أدخلت ذهباً أو فضة دون سعرها، فلم تُحسب قيمتها.',
      disclaimer: 'حاسبة تعليمية عامة، وليست فتوى. للأسهم والعقار والتجارة والديون المؤجلة تفصيل: اسأل أهل العلم.',
      basisDisputed: 'اختيار النصاب في النقود الورقية مسألة خلافية؛ انظر بطاقة «زكاة المدخرات».',
      deduct: 'اخصم الديون الحالّة من المال (مسألة خلافية)',
      debtsDisputed: 'هل يُخصم الدين الحالّ من المال قبل حساب الزكاة؟ مسألة خلافية بين أهل العلم، فلا نخصمه إلا إذا اخترت ذلك. اسأل عالماً موثوقاً عن حالتك.',
      debtsNotDeducted: 'لم تُخصم الديون من المال؛ فعّل خيار الخصم إن كان هذا ما أفتاك به عالم تثق به.'
    },
    c: {
      intro: 'مثال توضيحي لبيت واحد بثلاث طرق، وبنسبة واحدة ليسهل المقارنة. الأرقام تقريبية. قد تتساوى الأقساط؛ والفرق في العقد: ما سبب الزيادة، ومن يملك، ومن يتحمل الخطر.',
      price: 'سعر البيت', down: 'الدفعة الأولى ٪', rate: 'النسبة السنوية ٪ (فائدة / ربح / أجرة)', years: 'المدة بالسنوات',
      loan: 'قرض بفائدة', mur: 'مرابحة', msh: 'مشاركة متناقصة',
      monthly: 'القسط الشهري', total: 'مجموع ما تدفعه للممول', extra: 'الزيادة فوق المبلغ الممَوَّل',
      extraFor: 'الزيادة مقابل ماذا؟', owner: 'من يملك البيت؟', risk: 'من يتحمل خطر الأصل؟', late: 'إذا تأخرت في السداد', riba: 'أين عنصر الربا؟',
      rows: {
        loan: { extraFor: 'فائدة على المال مقابل الزمن', owner: 'أنت من أول يوم، والبيت مرهون للمقرض', risk: 'أنت وحدك', late: 'تزيد الفوائد والغرامات', riba: 'الزيادة المشروطة على القرض نفسها (قرار المجمع 10 (10/2))' },
        mur: { extraFor: 'ربح في ثمن سلعة ملكها المصرف ثم باعها', owner: 'المصرف أولاً ثم أنت بعد البيع', risk: 'المصرف قبل البيع، ثم أنت', late: 'الثمن دين ثابت لا يزيد', riba: 'لا ربا إذا ملك المصرف البيت وقبضه قبل بيعه ولم يُزد الثمن بالتأخير' },
        msh: { extraFor: 'أجرة عن حصة المصرف التي تسكنها', owner: 'ملك مشترك تزيد فيه حصتك شهراً بعد شهر', risk: 'الطرفان بنسبة الحصص', late: 'لا تُضاف زيادة على دين', riba: 'لا ربا إذا رُوعيت ضوابط الشركة والإجارة (مجمع الفقه، الدورة 15)' }
      },
      first: 'أول قسط', last: 'آخر قسط', ownership: 'حصتك من البيت في نهاية كل سنة (المشاركة المتناقصة)', year: 'سنة',
      seeRuling: 'افتح بطاقة «شراء البيت»'
    }
  },
  en: {
    title: 'Islamic finance advisor', sub: 'General education about contracts, not a fatwa. Every position is attributed to its source, with a link.',
    close: 'Close', back: 'Back to contracts',
    tabs: { cards: 'Contracts', zakat: 'Zakat calculator', compare: 'Compare home finance' },
    level: 'Content level', disputed: 'Disputed matter', disputedHead: 'Points of disagreement (we do not choose between them)',
    def: 'Definition', how: 'How it works', cond: 'Conditions', status: 'Scholarly position', who: 'Attributed to', src: 'Sources',
    askWhen: 'Ask a scholar when…', askBtn: 'Ask a scholar', related: 'Related ruling cards in the game', hideRuling: 'Hide card',
    aiNote: 'Draft prepared by AI from the sources listed; not yet reviewed by a scholar.',
    z: {
      intro: 'Enter amounts in your currency. You type today\'s gold and silver prices from a trusted source; we never fetch them.',
      cash: 'Cash, savings and accounts', gold: 'Gold held as savings (pure grams)', silver: 'Silver held as savings (pure grams)', debts: 'Debts due from you now',
      gp: 'Gold price per gram today', sp: 'Silver price per gram today', basis: 'Nisab used in the calculation',
      lower: 'Lower of the two (MWL Fiqh Council & Saudi Council of Senior Scholars)', goldB: 'Gold nisab (some contemporary scholars)', silverB: 'Silver nisab',
      year: 'A full lunar year has passed over this money', nisabG: `Gold nisab = ${NISAB_GOLD_G} g × price`, nisabS: `Silver nisab = ${NISAB_SILVER_G} g × price`,
      wealth: 'Zakatable wealth', nisab: 'Nisab used', due: 'Zakat due (2.5%)', notReached: 'Below the nisab: no zakat is due now.',
      needPrice: 'Enter a gold or silver price to find the nisab.', waitYear: 'Nisab reached; zakat is due once the lunar year completes.',
      lowerNeedsBoth: 'For "lower of the two" enter both prices; the one available was used.', metalNoPrice: 'You entered gold or silver without its price, so it was not counted.',
      disclaimer: 'General educational calculator, not a fatwa. Shares, property, business stock and deferred debts have details: ask a scholar.',
      basisDisputed: 'Which nisab applies to paper money is disputed; see the "Zakat on savings" card.',
      deduct: 'Subtract debts due now (scholars differ)',
      debtsDisputed: 'Whether a debt that is due is subtracted before zakat is a matter on which scholars differ, so it is not subtracted unless you choose to. Ask a trusted scholar about your own case.',
      debtsNotDeducted: 'Debts were not subtracted; tick the option if that is what a scholar you trust told you.'
    },
    c: {
      intro: 'An illustration for one house financed three ways, using one rate so they are comparable. Figures are approximate. Payments can be equal; the difference is the contract: what the extra is for, who owns, who carries the risk.',
      price: 'House price', down: 'Down payment %', rate: 'Annual rate % (interest / profit / rent)', years: 'Term in years',
      loan: 'Interest loan', mur: 'Murabaha', msh: 'Diminishing musharaka',
      monthly: 'Monthly payment', total: 'Total paid to the financier', extra: 'Extra over the financed amount',
      extraFor: 'What is the extra paid for?', owner: 'Who owns the house?', risk: 'Who carries the asset risk?', late: 'If you pay late', riba: 'Where is the riba element?',
      rows: {
        loan: { extraFor: 'Interest on money, for time', owner: 'You from day one; the lender holds a lien', risk: 'You alone', late: 'Interest and penalties grow', riba: 'The stipulated increase on the loan itself (IIFA resolution 10 (10/2))' },
        mur: { extraFor: 'Profit in the price of a good the bank owned then sold', owner: 'The bank first, then you after the sale', risk: 'The bank before the sale, then you', late: 'The price is a fixed debt; it does not grow', riba: 'None if the bank owned and held the house before selling and the price is never raised for delay' },
        msh: { extraFor: 'Rent for the bank\'s share you live in', owner: 'Joint ownership; your share grows every month', risk: 'Both, by ownership share', late: 'No increase is added to a debt', riba: 'None if partnership and lease conditions are kept (IIFA, 15th session)' }
      },
      first: 'first payment', last: 'last payment', ownership: 'Your share of the house at the end of each year (diminishing musharaka)', year: 'yr',
      seeRuling: 'Open the "Buying a home" card'
    }
  }
};

const LEVEL_AR = { A: 'أ', B: 'ب', C: 'ج', D: 'د' };
export const levelLabel = (lvl, lang) => (lang === 'ar' ? LEVEL_AR[lvl] || lvl : lvl);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  return e;
}

let uid = 0;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function open({ lang = 'ar', onClose, tab = 'cards' } = {}) {
  const L = lang === 'en' ? 'en' : 'ar';
  const s = S[L];
  const tr = (o) => (o && typeof o === 'object' ? o[L] ?? o.en ?? o.ar : o ?? '');
  const fmt = new Intl.NumberFormat(L === 'ar' ? 'ar' : 'en-US', { maximumFractionDigits: 2 });
  const money = (x) => (x == null || !Number.isFinite(x) ? '—' : fmt.format(x));
  const id = `yk-bank-${++uid}`;
  const prevFocus = document.activeElement;

  const body = el('div', { class: 'yk-bank-body' });
  const tabBtns = {};
  const tabbar = el('div', { class: 'yk-bank-tabs', role: 'tablist' },
    ...['cards', 'zakat', 'compare'].map((k) => (tabBtns[k] = el('button', { type: 'button', role: 'tab', class: 'yk-bank-tab', 'aria-controls': `${id}-body`, onclick: () => show(k) }, s.tabs[k]))));
  body.id = `${id}-body`;
  body.setAttribute('role', 'tabpanel');
  const panel = el('div', { class: 'yk-bank-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `${id}-t`, dir: L === 'ar' ? 'rtl' : 'ltr', lang: L },
    el('header', { class: 'yk-bank-head' },
      el('div', { class: 'yk-bank-headtext' }, el('h2', { id: `${id}-t`, class: 'yk-bank-title' }, s.title), el('p', { class: 'yk-bank-sub' }, s.sub)),
      el('button', { type: 'button', class: 'yk-bank-x', 'aria-label': s.close, onclick: () => close() }, '×')),
    tabbar, body);
  const root = el('div', { class: 'yk-bank-backdrop', onclick: (e) => { if (e.target === root) close(); } }, panel);
  document.body.append(root);

  let closed = false;
  function close() {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    try { prevFocus?.focus?.({ preventScroll: true }); } catch { /* */ }
    onClose?.();
  }
  function onKey(e) {
    if (!document.contains(root)) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    e.stopPropagation(); // keep game keys (WASD/E) out while the panel is open
  }
  document.addEventListener('keydown', onKey, true);

  async function askScholar(prefill) {
    try {
      const m = await import('../experts/index.js');
      close();
      m.open({ lang: L, prefill });
    } catch { window.open('https://dorar.net/feqhia', '_blank', 'noopener'); }
  }

  async function rulingToggle(rid, holder, btn) {
    if (holder.firstChild) { holder.replaceChildren(); btn.setAttribute('aria-expanded', 'false'); return; }
    try {
      const [{ getRuling }, { renderRulingCard }] = await Promise.all([import('../../engine/content.js'), import('../../engine/ui/rulingCard.js')]);
      holder.replaceChildren(renderRulingCard(getRuling(rid), rid));
      btn.setAttribute('aria-expanded', 'true');
    } catch (e) { holder.replaceChildren(el('p', {}, rid)); }
  }

  function relatedBlock(ids) {
    if (!ids?.length) return null;
    return el('section', { class: 'yk-bank-sec' }, el('h4', {}, s.related),
      ...ids.map((rid) => {
        const holder = el('div', { class: 'yk-bank-ruling' });
        const btn = el('button', { type: 'button', class: 'yk-bank-link', 'aria-expanded': 'false', onclick: () => rulingToggle(rid, holder, btn) }, rid);
        return el('div', {}, btn, holder);
      }));
  }

  // ---------------------------------------------------------------- cards tab
  function cardsList() {
    body.replaceChildren(el('ul', { class: 'yk-bank-list' }, ...CARDS.map((c) => el('li', {},
      el('button', { type: 'button', class: 'yk-bank-item', onclick: () => cardDetail(c) },
        el('span', { class: `yk-bank-lvl yk-bank-lvl-${c.content_level}`, title: tr(data.meta.levels[c.content_level]) }, levelLabel(c.content_level, L)),
        el('span', { class: 'yk-bank-item-t' }, tr(c.title)),
        c.disputed ? el('span', { class: 'yk-bank-tag' }, s.disputed) : null)))));
    body.querySelector('button')?.focus();
  }

  function cardDetail(c) {
    const list = (arr, ordered) => el(ordered ? 'ol' : 'ul', {}, ...(arr || []).map((x) => el('li', {}, tr(x))));
    body.replaceChildren(el('article', { class: 'yk-bank-card' },
      el('button', { type: 'button', class: 'yk-bank-back', onclick: cardsList }, (L === 'ar' ? '→ ' : '← ') + s.back),
      el('h3', { class: 'yk-bank-ct' }, tr(c.title)),
      el('p', { class: 'yk-bank-meta' },
        el('span', { class: `yk-bank-lvl yk-bank-lvl-${c.content_level}` }, levelLabel(c.content_level, L)), ' ', `${s.level}: ${tr(data.meta.levels[c.content_level])}`),
      c.disputed && c.disputed_points?.length ? el('section', { class: 'yk-bank-dispute', role: 'note' }, el('h4', {}, s.disputedHead), list(c.disputed_points)) : null,
      el('section', { class: 'yk-bank-sec' }, el('h4', {}, s.def), el('p', {}, tr(c.definition))),
      el('section', { class: 'yk-bank-sec' }, el('h4', {}, s.how), list(c.steps, true)),
      el('section', { class: 'yk-bank-sec' }, el('h4', {}, s.cond), list(c.conditions)),
      el('section', { class: 'yk-bank-sec' }, el('h4', {}, s.status), el('p', {}, tr(c.status)),
        el('p', { class: 'yk-bank-who' }, s.who + ':'),
        el('ul', {}, ...c.attributed_to.map((a) => el('li', {}, el('strong', {}, tr(a.body)), ' — ', tr(a.ref), ' ', el('a', { href: a.url, target: '_blank', rel: 'noopener' }, '↗'))))),
      el('section', { class: 'yk-bank-sec' }, el('h4', {}, s.src),
        el('ul', { class: 'yk-bank-src' }, ...c.sources.map((x) => el('li', {}, el('a', { href: x.url, target: '_blank', rel: 'noopener' }, tr(x.title)))))),
      relatedBlock(c.related_rulings),
      el('section', { class: 'yk-bank-sec yk-bank-ask' }, el('h4', {}, s.askWhen), list(c.ask_scholar_when),
        el('button', { type: 'button', class: 'yk-bank-btn', onclick: () => askScholar(`${tr(c.title)}: `) }, s.askBtn)),
      el('p', { class: 'yk-bank-ai' }, s.aiNote)));
    body.querySelector('.yk-bank-back')?.focus();
    body.scrollTop = 0;
  }

  // ---------------------------------------------------------------- zakat tab
  function field(label, name, extra = {}) {
    const inp = el('input', { id: `${id}-${name}`, name, type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'yk-bank-in', ...extra });
    return { wrap: el('label', { class: 'yk-bank-field', for: `${id}-${name}` }, el('span', {}, label), inp), inp };
  }
  function zakatTab() {
    const z = s.z;
    const f = {
      cash: field(z.cash, 'cash'), gold: field(z.gold, 'gold'), silver: field(z.silver, 'silver'), debts: field(z.debts, 'debts'),
      gp: field(z.gp, 'gp'), sp: field(z.sp, 'sp')
    };
    const basisSel = el('select', { id: `${id}-basis`, class: 'yk-bank-in' },
      el('option', { value: 'lower' }, z.lower), el('option', { value: 'gold' }, z.goldB), el('option', { value: 'silver' }, z.silverB));
    const year = el('input', { type: 'checkbox', id: `${id}-year`, checked: true });
    const deduct = el('input', { type: 'checkbox', id: `${id}-deduct` });
    const out = el('div', { class: 'yk-bank-out', 'aria-live': 'polite' });
    const calc = () => {
      const r = zakat({ cash: f.cash.inp.value, goldGrams: f.gold.inp.value, silverGrams: f.silver.inp.value, debts: f.debts.inp.value, deductDebts: deduct.checked,
        goldPrice: f.gp.inp.value, silverPrice: f.sp.inp.value, basis: basisSel.value, yearPassed: year.checked });
      const rows = [
        [z.nisabG, money(r.nisabGold)], [z.nisabS, money(r.nisabSilver)], [z.wealth, money(r.wealth)],
        [z.nisab, r.nisab == null ? '—' : `${money(r.nisab)} (${r.basisUsed === 'gold' ? z.goldB.split(' (')[0] : z.silverB})`]
      ];
      const msgs = [];
      if (!r.ok) msgs.push(z.needPrice);
      else if (!r.reached) msgs.push(z.notReached);
      if (r.notes.includes('wait_for_year')) msgs.push(z.waitYear);
      if (r.notes.includes('lower_needs_both')) msgs.push(z.lowerNeedsBoth);
      if (r.notes.includes('metal_without_price')) msgs.push(z.metalNoPrice);
      if (r.notes.includes('debts_not_deducted')) msgs.push(z.debtsNotDeducted);
      out.replaceChildren(
        el('dl', { class: 'yk-bank-dl' }, ...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])),
        el('p', { class: 'yk-bank-due' }, `${z.due}: `, el('strong', {}, money(r.due))),
        ...msgs.map((m) => el('p', { class: 'yk-bank-msg' }, m)));
    };
    for (const x of Object.values(f)) x.inp.addEventListener('input', calc);
    basisSel.addEventListener('change', calc); year.addEventListener('change', calc); deduct.addEventListener('change', calc);
    const zc = CARDS.find((c) => c.id === 'zakat_savings');
    body.replaceChildren(el('div', { class: 'yk-bank-form' },
      el('p', { class: 'yk-bank-note' }, z.intro),
      el('div', { class: 'yk-bank-grid' }, f.cash.wrap, f.debts.wrap, f.gold.wrap, f.silver.wrap, f.gp.wrap, f.sp.wrap),
      el('label', { class: 'yk-bank-field', for: `${id}-basis` }, el('span', {}, z.basis), basisSel),
      el('p', { class: 'yk-bank-msg' }, z.basisDisputed, ' ', el('button', { type: 'button', class: 'yk-bank-link', onclick: () => { selectTab('cards'); cardDetail(zc); } }, tr(zc.title))),
      el('label', { class: 'yk-bank-check', for: `${id}-deduct` }, deduct, el('span', {}, z.deduct)),
      el('p', { class: 'yk-bank-msg' }, z.debtsDisputed),
      el('label', { class: 'yk-bank-check', for: `${id}-year` }, year, el('span', {}, z.year)),
      out,
      el('p', { class: 'yk-bank-disc', role: 'note' }, z.disclaimer)));
    calc();
    f.cash.inp.focus();
  }

  // ---------------------------------------------------------------- compare tab
  function compareTab() {
    const c = s.c;
    const f = { price: field(c.price, 'price', { value: '400000' }), down: field(c.down, 'down', { value: '20' }), rate: field(c.rate, 'rate', { value: '6' }), years: field(c.years, 'years', { value: '25' }) };
    const out = el('div', { class: 'yk-bank-out', 'aria-live': 'polite' });
    const calc = () => {
      const r = compareHouse({ price: f.price.inp.value, downPct: f.down.inp.value, ratePct: f.rate.inp.value, years: f.years.inp.value });
      if (!r.loan || !r.murabaha || !r.musharaka) { out.replaceChildren(el('p', { class: 'yk-bank-msg' }, '—')); return; }
      const cols = [['loan', c.loan, r.loan], ['mur', c.mur, r.murabaha], ['msh', c.msh, r.musharaka]];
      const monthlyTxt = (k, x) => (k === 'msh' ? `${money(x.firstMonthly)} → ${money(x.lastMonthly)}` : money(x.monthly));
      const row = (label, fn, cls) => el('tr', { class: cls || null }, el('th', { scope: 'row' }, label), ...cols.map(([k, , x]) => el('td', {}, fn(k, x))));
      const table = el('table', { class: 'yk-bank-table' },
        el('thead', {}, el('tr', {}, el('td', {}), ...cols.map(([k, name]) => el('th', { scope: 'col', class: `yk-bank-col-${k}` }, name)))),
        el('tbody', {},
          row(c.monthly, monthlyTxt), row(c.total, (k, x) => money(x.total)), row(c.extra, (k, x) => money(x.extra)),
          row(c.extraFor, (k) => c.rows[k].extraFor), row(c.owner, (k) => c.rows[k].owner), row(c.risk, (k) => c.rows[k].risk),
          row(c.late, (k) => c.rows[k].late), row(c.riba, (k) => c.rows[k].riba, 'yk-bank-riba')));
      const bars = el('div', { class: 'yk-bank-bars', role: 'img', 'aria-label': c.ownership },
        ...r.musharaka.yearly.map((y) => el('div', { class: 'yk-bank-bar', title: `${y.year}: ${money(y.clientOwnershipPct)}%` },
          el('span', { class: 'yk-bank-bar-fill', style: `height:${Math.max(2, y.clientOwnershipPct)}%` }))));
      out.replaceChildren(el('div', { class: 'yk-bank-scroll' }, table), el('p', { class: 'yk-bank-cap' }, c.ownership), bars);
    };
    for (const x of Object.values(f)) x.inp.addEventListener('input', calc);
    const contested = data.compare.contested_note;
    const holder = el('div', { class: 'yk-bank-ruling' });
    const rbtn = el('button', { type: 'button', class: 'yk-bank-link', 'aria-expanded': 'false', onclick: () => rulingToggle(contested.ruling, holder, rbtn) }, c.seeRuling);
    body.replaceChildren(el('div', { class: 'yk-bank-form' },
      el('p', { class: 'yk-bank-note' }, c.intro),
      el('div', { class: 'yk-bank-grid' }, f.price.wrap, f.down.wrap, f.rate.wrap, f.years.wrap),
      out,
      el('section', { class: 'yk-bank-dispute', role: 'note' },
        el('h4', {}, `${s.disputed} — ${s.level} ${levelLabel(contested.content_level, L)}`), el('p', {}, tr(contested)), rbtn, holder),
      el('p', { class: 'yk-bank-note' }, tr(data.compare.explanatory_note)),
      el('p', { class: 'yk-bank-disc' }, s.z.disclaimer.split('.')[0] + '.')));
    calc();
    f.price.inp.focus();
  }

  function selectTab(k) { for (const [n, b] of Object.entries(tabBtns)) { b.setAttribute('aria-selected', String(n === k)); b.classList.toggle('on', n === k); } }
  function show(k) {
    selectTab(k);
    if (k === 'zakat') zakatTab(); else if (k === 'compare') compareTab(); else cardsList();
  }
  show(['cards', 'zakat', 'compare'].includes(tab) ? tab : 'cards');
  return close;
}

export default { open };
