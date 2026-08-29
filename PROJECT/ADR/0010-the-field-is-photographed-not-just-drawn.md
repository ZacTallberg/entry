# 0010 — The field is photographed, not just drawn

- Status: accepted
- Date: 2026-08-28

## Context

A hundred and twelve forms were rendering into a straight blit. The particle shader did the work —
palette, ignite, shimmer, fog — and the last step copied the trail buffer to the screen unchanged.
Three things followed from that. The large near-black areas banded, because nothing broke up the
gradient between one dark value and the next. The frame ended as hard as the monitor did. And every
particle was equally resolved, so forms that are genuinely three-dimensional read as flat sheets of
dots.

The imported `EffectComposer`, `RenderPass`, `UnrealBloomPass` and `OutputPass` are vestigial: the
real path is trail-fade → particles → fullscreen display quad. That quad was a `MeshBasicMaterial`
with a map, which is exactly where a grade belongs and nothing was using it.

## Decision

- The display quad becomes a shader — the piece's grade. In order: chromatic separation that is
  nothing at the centre and grows toward the corners the way a lens does; a slow low colour wash
  that shows only where nothing else is, so the dark reads as a room rather than an absence; grain
  that lives in the shadows where banding lives and fades out of the highlights; a saturation lift,
  because the palettes are authored quietly and measured around 0.01 chroma; a filmic shoulder so
  the brightest particles keep their hue instead of clipping to white; a vignette.
- The wash takes its colour from the same hue shift the chosen form does, so the room changes with
  what was said. The written words take that cast too, normalised so the brightest channel stays
  full and the writing keeps its luminance.
- The particle shader gets a focal plane. Particles away from it swell, soften and dim — energy
  spread over a larger sprite — and the plane drifts slowly, so the field is never uniformly sharp.
- The form swap flashes and the vignette tightens with it and relaxes. Only a release flashes;
  arriving at the page does not.

## Consequences

- Every one of the hundred and twelve forms is improved by changes to one shader, and new forms
  inherit the grade for free.
- Measured settled at 1920x1080 after the change: 107-120fps, worst frame 19-28ms. The A/B against
  a neutralised grade showed no brightness cost (photonring 3.2% of frame lit either way, nebula
  2.4 vs 2.3), so the grade adds texture without eating the field.
- The flash and the shoulder are a pair: the flash would clip without the shoulder, and the
  shoulder has little to do without something bright to roll off.
- Anything that wants to affect the whole image now has one place to live. The unused postprocessing
  imports remain as dead weight and should be removed when someone is next in that file.
