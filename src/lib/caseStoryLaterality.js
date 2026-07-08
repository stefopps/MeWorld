import mechanismTeaching from '../data/mechanismTeaching.json' with { type: 'json' };

const SITE_PATTERN =
  '(forearm|arm|hand|wrist|elbow|upper arm|lower arm|leg|thigh|knee|ankle|foot|shoulder|eye|ear|flank|abdomen|cheek|jaw)';

function normalizeCaseId(caseId) {
  const raw = String(caseId ?? '').trim().replace(/^case_/i, '');
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

function teachingRow(caseId) {
  const cid = normalizeCaseId(caseId);
  return mechanismTeaching?.cases?.[cid] || mechanismTeaching?.cases?.[String(Number(cid))] || null;
}

/** Extract locked injury laterality from case context + character lock + mechanism teaching. */
export function resolveLateralityLock({
  caseId = '',
  caseContext = {},
  characterLockMarkdown = '',
} = {}) {
  const cid = normalizeCaseId(caseId || caseContext?.id);
  const row = teachingRow(cid);
  const corpus = [
    row?.patientAnchor?.injurySite,
    row?.injuryMechanism,
    characterLockMarkdown,
    caseContext?.portraitNote,
    caseContext?.historyText,
    caseContext?.hpiExcerpt,
    caseContext?.clinical_hpi_narrative,
    caseContext?.clinical_tip,
  ]
    .filter(Boolean)
    .join('\n');

  const re = new RegExp(`\\b(right|left)\\s+${SITE_PATTERN}\\b`, 'gi');
  const hits = [...corpus.matchAll(re)];
  if (!hits.length) {
    return { locked: false, side: null, site: null, label: null, source: null };
  }

  const first = hits[0];
  const side = first[1].toLowerCase();
  const site = first[2].toLowerCase();
  const opposite = side === 'right' ? 'left' : 'right';

  const conflicting = hits.some((m) => m[1].toLowerCase() !== side || m[2].toLowerCase() !== site);

  return {
    locked: true,
    side,
    site,
    label: `${side} ${site}`,
    opposite,
    source: row?.patientAnchor?.injurySite ? 'mechanism-teaching' : 'case-context',
    conflictingSources: conflicting,
  };
}

export function buildLateralityPromptBlock(lock) {
  if (!lock?.locked) return '';
  return `LATERALITY LOCK (non-negotiable — prose + every visualHint + every image):
Injury / wound site: ${lock.label.toUpperCase()}.
Never mirror to the ${lock.opposite} side. If the wound is visible in a beat, it must be on the ${lock.side} ${lock.site} only.
Do not swap arms, hands, or legs across beats. Dressing may cover the site in later beats but anatomy side stays ${lock.side}.`;
}

/** Flag wrong-side mentions when case context locks laterality. */
export function auditLateralityInText(text, lock) {
  if (!lock?.locked || !text) return { ok: true, issues: [] };
  const issues = [];
  const wrongRe = new RegExp(`\\b${lock.opposite}\\s+${lock.site}\\b`, 'gi');
  for (const match of String(text).matchAll(wrongRe)) {
    issues.push(`Wrong side: "${match[0]}" (expected ${lock.label})`);
  }
  return { ok: issues.length === 0, issues };
}

export function auditCaseStoryLaterality(narrative = {}, lock) {
  if (!lock?.locked) return { ok: true, issues: [] };
  const issues = [];
  const chunks = [
    narrative.title,
    narrative.synopsis,
    narrative.patientLock,
    narrative.masterImagePrompt,
    ...(narrative.chapters || []).flatMap((c) => [c.heading, c.body, c.visualHint]),
  ];
  for (const chunk of chunks) {
    const row = auditLateralityInText(chunk, lock);
    issues.push(...row.issues);
  }
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}
