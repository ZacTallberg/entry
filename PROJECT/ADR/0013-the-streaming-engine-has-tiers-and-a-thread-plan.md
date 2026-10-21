# 0013 — The streaming engine has tiers and a thread plan

- Status: accepted
- Date: 2026-10-20
- Directed by: operator ("improve transcription… REALTIME accurate and AWESOME, on-device")

## Context

Since c09cc17 the dark listens through `@moonshine-ai/moonshine-wasm` 0.1.5 with the
tiny-streaming-en model (34M parameters, 12.0% Open ASR average WER): the only stateful streamer
that runs in a page without a server. Two things were wrong with how it ran, both found by
measurement rather than by reading:

1. **Every core was claimed and the inference runtime spun across them.** The Emscripten build
   sizes its pthread pool to `navigator.hardwareConcurrency` and must spawn all of those workers
   before the module runs; onnxruntime then parallelises across them. On an i5-1340P (hybrid
   cores, like a phone's) the engine decoded 20 s of audio in 21.3 s with that default and in
   7.2 s with its own `MOONSHINE_ORT_SINGLE_THREAD` switch. Neither knob was reachable from the
   page; on Android the pool spawn was the "threaded boot that hangs" recorded in task 0034.
2. **Only the smallest model was ever hosted.** Moonshine v2 publishes small (123M, 7.84%) and
   medium (245M, 6.65%) streaming models in the same file shape, MIT-licensed; the runtime's
   `ModelArch` already names them. The loader accepts only the `quantized_26_07_30` sets (one
   `frontend.ort`); the newer sets split the frontend and are refused with "not a model asset
   this loader recognizes".

A dated survey (2026-10-20) found no better in-page option for a phone: Chrome's on-device Web
Speech is desktop-only; Nemotron/Parakeet streaming ports need WebGPU and 680 MB; Kyutai needs
950 MB; sherpa-onnx's wasm is single-thread with a 2023 LibriSpeech model.

## Decision

- `stream-stt.js` carries **three tiers** of the same engine — tiny (51 MB), small (165 MB),
  medium (305 MB) — self-hosted on the assets mount under `models/<tier>-streaming-en/`.
  The opening tier is chosen from the device (fine pointer + ≥8 cores + ≥8 GB → small;
  else tiny — medium only by `?stt=medium`, amended 2026-10-21 from the prod rows below:
  medium ran 1.0–1.5 s behind the voice on a 13th-gen laptop core, and no phone has been
  measured on small yet), `?stt=` forces one, and a session whose first passes
  measurably cannot keep pace (median engine latency over 800 ms) remembers one tier down for
  the next visit (`entry:stt-tier`), never below tiny, never overriding a forced tier.
- The vendored runtime is **patched** (see `vendor/moonshine/PATCHES.md`) so the page sets the
  pthread pool size and the engine environment. `threadPlan()` runs onnxruntime single-threaded
  with a two-worker pool by default; `?sttsingle=0&sttpool=N` exist for probes.
- `window.__stt` exposes tier, plan, load time and every pass latency, so a probe measures the
  engine and not a guess; `rung-a-ready` and `rung-a-slow` carry the same to the device log.
- `manage.py pullasset streaming-small|streaming-medium` populates the mount.

## Consequences

- The default phone path stays tiny-streaming (51 MB) until a Pixel session measures small
  there (`?stt=small` on the device; the pace judge then decides the remembered tier); a
  desktop opens on small at ~165 MB behind the same filling dial and held-audio cold start
  (ADR 0009).
- The measured table below is the acceptance record; a change to any tier threshold must come
  with a new row from the same probe (`scratchpad voice/probe.py`, fake-microphone clips with
  scripted references).
- Alternatives measured and kept out: the runtime's `decode_incomplete_lines` (no first-word
  gain, slightly worse words), a 0.25 s update interval (more passes, no gain).

## Measurements (i5-1340P, Chromium, 27–30 s scripted clips, engine already loaded)

| tier · plan | first text after tap | passes · median lag | p90 lag | WER |
|---|---|---|---|---|
| tiny · default threads (before) | 5.3 s | — | — | 1.4% |
| tiny · single, pool 2 | 4.5 s | 85 · 240 ms | 377 ms | 1.4% |
| tiny · multi, pool 8 | 4.6 s | 79 · 341 ms | 665 ms | 1.4% |

### Live at entry.zacoberg.com, build 7f6091a (2026-10-21, quiet CPU, single · pool 2)

The same probe against production, two clips each (a callback and a handyman rounds script;
the rounds clip carries the number-heavy ledger talk that every tier mis-hears at ~13–15%).
Headless Chromium crashes on this page's scene before the engine loads, so these rows come
from a headed window.

| tier | first text after tap | passes · median lag | p90 lag | max lag | WER | pace judge |
|---|---|---|---|---|---|---|
| tiny | 3.6 s · 3.7 s | 81 · 305 ms · 103 · 236 ms | 526 · 370 ms | — | 2.7% · 15.3% | keeps |
| small | 3.3 s · 3.7 s | 81 · 395 ms · 98 · 419 ms | 558 · 628 ms | 845 · 993 ms | 0.0% · 12.9% | keeps |
| medium | 4.6 s · 4.2 s | 46 · 1051 ms · 40 · 1498 ms | 1828 · 2404 ms | 2283 · 2560 ms | 0.0% · 12.9% | steps down |

Under a concurrent build on the same machine small's median rose to 612–1003 ms and the judge
stepped it down once — the threshold bites where it should, and a loaded desktop is a tiny
desktop for the next visit.

(amendments append the small and medium rows and the phone session)
