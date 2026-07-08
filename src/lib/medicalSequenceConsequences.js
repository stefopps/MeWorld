/**
 * Patient-consequence beats for Medical Sequence — NOT generic likeness stubs.
 * Missed path = what worsens at the bedside while the order waits.
 * Saved path = what improves when the order lands on time.
 */
import { extractDeteriorationPhrases } from './medicalSequence.js';

const GAME_STYLE_TAIL =
  'MeWorld sculptural 3D CGI clinical still — muted palette, same patient likeness, smart camera angle for this moment only.';

function norm(s) {
  return String(s || '').toLowerCase();
}

function orderBlob(label = '', why = '') {
  return `${norm(label)} ${norm(why)}`;
}

/** Missed-path caption — patient-centered, mechanism not memorization. */
export function buildMissedCaption(order = {}) {
  const label = String(order.label || order.tiedOrderLabel || 'this order').trim();
  const why = String(order.why || '').trim();
  const blob = orderBlob(label, why);

  if (/urine.*porphyrin|uroporphyrin/i.test(blob)) {
    return 'Porphyrins keep accumulating in the skin — blisters near the window stay angry; light still hurts while the sample waits.';
  }
  if (/plasma.*porphyrin/i.test(blob)) {
    return 'Circulating porphyrin load keeps building — the diagnostic peak you need is still not captured.';
  }
  if (/hcv|hiv|iron|ferritin|hepatitis/i.test(blob)) {
    return 'The rash looks like the whole story — but a silent infection or iron overload trigger can stay hidden until you screen.';
  }
  if (/glucose|dextrose|hypoglyc/i.test(blob)) {
    return 'Brain fuel keeps falling — lethargy deepens while nobody checks the number at the bedside.';
  }
  if (/c-spine|cervical|collar/i.test(blob)) {
    return 'Neck movement continues unchecked — one wrong turn can convert a jump into a cord injury.';
  }
  if (/oxygen|airway|abg|intubat/i.test(blob)) {
    return 'Hypoxia keeps climbing — work of breathing worsens while the airway plan waits.';
  }
  if (/ct|mri|imaging|cxr|x-ray|ultrasound/i.test(blob)) {
    return 'The team treats shadows without the picture — reversible causes stay invisible while imaging waits.';
  }

  const prog = extractDeteriorationPhrases(why);
  if (prog.length >= 2) {
    return `Without ${label}, ${prog[0]} — then ${prog[1]}.`;
  }
  if (prog.length === 1) {
    return `While ${label} waits, ${prog[0]} keeps progressing.`;
  }
  if (why.length > 40) {
    return `While ${label} waits: ${why.slice(0, 180).replace(/\s+/g, ' ').trim()}`;
  }
  return `The underlying process does not pause — ${label} is still not done, and the patient carries the consequence at the bedside.`;
}

/** Saved-path caption — improvement the learner can see. */
export function buildSavedCaption(order = {}) {
  const label = String(order.label || order.tiedOrderLabel || 'this order').trim();
  const why = String(order.why || '').trim();
  const blob = orderBlob(label, why);

  if (/urine.*porphyrin|uroporphyrin/i.test(blob)) {
    return 'Urinary porphyrins trend down — blistering eases once the pathway is named and treated.';
  }
  if (/plasma.*porphyrin/i.test(blob)) {
    return 'Plasma porphyrin peak is captured — diagnosis locks; sun avoidance and trigger treatment can start.';
  }
  if (/hcv|hiv|iron|ferritin|hepatitis/i.test(blob)) {
    return 'Screening finds the trigger — iron overload or infection can be treated, not just the skin.';
  }
  if (/glucose|dextrose/i.test(blob)) {
    return 'Bedside glucose is checked and corrected — alertness and perfusion improve within minutes.';
  }
  if (/iv|fluid|resuscit/i.test(blob)) {
    return 'Access and fluids restore perfusion — vitals steady and the workup can proceed safely.';
  }

  if (why.length > 30) {
    return `${label} completed on time — ${why.slice(0, 160).replace(/\s+/g, ' ').trim()}`;
  }
  return `${label} lands on time — the patient stabilizes enough for the rest of the workup.`;
}

