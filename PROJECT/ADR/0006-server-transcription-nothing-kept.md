# 0006 — Server transcription: the covenant moves from "not sent" to "not kept"

- Status: accepted
- Date: 2026-08-25

## Context

On-device transcription (Moonshine-base, ADR-adjacent to 0005) worked but the operator judged the
quality poor. The estate already runs a materially better engine in the jobsite app: faster-whisper
`small.en`, CPU int8 — proven in production, with two hard lessons encoded in its code (VAD deletes
quiet speech; decoder repetition loops need a guard).

## Decision

- `POST /api/transcribe`: raw 16kHz float32 PCM in the request body → faster-whisper in memory →
  `{text}`. The audio is never written to disk, never stored, never logged, and never leaves the
  origin. Single-flight lock; 503 when busy or when the engine is unavailable.
- The model (small.en int8) is baked into the image at build so a deploy's first words wait on
  nothing. `WHISPER_MODEL_DIR` overrides.
- The client is server-first with the on-device worker as automatic fallback (server failure or
  offline). Phones that get the server path never download the 63MB local model.
- The front-door promise changes one word: "Nothing is sent" → **"Nothing is kept."** Audio now
  travels to the site itself for transcription; it is transcribed and discarded in the same breath.
  Saying otherwise would be a lie, and the promise's substance — the visitor's words are never
  stored, never shared, never monetized — is unchanged.
- VAD stays off and beam stays 1 (short interactive chunks); jobsite's repetition-loop pathology is
  bounded here by the 10s chunk cap.

## Consequences

- Transcription quality moves to the jobsite grade; entry inherits future engine upgrades by
  mirroring jobsite's choices.
- The container holds ~500MB more (model + runtime) and lazily ~600MB RAM once voice is first used.
- If the box proves too slow or tight, `WHISPER_MODEL` can drop to `base.en`/`tiny.en` without a
  code change, and the client falls back to on-device automatically when the endpoint is disabled.
