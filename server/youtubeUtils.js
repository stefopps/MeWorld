const AVAIL_CACHE = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

export function youtubeIdFromUrl(url = '') {
  const m = String(url).match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  );
  return m?.[1] || '';
}

export async function youtubeVideoAvailable(youtubeId) {
  const id = String(youtubeId || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return false;

  const cached = AVAIL_CACHE.get(id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.ok;

  const watch = `https://www.youtube.com/watch?v=${id}`;
  let ok = false;
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
      { signal: AbortSignal.timeout(9000) },
    );
    ok = r.ok;
  } catch {
    ok = false;
  }

  AVAIL_CACHE.set(id, { ok, at: Date.now() });
  return ok;
}

export async function filterWorkingVideos(videos = []) {
  const working = [];
  const broken = [];

  for (const raw of videos) {
    const youtubeId = raw?.youtubeId || youtubeIdFromUrl(raw?.url);
    if (!youtubeId) {
      broken.push(raw);
      continue;
    }
    const available = await youtubeVideoAvailable(youtubeId);
    const row = {
      title: String(raw?.title || 'YouTube').trim(),
      url: String(raw?.url || '').trim() || `https://www.youtube.com/watch?v=${youtubeId}`,
      youtubeId,
    };
    if (available) working.push(row);
    else broken.push(row);
  }

  return { working, broken };
}
