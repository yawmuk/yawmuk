// Tests for the Google Cloud read-aloud function (netlify/functions/tts.mjs). No network: without a token the
// function must answer 200 { unavailable } so the browser falls back to speechSynthesis quietly.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.GOOGLE_ACCESS_TOKEN;
const { default: tts, cleanRequest, TTS_MAX, VOICES } = await import('../netlify/functions/tts.mjs');

const post = (body, method = 'POST') => tts(new Request('http://x/.netlify/functions/tts', {
  method, headers: { 'content-type': 'application/json', 'x-yk-client': 'test' }, body: method === 'POST' ? JSON.stringify(body) : undefined
}));

describe('tts request cleaning', () => {
  test('the voice follows the script of the text', () => {
    assert.equal(cleanRequest({ text: 'السلام عليكم', lang: 'en' }).lang, 'ar');
    assert.equal(cleanRequest({ text: 'Is a mortgage allowed?', lang: 'ar' }).lang, 'en');
    assert.equal(cleanRequest({ text: '١٢٣', lang: 'ar' }).lang, 'ar');
  });
  test('empty, non-string and over-long text is refused', () => {
    assert.equal(cleanRequest({ text: '   ' }).text, '');
    assert.equal(cleanRequest({ text: 42 }).text, '');
    assert.equal(cleanRequest({ text: 'a'.repeat(TTS_MAX + 1) }).text, '');
    assert.equal(cleanRequest({ text: 'a  b\n c' }).text, 'a b c');
  });
  test('every language has a voice; the Arabic voice is Arabic', () => {
    assert.deepEqual(Object.keys(VOICES).sort(), ['ar', 'en', 'es', 'hi', 'zh']);
    assert.match(VOICES.ar.name, /^ar-XA-/);
  });
});

describe('tts function without credentials', () => {
  test('no token -> 200 { unavailable } (browser speaks it itself)', async () => {
    const r = await post({ text: 'السلام عليكم', lang: 'ar' });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { unavailable: true });
  });
  test('only POST is accepted', async () => {
    assert.equal((await post(null, 'GET')).status, 405);
  });
});
