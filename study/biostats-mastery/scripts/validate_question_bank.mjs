#!/usr/bin/env node
/**
 * validate_question_bank.mjs — cross-cutting validator for stats_questions.json
 *
 * Catches every bug class discovered in the biostats-module audit session.
 * Usage: node scripts/validate_question_bank.mjs [--path stats_questions.json] [--verbose]
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, '..', 'stats_questions.json');

// ── Normal CDF (Abramowitz & Stegun 26.2.17) ──
function normalCDF(z) {
  if (z < 0) return 1 - normalCDF(-z);
  const b0 = 0.2316419, b1 = 0.319381530, b2 = -0.356563782,
        b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
  const t = 1 / (1 + b0 * z);
  const pdf = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  return 1 - pdf * (b1 * t + b2 * t**2 + b3 * t**3 + b4 * t**4 + b5 * t**5);
}

function pValueFromCI(estimate, ciLow, ciHigh) {
  if (ciLow <= 0 || ciHigh <= 0 || estimate <= 0) return null;
  const seLog = (Math.log(ciHigh) - Math.log(ciLow)) / (2 * 1.959964);
  if (seLog <= 0) return null;
  const z = Math.log(estimate) / seLog;
  return 2 * (1 - normalCDF(Math.abs(z)));
}

// ── Concept-to-graph-type mapping ──
const CONCEPT_TYPE_MAP = [
  [/non.?inferiority|noninferiority|pre.?specified\s*margin|NI\s*margin/i, 'forestPlot'],
  [/carryover\s*effect|crossover.*washout|lead.?time\s*bias|length.?time\s*bias|recall\s*bias|selection\s*bias|confounding\s*by/i, 'biasDiagram'],
  [/subgroup.*analysis|forest.?plot|multiple\s*comparisons|multiplicity/i, 'forestPlot'],
];

const SOFT_CONCEPT_WARN = [
  [/paired.*test|paired\s*analysis|within.?patient/i, 'normal', 'Paired/within-patient questions typically use normal or spaghettiPlot, not cumulative'],
  [/CI\s*width|confidence\s*interval.*narrow|precision.*sample|same\s*point\s*estimate/i, 'forestPlot', 'CI-width questions benefit from forestPlot for visual precision comparison'],
];

const TERM_GRAPH_WARN = {
  'RR': 'cumulative',
  'OR': 'bar',
  'ARR': 'bar',
  'NNT': 'bar',
  'hazard ratio': 'cumulative',
  'survival': 'cumulative',
  'Kaplan': 'cumulative',
};

const N_SLIDER_MIN = 4;
const N_SLIDER_MAX = 20000;

// ─────────────────────────────────────────────────────────────
function validate(questions, verbose = false) {
  const errors = [];
  const warnings = [];
  const stats = { total: questions.length, byType: {}, pValueChecks: 0, pValueMismatches: 0 };

  for (const q of questions) {
    const qid = q.id ?? '?';
    const prefix = `[Q${qid}]`;

    // ═══════ 1. Structural ═══════
    const requiredTop = ['id', 'stem', 'options', 'correct', 'baseGraph', 'explanation', 'trap'];
    for (const field of requiredTop) {
      if (!(field in q)) errors.push(`${prefix} Missing top-level field: '${field}'`);
    }

    if (!Array.isArray(q.options)) continue;
    if (q.options.length !== 5) {
      errors.push(`${prefix} Expected 5 options, got ${q.options.length}`);
    }

    const correct = q.correct;
    if (typeof correct !== 'number' || correct < 0 || correct >= q.options.length) {
      errors.push(`${prefix} Invalid correct index: ${correct}`);
    }

    const baseGraph = q.baseGraph || {};
    const graphType = baseGraph.type || 'cumulative';
    stats.byType[graphType] = (stats.byType[graphType] || 0) + 1;

    // Validate each option
    for (let oi = 0; oi < q.options.length; oi++) {
      const opt = q.options[oi];
      const opref = `${prefix} option ${oi}`;
      for (const field of ['label', 'text', 'graph', 'desc']) {
        if (!(field in opt)) errors.push(`${opref} Missing field: '${field}'`);
      }
      if (!opt.graph) continue;
      const g = opt.graph;

      if (graphType === 'cumulative') {
        for (const k of ['hr', 'brate']) {
          if (k in g && typeof g[k] !== 'number') errors.push(`${opref} graph.${k} is not numeric`);
        }
        if (typeof g.hr === 'number') {
          if (g.hr <= 0) errors.push(`${opref} graph.hr = ${g.hr} — must be > 0`);
          if (g.hr > 5) warnings.push(`${opref} graph.hr = ${g.hr} — unusually far from 1.0`);
        }
      }

      if (graphType === 'normal' && g.d === 0.8) {
        warnings.push(`${opref} graph.d = 0.8 — known copy-paste placeholder`);
      }
    }

    // ═══════ 2. baseGraph vs correct-option consistency ═══════
    if (typeof correct === 'number' && correct >= 0 && correct < q.options.length) {
      const correctGraph = q.options[correct].graph || {};
      const overlapKeys = Object.keys(baseGraph).filter(k => k in correctGraph);
      for (const k of overlapKeys) {
        if (baseGraph[k] !== correctGraph[k]) {
          const isFloatMismatch = typeof baseGraph[k] === 'number' && typeof correctGraph[k] === 'number' && Math.abs(baseGraph[k] - correctGraph[k]) < 1e-9;
          if (!isFloatMismatch) {
            errors.push(
              `${prefix} baseGraph.${k} = ${JSON.stringify(baseGraph[k])} ≠ correct option graph.${k} = ${JSON.stringify(correctGraph[k])}`
            );
          }
        }
      }
    }

    // ═══════ 3. baseGraph.d placeholder for normal-type ═══════
    if (graphType === 'normal' && 'd' in baseGraph && baseGraph.d === 0.8) {
      const correctGraph = q.options[correct]?.graph || {};
      warnings.push(
        `${prefix} baseGraph.d = 0.8 (known placeholder) — should match correct option (${correctGraph.d ?? '?'})`
      );
    }

    // ═══════ 4. forestPlot row integrity ═══════
    if (graphType === 'forestPlot' && Array.isArray(baseGraph.rows)) {
      for (let ri = 0; ri < baseGraph.rows.length; ri++) {
        const row = baseGraph.rows[ri];
        if (!row) continue;
        // REQUIRED fields — renderer will crash without these
        for (const req of ['label', 'estimate', 'ciLow', 'ciHigh']) {
          if (!(req in row) || row[req] == null) {
            errors.push(`${prefix} baseGraph.rows[${ri}] missing required field '${req}' — renderer will crash`);
          }
        }
        // pValue: warn if missing (renderer now falls back gracefully, but authoring is preferred)
        if (!('pValue' in row) || row.pValue == null) {
          const derived = (row.estimate != null && row.ciLow != null && row.ciHigh != null)
            ? pValueFromCI(row.estimate, row.ciLow, row.ciHigh) : null;
          warnings.push(
            `${prefix} baseGraph.rows[${ri}] ('${row.label || '?'}') missing pValue — renderer derives ${derived ? 'p=' + derived.toFixed(3) : '?*'} at runtime; pre-author for control`
          );
        }
        // Consistency check if pValue IS provided
        if ('pValue' in row && row.pValue != null && 'ciLow' in row && 'ciHigh' in row && row.estimate != null) {
          const recalc = pValueFromCI(row.estimate, row.ciLow, row.ciHigh);
          if (recalc !== null) {
            stats.pValueChecks++;
            const stored = row.pValue;
            if (Math.abs(stored - recalc) >= 0.02) {
              stats.pValueMismatches++;
              warnings.push(
                `${prefix} row '${row.label || '?'}': stored p=${stored.toFixed(4)}, recalculated p=${recalc.toFixed(4)} — mismatch`
              );
            }
          }
        }
      }
      // Check per-option rows too (Q26-style option-specific forest plots)
      for (let oi = 0; oi < q.options.length; oi++) {
        const optRows = q.options[oi].graph?.rows;
        if (!Array.isArray(optRows)) continue;
        for (let ri = 0; ri < optRows.length; ri++) {
          const row = optRows[ri];
          if (!row) continue;
          for (const req of ['label', 'estimate', 'ciLow', 'ciHigh']) {
            if (!(req in row) || row[req] == null) {
              errors.push(`${prefix} option ${oi} graph.rows[${ri}] missing required field '${req}'`);
            }
          }
          if (!('pValue' in row) || row.pValue == null) {
            warnings.push(
              `${prefix} option ${oi} graph.rows[${ri}] ('${row.label || '?'}') missing pValue`
            );
          }
        }
      }
    }

    if (graphType === 'forestPlot' && (!Array.isArray(baseGraph.rows) || baseGraph.rows.length === 0)) {
      errors.push(`${prefix} forestPlot type but baseGraph.rows is empty or missing`);
    }

    // ═══════ 5. Range safety for cumulative HR ═══════
    if (graphType === 'cumulative') {
      const allHRs = [];
      for (const opt of q.options) {
        if (opt.graph && typeof opt.graph.hr === 'number') allHRs.push(opt.graph.hr);
      }
      if (typeof baseGraph.hr === 'number') allHRs.push(baseGraph.hr);
      for (const hr of allHRs) {
        if (hr <= 0) errors.push(`${prefix} HR = ${hr} — must be > 0`);
      }
    }

    // ═══════ 6. Terminology: RR/OR vs cumulative ═══════
    const textBlob = ((q.ad || q.description || '') + ' ' + (q.stem || '')).toLowerCase();
    for (const [term, expectedType] of Object.entries(TERM_GRAPH_WARN)) {
      if (textBlob.includes(term.toLowerCase()) && graphType !== expectedType) {
        // Only flag if the graph type IS cumulative (which specifically mismatches)
        // OR if the ad title explicitly frames the term as a primary measure
        const adTitle = (q.ad || q.description || '').toLowerCase();
        const measureInTitle = /(relative risk|odds ratio|absolute risk|nnt|hazard ratio|survival)/i.test(
          adTitle.slice(0, 120)
        );
        if ((graphType === 'cumulative' && expectedType !== 'cumulative') ||
            (measureInTitle && adTitle.includes(term.toLowerCase()))) {
          warnings.push(`${prefix} mentions '${term}' but graph type is '${graphType}' (expected '${expectedType}')`);
        }
      }
    }

    // ═══════ 7. Concept-to-graph-type ═══════
    for (const [pattern, expectedType] of CONCEPT_TYPE_MAP) {
      if (pattern.test(textBlob) && graphType !== expectedType) {
        const isSoft = SOFT_CONCEPT_WARN.some(([sp]) => sp.test(textBlob));
        const msg = `${prefix} Concept '${pattern.source}' detected → expected '${expectedType}', got '${graphType}'`;
        (isSoft ? warnings : errors).push(msg);
      }
    }

    for (const [pattern, recType, advice] of SOFT_CONCEPT_WARN) {
      if (pattern.test(textBlob) && graphType !== recType) {
        warnings.push(`${prefix} ${advice} (current: ${graphType})`);
      }
    }

    // ═══════ 8. crossAt requires hrEarly ═══════
    if (graphType === 'cumulative' && 'crossAt' in baseGraph && !('hrEarly' in baseGraph)) {
      errors.push(`${prefix} crossAt is set but hrEarly is missing — crossing curves won't render`);
    }

    // ═══════ 9. Option-delta for normal-type ═══════
    if (graphType === 'normal') {
      const dVals = q.options.map(o => o.graph?.d).filter(d => typeof d === 'number');
      const uniqueD = new Set(dVals);
      if (uniqueD.size < 3 && dVals.length === 5) {
        warnings.push(`${prefix} Only ${uniqueD.size} distinct d-values across 5 options — options may not be differentiated`);
      }
    }

    // ═══════ 10. Slider range for normal-type option n values ═══════
    if (graphType === 'normal') {
      for (let oi = 0; oi < q.options.length; oi++) {
        const n = q.options[oi].graph?.n;
        if (typeof n === 'number') {
          if (n < N_SLIDER_MIN) warnings.push(`${prefix} option ${oi} n=${n} below slider min (${N_SLIDER_MIN})`);
          if (n > N_SLIDER_MAX) warnings.push(`${prefix} option ${oi} n=${n} exceeds slider max (${N_SLIDER_MAX})`);
        }
      }
    }

    // Ensure normal-type has d, n, alpha in baseGraph
    if (graphType === 'normal') {
      for (const param of ['d', 'n', 'alpha']) {
        if (!(param in baseGraph)) warnings.push(`${prefix} normal-type missing baseGraph.${param}`);
      }
    }
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Validated ${stats.total} questions`);
  console.log(`  Types: ${Object.entries(stats.byType).sort().map(([t, c]) => `${t}=${c}`).join(', ')}`);
  console.log(`  P-value checks: ${stats.pValueChecks} rows, ${stats.pValueMismatches} mismatches`);
  console.log(`  Errors:   ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`${'═'.repeat(60)}\n`);

  if (errors.length) {
    console.log('🔴 ERRORS:');
    for (const e of errors) console.log(`  ${e}`);
  }

  if (warnings.length) {
    console.log('\n🟡 WARNINGS:');
    for (const w of warnings) console.log(`  ${w}`);
  }

  if (!errors.length && !warnings.length) {
    console.log('✅ All checks passed — no errors or warnings.');
  }

  console.log();
  return errors.length === 0;
}

// ── CLI ──
const args = process.argv.slice(2);
const pathIdx = args.indexOf('--path');
const verbose = args.includes('--verbose');
const dataPath = pathIdx >= 0 ? args[pathIdx + 1] : DEFAULT_PATH;

console.log(`Validating: ${dataPath}`);
let data;
try {
  data = JSON.parse(readFileSync(dataPath, 'utf8'));
} catch (e) {
  console.error(`Failed to read/parse: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error('Root must be a JSON array');
  process.exit(1);
}

const ok = validate(data, verbose);
process.exit(ok ? 0 : 1);
