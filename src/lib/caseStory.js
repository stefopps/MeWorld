import playbookBundle from '../data/orderWhyPlaybook.json' with { type: 'json' };
import { apiUrl } from './apiBase.js';
import { buildCaseChatContext } from './caseChat.js';
import { mergeCaseStoryWithOverride } from './caseStoryOverrides.js';
import { caseStorySessionFingerprint } from './caseStorySessionFingerprint.js';
import { storyNarrativeMatchesCase } from './caseStoryCanonical.js';

function normalizeCaseId(caseId) {
  const raw = String(caseId ?? '').trim();
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

function playbookWhy(caseId, orderId) {
  const ck = normalizeCaseId(caseId);
  return playbookBundle?.cases?.[ck]?.[orderId]?.why || '';
}

function collectOrders(caseData) {
  const list = Array.isArray(caseData?.interventions) ? caseData.interventions : [];
  const cid = normalizeCaseId(caseData?.id);
  return list.map((iv) => ({
    id: iv.id,
    label: iv.label,
    why: String(iv.why || playbookWhy(cid, iv.id) || '').trim(),
  }));
}

/** Offline case story for case 001 (tension pneumothorax) and generic fallback. */
export function buildCaseStoryOffline(caseData, { sessionContext = {} } = {}) {
  const cid = normalizeCaseId(caseData?.id);
  const orders = collectOrders(caseData);
  const placed = (sessionContext?.stacksPlaced || []).map((s) => s.label || s.id).filter(Boolean);

  const is001 = cid === '001';
  const is051 = cid === '051';
  const is153 = cid === '153';
  const is176 = cid === '176';
  const patientLock = is001
    ? 'Adult male, diaphoretic, in extremis — tension pneumothorax presentation'
    : is051
      ? '70-year-old Caucasian man, hospital gown, withdrawn expression, no focal deficits'
      : is153
        ? "N'Gavu — young Black man, mustard-yellow party jacket likeness, thin mustache, hospital gown, blistered hands and forearms — beer bottles on bedside table, yellow shirt on chair"
        : is176
        ? 'Young Black man, subway-afro-dandy likeness — large heart-shaped afro, calm direct gaze; light blue hospital gown on ED stretcher; forearm animal bite wound with cellulitis visible where appropriate; same likeness throughout; clinical stress'
        : `${caseData?.category || 'ED'} patient — same likeness as play portrait`;

  const chapters = is001
    ? [
        {
          id: 'c1',
          heading: 'Arrival',
          body: 'He arrives clutching his chest, tachypneic and diaphoretic. Breath sounds are absent on one side; the trachea has begun to shift. This is a bedside diagnosis — not a film to wait for.',
        },
        {
          id: 'c2',
          heading: 'The missed minute',
          body: placed.length
            ? `With ${placed.slice(0, 3).join(', ')} in motion, the team treats obstruction before collapse.`
            : 'Without immediate decompression, venous return falls and pulse pressure narrows — minutes matter.',
        },
        {
          id: 'c3',
          heading: 'Oversight',
          body: 'From the foot of the bed you see the whole resuscitation bay: one patient, one airway, one chest that must be relieved now.',
        },
      ]
    : is051
      ? [
          {
            id: 'c0',
            heading: 'At home',
            body: 'Four weeks before the ED, he hit the bedroom floor getting up to urinate at night. His wife found him in the morning — embarrassed, quiet, unchanged. They left with a cane and no scan. The man who balanced his own books began answering less; by the time his daughter noticed the glassy stare, the small strokes had already started peppering his brain.',
            visualHint:
              'Same 70-year-old Caucasian man at home — bedroom or living room, morning light, withdrawn on edge of bed or near fallen cane — casual home clothes or pajamas, NOT hospital gown, NOT stretcher',
          },
          {
            id: 'c1',
            heading: 'Disruption',
            body: 'His daughter brought him because he stopped answering. The man who used to balance his own books now stares through people as if the room were glass. Four weeks earlier he hit the bedroom floor getting up to urinate — they found him in the morning and left with a cane prescription, not a question.',
            visualHint:
              '70-year-old Caucasian man, daughter at ED triage doorway, withdrawn stare, hospital gown — third-person 3/4 oversight from beside stretcher, NOT bird-eye',
          },
          {
            id: 'c2',
            heading: 'Embodiment',
            body: 'In the bay he is cool and quiet, vitals deceptively soft. When you listen at the right carotid, the bruit is not subtle — a turbulent whisper that blood is negotiating a narrowing it should not have to.',
            visualHint:
              'Same man supine on ED stretcher, clinician-height 3/4 angle from foot of bed, stethoscope at right neck implied, monitor upper-right, muted clinical light',
          },
          {
            id: 'c3',
            heading: 'Escalation',
            body: 'CT head is clean, so hemorrhage does not explain the fog. Duplex names the stenosis. Telemetry catches atrial fibrillation in brief paroxysms — emboli looking for an exit. MRI with DWI shows the truth: the brain got peppered with tiny infarcts, scattered like grains on a plate.',
            visualHint:
              'Same likeness on stretcher, hospital gown open at chest — telemetry electrodes on BARE SKIN only (NOT over shirt); vitals monitor upper-right shows numeric HR, SpO2, and ECG waveform trace; secondary screen may hint DWI specks — third-person oversight angle unchanged',
          },
          {
            id: 'c4',
            heading: 'Crisis point',
            body: 'TIA is not a near miss — it is a neurological emergency with a clock. Ten to fifteen percent stroke risk in ninety days, highest in the first forty-eight hours. Dual antiplatelet therapy, high-intensity statin, admission — not because he looks sick now, but because the next shower may not be micro.',
            visualHint:
              'Same patient, admission paperwork on rail, dual antiplatelet implied, urgent but quiet bay — third-person 3/4 from foot of bed',
          },
          {
            id: 'c5',
            heading: 'Recontextualization',
            body: placed.length
              ? `With ${placed.slice(0, 4).join(', ')} on the board, the story shifts from "dad is depressed" to "dad was being stroked in slow motion." The family finally has a mechanism that matches the silence.`
              : 'The silence was never personality decay — it was perfusion failing in small bursts. Once the team names it, the room changes temperature.',
            visualHint:
              'Family at bedside in depth, patient same likeness, emotional relief mixed with fear — third-person oversight, room depth visible',
          },
        ]
      : is153
        ? [
            {
              id: 'c0',
              heading: 'Village party',
              body: "N'Gavu was out with friends from the village — beer all night, yellow jacket, nothing felt wrong. He drank like he always does after work.",
              visualHint:
                "N'Gavu in mustard-yellow party jacket with brown beer bottle, night party or pool hall — same face, NOT hospital gown",
            },
            {
              id: 'c1',
              heading: 'Disruption',
              body: "The next afternoon, walking home in the sun, his hands and face began to peel and blister. By evening he could not stand light on his forearms.",
              visualHint:
                "Same N'Gavu squinting in afternoon sun, yellow jacket, blistering forearms starting — outdoor village path",
            },
            {
              id: 'c2',
              heading: 'Embodiment',
              body: "In the ED he winces when the triage window lights his arms. He took off the yellow shirt for the gown — it hangs on the chair. His beer bottles are on the side table; he says they are his property.",
              visualHint:
                "N'Gavu supine in hospital gown on stretcher, mustard-yellow shirt on bedside chair, two beer bottles on overbed table, shields blistered forearms from window light",
            },
            {
              id: 'c3',
              heading: 'Escalation',
              body: 'Fragile bullae on sun-exposed skin, milia on the hands, darker patches and coarse hair on the dorsal hands — the pattern whispers porphyrin, not a simple sunburn.',
              visualHint:
                "Close on N'Gavu's blistered dorsal hands and forearms, same face visible, ED bay, monitor upper-right",
            },
            {
              id: 'c4',
              heading: 'Crisis point',
              body: 'If porphyrins keep building while orders wait, every photon through the glass keeps injuring skin — and alcohol may still be driving the trigger until you prove otherwise.',
              visualHint:
                "N'Gavu tense on stretcher, eyes toward bright window, beer bottles still on side table, clinical stress",
            },
            {
              id: 'c5',
              heading: 'Recontextualization',
              body: placed.length
                ? `With ${placed.slice(0, 4).join(', ')} on the board, the story shifts from "bad sunburn" to porphyria cutanea tarda — sun, alcohol, and a trigger you can treat.`
                : "The peeling was never just sun — porphyrins in skin, alcohol as trigger, light as the weapon. Name it and the pathway opens.",
              visualHint:
                "N'Gavu calmer in dimmed bay, yellow shirt still on chair, forearms settling, relief mixed with shame — wide bedside depth",
            },
          ]
      : is176
        ? [
            {
              id: 'c0',
              heading: 'The bite',
              body: 'He was walking home when a stray dog lunged at his forearm. He wrapped the arm in a shirt and came straight to the ED — the animal ran off, so nobody can say whether it was rabid.',
              visualHint:
                'Same subway-afro-dandy likeness in street clothes, urban evening, forearm wrapped in cloth, anxious but composed — NOT hospital gown, NOT stretcher',
            },
            {
              id: 'c1',
              heading: 'Arrival',
              body: 'He arrives tachycardic and hypotensive with a deep forearm puncture, spreading erythema, and hypoxia that reads like sepsis before you have cultures. The wound is not the only problem — perfusion and airway come first.',
              visualHint:
                'Subway-afro-dandy likeness on ED stretcher, forearm bite wound visible, hospital gown, monitor upper-right, IV upper-left — third-person 3/4 from foot of bed, clinical stress',
            },
            {
              id: 'c2',
              heading: 'Embodiment',
              body: 'On exam the punctures are deep with surrounding cellulitis — warm, tender, tracking erythema. You document the wound, tetanus status, and whether the animal can be traced before anyone reaches for empiric antibiotics without cultures.',
              visualHint:
                'Same likeness supine, forearm exposed with bite marks and cellulitis, trauma bay gown, clinician-height 3/4 angle from beside stretcher rail',
            },
            {
              id: 'c3',
              heading: 'Escalation',
              body: 'Stabilization and wound care run on one channel; tetanus and rabies prophylaxis run on another. Rabies antibodies alone do not replace immune globulin plus vaccine — and antibiotics before culture risk resistance when cellulitis is already declared.',
              visualHint:
                'Same likeness, forearm wound dressing visible, vitals monitor with tachycardia, wide establishing — patient right-third, room depth',
            },
            {
              id: 'c4',
              heading: 'Crisis point',
              body: 'If ABCs slip while the team debates prophylaxis, the case becomes about shock — not the dog. Two large-bore IVs, oxygen, cultures with debridement, and ID consult for rabies PEP must each land on the board in the right order.',
              visualHint:
                'Same patient lower third on stretcher, oxygen delivery implied, forearm wound in frame, urgent trauma bay — foreground rail occlusion',
            },
            {
              id: 'c5',
              heading: 'Recontextualization',
              body: placed.length
                ? `With ${placed.slice(0, 4).join(', ')} placed, the story shifts from "dog bite" to a bundled teaching case: acute stabilization, wound culture discipline, tetanus update, and rabies PEP when the animal cannot be ruled out.`
                : 'The bite was never just a laceration — it was sepsis risk, cellulitis, tetanus gap, and rabies exposure in one forearm. Naming each channel changes what the team orders next.',
              visualHint:
                'Same subway-afro-dandy likeness calmer on stretcher, dressed forearm, family or staff soft-focus mid-background — wide with depth, emotional relief mixed with vigilance',
            },
          ]
      : [
        {
          id: 'c1',
          heading: 'Presentation',
          body: `${caseData?.title || 'The patient'} arrives with ${caseData?.clinical_tip || caseData?.diagnosis || 'acute complaint'}. Vitals and exam drive the first moves.`,
        },
        {
          id: 'c2',
          heading: 'Your orders',
          body: placed.length
            ? `You placed: ${placed.join(', ')}. Each order shifts the trajectory.`
            : 'Standard flow orders define the path — compare what you placed to the teaching checklist.',
        },
      ];

  return {
    caseId: cid,
    title: is001 ? 'Chest under pressure' : is051 ? 'The Man Who Got Peppered' : is153 ? "The Man Who Burned in the Sun" : is176 ? 'The Bite That Would Not Wait' : caseData?.title || 'Case story',
    synopsis: is001
      ? 'Tension pneumothorax — a clinical diagnosis made at the bedside when breath sounds vanish and perfusion teeters.'
      : is051
        ? 'His family thought he stopped talking. The MRI showed his brain had been peppered with embolic showers — TIA on the clock, not a mood change.'
        : is153
          ? "N'Gavu partied with his village, drank in the sun, and woke to skin that blisters in daylight — porphyria cutanea tarda, not a sunburn he can shrug off."
          : is176
          ? 'A stray-dog forearm bite arrives septic and hypoxic — cellulitis, tetanus, and rabies prophylaxis each demand their own channel after ABCs.'
          : String(caseData?.diagnosis || caseData?.clinical_tip || caseData?.title || '').slice(0, 280),
    chapters,
    patientLock,
    masterImagePrompt: is001
      ? 'Adult male supine on ED stretcher, severe respiratory distress, diaphoretic, accessory muscle use — third-person 3/4 view from beside bed, monitor glow, NOT overhead bird-eye'
      : is051
        ? '70-year-old Caucasian man supine on ED stretcher, withdrawn gaze, hospital gown — third-person 3/4 clinical oversight from foot of bed, monitor upper-right, family tension implied in room depth, NOT bird-eye'
        : is153
          ? "N'Gavu supine on ED stretcher, hospital gown, blistered forearms, mustard-yellow shirt on bedside chair, beer bottles on overbed table — third-person 3/4 from foot of bed, window light dimmed, MeWorld sculptural CGI"
          : is176
          ? 'Young Black man subway-afro-dandy likeness supine on ED trauma stretcher, large heart-shaped afro, light blue hospital gown, forearm animal bite wound with cellulitis visible — third-person 3/4 from foot of bed, monitor upper-right, clinical stress, NOT bird-eye'
        : `Patient on ED stretcher, third-person clinical oversight angle, ${caseData?.title || 'case'} presentation`,
    orders,
    source: 'offline',
    masterImageUrl: null,
  };
}

export async function fetchCaseStory({
  caseData,
  sessionContext = {},
  portraitNote = '',
  medicalSequence = null,
  refresh = false,
  generateImage = false,
  imageOnly = false,
} = {}) {
  if (!caseData?.id) throw new Error('Missing case');
  const offline = buildCaseStoryOffline(caseData, { sessionContext });
  const sessionFingerprint = caseStorySessionFingerprint(sessionContext);

  try {
    const res = await fetch(apiUrl('/api/case-story'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseData.id,
        caseContext: buildCaseChatContext(caseData, { chatMode: 'tutor' }),
        sessionContext,
        orders: offline.orders,
        medicalSequence,
        portraitNote,
        sessionFingerprint,
        refresh: refresh || imageOnly,
        generateImage,
        imageOnly,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (imageOnly) {
      return {
        masterImageUrl: data.masterImageUrl || null,
        imageGen: data.imageGen !== false,
      };
    }

    if (data.staleSession && !refresh) {
      // Session changed but cached narrative is still valid — do not auto-recompile in a loop.
      data.cached = true;
    }

    const merged = {
      ...offline,
      title: data.title || offline.title,
      synopsis: data.synopsis || offline.synopsis,
      chapters: data.chapters?.length ? data.chapters : offline.chapters,
      patientLock: data.patientLock || offline.patientLock,
      masterImagePrompt: data.masterImagePrompt || offline.masterImagePrompt,
      masterImageUrl: data.masterImageUrl || null,
      oversightBeatId: data.oversightBeatId || null,
      oversightSource: data.oversightSource || null,
      sessionFingerprint: data.sessionFingerprint || sessionFingerprint,
      source: data.cached ? 'cache' : 'api',
      needsSessionRefresh: Boolean(data.staleSession && !refresh),
      readiness: data.readiness || null,
      lateralityOk: data.lateralityOk,
      lateralityIssues: data.lateralityIssues || [],
    };
    if (!storyNarrativeMatchesCase(caseData.id, merged)) {
      return mergeCaseStoryWithOverride(
        { ...offline, source: 'offline-canonical' },
        caseData.id,
      );
    }
    return mergeCaseStoryWithOverride(merged, caseData.id);
  } catch {
    return mergeCaseStoryWithOverride(offline, caseData.id);
  }
}

export async function fetchCaseStoryMasterImage({
  caseData,
  sessionContext = {},
  portraitNote = '',
  refresh = false,
} = {}) {
  return fetchCaseStory({
    caseData,
    sessionContext,
    portraitNote,
    refresh,
    generateImage: true,
    imageOnly: true,
  });
}

export async function fetchCaseStoryStoryboard({
  caseData,
  chapters = [],
  patientLock = '',
  portraitNote = '',
  refresh = false,
  generateImages = false,
} = {}) {
  if (!caseData?.id) throw new Error('Missing case');
  const res = await fetch(apiUrl('/api/case-story-storyboard'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseId: caseData.id,
      caseContext: buildCaseChatContext(caseData, { chatMode: 'tutor' }),
      chapters,
      patientLock,
      portraitNote,
      refresh,
      generateImages,
      gridPlate: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Markdown export for offline review (prose + storyboard captions). */
export function formatCaseStoryExportMarkdown(story, caseData = {}) {
  const cid = caseData?.ccsNumber ?? caseData?.id ?? '';
  const title = story?.title || caseData?.title || 'Case story';
  const lines = [
    `# Case ${cid} — ${title}`,
    '',
    story?.synopsis ? `${story.synopsis}\n` : '',
    ...(story?.chapters || []).map((ch, i) => {
      const head = ch.heading || `Scene ${i + 1}`;
      return `## ${head}\n\n${ch.body || ''}${ch.visualHint ? `\n\n_Visual: ${ch.visualHint}_` : ''}\n`;
    }),
    story?.source ? `\n---\n_Source: ${story.source}_` : '',
  ];
  return lines.filter((l) => l !== undefined).join('\n').trim();
}

export function downloadCaseStoryMarkdown(story, caseData) {
  const md = formatCaseStoryExportMarkdown(story, caseData);
  const cid = String(caseData?.ccsNumber ?? caseData?.id ?? 'case').padStart(3, '0');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `case-${cid}-story.md`;
  a.click();
  URL.revokeObjectURL(url);
}
