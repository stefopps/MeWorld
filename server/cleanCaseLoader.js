import fs from 'fs/promises';
import path from 'path';

const memory = new Map();

/** Canonical DeepSeek case bank — `game/data/cases/case_N.json` (also on GitHub). */
export async function loadCleanCaseJson(gameRoot, caseId) {
  const n = parseInt(String(caseId ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  const key = String(n);
  if (memory.has(key)) return memory.get(key);

  const file = path.join(gameRoot, 'data', 'cases', `case_${n}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    memory.set(key, parsed);
    return parsed;
  } catch {
    memory.set(key, null);
    return null;
  }
}

export function stackFindingForOrder(cleanCase, orderLabel) {
  if (!cleanCase?.stacks?.length || !orderLabel) return null;
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const want = norm(orderLabel);
  for (const stack of cleanCase.stacks) {
    const label = norm(stack.label);
    if (label === want || want.includes(label) || label.includes(want)) {
      return stack.finding || stack.rationale || null;
    }
    for (const alias of stack.aliases || []) {
      const a = norm(alias);
      if (a && (want.includes(a) || a.includes(want))) {
        return stack.finding || stack.rationale || null;
      }
    }
  }
  const rat = cleanCase.rationale?.[orderLabel];
  if (rat) return rat;
  return null;
}

export function enrichCaseContextWithCleanCase(caseContext, cleanCase, orderLabel = '') {
  if (!cleanCase || typeof cleanCase !== 'object') return caseContext;
  const finding = stackFindingForOrder(cleanCase, orderLabel);
  return {
    ...caseContext,
    diagnosis: caseContext?.diagnosis || cleanCase.diagnosis || null,
    clinical_hpi_narrative:
      caseContext?.clinical_hpi_narrative || cleanCase.hpi_narrative || cleanCase.hpi || null,
    historyText: caseContext?.historyText || cleanCase.hpi || null,
    category: caseContext?.category || cleanCase.ccs_category || null,
    cleanCaseStacks: (cleanCase.stacks || []).map((s) => ({
      label: s.label,
      finding: s.finding,
      type: s.type,
    })),
    cleanCaseRationale: cleanCase.rationale || null,
    orderStackFinding: finding || null,
  };
}
