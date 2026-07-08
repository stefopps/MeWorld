/**
 * HyperK pharmacology bank — teaching doses & membrane/K+ effects.
 * Sources: MeWorld hyperkalemia case 135 playbook, KDIGO/ACLS hyperK protocols,
 * standard IV dosing (UpToDate-aligned teaching ranges).
 * Loaded as window.HYPERK_PHARM_BANK
 */
'use strict';

(function () {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** @param {number} dose @returns {{ kDelta: number, thresholdDelta: number, label: string }} */
  function caEffect(dose) {
    if (dose <= 0) return { kDelta: 0, thresholdDelta: 0, label: 'No membrane effect' };
    // 1 g IV ≈ 10 mL of 10% soln (~93 mg elemental Ca) — stabilizes myocardium, K+ unchanged
    const thr = -Math.min(23, dose * 7.5);
    return {
      kDelta: 0,
      thresholdDelta: thr,
      label: `Threshold ~${Math.round(-55 + thr)} mV · K⁺ unchanged (membrane stabilization)`,
    };
  }

  function insulinEffect(units) {
    if (units <= 0) return { kDelta: 0, thresholdDelta: 0, label: 'No shift' };
    const kd = -units * 0.09;
    return {
      kDelta: kd,
      thresholdDelta: 0,
      label: `K⁺ ↓ ~${Math.abs(kd).toFixed(1)} mEq/L (β-cell / Na⁺/K⁺-ATPase shift, ~15–30 min)`,
    };
  }

  function albuterolEffect(mg) {
    if (mg <= 0) return { kDelta: 0, thresholdDelta: 0, label: 'No shift' };
    const kd = -mg * 0.06;
    return {
      kDelta: kd,
      thresholdDelta: 0,
      label: `K⁺ ↓ ~${Math.abs(kd).toFixed(1)} mEq/L (β₂ agonist → cellular K⁺ uptake)`,
    };
  }

  function bicarbEffect(mEq) {
    if (mEq <= 0) return { kDelta: 0, thresholdDelta: 0, label: 'No shift' };
    const kd = -mEq * 0.008;
    return {
      kDelta: kd,
      thresholdDelta: 0,
      label: `K⁺ ↓ ~${Math.abs(kd).toFixed(1)} mEq/L if acidotic (H⁺/K⁺ exchange)`,
    };
  }

  function lasixEffect(mg) {
    if (mg <= 0) return { kDelta: 0, thresholdDelta: 0, label: 'No renal loss yet' };
    const kd = -mg * 0.012;
    return {
      kDelta: kd,
      thresholdDelta: 0,
      label: `K⁺ ↓ ~${Math.abs(kd).toFixed(1)} mEq/L (distal tubular excretion)`,
    };
  }

  function dialysisEffect(mEq) {
    if (mEq <= 0) return { kDelta: 0, thresholdDelta: 0, label: 'Not started' };
    const kd = -mEq;
    return {
      kDelta: kd,
      thresholdDelta: 0,
      label: `K⁺ ↓ ~${Math.abs(kd).toFixed(1)} mEq/L (definitive removal)`,
    };
  }

  /** Teaching toxin — K⁺ load + mitochondrial block → worse hyperK */
  function kcnEffect(mg) {
    if (mg <= 0) return { kDelta: 0, thresholdDelta: 0, label: 'No exposure' };
    const kd = mg * 0.35;
    const thr = -Math.min(10, mg * 2.5);
    return {
      kDelta: kd,
      thresholdDelta: thr,
      label: `K⁺ ↑ ~${kd.toFixed(1)} mEq/L · CN⁻ blocks ATP → resting depolarizes`,
    };
  }

  const BANK = {
    ca: {
      id: 'ca',
      name: 'Calcium gluconate IV',
      category: 'stabilize',
      doseUnit: 'g',
      doseLabel: 'Dose (grams 10% soln)',
      doseMin: 0,
      doseMax: 3,
      doseStep: 0.5,
      doseDefault: 1,
      formatDose: (d) => (d === 0 ? '0 g' : `${d} g (${d * 10} mL of 10%)`),
      reference:
        '1–3 g IV over 2–3 min (10–30 mL of 10% solution). Onset ~1–3 min. Does NOT lower serum K⁺ — raises cardiac threshold (ACLS/KDIGO).',
      mechanism:
        'Extracellular Ca²⁺ antagonizes hyperkalemic depolarization of cardiac myocytes → threshold moves away from resting Vm. Safety gap widens on the graph; resting line unchanged.',
      lowersK: false,
      effect: caEffect,
    },
    insulin: {
      id: 'insulin',
      name: 'Regular insulin + dextrose',
      category: 'shift',
      doseUnit: 'units',
      doseLabel: 'Insulin (units IV)',
      doseMin: 0,
      doseMax: 20,
      doseStep: 1,
      doseDefault: 10,
      formatDose: (d) => `${d} units (+ dextrose)`,
      reference:
        'Typical 10 units regular insulin + 25 g glucose IV. K⁺ falls ~0.6–1.2 mEq/L over 15–30 min (teaching range).',
      mechanism:
        'Insulin drives Na⁺/K⁺-ATPase → K⁺ shifts into cells. Resting Vm moves toward normal as serum K⁺ falls — red resting line drops on graph.',
      lowersK: true,
      effect: insulinEffect,
    },
    albuterol: {
      id: 'albuterol',
      name: 'Albuterol nebulized',
      category: 'shift',
      doseUnit: 'mg',
      doseLabel: 'Albuterol (mg nebulized)',
      doseMin: 0,
      doseMax: 20,
      doseStep: 2.5,
      doseDefault: 10,
      formatDose: (d) => `${d} mg`,
      reference:
        '10–20 mg nebulized (hyperK dose, higher than asthma). K⁺ ↓ ~0.5–1.0 mEq/L via β₂-mediated cellular uptake.',
      mechanism:
        'β₂-agonism activates Na⁺/K⁺-ATPase on skeletal muscle and liver — intracellular K⁺ shift. Adjunct to insulin; not a substitute for calcium if ECG is toxic.',
      lowersK: true,
      effect: albuterolEffect,
    },
    kcn: {
      id: 'kcn',
      name: 'Potassium cyanide (KCN)',
      category: 'toxin',
      doseUnit: 'mg',
      doseLabel: 'KCN dose (mg, teaching)',
      doseMin: 0,
      doseMax: 5,
      doseStep: 0.5,
      doseDefault: 1,
      formatDose: (d) => (d === 0 ? '0 mg' : `${d} mg KCN`),
      reference:
        'Lethal poison — releases K⁺ and blocks oxidative phosphorylation. Na⁺/K⁺-ATPase fails without ATP; Vm collapses toward threshold.',
      mechanism:
        'Extracellular K⁺ rises from the cyanide salt; intracellular K⁺ leaks out as ATP-dependent pumps fail. Resting Vm shifts up — safety gap narrows further.',
      lowersK: false,
      raisesK: true,
      effect: kcnEffect,
    },
    bicarb: {
      id: 'bicarb',
      name: 'Sodium bicarbonate IV',
      category: 'shift',
      doseUnit: 'mEq',
      doseLabel: 'Bicarbonate (mEq)',
      doseMin: 0,
      doseMax: 150,
      doseStep: 25,
      doseDefault: 50,
      formatDose: (d) => `${d} mEq`,
      reference: '50–150 mEq IV if metabolic acidosis — H⁺/K⁺ exchange shifts K⁺ into cells.',
      mechanism:
        'Alkalosis reduces H⁺ extrusion in exchange for K⁺ entry. Modest K⁺ drop; most useful when acidotic.',
      lowersK: true,
      effect: bicarbEffect,
    },
    lasix: {
      id: 'lasix',
      name: 'Furosemide IV',
      category: 'eliminate',
      doseUnit: 'mg',
      doseLabel: 'Furosemide (mg IV)',
      doseMin: 0,
      doseMax: 80,
      doseStep: 10,
      doseDefault: 40,
      formatDose: (d) => `${d} mg`,
      reference: '40–80 mg IV if urine output adequate — renal K⁺ wasting over hours.',
      mechanism:
        'Loop diuretic increases distal delivery of Na⁺ and flow → enhanced K⁺ secretion. Slower than shift agents.',
      lowersK: true,
      effect: lasixEffect,
    },
    dialysis: {
      id: 'dialysis',
      name: 'Emergent dialysis',
      category: 'eliminate',
      doseUnit: 'mEq',
      doseLabel: 'Expected K⁺ removal (mEq/L)',
      doseMin: 0,
      doseMax: 2.5,
      doseStep: 0.5,
      doseDefault: 2,
      formatDose: (d) => `↓ ${d} mEq/L`,
      reference: 'Definitive for refractory hyperK or renal failure — removes K⁺ from plasma directly.',
      mechanism:
        'Dialysate K⁺ gradient pulls potassium out of blood. Largest reliable drop when shift agents insufficient.',
      lowersK: true,
      effect: dialysisEffect,
    },
  };

  const ORDER = ['ca', 'insulin', 'albuterol', 'kcn', 'bicarb', 'lasix', 'dialysis'];
  const CATEGORIES = {
    stabilize: 'Stabilize membrane',
    shift: 'Shift K⁺ into cells',
    toxin: 'Toxins / worsen',
    eliminate: 'Eliminate K⁺',
  };

  function computeFromDoses(doses, baselineK = 6.8) {
    let k = baselineK;
    let thresholdMv = -55;
    const lines = [];
    for (const id of ORDER) {
      const drug = BANK[id];
      const dose = Number(doses[id]) || 0;
      if (dose <= 0) continue;
      const eff = drug.effect(dose);
      k += eff.kDelta || 0;
      thresholdMv += eff.thresholdDelta || 0;
      let label = eff.label;
      if (drug.lowersK && eff.kDelta) {
        label = `Serum K⁺ → ${clamp(k, 2.5, 9.5).toFixed(1)} mEq/L (target 3.5–5.0)`;
      } else if (id === 'ca' && eff.thresholdDelta) {
        label = `Serum K⁺ ${k.toFixed(1)} mEq/L unchanged · threshold ~${Math.round(thresholdMv)} mV`;
      } else if (drug.raisesK && eff.kDelta) {
        label = `Serum K⁺ → ${clamp(k, 2.5, 9.5).toFixed(1)} mEq/L · resting Vm rises`;
      }
      lines.push({ id, name: drug.name, dose, ...eff, label });
    }
    k = clamp(k, 2.5, 9.5);
    thresholdMv = clamp(thresholdMv, -85, -55);
    return { k, thresholdMv, lines, calciumActive: (doses.ca || 0) > 0 };
  }

  window.HYPERK_PHARM_BANK = {
    BANK,
    ORDER,
    CATEGORIES,
    computeFromDoses,
  };
})();
