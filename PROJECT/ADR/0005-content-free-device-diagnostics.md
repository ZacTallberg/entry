# 0005 — Content-free device diagnostics

- Status: accepted
- Date: 2026-08-25

## Context

The operator debugs on live devices (phone-first) and reported the voice path dead with no way
for an agent to see why. The app's covenant (ADR 0003) is that the visitor's words are ephemeral:
nothing they say is sent or saved. A conventional analytics/telemetry pipeline would break that
covenant; having zero visibility breaks the ability to keep the experience working at all.

## Decision

A diagnostic channel that logs the machinery, never the words:

- `POST /api/debug-log` — devices beacon batched events: boot capabilities (GPU/cores/viewport),
  graphics mode, JS errors, CSP violations, voice-pipeline stages (model load progress, backend,
  chunk seconds, transcript LENGTH only, error names), release form slug + effects + perf.
  Always 204. Hard caps: 32KB body, 60 events, 4MB rotating file in /tmp (ephemeral by design —
  logs die with the container).
- `GET /api/debug-log/tail?n=` — token-gated (X-Write-Token, same secret as hub writes).
- Forbidden forever in this channel: utterance text, transcript text, audio samples, IP addresses.
  A transcript length is loggable; a transcript is not.
- Probe traffic self-identifies (`navigator.webdriver`) so real-device sessions read clean.

## Consequences

- Agents can read real-device failure evidence instead of guessing from reports.
- The front-door promise stays true in substance: what a visitor says never leaves the page.
- Logs are ephemeral (/tmp, rotated, container-lifetime) — this is a debugging surface, not a
  record. Anything worth keeping must be moved into a task or ADR by the agent who reads it.
