import { fetchGeminiRealWorld } from './fetchGeminiRealWorld.js';

/** @typedef {{ status: 'loading'|'ready'|'error', data?: object, error?: Error, promise?: Promise<object> }} PrefetchEntry */

/** @type {Map<string, PrefetchEntry>} */
const cache = new Map();

function cacheKey(caseId) {
  return String(caseId);
}

function applyEntry(key, entry) {
  cache.set(key, entry);
  for (const listener of listeners) {
    try {
      listener(key, entry);
    } catch {
      /* ignore */
    }
  }
}

const listeners = new Set();

/** Subscribe to prefetch updates (caseId string, entry). Returns unsubscribe. */
export function subscribeRealWorldPrefetch(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRealWorldPrefetch(caseId) {
  return cache.get(cacheKey(caseId)) || null;
}

export function invalidateRealWorldPrefetch(caseId) {
  cache.delete(cacheKey(caseId));
}

/**
 * Start (or reuse) a real-world story search for this case.
 * Safe to call as soon as the case loads — results are cached for the Real World tab.
 */
export function prefetchRealWorldStories(params, { refresh = false } = {}) {
  const key = cacheKey(params?.caseId);
  if (!key || key === 'undefined') return Promise.reject(new Error('Missing caseId'));

  if (refresh) {
    cache.delete(key);
  }

  const existing = cache.get(key);
  if (!refresh && existing?.status === 'ready' && existing.data) {
    return Promise.resolve(existing.data);
  }
  if (!refresh && existing?.status === 'loading' && existing.promise) {
    return existing.promise;
  }

  applyEntry(key, { status: 'loading', promise: null });

  const promise = fetchGeminiRealWorld({ ...params, refresh })
    .then((data) => {
      applyEntry(key, { status: 'ready', data, error: null });
      return data;
    })
    .catch((error) => {
      applyEntry(key, {
        status: 'error',
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    });

  applyEntry(key, { status: 'loading', data: null, error: null, promise });
  return promise;
}
