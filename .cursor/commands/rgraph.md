---
name: rgraph
description: Render a single biostats question graph as a standalone preview HTML — review and approve before integrating into the full app.
---

# /rgraph

**Standalone graph preview.** When you say `/rgraph q26`, it generates a self-contained HTML page showing **only that question's graph** — no app chrome, no question bank, no nav. You review and approve the graph in isolation. Only after approval does the change land in the main `index.html`.

## Philosophy — every graph is a discovery tool, not an illustration

**Don't tell them — let them break it themselves.** The student learns by dragging, sliding, and watching the consequences in real time — not by reading a caption. The graph is the teacher; the text only confirms what the student already saw.

Four non-negotiable rules for every graph:

| # | Rule | Meaning |
|---|---|---|
| 1 | **Start from zero** | Every slider begins at the null state. d=0 (identical distributions), z_obs=0 (no observation yet), HR=1.0 (no effect), α=5% (standard default). The student sees the base before anything happens — then builds up. Never default to a medium or large effect. |
| 2 | **Every measure visible** | All relevant quantities are on-screen simultaneously — means, α, β, power, p-value, effect size, sample size. The student should never have to imagine a hidden variable or toggle to a different view to see what changed. If it matters, it's in the graph. |
| 3 | **The motion teaches the relationship** | Moving one slider visibly changes every affected measure. Drag d → watch β shrink as power grows. Drag α → watch the rejection gate widen but p-value stays fixed. Drag an outlier → watch the mean chase it while the median sits still. The relationship is learned kinesthetically through visual feedback, not memorized from a table. |
| 4 | **Font slider** | Every preview MUST include a font-size slider (0.8× to 1.8×, default 1.0×) so the student can adjust readability without browser zoom. |
| 5 | **Double-click reset** | Every slider MUST support double-click-to-reset: double-clicking any slider snaps it back to the question's default value and re-renders. The student explores freely, then one double-click returns to the canonical scenario. Never ship a slider without a dblclick handler. |
| 6 | **Floating controls HUD** | Sliders, toggles, and stat cards MUST live in a draggable, collapsible floating panel — never a fixed header bar or inline control strip that competes with the graph for space. The graph IS the main thing. Controls are secondary chrome that float over the canvas and can be repositioned or hidden. See Q84 for the canonical implementation (`.master-controls` with `.hud-header` grip, drag-to-move, collapse button). |

**Example — Q65 dotplot:** Every one of the 100 patient dots is individually draggable. Grab an outlier at score 100 and drag it to 200 — the mean marker follows every pixel while the median and mode barely twitch. The lesson is sealed in one drag. No paragraph needed.

**Example — concept-pvalue-knife:** Start at d=0 (distributions identical), z_obs=0 (no observation). Pull d up to 0.80 — the green power ribbon grows, the amber β ribbon shrinks. Move α — the gate widens, β drops, power rises, p-value unchanged. Every relationship visible in one view.

## Usage

```
/rgraph q26
/rgraph 32
/rgraph q13
```

## Agent workflow — MUST follow every step

### Step 1 — Parse question ID

Strip leading `q` if present (`q26` → `26`).

Read the question from `stats_questions.json`:

```powershell
Set-Location "C:\Users\steve\MeWorld\game\study\biostats-mastery"
node -e "const qs=JSON.parse(require('fs').readFileSync('stats_questions.json','utf8')); const q=qs.find(q=>q.id===<ID>); if(!q){console.log('NOT FOUND');process.exit(1)} console.log(JSON.stringify({id:q.id,type:q.baseGraph.type,stem:q.stem,ad:q.ad,graphData:q.baseGraph,options:q.options.map(o=>({label:o.label,text:o.text,graph:o.graph}))},null,2))"
```

### Step 2 — Evaluate the graph fitness

Read **`reference/BOOK_REFERENCE_MAP.md`** and **`.cursor/rules/reference-graph-fit.mdc`**. Check:

