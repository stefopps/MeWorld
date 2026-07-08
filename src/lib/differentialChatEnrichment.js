import { getRealWorldStories } from './realWorldCases.js';
import { getRealWorldPrefetch } from './realWorldPrefetch.js';
import { listCaseYoutubeTranscripts } from './caseYoutubeTranscripts.js';
import { summarizePictureNotesForChat } from './casePictureNotes.js';

const MAX_TRANSCRIPT_CHARS = 4000;
const MAX_STORIES = 8;

function clip(text, max) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function normalizeStory(story) {
  if (!story || typeof story !== 'object') return null;
  const videos = (story.videos || [])
    .map((v) => ({
      youtubeId: String(v?.youtubeId || '').trim(),
      title: String(v?.title || 'YouTube').trim(),
      tier: v?.tier || null,
    }))
    .filter((v) => v.youtubeId);
  return {
    name: String(story.name || story.title || 'Patient story').trim(),
    summary: clip(story.summary || story.headline || '', 1200),
    tier: story.tier || null,
    headline: story.headline || null,
    videos,
  };
}

function mergeRealWorldStories(curatedStories = [], remoteStories = []) {
  const out = [];
  const seen = new Set();
  for (const raw of [...remoteStories, ...curatedStories]) {
    const row = normalizeStory(raw);
    if (!row) continue;
    const key = `${row.name}:${row.summary.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= MAX_STORIES) break;
  }
  return out;
}

/** CCS review, treatment stacks, answer key, and Real World videos for tutor chat. */
export function buildDifferentialChatEnrichment({
  caseId,
  bankEntry = null,
  ccsReview = null,
  caseData = null,
} = {}) {
  const id = String(caseId || '');
  if (!id) return null;

  const diagnosis =
    bankEntry?.diagnosis || ccsReview?.diagnosis || caseData?.diagnosis || '';
  const topic = bankEntry?.topic || ccsReview?.title || caseData?.topic || '';

  const curated = getRealWorldStories({ caseId: id, diagnosis, topic });
  const prefetch = getRealWorldPrefetch(id);
  const remoteStories = prefetch?.status === 'ready' ? prefetch.data?.stories || [] : [];

  const stacks = Array.isArray(caseData?.stacks) ? caseData.stacks : [];
  const transcripts = listCaseYoutubeTranscripts(id).map((v) => ({
    youtubeId: v.youtubeId,
    title: v.title || 'YouTube',
    transcript: clip(v.text, MAX_TRANSCRIPT_CHARS),
    savedAt: v.savedAt || null,
  }));

  const pictureNotes = summarizePictureNotesForChat(id);

  return {
    caseId: Number(id) || id,
    differentialAnswerKey: {
      topic,
      correctDiagnosis: diagnosis,
      differentials: bankEntry?.diagnoses || [],
    },
    ccsReview: ccsReview
      ? {
          title: ccsReview.title,
          diagnosis: ccsReview.diagnosis,
          chiefComplaint: ccsReview.chiefComplaint,
          specialty: ccsReview.specialty,
          location: ccsReview.location,
          caseSummary: ccsReview.caseSummary,
          hpiNarrative: ccsReview.hpiNarrative,
          ordersText: ccsReview.ordersText,
          orders: ccsReview.orders || [],
        }
      : null,
    treatmentStacks: stacks.map((s) => ({
      label: s.label,
      type: s.type,
      finding: s.finding,
      aliases: s.aliases || [],
    })),
    correctOrders: caseData?.correct_orders || [],
    shouldAvoid: caseData?.should_avoid || [],
    orderRationale: caseData?.rationale || null,
    orderSets: caseData?.order_sets || [],
    realWorldStories: mergeRealWorldStories(curated.stories, remoteStories),
    realWorldPrefetchStatus: prefetch?.status || 'none',
    savedVideoTranscripts: transcripts,
    pictureNotes: pictureNotes.length ? pictureNotes : null,
  };
}

export function enrichmentCacheKey(enrichment) {
  if (!enrichment) return '';
  try {
    return JSON.stringify({
      stacks: enrichment.treatmentStacks?.length || 0,
      orders: enrichment.ccsReview?.orders?.length || 0,
      stories: enrichment.realWorldStories?.length || 0,
      videos: enrichment.savedVideoTranscripts?.length || 0,
      lastTranscript: enrichment.savedVideoTranscripts?.at(-1)?.savedAt || '',
      prefetch: enrichment.realWorldPrefetchStatus,
      dx: enrichment.differentialAnswerKey?.correctDiagnosis || '',
      pics: enrichment.pictureNotes?.length || 0,
      lastPic: enrichment.pictureNotes?.at(-1)?.at || '',
    });
  } catch {
    return '';
  }
}
