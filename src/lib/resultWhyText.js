/** Strip redundant "Why:" prefix and keep result-card interpretation terse. */
export function formatResultWhyExpand(why) {
  let text = String(why || '').trim();
  if (!text) return '';

  text = text
    .replace(/^(?:\*\*)?why\s*:?\s*(?:\*\*)?/i, '')
    .replace(/^rationale\s*:?\s*/i, '')
    .trim();

  if (text.length > 140) {
    const firstSentence = text.match(/^[^.!?]+[.!?]/);
    text = firstSentence ? firstSentence[0].trim() : `${text.slice(0, 137).trim()}…`;
  }

  return text;
}
