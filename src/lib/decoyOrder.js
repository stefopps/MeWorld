import { ensureCaseChatSession, sendCaseChatMessage } from './caseChat.js';

export function decoyReason(stack) {
  return stack?.why || stack?.reason_wrong || '';
}

/** Ollama-backed teaching blurb for a decoy order (used in review, not during silent practice). */
export async function handleDecoyOrder(stack, caseData) {
  const fallback = decoyReason(stack) || 'This order is not indicated for this case.';
  try {
    const sessionId = await ensureCaseChatSession(caseData);
    const { reply } = await sendCaseChatMessage(
      sessionId,
      `Briefly explain why ordering "${stack.label}" is incorrect for this case. Use 2-3 sentences for a medical student.`,
      null,
      { caseData, chatMode: 'tutor' },
    );
    return String(reply || '').trim() || fallback;
  } catch {
    return fallback;
  }
}
