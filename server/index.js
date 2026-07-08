import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import { spawn } from 'child_process';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { loadMasterEnv } from './loadMasterEnv.js';

loadMasterEnv();
import {
  buildOrLoadManifest,
  countReadyChunks,
  manifestToPlaylist,
  readManifest,
  syncManifestWithDisk,
} from './caseTtsCache.js';
import { listPatientVoiceConfig, resolveVoiceRefForProfile } from './patientVoiceRef.js';
import {
  appendCaseNotesBlockText,
  appendChatHistory,
  appendTimelineEvent,
  endCaseSession,
  getOverallStats,
  listCaseVisitSummaries,
  readCaseNotesText,
  readCaseUser,
  saveRecording,
  startCaseSession,
  writeCaseNotesText,
} from './userCaseStore.js';
import { diffCaseLedger, writeCaseLedger } from './caseLedger.js';
import {
  mergeVoiceNoteTranscript,
  transcribeAudioChunk,
  transcribeFullAudio,
  voiceNoteMergeAvailable,
  voiceNoteStatus,
  voiceNoteWhisperAvailable,
} from './voiceNoteTranscribe.js';
import {
  ensureStoriesHaveWorkingVideos,
  readRealWorldCache,
  writeRealWorldCache,
} from './geminiRealWorld.js';
import {
  fetchRealWorldStories,
  realWorldAvailable,
  realWorldProvider,
} from './realWorldProvider.js';
import { realWorldVideoProvider } from './youtubeSearchRepair.js';
import { sanitizeRealWorldStories } from './realWorldStoryQuality.js';
import { fetchYoutubeTranscript } from './youtubeTranscript.js';
import { readOrderWhyEntry, writeOrderWhyEntry, readOrderWhyCache } from './orderWhyCache.js';
import { buildOrderWhyPrompt } from './orderWhy.js';
import { attendingStyleFingerprint } from './attendingStylePrompt.js';
import {
  buildMedicalSequencePrompt,
  parseMedicalSequenceJson,
  assertMedicalSequenceDemographics,
  sequenceFailsDrowningContentCheck,
  MEDICAL_SEQUENCE_PROMPT_VERSION,
} from './medicalSequence.js';
import { buildMedicalSequenceOffline } from '../src/lib/medicalSequence.js';
import {
  readMedicalSequenceCache,
  writeMedicalSequenceCache,
} from './medicalSequenceCache.js';
import {
  buildCaseStoryNarrativePrompt,
  buildCaseStoryMasterImagePrompt,
  buildCaseStoryBeatImagePrompt,
  buildCaseStoryGridPlatePrompt,
  deriveChapterVisualHint,
  parseCaseStoryJson,
  CASE_STORY_PROMPT_VERSION,
} from './caseStory.js';
import { storyNarrativeMatchesCase } from '../src/lib/caseStoryCanonical.js';
import { buildCaseStoryOffline } from '../src/lib/caseStory.js';
import {
  readCaseStoryCache,
  writeCaseStoryCache,
  caseStoryImagePath,
  caseStoryBeatImagePath,
  caseStoryGridImagePath,
  resolveCaseStoryBeatImagePath,
  buildCaseStoryOversightImageUrl,
} from './caseStoryCache.js';
import {
  readCaseStoryCharacterLock,
  readMasterImageBase64,
} from './caseStoryCharacterLock.js';
import { resolveCaseStoryMagnificRefs } from './caseStoryImageRefs.js';
import { buildCaseStoryReadiness } from './caseStoryReadiness.js';
import {
  auditCaseStoryLaterality,
  resolveLateralityLock,
} from '../src/lib/caseStoryLaterality.js';
import { readOrderResultEntry, writeOrderResultEntry } from './orderResultCache.js';
import {
  ORDER_RESULT_PROMPT_VERSION,
  buildOrderResultPrompt,
  parseOrderResultJson,
} from './orderResultGen.js';
import {
  enrichCaseContextWithCleanCase,
  loadCleanCaseJson,
} from './cleanCaseLoader.js';
import {
  buildImmersaAttendantSystemPrompt,
  immersaAttendantTemperature,
  IMMERSA_ATTENDANT_DOCK_BRIEF_VOICE,
} from './immersaAttendantPrompt.js';
import {
  buildImmersaPatientSystemPrompt,
  immersaPatientTemperature,
} from './immersaPatientPrompt.js';
import { APP_PRODUCT_NAME } from '../src/lib/appBrand.js';
import { resolvePatientUberRef } from '../src/lib/resolvePatientUberRef.js';
import { splitPatientReply } from '../src/lib/patientReplyText.js';
import { appendPatientStageEntry } from './patientStageCache.js';
import {
  buildPortraitAnalysis,
  buildPortraitMeta,
  buildPortraitPersona,
  buildPortraitPrompt,
  buildPortraitMagnificExtras,
  buildVideoAvatarPrompt,
  extractPersonaFromPortraitImage,
  fetchYouTubeThumbnailBase64,
  formatPersonaForChat,
  generatePortraitWithFallback,
  portraitPublicUrl,
  portraitPreviewFileName,
  portraitPreviewPublicUrl,
  portraitBaselinePublicUrl,
  portraitBaselineFileName,
  readPortraitCache,
  readPortraitBaseline,
  ensurePortraitBaseline,
  resolvePortraitSex,
  writePortraitCache,
} from './casePortrait.js';
import {
  generateImageEditWithMagnific,
  magnificApiKey,
  magnificImageModel,
  magnificRefRouter,
  portraitImageAvailable,
} from './magnificImage.js';
import {
  extractPortraitDirectorBrief,
  logPortraitRegenBlock,
} from './portraitDirector.js';
import {
  PORTRAIT_LAYERS_VERSION,
  portraitLayerPublicUrl,
  readPortraitLayers,
  writeIvMaskLayer,
  writePortraitLayer,
} from './portraitLayers.js';
import {
  PORTRAIT_FRAME_VERSION,
  bufferToBase64,
  fitToBaseplate,
  readBaseplateBuffer,
  readGenerationLayoutBuffer,
} from './portraitFrame.js';
import {
  caseBriefFileName,
  ensureBriefDir,
  hashRawBundle,
  loadCaseRawBundle,
  readBriefCache,
  synthesizeCaseBriefMarkdown,
  writeBriefCache,
} from './caseBriefMarkdown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(__dirname, '../..');
const PORT = Number(process.env.PORT || process.env.SPORTMAKER_API_PORT || 3001);

function serverOrigin(req) {
  if (process.env.PUBLIC_URL) return String(process.env.PUBLIC_URL).replace(/\/$/, '');
  if (req) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) return `${proto}://${host}`;
  }
  return `http://127.0.0.1:${PORT}`;
}

dotenv.config({ path: path.join(GAME_ROOT, '.env') });
// Parent MeWorld/.env wins for API keys (game/.env is for chatterbox-only overrides).
dotenv.config({ path: path.join(REPO_ROOT, '.env'), override: true });

const app = express();
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins, credentials: true }));
} else {
  app.use(cors());
}
app.use(express.json({ limit: '12mb' }));
app.use('/api/magnific-ref', magnificRefRouter());

const SCENE_CACHE_DIR = path.join(GAME_ROOT, '.scene-cache');
if (!fs.existsSync(SCENE_CACHE_DIR)) {
  fs.mkdirSync(SCENE_CACHE_DIR, { recursive: true });
}
app.use('/scene-cache', express.static(SCENE_CACHE_DIR));

const CAPTURES_DIR = path.join(GAME_ROOT, 'captures');
if (!fs.existsSync(CAPTURES_DIR)) {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}
const MAGIC_DIR = path.join(GAME_ROOT, '.magic-links');
if (!fs.existsSync(MAGIC_DIR)) {
  fs.mkdirSync(MAGIC_DIR, { recursive: true });
}

const CASE_TTS_DIR = path.join(GAME_ROOT, '.case-tts-cache');
if (!fs.existsSync(CASE_TTS_DIR)) {
  fs.mkdirSync(CASE_TTS_DIR, { recursive: true });
}
app.use('/case-tts', express.static(CASE_TTS_DIR));

const REAL_WORLD_CACHE_DIR = path.join(GAME_ROOT, '.real-world-cache');

const CASE_PORTRAIT_DIR = path.join(GAME_ROOT, '.case-portraits');
if (!fs.existsSync(CASE_PORTRAIT_DIR)) {
  fs.mkdirSync(CASE_PORTRAIT_DIR, { recursive: true });
}
app.use('/case-portraits', express.static(CASE_PORTRAIT_DIR));

const CASE_BRIEF_DIR = path.join(GAME_ROOT, '.case-briefs');
ensureBriefDir(CASE_BRIEF_DIR);
app.use('/case-briefs', express.static(CASE_BRIEF_DIR));

const ORDER_WHY_CACHE_DIR = path.join(GAME_ROOT, '.order-why-cache');
/** Bump when mechanism / storycraft / opinion length rules change — bust stale order-why cache. */
const ORDER_WHY_PROMPT_VERSION = 'teach-me-v11';
/** First opinion = interconnected arc (depth slider); second opinion = locked brief punch. */
const FIRST_OPINION_MAX_TOKENS = [280, 380, 480, 520];
const SECOND_OPINION_MAX_TOKENS = [120, 160, 200, 240];
const LOCKED_SECOND_OPINION_DEPTH = 0;
if (!fs.existsSync(ORDER_WHY_CACHE_DIR)) {
  fs.mkdirSync(ORDER_WHY_CACHE_DIR, { recursive: true });
}
const ORDER_RESULT_CACHE_DIR = path.join(GAME_ROOT, '.order-result-cache');
if (!fs.existsSync(ORDER_RESULT_CACHE_DIR)) {
  fs.mkdirSync(ORDER_RESULT_CACHE_DIR, { recursive: true });
}
const MEDICAL_SEQUENCE_CACHE_DIR = path.join(GAME_ROOT, '.medical-sequence-cache');
if (!fs.existsSync(MEDICAL_SEQUENCE_CACHE_DIR)) {
  fs.mkdirSync(MEDICAL_SEQUENCE_CACHE_DIR, { recursive: true });
}
const CASE_STORY_CACHE_DIR = path.join(GAME_ROOT, '.case-story-cache');
if (!fs.existsSync(CASE_STORY_CACHE_DIR)) {
  fs.mkdirSync(CASE_STORY_CACHE_DIR, { recursive: true });
}
app.use('/case-story-images', express.static(CASE_STORY_CACHE_DIR));

const MEWORLD_CASES_DIR = path.join(REPO_ROOT, 'data', 'cases');
const DIFFERENTIAL_REVIEW_PATH = path.join(GAME_ROOT, 'src', 'data', 'differentialReview.json');

const USER_DATA_DIR = path.join(GAME_ROOT, 'user-data');
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}
app.use('/user-data', express.static(USER_DATA_DIR));

const FIRST_AID_PDF_PATH = path.join(GAME_ROOT, 'reference', 'first-aid', 'First_Aid_USMLE_Step_1_2025_35th_Edition.pdf');
app.get('/reference/first-aid/pdf', (_req, res) => {
  if (!fs.existsSync(FIRST_AID_PDF_PATH)) {
    return res.status(404).json({ error: 'First Aid PDF not installed locally' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="First_Aid_Step1_2025.pdf"');
  return res.sendFile(FIRST_AID_PDF_PATH);
});

const CCS_SCREENSHOTS_DIR = process.env.CCS_SCREENSHOTS_DIR || path.join(GAME_ROOT, 'ccs_screenshots');

const CHATTERBOX_ROOT = process.env.CHATTERBOX_ROOT || path.join(process.env.USERPROFILE || process.env.HOME || '', 'chatterbox');
const CHATTERBOX_PYTHON =
  process.env.CHATTERBOX_PYTHON ||
  path.join(CHATTERBOX_ROOT, '.venv', 'Scripts', 'python.exe');
const READ_CASE_SCRIPT = path.join(GAME_ROOT, 'tools', 'chatterbox', 'read_case_tts.py');

function createMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) return null;
  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: Boolean(process.env.SMTP_SECURE === '1' || port === 465),
      auth: { user, pass },
    }),
  };
}

