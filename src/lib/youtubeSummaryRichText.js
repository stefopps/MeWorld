/** Parse M:SS / H:MM:SS timestamps in Real World story summaries for video seek links. */

export function parseTimestampToSeconds(ts) {
  const s = String(ts || '').trim();
  if (!s) return 0;
  const parts = s.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

const HIGHLIGHTS_HEADING = /(?:^|\n)\s*(?:#{1,3}\s*)?Highlights\s*(?:\n|$)/i;

export function splitSummarySections(text) {
  const raw = String(text || '').trim();
  if (!raw) return { body: '', highlights: [] };

  const match = raw.match(HIGHLIGHTS_HEADING);
  if (!match || match.index == null) return { body: raw, highlights: [] };

  const body = raw.slice(0, match.index).trim();
  const tail = raw.slice(match.index + match[0].length).trim();
  return { body, highlights: parseHighlightLines(tail) };
}

export function parseHighlightLines(block) {
  const lines = String(block || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-•*]\s*/, '');
    const m = cleaned.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (m) {
      out.push({
        time: m[1],
        seconds: parseTimestampToSeconds(m[1]),
        label: m[2].trim(),
      });
    }
  }
  return out;
}

const TIMESTAMP_RE = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;

/** Split prose into alternating text / timestamp tokens. */
export function tokenizeTimestamps(text) {
  const s = String(text || '');
  if (!s) return [];

  const tokens = [];
  let last = 0;
  let m;
  const re = new RegExp(TIMESTAMP_RE.source, 'g');
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: s.slice(last, m.index) });
    tokens.push({ type: 'ts', value: m[1], seconds: parseTimestampToSeconds(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < s.length) tokens.push({ type: 'text', value: s.slice(last) });
  return tokens;
}

export function summaryHasTimestamps(text) {
  const { body, highlights } = splitSummarySections(text);
  if (highlights.length) return true;
  TIMESTAMP_RE.lastIndex = 0;
  return TIMESTAMP_RE.test(body);
}
