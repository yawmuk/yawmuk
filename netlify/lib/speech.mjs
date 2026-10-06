// Server-only: text-to-speech with Gemini TTS (generateContent, responseModalities AUDIO).
// Two transports, same request body (as in vertex.mjs, copied here so the two evolve independently):
//   GEMINI_API_KEY -> Gemini API;  otherwise Vertex AI with an OAuth token from the Cloud Run metadata server
//   (locally: GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token)).
// Resolves { audio: Buffer (WAV), mime: 'audio/wav', model } or { error }. The text is never logged.
import { normalizeLang, bcp47Of } from '../../src/engine/speechLangs.js';

export const TTS_MODEL = process.env.YAWMUK_TTS_MODEL || 'gemini-3.8-flash-tts';
export const TTS_FALLBACKS = (process.env.YAWMUK_TTS_FALLBACKS || 'gemini-3.8-flash-lite-tts').split(',').map((s) => s.trim()).filter(Boolean);
export const DEFAULT_VOICE = process.env.YAWMUK_TTS_VOICE || 'Charon';
// Gemini TTS prebuilt voices (ai.google.dev speech-generation docs).
export const VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
  'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];

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
async function accessToken() {
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

/** True when a TTS transport is configured (key, Cloud Run, or a local token). */
export const speechConfigured = () => Boolean(process.env.GEMINI_API_KEY || process.env.K_SERVICE || process.env.GOOGLE_ACCESS_TOKEN);

/** generateContent body. `withSpeechConfig: false` sends the bare request (language auto-detected, default voice). */
export function speechBody(text, { lang, voice, withSpeechConfig = true } = {}) {
  const generationConfig = { responseModalities: ['AUDIO'] };
  if (withSpeechConfig) {
    const speechConfig = {};
    if (voice && VOICES.includes(voice)) speechConfig.voiceConfig = { prebuiltVoiceConfig: { voiceName: voice } };
    const code = normalizeLang(lang);
    if (code) speechConfig.languageCode = bcp47Of(code);
    if (Object.keys(speechConfig).length) generationConfig.speechConfig = speechConfig;
  }
  return { contents: [{ role: 'user', parts: [{ text }] }], generationConfig };
}

/** A 44-byte RIFF/WAVE header + the PCM bytes (little-endian signed 16-bit by default). */
export function wavFromPcm(pcm, { rate = 24000, channels = 1, bits = 16 } = {}) {
  const data = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm);
  const h = Buffer.alloc(44);
  const blockAlign = channels * (bits / 8);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16); // fmt chunk size
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * blockAlign, 28); // byte rate
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bits, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Model audio (base64 + mime) -> { audio: WAV Buffer, mime } or null. Raw PCM (audio/L16;rate=…, audio/pcm) is wrapped. */
export function toWav(b64, mime = '') {
  if (typeof b64 !== 'string' || !b64) return null;
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) return null;
  const m = String(mime).toLowerCase();
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' || /audio\/(x-)?wav/.test(m)) return { audio: buf, mime: 'audio/wav' };
  if (/audio\/(l16|pcm)/.test(m) || !m) {
    const rate = Number(/rate=(\d+)/.exec(m)?.[1]) || 24000;
    const channels = Number(/channels=(\d+)/.exec(m)?.[1]) || 1;
    return { audio: wavFromPcm(buf, { rate, channels }), mime: 'audio/wav' };
  }
  return { audio: buf, mime: m.split(';')[0] }; // e.g. audio/mpeg — playable as is
}

async function endpoint(model) {
  if (process.env.GEMINI_API_KEY) {
    return { url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, auth: { 'x-goog-api-key': process.env.GEMINI_API_KEY } };
  }
  const [token, pid] = await Promise.all([accessToken(), project()]);
  const host = LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${LOCATION}-aiplatform.googleapis.com`;
  return { url: `https://${host}/v1/projects/${pid}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`, auth: { authorization: `Bearer ${token}` } };
}

async function callTts(model, text, { lang, voice, timeout, withSpeechConfig = true }) {
  let ep;
  try { ep = await endpoint(model); } catch { return { error: 'no_key' }; }
  let res;
  try {
    res = await fetch(ep.url, {
      method: 'POST',
      headers: { ...ep.auth, 'content-type': 'application/json' },
      body: JSON.stringify(speechBody(text, { lang, voice, withSpeechConfig })),
      signal: AbortSignal.timeout(timeout)
    });
  } catch (e) {
    return { error: e?.name === 'TimeoutError' ? 'timeout' : 'unknown' };
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = String(err?.error?.message || '');
    console.error(`[tts] ${model} HTTP ${res.status} ${err?.error?.status || ''} ${msg.slice(0, 160)}`); // provider reason only, never the text
    // A rejected voice / language code: the caller retries the bare request (language is auto-detected).
    if (res.status === 400 && withSpeechConfig && /language|voice|speech_config|speechConfig/i.test(msg)) return { error: 'bad_speech_config' };
    if (res.status === 401 || res.status === 403) return { error: 'auth' };
    if (res.status === 429) return { error: 'rate_limited' };
    return { error: `api_${res.status}` };
  }
  const out = await res.json().catch(() => null);
  const part = (out?.candidates?.[0]?.content?.parts || []).find((p) => p?.inlineData?.data);
  const wav = part && toWav(part.inlineData.data, part.inlineData.mimeType);
  if (!wav) return { error: 'no_audio' };
  return { ...wav, model };
}

/**
 * Speak `text` in `lang` (code from speechLangs.js) with a prebuilt `voice`.
 * Primary model, then each fallback, within `timeout` ms overall. -> { audio, mime, model } | { error }
 */
export async function vertexSpeechCall({ text, lang, voice = DEFAULT_VOICE, timeout = 9000 } = {}) {
  const s = String(text ?? '').trim();
  if (!s) return { error: 'empty' };
  const deadline = Date.now() + timeout;
  const models = [TTS_MODEL, ...TTS_FALLBACKS.filter((m) => m !== TTS_MODEL)];
  let first = null;
  for (let i = 0; i < models.length; i++) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    // the primary gets ~70% of the budget so a failing model still leaves time for the fallback
    const t = i === 0 && models.length > 1 ? Math.round(timeout * 0.7) : left;
    let r = await callTts(models[i], s, { lang, voice, timeout: t });
    if (r.error === 'bad_speech_config' && deadline - Date.now() > 1500) r = await callTts(models[i], s, { lang, voice, timeout: deadline - Date.now(), withSpeechConfig: false });
    if (!r.error) return r;
    first ||= r;
    if (['no_key', 'auth'].includes(r.error)) break;
  }
  return first || { error: 'timeout' };
}