1. Does this graph type teach the concept from the reference book? (yes/no)
2. Is the data real (not placeholder d=0.8, hr=0.6, n=64)? (yes/no)
3. Is there interactive discovery (sliders, drag, toggle, per-option views)? (yes/no)
4. Would a different graph type teach it better? (yes/no → which)

**Now also check against the five philosophy rules:**

5. **Start from zero** — do all sliders begin at the null state? (d=0, z_obs=0, HR=1.0)? (yes/no)
6. **Every measure visible** — are α, β, power, p-value, means, effect size all on screen? (yes/no)
7. **Motion teaches relationship** — does dragging one slider visibly change every affected measure? (yes/no)
8. **Font slider** — is there a font-size slider in the controls? (yes/no)
9. **Double-click reset** — does every slider support dblclick to snap back to the question's default? (yes/no)
10. **Floating HUD** — are controls in a draggable, collapsible floating panel, not an inline strip? (yes/no)

Rate it: **A** (excellent) / **B** (adequate) / **C** (wrong type or placeholder data) / **D** (empty).

**If C or D:** fix the data in `stats_questions.json` now before generating the preview. Update `baseGraph.type`, author real values, add per-option graph data, etc.

**If any philosophy rule fails (5–10):** add it to the preview HTML before serving. No graph ships without a font slider. No graph ships with non-zero defaults on effect/observation sliders. No slider ships without a dblclick reset handler. No preview ships without a draggable floating controls HUD.

### Step 3 — Generate standalone preview HTML

Create a self-contained HTML file at `study/biostats-mastery/preview/q<ID>.html`.

This file must:
- Have `<html><head><style>...</style><script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"></head><body>...</body></html>`
- Embed the question data inline as `const Q = {...};`
- Copy ONLY the rendering functions needed for this specific graph type from `index.html`
- Include any global state variables those functions need (qzHR, qzNPerArm, etc.) with defaults from the question's baseGraph
- Include the minimal CSS for this graph type
- Include Tabler icons CDN if the graph uses them: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css">`
- Be fully self-contained — no JSON fetches, no localStorage

**CRITICAL — Background rule:** The preview MUST use a **white or plain light background** (e.g. `#ffffff`, `#f8f9fa`, `#fafafa`). Text must be dark/black (`#111`, `#333`, `#1a1a2e`). Game app chrome (dark theme, `#0c0c10`, glass panels) is FORBIDDEN in previews. The preview is a clean white-page review — AI and humans must see the graph clearly on a plain background.

**CRITICAL — Means + separation for `normal` type:** Every `normal` chart preview MUST visually show:

1. **Mean markers** — filled circles on the x-axis at μ=0 (null, gray) and μ=d (treatment, blue)
2. **Mean labels** — "μ=0" and "μ=X.XX" centered below each marker
3. **Effect-size arrow** — a horizontal arrow between the two means, drawn above the axis, with arrowhead at the treatment end
4. **Arrow label** — "d = X.XX" centered above the arrow

**CRITICAL — Effect size d MUST start at 0:** The `d` slider or initial graph state MUST begin at `d = 0` so the student can see the null and alternative as **identical** (perfect overlap). They then pull the means apart by moving the slider. This is pedagogically essential — the student must watch the null and alternative distribution separate visually in real time. Never default `d` to a medium or large effect (e.g. 0.50, 0.80, 1.0). The initial state is **d = 0 → H₀ = H₁ → identical distributions.**

This is drawn via a Chart.js `afterDraw` plugin — never as a separate SVG or div. The plugin also draws the "Retain H₀ / Reject H₀" labels at the critical-value line. See `preview/q52.html` for the canonical implementation (`meanArrowPlugin`).

**CRITICAL — Font rule:** All previews MUST use font family `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` — the same font stack as the in-game MeWorld environment. Font sizes should be readable at 100% zoom (minimum 0.625rem / 6.5pt for the smallest labels; 0.75rem / 7.5pt for body; 0.8125rem+ for stats and callouts).

**CRITICAL — Floating controls HUD:** Sliders MUST live in a draggable, collapsible floating panel — NEVER an inline control bar above or below the graph. The graph is the main thing. Controls are secondary chrome. Pattern (from Q84):

