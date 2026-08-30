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

**Amendment (2026-08-28):** the piece had no bloom at all, and every form had been asking for one.
All 112 carry a `bloom` value between 1.0 and 1.9 in their js config; nothing read it. The
`UnrealBloomPass` that would have consumed it was among the imports that were never instantiated,
so the light family — candle, wisps, meteors, lighthouse, photonring, filaments, ignition — was
authored to glow and never did.

There is one now, in the pass this ADR created: a bright-pass into a quarter-resolution target, two
separable gaussian passes, added back in the display shader at a strength each form chooses. Cost
measured settled at 120fps / 22ms worst frame on both 1920x1080 and 412x915 at dpr 2.6 — three
extra quarter-res passes are free at this scale.

Also: `textureSize` used `narrow` (any viewport dimension under 720px) as a stand-in for a weak
device, so a current phone rendered 65,536 particles against a desktop's 200,704 — while `lowPower`
already tested the things that actually matter, memory and core count. Capable narrow devices now
get 352^2, or 123,904. Emulating a phone viewport on a desktop GPU cannot prove a handset holds it;
the fidelity governor is the safety net, and its lever is render scale, so a device that struggles
loses sharpness rather than the field.

**Amendment (2026-08-29, anamorphic streak):** the grade gains a lens artefact reserved for bright
light. The streak is the same bright pass the bloom uses, smeared horizontally three times in
widening strides (the blur offset is `uTexel * uDir`, so the direction vector carries the stride:
3, then 7, then 15), half-height at bloom resolution, tinted cool, and added in the composite.
Technique per the standard screen-space anamorphic approach: bright pass → horizontal-only
iterated blur → tint → add.

Only forms that burn get it — strength is `max(0, bloom - 1.25) * 0.5`, doubled on a rare release —
so a candle stays a candle and the fireworks throw a blue-white line across the frame the way a
cinema lens would. Measured at phone viewport, settled, hot form against quiet: 120fps / 13ms worst
on both. The streak targets are bound at allocation so the sampler is never null.
