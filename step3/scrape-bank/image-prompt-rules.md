# Immersive Image Prompt Generation Rules (for DeepSeek/Cursor use)

This is a self-contained ruleset. Feed this directly to DeepSeek as system instructions when
generating new image prompts for other concepts/questions, it doesn't require the rest of the
project's context to be understood on its own.

## The formula, in order, every time

1. **Style declaration first.** Always open with: "An Unreal Engine 5 cinematic 3D game character
   render, not a photograph. Real-time global illumination, subsurface scattering skin shader,
   crisp high-poly geometric precision, cloth simulation with visible weight." This is the locked
   house style, don't vary it or substitute a different rendering style.

2. **Camera and framing, be specific and dynamic.** Never default to a flat, neutral shot. Pick
   one:
   - First-person POV with a foreground element (the viewer's own hand, shoulder, knee, a nearby
     object) entering the bottom or edge of frame, slightly out of focus, to sell "you are here"
   - Low wide-angle lens with slight perspective distortion, pulling the viewer into the moment
   - A specific angle with a stated reason (e.g. "as if someone glancing over noticed her mid-
     stride")
   State the lens behavior explicitly: shallow depth of field, what stays sharp, what falls soft.

3. **One concept, one metaphor, stated as the actual subject.** Every image should be doing the
   work of a single, specific, statable concept, not a vague mood. If the concept can't be stated
   in one sentence that would be wrong for any other case, it isn't ready to generate yet.

4. **Character consistency via embedded elements.** Reference locked characters by their element
   ID using triple angle brackets: `<<<element-id>>>`. Never re-describe a locked character's
   face or build from scratch, the element handles that. State their name and role in the prompt
   text around the embed (e.g. `<<<element-id>>> as Nadia, blowing into...`).

5. **Environment stays unified within any multi-panel generation.** If generating more than one
   panel/angle in a single image, all panels share the same environment (same room, same street,
   same lighting source), varying only camera angle, not the whole setting. State this explicitly
   at the top of a multi-panel prompt.

6. **Lighting: one dramatic key light, deep falloff into near-black shadow.** This is the
   locked lighting treatment, don't switch to flat/even lighting.

## Exaggeration dial (use when a concept benefits from caricature)

Not every image needs this, use it when the concept is about intensity, strain, or a dramatic
physiological/emotional state. Four calibrated levels, pick one explicitly, don't leave it vague:

- **Pass 1, grounded:** realistic proportions, dramatic but believable
- **Pass 2, in-engine cutscene extreme:** features enlarged roughly 1.2-1.4x realistic
  proportion, visible physical detail (capillaries, strain lines, sweat), still reads as a real
  character under real strain
- **Pass 3, concept art exaggeration:** proportions genuinely caricatured, head/feature scale
  pushed for silhouette readability, asymmetry allowed for dynamism
- **Pass 4, poster/key art maximum:** full caricature, extreme lens distortion, lighting pushed
  toward comic-book contrast, prioritizing graphic impact over remaining realism

State the pass number and its defining traits explicitly in the prompt, don't just say
"exaggerated" without specifying how much.

## Hard rules, non-negotiable

- **Every metaphor/concept must trace to real content** (the actual question or concept being
  illustrated), never invented clinical or conceptual content with no basis in the source
  material.
- **Model and settings**: `nano_banana_2` for iteration, aspect ratio matched to the intended use
  (16:9 for wide/landscape scenes), reference images attached via the `medias` array with
  `role: "image"` when a style reference is being matched.

## Output format expected from DeepSeek

For each new prompt generated, output: the concept being illustrated (one sentence), the full
image prompt text (ready to submit as-is), and which exaggeration pass level was used, if any.
Do not output prompts without stating the concept they're for, a prompt with no stated concept
hasn't actually satisfied rule 3 above.