```css
.master-controls { position:fixed; top:20px; right:20px; z-index:50;
  width:420px; max-width:calc(100vw - 40px); border-radius:12px;
  box-shadow:0 8px 24px rgba(0,0,0,.14); }
.master-controls.collapsed .hud-body { display:none; }
.hud-header { cursor:grab; user-select:none; }
.hud-header:active { cursor:grabbing; }
```

```html
<div class="master-controls" id="hud">
  <div class="hud-header" id="hudHeader">
    <span class="hud-title"><span class="grip">⠿⠿</span> Controls — drag to move</span>
    <button class="hud-collapse-btn" id="hudCollapse">–</button>
  </div>
  <div class="hud-body">
    <!-- sliders, toggles, stat cards -->
  </div>
</div>
```

```javascript
// Drag HUD by header
header.addEventListener('mousedown', function(e){
  if (e.target === collapseBtn) return;
  dragging = true;
  var rect = hud.getBoundingClientRect();
  startX = e.clientX; startY = e.clientY;
  startLeft = rect.left; startTop = rect.top;
  hud.style.right = 'auto';
  hud.style.left = startLeft + 'px';
  hud.style.top = startTop + 'px';
});
window.addEventListener('mousemove', function(e){
  if (!dragging) return;
  hud.style.left = (startLeft + e.clientX - startX) + 'px';
  hud.style.top = (startTop + e.clientY - startY) + 'px';
});
window.addEventListener('mouseup', function(){ dragging = false; });

// Collapse toggle
collapseBtn.addEventListener('click', function(){
  hud.classList.toggle('collapsed');
  collapseBtn.textContent = hud.classList.contains('collapsed') ? '+' : '–';
});
```

**CRITICAL — Double-click reset:** Every slider MUST support double-click-to-reset. Each `<input type="range">` needs a `dblclick` event listener that resets the slider to the question's default value, updates the display label, sets the state variable, and calls the render function. See `preview/REFERENCES.md` for the canonical implementation pattern. The student drags freely, double-clicks to return to baseline. Never ship a slider without this.

**CRITICAL — Interactivity rule:** The preview MUST be fully interactive — not a static image. Every graph type must support:

| Graph type | Minimum interactivity required |
|---|---|
| `normal` | Clickable option buttons to switch per-option curve sets; critical-value line; **mean markers on x-axis** (filled circles at μ=0 and μ=d) with labels below; **effect-size arrow** drawn between the two means above the axis with "d = X.XX" label; Retain H₀ / Reject H₀ labels |
| `cumulative` | HR slider; clickable option buttons; KM curve toggle |
| `forestPlot` | Per-option row highlight; clickable option buttons; multiplicity buttons if defined |
| `bar` / `bar-multigroup` | Clickable option buttons to switch per-option bar pairs |
| `ppvCurve` | Prevalence slider; Sn/Sp toggles |
| `rocCurve` | Threshold slider; AUC display |
| `spaghettiPlot` | Clickable tour steps; paired/independent toggle |
| `biasDiagram` | Clickable option buttons; annotation toggles |
| `studyDesignGrid` | Highlight cards on click |
| `contingencyTable` | Toggle cell computation on/off |
| `cltGraph` | n slider; distribution toggle; option buttons |
| `secantTangent` / `hazardSecant` | Draggable points; slope readout |
| `dag` | Node highlight on hover; per-option DAG swap |
| All types | Option buttons that switch the graph to that option's data + show that option's `desc` text below |

**Graph-type → functions to include:**

