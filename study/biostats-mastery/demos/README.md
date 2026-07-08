# Biostats Demos

Standalone, self-contained HTML teaching demos. Each opens in its own browser tab — no server required. CDN resources (Tabler icons, KaTeX) are loaded inline.

| File | Concept | Maps to | How to use |
|------|---------|---------|------------|
| `alpha-discovery-bouncer.html` | "What alpha actually is" — drag a threshold line across 100 dots until exactly 5 are flagged. Discover α = 0.05 yourself before anyone defines it. | Any normal-distribution question (Q8, Q11, Q12, Q15, Q18, Q19) | Use before introducing the normal chart Controls tab. The "bouncer at a door" metaphor makes the pink sliver under the curve make sense. |
| `four-versions-alpha.html` | Same 100 trials, four visual metaphors: line (bouncer), grid (jury), radial (archer's target), jar (marbles). Switch between them to find which geometry makes "5 out of 100" feel most obvious. | General alpha / Type I error concept | Use when a student says "I don't get alpha." Try each metaphor until one clicks. |
| `power-interaction.html` | Sample size, effect size, and alpha driving live SVG curves with a power gauge. Live KaTeX formulas update on every frame. Challenge: find the smallest n where power crosses 80%. | Q15 (n=12,000), Q18/Q19 (InferTrial power), Controls tab | Use to understand how n, d, and alpha interact before manipulating the Controls tab sliders. |
| `novastat-multiple-comparisons.html` | 100 parallel worlds where NovaStat is a placebo. k subgroups tested per trial. Grid shows how many of those 100 worlds still produce a "significant" headline by pure chance. Formula `1−(1−α)^k` is proven visually, not just stated. | Q13 (forestPlot, multiple comparisons), any multiplicity question | Open when Q13's yellow callout box needs to become provable, not just asserted. Drag k to see 10 subgroups explode the false alarm rate past 40%. |

## Opening from the main app

From `index.html`, link to these via:

```
window.open('demos/alpha-discovery-bouncer.html', '_blank');
```

Or add buttons in the quiz UI near relevant question types.
