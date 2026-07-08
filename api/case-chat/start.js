import { requireApiKey, callChatCompletion, sendJson, readBody } from '../_lib.js';
import { buildAttendingTutorSystemPrompt } from '../../src/lib/attendingChatPrompt.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method Not Allowed' });

  const key = requireApiKey(res);
  if (!key) return;

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON' });
  }

  const { caseContext } = body;
  if (!caseContext?.id) {
    return sendJson(res, 400, { error: 'Missing caseContext.id' });
  }

  const chatMode = caseContext.chatMode === 'patient_sim' ? 'patient_sim' : 'tutor';
  const systemPrompt =
    chatMode === 'tutor'
      ? buildAttendingTutorSystemPrompt(caseContext)
      : body.systemPrompt || '';

  return sendJson(res, 200, {
    ok: true,
    sessionId: `vs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    caseId: caseContext.id,
    chatMode,
    systemPrompt,
    note: 'Vercel stateless — include systemPrompt + message history with /message calls',
  });
}
