# 0009 — The microphone opens before the engine is ready

- Status: accepted
- Date: 2026-08-27

## Context

The streaming weights are ~51MB. Even served correctly they take roughly ten seconds on a first
visit, and the visitor's first tap arrives long before that. The ladder handled this by falling to
rung B, the platform recogniser — which on most devices means the words are sent to Google, in a
piece whose whole covenant is "nothing is kept". It also meant the first utterance, the one someone
actually came to say, was the one transcribed by the engine we trust least.

The engine decodes faster than real time, so audio spoken during the load is not lost information —
it is only early.

## Decision

- When streaming is possible but not yet ready, the tap enters a held state: the microphone opens
  immediately, dictation UI and vapour begin, and every captured frame is buffered (capped at 40s).
  When the engine reports ready, the session opens and the held audio is fed in half-second spans
  before live capture continues. Telemetry records `rung-a-held` with how much speech was held.
- `ensureStreaming()` returns the in-flight load promise instead of reporting "not ready" while a
  load is already running. Without this the held path could not wait for the engine already on its
  way — it bounced, restarting capture eight times in one session and holding nothing.
- While holding, the legacy chunker is suppressed exactly as it is during a live stream, so the two
  paths cannot transcribe the same words underneath each other.
- The platform recogniser stays as the rung for devices that cannot run the streaming engine at
  all, not as the bridge for devices that merely have not finished downloading it.

## Consequences

- A cold visitor speaks into a working microphone from the first tap and gets their own words back
  from the local engine, not from a remote service.
- Measured: one capture per session instead of eight, 2.4s of speech held and replayed, and first
  words 592ms after the session opens rather than 2893ms.
- Held audio costs memory — 40s at 48kHz is ~7.7MB of Float32 — and is discarded on stop.
- If the engine fails while audio is held, the held audio is dropped and the ladder re-runs from
  the tap; nothing is silently re-attributed to another rung.
