import { normCommandText } from '../lib/orderCommandAutocomplete.js';
import { neutralStackOrderName } from '../lib/stackDecoys.js';

/** CCS-style physical exam sections (checkbox picker). */
export const CCS_PHYSICAL_EXAM_SECTIONS = [
  { id: 'general', label: 'General Appearance', orderLabel: 'Physical Exam: General Appearance' },
  { id: 'chest', label: 'Chest / Lungs', orderLabel: 'Physical Exam: Chest / Lungs' },
  { id: 'heart', label: 'Heart / Cardiovascular', orderLabel: 'Physical Exam: Heart / Cardiovascular' },
  { id: 'abdomen', label: 'Abdomen', orderLabel: 'Physical Exam: Abdomen' },
  { id: 'genitalia', label: 'Genitalia', orderLabel: 'Physical Exam: Genitalia' },
  { id: 'heent', label: 'HEENT / Neck', orderLabel: 'Physical Exam: HEENT / Neck' },
  { id: 'skin', label: 'Skin', orderLabel: 'Physical Exam: Skin' },
  { id: 'extremities', label: 'Extremities / Spine', orderLabel: 'Physical Exam: Extremities / Spine' },
  { id: 'neuro', label: 'Neuro / Psych', orderLabel: 'Physical Exam: Neuro / Psych' },
  { id: 'lymph', label: 'Lymph Nodes', orderLabel: 'Physical Exam: Lymph Nodes' },
  { id: 'rectal', label: 'Rectal', orderLabel: 'Physical Exam: Rectal' },
];

const SECTION_MATCHERS = CCS_PHYSICAL_EXAM_SECTIONS.map((section) => ({
  ...section,
  re: new RegExp(
    section.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s*\/\s*/g, '\\s*/\\s*'),
    'i',
  ),
}));

export function isPhysicalExamPickerTrigger(text) {
  const t = normCommandText(text);
  if (!t) return false;
  return (
    t === 'phys' ||
    t === 'pe' ||
    t === 'exam' ||
    t === 'physical' ||
    t === 'physical exam' ||
    t === 'physical examination' ||
    t === 'pe exam'
  );
}

export function physicalExamSectionForOrderLabel(label) {
  const plain = neutralStackOrderName(label);
  if (!/physical exam/i.test(plain) && !/^general appearance$/i.test(plain)) {
    return null;
  }
  for (const section of SECTION_MATCHERS) {
    if (section.re.test(plain)) return section;
  }
  if (/general appearance/i.test(plain)) {
    return CCS_PHYSICAL_EXAM_SECTIONS.find((s) => s.id === 'general') || null;
  }
  return null;
}

/** Pre-check sections that appear in this case's stack list (case + decoy). */
export function suggestedPhysicalExamSectionIds(stacks = []) {
  const ids = new Set();
  for (const stack of stacks) {
    const section = physicalExamSectionForOrderLabel(stack?.label);
    if (section) ids.add(section.id);
  }
  return [...ids];
}
