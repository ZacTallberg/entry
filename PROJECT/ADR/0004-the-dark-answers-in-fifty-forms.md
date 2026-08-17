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
