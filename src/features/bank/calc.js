// Pure money maths for the Islamic-bank advisor panel (no DOM, no network) so node:test can check it.
// Educational only: nothing here is a fatwa. Rates and prices are always typed in by the user.

/** Nisab in grams of pure metal (dorar.net/feqhia/2153: 20 mithqal x 4.25 g; 200 dirham x 2.975 g). */
export const NISAB_GOLD_G = 85;
export const NISAB_SILVER_G = 595;
/** Quarter of a tenth (dorar.net/feqhia/2157). */
export const ZAKAT_RATE = 0.025;

const num = (v) => {
  if (v === '' || v == null) return NaN;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s٬]/g, '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return Number.isFinite(n) ? n : NaN;
};
const pos = (v) => { const n = num(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * Zakat on savings.
 * input: { cash, goldGrams, silverGrams, debts, deductDebts, goldPrice, silverPrice (per gram), basis: 'lower'|'gold'|'silver', yearPassed }
 * Whether a debt that is due reduces zakatable cash is disputed among scholars, so debts are subtracted ONLY when
 * the user opts in (deductDebts === true); the default never settles the question silently.
 * returns { ok, error?, wealth, nisabGold, nisabSilver, nisab, basisUsed, reached, due, notes[] }
 */
export function zakat(input = {}) {
  const goldPrice = pos(input.goldPrice), silverPrice = pos(input.silverPrice);
  const basis = ['lower', 'gold', 'silver'].includes(input.basis) ? input.basis : 'lower';
  const notes = [];
  const nisabGold = goldPrice ? round2(NISAB_GOLD_G * goldPrice) : null;
  const nisabSilver = silverPrice ? round2(NISAB_SILVER_G * silverPrice) : null;

  let basisUsed = basis;
  let nisab = null;
  if (basis === 'gold') nisab = nisabGold;
  else if (basis === 'silver') nisab = nisabSilver;
  else if (nisabGold != null && nisabSilver != null) { nisab = Math.min(nisabGold, nisabSilver); basisUsed = nisabGold <= nisabSilver ? 'gold' : 'silver'; }
  else if (nisabGold != null || nisabSilver != null) { nisab = nisabGold ?? nisabSilver; basisUsed = nisabGold != null ? 'gold' : 'silver'; notes.push('lower_needs_both'); }

  const goldGrams = pos(input.goldGrams), silverGrams = pos(input.silverGrams);
  if ((goldGrams && !goldPrice) || (silverGrams && !silverPrice)) notes.push('metal_without_price');
  const debts = input.deductDebts === true ? pos(input.debts) : 0;
  if (pos(input.debts) && input.deductDebts !== true) notes.push('debts_not_deducted');
  const wealth = round2(Math.max(0, pos(input.cash) + goldGrams * goldPrice + silverGrams * silverPrice - debts));

  if (nisab == null) return { ok: false, error: 'need_price', wealth, nisabGold, nisabSilver, nisab: null, basisUsed: basis, reached: false, due: 0, notes };
  const reached = wealth >= nisab;
  const yearPassed = input.yearPassed !== false;
  if (reached && !yearPassed) notes.push('wait_for_year');
  const due = reached && yearPassed ? round2(wealth * ZAKAT_RATE) : 0;
  return { ok: true, wealth, nisabGold, nisabSilver, nisab, basisUsed, reached, due, notes };
}

/** Standard annuity (conventional interest loan). rate = annual % (e.g. 6.5). */
export function amortize(principal, annualRatePct, years) {
  const P = pos(principal), n = Math.round(pos(years) * 12), r = pos(annualRatePct) / 100 / 12;
  if (!P || !n) return null;
  const monthly = r ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
  const yearly = [];
  let bal = P, interestSum = 0;
  for (let m = 1; m <= n; m++) {
    const interest = bal * r;
    bal = Math.max(0, bal - (monthly - interest));
    interestSum += interest;
    if (m % 12 === 0 || m === n) yearly.push({ year: Math.ceil(m / 12), balance: round2(bal), interestToDate: round2(interestSum) });
  }
  return { kind: 'loan', monthly: round2(monthly), total: round2(monthly * n), extra: round2(monthly * n - P), months: n, yearly };
}

/**
 * Murabaha: the bank buys at `cost` and sells at ONE fixed price agreed at signing. Here the price is set from an
 * annual profit rate on the declining balance (a common way banks quote it), so the instalments can equal a loan's:
 * the Shari'ah difference is the contract (ownership, risk, no increase on delay), not the number.
 * The price is a debt that never grows with late payment.
 */
export function murabaha(cost, annualProfitPct, years) {
  const C = pos(cost), n = Math.round(pos(years) * 12), r = pos(annualProfitPct) / 100 / 12;
  if (!C || !n) return null;
  const monthly = r ? (C * r) / (1 - Math.pow(1 + r, -n)) : C / n;
  const price = round2(monthly * n);
  const yearly = [];
  for (let k = 1; k <= Math.ceil(n / 12); k++) yearly.push({ year: k, remainingPrice: round2(Math.max(0, price - monthly * Math.min(n, k * 12))) });
  return { kind: 'murabaha', price, monthly: round2(monthly), total: price, extra: round2(price - C), months: n, yearly };
}

/**
 * Diminishing musharaka: client pays `downPct`% up front; the bank's share is bought back in equal monthly units at
 * the original unit value (an illustration: real contracts may price units differently), plus rent on the bank's
 * share at `rentPct` per year. Rent falls as the client's ownership rises.
 */
export function diminishingMusharaka(price, downPct, rentPct, years) {
  const V = pos(price), n = Math.round(pos(years) * 12);
  const d = Math.min(Math.max(pos(downPct), 0), 99) / 100;
  if (!V || !n) return null;
  const bank0 = V * (1 - d);
  const unit = bank0 / n;
  const rr = pos(rentPct) / 100 / 12;
  let bank = bank0, rentSum = 0, paid = 0, first = 0;
  const yearly = [];
  for (let m = 1; m <= n; m++) {
    const rent = bank * rr;
    rentSum += rent;
    const pay = unit + rent;
    if (m === 1) first = pay;
    paid += pay;
    bank = Math.max(0, bank - unit);
    if (m % 12 === 0 || m === n) yearly.push({ year: Math.ceil(m / 12), clientOwnershipPct: round2(100 * (1 - bank / V)), rentToDate: round2(rentSum) });
  }
  return { kind: 'musharaka', down: round2(V * d), firstMonthly: round2(first), lastMonthly: round2(unit + unit * rr), total: round2(paid), extra: round2(rentSum), months: n, startOwnershipPct: round2(d * 100), yearly };
}

/** All three side by side for a house price, a down payment and one rate (so the numbers are comparable). */
export function compareHouse({ price, downPct = 20, ratePct = 6, years = 25 } = {}) {
  const V = pos(price), d = Math.min(pos(downPct), 99) / 100;
  const financed = V * (1 - d);
  return {
    financed: round2(financed),
    loan: amortize(financed, ratePct, years),
    murabaha: murabaha(financed, ratePct, years),
    musharaka: diminishingMusharaka(V, downPct, ratePct, years)
  };
}
