import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { filterWorkingVideos, youtubeIdFromUrl } from './youtubeUtils.js';
import { isRelevantMedicalVideo, searchWorkingYouTubeVideos } from './youtubeSearchRepair.js';
import { sanitizeRealWorldStories } from './realWorldStoryQuality.js';

function geminiApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

const MODEL_FALLBACKS = [
  process.env.GEMINI_REALWORLD_MODEL || 'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
].filter((v, i, arr) => arr.indexOf(v) === i);

export function geminiRealWorldAvailable() {
  return Boolean(geminiApiKey());
}

function normalizeStory(raw, index) {
  const videos = (Array.isArray(raw?.videos) ? raw.videos : [])
    .map((v) => {
      const url = String(v?.url || '').trim();
      const youtubeId = v?.youtubeId || youtubeIdFromUrl(url);
      if (!url && !youtubeId) return null;
      return {
        title: String(v?.title || 'YouTube').trim(),
        url: url || `https://www.youtube.com/watch?v=${youtubeId}`,
        youtubeId,
      };
    })
    .filter(Boolean)
    .slice(0, 2);

  return {
    id: String(raw?.id || `gemini-${index + 1}`).trim(),
    tier: raw?.tier === 'adjacent' ? 'adjacent' : 'direct',
    name: String(raw?.name || 'Unknown patient').trim(),
    headline: String(raw?.headline || '').trim(),
    summary: String(raw?.summary || '').trim(),
    videos,
    source: 'gemini',
  };
}

function parseStoriesFromGemini(data) {
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join('') || '';

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const block = text.match(/\{[\s\S]*\}/);
    if (!block) return [];
    parsed = JSON.parse(block[0]);
  }

  const list = Array.isArray(parsed?.stories) ? parsed.stories : [];
  return list.map(normalizeStory).filter((s) => s.name && s.summary).slice(0, 2);
}

function buildPrompt({ caseId, topic, diagnosis, chiefComplaint, hpiSnippet }) {
  return `You are helping a medical student find REAL documented patient cases for a USMLE Step 3 CCS practice case.

Use Google Search to find verifiable real-world patient stories (news, documentaries, hospital features, TED talks) that match this presentation and diagnosis.

CCS Case ${caseId}
Topic / presentation: ${topic || '—'}
Diagnosis: ${diagnosis || '—'}
Chief complaint: ${chiefComplaint || '—'}
Clinical context: ${(hpiSnippet || '').slice(0, 600)}

Requirements:
- Return EXACTLY 2 distinct real stories (not fictional).
- Story 1 — tier "direct": documented patient matching this CCS diagnosis/presentation.
- Story 2 — tier "adjacent": broader REAL public story teaching AROUND this specific topic (organ-donor for sepsis; water-safety for drowning). The teaching link must fit THIS chief complaint.
- NEVER use Michael Phelps except drowning / near-drowning / submersion / water-rescue cases. Do not default to post-Olympic depression for unrelated presentations.
- Do NOT reuse the same celebrity across different medical topics.
- Each story: what happened, key medical teaching point, organism/etiology if known.
- Prefer famous direct teaching cases when they exist (e.g. Alex Lewis for strep TSS/NF).
- Include 1–2 YouTube watch URLs per story when available (interviews, documentaries).
- For each story with a primary YouTube video, write "summary" as a rich video guide:
  • Opening paragraph: patient story + teaching point.
  • Section headings on their own line when useful (Treatment, Living with illness, Their message).
  • Embed YouTube timestamps inline at key moments — format M:SS or H:MM:SS (from the linked video chapters/captions when possible).
  • End with a Highlights block listing 5–8 relatable moments the student should jump to:
    Highlights
    0:29 First signs dismissed as allergies
    2:59 The hike that changed everything
    (one line per moment: TIMESTAMP then short label)
- Only include YouTube URLs you found in Google Search — never invent or guess video IDs.
- Direct-tier videos must match the patient/condition; adjacent-tier videos may teach the broader angle named in the headline.
- Note common confusions (e.g. Strep vs Staph) when relevant.

Return JSON only:
{
  "stories": [
    {
      "id": "kebab-case-slug",
      "tier": "direct",
      "name": "Full name",
      "headline": "One line",
      "summary": "Multi-paragraph video guide with inline M:SS timestamps + Highlights section (see requirements)",
      "videos": [{ "title": "Video title", "url": "https://www.youtube.com/watch?v=..." }]
    },
    {
      "id": "adjacent-slug",
      "tier": "adjacent",
      "name": "Full name",
      "headline": "One line — teaching angle",
      "summary": "Multi-paragraph video guide with inline M:SS timestamps + Highlights section (see requirements)",
      "videos": [{ "title": "Video title", "url": "https://www.youtube.com/watch?v=..." }]
    }
  ]
}`;
}

