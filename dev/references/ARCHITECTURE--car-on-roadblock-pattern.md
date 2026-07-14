# Architecture: Car-on-Roadblock Pathway Visualizer

## Reference File
`central-metabolism-map--REFERENCE.html` — single-file vanilla SVG/JS, no framework, no build step.

## Core Metaphor
A **car drives along a road** that traces a metabolic pathway. Pick a disease mode and a **roadblock** appears at the exact step the disease blocks. The car stops at the block. **Queued cars stack up behind it** (the substrate pools). The road **ahead turns grey** (everything downstream starves). Homocysteine is the bottleneck junction — block either the remethylation arm or the transsulfuration arm and traffic jams at the fork regardless.

This same concept applies to:
- Alcohol in utero → neural crest cells can't migrate → smooth philtrum, microcephaly
- Von Gierke → G6Pase blocked → G6P pools, glucose can't leave the liver
- Lead poisoning → ALA dehydratase + ferrochelatase blocked → ALA and protoporphyrin pool
- Any enzyme deficiency where substrate builds up before the block and product falls after it

## Architecture Layers

### 1. Data Layer
Three arrays define the entire pathway:

```js
const spine = [
  {id:'glucose', label:'Glucose', sub:'diet / glycogenolysis', icon:'leaf',
    why:"Entry point...",  feeds:"...",  fedby:"..."},
  // ... each node in the main chain
];

const branches = [
  {id:'gal', parent:'glucose', trigger:'glucose', dx:-260, dy:-40, icon:'leaf',
    label:'Galactose', sub:'',  why:"...",  feeds:"...",  fedby:"..."},
  // ... side-path nodes, each anchored to a parent on the spine
];

const extraEdges = [
  {from:'g6p', to:'glucose', label:'G6Pase', block:'g6pase', always:true},
  // ... extra connections (loops, bypasses) with optional block keys
];
```

**Key fields**:
- `id` — unique identifier, used for edge wiring and mode targeting
- `spine` (implicit by array order in `spine[]`) — spine position index
- `branchOf` / `parent` / `trigger` — which spine node a branch connects to
- `dx`, `dy` — offset from parent for branch layout
- `why` / `feeds` / `fedby` — causal explanation, never just a definition
- `icon` — key into the ICONS object (Tabler-style SVG stroke icons, 24×24 viewBox)
- `sub` — secondary label line, smaller, muted

### 2. Mode Layer
Each disease mode is an object with exactly these keys:

```js
const modes = {
  normal: {label:'Normal', blockedEdges:[], pool:[], starve:[], text:'...'},
  pdh: {label:'Block PDH', blockedEdges:['pyruvate-acetylcoa'], pool:['pyruvate'],
        starve:['acetylcoa','citrate','isocitrate','akg','succinylcoa',
                'succinate','fumarate','malate','oaa'],
        text:'<b>PDH blocked.</b> Pyruvate backs up ...'},
};
```

**Mode schema**:
| Key | Type | Meaning |
|---|---|---|
| `label` | string | Button text |
| `blockedEdges` | string[] | Edge IDs that get the ✕ marker + dashed styling |
| `pool` | string[] | Node IDs that turn red (substrate piling up before block) |
| `starve` | string[] | Node IDs that turn grey/faded (downstream of block) |
| `text` | HTML string | Status bar explanation, uses `<b>` for emphasis |

### 3. Rendering Layer
A single `draw()` function, called on every state change (mode switch, node click, focus change):

**Spine nodes**: Vertical chain with sinusoidal wobble (`Math.sin(i*0.8)*18`). The focused node is **larger** (scale 1.25×), has a **pill label** on the left, and is centered in the viewport. Non-focused nodes are **smaller** and **faded** (scale `1 - dist*0.11`, opacity `1 - dist*0.14`).

**Branch nodes**: Only rendered when their trigger node is expanded (click the focused spine node to toggle). Appear at `dx`/`dy` offset from their parent. Connected by dashed connector lines.

**Extra edges**: Curve connectors (quadratic bezier) between any two nodes. Optionally carry a `block` key — when that edge's block key matches a mode's `blockedEdges`, the edge turns red with a ✕ marker.

