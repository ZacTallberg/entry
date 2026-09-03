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

**Amendment (2026-09-02, the wait begins when the words do):** operator observation — the wait
before the dark answers was starting only once transcription had finished, so a speaker served two
waits back to back. Measured: 9.7 s between the last word appearing and the release, of which 6.1 s
was the microphone confirming silence and 3.6 s a countdown that only then began.

The countdown is now anchored to the moment the spoken words last changed, and runs *through* the
microphone's silence window instead of after it. Three things were needed to make that true, each
found by instrument rather than by reading: the streaming path writes the composer directly and
never went through `feedVoice`, so the anchor was never set on the live path; `feedVoice` calls
`onInput` synchronously, and the guard clearing the anchor on typing fired on those synthetic events
too; and a final decode or a server refinement landing after the microphone closed would push the
anchor forward and restart the wait, so only speech moves it now, with the moment of the microphone
closing standing in when the words have not arrived yet. The silence window came down from 4.2 s to
3.4 s and the text-idle clock from 6.5 s to 5 s, which the overlap now affords.

Measured after: 2.1–2.9 s from the microphone closing to the release (was 3.3–3.6), and roughly
5.5–7 s from the last spoken word (was 8.6–9.7). A typed release is unchanged at 3.1 s, because a
hand at the keyboard clears the anchor and serves the full wait. `entryExperience.releaseInfo()`
reports the anchor, the delay and the time remaining.

**Amendment (2026-09-03, the way in and the way it explains itself):** two gaps, both real.

Input. Plain Enter did nothing — the phone keyboard offers it (`enterkeyhint="enter"`) and it was
inserting a newline into a one-row field; only Cmd/Ctrl+Enter released. Enter releases now, and
Shift+Enter still breaks the line for anyone who wants two. And once there was any text the speak
face gave the circle to the release face, so a visitor who typed could not reach the microphone
again without reloading: Escape holds the words as before, and a second Escape lets them go, which
clears the composer and brings the speak circle back.

Exposition. The piece said almost nothing about itself: a placeholder, and a whispered form-name
after the release. The stylesheet already carried a fully written `.invitation` rule — fading to
.18 while writing, to nothing while releasing — with no element in the markup to wear it. There is
one now. A newcomer is told, once, what the piece does; afterwards it says something true and quiet
instead, and that nothing is kept is the most useful thing a visitor can know. The seen-flag is a
single key in local storage.