async function sendMagicEmail(toEmail, magicLink) {
  const mailer = createMailer();
  if (!mailer || !toEmail) return { sent: false, reason: 'SMTP not configured or email missing' };
  await mailer.transporter.sendMail({
    from: mailer.from,
    to: toEmail,
    subject: `Your personalized ${APP_PRODUCT_NAME} link`,
    text: `Your personalized case experience is ready.\n\nOpen this magic link:\n${magicLink}\n\nThis link expires in 48 hours.`,
    html: `<p>Your personalized case experience is ready.</p>
<p><a href="${magicLink}">Open your magic link</a></p>
<p>This link expires in 48 hours.</p>`,
  });
  return { sent: true };
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

const VISION_PROMPT = `Medical training game: return ONLY JSON with keys zone-monitor, zone-iv-bag, zone-blood, zone-arm, zone-icu.
Each value: { "cx": 0-1, "cy": 0-1, "w": 0.05-0.2, "h": 0.05-0.15 } (center + size as fraction of image).`;

const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const DEEPSEEK_CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const caseChatSessions = new Map();

function chatProvider() {
  if (DEEPSEEK_API_KEY) return 'deepseek';
  if (OPENAI_API_KEY) return 'openai';
  return null;
}

function chatModel() {
  const provider = chatProvider();
  if (provider === 'deepseek') return DEEPSEEK_CHAT_MODEL;
  return OPENAI_CHAT_MODEL;
}

function chatApiKeyOrError(res) {
  if (DEEPSEEK_API_KEY) return DEEPSEEK_API_KEY;
  if (OPENAI_API_KEY) return OPENAI_API_KEY;
  res.status(400).json({
    error: 'Add DEEPSEEK_API_KEY or OPENAI_API_KEY to .env in the project root (see .env.example)',
  });
  return null;
}

function pruneCaseChatSessions() {
  const maxAge = 1000 * 60 * 60 * 2;
  const now = Date.now();
  for (const [id, session] of caseChatSessions) {
    if (now - session.lastUsed > maxAge) caseChatSessions.delete(id);
  }
}

function formatCaseDiscussionForChat(discussion) {
  if (!discussion || typeof discussion !== 'object') return '';
  const lines = [];
  if (discussion.memoryHook) {
    lines.push(`Learner memory hook for this case: ${discussion.memoryHook}`);
  }
  if (discussion.voiceTranscripts?.length) {
    lines.push('Voice / mic transcripts on this case (what the learner heard or said aloud):');
    for (const row of discussion.voiceTranscripts) {
      lines.push(`- [${row.at || 'unknown'}] ${row.text}`);
    }
  }
  if (discussion.differentialAttempts?.length) {
    lines.push('Differential practice attempts on this case:');
    for (const a of discussion.differentialAttempts) {
      const bits = [];
      if (a.cleanedTranscript || a.rawTranscript) {
        bits.push(`heard: ${a.cleanedTranscript || a.rawTranscript}`);
      }
      if (a.guesses?.length) bits.push(`guesses: ${a.guesses.join(', ')}`);
      if (a.score) bits.push(`score: ${a.score}`);
      if (a.aiSummary) bits.push(`review: ${a.aiSummary}`);
      lines.push(`- [${a.at || 'unknown'}] ${bits.join(' · ')}`);
    }
  }
  if (discussion.priorPatientChat?.length) {
    lines.push('Prior patient-mode chat on this case (stay consistent with what you already said):');
    for (const m of discussion.priorPatientChat) {
      const who = m.role === 'assistant' ? 'Patient' : 'Learner';
      lines.push(`- [${m.at || ''}] ${who}: ${m.content}`);
    }
  }
  if (discussion.youtubeTranscripts?.length) {
    lines.push('Real-world YouTube clips the learner saved for this case (reference only — not the simulated patient):');
    for (const v of discussion.youtubeTranscripts) {
      lines.push(`- ${v.title || v.youtubeId}: ${v.transcript}`);
    }
  }
  if (discussion.learnerNotes) {
    lines.push(`Learner notes (do not read aloud; use only if the learner asks what they wrote): ${discussion.learnerNotes}`);
  }
  if (discussion.pictureNotes?.length) {
    lines.push(
      'Picture notes attached for this case (likeness / teach-in refs — metadata only; learner may use in case work):',
    );
    for (const p of discussion.pictureNotes) {
      const bits = [p.role || 'reference'];
      if (p.caption) bits.push(p.caption);
      if (p.link) bits.push(p.link);
      lines.push(`- [${p.at || ''}] ${bits.join(' · ')}`);
    }
  }
  return lines.join('\n');
}

function simulationCreativityBand(score) {
  const c = Math.max(0, Math.min(100, Number(score) || 55));
  if (c < 30) return { band: 'strict', temperature: 0.28 };
  if (c < 65) return { band: 'balanced', temperature: 0.48 };
  return { band: 'immersive', temperature: 0.78 };
}

function hydrateCaseStoryContext(caseId, caseContext) {
  const raw = String(caseId ?? caseContext?.id ?? '').trim();
  const padded = /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
  const base = caseContext && typeof caseContext === 'object' ? caseContext : {};
  return {
    ...base,
    id: padded || base.id,
    ccsNumber: padded || base.ccsNumber,
  };
}

function sanitizeCaseContextForPrompt(caseContext) {
  if (!caseContext || typeof caseContext !== 'object') return caseContext;
  const out = { ...caseContext };
  delete out.clinical_tip;
  delete out.objective;
  delete out.diagnosis;
  delete out.case_summary;
  if (Array.isArray(out.interventions)) {
    out.interventions = out.interventions.map(({ why, ...rest }) => rest);
  }
  return out;
}

function buildCaseChatSystemPrompt(caseContext) {
  const ctx = caseContext?.learningMode ? sanitizeCaseContextForPrompt(caseContext) : caseContext;
  const patientSim = ctx?.chatMode === 'patient_sim';

  if (patientSim) {
    return buildImmersaPatientSystemPrompt(ctx, { formatCaseDiscussionForChat });
  }

  return buildImmersaAttendantSystemPrompt(ctx, { formatCaseDiscussionForChat });
}

async function callChatCompletion(key, messages, { maxTokens = 700, temperature = 0.35 } = {}) {
  const provider = chatProvider();
  const model = chatModel();
  const endpoint =
    provider === 'deepseek'
      ? 'https://api.deepseek.com/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || `${provider} error ${r.status}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() || 'No response.';
}

async function callCaseChatCompletion(key, messages, { temperature = 0.45, maxTokens = 700 } = {}) {
  return callChatCompletion(key, messages, { temperature, maxTokens });
}

function parseModelJson(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model did not return JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

async function parseDifferentialTranscriptWithLlm(key, payload) {
  const { rawTranscript, topic, caseId, final = false } = payload;
  const raw = String(rawTranscript || '').trim();
  if (!raw) {
    return { cleanedTranscript: '', diagnoses: [] };
  }

  const system = final
    ? `You receive the COMPLETE joined raw speech-to-text transcript after a medical student dictated their full differential list.
Return ONLY valid JSON (no markdown fences):
{
  "cleanedTranscript": "comma-separated final list of every diagnosis they said",
  "diagnoses": ["Diagnosis 1", "Diagnosis 2"]
}
This is the authoritative final pass — be thorough and precise.
Rules:
- Include EVERY diagnosis spoken anywhere in the transcript — never drop first, middle, or last items.
- Merge duplicate/overlapping STT fragments into one diagnosis each (e.g. "PE" and "pulmonary embolism" → one entry).
- Fix garble: cholecystitis not colcystitis; ovarian cyst not repeated "ovarian ovarian".
- diagnoses: short standard labels — strip ALL filler ("sorry", "you have an", "talking about", spoken "comma"/"period"/"dot").
- Exclude non-diagnosis chatter (apologies, full sentences about the patient) — only differential labels.
- Do not invent diagnoses absent from the raw transcript.
- Keep abbreviations when appropriate (PID, PE, NSTEMI).
- Preserve logical spoken order; dedupe case-insensitively.`
    : `You reconstruct a medical student's spoken differential diagnosis list from garbled speech-to-text.
Return ONLY valid JSON (no markdown fences):
{
  "cleanedTranscript": "comma-separated readable list of everything they said",
  "diagnoses": ["Diagnosis 1", "Diagnosis 2"]
}
Rules:
- Include EVERY diagnosis clearly spoken — never drop the first or last item.
- Fix obvious STT errors (cholecystitis not colcystitis; pulmonary embolism not embolism talking about).
- diagnoses: short standard labels only — no filler ("talking about", "it could be", spoken "comma"/"period"/"dot"/"and").
- Do not invent diagnoses absent from the raw transcript.
- Keep abbreviations when spoken (PID, PE, NSTEMI, MI).
- Preserve spoken order; dedupe case-insensitively.
- cleanedTranscript = faithful comma-separated reconstruction of the full list.`;

  const user = JSON.stringify({
    caseId: caseId ?? null,
    chiefComplaint: topic || null,
    rawTranscript: raw,
  });

  const content = await callChatCompletion(
    key,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 800, temperature: 0.1 },
  );

  const parsed = parseModelJson(content);
  const diagnoses = Array.isArray(parsed.diagnoses)
    ? parsed.diagnoses.map(String).map((d) => d.trim()).filter((d) => d.length >= 2)
    : [];
  return {
    cleanedTranscript: String(parsed.cleanedTranscript || raw).trim() || raw,
    diagnoses,
  };
}

async function scoreDifferentialWithLlm(key, payload) {
  const {
    caseId,
    topic,
    caseDiagnosis,
    answerKey = [],
    guesses = [],
  } = payload;

  const { rawTranscript = '' } = payload;

  const system = `You are a smart clinical examiner grading a medical student's differential against the official MARKING SCHEME (answerKey).
Return ONLY valid JSON (no markdown fences):
{
  "gradedGuesses": [
    { "guess": "string", "status": "match" | "extra" | "partial", "matchedAnswer": "string or null", "note": "short reason" }
  ],
  "missedAnswers": ["answer key items with no reasonable guess"],
  "gotCaseDiagnosis": boolean,
  "scoreSummary": "2-3 sentence report: score fraction, what matched (name them), what was missed from marking scheme, one study tip"
}
Marking rules — be fair and clinically literate:
- answerKey is the ONLY marking scheme. Map learner language to those items generously when clinically justified.
- status "match": equivalent diagnosis, accepted abbreviation, or clear synonym (e.g. STD/STI/chlamydia/gonorrhea → Pelvic Inflammatory Disease; PE → pulmonary embolism; heart attack → NSTEMI).
- status "partial": related mechanism or organ system but not specific enough (e.g. "pelvic inflammation", "adnexal infection" → PID partial).
- status "extra": not on marking scheme and not a reasonable synonym for any answerKey item.
- One gradedGuesses row per learner guess, same order as learnerGuesses input.
- If rawTranscript is provided, use it for context when a cleaned guess is vague but the spoken intent clearly matched a marking scheme item.
- gotCaseDiagnosis: true if any guess (match or strong partial) equals caseDiagnosis clinically.
- missedAnswers: answerKey items with no match or partial from any guess.
- scoreSummary: name specific marking scheme items matched and missed.`;

  const user = JSON.stringify({
    caseId,
    chiefComplaint: topic,
    caseDiagnosis: caseDiagnosis || null,
    answerKey,
    learnerGuesses: guesses,
    rawTranscript: rawTranscript || null,
  });

  const raw = await callChatCompletion(
    key,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: 1200, temperature: 0.15 },
  );

  const parsed = parseModelJson(raw);
  if (!Array.isArray(parsed.gradedGuesses)) {
    throw new Error('Invalid AI score payload');
  }
  return parsed;
}

const FAL_SCENE_MODEL = process.env.FAL_SCENE_MODEL || 'fal-ai/joyai-image-edit';

function sceneImageProvider() {
  const pref = String(process.env.SCENE_IMAGE_PROVIDER || 'auto').toLowerCase();
  if (pref === 'magnific') return magnificApiKey() ? 'magnific' : null;
  if (pref === 'openai') return process.env.OPENAI_API_KEY ? 'openai' : null;
  if (pref === 'fal') return process.env.FAL_KEY ? 'fal' : magnificApiKey() ? 'magnific' : null;
  if (magnificApiKey()) return 'magnific';
  if (process.env.FAL_KEY) return 'fal';
  return process.env.OPENAI_API_KEY ? 'openai' : null;
}

async function downloadImageAsBase64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to download fal image (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.toString('base64');
}

function extractFalImageUrl(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const images = payload.images || payload.image || payload.output?.images;
  if (Array.isArray(images) && images[0]?.url) return images[0].url;
  if (typeof payload.url === 'string') return payload.url;
  if (typeof payload.image?.url === 'string') return payload.image.url;
  return null;
}

