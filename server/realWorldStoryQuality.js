/**
 * Filter low-quality / anchor-biased Real World stories before cache + UI.
 * DeepSeek often returns Michael Phelps as the "adjacent" story for unrelated cases
 * because the prompt used him as the canonical example.
 */

const PHELPS_RE = /\bmichael\s+phelps\b/i;
const DROWNING_CTX_RE =
  /\b(drown|near[\s-]?drown|submersion|rescue|pool|water[\s-]?safety|lifeguard)\b/i;

/** Public figures DeepSeek overuses when given celebrity examples in the prompt. */
const OVERUSED_ADJACENT_CELEBS = [
  { pattern: PHELPS_RE, allowWhen: (ctx) => phelpsContextOk(ctx) },
];

function norm(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contextBlob(ctx = {}) {
  return norm(
    [ctx.topic, ctx.diagnosis, ctx.chiefComplaint, ctx.hpiSnippet].filter(Boolean).join(' '),
  );
}

export function phelpsContextOk(ctx = {}) {
  if (Number(ctx.caseId) === 113) return true;
  const blob = contextBlob(ctx);
  return DROWNING_CTX_RE.test(blob);
}

function storyText(story = {}) {
  return norm([story.name, story.headline, story.summary].join(' '));
}

function isWeakAdjacentStretch(story, ctx) {
  if (story?.tier !== 'adjacent') return false;
  const summary = String(story.summary || '');
  // Model confession that the story doesn't fit this case.
  if (
    /\bwhile not (directly )?(about|related to|a case of)\b/i.test(summary) ||
    /\bnot (directly )?(about|related to|the same)\b/i.test(summary)
  ) {
    const blob = contextBlob(ctx);
    const dx = norm(ctx.diagnosis || '');
    const topic = norm(ctx.topic || '');
    const mentionsCaseTopic =
      (dx && storyText(story).includes(dx)) ||
      (topic && topic.length > 4 && storyText(story).includes(topic));
    if (!mentionsCaseTopic) return true;
  }
  return false;
}

export function rejectRealWorldStory(story, ctx = {}) {
  if (!story?.name || !story?.summary) return 'empty';

  for (const rule of OVERUSED_ADJACENT_CELEBS) {
    if (rule.pattern.test(storyText(story)) && !rule.allowWhen(ctx)) {
      return 'overused-celebrity';
    }
  }

  if (isWeakAdjacentStretch(story, ctx)) {
    return 'weak-adjacent';
  }

  return null;
}

/** Drop bad stories; keep direct tier even if adjacent was removed. */
export function sanitizeRealWorldStories(stories = [], ctx = {}) {
  const input = Array.isArray(stories) ? stories : [];
  const kept = [];
  const rejected = [];

  for (const story of input) {
    const reason = rejectRealWorldStory(story, ctx);
    if (reason) rejected.push({ story, reason });
    else kept.push(story);
  }

  return { stories: kept, rejected, sanitized: rejected.length > 0 };
}
