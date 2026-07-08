/**
 * Split bundled CCS orders into teachable channels — acute bedside vs prophylaxis vs workup.
 * Used at case-bank → intervention build time.
 */

export const TEACHING_CHANNELS = {
  acute: 'acute',
  prophylaxis: 'prophylaxis',
  workup: 'workup',
  consult: 'consult',
  disposition: 'disposition',
  admin: 'admin',
};

export const TEACHING_CHANNEL_LABELS = {
  acute: 'Acute / ABCs',
  prophylaxis: 'Prophylaxis',
  workup: 'Workup',
  consult: 'Consult',
  disposition: 'Disposition',
  admin: 'Admin',
};

/** Infer channel from order label when not explicitly set. */
export function inferTeachingChannel(label = '') {
  const l = String(label).toLowerCase();
  if (/tetanus|prophylaxis|rabies (immune|vaccine|globulin)|hep [ab]\b|hiv pep|immunoglobulin|vaccine series/.test(l)) {
    return TEACHING_CHANNELS.prophylaxis;
  }
  if (/\bconsult\b|refer to|specialist/.test(l)) return TEACHING_CHANNELS.consult;
  if (/admit|disposition|icu\b|observation|transfer/.test(l)) return TEACHING_CHANNELS.disposition;
  if (
    /oxygen|abcs|airway|stabilize|breathing|circulatory|iv access|large.bore|glucose|fingerstick|pressor|bolus|intubat|bvm/.test(
      l,
    )
  ) {
    return TEACHING_CHANNELS.acute;
  }
  if (/cbc|bmp|cmp|lab|culture|imaging|ct |x-ray|mri|ultrasound|abg/.test(l)) {
    return TEACHING_CHANNELS.workup;
  }
  return TEACHING_CHANNELS.workup;
}

/**
 * Expand one CCS order string into separate teachable rows.
 * @returns {{ label: string, why: string, teachingChannel: string, dedupeKey?: string }[]}
 */
export function expandCompoundOrder(label, rationale = {}) {
  const raw = String(label || '').trim();
  if (!raw) return [];

  const pickWhy = (...keys) => {
    for (const k of keys) {
      if (k && rationale[k]) return rationale[k];
    }
    return '';
  };

  if (/stabilize the patient/i.test(raw) && /tetanus/i.test(raw)) {
    return [
      {
        label: 'Stabilize the patient: ensure airway, breathing, and circulatory status',
        why:
          pickWhy(raw, 'Stabilize the patient') ||
          'Primary survey first — airway, breathing, circulation before wound-specific prophylaxis.',
        teachingChannel: TEACHING_CHANNELS.acute,
        dedupeKey: 'stabilize-abcs',
      },
      {
        label: 'Administer tetanus prophylaxis if needed',
        why: 'Tetanus is wound prophylaxis — separate channel from ABC stabilization; both matter, not one bundled order.',
        teachingChannel: TEACHING_CHANNELS.prophylaxis,
        dedupeKey: 'tetanus-prophylaxis',
      },
    ];
  }

  if (/time-sensitive interventions/i.test(raw)) {
    const bundleWhy = pickWhy(raw);
    return [
      {
        label: 'Oxygen',
        why: bundleWhy || 'Supplemental oxygen during acute stabilization.',
        teachingChannel: TEACHING_CHANNELS.acute,
        dedupeKey: 'oxygen',
      },
      {
        label: 'IV access',
        why: 'Vascular access for fluids and meds during the acute phase.',
        teachingChannel: TEACHING_CHANNELS.acute,
        dedupeKey: 'iv-access',
      },
      {
        label: 'Fingerstick glucose',
        why: 'Reversible hypoglycemia must be excluded early in acute presentations.',
        teachingChannel: TEACHING_CHANNELS.acute,
        dedupeKey: 'glucose',
      },
    ];
  }

  return [
    {
      label: raw,
      why: pickWhy(raw) || '',
      teachingChannel: inferTeachingChannel(raw),
    },
  ];
}

/** Flatten order list with compound splits and label deduplication. */
export function expandOrderList(orders = [], rationale = {}) {
  const seen = new Set();
  const out = [];

  const normKey = (label) =>
    String(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  for (const order of orders) {
    const rawLabel = typeof order === 'string' ? order : order?.order || order?.label || '';
    const expanded = expandCompoundOrder(rawLabel, rationale);
    for (const row of expanded) {
      const key = row.dedupeKey || normKey(row.label);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}
