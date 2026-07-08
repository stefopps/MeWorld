/** Cases 135 (ACEI + NSAID) and 118 (rhabdomyolysis) — hyperkalemic emergency. */
export const HYPERKALEMIA_SPEC = {
  id: 'hyperkalemia',
  caseIds: ['135', '118'],
  baseline: { k: 6.8, ecgStage: 3 },
  /** Orders that count as "delay" without treating hyperK */
  delayIfNoTreatment: true,
  treatments: {
    stabilize: {
      orderIds: ['iv-calcium-gluconate'],
      labelRe: /calcium gluconate|calcium chloride/i,
      /** Membrane stabilization — ECG improves, K unchanged */
      effect: { kDelta: 0, ecgDelta: -1, capEcg: 2 },
    },
    shift: {
      orderIds: ['iv-insulin-glucose-albuterol-bicarb'],
      labelRe: /insulin.*glucose|albuterol|bicarb|beta.?agonist/i,
      effect: { kDelta: -1.1, ecgDelta: -1 },
    },
    eliminate: {
      orderIds: ['furosemide-dialysis'],
      labelRe: /furosemide|dialysis|kayexalate|patiromer|polystyrene/i,
      effect: { kDelta: -0.9, ecgDelta: -1 },
    },
    removeCause: {
      orderIds: ['discontinue-acei-nsaids'],
      labelRe: /discontinue.*ace|stop.*nsaid/i,
      effect: { kDelta: -0.2, ecgDelta: 0 },
    },
  },
  /** Each non-treatment order advances deterioration */
  delayPerOrder: { kDelta: 0.15, ecgDelta: 0.35 },
  kToEcgFloor: [
    { kMin: 7.2, ecgMin: 4 },
    { kMin: 6.9, ecgMin: 3 },
    { kMin: 6.3, ecgMin: 2 },
    { kMin: 5.8, ecgMin: 1 },
  ],
};
