import { toPng } from 'html-to-image';

import { buildTeachCompareRows, teachCompareStatusLabel } from './teachMeCompare.js';
import { neutralStackOrderName } from './stackDecoys.js';
import { buildBareEssentialsRows, groupTeachCompareRowsByTier } from './caseBareEssentials.js';

const EXPORT_CSS = `
.tc-export-sheet {
  width: 1100px;
  background: #080a10;
  color: #f0eee8;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(232, 184, 75, 0.28);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}
.tc-export-hero { position: relative; }
.tc-export-portrait-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #0c0e14;
  overflow: hidden;
}
.tc-export-portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.tc-export-hero-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(8, 10, 16, 0.96) 0%,
    rgba(8, 10, 16, 0.55) 38%,
    rgba(8, 10, 16, 0.08) 100%
  );
  pointer-events: none;
}
.tc-export-hero-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20px 24px 18px;
}
.tc-export-case-cat {
  display: inline-block;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(232, 184, 75, 0.88);
  margin-bottom: 6px;
}
.tc-export-hero-caption h1 {
  margin: 0 0 6px;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.2;
  color: #faf8f2;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
}
.tc-export-case-meta {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.55);
}
.tc-export-meta-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
}
.tc-export-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tc-export-pill {
  font-size: 0.72rem;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(240, 238, 232, 0.88);
}
.tc-export-pill strong { color: #e8b84b; }
.tc-export-pill.warn strong { color: #f0a060; }
.tc-export-pill.bad strong { color: #ff8c78; }
.tc-export-pill.good strong { color: #7ce89a; }
.tc-export-vitals {
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}
.tc-export-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 14px 16px 16px;
  align-items: start;
}
.tc-export-panel {
  background: rgba(8, 10, 16, 0.92);
  border: 1px solid rgba(232, 184, 75, 0.22);
  border-radius: 12px;
  overflow: hidden;
  min-height: 200px;
}
.tc-export-panel-head {
  padding: 10px 12px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tc-export-panel-title {
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(232, 184, 75, 0.92);
  font-weight: 600;
}
.tc-export-panel-count {
  font-size: 0.62rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  padding: 2px 8px;
}
.tc-export-panel-body { padding: 8px 10px 10px; }
.tc-export-next {
  margin: 0 0 8px;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgba(240, 238, 232, 0.78);
}
.tc-export-next strong { color: rgba(232, 184, 75, 0.95); }
.tc-export-grid-head,
.tc-export-row {
  display: grid;
  grid-template-columns: 1.85rem 1fr 2.2rem minmax(4.5rem, auto);
  gap: 5px;
  align-items: center;
}
.tc-export-grid-head {
  margin-bottom: 4px;
  padding: 0 2px;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
}
.tc-export-col-flow { text-align: center; }
.tc-export-col-badge { text-align: right; }
.tc-export-row {
  margin-bottom: 3px;
  padding: 4px 4px 4px 2px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}
.tc-export-flow-dot {
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.88);
  background: linear-gradient(180deg, #f3d060 0%, #e8b84b 100%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.62rem;
  font-weight: 800;
  color: #1a1200;
  margin: 0 auto;
}
.tc-export-flow-dot.done {
  border-color: rgba(124, 232, 154, 0.72);
  background: linear-gradient(180deg, #9ef0b8 0%, #5fd88a 100%);
  color: #0f2a18;
}
.tc-export-flow-dot.warn { border-color: rgba(255, 140, 120, 0.7); }
.tc-export-flow-dot.extra {
  width: 1.1rem;
  height: 1.1rem;
  border-style: dashed;
  font-size: 0.85rem;
  background: transparent;
  color: rgba(255, 180, 168, 0.9);
}
.tc-export-label {
  font-size: 0.76rem;
  line-height: 1.3;
  color: rgba(244, 242, 236, 0.92);
  word-break: break-word;
}
.tc-export-yours {
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
  font-weight: 700;
}
.tc-export-yours-miss {
  color: #ff5c5c;
  font-size: 0.82rem;
}
.tc-export-badge {
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: right;
  font-weight: 600;
}
.tc-export-badge.status-match { color: #7ce89a; }
.tc-export-badge.status-order-off,
.tc-export-badge.status-extra { color: #ff8c78; }
.tc-export-badge.status-next { color: #e8b84b; }
.tc-export-badge.status-missed { color: #f0a060; }
.tc-export-badge.status-pending { color: rgba(255, 255, 255, 0.38); }
.tc-export-extra-title {
  margin: 10px 0 6px;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 180, 168, 0.85);
}
.tc-export-timeline-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0 18px;
  position: relative;
}
.tc-export-timeline-spine {
  position: absolute;
  left: 5px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: linear-gradient(
    to top,
    rgba(232, 184, 75, 0.85) 0%,
    rgba(232, 184, 75, 0.25) 70%,
    rgba(232, 184, 75, 0.08) 100%
  );
  border-radius: 999px;
}
.tc-export-timeline-item {
  position: relative;
  display: flex;
  padding: 8px 0;
}
.tc-export-timeline-dot {
  position: absolute;
  left: -18px;
  top: 12px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #0a0c10;
  border: 2px solid rgba(232, 184, 75, 0.9);
  box-shadow: 0 0 0 3px rgba(232, 184, 75, 0.12);
}
.tc-export-timeline-item.kind-extra .tc-export-timeline-dot {
  border-color: rgba(120, 180, 255, 0.9);
  box-shadow: 0 0 0 3px rgba(120, 180, 255, 0.12);
}
.tc-export-timeline-time {
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
  font-variant-numeric: tabular-nums;
}
.tc-export-timeline-label {
  font-size: 0.78rem;
  line-height: 1.35;
  color: rgba(244, 242, 236, 0.92);
}
.tc-export-timeline-seq {
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(232, 184, 75, 0.75);
}
.tc-export-timeline-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tc-export-brand {
  padding: 8px 20px 14px;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.28);
  text-align: center;
}
.tc-export-landscape {
  position: relative;
  min-height: 620px;
}
.tc-export-landscape-bg {
  position: absolute;
  inset: 0;
  background: #0a0c10 center / cover no-repeat;
  z-index: 0;
}
.tc-export-landscape-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(to bottom, rgba(6, 8, 14, 0.9) 0%, rgba(6, 8, 14, 0.5) 40%, rgba(6, 8, 14, 0.82) 100%);
}
.tc-export-landscape-inner {
  position: relative;
  z-index: 2;
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 620px;
  justify-content: space-between;
}
.tc-export-land-rail {
  background: rgba(6, 8, 14, 0.82);
  border: 1px solid rgba(232, 184, 75, 0.22);
  border-radius: 12px;
  overflow: hidden;
}
.tc-export-land-rail-head {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(232, 184, 75, 0.92);
  font-weight: 600;
}
.tc-export-land-track {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 8px;
  padding: 10px 12px 12px;
  overflow-x: auto;
}
.tc-export-land-step {
  flex: 0 0 auto;
  width: 132px;
  min-height: 84px;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}
.tc-export-land-step-num {
  display: inline-flex;
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
  font-size: 0.62rem;
  font-weight: 800;
  border: 2px solid rgba(255, 255, 255, 0.88);
  background: linear-gradient(180deg, #f3d060 0%, #e8b84b 100%);
  color: #1a1200;
  margin-bottom: 4px;
}
.tc-export-land-step-label {
  font-size: 0.68rem;
  line-height: 1.3;
  color: rgba(244, 242, 236, 0.92);
  margin-bottom: 4px;
}
.tc-export-land-step-badge {
  font-size: 0.52rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
}
.tc-export-land-step-badge.status-match { color: #7ce89a; }
.tc-export-land-step-badge.status-order-off,
.tc-export-land-step-badge.status-extra { color: #ff8c78; }
.tc-export-land-step-badge.status-next { color: #e8b84b; }
.tc-export-land-step-badge.status-missed { color: #f0a060; }
.tc-export-land-step-badge.status-pending { color: rgba(255, 255, 255, 0.38); }
.tc-export-land-timeline-step {
  flex: 0 0 auto;
  width: 120px;
  min-height: 68px;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid rgba(232, 184, 75, 0.28);
  background: rgba(0, 0, 0, 0.35);
}
.tc-export-land-timeline-time {
  font-size: 0.58rem;
  color: rgba(255, 255, 255, 0.42);
  display: block;
  margin-bottom: 3px;
}
.tc-export-land-timeline-label {
  font-size: 0.68rem;
  line-height: 1.3;
  color: rgba(244, 242, 236, 0.92);
}
.tc-export-land-timeline-seq {
  font-size: 0.56rem;
  color: rgba(232, 184, 75, 0.75);
}
.tc-export-critical {
  margin: 0 12px 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 120, 100, 0.45);
  background: linear-gradient(180deg, rgba(80, 24, 20, 0.55) 0%, rgba(40, 12, 10, 0.4) 100%);
}
.tc-export-critical-head {
  margin: 0 0 4px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #ff9a88;
}
.tc-export-critical-sub {
  margin: 0 0 10px;
  font-size: 0.68rem;
  line-height: 1.4;
  color: rgba(255, 220, 210, 0.75);
}
.tc-export-critical-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tc-export-critical-item {
  display: grid;
  grid-template-columns: 1.4rem 1fr auto;
  gap: 8px;
  align-items: start;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.tc-export-critical-item.is-done { border-color: rgba(124, 232, 154, 0.35); }
.tc-export-critical-item.is-miss { border-color: rgba(255, 140, 120, 0.4); }
.tc-export-critical-check {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  background: rgba(255, 140, 120, 0.2);
  color: #ff9a88;
}
.tc-export-critical-item.is-done .tc-export-critical-check {
  background: rgba(124, 232, 154, 0.25);
  color: #7ce89a;
}
.tc-export-critical-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #f0eee8;
  display: block;
}
.tc-export-critical-stack {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.48);
  display: block;
  margin-top: 2px;
}
.tc-export-critical-why {
  margin: 4px 0 0;
  font-size: 0.65rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.55);
}
.tc-export-critical-status {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #ff8c78;
  white-space: nowrap;
}
.tc-export-critical-status.done { color: #7ce89a; }
.tc-export-land-critical {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 120, 100, 0.4);
  background: rgba(40, 12, 10, 0.65);
}
.tc-export-land-critical-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 6px;
}
.tc-export-land-critical-chip {
  font-size: 0.68rem;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 140, 120, 0.35);
  color: #ffd0c8;
}
.tc-export-land-critical-chip.done {
  border-color: rgba(124, 232, 154, 0.45);
  color: #b8f5cc;
}
.tc-export-tier {
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.tc-export-tier:last-child { border-bottom: none; }
.tc-export-tier-head {
  margin: 0 0 4px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(232, 184, 75, 0.92);
}
.tc-export-tier-critical .tc-export-tier-head { color: #ff9a88; }
.tc-export-tier-sub {
  margin: 0 0 6px;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.42);
}
@media print {
  body { margin: 0; background: #fff; }
  .tc-print-hint { display: none; }
  .tc-export-sheet { width: 100%; border: none; box-shadow: none; border-radius: 0; }
}
`;