| Type | Functions to copy from index.html |
|------|-----------------------------------|
| `cumulative` | `buildKMSteps`, `updateCumulativeChart`, `nQ` |
| `normal` | `updateNormalChart`, `nQ` |
| `bar` / `bar-multigroup` | `updateBarChart` |
| `forestPlot` | `updateForestPlotChart`, `renderForestProofSimulation`, `nQ` |
| `ppvCurve` | `updatePPVCurveChart` |
| `rocCurve` | `updateROCChart` |
| `dotplot` | `updateDotplotChart` |
| `contingencyTable` | `renderContingencyTable` |
| `biasDiagram` | `renderBiasDiagram` |
| `studyDesignGrid` | `renderStudyDesignGrid` |
| `phaseTimeline` | `renderPhaseTimeline` |
| `dag` | `renderDAG` |
| `decisionTree` | `renderDecisionTree` |
| `spaghettiPlot` | `renderSpaghettiPlot`, `generatePairedData` |
| `secantTangent` | `renderSecantTangent` |
| `hazardSecant` | `renderHazardSecant` |
| `cltGraph` | `renderCLTDemo` |

### Step 4 — Run smoke pass (MANDATORY)

Before opening the browser, run the smoke script with Playwright to verify BOTH static HTML AND Canvas rendering:

```powershell
Set-Location "C:\Users\steve\MeWorld\game\study\biostats-mastery"
node scripts/smoke-preview.mjs --id <ID> --playwright
```

This checks:
- **Phase 1 — Static HTML:** valid structure, white/plain bg, CDN resolves, interactive elements, self-contained, Q data inline
- **Phase 2 — Playwright Canvas:** opens page in headless Chromium, confirms `<canvas>` in DOM, verifies Chart.js instance has real data points with non-empty datasets, saves screenshot to `scripts/q<ID>-preview-smoke.png`

**If smoke fails:** fix the issues and re-run before Step 5. Do not proceed to open the browser on a failing preview.

### Step 5 — Open the preview

```powershell
Start-Process "http://localhost:9091/preview/q<ID>.html"
```

The server must be running (`npx http-server . -p 9091` from `study/biostats-mastery/`).

If the server is not running, start it:

```powershell
Set-Location "C:\Users\steve\MeWorld\game\study\biostats-mastery"
Start-Process npx -ArgumentList "http-server",".","-p","9091","-c-1","--cors" -WindowStyle Hidden
Start-Sleep 2
```

### Step 6 — Tell Steve

Report:
- **Preview URL:** `http://localhost:9091/preview/q<ID>.html`
- **Graph type:** what was rendered
- **Rating:** A/B/C/D and what changed (if anything)
- **Philosophy check:** start-from-zero? every-measure-visible? motion-teaches? font-slider? dblclick-reset? floating-hud?
- **Smoke result:** pass/fail + what was checked
- **Interactivity:** what the user can click/toggle/drag/slide (HUD draggable? collapsible?)
- **What to look for:** specific things to verify

Wait for Steve to say "approved" or give feedback.

### Step 7 — On approval, integrate

When Steve says approved:
- Any graph type/data changes made in Step 2 are already in `stats_questions.json`
- If the rendering function needed a new feature or fix, apply that to `index.html`
- Confirm: "Changes in index.html + stats_questions.json. Ready in full app at http://localhost:9091/index.html"

## Do not

- Use dark/glass/game-chrome background — white or plain light ONLY
- Skip the smoke pass — it must pass before the browser opens
- Generate a static non-interactive preview — the student must be able to drag, slide, click
- Skip the standalone preview and just open the full app
- Show full app chrome in the preview (no tab bar, no question cards, no nav)
- Ship a graph without a **font slider**
- Ship a graph with **non-zero defaults** on effect/observation — start from the null state
- Ship a slider without a **double-click-to-reset** handler — every slider gets dblclick → default
- Hide any relevant measure (means, β, power, p-value) — if it matters, it's in the graph
- Ship a preview with **inline controls** — always float sliders in a draggable, collapsible HUD
- Mutate `index.html` before approval — data only in `stats_questions.json` during preview phase

## Reference files

| File | Purpose |
|------|---------|
| `stats_questions.json` | All question data (edit here during preview) |
| `index.html` | Full app — only touch after approval |
| `reference/BOOK_REFERENCE_MAP.md` | Question → book + chapter |
| `.cursor/rules/reference-graph-fit.mdc` | 4-point checklist + graph-type table |
| `preview/` | Standalone preview HTMLs land here |
| `scripts/smoke-preview.mjs` | Smoke pass for preview HTML validation |
