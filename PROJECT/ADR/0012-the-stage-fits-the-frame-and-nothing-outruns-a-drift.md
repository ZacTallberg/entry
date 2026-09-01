# 0012 — The stage fits the frame, and nothing outruns a drift

- Status: accepted
- Date: 2026-09-01

## Context

Two operator reports arrived within a day of each other. Forms were "sometimes not visible or
animating off the edge," and particles were "flying everywhere wildly quickly" even after the
clocks had been slowed by decree.

Both had architectural causes. Every form is authored for a stage about ±3.6 units wide and ±2.6
tall — not only its particle layout but its travel bounds and its hardcoded anchors: the meteors'
respawn line, the fireworks' seats, the three bodies' orbits. The camera's frustum shows ±2.44·aspect,
which on a portrait phone is barely ±1.1. Whole forms performed outside the window. And the
simulation had no speed limit: burst forces, respawn teleports and chase forces emit huge
instantaneous velocities however slowly time runs, so slowing the clocks left every jump a jump.

Two plausible fixes for the first problem were tried and measured before being discarded. Shrinking
the origins to fit the frame left the hardcoded anchors off-stage. A soft boundary spring turned
every constant-flow form into an equilibrium: the flow pushed out, the spring pushed back, and the
particles piled into a wall at the screen edge — the contrail measured 56% of its light in the outer
pixels, worse than before.

## Decision

- **The render compresses the authored stage to the frame that is watching.** One multiply at the
  last step of the vertex shader (`uFrameFit = min(1, halfW/3.6, halfH/2.6)`). Simulation, palettes,
  anchors and travel all stay in author space; only the picture scales. The hold-to-gather mapping
  from screen to simulation goes through the same fit, exactly, replacing constants calibrated by eye.
- **Velocity is capped before integration** (`uVmax`, 0.045 author units per frame-unit, halved while
  the field sleeps). Every jump becomes a glide: the meteors sail back up instead of teleporting, the
  fireworks open like slow flowers, the scramble drifts into place.
- **The form's per-form tuning is data, not compiled constants.** The seven numeric `FORM_*` defines
  became uniforms. This was expected to let forms share compiled programs and did not — three.js keys
  its program cache on more than source, and an A/B via `git stash` measured 3.0 links per form both
  before and after — but the tuning belongs in data regardless.
- **The warm no longer draws the field.** After `compileAsync` had already built and linked the
  programs, the warm rendered the entire particle scene into a 4×4 target; the GPU shades every
  particle regardless of viewport, ~500ms for sixteen pixels nobody sees. Instrumenting `linkProgram`
  showed the link itself costs under 1ms — compiles were never the stall.
- **The swap releases its prime texture on the following frame.** Disposing a texture the driver is
  still reading forces it to finish everything queued, converting overlapped work into a blocking
  wait at the moment the answer arrives. The second priming sim pass went too; it only advanced the
  field one step, which the next frame does anyway.

## Consequences

- Phone edge-clipping fell from 17–56% of lit pixels to 4–9% on prod while on-screen light rose
  roughly tenfold; the meteor shower crosses a phone corner to corner. Desktop is effectively
  unchanged (fit 0.94).
- Motion energy (mean frame difference at 1.1s): fireworks 33 → 5, meteors 16 → 8.6, predator
  3.6 → 1.2. Releases still resolve into their forms; the eruption reads as a bloom.
- Warm cost 525ms → 185ms on prod; render scale recovered from 0.68 to 1.0 because the governor
  stopped seeing those frames. Swap worst frame across four consecutive releases: 535 (cold), 164,
  158, 134ms, with render scale holding 1.0.
- A general lesson worth keeping: a tiny render target does not make a draw cheap — cost scales
  with geometry, not viewport. And a form's speed has two dials, clock and cap; the clock alone
  cannot make a teleport languid.
