// POST /.netlify/functions/tts  { text, lang }  ->  audio/mpeg | audio/wav   (or 200 { unavailable } -> the browser speaks it itself)
// Natural voices behind every read-aloud button and Omar's spoken answers, in every language of speechLangs.js.
//   1. Google Cloud Text-to-Speech, Chirp 3 HD (fast, ~1 s, small MP3) for the languages that have a voice in VOICES;
//   2. Gemini 3.8 Flash TTS (netlify/lib/speech.mjs; 130 languages) when Chirp has no voice for the language or fails.
// It only reads text the page already shows (reviewed cards, dialogue, validated guide answers): it never writes content.
// No API key: the token is the Cloud Run service account's (accessToken() in vertex.mjs). Nothing is stored or logged;
// identical texts are synthesized once per instance (ruling cards and dialogue lines are fixed). Any failure answers
// 200 { unavailable } so the browser falls back to its own voice silently.
import { accessToken } from '../lib/vertex.mjs';
import { json, readBody } from '../lib/claude.mjs';
import { limiter, clientKey } from '../../src/features/experts/core.js';
import { normalizeLang, detectSpeechLang, ttsBudgetMs } from '../../src/engine/speechLangs.js';
import { vertexSpeechCall } from '../lib/speech.mjs';

export const TTS_MAX = 1500; // characters; Cloud TTS takes at most 5000 bytes and Arabic is 2 bytes a letter
// Chirp 3 HD voices (one male narrator voice, "Charon", in every language). A language missing here still speaks via Gemini.
export const VOICES = {
  ar: { languageCode: 'ar-XA', name: 'ar-XA-Chirp3-HD-Charon' },
  en: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Charon' },
  es: { languageCode: 'es-US', name: 'es-US-Chirp3-HD-Charon' },
  zh: { languageCode: 'cmn-CN', name: 'cmn-CN-Chirp3-HD-Charon' },
  hi: { languageCode: 'hi-IN', name: 'hi-IN-Chirp3-HD-Charon' }
};

const perClient = limiter({ max: 40, windowMs: 10 * 60_000 });
const globalLimit = limiter({ max: 800, windowMs: 60 * 60_000 }); // cost ceiling across all players
const cache = new Map(); // `${lang}|${text}` -> { buf, type } (most recent last)
const CACHE_MAX = 300;
const UNAVAILABLE = { unavailable: true };

/**
 * -> { text, lang } (text '' when unusable). The voice follows the script of the text (Arabic, Devanagari, Han …);
 * Latin-script text is read in the requested language when that language is written in Latin script (en, es …), else English.
 */
export function cleanRequest(body) {
  const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
  if (!text || text.length > TTS_MAX) return { text: '', lang: 'en' };
  const asked = normalizeLang(body?.lang) || 'en';
  if (asked === 'ar' && !/[a-z]/i.test(text)) return { text, lang: 'ar' }; // digits / punctuation in an Arabic line
  return { text, lang: detectSpeechLang(text, asked) };
}

const audio = ({ buf, type }) => new Response(buf, { status: 200, headers: { 'content-type': type, 'cache-control': 'no-store' } });

async function chirp(text, lang, token) {
  // A local run uses the developer's user token, which Cloud TTS only accepts with an explicit quota project;
  // the Cloud Run service account bills its own project and needs no header.
  const quota = process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_CLOUD_PROJECT ? { 'x-goog-user-project': process.env.GOOGLE_CLOUD_PROJECT } : {};
  try {
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...quota },
      body: JSON.stringify({ input: { text }, voice: VOICES[lang], audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 } }),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null); // log the provider's reason only, never the text
      console.error(`[tts] chirp HTTP ${res.status} ${err?.error?.status || ''} ${String(err?.error?.message || '').slice(0, 160)}`);
      return null;
    }
    const out = await res.json().catch(() => null);
    return out?.audioContent ? { buf: Buffer.from(out.audioContent, 'base64'), type: 'audio/mpeg' } : null;
  } catch { return null; }
}

async function gemini(text, lang) {
  const r = await vertexSpeechCall({ text, lang, timeout: ttsBudgetMs(text) }).catch(() => ({ error: 'unknown' }));
  return r && !r.error && r.audio?.length ? { buf: r.audio, type: r.mime || 'audio/wav' } : null;
}

export default async (req) => {
  const body = await readBody(req);
  if (body instanceof Response) return body;
  const { text, lang } = cleanRequest(body);
  if (!text) return json(UNAVAILABLE);
  const key = `${lang}|${text}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return audio(hit); }
  if (!perClient(clientKey(req)) || !globalLimit('all')) return json({ error: 'rate_limited' }, 429);

  let token = null;
  try { token = await accessToken(); } catch { /* local run without a token */ }
  if (!token && !process.env.GEMINI_API_KEY) return json(UNAVAILABLE);
  const out = (token && VOICES[lang] ? await chirp(text, lang, token) : null) || await gemini(text, lang);
  if (!out) return json(UNAVAILABLE);
  cache.set(key, out);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return audio(out);
};