function formatElapsed(at, sessionStartedAt) {
  if (!sessionStartedAt || !at) return '—';
  const delta = Math.max(0, at - sessionStartedAt);
  const sec = Math.floor(delta / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `T+${m}:${String(s).padStart(2, '0')}`;
}

function deficiencySummary(rows, extras) {
  const outOfOrder = rows.filter((r) => r.status === 'order-off');
  const pending = rows.filter((r) => ['pending', 'next', 'missed'].includes(r.status));
  const onSeq = rows.filter((r) => r.status === 'match');
  return { outOfOrder, pending, onSeq, extras };
}

function flowDotClass(row, isExtra = false) {
  const parts = ['tc-export-flow-dot'];
  if (isExtra) {
    parts.push('extra');
    return parts.join(' ');
  }
  if (row.isPlaced) parts.push('done');
  if (row.status === 'order-off' || row.status === 'missed') parts.push('warn');
  return parts.join(' ');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildTeachCompareReport({
  caseData = {},
  interventions = [],
  interventionById = {},
  placementOrder = [],
  placed = {},
  nextExpectedId = null,
  reviewResults = null,
  orderTimelineEvents = [],
  sessionStartedAt = null,
  portraitSrc = '',
  vitals = null,
  doneCount = 0,
  total = 0,
  careUnit = 'ER',
  flowTrack = '',
  layout = 'vertical',
}) {
  const { rows, extras } = buildTeachCompareRows({
    interventions,
    interventionById,
    placementOrder,
    placed,
    nextExpectedId,
    reviewResults,
  });

  const { outOfOrder, pending, onSeq } = deficiencySummary(rows, extras);

  const timeline = [...orderTimelineEvents]
    .filter((ev) => ev.kind === 'order' || ev.kind === 'extra' || !ev.kind)
    .sort((a, b) => (a.at || 0) - (b.at || 0))
    .map((ev) => ({
      time: formatElapsed(ev.at, sessionStartedAt),
      orderIndex: ev.orderIndex != null ? ev.orderIndex : null,
      label: ev.label || 'Order',
      kind: ev.kind || 'order',
    }));

  const nextLabel =
    nextExpectedId && interventionById[nextExpectedId]
      ? neutralStackOrderName(interventionById[nextExpectedId].label)
      : 'All core stacks placed';

  const caseTitle = caseData?.title || 'Case';
  const caseNum = caseData?.ccsNumber ?? caseData?.id ?? '';
  const category = caseData?.category || flowTrack || 'Clinical case';
  const generatedAt = new Date().toLocaleString();

  return {
    caseTitle,
    caseNum,
    category,
    generatedAt,
    portraitSrc,
    vitals: vitals || caseData?.vitals || {},
    doneCount,
    total,
    careUnit,
    nextLabel,
    rows,
    extras,
    timeline,
    critical: buildBareEssentialsRows({ caseData, interventions, placed }),
    flowTiers: groupTeachCompareRowsByTier({ rows, caseData, interventions }),
    counts: {
      totalStandard: rows.length,
      onSequence: onSeq.length,
      outOfOrder: outOfOrder.length,
      pending: pending.length,
      extras: extras.length,
      timelineSteps: timeline.length,
    },
    layout: layout === 'landscape' ? 'landscape' : 'vertical',
  };
}

function renderStandardRows(report) {
  const tiers = report.flowTiers?.length
    ? report.flowTiers
    : [{ id: 'general', label: 'Standard flow', rows: report.rows, hint: '' }];

  const tierBlocks = tiers
    .map((tier) => {
      const rowsHtml = tier.rows
        .map(
          (r) => `<div class="tc-export-row">
  <span class="tc-export-col-flow"><span class="${flowDotClass(r)}">${r.expectedSeq}</span></span>
  <span class="tc-export-label">${escapeHtml(r.label)}</span>
  <span class="tc-export-yours">${r.isPlaced || r.yourSeq != null ? '✓' : '<span class="tc-export-yours-miss">✕</span>'}</span>
  <span class="tc-export-badge status-${r.status}">${escapeHtml(teachCompareStatusLabel(r.status))}</span>
</div>`,
        )
        .join('');
      return `<div class="tc-export-tier tc-export-tier-${tier.id}">
  <p class="tc-export-tier-head">${escapeHtml(tier.label)} · ${tier.placedCount}/${tier.total}</p>
  ${tier.hint ? `<p class="tc-export-tier-sub">${escapeHtml(tier.hint)}</p>` : ''}
  ${rowsHtml}
</div>`;
    })
    .join('');

  const extraBlock =
    report.extras.length > 0
      ? `<p class="tc-export-extra-title">Outside standard set</p>${report.extras
          .map(
            (r) => `<div class="tc-export-row">
  <span class="tc-export-col-flow"><span class="${flowDotClass(r, true)}">·</span></span>
  <span class="tc-export-label">${escapeHtml(r.label)}</span>
  <span class="tc-export-yours">✓</span>
  <span class="tc-export-badge status-extra">${escapeHtml(teachCompareStatusLabel('extra'))}</span>
</div>`,
          )
          .join('')}`
      : '';

  return `${tierBlocks}${extraBlock}`;
}

function renderCriticalSection(report) {
  const c = report.critical;
  if (!c?.rows?.length) return '';
  const items = c.rows
    .map(
      (r) => `<li class="tc-export-critical-item ${r.isDone ? 'is-done' : 'is-miss'}">
  <span class="tc-export-critical-check">${r.isDone ? '✓' : '○'}</span>
  <div>
    <span class="tc-export-critical-label">${escapeHtml(r.shortLabel)}</span>
    ${r.label !== r.shortLabel ? `<span class="tc-export-critical-stack">${escapeHtml(r.label)}</span>` : ''}
    ${r.why ? `<p class="tc-export-critical-why">${escapeHtml(r.why)}</p>` : ''}
  </div>
  <span class="tc-export-critical-status${r.isDone ? ' done' : ''}">${r.isDone ? 'Placed' : 'Must do'}</span>
</li>`,
    )
    .join('');
  return `<section class="tc-export-critical" aria-label="Critical non-negotiables">
  <h2 class="tc-export-critical-head">${escapeHtml(c.title)} · ${c.doneCount}/${c.total}</h2>
  ${c.subtitle ? `<p class="tc-export-critical-sub">${escapeHtml(c.subtitle)}</p>` : ''}
  <ul class="tc-export-critical-list">${items}</ul>
</section>`;
}

function renderLandscapeCritical(report) {
  const c = report.critical;
  if (!c?.rows?.length) return '';
  const chips = c.rows
    .map(
      (r) =>
        `<span class="tc-export-land-critical-chip${r.isDone ? ' done' : ''}">${r.isDone ? '✓' : '○'} ${escapeHtml(r.shortLabel)}</span>`,
    )
    .join('');
  return `<section class="tc-export-land-critical">
  <header class="tc-export-land-rail-head">Critical · ${escapeHtml(c.title)} (${c.doneCount}/${c.total})</header>
  <div class="tc-export-land-critical-grid">${chips}</div>
</section>`;
}

function renderTimeline(report) {
  if (!report.timeline.length) {
    return '<p style="margin:0;font-size:0.72rem;color:rgba(255,255,255,0.42)">No orders yet.</p>';
  }
  const items = report.timeline
    .map(
      (t) => `<li class="tc-export-timeline-item kind-${escapeHtml(t.kind)}">
  <span class="tc-export-timeline-dot"></span>
  <div class="tc-export-timeline-body">
    <span class="tc-export-timeline-time">${escapeHtml(t.time)}</span>
    <span class="tc-export-timeline-label">${escapeHtml(t.label)}</span>
    ${t.orderIndex != null ? `<span class="tc-export-timeline-seq">#${t.orderIndex}</span>` : ''}
  </div>
</li>`,
    )
    .join('');
  return `<ol class="tc-export-timeline-list"><li class="tc-export-timeline-spine" aria-hidden="true"></li>${items}</ol>`;
}

function renderLandscapeTimeline(report) {
  if (!report.timeline.length) {
    return '<p style="margin:0;font-size:0.72rem;color:rgba(255,255,255,0.42)">No orders yet.</p>';
  }
  return report.timeline
    .map(
      (t) => `<div class="tc-export-land-timeline-step kind-${escapeHtml(t.kind)}">
  <span class="tc-export-land-timeline-time">${escapeHtml(t.time)}</span>
  <span class="tc-export-land-timeline-label">${escapeHtml(t.label)}</span>
  ${t.orderIndex != null ? `<span class="tc-export-land-timeline-seq">#${t.orderIndex}</span>` : ''}
</div>`,
    )
    .join('');
}

function renderLandscapeStandard(report) {
  const tiers = report.flowTiers?.length
    ? report.flowTiers
    : [{ id: 'general', label: 'Standard', rows: report.rows }];
  return tiers
    .map((tier) => {
      const steps = tier.rows
        .map(
          (r) => `<div class="tc-export-land-step">
  <span class="tc-export-land-step-num">${r.expectedSeq}</span>
  <span class="tc-export-land-step-label">${escapeHtml(r.label)}</span>
  <span class="tc-export-land-step-badge status-${r.status}">${escapeHtml(teachCompareStatusLabel(r.status))}</span>
</div>`,
        )
        .join('');
      return `<div class="tc-export-land-tier"><header class="tc-export-land-rail-head">${escapeHtml(tier.label)} · ${tier.placedCount}/${tier.total}</header><div class="tc-export-land-track">${steps}</div></div>`;
    })
    .join('');
}

function buildLandscapeMarkup(report, imgSrc) {
  const bgStyle = imgSrc ? `background-image:url(${escapeHtml(imgSrc)})` : '';
  return `<div class="tc-export-sheet tc-export-layout-landscape">
  <div class="tc-export-meta-bar">
    <div class="tc-export-summary">
      <span class="tc-export-pill good">On sequence: <strong>${report.counts.onSequence}/${report.counts.totalStandard}</strong></span>
      <span class="tc-export-pill warn">Out of order: <strong>${report.counts.outOfOrder}</strong></span>
      <span class="tc-export-pill bad">Not placed: <strong>${report.counts.pending}</strong></span>
      <span class="tc-export-pill">Progress: <strong>${report.doneCount}/${report.total}</strong></span>
    </div>
    <div class="tc-export-vitals">${escapeHtml(vitalsLine(report.vitals))}</div>
  </div>
  <div class="tc-export-landscape">
    <div class="tc-export-landscape-bg" style="${bgStyle}"></div>
    <div class="tc-export-landscape-scrim"></div>
    <div class="tc-export-landscape-inner">
      <div>
        <div class="tc-export-hero-caption" style="position:relative;padding:0 0 10px">
          <span class="tc-export-case-cat">${escapeHtml(report.category)}</span>
          <h1 style="margin:0;font-size:1.2rem">${escapeHtml(report.caseTitle)}</h1>
          <p class="tc-export-case-meta">Case #${escapeHtml(report.caseNum)} · ${escapeHtml(report.careUnit)} · ${escapeHtml(report.generatedAt)}</p>
        </div>
        ${renderLandscapeCritical(report)}
        <section class="tc-export-land-rail">
          <header class="tc-export-land-rail-head">Standard flow · Next: ${escapeHtml(report.nextLabel)}</header>
          <div class="tc-export-land-track">${renderLandscapeStandard(report)}</div>
        </section>
      </div>
      <section class="tc-export-land-rail">
        <header class="tc-export-land-rail-head">Your orders · this patient (${report.timeline.length})</header>
        <div class="tc-export-land-track">${renderLandscapeTimeline(report)}</div>
      </section>
    </div>
  </div>
  <p class="tc-export-brand">MeWorld · Standard flow vs your orders</p>
</div>`;
}

function vitalsLine(vitals = {}) {
  const hr = vitals.hr ?? vitals.HR ?? '—';
  const sbp = vitals.sbp ?? vitals.SBP ?? '—';
  const dbp = vitals.dbp ?? vitals.DBP ?? '—';
  const spo2 = vitals.spo2 ?? vitals.SpO2 ?? '—';
  return `HR ${hr} · BP ${sbp}/${dbp} · SpO₂ ${spo2}%`;
}

export function buildTeachCompareReportMarkup(report, { portraitSrc = '' } = {}) {
  if (!report) return '';
  const imgSrc = portraitSrc || report.portraitDataUrl || report.portraitSrc || '';

  if (report.layout === 'landscape') {
    return buildLandscapeMarkup(report, imgSrc);
  }

  const portraitImg = imgSrc
    ? `<img class="tc-export-portrait" src="${escapeHtml(imgSrc)}" alt="Patient" crossorigin="anonymous" />`
    : '<div class="tc-export-portrait" style="background:#12141c"></div>';

  return `<div class="tc-export-sheet">
  <div class="tc-export-hero">
    <div class="tc-export-portrait-wrap">
      ${portraitImg}
      <div class="tc-export-hero-gradient"></div>
      <div class="tc-export-hero-caption">
        <span class="tc-export-case-cat">${escapeHtml(report.category)}</span>
        <h1>${escapeHtml(report.caseTitle)}</h1>
        <p class="tc-export-case-meta">Case #${escapeHtml(report.caseNum)} · ${escapeHtml(report.careUnit)} · ${escapeHtml(report.generatedAt)}</p>
      </div>
    </div>
  </div>
  <div class="tc-export-meta-bar">
    <div class="tc-export-summary">
      <span class="tc-export-pill good">On sequence: <strong>${report.counts.onSequence}/${report.counts.totalStandard}</strong></span>
      <span class="tc-export-pill warn">Out of order: <strong>${report.counts.outOfOrder}</strong></span>
      <span class="tc-export-pill bad">Not placed: <strong>${report.counts.pending}</strong></span>
      <span class="tc-export-pill">Extras: <strong>${report.counts.extras}</strong></span>
      <span class="tc-export-pill">Progress: <strong>${report.doneCount}/${report.total}</strong></span>
    </div>
    <div class="tc-export-vitals">${escapeHtml(vitalsLine(report.vitals))}</div>
  </div>
  ${renderCriticalSection(report)}
  <div class="tc-export-cols">
    <section class="tc-export-panel">
      <header class="tc-export-panel-head">
        <span class="tc-export-panel-title">Standard flow</span>
      </header>
      <div class="tc-export-panel-body">
        <p class="tc-export-next">Next: <strong>${escapeHtml(report.nextLabel)}</strong></p>
        <div class="tc-export-grid-head">
          <span class="tc-export-col-flow">Flow</span>
          <span>Order</span>
          <span>Yours</span>
          <span class="tc-export-col-badge">Status</span>
        </div>
        ${renderStandardRows(report)}
      </div>
    </section>
    <section class="tc-export-panel">
      <header class="tc-export-panel-head">
        <span class="tc-export-panel-title">Orders · this patient</span>
        <span class="tc-export-panel-count">${report.timeline.length}</span>
      </header>
      <div class="tc-export-panel-body">
        ${renderTimeline(report)}
      </div>
    </section>
  </div>
  <p class="tc-export-brand">MeWorld · Standard flow vs your orders</p>
</div>`;
}

export function formatTeachCompareReportHtml(report, { portraitSrc = '' } = {}) {
  if (!report) return '';
  const markup = buildTeachCompareReportMarkup(report, { portraitSrc });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Teach Me compare — ${escapeHtml(report.caseTitle)}</title><style>${EXPORT_CSS}</style></head><body style="margin:16px;background:#0c0c10;"><p class="tc-print-hint" style="font-size:9pt;color:#aaa;margin:0 0 12px;">Print dialog → choose <strong>Microsoft Print to PDF</strong> to save as PDF.</p>${markup}</body></html>`;
}

export function formatTeachCompareReportText(report) {
  if (!report) return '';
  const lines = [];
  lines.push(`MeWorld — Standard flow vs your orders`);
  lines.push(`Case: ${report.caseTitle}${report.caseNum ? ` (#${report.caseNum})` : ''}`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('SUMMARY');
  lines.push(`  On sequence: ${report.counts.onSequence} / ${report.counts.totalStandard}`);
  lines.push(`  Out of order: ${report.counts.outOfOrder}`);
  lines.push(`  Not placed yet: ${report.counts.pending}`);
  lines.push(`  Outside standard set: ${report.counts.extras}`);
  lines.push('');
  if (report.critical?.rows?.length) {
    lines.push(`CRITICAL — NON-NEGOTIABLES (${report.critical.doneCount}/${report.critical.total} placed)`);
    if (report.critical.subtitle) lines.push(`  ${report.critical.subtitle}`);
    for (const r of report.critical.rows) {
      lines.push(`  ${r.isDone ? '[OK]' : '[MUST]'} ${r.shortLabel}${r.label !== r.shortLabel ? ` (${r.label})` : ''}`);
      if (r.why) lines.push(`       ${r.why}`);
    }
    lines.push('');
  }
  const tiers = report.flowTiers?.length ? report.flowTiers : [{ label: 'STANDARD FLOW', rows: report.rows }];
  for (const tier of tiers) {
    lines.push(`${tier.label.toUpperCase()} (${tier.placedCount}/${tier.total})`);
    if (tier.hint) lines.push(`  ${tier.hint}`);
    lines.push('Flow | Order | Yours | Status');
    for (const r of tier.rows) {
      lines.push(
        `${r.expectedSeq} | ${r.label} | ${r.yourSeq != null ? `#${r.yourSeq}` : '—'} | ${teachCompareStatusLabel(r.status)}`,
      );
    }
    lines.push('');
  }
  if (report.extras.length) {
    lines.push('');
    lines.push('OUTSIDE STANDARD SET');
    for (const e of report.extras) {
      lines.push(`  #${e.yourSeq} | ${e.label}`);
    }
  }
  lines.push('');
  lines.push('YOUR ORDER TIMELINE (right panel — chronological)');
  lines.push('Time | # | Order');
  lines.push('-----|---|------');
  for (const t of report.timeline) {
    lines.push(`${t.time} | ${t.orderIndex != null ? `#${t.orderIndex}` : '—'} | ${t.label}`);
  }
  return lines.join('\n');
}

async function resolveImageDataUrl(src) {
  if (!src) return '';
  if (src.startsWith('data:')) return src;
  const url = src.startsWith('http') ? src : new URL(src, window.location.origin).href;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return url;
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function prepareTeachCompareReportVisual(report) {
  const portraitDataUrl = await resolveImageDataUrl(report.portraitSrc);
  return { ...report, portraitDataUrl };
}

function waitForPortrait(host) {
  const img = host.querySelector('.tc-export-portrait');
  if (!img || !(img instanceof HTMLImageElement) || !img.src) return Promise.resolve();
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, 4000);
  });
}

function mountTeachCompareExportElement(report) {
  const host = document.createElement('div');
  host.className = 'tc-export-capture-host';
  host.style.cssText = 'position:fixed;left:-12000px;top:0;z-index:99999;pointer-events:none;';
  const style = document.createElement('style');
  style.textContent = EXPORT_CSS;
  host.innerHTML = buildTeachCompareReportMarkup(report, {
    portraitSrc: report.portraitDataUrl || report.portraitSrc,
  });
  host.prepend(style);
  document.body.appendChild(host);
  return host;
}

export async function captureTeachCompareReportPng(report) {
  const prepared = await prepareTeachCompareReportVisual(report);
  const host = mountTeachCompareExportElement(prepared);
  try {
    await waitForPortrait(host);
    const sheet = host.querySelector('.tc-export-sheet');
    if (!sheet) throw new Error('Export layout missing');
    return await toPng(sheet, {
      cacheBust: true,
      pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      width: 1100,
    });
  } finally {
    host.remove();
  }
}

export async function copyTeachCompareReport(report) {
  try {
    const dataUrl = await captureTeachCompareReportPng(report);
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return { ok: true, kind: 'image' };
    }
  } catch {
    /* fall through to text */
  }
  const text = formatTeachCompareReportText(report);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return { ok: true, kind: 'text' };
  }
  return { ok: false, kind: 'text' };
}

export async function printTeachCompareReport(report) {
  const prepared = await prepareTeachCompareReportVisual(report);
  const html = formatTeachCompareReportHtml(prepared, {
    portraitSrc: prepared.portraitDataUrl || prepared.portraitSrc,
  });
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  const img = win.document.querySelector('.tc-export-portrait');
  const printWhenReady = () => {
    win.print();
  };
  if (img && !(img.complete && img.naturalWidth > 0)) {
    img.addEventListener('load', printWhenReady, { once: true });
    img.addEventListener('error', printWhenReady, { once: true });
    setTimeout(printWhenReady, 3500);
  } else {
    win.onload = printWhenReady;
    setTimeout(printWhenReady, 400);
  }
  return true;
}

export async function downloadTeachCompareReport(report) {
  const dataUrl = await captureTeachCompareReportPng(report);
  const slug = String(report.caseNum || report.caseTitle || 'case')
    .replace(/[^\w.-]+/g, '-')
    .slice(0, 40);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `meworld-teach-compare-${slug}.png`;
  a.click();
}
