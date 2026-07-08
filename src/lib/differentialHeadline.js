/** One-line case name for differential practice (no specialty/category). */
export function practiceCaseHeadline({ topic = '', title = '' } = {}) {
  const raw = String(topic || title || '').trim();
  if (!raw) return 'Unknown case';
  const dashIdx = raw.lastIndexOf(' - ');
  if (dashIdx > 0) return raw.slice(0, dashIdx).trim();
  return raw;
}

/** Split CCS case title into two headline lines (complaint + setting/specialty). */
export function splitChiefComplaintHeadline({
  topic = '',
  title = '',
  specialty = '',
  location = '',
} = {}) {
  const raw = String(topic || title || '').trim();
  if (!raw) {
    return { line1: 'Unknown case', line2: '' };
  }

  const dashIdx = raw.lastIndexOf(' - ');
  if (dashIdx > 0) {
    return {
      line1: `${raw.slice(0, dashIdx)} -`,
      line2: raw.slice(dashIdx + 3).trim(),
    };
  }

  const sub = String(specialty || location || '').trim();
  return { line1: raw, line2: sub };
}
