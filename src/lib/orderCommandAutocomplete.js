export function normCommandText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(s) {
  return normCommandText(s).replace(/\s/g, '');
}

/** Short synonym keys must match exactly — never as substrings inside longer words (e.g. ns in insulin). */
const SHORT_SYNONYM_MAX_LEN = 3;

/**
 * Equivalence rings — if query hits any member and stack label hits any member, it's a match.
 * Keep entries lowercase normalized (no punctuation).
 */
const SYNONYM_GROUPS = [
  ['general exam', 'general appearance', 'physical exam general appearance'],
  ['pregnancy', 'pregnancy test', 'preg test', 'hcg', 'beta hcg'],
  ['thyroid test', 'thyroid', 'tsh', 'thyroid stimulating hormone'],
  ['liver panel', 'lfts', 'liver function tests', 'lft bmp bilirubin'],
  [
    'galt enzyme assay',
    'galt enzyme',
    'galt rbcs',
    'galactose enzyme',
    'gout enzyme',
    'gout enzymes',
    'galactose 1 phosphate uridylyltransferase',
  ],
  ['kcl', 'potassium chloride'],
  ['k citrate', 'potassium citrate'],
  ['k phosphate', 'potassium phosphate'],
  ['potassium replacement', 'potassium repletion', 'replace potassium', 'k replacement'],
  ['basic metabolic profile', 'bmp', 'basic metabolic'],
  ['comprehensive metabolic profile', 'cmp', 'comprehensive metabolic'],
  ['arterial blood gas', 'arterial blood gases', 'abg'],
  ['venous blood gas', 'vbg'],
  ['hemoglobin a1c', 'hba1c', 'a1c'],
  ['complete blood count', 'cbc'],
  ['urinalysis', 'ua'],
  ['urine culture', 'ucx'],
  ['blood culture', 'bcx'],
  ['chest xray', 'chest x ray', 'cxr'],
  ['electrocardiogram', 'electrocardiography', 'ecg', 'ekg'],
  [
    'normal saline',
    'ns',
    '09 saline',
    '0 9 saline',
    '045 saline',
    'lactated ringer',
    'lactated ringers',
    'lr',
  ],
  ['intravenous access', 'iv access peripheral', 'peripheral iv', 'iv line peripheral', 'piv'],
  ['central line', 'iv access central', 'iv access central line', 'central venous catheter', 'cvc'],
  [
    'ultrasound abdomen',
    'us abdomen',
    'usg abdomen',
    'abdominal ultrasound',
    'ruq ultrasound',
  ],
  [
    'ultrasound pelvis',
    'us pelvis',
    'usg pelvis',
    'pelvic ultrasound',
  ],
  [
    'ultrasound renal',
    'us renal',
    'renal ultrasound',
    'renal us',
    'usg renal',
    'kidney ultrasound',
    'kidney us',
  ],
  ['ultrasound', 'us scan', 'usg'],
  ['doppler', 'doppler study', 'doppler ultrasound', 'doppler us', 'doppler exam'],
  ['insulin', 'insulin regular', 'regular insulin', 'insulin drip', 'lispro', 'glargine', 'nph'],
  ['prothrombin time', 'pt'],
  ['partial thromboplastin', 'ptt'],
  ['troponin', 'trop'],
  ['lumbar puncture', 'lp'],
  ['nasogastric tube', 'ng tube', 'ngt'],
  ['foley catheter', 'foley', 'urinary catheter'],
  ['tdap vaccine', 'tdap'],
  ['pap smear', 'papanicolaou smear', 'pap'],
  ['hpv dna', 'hpv test'],
];

const SYNONYM_INDEX = new Map();
for (const group of SYNONYM_GROUPS) {
  const normalized = group.map((g) => normCommandText(g)).filter(Boolean);
  for (const term of normalized) {
    SYNONYM_INDEX.set(term, normalized);
  }
}

