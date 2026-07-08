import yts from 'yt-search';
import { youtubeVideoAvailable } from './youtubeUtils.js';
import { fetchRepairVideosWithGemini, geminiRealWorldAvailable } from './geminiRealWorld.js';

/** youtube-api when YOUTUBE_API_KEY set; else yt-search. Gemini only if REAL_WORLD_VIDEO_PROVIDER=gemini|auto */
export function realWorldVideoProvider() {
  const forced = String(process.env.REAL_WORLD_VIDEO_PROVIDER || '').toLowerCase();
  if (forced) return forced;
  if (String(process.env.YOUTUBE_API_KEY || '').trim()) return 'youtube-api';
  return 'yt-search';
}

function youtubeDataApiKey() {
  return String(process.env.YOUTUBE_API_KEY || '').trim();
}

function useGeminiVideoRepair() {
  const mode = realWorldVideoProvider();
  if (mode === 'yt-search' || mode === 'youtube-api') return false;
  if (mode === 'gemini' || mode === 'auto') return geminiRealWorldAvailable();
  return false;
}

const MEDICAL_HINT =
  /patient|medical|disease|syndrome|documentary|hospital|diagnos|condition|rare|health|doctor|icu|emergency|genetic|endocrin|pediatric/i;

const WRONG_NAME_VIDEO =
  /charlie sheen|hiv|aids|athymia|congenital athymia|detective|mystery tale|heart foundation|heart disease|#shorts\b|anemia symptom/i;

function storyText(ctx) {
  return `${ctx.headline || ''} ${ctx.summary || ''}`.toLowerCase();
}

