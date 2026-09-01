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

**Amendment (2026-09-01, arrivals):** the operator noticed that many releases had become "rods
pointed at a central location." Mechanism: the prime — where every particle starts before it
travels to its place — was a pure radial scale of the destination in three sizes, so every particle
travelled a straight ray through the centre; the hard velocity cap then made all of them move at
the identical speed, and with trails every ray became a same-length rod. Distance-proportional
speeds had hidden the geometry before the cap.

Three changes. **Thirteen arrivals** replace the three radial ones: bloom, gather, settle, spiral
(rotate by an angle proportional to radius, so the form unwinds), fold (reflect across a random
axis, so it passes through itself), rain and rise (fall or lift into place), curtain (sweep in from
a side), off-axis (burst from a point away from centre), fog (condense from a per-particle scatter),
halo (unroll from an ellipse the shape of the stage), horizon (rise out of a line) and deep
(approach from far away). Weighted so the classics lead; a third of releases arrive some other way.
The hash is drawn at random per release, so the arrival is random too, and `entryExperience.
arrival(name)` pins one for verification. **The cap gets a soft knee and a per-particle ceiling**
(0.72–1.28× the limit), so faster still reads faster and nothing is uniform. **A velocity six times
the limit passes untouched** — it is not motion but a form resetting a particle (the embers sending a
spent spark back to the fire, the meteors reseeding a fallen one); capped, those crawled through dark
regions and piled up unseen. Embers measured 1.0% of frame lit under the hard cap and 4.3% after.

Photographed with the same form forced through each arrival: the spiral unwinds a galaxy, the rain
lowers it like a cloud, the fog condenses it, the fold filigrees it, the deep grows it toward the
viewer, the horizon raises a full nebula. The halo and curtain first arrived as thin bands that
burned white; both gained depth (the halo an elliptical annulus with radial thickness, the curtain
a band four units deep).

Also found by a full 128-form sweep under the new cap, stage-fit and grade: 128 render, zero errors,
no blowouts, nothing grey; median lit 9.8%. Two "dim" forms are glyph forms measured without any
words, which is the instrument, not the form.

**Amendment (2026-09-01, the approach turns):** photographing the arrivals a second later showed
the rods were not only the prime: by mid-flight the far particles were homing in straight lines
whichever choreography started them, because homing alone is a straight line. While the release
envelope is up, the homing force now carries a tangential component around each particle's own
destination — proportional to distance, so it vanishes on arrival — with a direction and strength
drawn per release (`uSwirl`, ±0.6–1.5). Every arrival curves in. The first coefficient (0.045,
capped at 1.6 units) was too subtle at distance; 0.075 × distance gives about a fifty-degree turn.
Photographed at +1.75s: the gather sweeps in as a rotating disc, the bloom weaves.