function synonymRingFor(text) {
  const norm = normCommandText(text);
  if (!norm) return [];
  const direct = SYNONYM_INDEX.get(norm);
  if (direct) return direct;

  const compact = compactText(text);
  if (!compact) return [];

  // Long stack labels are not shorthand — avoid compact-substring false positives.
  if (compact.length > 20) return [norm];

  for (const [key, ring] of SYNONYM_INDEX.entries()) {
    const keyCompact = key.replace(/\s/g, '');
    if (!keyCompact) continue;

    if (compact === keyCompact || norm === key) return ring;

    if (keyCompact.length <= SHORT_SYNONYM_MAX_LEN) continue;

    if (compact.length >= 4 && keyCompact.length >= 4) {
      if (compact.includes(keyCompact) || keyCompact.includes(compact)) return ring;
    }

    if (compact.length >= 3 && compact.length <= norm.length + 2) {
      const wordRe = new RegExp(`\\b${compact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (wordRe.test(key)) return ring;
    }
  }

  return [norm];
}

function ringsOverlap(query, alias) {
  const qRing = new Set(synonymRingFor(query));
  const aRing = synonymRingFor(alias);
  return aRing.some((term) => qRing.has(term));
}

/** Common CCS / ED shorthand → label patterns (applied to each stack alias). */
const LABEL_ABBREV_RULES = [
  { abbrev: 'abg', re: /arterial blood gas/i },
  { abbrev: 'vbg', re: /venous blood gas/i },
  { abbrev: 'bmp', re: /basic metabolic/i },
  { abbrev: 'cmp', re: /comprehensive metabolic/i },
  { abbrev: 'hba1c', re: /hemoglobin a1c|hba1c/i },
  { abbrev: 'a1c', re: /hemoglobin a1c|hba1c/i },
  { abbrev: 'cbc', re: /cbc|complete blood count/i },
  { abbrev: 'ua', re: /urinalysis/i },
  { abbrev: 'ucx', re: /urine culture/i },
  { abbrev: 'bcx', re: /blood culture/i },
  { abbrev: 'cxr', re: /chest x.?ray/i },
  { abbrev: 'ekg', re: /electrocardiog|ecg|ekg/i },
  { abbrev: 'ecg', re: /electrocardiog|ecg|ekg/i },
  { abbrev: 'pt', re: /prothrombin time/i },
  { abbrev: 'ptt', re: /partial thromboplastin|ptt/i },
  { abbrev: 'inr', re: /\binr\b/i },
  { abbrev: 'trop', re: /troponin/i },
  { abbrev: 'bnp', re: /\bbnp\b|brain natriuretic/i },
  { abbrev: 'hcg', re: /\bhcg\b|beta.*pregnancy|pregnancy test/i },
  { abbrev: 'lfts', re: /liver function|lfts/i },
  { abbrev: 'lp', re: /lumbar puncture/i },
  { abbrev: 'ct', re: /\bct\b/i },
  { abbrev: 'mri', re: /\bmri\b/i },
  { abbrev: 'us', re: /\bultrasound\b|\bus\b/i },
  { abbrev: 'usg', re: /\bultrasound\b|\busg\b/i },
  { abbrev: 'doppler', re: /\bdoppler\b/i },
  { abbrev: 'ffp', re: /fresh frozen plasma/i },
  { abbrev: 'prbc', re: /packed red|prbc/i },
  { abbrev: 'ns', re: /normal saline|0\.9% saline/i },
  { abbrev: 'lr', re: /lactated ringer/i },
  { abbrev: 'ivig', re: /\bivig\b/i },
  { abbrev: 'pe', re: /pulmonary embol/i },
  { abbrev: 'dvt', re: /deep vein thrombosis|dvt/i },
  { abbrev: 'iv access', re: /intravenous access|iv access/i },
  { abbrev: 'iv', re: /\bintravenous\b/i },
  { abbrev: 'piv', re: /iv access peripheral|peripheral iv/i },
  { abbrev: 'central line', re: /iv access central|central line/i },
  { abbrev: 'picc', re: /\bpicc\b/i },
  { abbrev: 'ngt', re: /nasogastric|ng tube/i },
  { abbrev: 'foley', re: /foley|urinary catheter/i },
  { abbrev: 'kcl', re: /\bkcl\b|potassium chloride/i },
  { abbrev: 'pap', re: /papanicolaou|pap smear/i },
  { abbrev: 'insulin', re: /\binsulin\b/i },
];

/** Typed word → acceptable tokens in stack label (multi-word shorthand). */
const QUERY_TOKEN_EXPANSIONS = {
  iv: ['iv', 'intravenous'],
  pregnancy: ['pregnancy', 'hcg', 'beta', 'preg'],
  preg: ['pregnancy', 'hcg', 'beta', 'preg'],
  thyroid: ['thyroid', 'tsh'],
  liver: ['liver', 'lft', 'lfts', 'hepatic'],
  abg: ['abg', 'arterial', 'blood', 'gas', 'gases'],
  bmp: ['bmp', 'basic', 'metabolic'],
  cmp: ['cmp', 'comprehensive', 'metabolic'],
  ua: ['ua', 'urinalysis'],
  cxr: ['cxr', 'chest', 'xray', 'ray'],
  ekg: ['ekg', 'ecg', 'electrocardiog'],
  ecg: ['ecg', 'ekg', 'electrocardiog'],
  potassium: ['potassium', 'k'],
  chloride: ['chloride', 'cl'],
  saline: ['saline'],
  normal: ['normal'],
  ringer: ['ringer', 'ringers'],
  lactated: ['lactated'],
  ringers: ['ringer', 'ringers'],
  usg: ['usg', 'ultrasound', 'us'],
  us: ['us', 'ultrasound', 'usg'],
  doppler: ['doppler'],
  renal: ['renal', 'kidney'],
  kidney: ['kidney', 'renal'],
};

function queryTokensMatchAlias(query, alias) {
  const parts = normCommandText(query).split(' ').filter((p) => p.length > 0);
  if (parts.length < 2) return false;
  const aNorm = normCommandText(alias);
  return parts.every((part) => {
    const options = QUERY_TOKEN_EXPANSIONS[part] || [part];
    return options.some((opt) => aNorm.includes(opt));
  });
}

function inferAbbreviations(text) {
  const raw = String(text || '');
  const norm = normCommandText(raw);
  const found = new Set();
  if (!norm) return found;

  for (const { abbrev, re } of LABEL_ABBREV_RULES) {
    if (re.test(raw) || re.test(norm)) found.add(abbrev);
  }

  if (compactText(raw).length <= 12) {
    for (const term of synonymRingFor(raw)) {
      found.add(term);
      if (term.length <= 6) found.add(term.replace(/\s/g, ''));
    }
  }

  if (/^[a-z0-9]{2,8}$/.test(norm)) found.add(norm);

  return found;
}

function addLabelParts(label, aliases) {
  const raw = String(label || '').trim();
  if (!raw) return;

  aliases.add(raw);

  const withoutParens = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (withoutParens) aliases.add(withoutParens);

  const paren = raw.match(/\(([^)]+)\)/);
  if (paren) {
    paren[1].split('/').forEach((part) => {
      const trimmed = part.trim();
      if (trimmed) aliases.add(trimmed);
    });
  }

  const slashParts = raw.includes('(') ? withoutParens : raw;
  slashParts.split('/').forEach((part) => {
    const trimmed = part.trim();
    if (trimmed) aliases.add(trimmed);
  });

  raw.split(':').forEach((part) => {
    const trimmed = part.trim();
    if (trimmed && trimmed.length > 2) aliases.add(trimmed);
  });

  raw.split(',').forEach((part) => {
    const trimmed = part.trim();
    if (trimmed && trimmed.length > 2) aliases.add(trimmed);
  });
}

export function stackAliasList(stack) {
  const label = String(stack?.label || stack?.name || '');
  const aliases = new Set([...(Array.isArray(stack?.aliases) ? stack.aliases : [])]);
  addLabelParts(label, aliases);

  for (const alias of [...aliases]) {
    for (const abbrev of inferAbbreviations(alias)) {
      aliases.add(abbrev);
    }
  }

  return [...aliases].filter(Boolean);
}

/** USG = ultrasound shorthand — matches any ultrasound order label. */
const USG_QUERY_TERMS = new Set(['usg', 'us scan']);

function isUltrasoundAlias(alias) {
  const n = normCommandText(alias);
  return n.includes('ultrasound') || /\becho\b/.test(n);
}

/** Higher score = better match. Returns -1 when no match. */
export function scoreOrderAliasMatch(query, alias, allAliases = []) {
  const t = normCommandText(query);
  const a = normCommandText(alias);
  if (!t || !a) return -1;

  if (t === a) {
    let score = 100000 + a.length;
    if (
      USG_QUERY_TERMS.has(t) &&
      allAliases.some((x) => {
        const xn = normCommandText(x);
        return isUltrasoundAlias(x) && (xn.includes('renal') || xn.includes('kidney'));
      })
    ) {
      score += 4000;
    }
    return score;
  }
  if (a.startsWith(t)) return 50000 + a.length;
  if (t.startsWith(a) && a.length >= 4) return 45000 + a.length;

  if (queryTokensMatchAlias(query, alias)) return 40000 + a.length;
  if (ringsOverlap(query, alias)) return 35000 + a.length;

  if (USG_QUERY_TERMS.has(t) && isUltrasoundAlias(alias)) {
    let score = 36000 + a.length;
    if (a.includes('renal') || a.includes('kidney')) score += 4000;
    return score;
  }

  const tCompact = compactText(query);
  const aCompact = compactText(alias);
  if (tCompact.length >= 4 && aCompact.length >= 4) {
    if (aCompact.includes(tCompact)) return 30000 + tCompact.length;
    if (tCompact.includes(aCompact) && aCompact.length >= 5) return 25000 + aCompact.length;
  }

  if (t.length >= 4 && a.length >= 4 && a.includes(t)) return 20000 + t.length;

  for (const abbrev of inferAbbreviations(alias)) {
    const ab = normCommandText(abbrev);
    const abCompact = compactText(abbrev);
    if (ab === t || abCompact === tCompact) return 18000;
  }

  const aliasPool = allAliases.length ? allAliases : [alias];
  const queryRing = synonymRingFor(query);
  for (const other of aliasPool) {
    const otherNorm = normCommandText(other);
    const otherCompact = compactText(other);
    if (otherNorm !== a && otherCompact !== aCompact) continue;
    const otherRing = synonymRingFor(other);
    if (queryRing.some((q) => otherRing.includes(q))) return 15000;
    for (const abbrev of inferAbbreviations(other)) {
      if (normCommandText(abbrev) === t || compactText(abbrev) === tCompact) return 12000;
    }
  }

  return -1;
}

export function orderAliasMatchesQuery(query, alias, allAliases = []) {
  return scoreOrderAliasMatch(query, alias, allAliases) >= 0;
}

function bestStackMatchForQuery(query, stacks, placed, { includePlaced = false } = {}) {
  const t = normCommandText(query);
  if (t.length < 2) return null;
  if (t.length === 2 && !SYNONYM_INDEX.has(t)) return null;

  let bestStack = null;
  let bestScore = -1;

  for (const stack of stacks) {
    if (!includePlaced && placed[stack.id]) continue;
    const aliases = stackAliasList(stack);
    for (const alias of aliases) {
      const score = scoreOrderAliasMatch(query, alias, aliases);
      if (score > bestScore) {
        bestScore = score;
        bestStack = stack;
      }
    }
  }

  return bestScore >= 0 ? bestStack : null;
}

/** Match typed order text to a stack in the current case. */
export function findStackMatchForQuery(query, stacks = [], placed = {}, options = {}) {
  return bestStackMatchForQuery(query, stacks, placed, options);
}

/** Case stack match — ignores placed filter so abbreviations still resolve to in-case stacks. */
export function resolveCaseStackOrder(query, stacks = [], placed = {}) {
  return (
    findStackMatchForQuery(query, stacks, placed) ||
    findStackMatchForQuery(query, stacks, {}, { includePlaced: true })
  );
}

/**
 * Physical exam bulk picker — match only when the CCS section aligns with a case stack.
 * Avoids generic "Physical Exam" alias matching every section to one Neuro stack.
 */
export function resolvePhysicalExamSectionStack(query, stacks = [], placed = {}) {
  const t = normCommandText(query);
  if (!t.includes('physical exam')) return null;

  for (const stack of stacks) {
    if (placed[stack.id]) continue;
    if (normCommandText(stack.label) === t) return stack;
  }

  const sectionPart = String(query).split(':').slice(1).join(':').trim();
  if (!sectionPart) return null;
  const sectionNorm = normCommandText(sectionPart);

  for (const stack of stacks) {
    if (placed[stack.id]) continue;
    const label = String(stack.label || '');
    if (!/physical exam/i.test(label)) continue;
    const stackSection = label.split(':').slice(1).join(':').trim();
    if (!stackSection) continue;
    if (normCommandText(stackSection) === sectionNorm) return stack;
    if (scoreOrderAliasMatch(sectionPart, stackSection, [stackSection]) >= 40000) return stack;
  }

  return null;
}

function queryMatchesAnyCaseStack(query, caseStacks = [], placed = {}) {
  if (resolveCaseStackOrder(query, caseStacks, placed)) return true;
  for (const stack of caseStacks) {
    const aliases = stackAliasList(stack);
    for (const alias of aliases) {
      if (scoreOrderAliasMatch(query, alias, aliases) >= 0) return true;
    }
  }
  return false;
}

/** Master order list match — skips orders already represented in this case's stacks. */
export function findKnownOrderMatch(query, allOrders = [], caseStacks = [], placed = {}) {
  const t = normCommandText(query);
  if (t.length < 2) return null;
  if (t.length === 2 && !SYNONYM_INDEX.has(t)) return null;
  if (queryMatchesAnyCaseStack(query, caseStacks, placed)) return null;

  let best = null;
  let bestScore = -1;

  for (const order of allOrders) {
    const name = String(order.name || '');
    if (!name) continue;
    const score = scoreOrderAliasMatch(query, name, [name]);
    if (score > bestScore) {
      bestScore = score;
      best = order;
    }
  }

  return bestScore >= 0 ? best : null;
}

/** Best full order text for Tab autocomplete, or null if already complete / no match. */
export function resolveOrderAutocomplete(input, match, extraAliases = []) {
  if (!match) return null;
  const typed = String(input || '').trimEnd();
  const trimmed = typed.trim();
  if (!trimmed) return null;

  const tNorm = normCommandText(trimmed);
  if (!tNorm) return null;

  const candidates = [...new Set([...stackAliasList(match), ...extraAliases])].filter(Boolean);
  if (!candidates.length) return null;

  let best = null;
  let bestScore = -1;

  for (const cand of candidates) {
    const cNorm = normCommandText(cand);
    if (!cNorm || cNorm === tNorm) continue;

    let score = scoreOrderAliasMatch(trimmed, cand, candidates);
    if (score < 0) {
      if (cNorm.startsWith(tNorm)) score = 1000 + cNorm.length;
      else if (tNorm.length >= 3 && cNorm.includes(tNorm)) score = 500 + cNorm.length;
    }

    if (score > bestScore) {
      best = cand;
      bestScore = score;
    }
  }

  return best;
}
