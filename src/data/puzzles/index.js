// Puzzle registry: caseId → "Build the Picture" spec + "Arrange the Timeline" spec.
// Add more case puzzles here as they're authored.
import casePuzzle022 from './case-022.js';
import caseTimeline022 from './timeline-022.js';

const PUZZLES = {
  '022': casePuzzle022,
  22: casePuzzle022,
};

const TIMELINES = {
  '022': caseTimeline022,
  22: caseTimeline022,
};

export function getPuzzleForCase(caseId) {
  if (caseId == null) return null;
  return PUZZLES[caseId] || PUZZLES[String(caseId)] || null;
}

export function hasPuzzleForCase(caseId) {
  return Boolean(getPuzzleForCase(caseId));
}

export function getTimelineForCase(caseId) {
  if (caseId == null) return null;
  return TIMELINES[caseId] || TIMELINES[String(caseId)] || null;
}

export function hasTimelineForCase(caseId) {
  return Boolean(getTimelineForCase(caseId));
}

export default PUZZLES;
