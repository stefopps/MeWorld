/** ECG severity ladder for trajectory cases (hyperK, etc.). */
export const ECG_STAGE_LABELS = {
  0: 'Normal sinus rhythm',
  1: 'Peaked T waves (hyperacute)',
  2: 'Flattened P waves / PR prolongation',
  3: 'Wide QRS, loss of P waves',
  4: 'Sine-wave pattern — pre-arrest',
  5: 'Asystole — cardiac arrest',
};

export function formatEcgStageText(stage, { teachMeMode = false, k = null } = {}) {
  const s = Math.max(0, Math.min(5, Math.round(Number(stage) || 0)));
  const base = ECG_STAGE_LABELS[s] || ECG_STAGE_LABELS[0];
  if (!teachMeMode) return base;
  const kNote = k != null ? ` Serum K⁺ ${k} mEq/L.` : '';
  if (s >= 4) return `${base}.${kNote} Immediate stabilization required.`;
  if (s >= 2) return `${base}.${kNote} Membrane stabilization + K⁺ shift indicated.`;
  return `${base}.${kNote}`;
}
