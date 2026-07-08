import { apiUrl } from './apiBase.js';

export async function scoreDifferentialWithAi({
  caseId,
  topic,
  caseDiagnosis,
  answerKey = [],
  guesses = [],
  rawTranscript = '',
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let r;
  try {
    r = await fetch(apiUrl('/api/differential/score'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        caseId,
        topic,
        caseDiagnosis,
        answerKey,
        guesses,
        rawTranscript,
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') {
      throw new Error('AI scoring timed out — using exact match');
    }
    throw e;
  }
  clearTimeout(timer);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || 'Could not score with AI');
  }
  return data.score;
}

export function aiScoreToAttemptFields(aiScore, answerKey = []) {
  if (!aiScore) return null;
  const matched = [];
  const matchedSet = new Set();
  for (const g of aiScore.gradedGuesses || []) {
    if (g.status !== 'match' || !g.matchedAnswer) continue;
    const key = g.matchedAnswer.toLowerCase().trim();
    if (matchedSet.has(key)) continue;
    matchedSet.add(key);
    matched.push(g.matchedAnswer);
  }
  const missed = Array.isArray(aiScore.missedAnswers)
    ? [...aiScore.missedAnswers]
    : answerKey.filter((d) => !matchedSet.has(d.toLowerCase().trim()));
  const extra = (aiScore.gradedGuesses || [])
    .filter((g) => g.status === 'extra' || g.status === 'partial')
    .map((g) => g.guess);
  return {
    matched,
    missed,
    extra,
    gotCaseDiagnosis: Boolean(aiScore.gotCaseDiagnosis),
    aiSummary: aiScore.scoreSummary || '',
    aiProvider: aiScore.provider || null,
  };
}
