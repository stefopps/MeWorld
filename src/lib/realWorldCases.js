import catalog from '../data/realWorldCases.json' with { type: 'json' };
import bakedCatalog from '../data/realWorldCasesBaked.json' with { type: 'json' };

const MAX = catalog.maxPerCase ?? 2;

function norm(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreStory(story, { caseId, diagnosis, topic }) {
  let score = 0;
  const id = Number(caseId);
  const dx = norm(diagnosis);
  const top = norm(topic);

  if (story.match?.caseIds?.includes(id)) score += 100;

  for (const needle of story.match?.diagnoses || []) {
    const n = norm(needle);
    if (!n) continue;
    if (dx && (dx.includes(n) || n.includes(dx))) score += 40;
  }

  if (score > 0) {
    for (const needle of story.match?.topics || []) {
      const n = norm(needle);
      if (!n || !top) continue;
      if (top.includes(n) || n.includes(top)) score += 10;
    }
  }

  return score;
}

function dedupeStories(stories) {
  const out = [];
  const seen = new Set();
  for (const raw of stories) {
    if (!raw?.id) continue;
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    out.push(raw);
  }
  return out;
}

function bakedStoriesForCase(caseId) {
  const row = bakedCatalog.byCaseId?.[String(caseId)];
  if (!row?.stories?.length) return [];
  return row.stories.map((s) => ({ ...s, source: s.source || 'baked' }));
}

export function buildYouTubeSearchUrl({ diagnosis = '', topic = '', name = '' } = {}) {
  const parts = [name, diagnosis, topic, 'patient story documentary medical'].filter(Boolean);
  const q = encodeURIComponent(parts.join(' ').trim());
  return `https://www.youtube.com/results?search_query=${q}`;
}

/** Up to two real-world patient stories with optional YouTube embeds. */
export function getRealWorldStories({ caseId, diagnosis = '', topic = '' } = {}) {
  const baked = bakedStoriesForCase(caseId);
  const searchUrl = buildYouTubeSearchUrl({ diagnosis, topic });

  if (baked.length >= MAX) {
    return {
      stories: baked.slice(0, MAX),
      searchUrl,
      hasCurated: true,
      hasBaked: true,
      offlineReady: true,
    };
  }

  const stories = catalog.stories || [];
  const ranked = stories
    .map((story) => ({ story, score: scoreStory(story, { caseId, diagnosis, topic }) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const curated = [];
  const seen = new Set();
  for (const { story } of ranked) {
    if (seen.has(story.id)) continue;
    seen.add(story.id);
    curated.push(story);
    if (curated.length >= MAX) break;
  }

  const merged = dedupeStories([...baked, ...curated]).slice(0, MAX);

  return {
    stories: merged,
    searchUrl,
    hasCurated: curated.length > 0 || baked.length > 0,
    hasBaked: baked.length > 0,
    offlineReady: merged.length >= MAX,
  };
}

export function youtubeEmbedUrl(youtubeId) {
  if (!youtubeId) return '';
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`;
}