const CAMERA_VARIANTS = [
  'MCU on face and hands — patient reaction',
  'wide three-quarter from foot of bed — room depth',
  'over-shoulder from clinician POV toward patient — no standing feet in frame',
  'close on affected body region — patient still identifiable',
  'profile at bedside — monitor glow in background',
  'low angle from stretcher rail — emotional weight',
];

/** Visual hint for missed beat — what the patient looks like RIGHT NOW. */
export function buildMissedVisualHint(order = {}, { index = 0, setting = 'ED bay' } = {}) {
  const label = String(order.label || '').trim();
  const why = String(order.why || '').trim();
  const blob = orderBlob(label, why);
  const cam = CAMERA_VARIANTS[index % CAMERA_VARIANTS.length];

  let moment = '';
  if (/urine.*porphyrin|uroporphyrin/i.test(blob)) {
    moment =
      'patient shields blistered forearms from overhead light, winces near exam-room window — porphyrins still accumulating in skin';
  } else if (/plasma.*porphyrin/i.test(blob)) {
    moment =
      'same patient tense on stretcher, hands curled, waiting — circulating porphyrin burden still rising, diagnostic sample not drawn';
  } else if (/hcv|hiv|iron|ferritin/i.test(blob)) {
    moment =
      'patient on stretcher, skin lesions visible but team focused on rash only — silent infection or iron overload still unchecked';
  } else if (/glucose/i.test(blob)) {
    moment = 'lethargic patient, no glucometer in frame, parent or nurse worried at bedside';
  } else if (/oxygen|airway/i.test(blob)) {
    moment = 'patient labored breathing, SpO2 dropping on monitor, no definitive airway action yet';
  } else {
    const prog = extractDeteriorationPhrases(why);
    moment = prog[0]
      ? `patient visibly worsening — ${prog[0]}`
      : `clinical stress visible — ${label} not yet done`;
  }

  return `${cam}: ${moment}, ${setting}. ${GAME_STYLE_TAIL}`;
}

/** Visual hint for saved beat — visible improvement. */
export function buildSavedVisualHint(order = {}, { index = 0, setting = 'ED bay' } = {}) {
  const label = String(order.label || '').trim();
  const blob = orderBlob(label, order.why);
  const cam = CAMERA_VARIANTS[(index + 2) % CAMERA_VARIANTS.length];

  let moment = '';
  if (/urine.*porphyrin|uroporphyrin/i.test(blob)) {
    moment = 'patient calmer in dimmed bay, blistering settling, porphyrin pathway addressed';
  } else if (/plasma.*porphyrin/i.test(blob)) {
    moment = 'relief at bedside — diagnostic porphyrin peak captured, treatment plan forming';
  } else if (/hcv|hiv|iron|ferritin/i.test(blob)) {
    moment = 'team reviews positive screen with patient — trigger identified, not just skin treated';
  } else if (/glucose/i.test(blob)) {
    moment = 'glucometer at bedside, patient more alert, color improving';
  } else if (/iv|fluid/i.test(blob)) {
    moment = 'IV running, vitals stabilizing on monitor, patient breathing easier';
  } else {
    moment = `${label} done — patient visibly more stable, team moving to next step`;
  }

  return `${cam}: ${moment}, ${setting}. ${GAME_STYLE_TAIL}`;
}

export function mapOrderToMissedBeat(order, i) {
  return {
    id: `m${i + 1}`,
    title: `${order.label} delayed`,
    caption: buildMissedCaption(order),
    visualHint: buildMissedVisualHint(order, { index: i }),
    tiedOrderId: order.id,
    tiedOrderLabel: order.label,
  };
}

export function mapOrderToSavedBeat(order, i) {
  return {
    id: `s${i + 1}`,
    title: order.label,
    caption: buildSavedCaption(order),
    visualHint: buildSavedVisualHint(order, { index: i }),
    tiedOrderId: order.id,
    tiedOrderLabel: order.label,
  };
}
