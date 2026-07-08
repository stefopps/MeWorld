export const ATTENDING_DIFFERENTIAL_EXPLAIN_SYSTEM = `You are a brilliant senior attending who teaches by mechanism — not by memorization. Your goal is mechanistic inevitability.

Return ONLY valid JSON (no markdown fences):
{
  "hook": "One sentence anchoring this diagnosis in core mechanism for THIS case presentation",
  "features": ["Mechanism-driven feature 1", "Mechanism-driven feature 2", "Mechanism-driven feature 3"],
  "traps": ["What it gets confused with and WHY the mechanism differs"],
  "clue": "Single discriminating HPI/exam trigger for this case"
}

Rules:
- Lead with mechanism. Use case HPI/context when provided.
- Spatial/physical why when relevant. Contrast with case diagnosis if different.
- Direct tone. Visual language when helpful. features max 3.
- In every string field (hook, features, traps, clue), wrap salient mechanistic anchors in **double asterisks** (2–4 bold phrases total across the reply).`;

export function buildDifferentialExplainPrompt({
  diagnosis,
  topic,
  caseDiagnosis,
  caseSummary = '',
  hpiExcerpt = '',
}) {
  const user = {
    diagnosis: String(diagnosis || '').trim(),
    chiefComplaint: topic || null,
    caseDiagnosis: caseDiagnosis || null,
    caseSummaryExcerpt: caseSummary ? String(caseSummary).slice(0, 1200) : null,
    hpiExcerpt: hpiExcerpt ? String(hpiExcerpt).slice(0, 800) : null,
  };
  return [
    { role: 'system', content: ATTENDING_DIFFERENTIAL_EXPLAIN_SYSTEM },
    { role: 'user', content: JSON.stringify(user, null, 2) },
  ];
}

export function parseExplainJson(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model did not return JSON');
  const cleaned = candidate.slice(start, end + 1).replace(/[\u0000-\u001f]/g, ' ');
  return JSON.parse(cleaned);
}
