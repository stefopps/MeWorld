/**
 * Slash commands in case chat: /pt = patient mode, /ch = tutor (or note if text follows).
 * @returns {{ patientMode: boolean, remainder: string } | null}
 */
export function parseChatModeCommand(text) {
  const raw = String(text || '').trim();
  if (!raw.startsWith('/')) return null;

  const pt = raw.match(/^\/(?:pt|patient)\b(?:\s+([\s\S]*))?$/i);
  if (pt) {
    return { patientMode: true, remainder: (pt[1] || '').trim() };
  }

  const ch = raw.match(/^\/(?:ch|chat)\b(?:\s+([\s\S]*))?$/i);
  if (ch) {
    return { patientMode: false, remainder: (ch[1] || '').trim() };
  }

  return null;
}
