/** Build result rows for Order · Chat dock — case stacks + canvas pins (extras, phys exams). */
export function buildPlacedResultRows({ interventions = [], placed = {}, pins = [], interventionById = {} }) {
  const rows = [];
  const seen = new Set();

  for (const iv of interventions) {
    if (!placed[iv.id] || seen.has(iv.id)) continue;
    rows.push({ iv });
    seen.add(iv.id);
  }

  for (const pin of pins) {
    if (!pin?.ivId || seen.has(pin.ivId)) continue;
    const stack = interventionById[pin.ivId];
    rows.push({
      iv:
        stack ||
        ({
          id: pin.ivId,
          label: pin.label || 'Order',
          why: '',
          correct_zone: typeof pin.zoneId === 'string' ? pin.zoneId : null,
        }),
    });
    seen.add(pin.ivId);
  }

  return rows;
}
