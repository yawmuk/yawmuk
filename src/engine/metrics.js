// Consented, anonymous measurement. Called ONLY when the player switched the consent toggle on (default off).
// Sends { arm, completed, pre, post, clarity } — no ids, no belief, no free text, nothing stored locally.
import { metricsPayload } from './aiCore.js';

export const METRICS_ENDPOINT = '/.netlify/functions/metrics';

export async function sendMetrics(data) {
  try {
    const res = await fetch(METRICS_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(metricsPayload(data)), keepalive: true });
    return res.ok;
  } catch { return false; }
}
