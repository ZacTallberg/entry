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
