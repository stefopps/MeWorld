/**
 * sync-user-data.mjs — export/import/merge MeWorld play sessions across devices.
 *
 * Each device has its own user-data/cases/NNN.json with chatHistory, orders, notes.
 * This script bundles everything into one portable JSON file and merges without
 * overwriting newer data.
 *
 * Usage:
 *   node scripts/sync-user-data.mjs export  [--out session-backup.json]
 *   node scripts/sync-user-data.mjs import  [--in  session-backup.json]
 *   node scripts/sync-user-data.mjs merge   [--in  session-backup.json]
 *   node scripts/sync-user-data.mjs status
 *
 * export  — dumps all sessions + recordings index into one JSON file
 * import  — writes incoming sessions, skipping older or identical data
 * merge   — same as import but also keeps local sessions not in the bundle
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.resolve(__dirname, '..');
const USER_ROOT = path.join(GAME_ROOT, 'user-data');
const CASES_DIR = path.join(USER_ROOT, 'cases');
const RECORDINGS_DIR = path.join(USER_ROOT, 'recordings');

const argv = process.argv.slice(2);
const cmd = argv[0] || 'status';
let outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'session-backup.json';
let inFile  = argv.includes('--in')  ? argv[argv.indexOf('--in') + 1]  : 'session-backup.json';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Read all case JSON files from CASES_DIR */
async function readAllCases() {
  ensureDir(CASES_DIR);
  const files = await fsp.readdir(CASES_DIR);
  const cases = {};
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const id = f.replace('.json', '');
    try {
      const raw = await fsp.readFile(path.join(CASES_DIR, f), 'utf8');
      cases[id] = JSON.parse(raw);
    } catch (e) {
      console.warn(`  ⚠ Skipping ${f}: ${e.message}`);
    }
  }
  return cases;
}

/** Read all notes */
async function readAllNotes() {
  const NOTES_DIR = path.join(CASES_DIR, 'notes');
  const notes = {};
  try {
    const files = await fsp.readdir(NOTES_DIR);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const id = f.replace('.md', '');
      notes[id] = await fsp.readFile(path.join(NOTES_DIR, f), 'utf8');
    }
  } catch {
    /* no notes dir */
  }
  return notes;
}

/** Build recording index (file list + sizes, not base64 blobs) */
function buildRecordingsIndex() {
  const index = {};
  if (!fs.existsSync(RECORDINGS_DIR)) return index;
  const walk = (dir, prefix) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, `${prefix}${e.name}/`);
      } else {
        const stat = fs.statSync(full);
        index[`${prefix}${e.name}`] = {
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        };
      }
    }
  };
  walk(RECORDINGS_DIR, '');
  return index;
}

async function cmdExport() {
  console.log('Exporting MeWorld user data...\n');
  const cases = await readAllCases();
  const notes = await readAllNotes();
  const recordings = buildRecordingsIndex();

  const caseCount = Object.keys(cases).length;

  const bundle = {
    exportedAt: new Date().toISOString(),
    gameRoot: GAME_ROOT,
    meta: {
      cases,
      notes,
      recordingCount: Object.keys(recordings).length,
    },
    cases,
    notes,
    recordings,
  };

  const outPath = path.resolve(GAME_ROOT, outFile);
  await fsp.writeFile(outPath, JSON.stringify(bundle, null, 2), 'utf8');
  console.log(`✅ Exported ${caseCount} cases → ${outPath}`);
  console.log(`   Notes: ${Object.keys(notes).length} files`);
  console.log(`   Recordings: ${Object.keys(recordings).length} files`);
  console.log(`\nTransfer this file to your other device and run:`);
  console.log(`  node scripts/sync-user-data.mjs import --in ${outFile}`);
}

function chatMsgFingerprint(msg) {
  if (!msg) return '';
  const ts = msg.timestamp || msg.at || '';
  const role = msg.role || '';
  const content = (msg.content || '').slice(0, 80);
  return `${ts}|${role}|${content}`;
}

/** Merge incoming chatHistory, deduplicating by timestamp+role+content */
function mergeChatHistory(local, incoming) {
  const localFps = new Set((local || []).map(chatMsgFingerprint));
  const merged = [...(local || [])];
  for (const msg of incoming || []) {
    if (!localFps.has(chatMsgFingerprint(msg))) {
      merged.push(msg);
      localFps.add(chatMsgFingerprint(msg));
    }
  }
  // sort by timestamp
  merged.sort((a, b) => {
    const ta = a.timestamp || a.at || '';
    const tb = b.timestamp || b.at || '';
    return String(ta).localeCompare(String(tb));
  });
  return merged;
}

