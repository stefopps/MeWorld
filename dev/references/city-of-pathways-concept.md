# Universal Concept: City of Pathways

> "We are moving through the city. You hit a roadblock. And then whatever you were holding starts to accumulate because you're not able to override the block."

## The Metaphor

Every metabolic pathway is a **city street**. Normal flux is cars driving from one intersection to the next. Every enzyme deficiency, vitamin deficiency, or toxin is a **roadblock** at a specific intersection. The substrate piles up behind it (traffic jam). Everything downstream starves (dead road, no cars reach the destination). The symptoms of the disease are exactly what happens when those deliveries can't get through.

## How This Scales

This concept is **pathway-agnostic**. It applies to:

### Already built
| Pathway | Roadblock | What pools | What starves |
|---|---|---|---|
| Folate-Methionine | DHFR block (MTX) | Folic acid, DHF | THF, purines, thymidine, methionine |
| Heme Synthesis | Lead poisoning | ALA, protoporphyrin | Heme, hemoglobin |
| Fatty Acid Oxidation | MCAD deficiency | Fatty acids | Acetyl-CoA, ketones |
| Remethylation Cycle | B12 deficiency | Homocysteine | Methionine |

### Ready to build (same pattern)
| Concept | Roadblock | Metaphor |
|---|---|---|
| Alcohol in utero | Ethanol blocks neural crest migration | Cars carrying cells can't reach the face = smooth philtrum, microcephaly |
| Phenylketonuria (PKU) | Phenylalanine hydroxylase blocked | Phe traffic jam, tyrosine starvation |
| Maple Syrup Urine Disease | BCKDH blocked | Leucine/Ile/Val traffic jam |
| Lesch-Nyhan | HGPRT blocked | Purine salvage roadblock, uric acid flood |
| G6PD deficiency | G6PD blocked | NADPH roadblock, RBCs vulnerable to oxidative damage |
| Any inborn error of metabolism | Any enzyme deficiency | Substrate before block pools, product after block starves |

## The Two Rules

### Rule 1: Pool = everything BEFORE the block
If the roadblock is at step 3, everything at steps 1, 2, and 3 accumulates. The cars can't move past step 3, so they pile up.

### Rule 2: Starve = everything AFTER the block
Everything at steps 4, 5, 6... never gets deliveries. The road is empty. The destination starves.

### The fork rule
When a single intersection (Homocysteine) has TWO exits and BOTH can be blocked independently:
- Block the left exit = traffic jams at the fork, left destinations starve
- Block the right exit = traffic jams at the fork, right destinations starve
- Block BOTH = maximum jam, ALL destinations starve

This is why homocysteine rises in BOTH B12 deficiency AND B6 deficiency — it's the intersection.

## For Cursor: How to Build the Next Pathway

When given a new pathway, follow this exact process:

1. **Read the First Aid section** — open `FirstAid-Step1-2025-35th.pdf` and find the pathway
2. **Map the nodes** — every intermediate is a node, every enzyme is an edge
3. **Identify the diseases** — every disease is a roadblock at a specific edge
4. **Determine pool vs starve** — what's BEFORE the block (pools) vs AFTER the block (starves)
5. **Find the hub** — is there a convergence point like Homocysteine where multiple roads meet?
6. **Build the data** — spine[], branches[], extraEdges[], modes{} following ARCHITECTURE doc
7. **Register in graphs{}** with `svgRender:true` and `unlockLevel`
8. **Add the tab** — one line in TAB_ICONS + graphs{} entry

Every pathway uses the SAME rendering code. Only the data changes.
