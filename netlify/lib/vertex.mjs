// Server-only helper: one structured-output call to Gemini on Google Cloud Vertex AI.
// No API key: on Cloud Run the access token comes from the service account via the metadata server
// (Application Default Credentials). For local runs set GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token).
// Resolves { data } or { error } — the same contract as structuredCall() in claude.mjs.

// Newest fast Gemini first; on timeout/error the same request is retried once on the stable model,
// so a preview-model hiccup never reaches the player as a failure.
export const VERTEX_MODEL = process.env.YAWMUK_GEMINI_MODEL || 'gemini-3-flash-preview';
export const VERTEX_FALLBACK_MODEL = process.env.YAWMUK_GEMINI_FALLBACK || 'gemini-2.5-flash';
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';
const LOCATION = process.env.VERTEX_LOCATION || 'global';
const METADATA_TOKEN_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const METADATA_PROJECT_URL = 'http://metadata.google.internal/computeMetadata/v1/project/project-id';

let cached = { token: null, exp: 0 };
let projectId = PROJECT;

async function metadata(url) {
  const r = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(1500) });
  if (!r.ok) throw new Error(`metadata ${r.status}`);
  return r;
}

/** OAuth token for Google Cloud APIs (shared with tts.mjs). Throws when there is none (local run without a token). */
export async function accessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN;
  if (cached.token && Date.now() < cached.exp - 60_000) return cached.token;
  const t = await (await metadata(METADATA_TOKEN_URL)).json();
  cached = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  return cached.token;
}

async function project() {
  if (!projectId) projectId = (await (await metadata(METADATA_PROJECT_URL)).text()).trim();
  return projectId;
}

/** True when this server should use Vertex AI (explicit LLM_PROVIDER=vertex, or running on Cloud Run with no Claude key). */
export function vertexEnabled() {
  if (process.env.LLM_PROVIDER === 'vertex') return true;
  if (process.env.LLM_PROVIDER === 'claude') return false;
  return !process.env.ANTHROPIC_API_KEY && Boolean(process.env.GEMINI_API_KEY || process.env.K_SERVICE || process.env.GOOGLE_ACCESS_TOKEN);
}

/** Vertex responseSchema is an OpenAPI subset: drop JSON-Schema keywords it rejects, keep enums/required. */
export function toVertexSchema(s) {
  if (Array.isArray(s)) return s.map(toVertexSchema);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'additionalProperties' || k === '$schema') continue;
    out[k] = typeof v === 'object' ? toVertexSchema(v) : v;
  }
  if (out.type === 'array' && out.items?.enum && out.items.enum.length === 0) delete out.items.enum;
  return out;
}

export async function vertexStructuredCall(args) {
  const timeout = args.timeout ?? 9000;
  const hasFallback = VERTEX_FALLBACK_MODEL && VERTEX_FALLBACK_MODEL !== VERTEX_MODEL;
  const first = await callModel(VERTEX_MODEL, { ...args, timeout: hasFallback ? Math.round(timeout * 0.6) : timeout });
  if (!first.error || !hasFallback || ['no_key', 'auth', 'rate_limited'].includes(first.error)) return first;
  const second = await callModel(VERTEX_FALLBACK_MODEL, { ...args, timeout: Math.round(timeout * 0.6) });
  return second.error ? first : second;
}

async function callModel(model, { system, user, schema, maxTokens = 1500, timeout = 9000 }) {
  // Two transports, same request body: the Gemini API with GEMINI_API_KEY (AI Studio key), or Vertex AI with the
  // service account's OAuth token. The key path needs no IAM role on the Cloud Run service account.
  let url, auth;
  if (process.env.GEMINI_API_KEY) {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    auth = { 'x-goog-api-key': process.env.GEMINI_API_KEY };
  } else {
    let token, pid;
    try { [token, pid] = await Promise.all([accessToken(), project()]); } catch { return { error: 'no_key' }; }
    const host = LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${LOCATION}-aiplatform.googleapis.com`;
    url = `https://${host}/v1/projects/${pid}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;
    auth = { authorization: `Bearer ${token}` };
  }
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      responseSchema: toVertexSchema(schema),
      // Gemini 3.x uses thinkingLevel; 2.5 uses thinkingBudget. Keep latency low for an in-game panel.
      thinkingConfig: /^gemini-3/.test(model) ? { thinkingLevel: process.env.YAWMUK_THINKING || (/flash/.test(model) ? 'minimal' : 'low') } : { thinkingBudget: 0 }
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' }
    ]
  };
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout)
    });
  } catch (e) {
    return { error: e?.name === 'TimeoutError' ? 'timeout' : 'unknown' };
  }
  if (!res.ok) {
    // Log the provider's reason (never the request, the question or the key) so failures are diagnosable.
    const err = await res.json().catch(() => null);
    const reason = err?.error?.details?.find?.((d) => d.reason)?.reason || err?.error?.status || '';
    console.error(`[llm] ${model} HTTP ${res.status} ${reason} ${String(err?.error?.message || '').slice(0, 200)}`);
    if (res.status === 401 || res.status === 403 || /API_KEY/.test(reason)) return { error: 'auth' };
    if (res.status === 429) return { error: 'rate_limited' };
    return { error: `api_${res.status}` };
  }
  const out = await res.json().catch(() => null);
  const cand = out?.candidates?.[0];
  if (!cand) return { error: 'refusal' };
  if (cand.finishReason === 'MAX_TOKENS') return { error: 'max_tokens' };
  if (cand.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(cand.finishReason)) return { error: 'refusal' };
  const text = (cand.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  try { return { data: JSON.parse(text) }; } catch { return { error: 'bad_json' }; }
}