/** Merge two case JSON objects — incoming wins on explicit fields, local keeps extras */
function mergeCaseData(local, incoming, id) {
  if (!incoming) return local;
  if (!local) return incoming;

  // Merge chat history
  local.chatHistory = mergeChatHistory(local.chatHistory, incoming.chatHistory);

  // Newer stats win
  const localMsgs = local.chatHistory?.length || 0;
  const incomingMsgs = incoming.chatHistory?.length || 0;
  if (incomingMsgs >= localMsgs) {
    local.stats = incoming.stats || local.stats;
  }

  // Merge orders (unique by order label)
  const existingOrders = new Set((local.orderTimeline || []).map(o => o.label || o.order || o));
  if (Array.isArray(incoming.orderTimeline)) {
    local.orderTimeline = local.orderTimeline || [];
    for (const o of incoming.orderTimeline) {
      const label = o?.label || o?.order || o;
      if (typeof label === 'string' && !existingOrders.has(label)) {
        local.orderTimeline.push(o);
        existingOrders.add(label);
      }
    }
  }

  // Voice notes
  if (Array.isArray(incoming.voiceNotes)) {
    if (!Array.isArray(local.voiceNotes)) local.voiceNotes = [];
    const localPaths = new Set(local.voiceNotes.map(v => v.path || v));
    for (const vn of incoming.voiceNotes) {
      const vp = vn?.path || vn;
      if (typeof vp === 'string' && !localPaths.has(vp)) {
        local.voiceNotes.push(vn);
        localPaths.add(vp);
      }
    }
  }

  // Timestamps
  if (incoming.updatedAt && (!local.updatedAt || incoming.updatedAt > local.updatedAt)) {
    local.updatedAt = incoming.updatedAt;
  }
  if (incoming.lastPlayedAt && (!local.lastPlayedAt || incoming.lastPlayedAt > local.lastPlayedAt)) {
    local.lastPlayedAt = incoming.lastPlayedAt;
  }

  // Sync notes content
  if (incoming.notes && (!local.notes || incoming.notes.length > local.notes.length)) {
    local.notes = incoming.notes;
  }

  return local;
}

async function cmdImport(mergeMode = false) {
  const inPath = path.resolve(GAME_ROOT, inFile);
  if (!fs.existsSync(inPath)) {
    console.error(`❌ File not found: ${inPath}`);
    console.error('   Export from your other device first.');
    process.exit(1);
  }

  const raw = await fsp.readFile(inPath, 'utf8');
  const bundle = JSON.parse(raw);

  if (!bundle.cases || typeof bundle.cases !== 'object') {
    console.error('❌ Invalid bundle: missing cases');
    process.exit(1);
  }

  console.log(`Importing from: ${inPath}`);
  console.log(`  Exported: ${bundle.exportedAt}`);
  console.log(`  Cases: ${Object.keys(bundle.cases).length}\n`);

  const localCases = await readAllCases();
  let imported = 0;
  let merged = 0;
  let skipped = 0;

  ensureDir(CASES_DIR);

  for (const [id, incoming] of Object.entries(bundle.cases)) {
    const local = localCases[id];
    const fp = path.join(CASES_DIR, `${id}.json`);

    if (!local) {
      // New case from other device — write directly
      await fsp.writeFile(fp, JSON.stringify(incoming, null, 2), 'utf8');
      imported++;
      console.log(`  + Case ${id} — imported (new)`);
    } else if (mergeMode) {
      // Merge existing
      const merged = mergeCaseData(local, incoming, id);
      await fsp.writeFile(fp, JSON.stringify(merged, null, 2), 'utf8');
      merged++;
      console.log(`  ⇌ Case ${id} — merged`);
    } else {
      // Import mode — only overwrite if incoming is newer
      const localMsgs = local.chatHistory?.length || 0;
      const incomingMsgs = incoming.chatHistory?.length || 0;
      if (incomingMsgs > localMsgs) {
        await fsp.writeFile(fp, JSON.stringify(incoming, null, 2), 'utf8');
        console.log(`  ↑ Case ${id} — updated (${localMsgs} → ${incomingMsgs} messages)`);
        imported++;
      } else {
        console.log(`  - Case ${id} — skipped (local is newer or same)`);
        skipped++;
      }
    }
  }

  // Also import notes
  if (bundle.notes) {
    const NOTES_DIR = path.join(CASES_DIR, 'notes');
    ensureDir(NOTES_DIR);
    for (const [id, content] of Object.entries(bundle.notes)) {
      const fp = path.join(NOTES_DIR, `${id}.md`);
      if (!fs.existsSync(fp)) {
        await fsp.writeFile(fp, content, 'utf8');
        console.log(`  + Notes for case ${id}`);
      }
    }
  }

  console.log(`\n✅ Done: ${imported} imported, ${merged} merged, ${skipped} skipped`);
  console.log(`   Restart the game server to pick up changes.`);
}

async function cmdStatus() {
  const cases = await readAllCases();
  const caseIds = Object.keys(cases);

  if (caseIds.length === 0) {
    console.log('No session data found in user-data/cases/');
    return;
  }

  console.log(`MeWorld session data — ${caseIds.length} cases\n`);

  let totalMessages = 0;
  let totalVoice = 0;
  let lastActivity = '';

  for (const [id, data] of Object.entries(cases).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const msgs = data.chatHistory?.length || 0;
    const notes = data.notes?.length || 0;
    const voice = data.voiceNotes?.length || 0;
    const orders = data.orderTimeline?.length || 0;
    const updated = data.updatedAt || '—';
    totalMessages += msgs;
    totalVoice += voice;
    if (updated && updated > lastActivity) lastActivity = updated;

    console.log(`  Case ${String(id).padStart(3)}  ${msgs} msgs  ${voice} voice  ${orders} orders  ${notes ? notes + ' notes' : ''}  ${updated.slice(0, 10)}`);
  }

  console.log(`\n  Total: ${totalMessages} messages, ${totalVoice} voice notes`);
  console.log(`  Last activity: ${lastActivity.slice(0, 10) || '—'}`);
  console.log(`\nExport with: node scripts/sync-user-data.mjs export`);
}

// Main
const cmdMap = { export: cmdExport, import: cmdImport, merge: () => cmdImport(true), status: cmdStatus };
const fn = cmdMap[cmd];
if (!fn) {
  console.error(`Unknown command: ${cmd}`);
  console.error('Usage: node scripts/sync-user-data.mjs [export|import|merge|status] [--in FILE] [--out FILE]');
  process.exit(1);
}
fn();
