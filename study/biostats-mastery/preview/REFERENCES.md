# Graph preview — canonical reference files

When building a new standalone preview, use these as the **pattern to copy** — not the full `index.html` chart renderers.

## The knife + tail-area pattern

**File:** `concept-pvalue-knife.html`

This is the canonical slider-driven SVG pattern. One curve (or two), a draggable "knife" point along the x-axis, and a shaded tail area that recalculates live.

### What it teaches

- How dragging a cutoff/z-score/p-value across a distribution changes the shaded tail area
- The relationship between a measurement value, its z-score, and the area beyond it
- Empiric rule: 68/95/99.7 rule bands visible on the curve

### Key mechanics to replicate

| Element | Pattern |
|----------|---------|
| Slider input | `<input type="range" min="…" max="…" value="…">` → `addEventListener('input', render)` |
| SVG render | `<svg viewBox="0 0 380 240">` — `innerHTML` replaced on every frame |
| Curve function | `function curvePts(mean, sd, steps)` — returns `[{x,y},…]` array |
| Tail shade | `<path>` with `fill="var(--ribbon)"` — built from curve points filtered by cutoff |
| z-score readout | `(cutoff − μ) / σ` — displayed live |
| Font slider | `fontScale` variable → applied to SVG text `font-size` on every render |

### Slider → curve → tail flow

```
slider input event
  → parse value, compute z = (cutoff − μ) / σ
  → compute tail area = cdf(left of cutoff) × 100
  → rebuild SVG innerHTML: curve path + tail shade path + markers + labels
  → update stat cards: μ, σ, z, area%
```

### d-slider (effect-size) pattern

```
<input type="range" id="d-slider" min="0" max="20" value="0" step="0.5">
→ d = slider.value / 10  (range 0.00–2.00)
→ moves the ALTERNATIVE curve away from the null
→ recalculate β, power, effect-size arrow
```

---

## Double-click to reset sliders

Every standalone preview MUST support double-click-to-reset on every slider. Double-click snaps the slider back to the question's default value and re-renders.

```javascript
// ── Double-click to reset any slider to question default ──
var defaults = { mean:100, sd:20, cutoff:60, font:10 };
var sliderMap = {
  'mean-slider':   { state:'mean',   display:'mean-display' },
  'sd-slider':     { state:'sd',     display:'sd-display' },
  'cutoff-slider': { state:'cutoff', display:'cutoff-display' },
  'font-slider':   { state:'font',   display:'font-display', format:function(v){ return (v/10).toFixed(1)+'×'; } }
};
Object.keys(sliderMap).forEach(function(id){
  document.getElementById(id).addEventListener('dblclick', function(){
    var m = sliderMap[id];
    var dv = defaults[m.state];
    this.value = dv;
    if (m.state === 'mean') mean = dv;
    else if (m.state === 'sd') sd = dv;
    else if (m.state === 'cutoff') cutoff = dv;
    else if (m.state === 'font') fontScale = dv/10;
    document.getElementById(m.display).textContent = m.format ? m.format(dv) : dv;
    render();
  });
});
```

---

## Q84 target pattern

- **One curve** (population distribution, not two)
- **σ-band toggle** ON/OFF — reveals empiric rule bands (68/95/99.7) as toggle, not default
- **Cutoff knife** — draggable via slider, same pattern as `zobs-slider` from concept-pvalue-knife
- **Tail area** = test-positive% — computed as left-tail below cutoff
- **z-score** = (cutoff − μ) / σ
- **Stat cards**: μ, σ, z-score, test-positive%
- **Option buttons** A–E → green/red verdicts
- **α-knife arrow** (when bands ON) — polygon triangle descending to the cutoff, labeled "α = 2.5%", with a connector line from the ±2σ band edge showing the math: `2.5% = (100% − 95%) ÷ 2`

### Alpha knife pattern (from concept-pvalue-knife, line 197)

```javascript
// Knife blade — polygon triangle pointing down at the threshold
h+=`<polygon points="${zaPx-8},${yPx(1)-14} ${zaPx+8},${yPx(1)-14} ${zaPx},${yPx(1)+6}" fill="var(--ink)"/>`;
// α label above knife
h+=`<text x="${zaPx}" y="..." text-anchor="middle" font-weight="700">α = ${(alpha*100).toFixed(1)}%</text>`;
// THRESHOLD label below
h+=`<text x="${zaPx}" y="..." text-anchor="middle" opacity="0.7">THRESHOLD</text>`;
```

When σ-bands are toggled ON in Q84, the knife arrow visually proves that the tail area IS the α — connecting the empiric rule to the hypothesis-testing framework.
