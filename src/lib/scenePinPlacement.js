/** Keep placed-order pins off floating UI chrome (sidebar, scene dock, toolbar). */

const UI_SELECTORS = [
  '.scene-dock-left',
  '.game-sidebar.floating:not(.dock-hidden)',
  '.panel-controls-stack',
  '.scene-timeline-dock',
  '.teach-compare-scene-dock',
  '.post-review-panel',
].join(', ');

export function collectPlayUiRects(sceneEl) {
  const game = sceneEl?.closest?.('.game');
  if (!game || !sceneEl) return [];
  const sceneRect = sceneEl.getBoundingClientRect();
  if (!sceneRect.width || !sceneRect.height) return [];

  return [...game.querySelectorAll(UI_SELECTORS)]
    .map((node) => {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return null;
      }
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        left: (r.left - sceneRect.left) / sceneRect.width,
        top: (r.top - sceneRect.top) / sceneRect.height,
        right: (r.right - sceneRect.left) / sceneRect.width,
        bottom: (r.bottom - sceneRect.top) / sceneRect.height,
      };
    })
    .filter(Boolean);
}

export function pointInNormRect(cx, cy, rect, pad = 0.02) {
  return (
    cx >= rect.left - pad &&
    cx <= rect.right + pad &&
    cy >= rect.top - pad &&
    cy <= rect.bottom + pad
  );
}

/** Nudge normalized pin coords away from UI panels toward patient center. */
export function clampPinAwayFromUi(cx, cy, sceneEl, { pad = 0.025 } = {}) {
  const rects = collectPlayUiRects(sceneEl);
  let x = Math.max(0.06, Math.min(0.94, cx));
  let y = Math.max(0.1, Math.min(0.9, cy));

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const hit = rects.find((rect) => pointInNormRect(x, y, rect, pad));
    if (!hit) return { cx: x, cy: y };
    const centerX = (hit.left + hit.right) / 2;
    const centerY = (hit.top + hit.bottom) / 2;
    const pushX = x < centerX ? hit.left - pad - 0.02 : hit.right + pad + 0.02;
    const pushY = y < centerY ? hit.top - pad - 0.02 : hit.bottom + pad + 0.02;
    const dx = Math.abs(pushX - centerX) < Math.abs(pushY - centerY) ? pushX - x : 0;
    const dy = dx === 0 ? pushY - y : 0;
    x = Math.max(0.06, Math.min(0.94, x + (dx || (0.5 - x) * 0.15)));
    y = Math.max(0.1, Math.min(0.9, y + (dy || (0.55 - y) * 0.15)));
  }

  return { cx: x, cy: y };
}
