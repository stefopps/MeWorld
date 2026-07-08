const LEAN_LABELS = {
  physics: 'physics / spatial force',
  biochemistry: 'biochemistry / molecular pathway',
  abstraction: 'abstraction / analogy',
  spirituality: 'spiritual / meaning / values',
};

const ATTENDING_STYLE_LEAN_IDS = ['physics', 'biochemistry', 'abstraction', 'spirituality'];

function normalizeLean(n, fallback = 50) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeLeans(leans = {}) {
  return {
    physics: normalizeLean(leans.physics),
    biochemistry: normalizeLean(leans.biochemistry),
    abstraction: normalizeLean(leans.abstraction),
    spirituality: normalizeLean(leans.spirituality),
  };
}

function leanInstruction(id, value) {
  const label = LEAN_LABELS[id] || id;
  if (value >= 72) {
    return `Strongly emphasize ${label} — let it dominate the teaching lens when it fits this patient.`;
  }
  if (value >= 58) {
    return `Lean toward ${label} when it clarifies mechanism for this patient.`;
  }
  if (value <= 28) {
    return `Minimize ${label} — mention only if the learner or case demands it.`;
  }
  if (value <= 42) {
    return `Keep ${label} light — one clause at most unless essential.`;
  }
  return `Balanced ${label} — use when it helps, not as filler.`;
}

export function attendingStyleFingerprint(leans = {}) {
  const n = normalizeLeans(leans);
  return `p${n.physics}b${n.biochemistry}a${n.abstraction}s${n.spirituality}`;
}

/** Prompt block from learner attending-style sliders (Play settings). */
export function buildAttendingStylePromptBlock(leans = {}, { slotLabel = null } = {}) {
  const n = normalizeLeans(leans);
  const lines = ATTENDING_STYLE_LEAN_IDS.map((id) => `- ${leanInstruction(id, n[id])}`);
  const header = slotLabel
    ? `### ATTENDING STYLE (${slotLabel})`
    : '### ATTENDING STYLE (learner sliders)';
  return `${header}
Sliders are 0–100. Follow these lean priorities while staying patient-anchored and mechanism-first.

${lines.join('\n')}

Never invent the patient's religion or beliefs. High "spiritual / meaning" = acknowledge stakes, values, and family context when clinically relevant — not sermons.`;
}
