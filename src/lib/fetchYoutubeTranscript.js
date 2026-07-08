import { mergeTranscriptCues } from './youtubePlayer.js';
import { apiUrl } from './apiBase.js';

const cache = new Map();

/**
 * @returns {Promise<{ text: string, cues: { start: number, dur?: number, text: string }[], language: string }>}
 */
export async function fetchYoutubeTranscript(youtubeId, { merge = true } = {}) {
  const id = String(youtubeId || '').trim();
  if (!id) throw new Error('Missing video id');
  const cacheKey = merge ? `${id}:merged` : id;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const promise = fetch(apiUrl(`/api/youtube-transcript/${encodeURIComponent(id)}`))
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'No transcript available');
      const rawCues = Array.isArray(data.cues) ? data.cues : [];
      const cues = merge ? mergeTranscriptCues(rawCues) : rawCues;
      const text =
        String(data.transcript || '').trim() ||
        cues.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim();
      return {
        text,
        cues,
        language: data.language || 'en',
      };
    })
    .catch((err) => {
      cache.delete(cacheKey);
      throw err;
    });

  cache.set(cacheKey, promise);
  return promise;
}
