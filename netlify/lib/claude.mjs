// Server-only helper for the Netlify functions: one structured-output call to the Claude Messages API.
// The API key is read from the environment (ANTHROPIC_API_KEY) on the server; it never reaches the browser bundle.
import Anthropic from '@anthropic-ai/sdk';
import { vertexEnabled, vertexStructuredCall } from './vertex.mjs';

export const MODEL = process.env.YAWMUK_MODEL || 'claude-sonnet-5-5';
const MAX_BODY = 16 * 1024;

let client = null;
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 9000 });
  return client;
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

/** Parse a small JSON POST body. Returns the object or a Response (error) to send back. */
export async function readBody(req) {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413);
  try { const o = JSON.parse(text); return o && typeof o === 'object' ? o : json({ error: 'bad_json' }, 400); } catch { return json({ error: 'bad_json' }, 400); }
}

/**
 * One request with structured outputs (output_config.format = JSON schema), low effort for latency.
 * Uses server-side refusal fallbacks ("default" routing); if the model/platform rejects that beta parameter,
 * retries once without it. Resolves { data } or { error }.
 */
export async function structuredCall({ system, user, schema, maxTokens = 1500, timeout = 8000 }) {
  // Provider switch: Gemini on Vertex AI (Cloud Run service account, no key) or Claude (ANTHROPIC_API_KEY).
  if (vertexEnabled()) return vertexStructuredCall({ system, user, schema, maxTokens, timeout: Math.max(timeout, 9000) });
  const c = getClient();
  if (!c) return { error: 'no_key' };
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema } }
  };
  let msg;
  try {
    try {
      msg = await c.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, { timeout });
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      msg = await c.messages.create(params, { timeout });
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: 'auth' };
    if (e instanceof Anthropic.RateLimitError) return { error: 'rate_limited' };
    if (e instanceof Anthropic.APIConnectionTimeoutError) return { error: 'timeout' };
    if (e instanceof Anthropic.APIError) return { error: `api_${e.status ?? 'error'}` };
    return { error: 'unknown' };
  }
  if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') return { error: msg.stop_reason };
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return { data: JSON.parse(text) }; } catch { return { error: 'bad_json' }; }
}
