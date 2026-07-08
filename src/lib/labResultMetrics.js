/** Parse numeric BMP/CBC metrics from attendant lab result text. */

function pickNum(text, patterns) {
  for (const re of patterns) {
    const m = String(text || '').match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function parseBmpMetrics(text = '') {
  const t = String(text);
  return {
    k: pickNum(t, [/K\s+([\d.]+)\s*mEq/i, /\bK\+?\s*([\d.]+)/i]),
    cr: pickNum(t, [/Cr(?:eatinine)?\s+([\d.]+)\s*mg/i, /\bCr\s+([\d.]+)/i]),
    bun: pickNum(t, [/BUN\s+([\d.]+)/i]),
    glucose: pickNum(t, [/Glucose\s+([\d.]+)/i]),
  };
}

export function isRepeatableLabLabel(label = '') {
  return /bmp|cmp|basic metabolic|cbc|complete blood|urinalysis|\bua\b|lab workup|electrolyte|renal\/hepatic/i.test(
    String(label),
  );
}
