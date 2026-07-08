/**
 * Learner-facing catalog lanes — never show vendor names (CCS / UWorld) in UI.
 * Internal ids: core = CCS bank · extended = transformed scenario bank.
 */
export const CATALOG_LANES = {
  core: {
    id: 'core',
    label: 'Core',
    ariaLabel: 'Core exam-style cases',
    internal: 'ccs',
  },
  extended: {
    id: 'extended',
    label: 'Scenarios',
    ariaLabel: 'Extended clinical scenarios',
    internal: 'uword',
  },
};

/** Categories that show Core | Scenarios tabs in the case picker. */
export const LANE_TAB_CATEGORIES = new Set([]);

export function categoryHasLaneTabs(categoryId) {
  return LANE_TAB_CATEGORIES.has(categoryId);
}

export function caseCatalogLane(caseRow = {}) {
  if (caseRow?.catalogLane === 'extended' || caseRow?.isUword) return 'extended';
  return 'core';
}

export function filterCasesByLane(cases = [], laneId = 'core') {
  return (Array.isArray(cases) ? cases : []).filter((c) => caseCatalogLane(c) === laneId);
}
