/** Simplified conduction pathway segments — normalized 0–1 in heart view box. */
export var CONDUCTION_SEGMENTS = {
  sa: { label: 'SA node', points: [[0.52, 0.18], [0.48, 0.22], [0.56, 0.22]] },
  atria: { label: 'Atria', points: [[0.38, 0.24], [0.62, 0.24], [0.58, 0.34], [0.42, 0.34]] },
  av: { label: 'AV node', points: [[0.5, 0.36], [0.48, 0.4], [0.52, 0.4]] },
  his: { label: 'Bundle of His', points: [[0.5, 0.4], [0.5, 0.48]] },
  lbb: { label: 'Left bundle', points: [[0.5, 0.48], [0.42, 0.58], [0.38, 0.68]] },
  rbb: { label: 'Right bundle', points: [[0.5, 0.48], [0.58, 0.56], [0.6, 0.66]] },
  purkinje: { label: 'Purkinje', points: [[0.36, 0.7], [0.5, 0.72], [0.64, 0.7], [0.5, 0.78]] },
  ventricles: { label: 'Ventricles', points: [[0.32, 0.52], [0.68, 0.52], [0.62, 0.82], [0.38, 0.82]] },
};
