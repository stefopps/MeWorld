/** Leading *( ... )* or ( ... ) stage blocks — multiline OK. */
const LEADING_STAGE_BLOCK =
  /^\s*(?:\*[\s\S]*?\*|\([\s\S]*?\))\s*/;

const INLINE_ACTION = /\*[\s\S]*?\*/g;
const BRACKET_ACTION = /\[[^\]\n]+\]/g;

/** Whole-line stage directions — not dialogue. */
const ACTION_ONLY_LINE =
  /^\s*(?:\*[\s\S]*?\*|\([\s\S]{2,800}\)|\[[^\]]{2,200}\])\s*$/i;

/** First-person physical narration mixed into a line. */
const NARRATION_SENTENCE =
  /^(?:i\s+(?:take|blink|wince|groan|shift|sigh|pause|look|feel|try|struggle|rub)|my\s+(?:voice|head|chest|stomach|back|throat|hand)\s+(?:is|feels|still|sounds)|voice\s+(?:is|feels|still)\s+(?:weak|hoarse|quiet|strained|shaky))/i;

/** True when text likely mixes RP stage directions with dialogue. */
export function looksLikePatientStageReply(text) {
  const src = String(text || '');
  if (!src.trim()) return false;
  if (/\*[\s\S]*?\*/.test(src)) return true;
  if (/^\s*\([\s\S]{8,}\)/m.test(src)) return true;
  if (ACTION_ONLY_LINE.test(src.trim())) return true;
  return NARRATION_SENTENCE.test(src.trim());
}

function stripLeadingStageBlocks(text) {
  let t = String(text || '').trim();
  let prev;
  do {
    prev = t;
    t = t.replace(LEADING_STAGE_BLOCK, '').trim();
  } while (t !== prev && t.length < prev.length);
  return t;
}

function collectStageBlocks(raw) {
  const src = String(raw || '');
  const blocks = [];
  const re = /(?:\*[\s\S]*?\*|\([\s\S]*?\))/g;
  for (const match of src.matchAll(re)) {
    const block = match[0].trim();
    if (block.length > 4) blocks.push(block);
  }
  return blocks;
}

function cleanInlineActions(text) {
  return String(text || '')
    .replace(INLINE_ACTION, ' ')
    .replace(BRACKET_ACTION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dialogueSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !NARRATION_SENTENCE.test(s) && !ACTION_ONLY_LINE.test(s));
}

/** Patient-facing text — spoken words only. */
export function sanitizePatientReplyForDisplay(raw) {
  const src = String(raw || '').trim();
  if (!src) return '';

  let body = stripLeadingStageBlocks(src);
  const kept = [];

  for (const line of body.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed || ACTION_ONLY_LINE.test(trimmed)) continue;
    const cleaned = cleanInlineActions(trimmed);
    if (!cleaned) continue;
    const sentences = dialogueSentences(cleaned);
    if (sentences.length) kept.push(sentences.join(' '));
  }

  let out = kept.join(' ').replace(/\s+/g, ' ').trim();
  if (!out) {
    out = cleanInlineActions(stripLeadingStageBlocks(src));
    out = dialogueSentences(out).join(' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Dialogue-only text for patient TTS. */
export function extractPatientSpokenText(raw) {
  return sanitizePatientReplyForDisplay(raw);
}

/**
 * Split LLM output: dialogue for chat/TTS, stage directions for future video beats.
 * @returns {{ dialogue: string, stageDirections: string, raw: string }}
 */
export function splitPatientReply(raw) {
  const full = String(raw || '').trim();
  const dialogue = sanitizePatientReplyForDisplay(full);
  const blocks = collectStageBlocks(full);
  const stageDirections = blocks.join('\n').trim();
  const fallback =
    dialogue ||
    (looksLikePatientStageReply(full) ? '' : cleanInlineActions(stripLeadingStageBlocks(full)));
  return {
    dialogue: fallback,
    stageDirections,
    raw: full,
  };
}
