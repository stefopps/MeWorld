import { buildCaseDiscussionContext } from './caseDiscussionContext.js';
import { readCaseNotes } from './caseNotes.js';
import { buildTeachCompareChatContext } from './teachMeCompare.js';

function formatTimelineElapsed(at, sessionStartedAt) {
  if (!sessionStartedAt || !at) return null;
  const delta = Math.max(0, at - sessionStartedAt);
  const totalSec = Math.floor(delta / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `T+${m}:${String(s).padStart(2, '0')}`;
}

import { readTeachingMoments } from './teachingMoments.js';
export function buildChatSessionContext({
  careUnit = '',
  orderTimelineEvents = [],
  conversationLog = [],
  placed = {},
  interventions = [],
  caseId = null,
  teachMeMode = false,
  placementOrder = [],
  interventionById = {},
  nextExpectedId = null,
  reviewResults = null,
  sessionStartedAt = null,
}) {
  const ordersTimeline = orderTimelineEvents.map((ev, i) => ({
    seq: ev.orderIndex ?? i + 1,
    label: ev.label,
    kind: ev.kind || 'order',
    clockTime: ev.at ? new Date(ev.at).toLocaleTimeString() : null,
    elapsed: formatTimelineElapsed(ev.at, sessionStartedAt),
  }));

  const stacksPlaced = (interventions || [])
    .filter((iv) => placed[iv.id])
    .map((iv) => iv.label);

  const sessionActivity = (conversationLog || []).slice(-50).map((e) => ({
    role: e.role,
    text: e.content,
  }));

  const learnerNotes = caseId ? readCaseNotes(caseId).trim().slice(-6000) : '';
  const teachingMoments = caseId ? readTeachingMoments(caseId) : [];
  const caseDiscussion = caseId ? buildCaseDiscussionContext(caseId) : null;

  const ctx = {
    currentLocation: careUnit || null,
    ordersTimeline,
    ordersThisSession: ordersTimeline,
    stacksPlaced,
    sessionActivity,
    learnerNotes: learnerNotes || null,
    teachingMoments,
    caseDiscussion,
  };

  if (teachMeMode) {
    ctx.standardFlow = buildTeachCompareChatContext({
      interventions,
      interventionById,
      placementOrder,
      placed,
      nextExpectedId,
      reviewResults,
    });
    ctx.tutorHint =
      'Teach Me mode is on. Use standardFlow (ideal CCS sequence vs the learner’s placement order) and ordersTimeline to explain where they went out of order, what step is next, and why the standard sequence matters.';
  }

  return ctx;
}

export function formatChatSessionContextBlock(ctx) {
  if (!ctx || typeof ctx !== 'object') return '';
  const hasData =
    ctx.ordersTimeline?.length ||
    ctx.ordersThisSession?.length ||
    ctx.stacksPlaced?.length ||
    ctx.sessionActivity?.length ||
    ctx.learnerNotes ||
    ctx.currentLocation ||
    ctx.standardFlow;
  if (!hasData) return '';
  const header = ctx.standardFlow
    ? '[SESSION SO FAR — standard flow compare, order timeline, notes, and scene activity for this run]'
    : '[SESSION SO FAR — orders, notes, and scene activity for this run]';
  return `${header}\n${JSON.stringify(ctx, null, 2)}`;
}
