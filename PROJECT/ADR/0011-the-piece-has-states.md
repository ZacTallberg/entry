# 0011 — The piece has states, and one hitch stops costing the session its resolution

- Status: accepted
- Date: 2026-08-29

## Context

The field had exactly one mode. It looked the same whether someone had just arrived, was speaking
into it, or had walked away twenty minutes ago, and it looked the same at four in the morning as at
noon. Everything varied *per release* — form, hand, gesture, layout — and nothing varied with the
situation the visitor was actually in.

Two frame-rate problems sat underneath that. The fidelity governor reads an exponential average of
every frame; a shader compile is a single ~320ms frame, which injects roughly 26ms into that average
in one step, enough to cross the downscale threshold alone. Because forms keep compiling as they are
predicted, the field ratcheted down to the 0.6 floor and stayed there — a transient hitch paid for
in permanent softness on a machine capable of full resolution. Separately, the dust set `ctx.filter`
once per glyph, and setting that filter forces its own compositing pass, so writing one line of text
did it thirty times a frame.

## Decision

- **The field sleeps.** Left alone for forty-five seconds it slows to under a third speed, loses
  half its light, and opens the lens wide. It is slow to go under and quick to wake — asymmetric on
  purpose, because a touch must be answered at once.
- **The field listens.** While the microphone is open it leans in: brighter, with the focal plane
  steadied and shallower, so the dark visibly attends rather than carrying on regardless.
- **The dark keeps the hour.** Local time tilts the hue of the room and how much light it holds,
  colder and dimmer through the small hours and warm through evening.
- **One answer in twenty-three is extravagant.** The wildcard that already chose the form now shows,
  with roughly double the bloom and twice the colour in the room.
- **Typing cadence sets the face.** The variable font was loaded and never varied; written quickly
  the letters gather weight and narrow, written slowly they open out.
- **The frame average clamps each frame at 50ms** before folding it in, so hitches cannot move it
  far while sustained slowness still does. The hitch is separated, not discarded: worst-frame is
  tracked and reported in the debug hook and the telemetry.
- **Glyph draws are batched by blur level**, so the canvas filter changes a handful of times per
  frame instead of once per character.

## Consequences

- Measured: an injected 320ms stall moves the frame average 25ms → 28ms and render scale holds,
  where before it would have downscaled immediately. Writing at a phone viewport reached a 70fps
  ceiling with a 107ms worst frame, against 47fps and 337ms — better than disabling the blur
  outright, which was 54fps.
- The states compose rather than conflict: sleeping and listening are mutually exclusive by
  construction, and the hour and the wildcard multiply into the same wash and bloom uniforms the
  grade already owns.
- Sleep is a timer, so a visitor who leaves a tab open returns to a piece that has visibly rested.
  That is intended; it also means any future automated visual check must either interact first or
  account for a dimmed field.

**Amendment (2026-08-29):** two corrections and a new state.

The sleep state shipped in this ADR could never trigger. The field's own idle breath fires every
sixteen seconds, the breath raises the pulse, the pulse counted as interaction, and interaction
reset the sleep timer — so the quiet clock could never reach forty-five seconds. The screenshot
that "verified" sleep was a dim moment, not the state. Waking is now defined by outside events
only — pointer, release, voice, the things that extend `animatedUntil` — and the breath goes on
stirring the field in its sleep without waking it. Verified by probe this time, not by
screenshot: the form slug changed while untouched, which is only possible in deep sleep.

And the dark dreams. Deep asleep, every forty-two seconds or so it becomes another of its quiet
selves — no flash, no announcement, chosen from the calm forms — so a tab left open is somewhere
else when the visitor returns. A dream must not wake the dreamer: `setForm` marks the field
animated, which reads as touch, so the dream clears that mark immediately after.
