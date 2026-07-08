/** Stable shuffle for stack display order (per case + session). */

export function hashSeed(input) {
  let h = 2166136261;
  const str = String(input ?? '');
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededShuffle(items, seed) {
  const list = [...items];
  let s = seed >>> 0;
  for (let i = list.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function buildShuffledStackEntries(interventions, decoys, seedKey) {
  const entries = [
    ...interventions.map((iv) => ({ iv, isDecoy: false })),
    ...decoys.map((iv) => ({ iv, isDecoy: true })),
  ];
  return seededShuffle(entries, hashSeed(seedKey));
}
