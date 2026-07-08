import { apiUrl } from './apiBase.js';

/**
 * Fetch a clinical explainer for a diagnosis the student missed.
 * Returns { hook, features, traps, clue } or throws.
 */
export async function fetchDifferentialExplain({ diagnosis, topic, caseDiagnosis }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let r;
  try {
    r = await fetch(apiUrl('/api/differential/explain'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        diagnosis: String(diagnosis || '').trim(),
        topic: topic || null,
        caseDiagnosis: caseDiagnosis || null,
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') throw new Error('Explainer timed out — try again');
    throw e;
  }
  clearTimeout(timer);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Could not load explainer');
  return data.explain;
}
