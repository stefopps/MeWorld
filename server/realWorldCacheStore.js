import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

function getSupabase() {
  if (supabaseClient !== null) return supabaseClient || null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    supabaseClient = false;
    return null;
  }
  supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  return supabaseClient;
}

/** disk | supabase — supabase when URL + service key set unless forced disk */
export function realWorldCacheBackend() {
  const forced = String(process.env.REAL_WORLD_CACHE || '').toLowerCase();
  if (forced === 'disk') return 'disk';
  if (forced === 'supabase' && getSupabase()) return 'supabase';
  if (getSupabase()) return 'supabase';
  return 'disk';
}

export function cachePath(cacheDir, caseId) {
  return path.join(cacheDir, `case_${caseId}.json`);
}

function rowToPayload(row) {
  if (!row?.stories?.length) return null;
  return {
    caseId: row.case_id ?? row.caseId,
    stories: row.stories,
    model: row.model ?? null,
    webSearchQueries: row.web_search_queries ?? row.webSearchQueries ?? [],
    groundingChunks: row.grounding_chunks ?? row.groundingChunks ?? [],
    cachedAt: row.cached_at ?? row.cachedAt ?? null,
  };
}

async function readDiskCache(cacheDir, caseId) {
  const file = cachePath(cacheDir, caseId);
  if (!fs.existsSync(file)) return null;
  try {
    const row = JSON.parse(await fsp.readFile(file, 'utf8'));
    if (!row?.stories?.length) return null;
    return row;
  } catch {
    return null;
  }
}

async function writeDiskCache(cacheDir, caseId, payload) {
  await fsp.mkdir(cacheDir, { recursive: true });
  const file = cachePath(cacheDir, caseId);
  await fsp.writeFile(
    file,
    `${JSON.stringify({ ...payload, cachedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );
}

export async function readRealWorldCache(cacheDir, caseId) {
  const id = Number(caseId);
  if (!Number.isFinite(id)) return null;

  if (realWorldCacheBackend() === 'supabase') {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('real_world_cache')
      .select('case_id, stories, model, web_search_queries, grounding_chunks, cached_at')
      .eq('case_id', id)
      .maybeSingle();
    if (error) {
      console.warn('[real-world-cache] supabase read:', error.message);
    } else {
      const payload = rowToPayload(data);
      if (payload) return payload;
    }
  }

  return readDiskCache(cacheDir, id);
}

export async function writeRealWorldCache(cacheDir, caseId, payload) {
  const id = Number(caseId);
  if (!Number.isFinite(id) || !payload?.stories?.length) return;

  const cachedAt = new Date().toISOString();
  const enriched = { ...payload, caseId: id, cachedAt };

  if (realWorldCacheBackend() === 'supabase') {
    const sb = getSupabase();
    const { error } = await sb.from('real_world_cache').upsert(
      {
        case_id: id,
        stories: payload.stories,
        model: payload.model || null,
        web_search_queries: payload.webSearchQueries || [],
        grounding_chunks: payload.groundingChunks || [],
        cached_at: cachedAt,
      },
      { onConflict: 'case_id' },
    );
    if (error) {
      console.warn('[real-world-cache] supabase write:', error.message);
    }
  }

  await writeDiskCache(cacheDir, id, enriched);
}
