// "Build the Picture" puzzle spec for Case 22 — Found Unconscious (opioid / sedative toxidrome).
// Hand-authored pilot. Each slot reveals one cell of the portrait grid (order = grid order).
// Distractor tiles (correctSlot: null) bounce back with a hint.

const casePuzzle022 = {
  caseId: '022',
  title: 'Build the Picture',
  subtitle: 'Found Unconscious',
  diagnosis: 'Opioid / sedative toxidrome',
  // 2 cols x 3 rows = 6 cells; slots reveal cells top-left → bottom-right.
  grid: { cols: 2, rows: 3 },
  slots: [
    { id: 'present', label: 'Presentation', hint: 'How did she arrive?' },
    { id: 'vital', label: 'Decisive vital', hint: 'Which number forces your hand?' },
    { id: 'exam', label: 'Key exam clue', hint: 'What does the body survey reveal?' },
    { id: 'mechanism', label: 'Mechanism (the "why")', hint: 'Why is she hypotensive AND hypoventilating?' },
    { id: 'confirm', label: 'Confirmatory move', hint: 'What proves the toxidrome?' },
    { id: 'treat', label: 'First treatment', hint: 'What reverses it?' },
  ],
  tiles: [
    { id: 't1', text: 'Young woman found unconscious, unresponsive to voice', correctSlot: 'present' },
    { id: 't2', text: 'RR 18 with SpO₂ 94% and shallow breathing — hypoventilation', correctSlot: 'vital' },
    { id: 't3', text: 'Needle track marks found on the skin survey', correctSlot: 'exam' },
    {
      id: 't4',
      text: 'Opioids drop sympathetic tone; sedatives blunt the baroreflex → vasodilation + ↓ drive',
      correctSlot: 'mechanism',
    },
    { id: 't5', text: 'Naloxone trial + urine toxicology screen', correctSlot: 'confirm' },
    { id: 't6', text: 'Naloxone with airway support and ventilation', correctSlot: 'treat' },
    // distractors
    { id: 'd1', text: 'ST-segment elevation across the precordial leads', correctSlot: null, lure: 'vital' },
    { id: 'd2', text: 'Febrile to 39.5°C with rigors', correctSlot: null, lure: 'vital' },
    { id: 'd3', text: 'Start broad-spectrum antibiotics immediately', correctSlot: null, lure: 'treat' },
    { id: 'd4', text: 'Bilateral crackles from acute pulmonary edema', correctSlot: null, lure: 'exam' },
  ],
  // attending nudges keyed by the slot the learner mis-targeted (lure) or generic
  nudges: {
    vital: 'Re-read the breathing, not the rhythm — what is the toxin doing to her drive?',
    treat: 'Antibiotics treat infection. Her problem is on board right now — what reverses it?',
    exam: 'Crackles point at the lungs filling. Look at the skin survey instead.',
    _default: "That piece belongs to a different part of the story. Where does it actually fit?",
  },
};

export default casePuzzle022;
