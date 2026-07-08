import { apiUrl } from './apiBase.js';

/** Real-world patient stories for a CCS case (DeepSeek default; Gemini optional). */
export async function fetchGeminiRealWorld({
  caseId,
  topic = '',
  diagnosis = '',
  chiefComplaint = '',
  hpiSnippet = '',
  refresh = false,
  repairVideos = true,
} = {}) {
  const r = await fetch(apiUrl('/api/differential/real-world'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId,
      topic,
      diagnosis,
      chiefComplaint,
      hpiSnippet,
      refresh,
      repairVideos,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || 'Could not fetch real-world cases');
  }
  return data;
}
