/** Prefer one direct + one adjacent story when both exist. */
export function mergeStoriesByTier(stories = [], max = 2) {
  const all = stories.filter(Boolean);
  const direct = all.filter((s) => (s.tier || 'direct') !== 'adjacent');
  const adjacent = all.filter((s) => s.tier === 'adjacent');
  const out = [];
  const seen = new Set();

  const pick = (list) => {
    for (const s of list) {
      const key = `${s.name}|${s.headline}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      return true;
    }
    return false;
  };

  pick(direct);
  pick(adjacent);

  for (const s of all) {
    if (out.length >= max) break;
    const key = `${s.name}|${s.headline}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }

  return out.slice(0, max);
}
