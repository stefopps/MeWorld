import playbookBundle from '../data/orderWhyPlaybook.json' with { type: 'json' };
import realWorldBundle from '../data/realWorldCasesBaked.json' with { type: 'json' };
import { apiUrl } from './apiBase.js';
import { buildCaseChatContext } from './caseChat.js';
import { resolvePatientDemographics } from './patientFactsFromHpi.js';
import {
  sequenceFailsDemographicsCheck,
  validateMedicalSequenceDemographics,
} from './medicalSequenceValidate.js';
import { isCanonicalCaseStory, storyNarrativeMatchesCase } from './caseStoryCanonical.js';
import { mapOrderToMissedBeat, mapOrderToSavedBeat } from './medicalSequenceConsequences.js';

export { validateMedicalSequenceDemographics, sequenceFailsDemographicsCheck };

function normalizeCaseId(caseId) {
  const raw = String(caseId ?? '').trim();
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

function playbookWhy(caseId, orderId) {
  const ck = normalizeCaseId(caseId);
  return playbookBundle?.cases?.[ck]?.[orderId]?.why || '';
}

/** Extract "X before Y" / progression language from attendant text. */
export function extractDeteriorationPhrases(whyText = '') {
  const text = String(whyText || '');
  const phrases = [];
  const prog = text.match(
    /(?:before\s+it\s+progresses?\s+to\s+)([^.]+)/i,
  );
  if (prog?.[1]) {
    prog[1]
      .split(/\s+or\s+|,\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((p) => phrases.push(p));
  }
  const subtle = text.match(
    /(?:present(?:s)?\s+(?:subtly\s+)?as\s+)([^.]+?)(?:\s+before)/i,
  );
  if (subtle?.[1]) phrases.unshift(subtle[1].trim());
  return [...new Set(phrases)];
}

function collectOrders(caseData) {
  const list = Array.isArray(caseData?.interventions) ? caseData.interventions : [];
  const cid = normalizeCaseId(caseData?.id);
  return list.map((iv) => ({
    id: iv.id,
    label: iv.label,
    why: String(iv.why || playbookWhy(cid, iv.id) || '').trim(),
    guideline: iv.guideline || '',
  }));
}

function realWorldForCase(caseId) {
  const ck = normalizeCaseId(caseId);
  return realWorldBundle?.byCaseId?.[ck]?.stories || realWorldBundle?.[ck]?.stories || [];
}

function isDrowningCase(caseData, blob = '') {
  const b =
    blob ||
    `${caseData?.title || ''} ${caseData?.diagnosis || ''} ${caseData?.presentationKey || ''} ${caseData?.hpi_narrative || ''}`.toLowerCase();
  return /drown|submersion|near-drown|water rescue|wet lung|surfactant washout/.test(b);
}

function isAmsTemplateCase(caseData, blob = '') {
  if (isDrowningCase(caseData, blob)) return false;
  const b =
    blob ||
    `${caseData?.title || ''} ${caseData?.diagnosis || ''} ${caseData?.hpi_narrative || ''}`.toLowerCase();
  return /altered mental|seizure|post.?ictal|ams\b|confusion/.test(b);
}

/** Drowning / submersion — pediatric or adult; never AMS/alcohol template. */
function buildDrowningMedicalSequence(caseData, { enrichedWhys = {} } = {}) {
  const cid = normalizeCaseId(caseData?.id);
  const demo = resolvePatientDemographics(caseData);
  const orders = collectOrders(caseData).map((o) => ({
    ...o,
    why: enrichedWhys[o.id] || o.why,
  }));

  const isPed = demo.isPediatric || /pediatric/i.test(caseData?.category || '');
  const patientLock = isPed
    ? `school-age child (~8–10), ${caseData?.patientSex === 'female' ? 'girl' : 'boy'}, wet hair, hospital gown, drowning — same likeness throughout`
    : `${demo.ageLabel || 'adult'}, drowning after submersion — same likeness throughout`;

  const by = (re) => orders.find((o) => re.test(o.label) || re.test(o.id));
  const airway = by(/abcs|oxygen|airway|bvm|intubat/i);
  const cspine = by(/c-spine|cervical|collar/i);
  const cxr = by(/cxr|chest x/i);
  const abg = by(/abg|arterial blood/i);
  const rewarm = by(/rewarm|hypotherm/i);
  const observe = by(/observation|admit|monitor/i);

  const stories = realWorldForCase(cid);
  const echo = stories[0]
    ? { name: stories[0].name, summary: String(stories[0].summary || stories[0].headline || '').slice(0, 280) }
    : null;

  return {
    caseId: cid,
    title: caseData?.title || 'Drowning',
    source: 'offline',
    patientLock,
    orders,
    prequel: [
      {
        id: 'p1',
        title: isPed ? 'Dock or pool' : 'Before rescue',
        caption: isPed
          ? 'Child jumps or slips into water — seconds underwater, then rescue with coughing and confusion.'
          : 'Submersion event — bystanders pull the patient from the water; cough, foam at the lips, altered responsiveness.',
        visualHint: `${patientLock}, water at edge of frame, urgency, same child face`,
      },
      {
        id: 'p2',
        title: 'EMS arrival',
        caption:
          'High-flow oxygen en route; wet clothes, backboard if jump mechanism — C-spine precautions begin in the field.',
        visualHint: `${patientLock}, ambulance or ED doors, oxygen mask, wet towels`,
      },
    ],
    missedPath: [
      {
        id: 'm1',
        title: 'Airway not secured',
        caption: airway
          ? `Without ${airway.label}, hypoxia worsens — surfactant washout and aspiration drive brain injury.`
          : 'Delayed airway support — hypoxia compounds pulmonary injury.',
        visualHint: `${patientLock}, ED stretcher, hypoxia, monitor alarm`,
        tiedOrderId: airway?.id || '',
        tiedOrderLabel: airway?.label || 'ABCs / Oxygen / Airway',
      },
      {
        id: 'm2',
        title: 'C-spine ignored',
        caption: cspine
          ? `Jump or dive mechanism — skipping ${cspine.label} risks secondary cord injury from axial load at water impact.`
          : 'No cervical immobilization after diving/jump mechanism.',
        visualHint: `${patientLock}, collar absent, team moving patient unsafely`,
        tiedOrderId: cspine?.id || '',
        tiedOrderLabel: cspine?.label || 'C-spine precautions',
      },
      {
        id: 'm3',
        title: 'Sent home too soon',
        caption: observe
          ? `Without ${observe.label}, delayed pulmonary edema after a lucid interval can be fatal.`
          : 'Discharged after brief improvement — lungs re-injure with surfactant loss.',
        visualHint: `${patientLock}, hallway discharge — wrong decision`,
        tiedOrderId: observe?.id || '',
        tiedOrderLabel: observe?.label || 'Observation',
      },
    ],
    savedPath: [
      {
        id: 's1',
        title: 'Airway & oxygen',
        caption: String(airway?.why || 'Oxygenation restores perfusion while lungs recover from surfactant washout.').slice(0, 220),
        visualHint: `${patientLock}, oxygen mask or BVM, team at head of bed`,
        tiedOrderId: airway?.id || '',
        tiedOrderLabel: airway?.label || 'Airway',
      },
      {
        id: 's2',
        title: 'C-spine & imaging',
        caption: [cspine?.label, cxr?.label].filter(Boolean).join(' + ') || 'Immobilize neck; CXR shows aspiration edema.',
        visualHint: `${patientLock}, cervical collar, portable CXR or monitor`,
        tiedOrderId: cxr?.id || cspine?.id || '',
        tiedOrderLabel: cxr?.label || cspine?.label || 'Workup',
      },
      {
        id: 's3',
        title: 'ABG & observation',
        caption: [abg?.label, rewarm?.label, observe?.label].filter(Boolean).join(' · ') || 'Quantify hypoxemia; admit for delayed edema watch.',
        visualHint: `${patientLock}, PICU or obs unit, calmer monitoring`,
        tiedOrderId: observe?.id || abg?.id || '',
        tiedOrderLabel: observe?.label || 'Observation',
      },
    ],
    realWorldEcho: echo,
  };
}

function isPoorFeedingPediatricCase(caseData, cid) {
  if (cid === '121') return true;
  const demo = resolvePatientDemographics(caseData);
  if (!demo.isPediatric) return false;
  const blob = `${caseData?.presentationKey || ''} ${caseData?.title || ''} ${caseData?.hpi_narrative || ''}`.toLowerCase();
  return /poor feeding|failure to thrive|ftt|feeding difficulty/.test(blob);
}

/** Case 153 — N'Gavu · PCT · village party → sun blistering */
function buildNgavuPorphyriaSequence(caseData, { enrichedWhys = {}, orders = [] } = {}) {
  const cid = normalizeCaseId(caseData?.id);
  const orderList = orders.length
    ? orders
    : collectOrders(caseData).map((o) => ({ ...o, why: enrichedWhys[o.id] || o.why }));

  const patientLock =
    caseData?.portraitNote ||
    "N'Gavu — young Black man, mustard-yellow party jacket likeness, thin mustache, hospital gown on ED stretcher — same likeness throughout";

  const stories = realWorldForCase(cid);
  const echo = stories[0]
    ? { name: stories[0].name, summary: String(stories[0].summary || stories[0].headline || '').slice(0, 280) }
    : null;

  return {
    caseId: cid,
    title: caseData?.title || "N'Gavu — Skin Lesions",
    source: 'offline',
    patientLock,
    orders: orderList,
    prequel: [
      {
        id: 'p1',
        title: 'Village party',
        caption:
          "N'Gavu drinks with friends from the village — beer all night, yellow jacket, laughter. He thinks nothing of it.",
        visualHint:
          "MCU: N'Gavu in mustard-yellow party jacket holding brown beer bottle, pool-hall or outdoor party — same face, night lights, NOT hospital",
      },
      {
        id: 'p2',
        title: 'Afternoon sun',
        caption:
          'Walking home the next day, his hands and face begin to peel and blister in the sun — the first time the light feels like fire.',
        visualHint:
          "Wide: same N'Gavu in yellow jacket squinting in harsh afternoon sun, forearms reddening, village path — NOT ED",
      },
      {
        id: 'p3',
        title: 'ED arrival',
        caption:
          'He takes off the yellow shirt for the gown — the shirt hangs on the chair; his beer bottles sit on the side table. Light through the window still hurts.',
        visualHint:
          "ED bay: N'Gavu in hospital gown on stretcher, mustard-yellow shirt draped on bedside chair, two brown beer bottles on overbed table, blistered forearms shielded from window — MeWorld sculptural CGI",
      },
    ],
    missedPath: orderList.slice(0, 5).map((o, i) => mapOrderToMissedBeat(o, i)),
    savedPath: orderList.slice(0, 5).map((o, i) => mapOrderToSavedBeat(o, i)),
    realWorldEcho: echo,
  };
}

/** Case-specific offline beats (not the case-121 peds template). */
function buildMedicalSequenceFromCase(caseData, { enrichedWhys = {} } = {}) {
  const cid = normalizeCaseId(caseData?.id);
  const demo = resolvePatientDemographics(caseData);
  const orders = collectOrders(caseData).map((o) => ({
    ...o,
    why: enrichedWhys[o.id] || o.why,
  }));

  const patientLock = `${demo.ageLabel || 'adult patient'}, ${caseData?.patientSex || 'patient'}, ${caseData?.category || 'ED'} — same patient likeness throughout`;
  const title = String(caseData?.title || '');
  const diagnosis = String(caseData?.diagnosis || '');
  const hpi = String(caseData?.hpi_narrative || caseData?.history || '');
  const blob = `${title} ${diagnosis} ${hpi}`.toLowerCase();

  const stories = realWorldForCase(cid);
  const echo = stories[0]
    ? { name: stories[0].name, summary: String(stories[0].summary || stories[0].headline || '').slice(0, 280) }
    : null;

  const tieOrder = (idx) => orders[idx] || orders[0];

  if (cid === '153') {
    return buildNgavuPorphyriaSequence(caseData, { enrichedWhys, orders });
  }

  if (isDrowningCase(caseData, blob)) {
    return buildDrowningMedicalSequence(caseData, { enrichedWhys });
  }

  if (isAmsTemplateCase(caseData, blob)) {
    const tox = orders.find((o) => /tox|alcohol|acetaminophen/i.test(o.label));
    const glucose = orders.find((o) => /glucose|bmp|cbc/i.test(o.label));
    const ct = orders.find((o) => /ct|mri|head/i.test(o.label));
    const neuro = orders.find((o) => /neuro|psych/i.test(o.label));

    return {
      caseId: cid,
      title: caseData?.title || 'Medical sequence',
      source: 'offline',
      patientLock,
      orders,
      prequel: [
        {
          id: 'p1',
          title: 'Weeks of decline',
          caption:
            'Family reports progressive confusion, unsteady gait, and personality change over several weeks — not a single sudden event.',
          visualHint: `${patientLock}, home living room, spouse or adult child concerned, same face`,
        },
        {
          id: 'p2',
          title: 'Seizure & EMS',
          caption:
            'A witnessed generalized seizure leaves him post-ictal. Tongue injury and incontinence may be present. EMS brings him to the ED.',
          visualHint: `${patientLock}, stretcher, post-ictal drowsiness, ED arrival`,
        },
      ],
      missedPath: [
        {
          id: 'm1',
          title: 'Structural cause not excluded',
          caption: ct
            ? `Without ${ct.label}, bleed or mass stays on the table while you chase metabolic causes.`
            : 'Delayed neuro imaging leaves structural causes unexcluded.',
          visualHint: `${patientLock}, ED stretcher, monitor, same likeness`,
          tiedOrderId: ct?.id || '',
          tiedOrderLabel: ct?.label || 'CT head',
        },
        {
          id: 'm2',
          title: 'Metabolic/tox drivers missed',
          caption: glucose
            ? `${glucose.label} and tox screen not done — reversible causes stay hidden.`
            : 'Bedside glucose and tox screen not done — reversible causes stay hidden.',
          visualHint: `${patientLock}, confused affect, dim room light`,
          tiedOrderId: glucose?.id || tox?.id || '',
          tiedOrderLabel: glucose?.label || tox?.label || 'Labs',
        },
        {
          id: 'm3',
          title: 'Alcohol use minimized',
          caption:
            'He denies heavy drinking at first — attendant teaching: patients often minimize until labs contradict the story.',
          visualHint: `${patientLock}, interview posture, defensive calm`,
          tiedOrderId: tox?.id || '',
          tiedOrderLabel: tox?.label || 'Toxicology screen',
        },
      ],
      savedPath: [
        {
          id: 's1',
          title: 'Neuro exam & imaging',
          caption: neuro
            ? `${neuro.label} documents post-ictal state; ${ct?.label || 'head imaging'} rules out mass/bleed.`
            : 'Exam and head imaging narrow the differential.',
          visualHint: `${patientLock}, tongue laceration if present, same face`,
          tiedOrderId: neuro?.id || ct?.id || '',
          tiedOrderLabel: neuro?.label || ct?.label || 'Workup',
        },
        {
          id: 's2',
          title: 'Labs & tox screen',
          caption: 'CBC, BMP, glucose, and tox screen hunt metabolic and toxic drivers for AMS.',
          visualHint: `${patientLock}, IV line, calmer monitoring`,
          tiedOrderId: glucose?.id || tox?.id || '',
          tiedOrderLabel: 'Laboratory panel',
        },
      ],
      realWorldEcho: echo,
    };
  }

  const chief = caseData?.chief_complaint || title;
  return {
    caseId: cid,
    title: caseData?.title || 'Medical sequence',
    source: 'offline',
    patientLock,
    orders,
    prequel: [
      {
        id: 'p1',
        title: 'Before arrival',
        caption: `Symptoms worsen at home: ${chief}. ${demo.parentMayBePresent ? 'Caregiver' : 'Family or patient'} decides to come to the ED.`,
        visualHint: `${patientLock}, home or car, urgency, same likeness`,
      },
    ],
    missedPath: orders.slice(0, 5).map((o, i) => mapOrderToMissedBeat(o, i)),
    savedPath: orders.slice(0, 5).map((o, i) => mapOrderToSavedBeat(o, i)),
    realWorldEcho: echo,
  };
}

/** Offline storyboard for case 121 — poor feeding pediatric template only. */
function buildPoorFeedingPediatricSequence(caseData, { enrichedWhys = {} } = {}) {
  const cid = normalizeCaseId(caseData?.id);
  const demo = resolvePatientDemographics(caseData);
  const orders = collectOrders(caseData).map((o) => ({
    ...o,
    why: enrichedWhys[o.id] || o.why,
  }));

  const patientLock =
    cid === '121'
      ? '~7yo Black school-age boy, pediatric hospital gown, ED resuscitation bay — case 121 approved likeness'
      : `${demo.ageLabel || 'pediatric patient'}, ${caseData?.category || 'ED'} — same patient likeness throughout`;

  const glucose = orders.find((o) => o.id === 'glucose-check');
  const glucoseWhy =
    enrichedWhys['glucose-check'] ||
    glucose?.why ||
    'Hypoglycemia can present as lethargy or poor feeding before seizures or coma.';
  const prog = extractDeteriorationPhrases(glucoseWhy);

  const prequel = [
    {
      id: 'p1',
      title: 'Poor feeding at home',
      caption:
        'For several days he takes less at each feed. Mom notices fewer wet diapers and a quieter baby.',
      visualHint: `${patientLock}, kitchen table, worried mother, child in lap turning away from bottle`,
    },
    {
      id: 'p2',
      title: 'Morning lethargy',
      caption: 'He is hard to wake and limp in mom\'s arms. She brings him to the emergency department.',
      visualHint: `${patientLock}, car seat or home doorway, caregiver urgency, soft morning light`,
    },
  ];

  const missedPath = [
    {
      id: 'm1',
      title: 'ED — weak and tachycardic',
      caption: `Arrives with poor feeding and vitals already stressed. Brain fuel is the immediate concern.`,
      visualHint: `${patientLock}, ED stretcher, monitor leads, tired eyes`,
      tiedOrderId: '',
      tiedOrderLabel: 'Triage',
    },
    {
      id: 'm2',
      title: 'Glucose not checked',
      caption: `Without a bedside glucose, ${prog[0] || 'lethargy'} is mistaken for "just not eating."`,
      visualHint: `${patientLock}, stretcher, no glucometer in frame, nurse at foot of bed`,
      tiedOrderId: 'glucose-check',
      tiedOrderLabel: glucose?.label || 'glucose check',
    },
    {
      id: 'm3',
      title: 'Hypoglycemia deepens',
      caption:
        prog.length > 1
          ? `Energy stores fall further — ${prog.slice(0, 2).join(', then ')}.`
          : 'Energy stores fall — lethargy deepens and suck-swallow-breathe weakens.',
      visualHint: `${patientLock}, same likeness, eyes less responsive, monitor alarm glow`,
      tiedOrderId: 'glucose-check',
      tiedOrderLabel: 'glucose check',
    },
    {
      id: 'm4',
      title: prog[prog.length - 1] || 'Seizure risk',
      caption: String(glucoseWhy).includes('seizure')
        ? 'Untreated hypoglycemia can progress to seizures — a metabolic emergency, not a feeding problem alone.'
        : 'Metabolic decompensation escalates without IV access and correction.',
      visualHint: `${patientLock}, same likeness, clinical crisis framing, team rushing`,
      tiedOrderId: 'iv-access-x2',
      tiedOrderLabel: 'IV access x2',
    },
  ];

  const savedPath = [
    {
      id: 's1',
      title: 'Bedside glucose',
      caption:
        'A quick glucose check shows low fuel — you treat a metabolic emergency, not a vague feeding complaint.',
      visualHint: `${patientLock}, glucometer at bedside, relieved focus`,
      tiedOrderId: 'glucose-check',
      tiedOrderLabel: 'glucose check',
    },
    {
      id: 's2',
      title: 'IV access & dextrose',
      caption: 'Two large-bore lines and dextrose restore brain fuel; perfusion and alertness improve.',
      visualHint: `${patientLock}, IV established, same face, warmer skin tone`,
      tiedOrderId: 'iv-access-x2',
      tiedOrderLabel: 'IV access x2',
    },
    {
      id: 's3',
      title: 'Stabilized for workup',
      caption: 'With stabilization, history, exam, and labs can safely hunt FTT, GERD, or metabolic causes.',
      visualHint: `${patientLock}, calmer affect, parent at bedside, ED bay`,
      tiedOrderId: 'obtain-a-thorough-history-including-feed',
      tiedOrderLabel: 'History',
    },
  ];

  const stories = realWorldForCase(cid);
  const echo =
    stories.find((s) => /jessica|congenital adrenal|hypoglycemia/i.test(`${s.name} ${s.summary}`))
    || stories.find((s) => /poor feeding|hypoglycemia|infant/i.test(s.summary || ''))
    || stories[0];

  return {
    caseId: cid,
    title: caseData?.title || 'Medical sequence',
    source: 'offline',
    patientLock,
    orders,
    prequel,
    missedPath,
    savedPath,
    realWorldEcho: echo
      ? { name: echo.name, summary: String(echo.summary || echo.headline || '').slice(0, 280) }
      : null,
  };
}

function isWrongAmsBleedIntoDrowning(merged, caseData) {
  if (!isDrowningCase(caseData)) return false;
  const beats = [...(merged?.prequel || []), ...(merged?.missedPath || []), ...(merged?.savedPath || [])];
  const text = beats.map((b) => `${b.title || ''} ${b.caption || ''} ${b.visualHint || ''}`).join(' ').toLowerCase();
  return /alcohol|tox screen|toxicology|weeks of decline|seizure|post.?ictal|metabolic\/tox|personality change/.test(
    text,
  );
}

export function buildMedicalSequenceOffline(caseData, { enrichedWhys = {} } = {}) {
  const cid = normalizeCaseId(caseData?.id);
  if (isPoorFeedingPediatricCase(caseData, cid)) {
    return buildPoorFeedingPediatricSequence(caseData, { enrichedWhys });
  }
  return buildMedicalSequenceFromCase(caseData, { enrichedWhys });
}

export async function fetchMedicalSequence({
  caseData,
  enrichedWhys = {},
  portraitNote = '',
  refresh = false,
} = {}) {
  if (!caseData?.id) throw new Error('Missing case');
  const offline = buildMedicalSequenceOffline(caseData, { enrichedWhys });

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return offline;
  }

  const orders = offline.orders.map((o) => ({
    id: o.id,
    label: o.label,
    why: enrichedWhys[o.id] || o.why,
    playbookWhy: o.why,
  }));

  try {
    const res = await fetch(apiUrl('/api/medical-sequence'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId: caseData.id,
        caseContext: buildCaseChatContext(caseData, { chatMode: 'tutor' }),
        orders,
        realWorldStories: realWorldForCase(caseData.id),
        portraitNote,
        refresh,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const merged = {
      caseId: normalizeCaseId(caseData.id),
      title: caseData.title,
      source: data.cached ? 'cache' : 'api',
      patientLock: data.patientLock || offline.patientLock,
      orders,
      prequel: data.prequel?.length ? data.prequel : offline.prequel,
      missedPath: data.missedPath?.length ? data.missedPath : offline.missedPath,
      savedPath: data.savedPath?.length ? data.savedPath : offline.savedPath,
      realWorldEcho: data.realWorldEcho || offline.realWorldEcho,
    };
    if (isWrongAmsBleedIntoDrowning(merged, caseData)) {
      console.warn('[medical-sequence] Stale AMS template in drowning case — using offline drowning beats');
      return { ...offline, orders, source: 'offline-drowning-fix' };
    }
    if (sequenceFailsDemographicsCheck(merged, caseData)) {
      console.warn(
        '[medical-sequence] API/cache failed age check — using offline',
        validateMedicalSequenceDemographics(merged, caseData),
      );
      return { ...offline, orders, source: 'offline-validated' };
    }
    if (isCanonicalCaseStory(caseData.id) && !storyNarrativeMatchesCase(caseData.id, {
      title: merged.title,
      synopsis: merged.patientLock,
      patientLock: merged.patientLock,
      chapters: [
        ...(merged.prequel || []).map((b) => ({ body: b.caption, heading: b.title })),
        ...(merged.missedPath || []).map((b) => ({ body: b.caption, heading: b.title })),
      ],
    })) {
      console.warn('[medical-sequence] Wrong template for canonical case — using offline');
      return { ...offline, orders, source: 'offline-canonical' };
    }
    return merged;
  } catch {
    return offline;
  }
}
