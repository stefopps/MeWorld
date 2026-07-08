/** Attach trajectoryOccurrence so repeat ECG/BMP extras resolve the right snapshot. */
function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function enrichResultRowsWithTrajectory(rows = [], orderLog = []) {
  if (!orderLog.length) return rows;
  const labelOcc = new Map();
  return rows.map((row) => {
    const lbl = norm(row.iv?.label);
    const occ = labelOcc.get(lbl) || 0;
    labelOcc.set(lbl, occ + 1);
    return {
      ...row,
      iv: { ...row.iv, trajectoryOccurrence: occ },
    };
  });
}
