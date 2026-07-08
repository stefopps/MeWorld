import { requireApiKey, callChatCompletion, sendJson, readBody } from '../_lib.js';

function parseModelJson(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model did not return JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

const EXPLAIN_SYSTEM = `You are a brilliant senior attending who teaches by mechanism — not by memorization. Your goal is mechanistic inevitability: the learner should feel "Of course. How could it be any other way?" after reading your explanation.

You do NOT recite facts. You reveal WHY a finding exists by working from first principles: physics, chemistry, biology, spatial geometry, or physiology.

Return ONLY valid JSON (no markdown fences):
{
  "hook": "One sentence that anchors this diagnosis in its core mechanism — the underlying physics, chemistry, or biology that FORCES this to happen. Make it surprising or counterintuitive. Never use a mnemonic.",
  "features": ["Mechanism-driven distinguishing feature 1 — explain WHY this feature exists", "Mechanism-driven feature 2", "Mechanism-driven feature 3"],
  "traps": ["What the student likely confused this with, and WHY the distinction is self-evident once you understand the mechanism"],
  "clue": "The single most discriminating trigger from history or exam, explained through mechanism"
}

Writing rules (Immersa attending voice):
- Lead with mechanism. Answer the spatial/physical why. Connect findings. Use contrast. End with clinical anchor.
- Tone: confident, direct, excited by mechanism. Use visual language when helpful.
- features: 3 items max, clinically specific. traps: mechanistic difference, not just name confusion.
- In every string field, wrap salient mechanistic anchors in **double asterisks** (2–4 bold phrases total).`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method Not Allowed' });

  const key = requireApiKey(res);
  if (!key) return;

  let body;
  try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'Invalid JSON' }); }

  const { diagnosis, topic, caseDiagnosis, caseSummary, caseId } = body;
  const dx = String(diagnosis || '').trim();
  if (!dx) return sendJson(res, 400, { error: 'Missing diagnosis' });

  try {
    const raw = await callChatCompletion(
      [
        { role: 'system', content: EXPLAIN_SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            caseId: caseId ? Number(caseId) : null,
            diagnosis: dx,
            chiefComplaint: topic || null,
            caseDiagnosis: caseDiagnosis || null,
            caseSummaryExcerpt: caseSummary ? String(caseSummary).slice(0, 1200) : null,
          }),
        },
      ],
      { maxTokens: 700, temperature: 0.7 },
    );
    const parsed = parseModelJson(raw);
    return sendJson(res, 200, {
      ok: true,
      explain: parsed,
      provider: 'deepseek',
    });
  } catch (e) {
    return sendJson(res, 500, { error: String(e.message || e) });
  }
}
