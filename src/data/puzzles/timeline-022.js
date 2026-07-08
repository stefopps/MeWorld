// "Arrange the Timeline" spec for Case 22 — Found Unconscious (opioid / sedative toxidrome).
// Sequencing mode: pick step-pieces from the tray, drop them into ordered slots 1..N.
// A piece is correct in a slot when piece.order === slotIndex + 1.
// Distractors (order: null) never belong on the timeline — they bounce with a nudge.

const caseTimeline022 = {
  caseId: '022',
  title: 'Arrange the Timeline',
  subtitle: 'Found Unconscious — resuscitation order',
  done: 'Resuscitation sequence complete',
  // ordered correct steps
  steps: [
    { id: 's1', order: 1, text: 'Open & support the airway — bag-valve-mask for hypoventilation' },
    { id: 's2', order: 2, text: 'Give naloxone to reverse the opioid' },
    { id: 's3', order: 3, text: 'IV access + fluid bolus for hypotension' },
    { id: 's4', order: 4, text: 'Continuous monitoring — SpO₂, cardiac, BP' },
    { id: 's5', order: 5, text: 'Urine tox screen + labs to confirm the toxidrome' },
    { id: 's6', order: 6, text: 'Observe for re-sedation, then disposition' },
  ],
  distractors: [
    { id: 'x1', order: null, text: 'Start broad-spectrum antibiotics', nudge: 'No source of infection here — this is a toxidrome, not sepsis.' },
    { id: 'x2', order: null, text: 'Immediate cardioversion', nudge: 'Her rhythm is a compensatory sinus tach, not a shockable arrhythmia.' },
  ],
  nudges: {
    early: 'Right step, wrong moment — something has to come before it. Airway always leads.',
    late: 'You skipped ahead — what stabilizes her first?',
    _default: 'Close, but the order is off. Walk it from airway outward.',
  },
};

export default caseTimeline022;