function isRetryableGeminiError(message = '') {
  return /high demand|overloaded|429|503|unavailable|try again/i.test(String(message));
}

async function fetchRealWorldWithModel(ctx, model) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey())}`;

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(ctx) }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.35,
      },
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${r.status}`;
    throw new Error(msg);
  }

  const stories = parseStoriesFromGemini(data);
  const { stories: cleaned } = sanitizeRealWorldStories(stories, ctx);
  const grounding = data?.candidates?.[0]?.groundingMetadata || null;

  return {
    stories: cleaned,
    model,
    webSearchQueries: grounding?.webSearchQueries || [],
    groundingChunks: (grounding?.groundingChunks || []).slice(0, 8).map((c) => ({
      title: c?.web?.title || c?.retrievedContext?.title || '',
      uri: c?.web?.uri || c?.retrievedContext?.uri || '',
    })),
  };
}

export async function fetchRealWorldWithGemini(ctx) {
  if (!geminiApiKey()) {
    throw new Error('Add GEMINI_API_KEY to MeWorld/.env (Google AI Studio key for Search grounding)');
  }

  let lastError = null;
  for (const model of MODEL_FALLBACKS) {
    try {
      return await fetchRealWorldWithModel(ctx, model);
    } catch (err) {
      lastError = err;
      if (!isRetryableGeminiError(err?.message)) throw err;
    }
  }
  throw lastError || new Error('Gemini real-world search failed');
}

function parseVideosFromGemini(data) {
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join('') || '';

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const block = text.match(/\{[\s\S]*\}/);
    if (!block) return [];
    parsed = JSON.parse(block[0]);
  }

  const list = Array.isArray(parsed?.videos) ? parsed.videos : [];
  return list
    .map((v) => {
      const url = String(v?.url || '').trim();
      const youtubeId = v?.youtubeId || youtubeIdFromUrl(url);
      if (!url && !youtubeId) return null;
      return {
        title: String(v?.title || 'YouTube').trim(),
        url: url || `https://www.youtube.com/watch?v=${youtubeId}`,
        youtubeId,
      };
    })
    .filter(Boolean)
    .slice(0, 2);
}