/** "Charlie S." / "Emma S." — anonymized; first-name-only search picks wrong celebrities. */
function isRedactedPatientName(name = '') {
  const n = String(name).trim();
  return /^[A-Za-z][A-Za-z'-]+\s+[A-Z]\.?$/.test(n);
}

function storyKeywords(ctx) {
  const text = storyText(ctx);
  const keys = [];
  const patterns = [
    { re: /\bacan\b|aggrecan/i, queries: ['ACAN gene short stature genetics', 'aggrecan short stature whole exome'] },
    { re: /\bprop1\b|combined pituitary hormone/i, queries: ['PROP1 combined pituitary hormone deficiency', 'PROP1 short stature genetics'] },
    { re: /turner syndrome|45,\s*x/i, queries: ['Turner syndrome patient story documentary', 'Turner syndrome coarctation patient'] },
    { re: /whole[- ]exome|exome sequencing/i, queries: ['whole exome sequencing short stature case', 'genetic diagnosis short stature exome'] },
    { re: /growth hormone deficiency|\bghd\b/i, queries: ['growth hormone deficiency pediatric patient story'] },
    { re: /noonan syndrome/i, queries: ['Noonan syndrome short stature patient'] },
    { re: /hypopituitarism/i, queries: ['hypopituitarism short stature child'] },
  ];
  for (const { re, queries } of patterns) {
    if (re.test(text)) keys.push(...queries);
  }
  if (/short stature/i.test(text) && !keys.length) {
    keys.push('genetic short stature pediatric endocrinology', 'short stature whole exome sequencing');
  }
  return [...new Set(keys)];
}

function conditionQueries(ctx) {
  const text = storyText(ctx);
  const out = [...storyKeywords(ctx)];
  if (/hereditary angioedema|\bhae\b/i.test(text)) {
    out.push('hereditary angioedema patient story documentary');
    out.push('HAE patient interview');
  }
  if (/hsp vasculitis|henoch|schönlein|schonlein/i.test(text)) {
    out.push('Henoch Schonlein purpura patient story');
    out.push('HSP vasculitis patient documentary');
  }
  if (/toxic shock|tss\b/i.test(text)) {
    out.push('toxic shock syndrome patient story documentary');
  }
  if (/necrotizing fasciitis|flesh eating/i.test(text)) {
    out.push('necrotizing fasciitis patient story documentary');
  }
  return out;
}

function buildQueries({
  patientName = '',
  diagnosis = '',
  topic = '',
  headline = '',
  summary = '',
  tier = 'direct',
  ccsDiagnosis = '',
} = {}) {
  const adjacent = tier === 'adjacent';
  const out = adjacent ? [] : [...conditionQueries({ headline, summary, diagnosis, topic })];
  const name = String(patientName).trim();
  const dx = String(diagnosis).trim();
  const top = String(topic).trim();
  const ccsDx = String(ccsDiagnosis || '').trim();
  const redacted = isRedactedPatientName(name);

  if (adjacent) {
    if (name && headline) out.push(`${name} ${headline} interview documentary`);
    if (name) out.push(`${name} mental health interview medical`);
    if (headline) out.push(`${headline} patient story documentary`);
    if (top && ccsDx) out.push(`${top} ${ccsDx.split(/\s+/).slice(0, 3).join(' ')} medical education`);
    if (top) out.push(`${top} real patient story documentary`);
  } else {
    // Story-specific queries beat CCS diagnosis + first name (avoids "Charlie Sheen", wrong Charlie).
    if (!redacted && name && dx) out.push(`${name} ${dx} patient`);
    if (!redacted && name) out.push(`${name} patient story medical documentary`);
    if (!redacted && name && top) out.push(`${name} ${top} patient`);

    if (dx && !redacted) out.push(`${dx} patient story documentary`);
    if (top) out.push(`${top} genetics patient documentary`);
  }

  return [...new Set(out.filter(Boolean))].slice(0, 8);
}

function storyConditionTags(ctx) {
  const text = storyText(ctx);
  const tags = new Set();
  if (/hereditary angioedema|\bhae\b/i.test(text)) tags.add('hae');
  if (/hsp vasculitis|henoch|schönlein|schonlein/i.test(text)) tags.add('hsp');
  if (/toxic shock|\btss\b/i.test(text)) tags.add('tss');
  if (/necrotizing fasciitis|flesh eating/i.test(text)) tags.add('nf');
  if (/\bacan\b|aggrecan/i.test(text)) tags.add('acan');
  if (/\bprop1\b/i.test(text)) tags.add('prop1');
  if (/short stature/i.test(text)) tags.add('short_stature');
  if (/turner/i.test(text)) tags.add('turner');
  return tags;
}

function videoMatchesStoryCondition(title, ctx) {
  const t = String(title || '').toLowerCase();
  const tags = storyConditionTags(ctx);
  if (!tags.size) return true;

  const has = {
    hae: /angioedema|\bhae\b/i.test(t),
    hsp: /vasculitis|purpura|\bhsp\b|henoch/i.test(t),
    tss: /toxic shock|\btss\b/i.test(t),
    nf: /necrotizing|flesh eating|fasciitis/i.test(t),
    acan: /\bacan\b|aggrecan|genetic short stature|short stature.*genetic/i.test(t),
    prop1: /\bprop1\b|pituitary hormone deficiency|combined pituitary/i.test(t),
    short_stature: /short stature|growth disorder|growth hormone|pediatric endocrin|dwarfism|genetic diagnos/i.test(t),
    turner: /turner syndrome|\bturner\b/i.test(t),
  };

  if (tags.has('acan')) return has.acan || has.short_stature;
  if (tags.has('prop1')) return has.prop1 || has.short_stature;
  if (tags.has('turner')) return has.turner || has.short_stature;
  if (tags.has('short_stature') && !tags.has('hae') && !tags.has('hsp')) {
    return has.short_stature || MEDICAL_HINT.test(t);
  }
  if (tags.has('hae') && !tags.has('hsp')) return has.hae || (!has.hsp && MEDICAL_HINT.test(t));
  if (tags.has('hsp') && !tags.has('hae')) return has.hsp || (!has.hae && MEDICAL_HINT.test(t));
  if (tags.has('tss')) return has.tss || MEDICAL_HINT.test(t);
  if (tags.has('nf')) return has.nf || MEDICAL_HINT.test(t);
  return true;
}

function storyKeywordScore(title, ctx) {
  const t = String(title || '').toLowerCase();
  const text = storyText(ctx);
  let score = 0;
  const pairs = [
    ['acan', /\bacan\b|aggrecan/],
    ['aggrecan', /aggrecan/],
    ['whole-exome', /whole.exome|exome sequencing/],
    ['prop1', /\bprop1\b/],
    ['short stature', /short stature/],
    ['growth hormone', /growth hormone/],
    ['turner', /turner/],
    ['coarctation', /coarctation/],
    ['bone age', /bone age/],
    ['genetic', /genetic/],
  ];
  for (const [key, re] of pairs) {
    if (re.test(text) && re.test(t)) score += 4;
  }
  return score;
}

function minRelevanceScore(ctx = {}) {
  return ctx.tier === 'adjacent' ? 1 : 3;
}

function videoRelevanceScore(title, ctx) {
  const t = String(title || '').toLowerCase();
  const text = storyText(ctx);
  const adjacent = ctx.tier === 'adjacent';
  let score = 0;

  if (WRONG_NAME_VIDEO.test(t)) return -20;
  if (!adjacent && !videoMatchesStoryCondition(title, ctx)) return -10;

  if (MEDICAL_HINT.test(t)) score += 2;
  else if (!adjacent) score -= 3;

  score += storyKeywordScore(title, ctx);

  const storyDx = String(ctx.headline || '').toLowerCase();
  for (const word of storyDx.split(/\s+/).filter((w) => w.length > 4)) {
    if (t.includes(word)) score += adjacent ? 3 : 2;
  }

  const ccsDx = String(ctx.ccsDiagnosis || ctx.diagnosis || '').toLowerCase();
  if (!adjacent && ccsDx && text.includes('acan') && ccsDx.includes('turner')) {
    if (/turner/i.test(t) && !/\bacan\b|aggrecan|genetic short stature/i.test(t)) score -= 4;
  } else if (!adjacent && ccsDx) {
    for (const word of ccsDx.split(/\s+/).filter((w) => w.length > 4)) {
      if (t.includes(word)) score += 1;
    }
  }

  if (adjacent) {
    for (const token of ['depression', 'mental health', 'olympic', 'swim', 'drown', 'rescue', 'ptsd', 'advocacy']) {
      if (text.includes(token) && t.includes(token)) score += 4;
    }
  }

  for (const token of ['angioedema', 'hae', 'vasculitis', 'purpura', 'toxic shock', 'sepsis']) {
    if (text.includes(token) && t.includes(token)) score += 4;
  }

  const name = String(ctx.patientName || '').trim();
  if (name && !isRedactedPatientName(name)) {
    const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
    const last = parts[parts.length - 1];
    if (last && t.includes(last)) {
      if (adjacent) score += MEDICAL_HINT.test(t) || /interview|documentary|depression|mental|health|story/i.test(t) ? 4 : -2;
      else score += MEDICAL_HINT.test(t) ? 3 : -6;
    }
    if (t.includes(name.toLowerCase())) score += adjacent ? 5 : 4;
  } else if (name && isRedactedPatientName(name)) {
    const first = name.split(/\s+/)[0]?.toLowerCase();
    if (first && first.length > 2 && t.includes(first) && !MEDICAL_HINT.test(t)) score -= 8;
  }

  if (!adjacent && /\b(baseball|mlb|nba|nfl|audition|promo|highlights)\b/i.test(t)) score -= 8;
  if (adjacent && /\b(highlights|game recap|touchdown|home run)\b/i.test(t)) score -= 10;
  if (/#housemd|#series\b|house md clip|fictional patient/i.test(t)) score -= 12;

  return score;
}

export function isRelevantMedicalVideo(title, ctx = {}) {
  return videoRelevanceScore(title, ctx) >= minRelevanceScore(ctx);
}

async function searchWithYtScrape(ctx, max) {
  const queries = buildQueries(ctx);
  const candidates = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const result = await yts(query);
      for (const row of result?.videos || []) {
        const id = String(row?.videoId || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const title = String(row?.title || 'YouTube').trim();
        const score = videoRelevanceScore(title, ctx);
        if (score < minRelevanceScore(ctx)) continue;
        candidates.push({
          title,
          url: row?.url || `https://www.youtube.com/watch?v=${id}`,
          youtubeId: id,
          score,
        });
      }
    } catch (err) {
      console.warn('[youtube-search]', query, err?.message || err);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const found = [];

  for (const row of candidates) {
    if (found.length >= max) break;
    if (!(await youtubeVideoAvailable(row.youtubeId))) continue;
    found.push({
      title: row.title,
      url: row.url,
      youtubeId: row.youtubeId,
    });
  }

  return found;
}

async function searchWithYouTubeDataApi(ctx, max) {
  const key = youtubeDataApiKey();
  if (!key) return [];

  const queries = buildQueries(ctx);
  const candidates = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: '8',
        q: query,
        key,
        safeSearch: 'moderate',
        videoEmbeddable: 'true',
      });
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
        signal: AbortSignal.timeout(12000),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('[youtube-api]', query, data?.error?.message || r.status);
        continue;
      }
      for (const row of data?.items || []) {
        const id = String(row?.id?.videoId || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const title = String(row?.snippet?.title || 'YouTube').trim();
        const score = videoRelevanceScore(title, ctx);
        if (score < minRelevanceScore(ctx)) continue;
        candidates.push({
          title,
          url: `https://www.youtube.com/watch?v=${id}`,
          youtubeId: id,
          score,
        });
      }
    } catch (err) {
      console.warn('[youtube-api]', query, err?.message || err);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const found = [];
  for (const row of candidates) {
    if (found.length >= max) break;
    if (!(await youtubeVideoAvailable(row.youtubeId))) continue;
    found.push({
      title: row.title,
      url: row.url,
      youtubeId: row.youtubeId,
    });
  }
  return found;
}

/**
 * Find embeddable YouTube videos for a real-world story.
 * Default: YouTube Data API when YOUTUBE_API_KEY set, else yt-search (free).
 */
export async function searchWorkingYouTubeVideos(ctx = {}, max = 2) {
  if (useGeminiVideoRepair()) {
    try {
      const gemini = await fetchRepairVideosWithGemini({
        patientName: ctx.patientName,
        headline: ctx.headline,
        summary: ctx.summary,
        diagnosis: ctx.headline || ctx.summary || ctx.diagnosis,
        topic: ctx.topic,
        brokenTitles: ctx.brokenTitles || [],
        tier: ctx.tier || 'direct',
        ccsDiagnosis: ctx.ccsDiagnosis || '',
      });
      const relevant = gemini.filter((v) => isRelevantMedicalVideo(v.title, ctx));
      if (relevant.length) return relevant.slice(0, max);
    } catch (err) {
      console.warn('[youtube-search] Gemini repair failed:', err?.message || err);
    }
  }

  const mode = realWorldVideoProvider();
  if (mode === 'youtube-api') {
    const apiHits = await searchWithYouTubeDataApi(ctx, max);
    if (apiHits.length) return apiHits;
    console.warn('[youtube-search] YouTube API returned no hits — falling back to yt-search');
  }

  return searchWithYtScrape(ctx, max);
}
