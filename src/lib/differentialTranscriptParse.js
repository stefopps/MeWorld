import { apiUrl } from './apiBase.js';

/**
 * Send raw speech transcript to DeepSeek (or OpenAI fallback) for cleanup + diagnosis list.
 */
export async function parseDifferentialTranscript({
  rawTranscript,
  topic,
  caseId,
  final = false,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let r;
  try {
    r = await fetch(apiUrl('/api/differential/parse-transcript'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        rawTranscript,
        topic,
        caseId,
        final,
      }),
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error('Transcript parse timed out — try again');
    }
    throw new Error('API server not running — run npm run dev in MeWorld/game');
  } finally {
    clearTimeout(timer);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || `Could not parse transcript (HTTP ${r.status})`);
  }
  return {
    cleanedTranscript: data.cleanedTranscript || '',
    diagnoses: Array.isArray(data.diagnoses) ? data.diagnoses : [],
    provider: data.provider || null,
  };
}
