// Content loader: rulings + scripts from /content via import.meta.glob (eager, as raw text so a
// malformed JSON file can never break the build — it is reported and skipped instead).
import { LOCATIONS, LOCATION_TITLES, VERDICTS, QUALITY } from './config.js';
import { applyUiStrings } from './i18n.js';
import { fixtureScripts, fixtureRulings } from './__fixtures__/fixtures.js';
import { isValidOrder } from './aiCore.js';

const rawRulings = import.meta.glob('../../content/rulings/*.json', { eager: true, query: '?raw', import: 'default' });
// Reviewed rulings that are no longer played as situations: kept as the guide's reference library (cards + passages).
const rawLibrary = import.meta.glob('../../content/library/*.json', { eager: true, query: '?raw', import: 'default' });
const rawScripts = import.meta.glob('../../content/script/*.json', { eager: true, query: '?raw', import: 'default' });
// Optional data for the AI features (a missing file => empty list, never a build error).
const rawSources = import.meta.glob('../../content/sources.json', { eager: true, query: '?raw', import: 'default' });
const rawQuestions = import.meta.glob('../../content/script/questions.json', { eager: true, query: '?raw', import: 'default' });
const NOT_A_SCRIPT = /\/(ui_strings|questions)\.json$/;

export const contentIssues = []; // human-readable problems, shown in console (and ?debug=1 overlay)

function issue(msg) { contentIssues.push(msg); console.warn('[content]', msg); }

function parse(path, raw) {
  try { return JSON.parse(raw.replace(/^﻿/, '')); } catch (e) { issue(`${path}: invalid JSON (${e.message})`); return null; }
}

const params = new URLSearchParams(location.search);
const forceFixtures = params.get('fixtures') === '1';

// ---------- rulings ----------
const rulings = {};
if (!forceFixtures) {
  for (const [path, raw] of [...Object.entries(rawLibrary), ...Object.entries(rawRulings)]) { // situation rulings win
    const data = parse(path, raw);
    if (!data) continue;
    const list = Array.isArray(data) ? data : Array.isArray(data.rulings) ? data.rulings : [data];
    for (const r of list) {
      if (!r || typeof r.id !== 'string') { issue(`${path}: ruling without string "id" skipped`); continue; }
      if (rulings[r.id] && !rulings[r.id].library_only) issue(`${path}: duplicate ruling id ${r.id} (later one wins)`);
      rulings[r.id] = r;
    }
  }
}

// ---------- UI strings (content/script/ui_strings.json — optional) ----------
export let uiStrings = null;
for (const [path, raw] of Object.entries(rawScripts)) {
  if (!path.endsWith("/ui_strings.json")) continue;
  const ui = parse(path, raw);
  if (!ui) continue;
  uiStrings = applyUiStrings(ui);
  for (const [k, v] of Object.entries(ui.ruling_card?.verdicts || {})) if (VERDICTS[k] && v) Object.assign(VERDICTS[k], v);
  for (const k of Object.keys(QUALITY)) if (ui.result?.[k]) Object.assign(QUALITY[k], ui.result[k]);
  for (const [k, v] of Object.entries(ui.locations || {})) if (LOCATION_TITLES[k] && v) Object.assign(LOCATION_TITLES[k], v);
}

// ---------- scripts ----------
function normalizeScript(s, loc, path) {
  const out = { ...s };
  out.location = loc;
  out.title = s.title || LOCATION_TITLES[loc];
  out.situations = (Array.isArray(s.situations) ? s.situations : []).filter((sit, i) => {
    if (!sit || typeof sit !== 'object') { issue(`${path}: situation #${i} is not an object`); return false; }
    if (!sit.ruling_id) issue(`${path}: situation #${i} has no ruling_id`);
    if (!sit.hotspot) { sit.hotspot = `auto_${i + 1}`; issue(`${path}: situation #${i} has no hotspot; using ${sit.hotspot}`); }
    if (!Array.isArray(sit.dialogue)) sit.dialogue = [];
    if (!Array.isArray(sit.choices)) sit.choices = [];
    sit.choices.forEach((c, j) => { if (!c.id) c.id = String.fromCharCode(97 + j); if (typeof c.points !== 'number') c.points = Number(c.points) || 0; });
    sit.key = sit.ruling_id || `${loc}#${i}`; // progress key
    return true;
  });
  if (out.next_location !== null && out.next_location !== undefined && out.next_location !== 'end' && !LOCATIONS.includes(out.next_location)) {
    issue(`${path}: unknown next_location "${out.next_location}"`);
  }
  return out;
}

