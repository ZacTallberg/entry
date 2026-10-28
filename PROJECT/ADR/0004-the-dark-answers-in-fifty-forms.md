# ADR 0004 — The dark answers in fifty forms

**Status:** accepted · **Decided:** 2026-08-16
(operator goal: "make the entry project incredible, performant, absolutely phenomenally responsive,
no fewer than fifty wonderful remarkable interesting wildly fantastical implementations.")

## Context

The Entry's soul is one sentence: *say something into the dark and watch it become motion, then
disappear without being kept.* Today the dark has exactly one answer — a curl-noise particle field
with four typing pulses and one release choreography. Beautiful, singular, and finite: every
utterance receives the same reply.

## Decision

The dark learns **fifty distinct forms** — named, wildly different motion-answers — on the ONE
existing GPGPU engine (ping-pong position simulation + additive point cloud + bloom):

1. **A form is data, not a fork.** Each form is a registry entry (`app/static/app/forms.js`):
   a GLSL force program (`formForce`), a GLSL palette (`formColor`), tuning defines
   (homing/drag/pointer/size/soft), a JS config (blending, bloom, point size, envelope), and an
   origin layout (nebula, shell, spiral, ring, lattice, torus, band, **glyph** — the utterance
   itself rasterized to particle origins, then discarded). The engine injects the form's GLSL into
   shared shader templates and compiles **lazily, once per form, cached** — one form is ever
   active; fifty forms cost one shader's runtime.
2. **The dark listens.** Form selection is deterministic from the utterance's *structure* —
   length, word shape, vowel ratio, punctuation (question/exclamation/ellipsis), digits, case,
   emoji/CJK presence, typing cadence, deletions — mapped to a family, then a form by seeded hash,
   with an in-memory no-repeat ring so consecutive sayings differ. Deterministic signals only;
   no content classification, nothing stored anywhere (session memory dies with the tab —
   ADR 0003 ephemerality holds absolutely; the glyph origin texture is wiped after upload).
3. **The reveal.** After release the status line whispers the form's name ("it became — a
   murmuration"), then fades. `window.entryExperience` gains `forms()`, `lastForm()`, and
   `force(slug)` so the real operation is drivable headlessly.
4. **Performance is a law, not a hope.** The candidate form precompiles during typing (idle),
   so release never hitches; adaptive frame pacing, DPR caps, low-power texture sizing, and the
   reduced-motion/fallback ladder all survive; per-frame allocation stays zero.

## Consequences

- Ten families × five forms: flow · cosmic · organic · elemental · geometric · textual(glyph) ·
  strange-attractor · water/air · gravity · light. Fifty named implementations, each a genuinely
  distinct motion system, all ephemeral.
- The engine template gains two injection points (`__FORCE__`, `__COLOR__`) + per-form defines;
  origin generation gains eight layouts; selection gains the listener.
- Proof = the real operation, headless: every form force-selected, rendered non-blank, zero
  console/GL errors, then the live front door serves the new build (deploy canary).

**Amendment (2026-08-27):** fifty became eighty. Ten families of five grew to ten families of
eight — thirty new forms in `app/static/app/forms-more.js`, concatenated into the same registry, so
the chooser, the no-repeat ring and the structural listener all widen without changing. Six new
origin layouts join the nine (`helix`, `shell`, `rain`, `dunes`, `orbit`, `veil`). The form data
contract is unchanged; nothing in the engine needed to know.

`?form=<slug>` now opens the piece on a named form. Without it a form can only be reached by
chance through the no-repeat ring, which made it impossible to put eyes on a specific one — and
eyes are the only instrument that judges these. Every one of the thirty was photographed and
measured this way; four came out too faint to be worth showing (`smoke` 2.8% of frame lit,
`darkflow` 1.2%, `tidal` 2.4%, `lagrange` 1.0%) and were retuned until they read.

The measuring itself needed a correction worth recording: sampling the WebGL canvas through a 2D
context returns pure black, because the drawing buffer is not preserved after compositing. That
instrument called all thirty forms dead. The screenshot is the honest instrument — it is what the
visitor sees — so brightness is measured from the captured PNG, never from the live canvas.

**Amendment (2026-08-28):** eighty became a hundred. Twenty wilder forms in
`app/static/app/forms-wild.js` — where the previous batch added breadth, these add instability:
shear that curls into billows, a wake shedding vortices, two galaxies passing through each other,
the photon ring around a shadow, a murmuration with something hunting it, heavy fluid fingering
down through light, spots learning to be stripes, three bodies that never resolve, two solitons
passing through each other unchanged, light bent around what is not there. All twenty photographed
and measured; one (`slime`, 1.7% of frame lit) was retuned.

**Amendment (2026-08-28, second):** a hundred became a hundred and twelve, and the twelve are a
different kind. Every other form holds one idea; these are staged on `uRelease` — the breath that
is loud when the words are let go and decays as the field settles — so the form arrives as one
thing and resolves into another: something folded opening out, a shell giving way, vapour learning
to be rain, one spark taking the whole field, chaos cooling into order, a wandering that suddenly
decides. Only three of the previous hundred referenced `uRelease` at all; it was the largest
untouched axis in the contract.

Also: `orientOrigins` now stretches, shears and twists the cloud with depth in addition to
rotating and mirroring it, all keyed to the utterance — so no form occupies the frame the same way
twice. A `glyph` origin is exempt from everything but its whisper of rotation: it is made of the
visitor's own words and has to stay readable.

**Amendment (2026-08-29):** a hundred and twelve became a hundred and twenty-eight. The earlier
batches chased motion — flow, then instability, then staging on the release breath. These sixteen
were chosen for the picture they make, a shape you could describe to someone who never saw it: a
window in a dark church, iron standing up in spikes, a rule deciding what lives, sand finding the
silent places, ink dropped into still water, a web with the dew still on it, something celebrated
far away, a city seen from very high up, a wing opening once, pillars where stars are made, light
coming through in bars, something enormous going down, a shape that turns all at once, a plain that
cracked as it dried, a shoal turning through a shaft of light, and lines drawn by something already
gone. All sixteen photographed and measured; one (`crepuscular`, 1.0% of frame lit) was retuned to
42.4%.

## Amendment 2026-10-28 — more variance (operator directive)

Measured first. Over the 54 releases real devices had logged, `dense` rode along in 28, `trails`
in 26, `octave` in 23; over twenty thousand hashes the picker gave dense 54%, octave 50%, trails
45%, ring 40%, and fog 5%, shimmer 4%, size-wave 3%, beat 3%, because every effect was rolled at
its own odds and the cap of three then dropped the ambient ones first in a fixed order. Combo
entropy 6.88 bits; the single most common answer was dense-trails-octave at 7.5%. The arrival
table gave bloom, gather, fog and words half of every answer between them.

- Every effect now rolls at near-even odds, and when more than three are up the hash shuffles
  the active set and lets the overflow go from the end. Measured: every token between 19% and
  23%, 8.74 bits, the most common combination 0.4%.
- The hue shift opens to a third of a turn either way (was a sixth); the authored palette keeps
  its identity, the room it is seen in does not repeat.
- The form's breath is paced by the hash: inhale 0.78 to 1.28 of the form's own, exhale and
  peak the inverse, so two answers in one form do not arrive at one pace.
- Fourteen arrivals at nearly even odds, words a little more often.

What stays: one form per utterance chosen by its structure, no form twice in a session, the
whisper of the name.

## Amendment 2026-10-28 — more effects (operator directive: "more effects, get creative")

Ten effects join the fourteen, each a hashed-amplitude uniform gated by `uHold` like the
others, all entering the even-odds picker under the cap of three. The six that move particles
are withheld from glyph forms, where motion would scatter the words.

| effect | where | what it does |
|---|---|---|
| kaleido | simulation | the field gathers onto N spokes (3 to 7, by the hash): a snowflake symmetry the form did not have |
| tide | simulation | the whole form breathes in and out on a slow swell with a phase of its own |
| well | simulation | a wandering gathering point on a Lissajous path drags the dark after it and lets go |
| lattice | simulation | the dark settles toward a crystal of points (step 2.5 to 7 by the hash) and the form shows through it |
| prism | render | hue walks half a turn around the wheel with the angle around the centre, and the wheel turns slowly |
| ember | render | each particle flares hot and dies back on its own clock, brighter and larger for the beat |
| constellation | render | the sleeping dark's figure of twenty-six stars, drawn anew from the hash, surfaces over the answer for nine to fifteen seconds |
| gravity | simulation | the dark leans one way (a hashed direction) and pools against a soft floor while the form's homing keeps lifting it back, like sand in a wind |
| twin | simulation | two vortices turning against each other, one each side of the centre, 0.9 to 1.8 apart |
| veil | render | a slow curtain of shadow crosses the form along a hashed direction and comes round again |

`?fx=kaleido,prism` forces exactly that set, for looking at one at a time. Frames of each,
forced, at release+3 s and +9 s are the acceptance; the verdicts are appended below.

**Verdicts from the frames (local, headed, phone viewport, each effect forced alone):**
lattice reads at once, a crystal dotting across whatever form carries it; prism reads as a slow
rainbow once it walks the full wheel (a half turn was too gentle); constellation surfaces its
star figure over the answer and sinks back; ember reads as golden grain once the flare is wide
enough (an exponent of 10, not 28); twin reads as two curling lobes; veil as a curtain of shadow
splitting the form. Kaleido needed six times its first force to be seen at all and then took the
whole form into its rays, so it sits between (0.07). Well and gravity both began far too strong,
each pulling an entire form into one clump; both now lean the dark rather than own it (well
0.008 over a soft core, gravity 0.0025 with a floor at 2.6). Tide is motion and shows only in
motion; its frames are not evidence either way.
Like for like on one pinned form (nebula, `window.entryExperience.force`): the well leans the
arms toward its wandering point without swallowing them; gravity draws the nebula into a column
that pools at one end; kaleido folds it into a four-winged cross with the form still legible.
Twenty-four effects in the picker, cap of three, even odds.

**Hands (2026-10-28):** the dust condensed every utterance in one of five hands (vapour, ember,
frost, ink, static), drawn from the well. Five more join them: moss (slow, lichen-green, barely
any breath), neon (fast, hot magenta cooling to white), silt (settling, warm sand, wide breath),
ultraviolet (a shiver of violet), tide (a wide slow sea-green wash). `?hand=` forces one; frames
at 5 and 10 s of speaking are the acceptance.
Hands framed at 5 and 10 s of dictation (local, forced): all five condense the words without
error and read as distinct casts in the ink (neon cool-white, silt warm pink, ultraviolet
lavender); their breaths are quieter than the first five's by design, since the stacked vapour
was the dust's one proven defect.

**Dreams (2026-10-28):** the sleeping dark dreamed in fourteen of its quiet selves; it now has
thirty-two, every calm non-glyph form whose gesture does not erupt. A tab left open is rarely in
the same place twice.