async function generateSceneWithFal({ imageBase64, mimeType, prompt }) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY not configured');

  const r = await fetch(`https://fal.run/${FAL_SCENE_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_url: `data:${mimeType};base64,${imageBase64}`,
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`fal scene failed: ${err || r.status}`);
  }

  const data = await r.json();
  const imageUrl = extractFalImageUrl(data);
  if (!imageUrl) throw new Error('No image returned from fal');
  return downloadImageAsBase64(imageUrl);
}

async function generateSceneWithMagnific({ imageBase64, mimeType, prompt }) {
  if (!magnificApiKey()) throw new Error('MAGNIFIC_API_KEY not configured');
  const buf = await generateImageEditWithMagnific({
    imageBase64,
    mimeType,
    prompt,
    aspectRatio: '16:9',
    resolution: process.env.MAGNIFIC_SCENE_RESOLUTION || '2K',
    referenceText: 'Match reference camera lock and room layout; change scene context only as prompted.',
  });
  return buf.toString('base64');
}

async function generateSceneWithOpenAI({ imageBase64, mimeType, prompt }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');

  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  // gpt-image-1 /images/edits rejects response_format; b64_json is returned by default.
  form.append('image', new Blob([Buffer.from(imageBase64, 'base64')], { type: mimeType }), 'patient.png');

  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`OpenAI edit failed: ${err || r.status}`);
  }
  const data = await r.json();
  const outB64 = data?.data?.[0]?.b64_json;
  if (!outB64) throw new Error('No image returned from OpenAI');
  return outB64;
}

async function generateSceneImage({ imageBase64, mimeType, prompt }) {
  const provider = sceneImageProvider();
  if (!provider) throw new Error('Add MAGNIFIC_API_KEY, FAL_KEY, or OPENAI_API_KEY to MeWorld/.env');
  if (provider === 'magnific') {
    try {
      return { outB64: await generateSceneWithMagnific({ imageBase64, mimeType, prompt }), provider: 'magnific' };
    } catch (magnificErr) {
      if (!process.env.FAL_KEY && !process.env.OPENAI_API_KEY) throw magnificErr;
      console.warn('[generate-scene] Magnific failed, falling back:', magnificErr.message);
    }
  }
  if (provider === 'fal' || process.env.FAL_KEY) {
    try {
      return { outB64: await generateSceneWithFal({ imageBase64, mimeType, prompt }), provider: 'fal' };
    } catch (falErr) {
      if (!process.env.OPENAI_API_KEY) throw falErr;
      console.warn('[generate-scene] fal failed, falling back to OpenAI:', falErr.message);
    }
  }
  return {
    outB64: await generateSceneWithOpenAI({ imageBase64, mimeType, prompt }),
    provider: 'openai',
  };
}

app.get('/api/health', (_req, res) => {
  const scriptReady = fs.existsSync(READ_CASE_SCRIPT);
  const pythonReady = fs.existsSync(CHATTERBOX_PYTHON);
  const provider = chatProvider();
  res.json({
    ok: true,
    openai: Boolean(OPENAI_API_KEY),
    deepseek: Boolean(DEEPSEEK_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    realWorld: realWorldAvailable(),
    realWorldProvider: realWorldProvider(),
    realWorldVideoProvider: realWorldVideoProvider(),
    chatProvider: provider,
    chatModel: chatModel(),
    fal: Boolean(process.env.FAL_KEY),
    magnific: Boolean(magnificApiKey()),
    magnificImageModel: magnificImageModel(),
    sceneProvider: sceneImageProvider(),
    casePortraits: portraitImageAvailable(),
    falSceneModel: FAL_SCENE_MODEL,
    chatterbox: pythonReady && scriptReady,
    chatterboxPython: CHATTERBOX_PYTHON,
    readCaseScript: READ_CASE_SCRIPT,
    readCaseScriptFound: scriptReady,
    patientVoices: listPatientVoiceConfig(),
    gameRoot: GAME_ROOT,
  });
});

app.get('/api/user/stats', async (_req, res) => {
  try {
    const stats = await getOverallStats();
    return res.json({ ok: true, stats });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/user/visits', async (req, res) => {
  const limit = Math.min(80, Math.max(1, Number(req.query.limit) || 40));
  try {
    const visits = await listCaseVisitSummaries({ limit });
    return res.json({ ok: true, visits });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/user/case/:caseId', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  try {
    const data = await readCaseUser(caseId, { migrate: true });
    if (!data) return res.json({ ok: true, caseId, data: null });
    return res.json({ ok: true, caseId, ...data });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/session/start', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  try {
    const out = await startCaseSession(caseId, req.body || {});
    return res.json({
      ok: true,
      caseId,
      sessionId: out.sessionId,
      attempt: out.attempt,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/session/:sessionId/end', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const sessionId = String(req.params.sessionId || '').trim();
  if (!caseId || !sessionId) return res.status(400).json({ error: 'Missing caseId or sessionId' });
  try {
    const session = await endCaseSession(caseId, sessionId, req.body?.result || {});
    return res.json({ ok: true, session });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/session/:sessionId/event', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const sessionId = String(req.params.sessionId || '').trim();
  const event = req.body?.event;
  if (!caseId || !sessionId) return res.status(400).json({ error: 'Missing caseId or sessionId' });
  if (!event || typeof event !== 'object') return res.status(400).json({ error: 'Missing event' });
  try {
    const entry = await appendTimelineEvent(caseId, sessionId, event);
    return res.json({ ok: true, entry });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/chat', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const { sessionId, role, content } = req.body || {};
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  if (!role || !content) return res.status(400).json({ error: 'Missing role or content' });
  try {
    const msg = await appendChatHistory(caseId, sessionId, role, content);
    return res.json({ ok: true, message: msg });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

// ── Biostats chat persistence ──
const BIOSTATS_CHATS_DIR = path.join(USER_DATA_DIR, 'biostats-chats');

app.get('/api/biostats/chat/:questionId', async (req, res) => {
  const qId = String(req.params.questionId || '').trim();
  if (!qId) return res.status(400).json({ error: 'Missing questionId' });
  try {
    const filePath = path.join(BIOSTATS_CHATS_DIR, qId + '.json');
    if (!fs.existsSync(filePath)) return res.json({ questionId: qId, chatHistory: [] });
    const data = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/biostats/chat/:questionId', async (req, res) => {
  const qId = String(req.params.questionId || '').trim();
  const { chatHistory } = req.body || {};
  if (!qId) return res.status(400).json({ error: 'Missing questionId' });
  if (!Array.isArray(chatHistory)) return res.status(400).json({ error: 'chatHistory must be an array' });
  try {
    if (!fs.existsSync(BIOSTATS_CHATS_DIR)) fs.mkdirSync(BIOSTATS_CHATS_DIR, { recursive: true });
    const data = { questionId: qId, chatHistory, updatedAt: new Date().toISOString() };
    await fsp.writeFile(path.join(BIOSTATS_CHATS_DIR, qId + '.json'), JSON.stringify(data, null, 2), 'utf8');
    return res.json({ ok: true, questionId: qId, count: chatHistory.length });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/user/case/:caseId/notes', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  try {
    const text = await readCaseNotesText(caseId);
    const href = text.trim() ? `cases/notes/${caseId.padStart(3, '0')}.md` : null;
    return res.json({ ok: true, caseId, text, href });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.put('/api/user/case/:caseId/notes', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  try {
    const saved = await writeCaseNotesText(caseId, req.body?.text ?? '', {
      allowClear: Boolean(req.body?.allowClear),
    });
    return res.json({ ok: true, caseId, ...saved });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/notes/append', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const { body, header, at } = req.body || {};
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  if (!body) return res.status(400).json({ error: 'Missing body' });
  try {
    const saved = await appendCaseNotesBlockText(caseId, body, { header, at });
    return res.json({ ok: true, caseId, ...saved });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/session/:sessionId/recording', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const sessionId = String(req.params.sessionId || '').trim();
  const { audioBase64, mimeType, durationMs } = req.body || {};
  if (!caseId || !sessionId) return res.status(400).json({ error: 'Missing caseId or sessionId' });
  if (!audioBase64) return res.status(400).json({ error: 'Missing audioBase64' });
  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const recording = await saveRecording(caseId, sessionId, buffer, { durationMs, mimeType });
    return res.json({ ok: true, recording });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/voice-note/status', async (_req, res) => {
  try {
    const status = await voiceNoteStatus();
    return res.json({ ok: true, ...status });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/voice-note/merge', async (req, res) => {
  if (!voiceNoteMergeAvailable()) {
    return res.status(400).json({
      error: 'Add DEEPSEEK_API_KEY or OPENAI_API_KEY for voice note transcription',
    });
  }
  const { priorTranscript = '', chunkText = '' } = req.body || {};
  try {
    const transcript = await mergeVoiceNoteTranscript(priorTranscript, chunkText);
    return res.json({ ok: true, transcript });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/voice-note/transcribe-chunk', async (req, res) => {
  const { audioBase64, mimeType, priorTranscript = '', promptHint = '', cleanup = true } = req.body || {};
  if (!audioBase64) return res.status(400).json({ error: 'Missing audioBase64' });
  const status = await voiceNoteStatus();
  if (!status.batch) {
    return res.status(400).json({
      error: 'Batch STT unavailable — install faster-whisper (see game/tools/whisper) or add OPENAI_API_KEY',
    });
  }
  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const chunkText = await transcribeAudioChunk(buffer, mimeType || 'audio/webm', promptHint);
    if (!chunkText) {
      return res.json({ ok: true, transcript: String(priorTranscript || '').trim(), chunkText: '' });
    }
    // Verbatim path (free-form notes): plain append, no LLM merge reword.
    const transcript = cleanup && voiceNoteMergeAvailable()
      ? await mergeVoiceNoteTranscript(priorTranscript, chunkText)
      : `${String(priorTranscript || '').trim()}${priorTranscript ? ' ' : ''}${chunkText}`.trim();
    return res.json({ ok: true, transcript, chunkText, provider: status.mode });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/voice-note/transcribe-full', async (req, res) => {
  const { audioBase64, mimeType, promptHint = '', cleanup = true } = req.body || {};
  if (!audioBase64) return res.status(400).json({ error: 'Missing audioBase64' });
  const status = await voiceNoteStatus();
  if (!status.batch) {
    return res.status(400).json({
      error: 'Batch STT unavailable — install faster-whisper (see game/tools/whisper) or add OPENAI_API_KEY',
    });
  }
  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const result = await transcribeFullAudio(buffer, mimeType || 'audio/webm', { promptHint, cleanup });
    return res.json({
      ok: true,
      transcript: result.transcript || '',
      raw: result.raw || result.transcript || '',
      provider: result.provider || status.mode,
      model: result.model || null,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/case-chat/start', async (req, res) => {
  const key = chatApiKeyOrError(res);
  if (!key) return;

  const { caseContext } = req.body || {};
  if (!caseContext?.id) {
    return res.status(400).json({ error: 'Missing caseContext.id' });
  }

  try {
    pruneCaseChatSessions();
    const sessionId = crypto.randomBytes(16).toString('hex');
    const creativity = caseContext?.simulationCreativity ?? 55;
    const isPatientSim = caseContext.chatMode === 'patient_sim';
    const temperature = isPatientSim
      ? immersaPatientTemperature(creativity)
      : immersaAttendantTemperature(creativity);
    const systemPrompt = buildCaseChatSystemPrompt(caseContext);
    caseChatSessions.set(sessionId, {
      caseId: String(caseContext.id),
      chatMode: caseContext.chatMode === 'patient_sim' ? 'patient_sim' : 'tutor',
      creativity,
      temperature,
      messages: [{ role: 'system', content: systemPrompt }],
      lastUsed: Date.now(),
    });
    return res.json({ ok: true, sessionId, caseId: caseContext.id });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/differential/parse-transcript', async (req, res) => {
  const key = chatApiKeyOrError(res);
  if (!key) return;

  const { rawTranscript, topic, caseId, final = false } = req.body || {};
  const raw = String(rawTranscript || '').trim();
  if (!raw) {
    return res.status(400).json({ error: 'Missing rawTranscript' });
  }

  try {
    const parsed = await parseDifferentialTranscriptWithLlm(key, {
      rawTranscript: raw,
      topic,
      caseId,
      final: Boolean(final),
    });
    return res.json({
      ok: true,
      cleanedTranscript: parsed.cleanedTranscript,
      diagnoses: parsed.diagnoses,
      provider: chatProvider(),
      model: chatModel(),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/differential/real-world', async (req, res) => {
  if (!realWorldAvailable()) {
    return res.status(400).json({
      error: 'Add DEEPSEEK_API_KEY to MeWorld/.env (stories). Videos use free yt-search — set REAL_WORLD_VIDEO_PROVIDER=yt-search',
    });
  }

  const {
    caseId,
    topic = '',
    diagnosis = '',
    chiefComplaint = '',
    hpiSnippet = '',
    refresh = false,
    repairVideos = true,
  } = req.body || {};

  const id = parseInt(String(caseId ?? ''), 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Missing caseId' });
  }

  const ctx = {
    caseId: id,
    topic: String(topic),
    diagnosis: String(diagnosis),
    chiefComplaint: String(chiefComplaint),
    hpiSnippet: String(hpiSnippet),
  };

  async function persistStories(stories, meta = {}) {
    if (!stories.length) return;
    await writeRealWorldCache(REAL_WORLD_CACHE_DIR, id, {
      caseId: id,
      stories,
      ...meta,
    });
  }

  function qualityStories(stories) {
    return sanitizeRealWorldStories(stories, ctx).stories;
  }

  try {
    if (!refresh) {
      const cached = await readRealWorldCache(REAL_WORLD_CACHE_DIR, id);
      if (cached?.stories?.length) {
        const cachedStories = qualityStories(cached.stories);
        const cacheStale =
          cachedStories.length !== cached.stories.length && cached.stories.length > 0;
        if (cacheStale) {
          if (cachedStories.length) {
            await persistStories(cachedStories, {
              model: cached.model,
              webSearchQueries: cached.webSearchQueries,
              groundingChunks: cached.groundingChunks,
            });
          } else {
            // Bad cache (e.g. only Michael Phelps adjacent) — refetch below.
          }
        }
        if (cachedStories.length) {
          if (repairVideos) {
            const fixed = await ensureStoriesHaveWorkingVideos(cachedStories, ctx);
            if (fixed.repaired) {
              await persistStories(fixed.stories, {
                model: cached.model,
                webSearchQueries: cached.webSearchQueries,
                groundingChunks: cached.groundingChunks,
              });
            }
            return res.json({
              ok: true,
              stories: fixed.stories,
              source: fixed.repaired ? 'cache-repaired' : 'cache',
              cachedAt: cached.cachedAt,
              webSearchQueries: cached.webSearchQueries || [],
              videosRepaired: fixed.repaired,
            });
          }

          return res.json({
            ok: true,
            stories: cachedStories,
            source: cacheStale ? 'cache-sanitized' : 'cache',
            cachedAt: cached.cachedAt,
            webSearchQueries: cached.webSearchQueries || [],
          });
        }
      }
    }

    const result = await fetchRealWorldStories(ctx);
    const qualified = qualityStories(result.stories);
    const fixed = repairVideos
      ? await ensureStoriesHaveWorkingVideos(qualified, ctx)
      : { stories: qualified, repaired: false };

    if (fixed.stories.length) {
      await persistStories(fixed.stories, {
        model: result.model,
        webSearchQueries: result.webSearchQueries,
        groundingChunks: result.groundingChunks,
      });
    }

    return res.json({
      ok: true,
      stories: fixed.stories,
      source: fixed.repaired ? `${result.provider || realWorldProvider()}-repaired` : (result.provider || realWorldProvider()),
      model: result.model,
      provider: result.provider || realWorldProvider(),
      webSearchQueries: result.webSearchQueries,
      groundingChunks: result.groundingChunks,
      videosRepaired: fixed.repaired,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/differential/score', async (req, res) => {
  const key = chatApiKeyOrError(res);
  if (!key) return;

  const {
    caseId,
    topic,
    caseDiagnosis,
    answerKey,
    guesses,
    rawTranscript,
  } = req.body || {};

  const keyList = Array.isArray(answerKey) ? answerKey.map(String).filter(Boolean) : [];
  const guessList = Array.isArray(guesses) ? guesses.map(String).filter(Boolean) : [];

  if (!keyList.length) {
    return res.status(400).json({ error: 'Missing answerKey' });
  }
  if (!guessList.length) {
    return res.status(400).json({ error: 'Add at least one differential before scoring' });
  }

  try {
    const graded = await scoreDifferentialWithLlm(key, {
      caseId,
      topic,
      caseDiagnosis,
      answerKey: keyList,
      guesses: guessList,
      rawTranscript: String(rawTranscript || '').trim(),
    });
    return res.json({
      ok: true,
      score: {
        ...graded,
        provider: chatProvider(),
        model: chatModel(),
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/differential/explain', async (req, res) => {
  const key = chatApiKeyOrError(res);
  if (!key) return;
  const { diagnosis, topic, caseDiagnosis } = req.body || {};
  const dx = String(diagnosis || '').trim();
  if (!dx) return res.status(400).json({ error: 'Missing diagnosis' });
  const system = `You are a concise clinical educator helping a medical student understand why they missed a diagnosis.
Return ONLY valid JSON (no markdown fences):
{
  "hook": "One sentence — the single most memorable clinical anchor for this diagnosis (mechanism or pattern, not a mnemonic)",
  "features": ["Key distinguishing feature 1", "Key distinguishing feature 2", "Key distinguishing feature 3"],
  "traps": ["Common confusion 1 — why it looks like X instead", "Common confusion 2 if applicable"],
  "clue": "The one HPI/exam clue that should always trigger this diagnosis on your differential"
}
Rules:
- features: 3 items max, each under 12 words, clinically specific (not generic)
- traps: what the student likely confused it with and why
- hook: mechanism-based, not a mnemonic — help them see WHY, not just WHAT
- clue: the single most discriminating trigger from history or exam`;
  const user = JSON.stringify({
    diagnosis: dx,
    chiefComplaint: topic || null,
    caseDiagnosis: caseDiagnosis || null,
  });
  try {
    const raw = await callChatCompletion(
      key,
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { maxTokens: 400, temperature: 0.3 },
    );
    const parsed = parseModelJson(raw);
    return res.json({ ok: true, explain: parsed, provider: chatProvider() });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

// Attending DEPTH slider (Brief→Full arc) for live chat replies — drives length +
// shape directive + token ceiling. Mirrors firstOpinionPrefs FIRST_OPINION_DEPTH_LEVELS.
const CHAT_DEPTH_LEVELS = [
  { id: 0, label: 'Brief', words: 55, maxTokens: 200, shape: 'One tight point, no preamble.' },
  { id: 1, label: 'Standard', words: 95, maxTokens: 360, shape: 'Concise but complete.' },
  { id: 2, label: 'Deep', words: 150, maxTokens: 560, shape: 'Mechanism + connection, still focused.' },
  { id: 3, label: 'Full arc', words: 230, maxTokens: 900, shape: 'Full connected teaching arc.' },
];

app.post('/api/case-chat/message', async (req, res) => {
  const key = chatApiKeyOrError(res);
  if (!key) return;

  const { sessionId, message, sessionContext } = req.body || {};
  const text = String(message || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  if (!text) return res.status(400).json({ error: 'Missing message' });

  const session = caseChatSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Chat session expired — close and reopen case chat' });
  }

  try {
    // Live case ledger (docs/CHART_ARCHITECTURE.md §3): persist the full current state
    // to a per-case markdown (disk = complete source of truth), and feed the attending
    // only the DELTA since its last reply — token-smart, no re-flooding.
    const hasCtx = sessionContext && typeof sessionContext === 'object';
    const isTutor = session.chatMode !== 'patient_sim';
    let liveLedger = '';
    if (hasCtx && isTutor) {
      if (sessionContext.hasSessionData && session.caseId != null) {
        void writeCaseLedger(session.caseId, sessionContext);
      }
      const delta = diffCaseLedger(sessionContext, session.ledgerSeen || null);
      session.ledgerSeen = delta.nextSeen;
      liveLedger = delta.block;
    }

    // Attending depth → live reply length + shape (Brief↔Full actually changes output).
    const depthRaw = Number(sessionContext?.attendingDepth);
    const depthIdx =
      isTutor && Number.isFinite(depthRaw) ? Math.max(0, Math.min(3, Math.round(depthRaw))) : null;
    const depthCfg = depthIdx != null ? CHAT_DEPTH_LEVELS[depthIdx] : null;
    const depthDirective = depthCfg
      ? `[ATTENDING DEPTH — ${depthCfg.label}: answer in ~${depthCfg.words} words max. ${depthCfg.shape}]`
      : '';

    let userContent = text;
    if (sessionContext?.dockBrief) {
      const briefLead =
        session.chatMode === 'patient_sim'
          ? `[ORDER DOCK — patient voice, 1–3 short sentences in lay language. Answer only what was asked.]\n\n`
          : `[ORDER DOCK — ultra-brief tutor reply]
${IMMERSA_ATTENDANT_DOCK_BRIEF_VOICE}
${depthDirective ? `${depthDirective}\n` : ''}${liveLedger ? `\n${liveLedger}\n` : ''}
Learner question: `;
      userContent = `${briefLead}${text}`;
    } else if (sessionContext && typeof sessionContext === 'object') {
      const header = sessionContext.standardFlow
        ? '[SESSION SO FAR — standard flow compare, order timeline, case transcripts, notes, and scene activity for this run]'
        : '[SESSION SO FAR — orders, case transcripts, notes, and scene activity for this run]';
      let ctxBlock = `${liveLedger ? `${liveLedger}\n\n` : ''}${header}\n${JSON.stringify(sessionContext, null, 2)}`;
      if (ctxBlock.length > 14000) {
        ctxBlock = `${ctxBlock.slice(0, 14000)}\n…[session context truncated for token limit]`;
      }
      if (sessionContext.tutorSessionHint) {
        ctxBlock += `\n\n[TUTOR SESSION NOTE]\n${sessionContext.tutorSessionHint}`;
      }
      if (sessionContext.caseDiscussion) {
        ctxBlock += `\n\n[CASE DISCUSSION SUMMARY]\n${formatCaseDiscussionForChat(sessionContext.caseDiscussion)}`;
      }
      userContent = `${ctxBlock}\n\n---\n\n${depthDirective ? `${depthDirective}\n\n` : ''}Learner question: ${text}`;
    }
    session.messages.push({ role: 'user', content: userContent });
    const window = session.messages.slice(0, 1).concat(session.messages.slice(-24));
    const dockBrief = Boolean(sessionContext?.dockBrief);
    const maxTokens = depthCfg
      ? depthCfg.maxTokens
      : session.chatMode === 'patient_sim'
        ? dockBrief
          ? 220
          : 450
        : dockBrief
          ? 220
          : 1600;
    const reply = await callCaseChatCompletion(key, window, {
      temperature: session.temperature ?? 0.45,
      maxTokens,
    });

    let clientReply = String(reply || '').trim();
    if (!clientReply || /^no response\.?$/i.test(clientReply)) {
      throw new Error('Tutor returned empty — retry or shorten the question');
    }
    let stageDirections = '';

    if (session.chatMode === 'patient_sim') {
      const split = splitPatientReply(reply);
      clientReply = split.dialogue || reply;
      stageDirections = split.stageDirections || '';
      session.messages.push({ role: 'assistant', content: clientReply });
      if (stageDirections) {
        void appendPatientStageEntry(session.caseId, {
          userMessage: text,
          stageDirections,
          dialogue: clientReply,
          raw: split.raw,
        });
      }
    } else {
      session.messages.push({ role: 'assistant', content: reply });
    }

    session.lastUsed = Date.now();
    return res.json({
      ok: true,
      reply: clientReply,
      ...(stageDirections ? { stageDirections } : {}),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/order-why', async (req, res) => {
  const key = chatApiKeyOrError(res);
  if (!key) return;

  const { caseId, orderId, orderLabel, playbookWhy = '', caseContext = null, peerReview = false, secondOpinionDepth = 0, firstOpinionDepth = 3, forceRefresh = false, patientAnchorDone = false } =
    req.body || {};
  const cid = String(caseId ?? '').trim();
  const oid = String(orderId ?? '').trim();
  const peerDepthIdx = LOCKED_SECOND_OPINION_DEPTH;
  const firstDepthIdx = Math.max(0, Math.min(3, Number(firstOpinionDepth) || 0));
  const depthConfig = { maxTokens: SECOND_OPINION_MAX_TOKENS[peerDepthIdx] ?? 120 };
  const styleFp = attendingStyleFingerprint(caseContext?.attendingStyleLeans);
  const cacheKey = peerReview
    ? `${oid}__peer__d${peerDepthIdx}__${styleFp}__${ORDER_WHY_PROMPT_VERSION}`
    : `${oid}__d${firstDepthIdx}__${styleFp}__${ORDER_WHY_PROMPT_VERSION}`;
  const label = String(orderLabel ?? '').trim();
  if (!cid || !oid || !label) {
    return res.status(400).json({ error: 'Missing caseId, orderId, or orderLabel' });
  }

  try {
    if (!forceRefresh) {
      const cached = await readOrderWhyEntry(ORDER_WHY_CACHE_DIR, cid, cacheKey);
      if (cached?.why) {
        return res.json({
          ok: true,
          why: cached.why,
          cached: true,
          cachedAt: cached.cachedAt,
          provider: 'cache',
        });
      }
    }

    const messages = buildOrderWhyPrompt({
      orderLabel: label,
      orderId: oid,
      playbookWhy,
      caseContext: caseContext && typeof caseContext === 'object' ? caseContext : {},
      peerReview: Boolean(peerReview),
      secondOpinionDepth: peerDepthIdx,
      firstOpinionDepth: firstDepthIdx,
      patientAnchorDone: Boolean(patientAnchorDone),
    });
    const why = await callChatCompletion(key, messages, {
      maxTokens: peerReview
        ? depthConfig.maxTokens
        : FIRST_OPINION_MAX_TOKENS[firstDepthIdx] ?? 520,
      temperature: peerReview
        ? Math.min(0.72, immersaAttendantTemperature(caseContext?.simulationCreativity ?? 55))
        : immersaAttendantTemperature(caseContext?.simulationCreativity ?? 55),
    });
    const saved = await writeOrderWhyEntry(ORDER_WHY_CACHE_DIR, cid, cacheKey, {
      why,
      orderLabel: label,
    });
    return res.json({
      ok: true,
      why,
      cached: false,
      cachedAt: saved?.cachedAt || null,
      provider: chatProvider(),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/medical-sequence', async (req, res) => {
  const key = chatApiKeyOrError(res);
  if (!key) return;

  const {
    caseId,
    caseContext = null,
    orders = [],
    realWorldStories = [],
    portraitNote = '',
    refresh = false,
  } = req.body || {};
  const cid = String(caseId ?? '').trim();
  if (!cid) {
    return res.status(400).json({ error: 'Missing caseId' });
  }

  try {
    if (!refresh) {
      const cached = await readMedicalSequenceCache(MEDICAL_SEQUENCE_CACHE_DIR, cid);
      const cacheOk =
        cached?.prequel?.length &&
        (cached.promptVersion || 1) >= MEDICAL_SEQUENCE_PROMPT_VERSION;
      if (cacheOk) {
        try {
          assertMedicalSequenceDemographics(cached, caseContext || {}, cid);
          if (sequenceFailsDrowningContentCheck(cached, caseContext || {})) {
            throw new Error('stale drowning template');
          }
          const seqBlob = {
            title: cached.title,
            patientLock: cached.patientLock,
            chapters: [
              ...(cached.prequel || []).map((b) => ({ body: b.caption, heading: b.title })),
              ...(cached.missedPath || []).map((b) => ({ body: b.caption, heading: b.title })),
            ],
          };
          if (!storyNarrativeMatchesCase(cid, seqBlob)) {
            throw new Error('stale wrong-case template');
          }
          return res.json({
            ok: true,
            cached: true,
            cachedAt: cached.cachedAt || null,
            patientLock: cached.patientLock || '',
            prequel: cached.prequel || [],
            missedPath: cached.missedPath || [],
            savedPath: cached.savedPath || [],
            realWorldEcho: cached.realWorldEcho || null,
          });
        } catch {
          /* stale demographics or wrong template — regenerate */
        }
      }
    }

    const whyCache = (await readOrderWhyCache(ORDER_WHY_CACHE_DIR, cid)) || {};
    const mergedOrders = (Array.isArray(orders) ? orders : []).map((o) => {
      const oid = String(o.id || '').trim();
      const cachedWhy = whyCache[oid]?.why || '';
      const clientWhy = String(o.why || '').trim();
      const playbookWhy = String(o.playbookWhy || o.why || '').trim();
      return {
        id: oid,
        label: String(o.label || '').trim(),
        why: clientWhy || cachedWhy || playbookWhy,
        playbookWhy,
      };
    });

    const messages = buildMedicalSequencePrompt({
      caseContext: caseContext && typeof caseContext === 'object' ? caseContext : {},
      orders: mergedOrders,
      realWorldStories: Array.isArray(realWorldStories) ? realWorldStories : [],
      portraitNote: String(portraitNote || '').trim(),
    });
    let parsed;
    try {
      const raw = await callChatCompletion(key, messages, { maxTokens: 1400, temperature: 0.32 });
      parsed = assertMedicalSequenceDemographics(
        parseMedicalSequenceJson(raw),
        caseContext && typeof caseContext === 'object' ? caseContext : {},
        cid,
      );
      if (sequenceFailsDrowningContentCheck(parsed, caseContext || {})) {
        throw new Error('LLM returned AMS template for drowning case');
      }
    } catch {
      const stub = {
        id: cid,
        ...((caseContext && typeof caseContext === 'object' ? caseContext : {})),
        hpi_narrative:
          caseContext?.hpiExcerpt ||
          caseContext?.clinical_hpi_narrative ||
          caseContext?.historyText ||
          '',
      };
      const enriched = Object.fromEntries(
        mergedOrders.filter((o) => o.why).map((o) => [o.id, o.why]),
      );
      parsed = buildMedicalSequenceOffline(stub, { enrichedWhys: enriched });
    }
    parsed.promptVersion = MEDICAL_SEQUENCE_PROMPT_VERSION;
    await writeMedicalSequenceCache(MEDICAL_SEQUENCE_CACHE_DIR, cid, parsed);
    return res.json({
      ok: true,
      cached: false,
      ...parsed,
      provider: chatProvider(),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/case-story', async (req, res) => {
  const key = chatApiKeyOrError(res);
  if (!key) return;

  const {
    caseId,
    caseContext = null,
    sessionContext = null,
    orders = [],
    medicalSequence = null,
    portraitNote = '',
    sessionFingerprint = '',
    refresh = false,
    generateImage = false,
    imageOnly = false,
  } = req.body || {};
  const cid = String(caseId ?? '').trim();
  if (!cid) return res.status(400).json({ error: 'Missing caseId' });

  const origin = serverOrigin(req);
  const imgFile = caseStoryImagePath(CASE_STORY_CACHE_DIR, cid);
  const fp = String(sessionFingerprint || '').trim();
  const oversightFor = (narrative) =>
    buildCaseStoryOversightImageUrl(CASE_STORY_CACHE_DIR, cid, narrative, origin);

  try {
    const cached = await readCaseStoryCache(CASE_STORY_CACHE_DIR, cid, {
      promptVersion: CASE_STORY_PROMPT_VERSION,
    });
    const cacheValid = Boolean(
      cached?.chapters?.length
      && (!fp || !cached.sessionFingerprint || cached.sessionFingerprint === fp)
      && storyNarrativeMatchesCase(cid, cached),
    );
    if (imageOnly) {
      if (!cached?.chapters?.length) {
        return res.status(400).json({ error: 'Compile story first (Refresh), then generate oversight still' });
      }
      let oversight = oversightFor(cached);
      if (generateImage && magnificApiKey() && (!oversight?.url || refresh)) {
        const ctx = hydrateCaseStoryContext(cid, caseContext);
        const narrative = cached;
        const characterLockMarkdown = (await readCaseStoryCharacterLock(GAME_ROOT, cid)) || '';
        const refs = await resolveCaseStoryMagnificRefs({
          gameRoot: GAME_ROOT,
          caseContext: ctx,
          cacheDir: CASE_STORY_CACHE_DIR,
          caseId: cid,
          mode: 'master',
        });
        const imgPrompt = buildCaseStoryMasterImagePrompt({
          caseContext: ctx,
          narrative,
          portraitNote: String(portraitNote || '').trim(),
          characterLockMarkdown,
        });
        const edited = await generateImageEditWithMagnific({
          imageBase64: refs.imageBase64,
          mimeType: refs.mimeType,
          prompt: imgPrompt,
          aspectRatio: '16:9',
          resolution: '2K',
          referenceText: refs.referenceText,
          extraReferenceImages: refs.extraReferenceImages,
        });
        const fitted = await fitToBaseplate(edited);
        if (imgFile) {
          await fsp.writeFile(imgFile, fitted);
        }
        await writeCaseStoryCache(
          CASE_STORY_CACHE_DIR,
          cid,
          { ...cached },
          { promptVersion: CASE_STORY_PROMPT_VERSION },
        );
        oversight = oversightFor(cached);
      }
      return res.json({
        ok: true,
        imageOnly: true,
        masterImageUrl: oversight?.url || null,
        oversightBeatId: oversight?.beatId || null,
        oversightSource: oversight?.source || null,
        imageGen: Boolean(magnificApiKey()),
      });
    }

    if (!refresh && cacheValid) {
      const ctx = hydrateCaseStoryContext(cid, caseContext);
      const readiness = await buildCaseStoryReadiness({
        gameRoot: GAME_ROOT,
        cacheDir: CASE_STORY_CACHE_DIR,
        caseId: cid,
        caseContext: ctx,
        narrative: cached,
        promptVersion: CASE_STORY_PROMPT_VERSION,
      });
      const oversight = oversightFor(cached);
      return res.json({
        ok: true,
        cached: true,
        cachedAt: cached.cachedAt || null,
        sessionFingerprint: cached.sessionFingerprint || null,
        title: cached.title || '',
        synopsis: cached.synopsis || '',
        chapters: cached.chapters || [],
        patientLock: cached.patientLock || '',
        masterImagePrompt: cached.masterImagePrompt || '',
        masterImageUrl: oversight?.url || null,
        oversightBeatId: oversight?.beatId || null,
        oversightSource: oversight?.source || null,
        staleSession: Boolean(fp && cached.sessionFingerprint && cached.sessionFingerprint !== fp),
        readiness,
        lateralityOk: readiness.lateralityOk,
        lateralityIssues: readiness.lateralityIssues,
      });
    }

    const ctxForStory = hydrateCaseStoryContext(cid, caseContext);
    const characterLockMarkdown = (await readCaseStoryCharacterLock(GAME_ROOT, cid)) || '';
    const messages = buildCaseStoryNarrativePrompt({
      caseContext: ctxForStory,
      sessionContext: sessionContext && typeof sessionContext === 'object' ? sessionContext : {},
      orders: Array.isArray(orders) ? orders : [],
      medicalSequence,
      characterLockMarkdown,
    });
    const raw = await callChatCompletion(key, messages, { maxTokens: 1200, temperature: 0.34 });
    let narrative = parseCaseStoryJson(raw);
    if (!storyNarrativeMatchesCase(cid, narrative)) {
      const offline = buildCaseStoryOffline({ ...ctxForStory, id: cid }, { sessionContext });
      narrative = {
        title: offline.title,
        synopsis: offline.synopsis,
        chapters: offline.chapters,
        patientLock: offline.patientLock,
        masterImagePrompt: offline.masterImagePrompt || '',
      };
    }
    const laterality = resolveLateralityLock({
      caseId: cid,
      caseContext: ctxForStory,
      characterLockMarkdown,
    });
    const lateralityAudit = auditCaseStoryLaterality(narrative, laterality);

    let oversight = oversightFor(narrative);
    if (generateImage && magnificApiKey() && !oversight?.url) {
      const refs = await resolveCaseStoryMagnificRefs({
        gameRoot: GAME_ROOT,
        caseContext: ctxForStory,
        cacheDir: CASE_STORY_CACHE_DIR,
        caseId: cid,
        mode: 'master',
      });
      const imgPrompt = buildCaseStoryMasterImagePrompt({
        caseContext: ctxForStory,
        narrative,
        portraitNote: String(portraitNote || '').trim(),
        characterLockMarkdown,
      });
      const edited = await generateImageEditWithMagnific({
        imageBase64: refs.imageBase64,
        mimeType: refs.mimeType,
        prompt: imgPrompt,
        aspectRatio: '16:9',
        resolution: '2K',
        referenceText: refs.referenceText,
        extraReferenceImages: refs.extraReferenceImages,
      });
      const fitted = await fitToBaseplate(edited);
      if (imgFile) {
        await fsp.writeFile(imgFile, fitted);
      }
      oversight = oversightFor(narrative);
    }

    await writeCaseStoryCache(
      CASE_STORY_CACHE_DIR,
      cid,
      { ...narrative, sessionFingerprint: fp || null },
      { promptVersion: CASE_STORY_PROMPT_VERSION },
    );
    const readiness = await buildCaseStoryReadiness({
      gameRoot: GAME_ROOT,
      cacheDir: CASE_STORY_CACHE_DIR,
      caseId: cid,
      caseContext: ctxForStory,
      narrative,
      promptVersion: CASE_STORY_PROMPT_VERSION,
    });
    return res.json({
      ok: true,
      cached: false,
      sessionFingerprint: fp || null,
      ...narrative,
      masterImageUrl: oversight?.url || null,
      oversightBeatId: oversight?.beatId || null,
      oversightSource: oversight?.source || null,
      laterality,
      lateralityOk: lateralityAudit.ok,
      lateralityIssues: lateralityAudit.issues,
      readiness,
      provider: chatProvider(),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/case-story-storyboard', async (req, res) => {
  const {
    caseId,
    caseContext = null,
    chapters = [],
    patientLock = '',
    portraitNote = '',
    refresh = false,
    generateImages = false,
    gridPlate = true,
  } = req.body || {};
  const cid = String(caseId ?? '').trim();
  if (!cid) return res.status(400).json({ error: 'Missing caseId' });

  const origin = serverOrigin(req);
  const ctx = hydrateCaseStoryContext(cid, caseContext);

  let beatChapters = Array.isArray(chapters) ? chapters : [];
  let lock = String(patientLock || '').trim();
  if (!beatChapters.length) {
    const cached = await readCaseStoryCache(CASE_STORY_CACHE_DIR, cid);
    if (cached?.chapters?.length) {
      beatChapters = cached.chapters;
      lock = lock || String(cached.patientLock || '').trim();
    }
  }
  if (!beatChapters.length) {
    return res.status(400).json({ error: 'No story chapters — compile Case Story first (Refresh)' });
  }

  const narrative = { patientLock: lock, chapters: beatChapters };
  const canGen = Boolean(magnificApiKey());
  const useGridPlate = Boolean(gridPlate !== false && generateImages);

  try {
    const beats = [];
    let gridImageUrl = null;
    const gridFile = caseStoryGridImagePath(CASE_STORY_CACHE_DIR, cid);
    const gridSlug = gridFile ? path.basename(gridFile) : '';

    if (useGridPlate && canGen) {
      if (gridFile && fs.existsSync(gridFile) && !refresh) {
        gridImageUrl = `${origin}/case-story-images/${gridSlug}`;
      } else {
        const characterLockMarkdown = (await readCaseStoryCharacterLock(GAME_ROOT, cid)) || '';
        const refs = await resolveCaseStoryMagnificRefs({
          gameRoot: GAME_ROOT,
          caseContext: ctx,
          cacheDir: CASE_STORY_CACHE_DIR,
          caseId: cid,
          mode: 'grid',
        });

        const cachedStory = await readCaseStoryCache(CASE_STORY_CACHE_DIR, cid);
        const imgPrompt = buildCaseStoryGridPlatePrompt({
          chapters: beatChapters,
          narrative: {
            ...narrative,
            title: cachedStory?.title || ctx.title || '',
            synopsis: cachedStory?.synopsis || '',
          },
          caseContext: ctx,
          portraitNote: String(portraitNote || '').trim(),
          characterLockMarkdown,
        });
        const edited = await generateImageEditWithMagnific({
          imageBase64: refs.imageBase64,
          mimeType: refs.mimeType,
          prompt: imgPrompt,
          aspectRatio: '3:2',
          resolution: '2K',
          referenceText: refs.referenceText,
          extraReferenceImages: refs.extraReferenceImages,
        });
        const fitted = await fitToBaseplate(edited);
        if (gridFile) {
          await fsp.writeFile(gridFile, fitted);
          gridImageUrl = `${origin}/case-story-images/${gridSlug}`;
        }
      }
    }

    for (const ch of beatChapters.slice(0, 8)) {
      const beatId = String(ch.id || `c${beats.length + 1}`);
      const visualHint = deriveChapterVisualHint(ch, {
        patientLock: lock,
        caseContext: ctx,
      });

      let imageUrl = null;
      if (!useGridPlate && generateImages && canGen) {
        const resolvedFile = resolveCaseStoryBeatImagePath(CASE_STORY_CACHE_DIR, cid, beatId);
        const imgFile = caseStoryBeatImagePath(CASE_STORY_CACHE_DIR, cid, beatId);
        const imgSlug = resolvedFile ? path.basename(resolvedFile) : '';
        let imageBase64;
        let mimeType = 'image/png';
        const characterLockMarkdown = (await readCaseStoryCharacterLock(GAME_ROOT, cid)) || '';

        if (resolvedFile && fs.existsSync(resolvedFile) && !refresh) {
          imageUrl = `${origin}/case-story-images/${imgSlug}`;
        } else {
          const characterLockMarkdown = (await readCaseStoryCharacterLock(GAME_ROOT, cid)) || '';
          const refs = await resolveCaseStoryMagnificRefs({
            gameRoot: GAME_ROOT,
            caseContext: ctx,
            cacheDir: CASE_STORY_CACHE_DIR,
            caseId: cid,
            mode: 'beat',
          });
          if (refs.imageBase64) {
            const imgPrompt = buildCaseStoryBeatImagePrompt({
              chapter: { ...ch, visualHint },
              narrative,
              caseContext: ctx,
              portraitNote: String(portraitNote || '').trim(),
              characterLockMarkdown,
            });
            const edited = await generateImageEditWithMagnific({
              imageBase64: refs.imageBase64,
              mimeType: refs.mimeType,
              prompt: imgPrompt,
              aspectRatio: '16:9',
              resolution: '2K',
              referenceText: refs.referenceText,
              extraReferenceImages: refs.extraReferenceImages,
            });
            const fitted = await fitToBaseplate(edited);
            if (imgFile) {
              await fsp.writeFile(imgFile, fitted);
              imageUrl = `${origin}/case-story-images/${imgSlug}`;
            }
          }
        }
      }

      beats.push({
        id: beatId,
        heading: String(ch.heading || '').trim(),
        body: String(ch.body || '').trim(),
        visualHint,
        imageUrl,
        panelIndex: beats.length,
      });
    }

    const readiness = await buildCaseStoryReadiness({
      gameRoot: GAME_ROOT,
      cacheDir: CASE_STORY_CACHE_DIR,
      caseId: cid,
      caseContext: ctx,
      narrative: { ...narrative, chapters: beatChapters },
      promptVersion: CASE_STORY_PROMPT_VERSION,
    });

    return res.json({
      ok: true,
      caseId: cid,
      beats,
      gridImageUrl,
      gridPlate: useGridPlate,
      imageGen: canGen,
      imagesGenerated: Boolean(generateImages),
      cameraLock: 'smart per-beat camera — 2×3 grid plate, MeWorld sculptural CGI',
      readiness,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/order-result', async (req, res) => {
  const key = chatApiKeyOrError(res);
  if (!key) return;

  const {
    caseId,
    orderId,
    orderLabel,
    playbookWhy = '',
    caseContext = null,
    teachMeMode = false,
    refresh = false,
    fallbackText = '',
    orderKindHint = 'order',
    trajectoryOccurrence = 0,
    orderLog = [],
    priorLabResults = [],
  } = req.body || {};
  const cid = String(caseId ?? '').trim();
  const oid = String(orderId ?? '').trim();
  const label = String(orderLabel ?? '').trim();
  if (!cid || !oid || !label) {
    return res.status(400).json({ error: 'Missing caseId, orderId, or orderLabel' });
  }

  try {
    if (!refresh) {
      const cached = await readOrderResultEntry(
        ORDER_RESULT_CACHE_DIR,
        cid,
        oid,
        teachMeMode,
        trajectoryOccurrence,
      );
      if (cached?.text && (cached.promptVersion || 1) >= ORDER_RESULT_PROMPT_VERSION) {
        return res.json({
          ok: true,
          text: cached.text,
          kind: cached.kind || orderKindHint,
          kindLabel: cached.kindLabel || 'Result',
          cached: true,
          cachedAt: cached.cachedAt,
          provider: 'cache',
        });
      }
    }

    const cleanCase = await loadCleanCaseJson(GAME_ROOT, cid);
    const enrichedContext = enrichCaseContextWithCleanCase(
      caseContext && typeof caseContext === 'object' ? caseContext : {},
      cleanCase,
      label,
    );

    const messages = buildOrderResultPrompt({
      orderLabel: label,
      orderKindHint,
      playbookWhy,
      caseContext: enrichedContext,
      teachMeMode: Boolean(teachMeMode),
      fallbackText,
      orderLog: Array.isArray(orderLog) ? orderLog : [],
      priorLabResults: Array.isArray(priorLabResults) ? priorLabResults : [],
      trajectoryOccurrence: Number(trajectoryOccurrence) || 0,
    });
    const raw = await callChatCompletion(key, messages, { maxTokens: 520, temperature: 0.28 });
    let parsed;
    try {
      parsed = parseOrderResultJson(raw);
    } catch (parseErr) {
      if (fallbackText) {
        return res.json({
          ok: true,
          text: String(fallbackText).trim(),
          kind: orderKindHint,
          kindLabel: 'Result',
          cached: false,
          provider: 'fallback',
          parseError: String(parseErr.message || parseErr),
        });
      }
      throw parseErr;
    }
    const saved = await writeOrderResultEntry(
      ORDER_RESULT_CACHE_DIR,
      cid,
      oid,
      teachMeMode,
      {
        text: parsed.text,
        kind: parsed.kind,
        kindLabel: parsed.kindLabel,
        promptVersion: ORDER_RESULT_PROMPT_VERSION,
        orderLabel: label,
      },
      trajectoryOccurrence,
    );
    return res.json({
      ok: true,
      text: parsed.text,
      kind: parsed.kind,
      kindLabel: parsed.kindLabel,
      cached: false,
      cachedAt: saved?.cachedAt || null,
      provider: chatProvider(),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

/** Canonical clinical case bank — `game/data/cases/case_N.json` (DeepSeek / GitHub sync). */
app.get('/api/case-clinical/:caseId', async (req, res) => {
  const cid = String(req.params.caseId ?? '').trim();
  if (!cid) return res.status(400).json({ error: 'Missing caseId' });
  try {
    const cleanCase = await loadCleanCaseJson(GAME_ROOT, cid);
    if (!cleanCase) return res.status(404).json({ error: 'Case not found' });
    return res.json({ ok: true, caseId: cid, case: cleanCase });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

function runReadCaseTts({ cacheDir, voiceRef, voiceProfile }) {
  return new Promise((resolve, reject) => {
    const args = [READ_CASE_SCRIPT, '--cache-dir', cacheDir];
    if (voiceRef) {
      args.push('--voice-ref', voiceRef);
    }
    const profile = String(voiceProfile || '').toLowerCase();
    const childProfiles = new Set([
      'patient-child',
      'patient-child-boy',
      'patient-child-girl',
    ]);
    const env = {
      ...process.env,
      CHATTERBOX_ROOT,
      PYTHONUNBUFFERED: '1',
    };
    if (childProfiles.has(profile)) {
      env.CHATTERBOX_PATIENT_CHILD_MODEL =
        process.env.CHATTERBOX_PATIENT_CHILD_MODEL || 'expressive';
      env.CHATTERBOX_CHILD_EXAGGERATION =
        process.env.CHATTERBOX_CHILD_EXAGGERATION || '0.84';
      env.CHATTERBOX_CHILD_CFG_WEIGHT = process.env.CHATTERBOX_CHILD_CFG_WEIGHT || '0.28';
      env.CHATTERBOX_CHILD_TEMPERATURE = process.env.CHATTERBOX_CHILD_TEMPERATURE || '0.88';
    }
    const child = spawn(CHATTERBOX_PYTHON, args, {
      cwd: path.dirname(READ_CASE_SCRIPT),
      env,
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(stderr.trim() || `Chatterbox exited ${code}`));
    });
  });
}

app.post('/api/read-case', async (req, res) => {
  const { caseId = '', section = 'hpi', text = '', voiceProfile = 'narrator' } = req.body || {};
  const trimmed = String(text).trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'Missing text' });
  }
  if (!fs.existsSync(CHATTERBOX_PYTHON)) {
    return res.status(503).json({
      error: `Chatterbox Python not found at ${CHATTERBOX_PYTHON}. Set CHATTERBOX_PYTHON in .env`,
    });
  }
  if (!fs.existsSync(READ_CASE_SCRIPT)) {
    return res.status(503).json({ error: 'Missing tools/chatterbox/read_case_tts.py' });
  }

  let voiceRef;
  try {
    voiceRef = resolveVoiceRefForProfile(voiceProfile);
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e).slice(0, 400) });
  }
  const apiOrigin = serverOrigin(req);

  try {
    const { manifest, layout } = await buildOrLoadManifest({
      cacheRoot: CASE_TTS_DIR,
      caseId,
      section,
      text: trimmed.slice(0, 12000),
      voiceRef,
    });
    syncManifestWithDisk(manifest, layout.chunksDir);

    const readyBefore = countReadyChunks(manifest, layout.chunksDir);
    const total = manifest.chunks.length;
    const needsGeneration = readyBefore < total;

    if (needsGeneration) {
      await runReadCaseTts({ cacheDir: layout.base, voiceRef, voiceProfile });
      const updated = await readManifest(layout.manifestPath);
      if (updated) Object.assign(manifest, updated);
      syncManifestWithDisk(manifest, layout.chunksDir);
    }

    const playlist = manifestToPlaylist(manifest, apiOrigin);

    return res.json({
      playlist,
      cached: readyBefore === total,
      partial: readyBefore > 0 && readyBefore < total,
      ready: playlist.length,
      total,
      cachePath: layout.base,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 600) });
  }
});

app.get('/api/read-case/status', async (req, res) => {
  const caseId = req.query.caseId || '';
  const section = req.query.section || 'hpi';
  const text = String(req.query.text || '').trim();
  const voiceProfile = req.query.voiceProfile || 'narrator';
  if (!text) return res.status(400).json({ error: 'Missing text' });

  try {
    const voiceRef = resolveVoiceRefForProfile(voiceProfile);
    const { manifest, layout } = await buildOrLoadManifest({
      cacheRoot: CASE_TTS_DIR,
      caseId,
      section,
      text: text.slice(0, 12000),
      voiceRef,
    });
    syncManifestWithDisk(manifest, layout.chunksDir);
    const ready = countReadyChunks(manifest, layout.chunksDir);
    const playlist = manifestToPlaylist(manifest, serverOrigin(req));
    return res.json({
      ready,
      total: manifest.chunks.length,
      complete: ready === manifest.chunks.length,
      playlist,
      cachePath: layout.base,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 400) });
  }
});

app.post('/api/refine-narrative', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'Add OPENAI_API_KEY to MeWorld/.env' });
  }

  const {
    rawText = '',
    playRole = 'doctor',
    title = '',
    category = '',
    clinicalTip = '',
    objective = '',
  } = req.body || {};

  if (!String(rawText).trim()) {
    return res.status(400).json({ error: 'Missing rawText' });
  }

  const voice =
    playRole === 'patient'
      ? 'first-person patient voice (I/me/my), consistent grammar'
      : 'third-person clinical charting (the patient...), consistent grammar';

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You clean CCS case presentation text for a medical training game. Return JSON only.
- Fix grammar, pronouns, and flow. Remove chart tab junk and screenshot references.
- Use clear section breaks in hpi (HPI, PMH, meds, allergies, social, ROS).
- ${voice}
- Do not invent new clinical facts.`,
          },
          {
            role: 'user',
            content: `Case: ${title} (${category})
Clinical tip: ${clinicalTip}
Objective: ${objective}

Raw text:
${String(rawText).slice(0, 6000)}

Return JSON:
{
  "intro": "one-line chief complaint / opening",
  "hpi": "full formatted narrative with section breaks",
  "vitalsText": "clean vitals paragraph or empty",
  "clinicalTip": "optional cleaned tip",
  "objective": "optional cleaned objective"
}`,
          },
        ],
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err.slice(0, 400) });
    }

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/detect-zones', async (req, res) => {
  // Vision zone-detection is an OPTIONAL enhancement (clickable hotspots on the
  // portrait). When it can't run — no key, expired/invalid key, upstream error —
  // degrade gracefully with HTTP 200 + zones:null instead of forwarding a 4xx/5xx.
  // A hard error here was surfacing OpenAI's 401 to the browser console and failing
  // the play-case smoke even though the client already handles "no zones" fine.
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.json({ ok: true, zones: null, skipped: true, reason: 'no-openai-key' });
  }
  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.warn(`[detect-zones] upstream ${r.status}; skipping zones: ${err.slice(0, 160)}`);
      return res.json({ ok: true, zones: null, skipped: true, reason: `upstream-${r.status}` });
    }
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const zones = JSON.parse(clean);
    res.json({ zones });
  } catch (e) {
    console.warn(`[detect-zones] error; skipping zones: ${String(e.message || e)}`);
    res.json({ ok: true, zones: null, skipped: true, reason: 'error' });
  }
});

