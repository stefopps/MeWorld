import { deepseekRealWorldAvailable, fetchRealWorldWithDeepSeek } from './deepseekRealWorld.js';
import {
  fetchRealWorldWithGemini,
  geminiRealWorldAvailable,
} from './geminiRealWorld.js';

/**
 * deepseek (default when key set — no Gemini free-tier quota)
 * gemini if REAL_WORLD_PROVIDER=gemini or only GEMINI_API_KEY is set
 */
export function realWorldProvider() {
  const forced = String(process.env.REAL_WORLD_PROVIDER || '').toLowerCase();
  if (forced === 'gemini') return geminiRealWorldAvailable() ? 'gemini' : null;
  if (forced === 'deepseek') return deepseekRealWorldAvailable() ? 'deepseek' : null;
  if (deepseekRealWorldAvailable()) return 'deepseek';
  if (geminiRealWorldAvailable()) return 'gemini';
  return null;
}

function isGeminiQuotaError(message = '') {
  return /quota|rate.?limit|resource.?exhausted|429|too many requests/i.test(String(message));
}

export function realWorldAvailable() {
  return Boolean(realWorldProvider());
}

export async function fetchRealWorldStories(ctx) {
  const provider = realWorldProvider();
  if (provider === 'deepseek') return fetchRealWorldWithDeepSeek(ctx);
  if (provider === 'gemini') {
    try {
      return await fetchRealWorldWithGemini(ctx);
    } catch (err) {
      const msg = String(err?.message || err);
      if (deepseekRealWorldAvailable() && isGeminiQuotaError(msg)) {
        const fallback = await fetchRealWorldWithDeepSeek(ctx);
        return { ...fallback, provider: 'deepseek', fallbackReason: 'gemini-quota' };
      }
      throw err;
    }
  }
  throw new Error('Add DEEPSEEK_API_KEY to MeWorld/.env (preferred) or GEMINI_API_KEY');
}