const scripts = {};
if (!forceFixtures) {
  for (const [path, raw] of Object.entries(rawScripts)) {
    if (NOT_A_SCRIPT.test(path)) continue;
    const data = parse(path, raw);
    if (!data) continue;
    const loc = data.location || path.split('/').pop().replace(/\.json$/, '');
    if (!LOCATIONS.includes(loc)) { issue(`${path}: unknown location "${loc}"`); continue; }
    scripts[loc] = normalizeScript(data, loc, path);
  }
}
for (const loc of LOCATIONS) {
  if (!scripts[loc]) scripts[loc] = normalizeScript(structuredClone(fixtureScripts[loc]), loc, `fixture:${loc}`);
}

export const usingFixtures = {
  scripts: LOCATIONS.filter((l) => scripts[l]._fixture),
  rulingsReal: Object.keys(rulings).length
};

/** Script for a location (real, or fixture when the real one is missing). Never null for known locations. */
export function getScript(loc) { return scripts[loc] || null; }

/** Ruling by id: real → fixture → null (caller renders a "content pending" card for null). */
export function getRuling(id) {
  if (!id) return null;
  return rulings[id] || (Object.keys(rulings).length === 0 || forceFixtures ? fixtureRulings[id] : null) || null;
}

// ---------- planned location order (journey planner; null = the scripts' own next_location chain)
let locOrder = null;
/** Set the day's location order (must be a permutation of LOCATIONS, else ignored). */
export function setLocationOrder(order) { locOrder = isValidOrder(order) ? [...order] : null; return !!locOrder; }
export function locationOrder() { return locOrder || LOCATIONS; }
export function firstLocation() { return locationOrder()[0]; }

/** Next location after `loc` (planned order, else script.next_location, else catalog order). null = end of day. */
export function nextLocation(loc) {
  if (locOrder) { const i = locOrder.indexOf(loc); return i >= 0 && i < locOrder.length - 1 ? locOrder[i + 1] : null; }
  const s = scripts[loc];
  if (s && s.next_location === null) return null;
  if (s && (s.next_location === 'end')) return null;
  if (s && LOCATIONS.includes(s.next_location)) return s.next_location;
  const i = LOCATIONS.indexOf(loc);
  return i >= 0 && i < LOCATIONS.length - 1 ? LOCATIONS[i + 1] : null;
}

/** All situations across all locations, in play order. */
export function allSituations() {
  return LOCATIONS.flatMap((loc) => (scripts[loc]?.situations || []).map((s) => ({ ...s, location: loc })));
}

// ---------- reviewed library for the AI features
let sourcesList = [];
for (const [path, raw] of Object.entries(rawSources)) { const d = parse(path, raw); if (Array.isArray(d)) sourcesList = d; }
let questionsList = [];
for (const [path, raw] of Object.entries(rawQuestions)) {
  if (!String(raw || '').trim()) continue;
  let d = null;
  try { d = JSON.parse(String(raw).replace(/^﻿/, '')); } catch (e) { console.info('[questions] ignored (invalid JSON):', e.message); }
  const items = Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
  questionsList = items.filter((q) => q && typeof q.id === 'string' && q.question && q.answer);
}
/** content/sources.json records (may be empty). */
export function getSources() { return sourcesList; }
/** Pre-authored Q&A items from content/script/questions.json (may be empty). */
export function getQuestions() { return questionsList; }
/** All real rulings by id (fixtures excluded). */
export function rulingsById() { return rulings; }

if (usingFixtures.scripts.length) console.info('[content] using fixture scripts for:', usingFixtures.scripts.join(', '));