app.post('/api/case-persona', async (req, res) => {
  const { caseContext } = req.body || {};
  const caseId = caseContext?.id ?? caseContext?.ccsNumber;
  if (!caseId) return res.status(400).json({ error: 'Missing caseContext.id' });

  try {
    const cached = await readPortraitCache(CASE_PORTRAIT_DIR, caseId);
    const persona =
      cached.meta?.persona ||
      cached.meta?.analysis?.persona ||
      buildPortraitPersona(caseContext);
    return res.json({
      ok: true,
      caseId,
      persona,
      fromPortrait: Boolean(cached.exists),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/case-portrait/:caseId', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const isPreview = req.query.preview === '1';
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  try {
    // Check for preview variant first
    if (isPreview) {
      const previewFileName = portraitPreviewFileName(caseId);
      if (previewFileName) {
        const previewPath = path.join(CASE_PORTRAIT_DIR, previewFileName);
        try {
          await fsp.access(previewPath);
          const origin = serverOrigin(req);
          return res.json({
            ok: true,
            exists: true,
            caseId,
            url: portraitPreviewPublicUrl(caseId, origin),
            preview: true,
          });
        } catch { /* no preview — fall through to main portrait */ }
      }
    }
    const cached = await readPortraitCache(CASE_PORTRAIT_DIR, caseId, { allowBanned: true });
    if (!cached.exists) {
      return res.json({ ok: true, exists: false, caseId });
    }
    const origin = serverOrigin(req);
    const layerState = await readPortraitLayers(CASE_PORTRAIT_DIR, caseId);
    const hasLayers =
      layerState.base
      && layerState.iv
      && layerState.mask
      && (cached.meta?.portraitLayersVersion || 0) >= PORTRAIT_LAYERS_VERSION;
    const url = portraitPublicUrl(caseId, origin);
    const baseline = await readPortraitBaseline(CASE_PORTRAIT_DIR, caseId);
    const baselineUrl = baseline.exists ? portraitBaselinePublicUrl(caseId, origin) : null;
    return res.json({
      ok: true,
      exists: true,
      caseId,
      url,
      baselineUrl,
      hasBaseline: Boolean(baseline.exists),
      layers: hasLayers
        ? {
            base: url,
            iv: portraitLayerPublicUrl(caseId, 'iv', origin),
            mask: portraitLayerPublicUrl(caseId, 'mask', origin),
          }
        : null,
      cachedAt: cached.meta?.cachedAt || null,
      analysis: cached.meta?.analysis || null,
      persona: cached.meta?.persona || cached.meta?.analysis?.persona || null,
      provider: cached.meta?.provider || 'magnific',
      sourceVideo: cached.meta?.sourceVideo || null,
      patientSex: cached.meta?.patientSex || cached.meta?.analysis?.sex || null,
      uberRefSlug: cached.meta?.uberRefSlug || null,
      ladyRefSlug: cached.meta?.ladyRefSlug || null,
      portraitFrameVersion: cached.meta?.portraitFrameVersion || 1,
      portraitLayersVersion: cached.meta?.portraitLayersVersion || 0,
      portraitWidth: cached.meta?.portraitWidth || null,
      portraitHeight: cached.meta?.portraitHeight || null,
      directorBriefSource: cached.meta?.directorBriefSource || null,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

function caseBriefPublicUrl(caseId, req) {
  const fileName = caseBriefFileName(caseId);
  if (!fileName) return null;
  return `${serverOrigin(req)}/case-briefs/${fileName}`;
}

async function buildOrLoadCaseBrief({
  caseId,
  refresh = false,
  clientDiscussion = null,
  caseContext = null,
  req = null,
}) {
  const bundle = await loadCaseRawBundle({
    casesDir: MEWORLD_CASES_DIR,
    reviewPath: DIFFERENTIAL_REVIEW_PATH,
    portraitDir: CASE_PORTRAIT_DIR,
    caseId,
    clientDiscussion,
    clientContext: caseContext,
  });
  const sourceHash = hashRawBundle(bundle);

  if (!refresh) {
    const cached = await readBriefCache(CASE_BRIEF_DIR, caseId);
    if (cached.exists && cached.meta?.sourceHash === sourceHash && cached.markdown) {
      return {
        cached: true,
        markdown: cached.markdown,
        sourceHash,
        url: caseBriefPublicUrl(caseId, req),
        cachedAt: cached.meta?.cachedAt || null,
      };
    }
  }

  const key = DEEPSEEK_API_KEY || OPENAI_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY or OPENAI_API_KEY required for case brief');
  const markdown = await synthesizeCaseBriefMarkdown(key, bundle, async (apiKey, messages) =>
    callChatCompletion(apiKey, messages, { maxTokens: 2800, temperature: 0.25 }),
  );
  await writeBriefCache(CASE_BRIEF_DIR, caseId, markdown, { sourceHash, provider: chatProvider() });
  return {
    cached: false,
    markdown,
    sourceHash,
    url: caseBriefPublicUrl(caseId, req),
    cachedAt: new Date().toISOString(),
  };
}

app.get('/api/case-brief/:caseId', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  try {
    const cached = await readBriefCache(CASE_BRIEF_DIR, caseId);
    if (!cached.exists) {
      return res.json({ ok: true, exists: false, caseId });
    }
    return res.json({
      ok: true,
      exists: true,
      caseId,
      markdown: cached.markdown,
      url: caseBriefPublicUrl(caseId, req),
      cachedAt: cached.meta?.cachedAt || null,
      sourceHash: cached.meta?.sourceHash || null,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/case-brief/:caseId', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });

  const { refresh = false, clientDiscussion = null, caseContext = null } = req.body || {};
  const key = chatApiKeyOrError(res);
  if (!key) return;

  try {
    const result = await buildOrLoadCaseBrief({
      caseId,
      refresh,
      clientDiscussion,
      caseContext,
      req,
    });
    return res.json({ ok: true, caseId, ...result });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/regenerate-patient-from-case', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY not configured in MeWorld/.env' });
  }

  const startedAt = Date.now();
  const {
    imageBase64,
    mimeType = 'image/png',
    caseContext,
    portraitBrief = '',
    refresh = false,
    chatMessages = [],
    sessionContext = null,
    sessionUpdate = false,
  } = req.body || {};
  const caseId = caseContext?.id ?? caseContext?.ccsNumber;
  if (!caseId) return res.status(400).json({ error: 'Missing case id in caseContext' });

  try {
    const portraitSex = resolvePortraitSex(caseContext || {});

    if (!refresh) {
      const cached = await readPortraitCache(CASE_PORTRAIT_DIR, caseId, { allowBanned: true });
      // Reuse the cached portrait whenever one exists. Regeneration is MANUAL ONLY:
      // it happens solely on an explicit refresh (the "Regenerate portrait" button),
      // never automatically on case load. This lets the user attach a character
      // reference first and deliberately rebuild, instead of every case open
      // silently triggering a ~90s portrait rebuild on version/staleness drift.
      if (cached.exists) {
        const origin = serverOrigin(req);
        const url = portraitPublicUrl(caseId, origin);
        const cachedSex = cached.meta?.patientSex || cached.meta?.analysis?.sex || null;
        const persona = cached.meta?.persona || cached.meta?.analysis?.persona || buildPortraitPersona(caseContext);
        return res.json({
          ok: true,
          cached: true,
          url,
          dataUrl: url,
          layers: {
            base: url,
            iv: portraitLayerPublicUrl(caseId, 'iv', origin),
            mask: portraitLayerPublicUrl(caseId, 'mask', origin),
          },
          provider: cached.meta?.provider || 'magnific',
          analysis: cached.meta?.analysis || buildPortraitAnalysis(caseContext, persona),
          persona,
          patientSex: cachedSex || portraitSex,
          portraitFrameVersion: cached.meta?.portraitFrameVersion || 1,
          portraitLayersVersion: cached.meta?.portraitLayersVersion || PORTRAIT_LAYERS_VERSION,
        });
      }
    }

    const chatKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const isSessionPortrait = Boolean(
      sessionUpdate
      || sessionContext?.hasSessionData
      || (sessionContext && typeof sessionContext === 'object' && Object.keys(sessionContext).length > 0),
    );
    const directorBrief = await extractPortraitDirectorBrief(caseContext, {
      chatMessages,
      portraitBrief,
      sessionContext,
      sessionUpdate: isSessionPortrait,
      callChat: chatKey
        ? (messages, opts) => callChatCompletion(chatKey, messages, opts)
        : null,
    });

    let editBase64;
    let editMime = 'image/png';
    const cachedPortrait = await readPortraitCache(CASE_PORTRAIT_DIR, caseId);

    if (isSessionPortrait && cachedPortrait.exists) {
      await ensurePortraitBaseline(CASE_PORTRAIT_DIR, caseId);
      const cachedBuf = await fsp.readFile(cachedPortrait.pngPath);
      editBase64 = bufferToBase64(await fitToBaseplate(cachedBuf));
    } else {
      const plate = await readGenerationLayoutBuffer(GAME_ROOT, caseContext);
      const fittedInput = await fitToBaseplate(plate.buffer);
      if (isSessionPortrait) {
        const baselineState = await readPortraitBaseline(CASE_PORTRAIT_DIR, caseId);
        const baselineName = portraitBaselineFileName(caseId);
        if (!baselineState.exists && baselineName) {
          await fsp.writeFile(path.join(CASE_PORTRAIT_DIR, baselineName), fittedInput);
        }
      }
      editBase64 = bufferToBase64(fittedInput);
      editMime = plate.mimeType || mimeType;
    }

    const basePrompt = buildPortraitPrompt(caseContext, {
      portraitBrief,
      directorBrief,
      variant: 'base',
      sessionUpdate: isSessionPortrait,
    });
    const portraitExtras = await buildPortraitMagnificExtras(GAME_ROOT, caseContext);
    const { b64: baseB64, provider: portraitProvider } = await generatePortraitWithFallback({
      imageBase64: editBase64,
      mimeType: editMime,
      prompt: basePrompt,
      extraReferenceImages: portraitExtras,
    });

    const ivPrompt = buildPortraitPrompt(caseContext, {
      portraitBrief,
      directorBrief,
      variant: 'iv',
      sessionUpdate: isSessionPortrait,
    });
    const { b64: ivB64 } = await generatePortraitWithFallback({
      imageBase64: baseB64,
      mimeType: 'image/png',
      prompt: ivPrompt,
      extraReferenceImages: portraitExtras,
    });

    let visionPersona = null;
    try {
      visionPersona = await extractPersonaFromPortraitImage(baseB64);
    } catch (visionErr) {
      console.warn('[case-portrait] vision persona skipped:', visionErr.message);
    }
    const persona = buildPortraitPersona(caseContext, visionPersona);
    const analysis = buildPortraitAnalysis(caseContext, persona);
    const meta = {
      analysis,
      persona,
      ...buildPortraitMeta(caseContext),
      portraitBrief: String(portraitBrief || '').trim() || null,
      portraitLayersVersion: PORTRAIT_LAYERS_VERSION,
      directorBriefSource: directorBrief?.source || null,
      sessionPortrait: isSessionPortrait,
      chatMessageCount: chatMessages.length,
      provider: portraitProvider || 'magnific',
    };

    await writePortraitCache(CASE_PORTRAIT_DIR, caseId, baseB64, meta);
    if (!isSessionPortrait) {
      await ensurePortraitBaseline(CASE_PORTRAIT_DIR, caseId);
    }
    await writePortraitLayer(CASE_PORTRAIT_DIR, caseId, 'iv', ivB64);
    await writeIvMaskLayer(
      CASE_PORTRAIT_DIR,
      caseId,
      Buffer.from(baseB64, 'base64'),
      Buffer.from(ivB64, 'base64'),
    );

    const timingMs = Date.now() - startedAt;
    logPortraitRegenBlock({
      caseId,
      directorBrief,
      prompts: { basePreview: basePrompt, ivPreview: ivPrompt },
      meta: { hasBase: true, hasIv: true, hasMask: true },
      timingMs,
    });

    const origin = serverOrigin(req);
    const url = portraitPublicUrl(caseId, origin);
    const baselineState = await readPortraitBaseline(CASE_PORTRAIT_DIR, caseId);
    const baselineUrl = baselineState.exists ? portraitBaselinePublicUrl(caseId, origin) : null;
    return res.json({
      ok: true,
      cached: false,
      url,
      dataUrl: url,
      baselineUrl,
      hasBaseline: Boolean(baselineState.exists),
      sessionPortrait: isSessionPortrait,
      directorBriefSource: directorBrief?.source || null,
      layers: {
        base: url,
        iv: portraitLayerPublicUrl(caseId, 'iv', origin),
        mask: portraitLayerPublicUrl(caseId, 'mask', origin),
      },
      provider: portraitProvider || 'magnific',
      analysis,
      persona,
      patientSex: portraitSex,
      portraitFrameVersion: PORTRAIT_FRAME_VERSION,
      portraitLayersVersion: PORTRAIT_LAYERS_VERSION,
      elapsedMs: timingMs,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/case-avatar/from-video', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY not configured in MeWorld/.env' });
  }

  const {
    caseId,
    youtubeId,
    title = '',
    patientName = '',
    storyId = null,
    caseContext = null,
  } = req.body || {};
  const id = caseId ?? caseContext?.id ?? caseContext?.ccsNumber;
  if (!id) return res.status(400).json({ error: 'Missing caseId' });
  if (!youtubeId) return res.status(400).json({ error: 'Missing youtubeId' });

  try {
    const thumb = await fetchYouTubeThumbnailBase64(youtubeId);
    const ctx = caseContext && typeof caseContext === 'object' ? caseContext : { id };
    const prompt = buildVideoAvatarPrompt(ctx, { patientName, videoTitle: title });
    const { b64: outB64, provider: portraitProvider } = await generatePortraitWithFallback({
      imageBase64: thumb.base64,
      mimeType: thumb.mimeType,
      prompt,
    });

    let visionPersona = null;
    try {
      visionPersona = await extractPersonaFromPortraitImage(outB64);
    } catch (visionErr) {
      console.warn('[case-avatar] vision persona skipped:', visionErr.message);
    }
    const persona = buildPortraitPersona(ctx, visionPersona);
    const analysis = buildPortraitAnalysis(ctx, persona);
    const sourceVideo = {
      youtubeId: String(youtubeId).trim(),
      title: String(title || '').trim() || null,
      patientName: String(patientName || '').trim() || null,
      storyId: storyId || null,
      thumbnailUrl: thumb.thumbnailUrl,
      selectedAt: new Date().toISOString(),
    };

    await writePortraitCache(CASE_PORTRAIT_DIR, id, outB64, {
      analysis,
      persona,
      sourceVideo,
      avatarSource: 'real_world_video',
    });

    const url = portraitPublicUrl(id, serverOrigin(req));
    return res.json({
      ok: true,
      caseId: id,
      url,
      dataUrl: url,
      persona,
      sourceVideo,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/generate-scene', async (req, res) => {
  if (!sceneImageProvider()) {
    return res.status(400).json({ error: 'Add FAL_KEY or OPENAI_API_KEY to MeWorld/.env' });
  }

  const { imageBase64, mimeType = 'image/png', location = 'ER' } = req.body || {};
  const unit = String(location || 'ER').toUpperCase();
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });
  if (!['ER', 'OBS', 'ICU', 'WARD'].includes(unit)) {
    return res.status(400).json({ error: 'Invalid location' });
  }

  try {
    const imageHash = crypto.createHash('sha256').update(imageBase64).digest('hex');
    const fileName = `${imageHash}-${unit.toLowerCase()}.png`;
    const outPath = path.join(SCENE_CACHE_DIR, fileName);
    const publicUrl = `${serverOrigin(req)}/scene-cache/${fileName}`;

    try {
      await fsp.access(outPath);
      return res.json({ cached: true, url: publicUrl, imageHash, location: unit });
    } catch {
      // no cache hit, continue
    }

    const prompt = `Transform this exact same patient photo into a ${unit} hospital setting.
Keep the same person, same pose, same camera angle, same bed alignment, and same likeness.
Only change environmental context and room equipment to match ${unit}.
No text overlays, no extra people, no style transfer. Photorealistic hospital scene.`;

    const { outB64, provider } = await generateSceneImage({ imageBase64, mimeType, prompt });
    await fsp.writeFile(outPath, Buffer.from(outB64, 'base64'));
    return res.json({ cached: false, url: publicUrl, imageHash, location: unit, provider });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

async function generateLikenessImage({ imageBase64, mimeType, prompt }) {
  if (magnificApiKey() && sceneImageProvider() !== 'fal' && sceneImageProvider() !== 'openai') {
    try {
      return await generateSceneWithMagnific({ imageBase64, mimeType, prompt });
    } catch (magnificErr) {
      if (!process.env.FAL_KEY && !process.env.OPENAI_API_KEY) throw magnificErr;
      console.warn('[magic/create] Magnific failed, falling back:', magnificErr.message);
    }
  }
  if (process.env.FAL_KEY && sceneImageProvider() === 'fal') {
    try {
      return await generateSceneWithFal({ imageBase64, mimeType, prompt });
    } catch (falErr) {
      if (!process.env.OPENAI_API_KEY) throw falErr;
      console.warn('[magic/create] fal failed, falling back to OpenAI:', falErr.message);
    }
  }
  return generateSceneWithOpenAI({ imageBase64, mimeType, prompt });
}

app.post('/api/magic/create', async (req, res) => {
  if (!sceneImageProvider()) {
    return res.status(400).json({ error: 'Add MAGNIFIC_API_KEY, FAL_KEY, or OPENAI_API_KEY to MeWorld/.env' });
  }
  const { imageBase64, mimeType = 'image/png', email = '', origin = '' } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });

  try {
    const token = crypto.randomBytes(18).toString('hex');
    const prompt = `Create a photorealistic hospital patient scene using the same person in this photo.
Preserve facial likeness, skin tone, age, and identity. Keep realism and dignity.
Place this person in a clinical bed scene appropriate for emergency medicine training.
No text, no watermark, no extra people, no cartoon style.`;
    const editedB64 = await generateLikenessImage({ imageBase64, mimeType, prompt });
    const payload = {
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      email: String(email || '').trim().toLowerCase(),
      mimeType: 'image/png',
      personalizedImageBase64: editedB64,
    };
    await fsp.writeFile(path.join(MAGIC_DIR, `${token}.json`), JSON.stringify(payload, null, 2), 'utf8');

    const base = String(origin || '').startsWith('http')
      ? String(origin).replace(/\/$/, '')
      : 'http://127.0.0.1:5173';
    const magicLink = `${base}/?magic=${token}`;
    let sent = false;
    let note = 'Magic link generated.';
    if (payload.email) {
      try {
        const status = await sendMagicEmail(payload.email, magicLink);
        sent = status.sent;
        if (!sent && status.reason) note = `Magic link generated. ${status.reason}.`;
      } catch (mailErr) {
        note = `Magic link generated. Email failed: ${String(mailErr.message || mailErr)}`;
      }
    } else {
      note = 'Magic link generated. Add an email to send automatically.';
    }

    return res.json({
      ok: true,
      magicLink,
      sent,
      note,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/magic/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const file = path.join(MAGIC_DIR, `${token}.json`);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const payload = JSON.parse(raw);
    if (!payload?.personalizedImageBase64) {
      return res.status(404).json({ error: 'Magic token invalid' });
    }
    if (payload.expiresAt && Date.now() > Date.parse(payload.expiresAt)) {
      return res.status(410).json({ error: 'Magic link expired' });
    }
    return res.json({
      ok: true,
      mimeType: payload.mimeType || 'image/png',
      personalizedImageBase64: payload.personalizedImageBase64,
    });
  } catch {
    return res.status(404).json({ error: 'Magic link not found' });
  }
});

app.post('/api/capture-screenshot', async (req, res) => {
  const { imageBase64, caseNumber, attempt, meta = {} } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });
  if (caseNumber == null || caseNumber === '') {
    return res.status(400).json({ error: 'Missing caseNumber' });
  }
  const attemptNum = Number(attempt) || 1;
  const caseFolder = `case-${pad3(caseNumber)}`;
  const attemptFolder = `attempt-${pad3(attemptNum)}`;
  const dir = path.join(CAPTURES_DIR, caseFolder, attemptFolder);

  try {
    await fsp.mkdir(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const pngName = `screenshot-${ts}.png`;
    const pngPath = path.join(dir, pngName);
    await fsp.writeFile(pngPath, Buffer.from(imageBase64, 'base64'));

    const metaPath = path.join(dir, 'meta.json');
    const payload = {
      caseNumber: String(caseNumber),
      attempt: attemptNum,
      screenshot: pngName,
      savedAt: new Date().toISOString(),
      ...meta,
    };
    await fsp.writeFile(metaPath, JSON.stringify(payload, null, 2));

    const relative = `${caseFolder}/${attemptFolder}`;
    return res.json({
      ok: true,
      relative,
      absolute: dir,
      screenshot: pngName,
      meta: metaPath,
      caseFolder: path.join(CAPTURES_DIR, caseFolder),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

function isPathUnderRoot(targetPath, rootDir) {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(rootDir);
  return resolved === root || resolved.startsWith(`${root}\\`) || resolved.startsWith(`${root}/`);
}

app.post('/api/open-path', (req, res) => {
  const { path: targetPath } = req.body || {};
  if (!targetPath || typeof targetPath !== 'string') {
    return res.status(400).json({ error: 'Missing path' });
  }
  const allowedRoots = [CAPTURES_DIR, path.join(GAME_ROOT, 'docs'), path.join(GAME_ROOT, 'public')];
  if (!allowedRoots.some((root) => isPathUnderRoot(targetPath, root))) {
    return res.status(403).json({ error: 'Path not allowed' });
  }
  try {
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }
    if (process.platform === 'win32') {
      spawn('explorer.exe', [targetPath], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [targetPath], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [targetPath], { detached: true, stdio: 'ignore' }).unref();
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/youtube-transcript/:videoId', async (req, res) => {
  try {
    const result = await fetchYoutubeTranscript(req.params.videoId);
    return res.json({
      ok: true,
      transcript: result.text,
      cues: result.cues || [],
      language: result.language,
    });
  } catch (e) {
    return res.status(404).json({ error: String(e.message || e) });
  }
});

app.get('/api/ccs-screenshot/:caseNum', async (req, res) => {
  try {
    const caseNum = parseInt(String(req.params.caseNum || ''), 10);
    if (!Number.isFinite(caseNum) || caseNum < 1) {
      return res.status(400).json({ error: 'invalid case number' });
    }
    if (!fs.existsSync(CCS_SCREENSHOTS_DIR)) {
      return res.status(404).json({ error: 'screenshots folder not found', dir: CCS_SCREENSHOTS_DIR });
    }
    const files = await fsp.readdir(CCS_SCREENSHOTS_DIR);
    const pattern = new RegExp(`^case_0*${caseNum}_`, 'i');
    const match = files.find((name) => pattern.test(name) && /\.png$/i.test(name));
    if (!match) {
      return res.status(404).json({ error: 'no screenshot for case', caseNum });
    }
    return res.sendFile(path.join(CCS_SCREENSHOTS_DIR, match));
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

if (process.env.SERVE_STATIC === '1') {
  const distDir = path.join(GAME_ROOT, 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api')
        || req.path.startsWith('/case-tts')
        || req.path.startsWith('/case-portraits')
        || req.path.startsWith('/case-briefs')
        || req.path.startsWith('/scene-cache')
        || req.path.startsWith('/user-data')
      ) {
        return next();
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    console.warn('SERVE_STATIC=1 but dist/ not found — run npm run build first');
  }
}

app.listen(PORT, '0.0.0.0', () => {
  const host = process.env.SERVE_STATIC === '1' ? '0.0.0.0' : '127.0.0.1';
  console.log(`${APP_PRODUCT_NAME} API → http://${host}:${PORT}${process.env.SERVE_STATIC === '1' ? ' (static + API)' : ''}`);
});
