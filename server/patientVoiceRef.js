import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.join(__dirname, '..');

const CHATTERBOX_ROOT =
  process.env.CHATTERBOX_ROOT ||
  path.join(process.env.USERPROFILE || process.env.HOME || '', 'chatterbox');

const DEFAULT_MALE_REF = path.join(CHATTERBOX_ROOT, 'VoiceClone_STEF_AMP_under25MB.flac');
const DEFAULT_CHILD_GIRL_REF = path.join(GAME_ROOT, 'assets', 'voices', 'patient-child-black-girl-6yo.wav');
const DEFAULT_CHILD_BOY_REF = path.join(GAME_ROOT, 'assets', 'voices', 'patient-child-black-boy-7yo.wav');
const DEFAULT_CHILD_REF = DEFAULT_CHILD_GIRL_REF;

function wantsDefaultVoice(value) {
  const key = String(value || '').trim().toLowerCase();
  return !key || key === 'none' || key === 'default' || key === 'unprompted';
}

function resolveEnvPath(value) {
  if (wantsDefaultVoice(value)) return 'none';
  const p = path.resolve(String(value).trim());
  if (!fs.existsSync(p)) {
    throw new Error(`Voice reference not found: ${p}`);
  }
  return p;
}

/**
 * Chatterbox Turbo has one unprompted default when ref is "none".
 * Gender-matched speech uses short clone clips via env (or Stef male default on this machine).
 */
export function resolveVoiceRefForProfile(voiceProfile = 'narrator') {
  const profile = String(voiceProfile || 'narrator').trim().toLowerCase();

  if (profile === 'narrator' || profile === 'default' || profile === 'read-case') {
    return process.env.CHATTERBOX_VOICE_REF || '';
  }

  const envByProfile = {
    'patient-male': 'CHATTERBOX_PATIENT_VOICE_MALE',
    'patient-female': 'CHATTERBOX_PATIENT_VOICE_FEMALE',
    'patient-child': 'CHATTERBOX_PATIENT_VOICE_CHILD',
    'patient-child-girl': 'CHATTERBOX_PATIENT_VOICE_CHILD_GIRL',
    'patient-child-boy': 'CHATTERBOX_PATIENT_VOICE_CHILD_BOY',
  };

  const envKey = envByProfile[profile];
  if (!envKey) return process.env.CHATTERBOX_VOICE_REF || '';

  const fromEnv = process.env[envKey];
  if (fromEnv) return resolveEnvPath(fromEnv);

  if (profile === 'patient-male' && fs.existsSync(DEFAULT_MALE_REF)) {
    return DEFAULT_MALE_REF;
  }

  if (profile === 'patient-child-boy') {
    if (fs.existsSync(DEFAULT_CHILD_BOY_REF)) return DEFAULT_CHILD_BOY_REF;
    if (fs.existsSync(DEFAULT_CHILD_GIRL_REF)) return DEFAULT_CHILD_GIRL_REF;
    return 'none';
  }

  if (profile === 'patient-child-girl' || profile === 'patient-child') {
    if (fs.existsSync(DEFAULT_CHILD_GIRL_REF)) return DEFAULT_CHILD_GIRL_REF;
    if (fs.existsSync(DEFAULT_CHILD_BOY_REF)) return DEFAULT_CHILD_BOY_REF;
    return 'none';
  }

  return 'none';
}

export function listPatientVoiceConfig() {
  const male = process.env.CHATTERBOX_PATIENT_VOICE_MALE || (fs.existsSync(DEFAULT_MALE_REF) ? DEFAULT_MALE_REF : 'none');
  const female = process.env.CHATTERBOX_PATIENT_VOICE_FEMALE || 'none';
  const childBoy =
    process.env.CHATTERBOX_PATIENT_VOICE_CHILD_BOY ||
    (fs.existsSync(DEFAULT_CHILD_BOY_REF) ? DEFAULT_CHILD_BOY_REF : 'none');
  const childGirl =
    process.env.CHATTERBOX_PATIENT_VOICE_CHILD_GIRL ||
    process.env.CHATTERBOX_PATIENT_VOICE_CHILD ||
    (fs.existsSync(DEFAULT_CHILD_GIRL_REF) ? DEFAULT_CHILD_GIRL_REF : 'missing');
  return {
    narrator: process.env.CHATTERBOX_VOICE_REF || 'none',
    patientMale: male,
    patientFemale: female,
    patientChild: childGirl,
    patientChildBoy: childBoy,
    patientChildGirl: childGirl,
    gameChildBoyDefault: fs.existsSync(DEFAULT_CHILD_BOY_REF) ? DEFAULT_CHILD_BOY_REF : 'missing',
    gameChildGirlDefault: fs.existsSync(DEFAULT_CHILD_GIRL_REF) ? DEFAULT_CHILD_GIRL_REF : 'missing',
    childModel: process.env.CHATTERBOX_PATIENT_CHILD_MODEL || 'expressive',
    note:
      'Pediatric patient_sim uses expressive Chatterbox + child clone ref. Run fetch_patient_child_voice.py (girl/boy). Turbo paralinguistics: [sigh] [laugh] in text.',
  };
}
