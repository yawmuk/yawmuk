// POST /.netlify/functions/plan  { lang, dayType, topics[] }  ->  { journey:[{situation_id, why:{ar,en}}], followup }
// The model sees ONLY a compact catalog (situation ids, titles, topic tags, location) — never scripture, rulings or
// any player data beyond the optional day type / topics. Its output is validated here AND again in the browser.
import { CATALOG, TOPICS, DAY_TYPES } from '../../src/engine/config.js';
import { validatePlan } from '../../src/engine/aiCore.js';
import { structuredCall, readBody, json } from '../lib/claude.mjs';

const IDS = CATALOG.map((c) => c.id);
const CATALOG_TEXT = CATALOG.map((c) => ({
  id: c.id,
  location: c.location,
  title_en: c.title.en,
  title_ar: c.title.ar,
  topics: Object.keys(TOPICS).filter((k) => TOPICS[k].ids.includes(c.id))
}));

const SYSTEM = `You arrange the order of one short educational day in «Yawmuk», a game where a newcomer learns how Muslims in the USA handle everyday situations.
You receive ONLY a catalog of situations from a curated library the team wrote and checked against documented sources. You do not explain Islam; you only pick and order situations.
Task: choose 4 to 8 situation ids from the catalog that best fit the player's chosen kind of day and topics, in a natural order for a single day (a day's stops flow from one place to the next; keep situations of the same location together). Then choose one "followup" id that is NOT in the journey, as a good next topic after the day.
For every chosen situation write a short "why" in Arabic (ar) and English (en), at most 110 characters each, saying only why it fits the player's interests or the flow of the day.
Hard rules for "why": never quote, paraphrase or mention the Quran, hadith, verses or any scripture; never state a ruling or say what is halal or haram; never give advice or a fatwa; no quotation marks; plain, friendly words.
Use only ids that appear in the catalog.`;

const SCHEMA = {
  type: 'object',
  properties: {
    journey: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          situation_id: { type: 'string', enum: IDS },
          why: { type: 'object', properties: { ar: { type: 'string' }, en: { type: 'string' } }, required: ['ar', 'en'], additionalProperties: false }
        },
        required: ['situation_id', 'why'],
        additionalProperties: false
      }
    },
    followup: { type: 'string', enum: IDS }
  },
  required: ['journey', 'followup'],
  additionalProperties: false
};

export default async (req) => {
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const lang = body.lang === 'ar' ? 'ar' : 'en';
  const dayType = DAY_TYPES[body.dayType] ? body.dayType : null;
  const topics = [...new Set((Array.isArray(body.topics) ? body.topics : []).filter((t) => typeof t === 'string' && TOPICS[t]))].slice(0, 5);
  if (!dayType && !topics.length) return json({ error: 'no_context' }, 400);

  const user = `Catalog (JSON):\n${JSON.stringify(CATALOG_TEXT)}\n\nPlayer context: kind of day = ${dayType ? DAY_TYPES[dayType].en : 'not given'}; topics = ${topics.length ? topics.map((t) => TOPICS[t].en).join(', ') : 'not given'}; interface language = ${lang}.`;
  const r = await structuredCall({ system: SYSTEM, user, schema: SCHEMA, maxTokens: 2000, timeout: 5500 });
  if (r.error) return json({ error: r.error }, r.error === 'no_key' ? 503 : 502);

  const v = validatePlan(r.data, { catalogIds: new Set(IDS) });
  if (!v.ok) return json({ error: 'invalid_plan' }, 502);
  return json({ journey: v.journey.map((j) => ({ situation_id: j.id, why: j.why })), followup: v.followup });
};