**Right-side guide curve**: A subtle vertical bulge line with a dark thumb rectangle aligned to the focused row. This is the scrollbar/carousel indicator.

### 4. Road + Car Animation Layer
The central interactive metaphor:

```js
const CAR_ICON = `<g>
  <rect x="-16" y="-8" width="32" height="13" rx="5" fill="pink"/>
  <rect x="-9" y="-14" width="15" height="8" rx="3.5" fill="pink"/>
  <circle cx="-9" cy="7" r="3.5" fill="black"/>
  <circle cx="9" cy="7" r="3.5" fill="black"/>
</g>`;
```

**Road path**: Defined as an SVG `<path>` element, `d` attribute computed from spine node positions. The path has a gradient fill (gradient `#roadGradient`).

**Road gradient stops**:
- `stop1`: 0% → green (`#8FA89E`) — road behind the block, healthy
- `stop2`: at the block fraction → green — up to the block point
- `stop3`: 100% → grey (`#D5D3CB`) — road ahead of block, starved

**Car movement**:
- `carProgress` (0..1) advances each frame via `requestAnimationFrame`
- Car position = `roadPathEl.getPointAtLength(carProgress * roadLen)`
- Car rotation = tangent angle from two nearby points on the path
- Normal mode: car loops (`carProgress += 0.001`, wraps with `% 1`)
- Blocked mode: car advances until `carProgress >= blockFraction`, then stops

**Traffic jam**:
- `lastQueueSpawn` timer — new queued car every 1.4 seconds, max 6
- Each queued car: 82% scale, fades in from opacity 0 to 0.85
- Stacked behind the block point, each 28px apart

**Mode-to-index mapping**:
```js
const FORWARD_BLOCK_SPINE_IDX = { 'pyruvate-acetylcoa': 9 };
```
Maps mode's `blockedEdges` keys to spine-edge indices. The smallest index wins (first block encountered).

## Rendering Cycle
```
User clicks mode button
  → setMode(key)
    → updateStatus()
    → resetTraffic()
    → updateRoadGradient()  // recolor road
    → draw()                // re-render nodes/edges
    → requestAnimationFrame(tick)  // restart car animation
```

On every `tick(ts)`:
1. Check `currentBlockFraction()` — null if mode is normal
2. Advance car or hold at block
3. Spawn queue cars if jammed
4. Call `drawTraffic()` to place all cars

## Node Interaction
- **Click a non-focused spine node**: becomes the new focus, chain re-centers around it
- **Click the already-focused spine node**: selects it (side panel updates) AND toggles its branch expansion (+ / − toggle)
- **Click a branch node**: selects it, side panel shows why/fedby/feeds

## What You Need to Build a New Pathway

1. **Define `spine[]`** — the main chain nodes, top to bottom. Each gets `id`, `label`, `sub`, `icon`, `why`, `feeds`, `fedby`.

2. **Define `branches[]`** — side-path nodes. Each gets `parent` (spine node id), `trigger` (which node's click reveals this branch), `dx`/`dy` offset, and the same info fields.

3. **Define `extraEdges[]`** — extra connections. Two-node `from`/`to` pairs, optional `block` key, optional `loop` flag.

4. **Define `modes{}`** — at minimum a `normal` mode. Each disease mode gets `blockedEdges` (which edges get the ✕), `pool` (node ids that back up), `starve` (node ids that get cut off), and `text` (status bar explanation).

5. **Add `FORWARD_BLOCK_SPINE_IDX` mappings** — map each mode's blocked edge key to the spine edge index where the roadblock should be.

6. **Wire the car to the spine nodes** — the road path traces through spine nodes in order. The car path is `M x0,y0 L x1,y1 L x2,y2 ...`.

## The Universal Pattern (not pathway-specific)

```
PATHWAY = CITY
NODES = BUILDINGS / STOPS
EDGES = ROADS
FLUX = CARS DRIVING
ENZYME BLOCK = ROADBLOCK
POOL = TRAFFIC JAM (cars pile up)
STARVE = DEAD ROAD AHEAD (grey, empty)
HUB = INTERSECTION (Homocysteine = fork where multiple roads converge)
```

Every disease is a roadblock. Every symptom is what happens when traffic stops at that exact intersection and can't reach its destination.
