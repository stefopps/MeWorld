/** Care-unit labels shared by briefing + play. */

export const CARE_LOCATIONS = {
  ER: { label: 'ER', context: 'Emergency Room — acute resuscitation bay' },
  OBS: { label: 'OBS', context: 'Observation unit — monitored bed, step-down level care' },
  ICU: { label: 'ICU', context: 'Intensive Care Unit — critical care monitoring' },
  WARD: { label: 'WARD', context: 'General ward — stable, routine monitoring' },
  CATH: { label: 'CATH', context: 'Cath lab — procedural suite' },
  OR: { label: 'OR', context: 'Operating room — procedural care' },
};

export function careLocationContext(unit) {
  return CARE_LOCATIONS[unit]?.context || CARE_LOCATIONS.ER.context;
}
