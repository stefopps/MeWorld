import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const gameRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_ROOT = path.join(gameRoot, '.patient-stage-cache');

/** Append stage-direction text for future video generation — not shown in chat UI. */
export async function appendPatientStageEntry(caseId, entry) {
  const cid = String(caseId ?? '').trim();
  const stage = String(entry?.stageDirections ?? '').trim();
  if (!cid || !stage) return null;

  const dir = path.join(CACHE_ROOT, `case_${cid.replace(/\D/g, '') || cid}`);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'stage.jsonl');
  const row = {
    at: new Date().toISOString(),
    userMessage: entry.userMessage || '',
    stageDirections: stage,
    dialogue: entry.dialogue || '',
    raw: entry.raw || '',
  };
  await fs.appendFile(file, `${JSON.stringify(row)}\n`, 'utf8');
  return file;
}
