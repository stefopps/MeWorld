import { requireApiKey, buildOrderWhyPrompt, callChatCompletion, sendJson, readBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const key = requireApiKey(res);
  if (!key) return;

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const {
    caseId,
    orderId,
    orderLabel,
    playbookWhy = '',
    caseContext = null,
    alternate = false,
    previousWhy = '',
  } = body;
  const cid = String(caseId ?? '').trim();
  const oid = String(orderId ?? '').trim();
  const label = String(orderLabel ?? '').trim();
  const isAlternate = Boolean(alternate);
  const priorWhy = String(previousWhy ?? '').trim();
  if (!cid || !oid || !label) {
    return sendJson(res, 400, { error: 'Missing caseId, orderId, or orderLabel' });
  }
  if (isAlternate && !priorWhy) {
    return sendJson(res, 400, { error: 'previousWhy required for second opinion' });
  }

  try {
    const messages = buildOrderWhyPrompt({
      orderLabel: label,
      playbookWhy,
      caseContext: caseContext && typeof caseContext === 'object' ? caseContext : {},
      alternate: isAlternate,
      previousWhy: priorWhy,
    });
    const why = await callChatCompletion(messages, {
      maxTokens: 560,
      temperature: isAlternate ? 0.78 : 0.7,
    });
    return sendJson(res, 200, {
      ok: true,
      why,
      alternate: isAlternate,
      cached: false,
      provider: 'deepseek',
    });
  } catch (e) {
    return sendJson(res, 500, { error: String(e.message || e) });
  }
}
