# Medical Storyboard Engine v2

The prompt philosophy that produced the Paget disease osteoclast proof image.

## Key insight

Previous prompts were asking the model to make an **infographic** — labels first, panels as containers for text, decoration around medical facts.

v2 asks it to make a **cinematic mechanism storyboard** — the images are the primary teacher, and the text simply narrates what you're already seeing.

## The difference

| v1 (Infographic) | v2 (Storyboard) |
|---|---|
| 8 informational panels | 9 cinematic frames telling a story |
| "Osteoclast resorption" | A giant purple osteoclast physically chewing through bone |
| Labels dominate | Image dominates |
| Abstract concepts | Believable physical events |
| Medical poster | Frozen frames from a documentary |

## Golden rule

**Every disease is a battle.** Turn each phase into a physical object:
- opponent → the disease agent arrives
- tissue under attack → damage begins
- body's response → immune/reparative activation
- compensation → adaptation
- failure → compensation breaks
- treatment → intervention arrives
- restoration → normal physiology returns

## The one sentence that makes it work

> Every biological entity must obey believable physics. Cells should push, pull, climb, bind, fracture, dissolve, weave, compress, stretch, flow, or rebuild in ways that make molecular events feel tangible. Avoid floating symbols or decorative icons. The scene should look like it was photographed inside the body with a macro cinema camera.

## Visual language

Every disease gets its own visual language:
- Cancer → growing fractured crystal
- Virus → living crystalline drone
- Bacteria → armored insect
- Autoimmune → friendly-fire soldiers
- Amyloid → concrete filling spaces
- Plaque → rust spreading through pipes
- Fibrosis → construction scaffolding
- Clot → concrete plug
- Inflammation → living wildfire

## Location

The prompt is wired into `server.js` at `/api/generate-concept` — Stage 1 (DeepSeek reasoning) and Stage 2 (DALL-E style prompt).

## Proof

`concept-images/osteoclast-base-paget-proof.png` — the Paget disease of bone storyboard that validated the approach.
