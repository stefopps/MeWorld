// Live case ledger — the canonical markdown record the attending reads.
// Blueprint: docs/CHART_ARCHITECTURE.md §3.
// Rendered from the sessionContext the client already sends (orders timeline,
// orderResults / labResults / imaging / exam, stacks, notes, dialogue), persisted
// to user-data/cases/<id>/live/ledger.md, and injected into the attending chat on
// BOTH the full path and the dockBrief path so the tutor reads live numbers
// instead of asking the learner for them.

import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_CASES_DIR = path.join(__dirname, '../user-data/cases');

const COMPACT_MAX = 1600;
const RESULT_CLIP = 320;

/** Filename-safe per-case dir: numeric ids pad to 3 (matches userCaseStore), else slugged. */
function safeCaseDir(caseId) {
  const raw = String(caseId ?? '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw.padStart(3, '0');
  return raw.replace(/[^a-z0-9_-]/gi, '_');
}

function ledgerPath(caseId) {
  const dir = safeCaseDir(caseId);
  if (!dir) return null;
  return path.join(USER_CASES_DIR, dir, 'live', 'ledger.md');
}

function clip(text, max = RESULT_CLIP) {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function resultLines(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r?.text)
    .map((r) => `- **${r.label || r.kindLabel || 'Result'}** — ${clip(r.text)}`);
}

/**
 * Full human-readable ledger markdown for one case, from the live sessionContext.
 * This overwrites ledger.md each update; ordersTimeline accumulates, so the file
 * always reflects the complete timeline of the case so far.
 */
export function renderCaseLedgerMarkdown(caseId, ctx = {}) {
  const now = new Date().toISOString();
  const out = [];
  out.push(`# Live case ledger — Case ${caseId}`);
  out.push(`_updated ${now}_`);
  if (ctx.currentLocation) out.push(`_location: ${ctx.currentLocation}_`);
  out.push('');

  const timeline = Array.isArray(ctx.ordersTimeline) ? ctx.ordersTimeline : [];
  if (timeline.length) {
    out.push('## Orders timeline');
    for (const ev of timeline) {
      const when = ev.elapsed || ev.clockTime || '';
      out.push(`${ev.seq}. ${when ? `[${when}] ` : ''}${ev.label}${ev.kind ? ` _(${ev.kind})_` : ''}`);
    }
    out.push('');
  }

  const sections = [
    ['Labs', ctx.labResults],
    ['Imaging', ctx.imagingResults],
    ['Physical exam', ctx.physicalExamFindings],
    ['Procedures', ctx.procedureResults],
  ];
  const anyResults = sections.some(([, rows]) => Array.isArray(rows) && rows.length);
  if (anyResults) {
    out.push('## Results so far (live values — patient state)');
    for (const [title, rows] of sections) {
      const lines = resultLines(rows);
      if (!lines.length) continue;
      out.push(`### ${title}`);
      out.push(...lines);
      out.push('');
    }
  }

  if (Array.isArray(ctx.stacksPlaced) && ctx.stacksPlaced.length) {
    out.push('## Treatments / stacks placed');
    out.push(...ctx.stacksPlaced.map((s) => `- ${s}`));
    out.push('');
  }

  if (ctx.learnerNotes) {
    out.push('## Learner notes (SOAP / chart)');
    out.push(clip(ctx.learnerNotes, 4000));
    out.push('');
  }

  const chat = Array.isArray(ctx.chatMessages) ? ctx.chatMessages.slice(-8) : [];
  if (chat.length) {
    out.push('## Recent dialogue');
    out.push(...chat.map((m) => `- **${m.role}:** ${clip(m.content, 240)}`));
    out.push('');
  }

  return out.join('\n').trim() + '\n';
}

/**
 * Compact live block for the order dock (dockBrief). The attending MUST read these
 * numbers and not ask the learner for them.
 */
export function renderCaseLedgerCompact(ctx = {}) {
  const parts = [];
  const push = (label, rows) => {
    const items = (Array.isArray(rows) ? rows : [])
      .filter((r) => r?.text)
      .map((r) => `${r.label || r.kindLabel}: ${clip(r.text, 160)}`);
    if (items.length) parts.push(`${label} — ${items.join(' · ')}`);
  };
  push('Labs', ctx.labResults);
  push('Imaging', ctx.imagingResults);
  push('Exam', ctx.physicalExamFindings);
  push('Procedures', ctx.procedureResults);
  if (Array.isArray(ctx.stacksPlaced) && ctx.stacksPlaced.length) {
    parts.push(`Treatments placed — ${ctx.stacksPlaced.join(', ')}`);
  }
  const timeline = Array.isArray(ctx.ordersTimeline) ? ctx.ordersTimeline : [];
  if (timeline.length) {
    parts.push(`Orders so far — ${timeline.map((e) => e.label).join(', ')}`);
  }
  if (!parts.length) return '';
  let block = `[LIVE CASE LEDGER — current patient data. Read these values; do NOT ask the learner for numbers you already have here.]\n${parts.join('\n')}`;
  if (block.length > COMPACT_MAX) block = `${block.slice(0, COMPACT_MAX)}…`;
  return block;
}

/**
 * Token-smart delta: emit only what is NEW or CHANGED since the attending last read.
 * The chat window already holds earlier results, so we never re-flood the full ledger.
 * Re-checked values (same order, new text) surface as "updated (rechecked)" — this is
 * how reversal / healing shows up to the tutor on a second assessment.
 *
 * @param ctx  live sessionContext
 * @param seen previous seen-state (or null on first read of the session)
 * @returns { block, nextSeen, isFirst }
 */
export function diffCaseLedger(ctx = {}, seen = null) {
  const prev = seen || { results: {}, maxSeq: 0, treatments: [] };
  const nextResults = { ...(prev.results || {}) };
  const newItems = [];
  const updatedItems = [];

  const sections = [
    ['lab', ctx.labResults],
    ['imaging', ctx.imagingResults],
    ['exam', ctx.physicalExamFindings],
    ['procedure', ctx.procedureResults],
  ];
  for (const [kindLabel, rows] of sections) {
    for (const r of Array.isArray(rows) ? rows : []) {
      if (!r?.text) continue;
      const key = `${r.kind || kindLabel}|${r.label}`;
      const val = clip(r.text, 200);
      if (!(key in (prev.results || {}))) {
        newItems.push(`${r.label}: ${val}`);
        nextResults[key] = val;
      } else if (prev.results[key] !== val) {
        updatedItems.push(`${r.label}: now ${val}`);
        nextResults[key] = val;
      }
    }
  }

  const timeline = Array.isArray(ctx.ordersTimeline) ? ctx.ordersTimeline : [];
  const maxSeq = timeline.reduce((m, e) => Math.max(m, e.seq || 0), prev.maxSeq || 0);
  const newOrders = timeline.filter((e) => (e.seq || 0) > (prev.maxSeq || 0)).map((e) => e.label);

  const treatments = Array.isArray(ctx.stacksPlaced) ? ctx.stacksPlaced : [];
  const prevTreatments = Array.isArray(prev.treatments) ? prev.treatments : [];
  const newTreatments = treatments.filter((t) => !prevTreatments.includes(t));

  const nextSeen = {
    results: nextResults,
    maxSeq,
    treatments: treatments.length ? treatments : prevTreatments,
  };

  const isFirst = !seen;
  const empty = !newItems.length && !updatedItems.length && !newOrders.length && !newTreatments.length;
  if (empty) return { block: '', nextSeen, isFirst };

  const head = isFirst
    ? '[LIVE CASE LEDGER — current patient data. Read these values; do NOT ask the learner for numbers you already have here.]'
    : '[LIVE CASE UPDATE — only what changed since your last reply. Earlier values from the conversation above still hold. Read these; do not re-ask.]';
  const lines = [head];
  if (newOrders.length) lines.push(`New orders: ${newOrders.join(', ')}`);
  if (newTreatments.length) lines.push(`New treatments placed: ${newTreatments.join(', ')}`);
  if (newItems.length) lines.push(`New results:\n- ${newItems.join('\n- ')}`);
  if (updatedItems.length) lines.push(`Updated (rechecked):\n- ${updatedItems.join('\n- ')}`);

  let block = lines.join('\n');
  if (block.length > COMPACT_MAX) block = `${block.slice(0, COMPACT_MAX)}…`;
  return { block, nextSeen, isFirst };
}

/** Persist the full ledger markdown to disk (fire-and-forget friendly). */
export async function writeCaseLedger(caseId, ctx = {}) {
  const fp = ledgerPath(caseId);
  if (!fp) return null;
  try {
    await fsp.mkdir(path.dirname(fp), { recursive: true });
    const markdown = renderCaseLedgerMarkdown(caseId, ctx);
    await fsp.writeFile(fp, markdown, 'utf8');
    return fp;
  } catch {
    return null;
  }
}
