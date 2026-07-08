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

const SCORE_SYSTEM = `You are a smart clinical examiner grading a medical student's differential against the official MARKING SCHEME (answerKey).
Return ONLY valid JSON (no markdown fences):
{
  "gradedGuesses": [
    { "guess": "string", "status": "match" | "extra" | "partial", "matchedAnswer": "string or null", "note": "short reason" }
  ],
  "missedAnswers": ["answer key items with no reasonable guess"],
  "gotCaseDiagnosis": boolean,
  "scoreSummary": "2-3 sentence report: score fraction, what matched, what was missed, one study tip"
}
Marking rules:
- answerKey is the ONLY marking scheme. Map learner language generously when clinically justified.
- "match": equivalent diagnosis, accepted abbreviation, or clear synonym.
- "partial": related mechanism but not specific enough.
- "extra": not on marking scheme and not a reasonable synonym.
- gotCaseDiagnosis: true if any guess equals caseDiagnosis clinically.
- missedAnswers: answerKey items with no match or partial from any guess.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method Not Allowed' });

  const key = requireApiKey(res);
  if (!key) return;

  let body;
  try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'Invalid JSON' }); }

  const { caseId, topic, caseDiagnosis, answerKey, guesses, rawTranscript } = body;
  const keyList = Array.isArray(answerKey) ? answerKey.map(String).filter(Boolean) : [];
  const guessList = Array.isArray(guesses) ? guesses.map(String).filter(Boolean) : [];

  if (!keyList.length) return sendJson(res, 400, { error: 'Missing answerKey' });
  if (!guessList.length) return sendJson(res, 400, { error: 'Add differentials before scoring' });

  try {
    const raw = await callChatCompletion(
      [
        { role: 'system', content: SCORE_SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            caseId,
            chiefComplaint: topic,
            caseDiagnosis: caseDiagnosis || null,
            answerKey: keyList,
            learnerGuesses: guessList,
            rawTranscript: String(rawTranscript || '').trim() || null,
          }),
        },
      ],
      { maxTokens: 1200, temperature: 0.15 },
    );
    const parsed = parseModelJson(raw);
    return sendJson(res, 200, {
      ok: true,
      score: { ...parsed, provider: 'deepseek', model: 'deepseek-chat' },
    });
  } catch (e) {
    return sendJson(res, 500, { error: String(e.message || e) });
  }
}
