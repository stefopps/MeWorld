/** Browser-safe scene plate path normalization (no Node fs). */

const DEFAULT_PLATES = {
  male: '/assets/patient/patient-scene.png',
  female: '/assets/patient/patient-scene-source-square.png',
  pedMale: '/assets/patient/patient-scene-ped-male.png',
  pedFemale: '/assets/patient/patient-scene-source-square.png',
};

function defaultPlateForSceneKey(sceneKey) {
  if (sceneKey === 'female' || sceneKey === 'pedFemale') {
    return DEFAULT_PLATES[sceneKey] || DEFAULT_PLATES.female;
  }
  if (sceneKey === 'pedMale') return DEFAULT_PLATES.pedMale;
  return DEFAULT_PLATES.male;
}

/** Normalize baseplate path for play vs generation (female uses square source plate). */
export function sanitizeScenePlateSrc(src, { sceneKey } = {}) {
  const rel = String(src || '').trim();
  if (!rel) return defaultPlateForSceneKey(sceneKey);
  return rel;
}
