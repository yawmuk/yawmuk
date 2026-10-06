// Journey planner (client). Asks the Netlify function /.netlify/functions/plan to ARRANGE the reviewed situation
// library for the player's optional context, validates the answer, and falls back to the deterministic planner
// on any failure (no endpoint, no key, timeout, invalid JSON, nothing valid left). Never throws.
import { CATALOG, LOCATIONS } from './config.js';
import { allSituations, rulingsById, getSources } from './content.js';
import { validatePlan, fallbackPlan, orderLocations, makeCitationChecker } from './aiCore.js';

export const PLAN_ENDPOINT = '/.netlify/functions/plan';
const TIMEOUT_MS = 6000;

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
/** ?arm=fixed forces the fixed (default-order) journey for A/B comparison. */
export const FORCED_FIXED = params.get('arm') === 'fixed';

const defaultSits = () => allSituations().map((s) => ({ id: s.ruling_id, location: s.location }));

function finish(source, plan) {
  const ids = plan.journey.map((x) => x.id);
  return { source, order: orderLocations(ids, LOCATIONS), journey: plan.journey, followup: plan.followup || null };
}

/** The plan used when the player skips the context picker ("ready-made day"): default order. */
export function defaultPlan() {
  return finish('default', fallbackPlan({}, defaultSits()));
}

function hasContext(ctx) { return !!ctx && (!!ctx.dayType || (Array.isArray(ctx.topics) && ctx.topics.length > 0)); }

async function callModel(ctx, lang) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(PLAN_ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ lang, dayType: ctx.dayType || null, topics: ctx.topics || [] })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; } finally { clearTimeout(timer); }
}

/**
 * Plan the day. ctx = { dayType, topics[] } | null. Resolves { source:'ai'|'fallback'|'default', order, journey, followup }.
 * The network is only used when the player actually chose a context and the A/B arm is not forced to "fixed".
 */
export async function planJourney(ctx, lang = 'en') {
  try {
    if (!hasContext(ctx) || FORCED_FIXED) return defaultPlan();
    const raw = await callModel(ctx, lang);
    if (raw) {
      const checker = makeCitationChecker(rulingsById(), getSources());
      const v = validatePlan(raw, { catalogIds: new Set(CATALOG.map((c) => c.id)), citationsOk: checker });
      if (v.ok) return finish('ai', v);
      console.info('[planner] model plan rejected; using the rule-based plan', v.dropped);
    }
    return finish('fallback', fallbackPlan(ctx, defaultSits()));
  } catch (e) {
    console.info('[planner] fallback after error', e?.message);
    return defaultPlan();
  }
}
