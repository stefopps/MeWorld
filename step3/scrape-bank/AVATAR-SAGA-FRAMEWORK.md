# Step 3 Avatar Saga — Question Mastery Framework (v2)

## Hard rule
**Do not invent questions.** Every question in a set/scene must be a real `questionId` from `scrape-bank/raw/`.  
The scraped bank exists so Cursor can **discover** concept trajectories — not hallucinate vignettes.

Story/avatar glue is invented; **clinical items are not**.

---

## Core structure
- **10 unique avatars** — each walks the same mastery sequence for memorability (parallel memory channels)
- **1 Set = 40 real questions = 5 Scenes = 8 questions/scene**
- Scenes are **concept-adjacent chains** mined from the bank (not random splits)
- Scene arc: entry → complication → deepening → turning point → resolution  
  Example spine (illustrative of *shape only*; real QIDs come from analysis):  
  HTN/lupus/skin → sun exposure → dermatitis vs lupus dermatitis → smoke → asthma vs CTD/lupus lung

---

## Cursor task: recursive bank analysis → one clear trajectory

When Master asks for a set/trajectory, Cursor must:

### 1. Load real items only
- Read from `C:\Users\steve\MeWorld\step3\scrape-bank\raw\`
- Deduplicate by numeric `questionId` (keep richest reveal/explanation)
- Use `question`, `answers`, `explanation`, `likelyCorrectAnswer` — never fabricate stems

### 2. Tag concepts (lightweight)
For each unique Q, extract 2–6 concept tags from stem+explanation  
(e.g. `lupus`, `photosensitivity`, `malar rash`, `ILD`, `asthma`, `HTN`).  
No new clinical facts — only labels grounded in that item’s text.

### 3. Recursive adjacency (not random)
- Start from a seed Q or seed concept Master names **or** pick a dense hub from tags
- Recursively pull neighbors that share tags / differential forks / same disease family
- Prefer chains that force **look-alike forks** (dermatitis vs CLE; asthma vs scleroderma lung vs lupus pneumonitis)
- Expand until you can fill **5 scenes × 8 QIDs = 40** with clear relatedness
- If the neighborhood is thinner than 40, take the best related 40 and note gaps — **do not pad with invented Qs**

### 4. Emit one clear trajectory (deliverable)
Output a single file/section:

```markdown
## Trajectory: <spine name>
Avatar: <1 of 10>
Set: N

### Scene 1 — <hook> (entry)
- QID … — one-line concept (from bank)
- … (8 total)

### Scene 2 — <hook> (complication)
- …

### Scene 3 — …
### Scene 4 — …
### Scene 5 — … (resolution)

### Why this chain
2–4 sentences: how scenes escalate on one clinical spine using ONLY bank items.

### Unused / leftover in neighborhood
QIDs related but not in this 40 (for next set / other avatar).
```

### 5. Story (after trajectory is locked)
Write the 5-scene avatar episode that **encodes those 40 QIDs’ concepts**.  
Story may dramatize; it may **not** add fake exam questions.

### 6. Master → Test → Gate
- Master studies the 40 real items
- Test: 5–6 QIDs at random from that 40 (not scene order)
- Gate: advance or re-loop

---

## Per-avatar load (approx)
- ~4,868 unique IDs ÷ 10 avatars ≈ **12 sets × 40** each  
- Assign trajectories so avatars don’t steal each other’s QIDs until Master wants interleaved review

---

## Status tracking
| Avatar | Set # | Spine / Trajectory | Scenes | Studied | Gate |
|--------|------:|--------------------|--------|---------|------|
| 1–10 | | | ☐ | ☐ | ☐ |

---

## Anti-patterns
- ❌ Random 40 from the bank  
- ❌ Invented stems “in the style of” CCS  
- ❌ Scene breaks that jump unrelated organ systems with no differential bridge  
- ❌ Treating answer letter (A/B/C) as stable across duplicate QID appearances — always key by QID
