/**
 * Case-seeded lab panels — used only as attendant fallbackHint when API is offline.
 * Runtime lab display is always /api/order-result (live attendant), keyed per occurrence.
 */

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function labSeed(caseId, salt = '') {
  const raw = `${caseId ?? '0'}:${salt}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** OCR / screenshot-locked labs — override seeded defaults until attending cache fills. */
export const AUTHORED_CASE_LABS = {
  '086': {
    bmp: { glucose: 94, na: 138, k: 4.2, cl: 102, hco3: 24, bun: 38, cr: 3.6 },
    ua: {
      glucose: 'negative',
      ketones: 'negative',
      protein: '2+',
      blood: '3+',
      rbc: '15–25/HPF',
      wbc: '0–2/HPF',
      nitrites: 'negative',
      leukEsterase: 'negative',
    },
  },
  '116': {
    cbc: { wbc: 9.7, hgb: 14.6, hct: 43.3, plt: 319, neut: 62, lymph: 28 },
    bmp: { glucose: 98, na: 140, k: 4.1, cl: 104, hco3: 25, bun: 14, cr: 0.9 },
  },
  /** Case 138 — Mr. Gustavo Dias, ESRD (shrunken kidneys, oliguria, dialysis threshold labs). */
  '138': {
    bmp: { glucose: 92, na: 137, k: 6.2, cl: 101, hco3: 16, bun: 82, cr: 7.4 },
    caPhos: { ca: 7.6, phos: 6.9, albumin: 3.1 },
    cbc: { wbc: 8.4, hgb: 8.1, hct: 24.2, plt: 218, neut: 68, lymph: 24 },
  },
  /** Case 122 — SJS, lamotrigine, ~8% BSA (Mr. Liang Zhu). */
  '122': {
    bmp: { glucose: 118, na: 131, k: 3.6, cl: 98, hco3: 20, bun: 28, cr: 1.0 },
    cbc: { wbc: 8.2, hgb: 13.4, hct: 40.1, plt: 198, neut: 84, lymph: 8 },
    lfts: { ast: 86, alt: 94, alkPhos: 142, tbili: 1.4, albumin: 3.2 },
  },
};

function caseLabKey(caseId) {
  return String(caseId ?? '').padStart(3, '0');
}

function authoredPanel(caseId, panel) {
  const row = AUTHORED_CASE_LABS[caseLabKey(caseId)]?.[panel];
  return row ? { ...row } : null;
}

function pick(caseId, salt, min, max, decimals = 1) {
  const t = labSeed(caseId, salt);
  const v = min + t * (max - min);
  const m = 10 ** decimals;
  return Math.round(v * m) / m;
}

export function detectLabProfile(ctx = {}) {
  const blob = norm(
    `${ctx.diagnosis} ${ctx.hpi} ${ctx.why} ${ctx.category} ${ctx.chiefComplaint}`,
  );
  if (/diabetic keto|dka|ketoacidosis/.test(blob)) return 'dka';
  if (/systemic lupus|\bsle\b|lupus erythematosus/.test(blob)) return 'sle';
  if (/sepsis|bacteremia|septic shock/.test(blob)) return 'sepsis';
  if (/appendicitis|peritonitis|acute abdomen/.test(blob)) return 'inflammatory';
  if (/uti|pyelonephritis|dysuria|urinary tract/.test(blob)) return 'uti';
  if (
    /esrd|end.stage renal|end-stage renal|gfr\s*<\s*15|markedly elevated bun\/cr|hyperphosphatemia|oliguria.*(bun|cr|renal)|shrunken kidney/i.test(
      blob,
    )
  ) {
    return 'esrd';
  }
  if (
    /adpkd|polycystic kidney|chronic kidney|\bckd\b|declining renal function|elevated cr|azotemia/i.test(
      blob,
    )
  ) {
    return 'ckd';
  }
  if (/gi bleed|melena|hematemesis|anemia/.test(blob)) return 'anemia';
  if (/jaundice|yellow baby|hyperbilirubin|neonatal|newborn|breastfeeding jaundice/.test(blob)) {
    return 'neonatal_jaundice';
  }
  if (/child abuse|non-accidental|immersion burn|cigarette burn|stocking-glove|nat\b|skeletal survey/.test(blob)) {
    return 'child_abuse_burns';
  }
  if (/heart failure|volume overload|edema/.test(blob)) return 'renal_stress';
  if (/pneumonia|copd exacerbation/.test(blob)) return 'infection';
  if (/rash|fever|viral|exanthem/.test(blob)) return 'inflammatory';
  if (/stevens-johnson|\bsjs\b|toxic epidermal|ten\b|nikolsky/.test(blob)) return 'sjs';
  return 'default';
}

export function panelsInLabel(label) {
  const l = norm(label);
  return {
    cbc: /cbc|complete blood count|cbc \/|\/ cbc/.test(l),
    bmp: /\bbmp\b|basic metabolic|comprehensive metabolic|\bcmp\b|bmp \/|\/ bmp/.test(l),
    ua: /urinalysis|\bua\b|ua \/|\/ ua/.test(l),
    retic: /reticulocyte|retic count/.test(l),
  };
}

export function synthesizeBmp(ctx) {
  const { vitals = {}, caseId } = ctx;
  const authored = authoredPanel(caseId, 'bmp');
  if (authored) return authored;
  const profile = detectLabProfile(ctx);
  const k = vitals.k != null ? vitals.k : null;

  if (profile === 'dka') {
    return {
      glucose: 612,
      na: 132,
      k: k ?? 4.1,
      cl: 98,
      hco3: 12,
      bun: 22,
      cr: 1.0,
    };
  }
  if (profile === 'sle') {
    return {
      glucose: pick(caseId, 'glu', 88, 104, 0),
      na: pick(caseId, 'na', 134, 138, 0),
      k: k ?? pick(caseId, 'k', 3.8, 4.6, 1),
      cl: pick(caseId, 'cl', 100, 106, 0),
      hco3: pick(caseId, 'hco3', 22, 26, 0),
      bun: pick(caseId, 'bun', 16, 24, 0),
      cr: pick(caseId, 'cr', 1.0, 1.4, 1),
    };
  }
  if (profile === 'sepsis' || profile === 'infection' || profile === 'inflammatory') {
    return {
      glucose: pick(caseId, 'glu', 98, 142, 0),
      na: pick(caseId, 'na', 130, 136, 0),
      k: k ?? pick(caseId, 'k', 3.6, 4.8, 1),
      cl: pick(caseId, 'cl', 96, 104, 0),
      hco3: pick(caseId, 'hco3', 18, 24, 0),
      bun: pick(caseId, 'bun', 18, 32, 0),
      cr: pick(caseId, 'cr', 0.9, 1.5, 1),
    };
  }
  if (profile === 'renal_stress') {
    return {
      glucose: pick(caseId, 'glu', 90, 118, 0),
      na: pick(caseId, 'na', 128, 134, 0),
      k: k ?? pick(caseId, 'k', 4.8, 5.6, 1),
      cl: pick(caseId, 'cl', 98, 104, 0),
      hco3: pick(caseId, 'hco3', 20, 24, 0),
      bun: pick(caseId, 'bun', 28, 48, 0),
      cr: pick(caseId, 'cr', 1.6, 2.8, 1),
    };
  }
  if (profile === 'esrd') {
    return {
      glucose: pick(caseId, 'glu', 88, 102, 0),
      na: pick(caseId, 'na', 136, 140, 0),
      k: k ?? pick(caseId, 'k', 5.5, 6.5, 1),
      cl: pick(caseId, 'cl', 98, 104, 0),
      hco3: pick(caseId, 'hco3', 15, 18, 0),
      bun: pick(caseId, 'bun', 60, 100, 0),
      cr: pick(caseId, 'cr', 6.0, 8.5, 1),
    };
  }
  if (profile === 'ckd') {
    return {
      glucose: pick(caseId, 'glu', 88, 108, 0),
      na: pick(caseId, 'na', 136, 140, 0),
      k: k ?? pick(caseId, 'k', 4.0, 5.4, 1),
      cl: pick(caseId, 'cl', 98, 104, 0),
      hco3: pick(caseId, 'hco3', 20, 24, 0),
      bun: pick(caseId, 'bun', 28, 58, 0),
      cr: pick(caseId, 'cr', 2.0, 4.8, 1),
    };
  }
  return {
    glucose: pick(caseId, 'glu', 82, 108, 0),
    na: pick(caseId, 'na', 136, 142, 0),
    k: k ?? pick(caseId, 'k', 3.8, 4.5, 1),
    cl: pick(caseId, 'cl', 100, 106, 0),
    hco3: pick(caseId, 'hco3', 23, 27, 0),
    bun: pick(caseId, 'bun', 8, 18, 0),
    cr: pick(caseId, 'cr', 0.7, 1.1, 1),
  };
}

export function synthesizeCbc(ctx) {
  const { caseId } = ctx;
  const authored = authoredPanel(caseId, 'cbc');
  if (authored) return authored;
  const profile = detectLabProfile(ctx);

  if (profile === 'dka') {
    return { wbc: 14.2, hgb: 14.1, hct: 42.0, plt: 285, neut: 82, lymph: 12 };
  }
  if (profile === 'sle') {
    return {
      wbc: pick(caseId, 'wbc', 3.2, 4.8, 1),
      hgb: pick(caseId, 'hgb', 9.6, 11.2, 1),
      hct: pick(caseId, 'hct', 29, 34, 1),
      plt: pick(caseId, 'plt', 118, 165, 0),
      neut: pick(caseId, 'neut', 58, 72, 0),
      lymph: pick(caseId, 'lymph', 18, 28, 0),
    };
  }
  if (profile === 'sepsis' || profile === 'infection' || profile === 'inflammatory') {
    return {
      wbc: pick(caseId, 'wbc', 12.5, 18.5, 1),
      hgb: pick(caseId, 'hgb', 12.0, 14.5, 1),
      hct: pick(caseId, 'hct', 36, 43, 1),
      plt: pick(caseId, 'plt', 210, 340, 0),
      neut: pick(caseId, 'neut', 78, 88, 0),
      lymph: pick(caseId, 'lymph', 8, 14, 0),
    };
  }
  if (profile === 'anemia') {
    return {
      wbc: pick(caseId, 'wbc', 7.0, 10.5, 1),
      hgb: pick(caseId, 'hgb', 7.2, 9.8, 1),
      hct: pick(caseId, 'hct', 22, 30, 1),
      plt: pick(caseId, 'plt', 180, 280, 0),
      neut: pick(caseId, 'neut', 62, 74, 0),
      lymph: pick(caseId, 'lymph', 20, 30, 0),
      retic: pick(caseId, 'retic', 2.5, 6.0, 1),
    };
  }
  if (profile === 'neonatal_jaundice') {
    return {
      wbc: pick(caseId, 'wbc', 9.0, 12.5, 1),
      hgb: pick(caseId, 'hgb', 14.0, 17.0, 1),
      hct: pick(caseId, 'hct', 42, 50, 1),
      plt: pick(caseId, 'plt', 220, 340, 0),
      neut: pick(caseId, 'neut', 38, 52, 0),
      lymph: pick(caseId, 'lymph', 38, 52, 0),
      retic: pick(caseId, 'retic', 0.8, 1.8, 1),
    };
  }
  if (profile === 'child_abuse_burns') {
    return {
      wbc: pick(caseId, 'wbc', 8.5, 11.5, 1),
      hgb: pick(caseId, 'hgb', 10.8, 12.4, 1),
      hct: pick(caseId, 'hct', 32, 37, 1),
      plt: pick(caseId, 'plt', 280, 380, 0),
      neut: pick(caseId, 'neut', 58, 72, 0),
      lymph: pick(caseId, 'lymph', 22, 34, 0),
    };
  }
  if (profile === 'esrd' || profile === 'ckd') {
    return {
      wbc: pick(caseId, 'wbc', 7.0, 10.5, 1),
      hgb: pick(caseId, 'hgb', 7.2, 9.2, 1),
      hct: pick(caseId, 'hct', 22, 28, 1),
      plt: pick(caseId, 'plt', 150, 260, 0),
      neut: pick(caseId, 'neut', 62, 74, 0),
      lymph: pick(caseId, 'lymph', 20, 30, 0),
    };
  }
  return {
    wbc: pick(caseId, 'wbc', 5.5, 9.8, 1),
    hgb: pick(caseId, 'hgb', 12.5, 15.2, 1),
    hct: pick(caseId, 'hct', 37, 45, 1),
    plt: pick(caseId, 'plt', 180, 320, 0),
    neut: pick(caseId, 'neut', 55, 70, 0),
    lymph: pick(caseId, 'lymph', 22, 36, 0),
  };
}

export function synthesizeUa(ctx) {
  const { caseId } = ctx;
  const authored = authoredPanel(caseId, 'ua');
  if (authored) return authored;
  const profile = detectLabProfile(ctx);

  if (profile === 'dka') {
    return {
      glucose: '4+',
      ketones: '3+',
      protein: 'trace',
      blood: 'negative',
      wbc: 'few',
      nitrites: 'negative',
      leukEsterase: 'negative',
    };
  }
  if (profile === 'sle') {
    return {
      glucose: 'negative',
      ketones: 'negative',
      protein: '2+',
      blood: 'trace',
      wbc: '3–5/HPF',
      nitrites: 'negative',
      leukEsterase: 'negative',
      rbc: '8–12/HPF',
    };
  }
  if (profile === 'uti') {
    return {
      glucose: 'negative',
      ketones: 'negative',
      protein: 'trace',
      blood: 'trace',
      wbc: '20–50/HPF',
      nitrites: 'positive',
      leukEsterase: 'positive',
      bacteria: 'many',
    };
  }
  if (profile === 'renal_stress') {
    return {
      glucose: 'negative',
      ketones: 'negative',
      protein: '1+',
      blood: 'negative',
      wbc: '0–2/HPF',
      nitrites: 'negative',
      leukEsterase: 'negative',
    };
  }
  const traceProtein = labSeed(caseId, 'ua-prot') > 0.65 ? 'trace' : 'negative';
  return {
    glucose: 'negative',
    ketones: 'negative',
    protein: traceProtein,
    blood: 'negative',
    wbc: '0–2/HPF',
    nitrites: 'negative',
    leukEsterase: 'negative',
  };
}

function hasCaPhosAlbumin(label) {
  const l = norm(label);
  return /ca\s*\/\s*phos|calcium|phosphate|\bphos\b|albumin/i.test(l);
}

export function synthesizeCaPhosAlbumin(ctx) {
  const { caseId } = ctx;
  const authored = authoredPanel(caseId, 'caPhos');
  if (authored) return authored;
  const profile = detectLabProfile(ctx);
  if (profile === 'esrd') {
    return {
      ca: pick(caseId, 'ca', 7.2, 8.2, 1),
      phos: pick(caseId, 'phos', 5.8, 7.5, 1),
      albumin: pick(caseId, 'alb', 2.8, 3.4, 1),
    };
  }
  if (profile === 'ckd') {
    return {
      ca: pick(caseId, 'ca', 8.0, 8.8, 1),
      phos: pick(caseId, 'phos', 4.5, 6.2, 1),
      albumin: pick(caseId, 'alb', 3.0, 3.6, 1),
    };
  }
  return {
    ca: pick(caseId, 'ca', 8.8, 9.8, 1),
    phos: pick(caseId, 'phos', 2.8, 4.2, 1),
    albumin: pick(caseId, 'alb', 3.5, 4.2, 1),
  };
}

function formatCaPhosAlbuminSuffix(minerals) {
  return `Ca ${minerals.ca} mg/dL. Phos ${minerals.phos} mg/dL. Albumin ${minerals.albumin} g/dL.`;
}

function anionGap(bmp) {
  if (!bmp?.na || bmp.cl == null || bmp.hco3 == null) return null;
  return Math.round(bmp.na - bmp.cl - bmp.hco3);
}

export function formatBmpLine(bmp, { teachMeMode = false, hint = '' } = {}) {
  const ag = anionGap(bmp);
  const base = `Glucose ${bmp.glucose} mg/dL. Na ${bmp.na} mEq/L. K ${bmp.k} mEq/L. Cl ${bmp.cl} mEq/L. HCO₃ ${bmp.hco3} mEq/L. BUN ${bmp.bun} mg/dL. Cr ${bmp.cr} mg/dL.`;
  if (!teachMeMode) return base;
  const cues = [];
  if (ag != null && ag >= 16) cues.push(`Anion gap ${ag}.`);
  if (bmp.glucose >= 250) cues.push('Hyperglycemia.');
  if (bmp.cr >= 1.5) cues.push('Azotemia — assess renal function.');
  if (bmp.k >= 5.5) cues.push('Hyperkalemia — assess dialysis urgency.');
  if (bmp.hco3 != null && bmp.hco3 <= 18) cues.push('Metabolic acidosis.');
  if (hint) cues.push(hint);
  return cues.length ? `${base} ${cues.join(' ')}` : base;
}

export function formatCbcLine(cbc, { teachMeMode = false, hint = '', includeRetic = false } = {}) {
  let base = `WBC ${cbc.wbc} K/µL. Hgb ${cbc.hgb} g/dL. Hct ${cbc.hct}%. Plt ${cbc.plt} K/µL. Neut ${cbc.neut}%. Lymph ${cbc.lymph}%.`;
  if (includeRetic || cbc.retic != null) {
    base += ` Retic ${cbc.retic ?? '—'}%.`;
  }
  if (!teachMeMode) return base;
  const cues = [];
  if (cbc.wbc >= 12) cues.push('Leukocytosis.');
  else if (cbc.wbc <= 4.5) cues.push('Leukopenia.');
  if (cbc.hgb <= 11) cues.push('Anemia.');
  if (cbc.plt <= 150) cues.push('Thrombocytopenia.');
  if (hint) cues.push(hint);
  return cues.length ? `${base} ${cues.join(' ')}` : base;
}

export function formatUaLine(ua, { teachMeMode = false, hint = '' } = {}) {
  const parts = [
    `Glucose ${ua.glucose}`,
    `Ketones ${ua.ketones}`,
    `Protein ${ua.protein}`,
    `Blood ${ua.blood}`,
    ua.rbc ? `RBC ${ua.rbc}` : null,
    `WBC ${ua.wbc}`,
    `Nitrites ${ua.nitrites}`,
    `Leuk esterase ${ua.leukEsterase}`,
    ua.bacteria ? `Bacteria ${ua.bacteria}` : null,
  ].filter(Boolean);
  const base = parts.join('. ') + '.';
  if (!teachMeMode) return base;
  const cues = [];
  if (/2\+|3\+|4\+/.test(ua.protein)) cues.push('Proteinuria.');
  if (ua.nitrites === 'positive') cues.push('Suggestive of UTI.');
  if (ua.ketones && !/negative/i.test(ua.ketones)) cues.push('Ketonuria.');
  if (hint) cues.push(hint);
  return cues.length ? `${base} ${cues.join(' ')}` : base;
}

const PROFILE_HINTS = {
  sle: {
    cbc: 'Screen for cytopenias in active autoimmune disease.',
    bmp: 'Baseline renal function before immunosuppression.',
    ua: 'Proteinuria / active sediment — evaluate for nephritis.',
  },
  dka: {
    cbc: 'Mild leukocytosis may reflect stress/dehydration.',
    bmp: 'Hyperglycemia with anion-gap acidosis pattern.',
    ua: 'Glucosuria and ketonuria expected.',
  },
  ckd: {
    bmp: 'Azotemia — Cr and BUN reflect chronic kidney disease in this presentation.',
    ua: 'Hematuria and proteinuria expected with cystic kidney disease.',
  },
  esrd: {
    bmp: 'Severe azotemia with hyperkalemia and metabolic acidosis — assess AEIOU dialysis indications.',
    cbc: 'Normocytic anemia from low EPO production.',
  },
  sjs: {
    cbc: 'Lymphopenia correlates with SJS/TEN severity.',
    bmp: 'Hyponatremia and volume depletion from insensible losses through denuded skin.',
  },
};

function hintForPanel(profile, panel, why) {
  const fromProfile = PROFILE_HINTS[profile]?.[panel];
  if (fromProfile) return fromProfile;
  const w = norm(why);
  if (!w || w.length < 8) return '';
  if (/cytopen|cbc|wbc|anemia|platelet/.test(w) && panel === 'cbc') return why;
  if (/bmp|metabolic|electrolyte|renal|creatinine|glucose/.test(w) && panel === 'bmp') return why;
  if (/ua|urine|protein|nephritis|uti/.test(w) && panel === 'ua') return why;
  return why.length <= 120 ? why : '';
}

function ensureCbcRetic(cbc, ctx, profile) {
  if (cbc.retic != null) return cbc;
  const { caseId } = ctx;
  if (profile === 'neonatal_jaundice') {
    return { ...cbc, retic: pick(caseId, 'retic', 0.8, 1.8, 1) };
  }
  if (profile === 'anemia') {
    return { ...cbc, retic: pick(caseId, 'retic', 2.5, 6.0, 1) };
  }
  return { ...cbc, retic: pick(caseId, 'retic', 0.5, 1.5, 1) };
}

/**
 * Combined or single lab panel text — always returns numeric values.
 */
export function resolveLabPanelResult(label, ctx, teachMeMode = false) {
  const panels = panelsInLabel(label);
  const count = [panels.cbc, panels.bmp, panels.ua].filter(Boolean).length;
  if (count === 0) return null;

  const profile = detectLabProfile(ctx);
  const why = ctx.why || '';
  const opts = { teachMeMode, includeRetic: panels.retic };

  if (count >= 2) {
    const sections = [];
    if (panels.cbc) {
      let cbc = synthesizeCbc(ctx);
      if (panels.retic) cbc = ensureCbcRetic(cbc, ctx, profile);
      sections.push(
        `CBC: ${formatCbcLine(cbc, { ...opts, hint: hintForPanel(profile, 'cbc', why) })}`,
      );
    }
    if (panels.bmp) {
      const bmp = synthesizeBmp(ctx);
      let bmpText = formatBmpLine(bmp, { ...opts, hint: hintForPanel(profile, 'bmp', why) });
      if (hasCaPhosAlbumin(label)) {
        const minerals = synthesizeCaPhosAlbumin(ctx);
        bmpText = `${bmpText} ${formatCaPhosAlbuminSuffix(minerals)}`;
      }
      sections.push(`BMP: ${bmpText}`);
    }
    if (panels.ua) {
      const ua = synthesizeUa(ctx);
      sections.push(
        `UA: ${formatUaLine(ua, { ...opts, hint: hintForPanel(profile, 'ua', why) })}`,
      );
    }
    return sections.join('\n\n');
  }

  if (panels.cbc) {
    let cbc = synthesizeCbc(ctx);
    if (panels.retic) cbc = ensureCbcRetic(cbc, ctx, profile);
    return formatCbcLine(cbc, {
      ...opts,
      hint: hintForPanel(profile, 'cbc', why),
    });
  }
  if (panels.bmp) {
    let bmpText = formatBmpLine(synthesizeBmp(ctx), { ...opts, hint: hintForPanel(profile, 'bmp', why) });
    if (hasCaPhosAlbumin(label)) {
      bmpText = `${bmpText} ${formatCaPhosAlbuminSuffix(synthesizeCaPhosAlbumin(ctx))}`;
    }
    return bmpText;
  }
  if (panels.ua) {
    return formatUaLine(synthesizeUa(ctx), { ...opts, hint: hintForPanel(profile, 'ua', why) });
  }
  return null;
}

/** Individual labs outside CBC/BMP/UA panels — always numeric when possible. */
export function resolveSingleLabResult(label, ctx, teachMeMode = false) {
  const l = norm(label);
  const profile = detectLabProfile(ctx);
  const { caseId, stackFinding = '', why = '' } = ctx;
  const hint = String(stackFinding || why || '').trim();

  if (/complement|c3\/c4|\bc3\b|\bc4\b/.test(l)) {
    if (profile === 'sle') {
      const c3 = pick(caseId, 'c3', 38, 55, 0);
      const c4 = pick(caseId, 'c4', 6, 12, 0);
      const base = `Complement C3 ${c3} mg/dL (low; ref 90–180). C4 ${c4} mg/dL (low; ref 10–40).`;
      return teachMeMode
        ? `${base} ${hint || 'Hypocomplementemia suggests active autoimmune disease.'}`
        : base;
    }
    const c3 = pick(caseId, 'c3', 90, 140, 0);
    const c4 = pick(caseId, 'c4', 18, 32, 0);
    return `Complement C3 ${c3} mg/dL. C4 ${c4} mg/dL.`;
  }

  if (/\bana\b|antinuclear/.test(l)) {
    if (profile === 'sle') {
      const titer = pick(caseId, 'ana-titer', 320, 1280, 0);
      const base = `ANA positive, homogeneous pattern, titer 1:${titer}.`;
      return teachMeMode ? `${base} ${hint || 'ANA sensitivity high for SLE; not specific alone.'}` : base;
    }
    return teachMeMode && /negative|not/i.test(hint)
      ? 'ANA negative.'
      : `ANA ${/negative/i.test(hint) ? 'negative' : 'positive, titer 1:80.'}`;
  }

  if (/anti-dsdna|dsdna|anti-smith|\bsmith\b/.test(l)) {
    if (profile === 'sle') {
      const ds = pick(caseId, 'dsdna', 85, 220, 0);
      const base = `Anti-dsDNA ${ds} IU/mL (elevated). Anti-Smith positive.`;
      return teachMeMode ? `${base} ${hint || 'Specific serologies for active SLE.'}` : base;
    }
    return 'Anti-dsDNA <30 IU/mL. Anti-Smith negative.';
  }

  if (/\besr\b|sed rate|erythrocyte sedimentation/.test(l)) {
    const val =
      profile === 'sle' || profile === 'inflammatory' || profile === 'sepsis'
        ? pick(caseId, 'esr', 42, 88, 0)
        : pick(caseId, 'esr', 8, 22, 0);
    const base = `ESR ${val} mm/hr.`;
    return teachMeMode && val >= 40 ? `${base} Markedly elevated.` : base;
  }

  if (/\bcrp\b|c-reactive/.test(l)) {
    const val =
      profile === 'sle' || profile === 'inflammatory' || profile === 'sepsis'
        ? pick(caseId, 'crp', 2.4, 8.8, 1)
        : pick(caseId, 'crp', 0.2, 1.2, 1);
    return `CRP ${val} mg/dL.`;
  }

  if (/rheumatoid factor|\brf\b/.test(l)) {
    return /positive/i.test(hint) ? 'RF 42 IU/mL (positive).' : 'RF <14 IU/mL (negative).';
  }

  if (/anti-ccp|ccp antibody/.test(l)) {
    return /positive/i.test(hint) ? 'Anti-CCP 68 U/mL (positive).' : 'Anti-CCP <20 U/mL (negative).';
  }

  if (/d-dimer/.test(l)) {
    const val = pick(caseId, 'ddimer', 0.35, 1.8, 2);
    return `D-dimer ${val} µg/mL FEU.`;
  }

  if (/\bpt\b|\binr\b|prothrombin/.test(l) && !/ptt/.test(l)) {
    return 'PT 13.2 sec. INR 1.0.';
  }

  if (/\bptt\b|partial thromboplastin/.test(l)) {
    return 'PTT 28 sec.';
  }

  if (/\bbnp\b|nt-probnp|pro-bnp/.test(l)) {
    const val =
      profile === 'renal_stress' ? pick(caseId, 'bnp', 420, 980, 0) : pick(caseId, 'bnp', 45, 120, 0);
    return `BNP ${val} pg/mL.`;
  }

  if (/\btsh\b|thyroid stimulating/.test(l)) {
    return `TSH ${pick(caseId, 'tsh', 0.8, 4.2, 1)} mIU/L.`;
  }

  if (/free t4|\bt4\b|thyroxine/.test(l)) {
    return `Free T4 ${pick(caseId, 't4', 0.9, 1.4, 1)} ng/dL.`;
  }

  if (/\bast\b|\balt\b|lft|liver function|hepatic panel/.test(l)) {
    const authoredLfts = authoredPanel(caseId, 'lfts');
    if (authoredLfts) {
      const base = `AST ${authoredLfts.ast} U/L. ALT ${authoredLfts.alt} U/L. Alk phos ${authoredLfts.alkPhos} U/L. Total bili ${authoredLfts.tbili} mg/dL. Albumin ${authoredLfts.albumin} g/dL.`;
      return teachMeMode && hint
        ? `${base} ${hint}`
        : base;
    }
    return `AST ${pick(caseId, 'ast', 18, 42, 0)} U/L. ALT ${pick(caseId, 'alt', 16, 38, 0)} U/L. Alk phos ${pick(caseId, 'alk', 55, 115, 0)} U/L. Total bili ${pick(caseId, 'bili', 0.3, 1.0, 1)} mg/dL.`;
  }

  if (/lipase|amylase/.test(l)) {
    const lip = pick(caseId, 'lipase', 22, 180, 0);
    return `Lipase ${lip} U/L. Amylase ${pick(caseId, 'amylase', 40, 120, 0)} U/L.`;
  }

  if (/procalcitonin/.test(l)) {
    const val =
      profile === 'sepsis' ? pick(caseId, 'pct', 2.1, 12, 1) : pick(caseId, 'pct', 0.05, 0.25, 2);
    return `Procalcitonin ${val} ng/mL.`;
  }

  if (/direct coombs|coombs|dat\b/.test(l)) {
    if (profile === 'sle' || profile === 'anemia') {
      return teachMeMode
        ? 'Direct Coombs positive (IgG). Suggests immune-mediated hemolysis.'
        : 'Direct Coombs positive (IgG).';
    }
    return 'Direct Coombs negative.';
  }

  if (/blood type|type and screen|type & screen/.test(l)) {
    const types = ['O', 'A', 'B', 'AB'];
    const t = types[Math.floor(labSeed(caseId, 'abo') * types.length)];
    const rh = labSeed(caseId, 'rh') > 0.15 ? 'positive' : 'negative';
    return `Type ${t} ${rh}. Antibody screen negative.`;
  }

  if (/iron|ferritin|tibc|transferrin/.test(l)) {
    return `Ferritin ${pick(caseId, 'ferr', 12, 45, 0)} ng/mL. Iron ${pick(caseId, 'iron', 35, 85, 0)} µg/dL. TIBC ${pick(caseId, 'tibc', 280, 380, 0)} µg/dL.`;
  }

  if (/vitamin d|25-oh/.test(l)) {
    return `25-OH vitamin D ${pick(caseId, 'vitd', 18, 38, 0)} ng/mL.`;
  }

  if (/glucose(?!.*a1c)/.test(l) && !/urinalysis|\bua\b/.test(l)) {
    const bmp = synthesizeBmp(ctx);
    return `Glucose ${bmp.glucose} mg/dL (serum).`;
  }

  if (/electrolyte|sodium|potassium|bmp|cmp/.test(l) && !panelsInLabel(label).bmp) {
    const bmp = synthesizeBmp(ctx);
    return formatBmpLine(bmp, { teachMeMode, hint });
  }

  if (/hiv|hepatitis|hcv|hbsag|rpr|vdrl|syphilis/.test(l)) {
    if (/negative|non-reactive/i.test(hint)) return `${label}: negative.`;
    if (/positive|reactive/i.test(hint)) return `${label}: positive.`;
    return `${label}: non-reactive.`;
  }

  if (/urine culture/.test(l)) {
    if (profile === 'uti') return 'Urine culture: >100,000 CFU/mL E. coli. Sensitivities pending.';
    return 'Urine culture: no growth at 48 hours.';
  }

  if (hint && /low|high|positive|negative|elevated|decreased|titer|mg\/dl|mmol|iu\/ml/i.test(hint)) {
    return synthesizeFromStackHint(label, hint, ctx, teachMeMode);
  }

  return null;
}

function synthesizeFromStackHint(label, hint, ctx, teachMeMode) {
  const { caseId } = ctx;
  const low = /low|decreased|hypo/i.test(hint);
  const high = /high|elevated|hyper/i.test(hint);
  const pos = /positive/i.test(hint);
  const neg = /negative/i.test(hint);

  if (pos && !neg) {
    const titer = pick(caseId, 'hint-titer', 80, 640, 0);
    return `${label}: positive${/\btiter\b/i.test(hint) ? `, titer 1:${titer}` : ''}.`;
  }
  if (neg && !pos) return `${label}: negative.`;
  if (low) {
    const val = pick(caseId, 'hint-low', 0.4, 0.85, 1);
    return `${label}: ${val} (below reference range).${teachMeMode && hint ? ` ${hint}` : ''}`;
  }
  if (high) {
    const val = pick(caseId, 'hint-high', 1.4, 3.2, 1);
    return `${label}: ${val} (above reference range).${teachMeMode && hint ? ` ${hint}` : ''}`;
  }
  if (teachMeMode && hint.length <= 120) return `${label}: ${hint}`;
  return null;
}
