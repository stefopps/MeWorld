import { readAudioPrefs } from './audioPrefs.js';
import { prefetchCaseAudio, readCaseAloud } from './caseReader.js';
import { resolvePatientDemographics } from './patientFactsFromHpi.js';
import { inferPatientSex } from './patientSex.js';
import { extractPatientSpokenText } from './patientReplyText.js';

/** Voice profile key sent to /api/read-case (maps to Chatterbox clone ref on server). */
export function patientVoiceProfile(caseData) {
  const demo = resolvePatientDemographics(caseData || {});
  if (demo.speakAsChild) {
    return inferPatientSex(caseData) === 'female' ? 'patient-child-girl' : 'patient-child-boy';
  }
  return inferPatientSex(caseData) === 'female' ? 'patient-female' : 'patient-male';
}

export function shouldAutoSpeakPatient() {
  const prefs = readAudioPrefs();
  if (prefs.voiceMuted) return false;
  return prefs.patientAutoSpeak === true;
}

export function shouldAutoSpeakAttending() {
  const prefs = readAudioPrefs();
  if (prefs.voiceMuted) return false;
  return prefs.attendingAutoSpeak === true;
}

function patientSpokenLine(text) {
  return extractPatientSpokenText(text);
}

/** Warm Chatterbox cache after a patient reply (no playback). */
export function prefetchPatientReplyAudio({ caseData, text, section = 'patient-chat' }) {
  const spoken = patientSpokenLine(text);
  if (!spoken) return Promise.resolve();

  return prefetchCaseAudio({
    caseId: caseData?.id,
    section,
    text: spoken,
    voiceProfile: patientVoiceProfile(caseData),
  });
}

/** Speak dialogue only — stage directions in *asterisks* are not read aloud. */
export function speakPatientReply({ caseData, text, section = 'patient-chat', onState, force = false }) {
  const spoken = patientSpokenLine(text);
  if (!spoken) return Promise.resolve();
  if (!force && !shouldAutoSpeakPatient()) return Promise.resolve();

  return readCaseAloud({
    caseId: caseData?.id,
    section,
    text: spoken,
    voiceProfile: patientVoiceProfile(caseData),
    onState,
  });
}