function buildRepairPrompt({
  patientName,
  headline,
  summary = '',
  diagnosis,
  topic,
  brokenTitles = [],
  tier = 'direct',
  ccsDiagnosis = '',
} = {}) {
  const redacted = /^[A-Za-z][A-Za-z'-]+\s+[A-Z]\.?$/.test(String(patientName || '').trim());
  const adjacent = tier === 'adjacent';
  return `Find WORKING, PUBLIC YouTube videos for this REAL medical story.

Tier: ${tier}${adjacent ? ' (broader teaching angle — NOT required to be the same diagnosis as the CCS case)' : ' (direct patient/condition match)'}
Patient / subject: ${patientName}${redacted ? ' (anonymized — do NOT search celebrity names like Charlie Sheen)' : ''}
Headline: ${headline || '—'}
Summary: ${(summary || '').slice(0, 500)}
Condition keywords: ${diagnosis || '—'}
CCS case diagnosis: ${ccsDiagnosis || '—'}
CCS presentation: ${topic || '—'}
Broken or wrong previous links: ${brokenTitles.length ? brokenTitles.join('; ') : 'none provided'}

Use Google Search on YouTube. Prefer:
${adjacent
    ? `- Interviews/documentaries about the headline teaching angle (e.g. mental health advocacy, water safety, survivor story)
- Educational medical segments that match the ADJACENT headline — not random celebrity sports highlights`
    : `- Medical lectures / genetics rounds on the SAME condition (e.g. ACAN, aggrecan, whole-exome short stature)
- Hospital or endocrinology channels (Children's National, pediatric endocrine society)
- Patient documentaries that match the condition — NOT a different disease sharing the first name`}

${redacted && !adjacent ? 'Do NOT search by first name only — search condition + genetics instead.' : !adjacent ? `Also try: "${patientName} patient story interview"` : `Try: "${patientName} ${headline}" interview documentary`}

Return ONLY videos that appear in search results and are currently public on YouTube.
Do not invent video IDs.

Return JSON only:
{
  "videos": [
    { "title": "Exact title from YouTube", "url": "https://www.youtube.com/watch?v=..." }
  ]
}
Maximum 2 videos.`;
}

async function fetchRepairVideosWithModel(ctx, model) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey())}`;

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildRepairPrompt(ctx) }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.25 },
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${r.status}`;
    throw new Error(msg);
  }

  return parseVideosFromGemini(data);
}

export async function fetchRepairVideosWithGemini(ctx) {
  if (!geminiApiKey()) return [];

  const repairCtx = {
    ...ctx,
    diagnosis: ctx.diagnosis || ctx.headline || ctx.summary || '',
  };

  let lastError = null;
  for (const model of MODEL_FALLBACKS) {
    try {
      const candidates = await fetchRepairVideosWithModel(repairCtx, model);
      const { working } = await filterWorkingVideos(candidates);
      if (working.length) return working;
    } catch (err) {
      lastError = err;
      if (!isRetryableGeminiError(err?.message)) break;
    }
  }

  if (lastError) console.warn('[real-world] repair search failed:', lastError.message);
  return [];
}

/** Drop dead embeds; Gemini re-search per story; oEmbed-check before save. */
export async function ensureStoriesHaveWorkingVideos(stories = [], ctx = {}) {
  const out = [];
  let repaired = false;

  for (const story of stories) {
    const repairCtx = {
      patientName: story.name,
      headline: story.headline,
      summary: story.summary,
      diagnosis: story.tier === 'adjacent' ? story.headline : ctx.diagnosis,
      topic: ctx.topic,
      tier: story.tier || 'direct',
      ccsDiagnosis: ctx.diagnosis,
    };

    const { working, broken } = await filterWorkingVideos(story.videos);
    let videos = working.filter((v) => isRelevantMedicalVideo(v.title, repairCtx));
    const irrelevant = working.filter((v) => !videos.some((ok) => ok.youtubeId === v.youtubeId));
    if (irrelevant.length) repaired = true;

    if (videos.length < 2) {
      const repairCtxWithBroken = {
        ...repairCtx,
        brokenTitles: [...broken, ...irrelevant].map((b) => b.title),
      };

      const found = await searchWorkingYouTubeVideos(
        {
          ...repairCtxWithBroken,
          summary: story.summary,
          tier: story.tier || 'direct',
          ccsDiagnosis: ctx.diagnosis,
        },
        2 - videos.length,
      );

      for (const v of found) {
        if (!videos.some((w) => w.youtubeId === v.youtubeId)) videos.push(v);
        if (videos.length >= 2) break;
      }
      if (found.length) repaired = true;
    }

    if (broken.length) repaired = true;
    out.push({ ...story, videos: videos.slice(0, 2) });
  }

  return { stories: out, repaired };
}

import {
  cachePath,
  readRealWorldCache,
  writeRealWorldCache,
} from './realWorldCacheStore.js';

export { cachePath, readRealWorldCache, writeRealWorldCache };
