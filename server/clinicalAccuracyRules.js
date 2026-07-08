import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const RULES_REL = path.join('dev', 'case-story', 'CLINICAL_ACCURACY_RULES.md');

/** Compact prompt block — stays within Magnific budget when composed with camera + character lock. */
const ECG_TELEMETRY_BLOCK = `CLINICAL ACCURACY — ECG / TELEMETRY (mandatory when monitor or leads in frame):
- ECG/telemetry electrodes on BARE CHEST SKIN only — gown open at front exposing anterior chest.
- NEVER place ECG pads on shirt, jacket, sweater, or closed gown fabric.
- Vitals monitor MUST show numeric heart rate, SpO2 %, and scrolling ECG waveform trace (green/white line).
- FORBIDDEN: electrodes over clothing; monitor blank or only abstract dots with no HR/ECG trace.`;

const IV_BLOCK = `CLINICAL ACCURACY — IV (when IV in frame):
- Peripheral 20g IV in antecubital fossa (inner elbow), transparent dressing + taped tubing.
- No IV on arrival/triage beats unless narrative says lines placed.`;

const ED_WARDROBE_BLOCK = `CLINICAL ACCURACY — ED WARDROBE:
- Adult male: bare chest or open-back hospital exam gown — NO street clothes under telemetry.
- Match getHospitalWardrobePrompt() — shirtless or gown open for any telemetry beat.`;

const HOME_SCENE_NOTE = `SCENE: Pre-hospital home — domestic bedroom or living room, morning light.
NO hospital stretcher, NO vitals monitor, NO ECG leads. Same patient likeness in home clothes or pajamas.`;

const C3_ESCALATION_BLOCK = `BEAT c3 ESCALATION — telemetry + workup:
- Telemetry leads on EXPOSED bare chest (gown parted open).
- Primary monitor: HR number + ECG waveform + SpO2 visible.
- MRI/DWI "peppered specks" may appear on secondary tablet/screen — NOT replacing vitals trace on main monitor.`;

export function clinicalAccuracyRulesPath(rootDir) {
  return path.join(rootDir, RULES_REL);
}

export async function readClinicalAccuracyRules(rootDir) {
  const file = clinicalAccuracyRulesPath(rootDir);
  if (!fs.existsSync(file)) return null;
  try {
    return (await fsp.readFile(file, 'utf8')).trim() || null;
  } catch {
    return null;
  }
}

export function isHomeStoryBeat(chapter = {}) {
  const id = String(chapter?.id || '').trim().toLowerCase();
  const heading = String(chapter?.heading || '').toLowerCase();
  const hint = String(chapter?.visualHint || '').toLowerCase();
  return (
    id === 'c0'
    || id.includes('home')
    || id.includes('pre-hospital')
    || heading.includes('home')
    || hint.includes('home')
    || hint.includes('bedroom')
  );
}

export function isTelemetryBeat(beatId = '', chapter = {}) {
  const id = String(beatId || chapter?.id || '').trim().toLowerCase();
  const body = String(chapter?.body || '').toLowerCase();
  const hint = String(chapter?.visualHint || '').toLowerCase();
  if (id === 'c3') return true;
  return (
    hint.includes('telemetry')
    || hint.includes('ecg')
    || hint.includes('monitor')
    || body.includes('telemetry')
    || body.includes('atrial fibrillation')
  );
}

/**
 * @param {{ scene?: 'home'|'ed', beatId?: string, chapter?: object }} opts
 */
export function buildClinicalAccuracyPromptBlock({ scene = 'ed', beatId = '', chapter = {} } = {}) {
  if (scene === 'home' || isHomeStoryBeat(chapter)) {
    return HOME_SCENE_NOTE;
  }

  const parts = [ED_WARDROBE_BLOCK];
  if (isTelemetryBeat(beatId, chapter)) {
    parts.push(ECG_TELEMETRY_BLOCK);
    if (String(beatId).toLowerCase() === 'c3') parts.push(C3_ESCALATION_BLOCK);
  } else {
    parts.push(IV_BLOCK);
  }
  return parts.join('\n\n');
}
