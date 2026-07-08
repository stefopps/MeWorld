/** Spoken punctuation Web Speech often literalizes. */
const SPOKEN_PUNCT = /\b(comma|period|full stop|semicolon|dot)\b/gi;

const FILLER_PREFIX =
  /^(?:it\s+)?(?:could\s+)?(?:also\s+)?(?:be\s+)?(?:a|an|the)\s+/i;

/** Clean one diagnosis label from typed or spoken input. */
export function normalizeDiagnosisGuess(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(SPOKEN_PUNCT, ' ');
  s = s.replace(FILLER_PREFIX, '');
  s = s.replace(/^(?:also|and)\s+/i, '');
  s = s.replace(/[.!?]+$/g, '').trim();
  s = s.replace(/\s+(comma|period)$/i, '').trim();
  return s;
}

/** Split a line or voice chunk into individual diagnoses. */
export function parseDiagnosisList(raw) {
  const text = String(raw || '')
    .replace(SPOKEN_PUNCT, ',')
    .replace(/\s+and\s+/gi, ', ');

  const seen = new Set();
  const out = [];

  for (const piece of text.split(/[,;\n.]+/)) {
    const norm = normalizeDiagnosisGuess(piece);
    if (norm.length < 2) continue;
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }

  return out;
}
