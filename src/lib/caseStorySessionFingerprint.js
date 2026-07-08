/** Stable hash of session activity — bust case-story cache when learner run changes. */
export function caseStorySessionFingerprint(sessionContext) {
  if (!sessionContext || typeof sessionContext !== 'object') return 'empty';
  const payload = {
    placed: sessionContext.stacksPlaced || [],
    timeline: (sessionContext.ordersTimeline || []).slice(-14).map((e) => e.label || e.type),
    chat: (sessionContext.chatMessages || []).slice(-12).map((m) => `${m.role}:${String(m.content || '').slice(0, 120)}`),
    exams: (sessionContext.physicalExamFindings || []).map((r) => r.label),
    labs: (sessionContext.labResults || []).map((r) => r.label),
    notes: String(sessionContext.learnerNotes || '').slice(-400),
    teachingMoments: (sessionContext.teachingMoments || []).length,
  };
  const raw = JSON.stringify(payload);
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return `s${(h >>> 0).toString(36)}`;
}

export function chaptersToStoryboardBeats(chapters = []) {
  return (chapters || []).map((ch, i) => ({
    id: String(ch.id || `c${i + 1}`),
    heading: String(ch.heading || 'Beat').trim(),
    body: String(ch.body || '').trim(),
    visualHint: String(ch.visualHint || '').trim(),
    imageUrl: null,
  }));
}
