import { requireApiKey, callChatCompletion, sendJson, readBody } from '../_lib.js';
import { buildAttendingTutorSystemPrompt } from '../../src/lib/attendingChatPrompt.js';

/**
 * Vercel serverless case-chat message handler.
 * Stateless — caller must include full message history or caseContext for attending tutor prompt.
 */
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

  const { message, sessionContext, messages, caseContext, chatMode = 'tutor' } = body;
  const text = String(message || '').trim();

  const mm = [];

  let system =
    sessionContext?.systemPrompt ||
    (sessionContext?.context && typeof sessionContext.context === 'string'
      ? sessionContext.context
      : '');

  if (!system && chatMode === 'tutor' && caseContext?.id) {
    system = buildAttendingTutorSystemPrompt(caseContext);
  }

  if (system) {
    mm.push({ role: 'system', content: String(system).slice(0, 12000) });
  }

  if (Array.isArray(messages) && messages.length) {
    mm.push(...messages.slice(-24).filter((m) => m?.role && m?.content));
  } else if (text) {
    let userContent = text;
    if (sessionContext && typeof sessionContext === 'object' && !sessionContext.systemPrompt) {
      userContent = `[SESSION SO FAR]\n${JSON.stringify(sessionContext, null, 2)}\n\n---\n\nLearner question: ${text}`;
    }
    mm.push({ role: 'user', content: userContent.slice(0, 8000) });
  }

  if (!mm.length) {
    return sendJson(res, 400, { error: 'Provide caseContext, sessionContext, or messages array' });
  }

  try {
    const reply = await callChatCompletion(mm, {
      maxTokens: 560,
      temperature: chatMode === 'tutor' ? 0.42 : 0.45,
    });
    return sendJson(res, 200, { ok: true, reply });
  } catch (e) {
    return sendJson(res, 500, { error: String(e.message || e) });
  }
}
