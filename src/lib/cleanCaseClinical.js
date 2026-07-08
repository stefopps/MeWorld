import { apiUrl } from './apiBase.js';

const cache = new Map();

/** Fetch canonical case JSON from `game/data/cases/` via API (GitHub-synced bank). */
export async function fetchCleanCaseClinical(caseId) {
  const id = String(caseId ?? '').trim();
  if (!id) return null;
  if (cache.has(id)) return cache.get(id);
  try {
    const res = await fetch(apiUrl(`/api/case-clinical/${id}`));
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.case) {
      cache.set(id, data.case);
      return data.case;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function mergeCleanCaseIntoCtx(ctx, cleanCase, orderLabel = '') {
  if (!cleanCase) return ctx;
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const want = norm(orderLabel);
  let finding = null;
  for (const stack of cleanCase.stacks || []) {
    const label = norm(stack.label);
    if (label === want || want.includes(label) || label.includes(want)) {
      finding = stack.finding;
      break;
    }
  }
  if (!finding && cleanCase.rationale?.[orderLabel]) {
    finding = cleanCase.rationale[orderLabel];
  }
  return {
    ...ctx,
    diagnosis: ctx.diagnosis || cleanCase.diagnosis || '',
    hpi: ctx.hpi || cleanCase.hpi_narrative || cleanCase.hpi || '',
    chiefComplaint: ctx.chiefComplaint || cleanCase.chief_complaint || cleanCase.topic || '',
    category: ctx.category || cleanCase.ccs_category || '',
    stackFinding: finding || ctx.stackFinding || '',
  };
}
