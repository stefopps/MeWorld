/** CCS review Case Summary block — "Differential: …" + teaching paragraph. */

export function parseCcsCaseSummaryText(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return { differential: '', body: '', full: '' };

  const match = raw.match(/^Differential:\s*([\s\S]*?)(?:\.\s*\n+|\.\s+)([\s\S]*)$/i);
  if (!match) {
    return { differential: '', body: raw, full: raw };
  }

  const differential = match[1].replace(/\s+/g, ' ').trim();
  const body = match[2].replace(/\s+/g, ' ').trim();
  return {
    differential,
    body,
    full: `Differential: ${differential}.\n\n${body}`.trim(),
  };
}

/** Best Case Summary text for display — prefer CCS review block over rewritten HPI. */
export function resolveCaseSummaryText(review) {
  if (!review) return '';
  const summary = String(review.caseSummary || '').trim();
  if (summary) return summary;
  const history = String(review.history || '').trim();
  if (history.startsWith('Differential:')) return history;
  return String(review.hpiNarrative || '').trim();
}
