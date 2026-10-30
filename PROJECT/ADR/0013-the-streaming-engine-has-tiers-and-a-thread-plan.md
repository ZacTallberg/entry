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

## Amendment 2026-10-27 — the engine follows the device both ways, and owns its stream

What the device log showed after a week live: the operator's phone (8 cores, 8 GB) ran tiny at a
99 ms median pass with nothing in the code that could ever offer it small; a 32-core desktop took
3 to 5 s from tap to first text; a 16-core desktop was told streaming was unsupported and the row
said nothing about why.

- **Promotion on proof.** After the warm-up passes, a session whose median pass is at or under
  150 ms writes the next tier up for the next visit (`rung-a-fast`). Promotion stops at small;
  medium stays a `?stt=medium` matter. A step-down now also records the tier it stepped down from
  as the device's **ceiling** (`entry:stt-ceiling`); a promotion never climbs to or past it. A
  forced `?stt=` clears both memories. `chooseTier` applies a remembered tier in either direction.
- **One stream per session.** The runtime's convenience calls all drive a single default stream
  that keeps its lines and is never released, which is why a retired-id set had to guard the
  next utterance. `openStream` now creates its own stream, closes it when the microphone shuts,
  and drops the retired-id guard. Proven: two sessions in one visit on a looping microphone both
  transcribe and the second does not inherit the first's words.
- **The pass gate is 0.25 s** of new audio (`DEFAULT_INTERVAL`, `?sttint=` overrides), down from
  the runtime's 0.5 s. The library already stretches the gate to whatever a pass costs, so it
  only runs more often where the device can afford it.
- `rung-a-unsupported` now carries `sab`, `iso`, `worker`.
- Not ours to move: the streaming encoder looks 1.28 s ahead (`total_lookahead` 16 frames of
  80 ms in every tier's `streaming_config.json`). That is the floor under any first word.

### Measured 2026-10-27, i5-1340P quiet (load under 5% at start), local server, headed Chromium, single-thread, pool 2, estimate-5 corpus

| run | first text after tap | median / p90 / max pass | passes | WER |
|---|---|---|---|---|
| tiny 0.5 s | 3.1 s | 213 / 328 / 434 ms | 93 | 15.7% |
| tiny 0.25 s | 3.4 s | 210 / 368 / 518 ms | 87 | 10.0% |
| tiny 0.125 s | 2.8 s | 214 / 344 / 427 ms | 96 | 12.9% |
| small 0.5 s | 2.9 s | 433 / 833 / 1094 ms | 87 | 14.3% |
| small 0.25 s | 3.5 s | 473 / 827 / 930 ms | 78 | 10.0% |
| small 0.125 s | 3.1 s | 429 / 691 / 779 ms | 87 | 7.1% |

On this machine the gate is never the floor: the pass count is the same at every setting because
a pass costs more than 0.25 s of audio, and first text and WER move inside run-to-run noise. The
gate matters on a device whose pass is cheaper than the gate, which the phone on tiny is: there
0.25 s halves the audio-to-text delay against 0.5 s, and 0.125 s would only double the pass
overhead for a tenth of a second. An earlier, ungated run of the same matrix under host memory
pressure produced medians over 2 s and 97 s listens on a 30 s clip; it is discarded, and the
runbook (`PROJECT/ops/local-dev.md`) now gates each run on the host's load.

## Amendment 2026-10-28 — the engine leaves the page thread

The first words through the feedback channel (ADR 0014), from the operator's phone on build
0a8cea0, tiny at a 100 ms median pass: "things slightly freeze at the moment a word plips into
existence" and "a slight bit of lag any time a word pops into existence". The runtime's own
protocol notes say why: a synchronous `Stream.transcribe` runs on whichever thread calls it, and
`stream-stt.js` called it from the page, the thread that draws the field. Every pass was that many
dropped frames, and the promotion the same visit earned (tiny to small) would have made each
stall three to four times longer.

- The engine now loads inside the runtime's `SttWorkerHost` (a module worker, `stt-worker.js`),
  with the page's thread plan forwarded into it (vendored patch 4: the worker otherwise boots a
  pool the size of every core and multi-threaded onnxruntime). Audio is posted in 64 ms spans;
  the worker coalesces passes; line events come back as plain objects. Audio that arrives before
  the worker acknowledges `start` waits in the session and is flushed on the acknowledgement.
- The in-page transcriber remains as the fallback when the host cannot be built (no nested
  workers), and `?sttplace=page` forces it for a comparison. `rung-a-ready` carries `place`.
- The thread plan is unchanged: single-thread onnxruntime, pool 2. In the worker, four engine
  threads bought small 18% on this laptop and tiny nothing; not worth four threads of a phone's
  battery before the phone has reported its own numbers.

### Measured 2026-10-28, i5-1340P, local server, headed Chromium, estimate-5 corpus; the probe's own page load (the field) is ~55% of the box in every run, both places alike

| run | worst frame while listening | first text | median / p90 pass | WER |
|---|---|---|---|---|
| tiny, page | 125 ms | 3.1 s | 167 / 246 ms | 17.1% |
| tiny, worker | 83 ms | 3.1 s | 204 / 323 ms | 17.1% |
| small, page | 372 ms | 3.1 s | 351 / 603 ms | 4.3% |
| small, worker | 73 ms | 3.3 s | 695 / 1122 ms | 5.7% |
| small, worker, 4 threads | 23 ms | 3.5 s | 567 / 735 ms | 4.3% |
| tiny, worker, 2 threads | 84 ms | 3.3 s | 207 / 328 ms | 15.7% |

The field stops stalling in both tiers. The pass costs more off the page thread, by a fifth on
tiny and by two on small: Chrome schedules a dedicated worker below the page thread, and on this
hybrid part that is an efficiency core. That is a laptop fact; the phone's big and little cores
will tell their own story through the device log, and the pace judge and the ceiling already
govern the outcome either way. Two sessions in one visit on the worker path both transcribe.

**Live (2026-10-28, build 69fe6a5, prod, same i5 and probe):** `place: worker` on both tiers; worst
frame while listening 95 ms on tiny and 99 ms on small, against 160 and 405 ms measured in-page on
prod the same day; first text 4.3 / 4.1 s; median pass 274 / 730 ms; WER unchanged. The phone's
01:27Z visit on the previous build, after its promotion to small, had measured a 469 ms median pass
and a 337 ms worst frame, and said so in words.

## Amendment 2026-10-28 (goal loop) — the last words land, and the words move the field

- **The tail lands.** `onText` refused every event once `listening` was false, and `listening`
  went false before the session's stop; with the engine in a worker the forced final pass always
  arrives after that, so a tap-to-stop mid-sentence left the uncorrected partial standing. A
  session now carries a token: its words are taken while it is live and for as long as the engine
  takes to answer its stop (two seconds at most), and a session replaced by a newer one can never
  write again. The spoken report is taken after the tail. Measured locally, tap-to-stop mid-sentence:
  "…and the press and the" became "…and the pressure back there is terrible." within 1.5 s, twice;
  the natural-pause probe unchanged (WER 15.7%, first text 3.4 s).
- **Words move the field, revisions do not.** Every engine revision was replayed into `onInput`
  as a typed space, so for the whole time a visitor spoke the field took an orbit pulse at 1.45×
  energy from the box centre, a pop, and a hand-urgency font change, four times a second. While
  dictating, `onInput` now skips the typed pulse and the cadence; `wordsMoveField` excites the
  field outward once per newly arrived word, anchored at the newest word in the mirror, and
  inward once per completed line. On the 30 s clip: 41 revisions, 32 word pulses, 8 line pulses,
  worst frame 31 ms (was 60 in the same place), WER 7.1%, first text 3.8 s.

**Amendment 2026-10-28 (goal loop, unit 3):** the pass gate is per tier: tiny 0.125 s, small 0.25 s,
medium 0.5 s. On tiny the pass is cheaper than the gate on every device measured (100 ms on the
operator's phone, 210 ms on the i5), so there the gate itself was the lag between voice and text and
is halved; on small and medium the pass is the floor and the gate is moot. On the i5 under a build
the halved gate changed nothing measurable (tiny: 90 passes, WER 15.7%, first text 3.6 s), which is
the expected result on a device whose pass exceeds the gate; the phone's rows decide. A release also
now waits while a closing session's final pass is on its way (two seconds at most), so the dark
answers the words as finally heard.

**Amendment 2026-10-28 (goal loop, unit 4, the art seen):** frames of the live piece on a phone
viewport showed a hard-edged, blown-out white rectangle over the newest words during dictation. The
dust drew every condensing letter's breath additively ('lighter'); a revision sets twenty letters
condensing at once and their stacked puffs clipped to a plateau whose edges were the puffs' shared
extents. The smoke and the letter breaths now composite with 'screen', so stacked vapour approaches
white along its own gradients, and a run of fresh letters shares one breath (alpha scaled by
1/sqrt(0.8 n)). Verified on the same frames locally: soft vapour, no block. The invitation line is
hidden outright while dictating; its ghost sat over the vapour above the first line.

**Amendment 2026-10-29 (goal loop, unit 5, the pass counted once):** the pace judge read the
engine's pass cost off the line events, and one pass of the engine is diffed into up to three
events per line (text changed, updated, completed) across every line in the transcript. A single
pass was counted two to four times: the judge's eleven samples covered about four real passes, and
the channel carried every pass in triplicate. Measured on the i5 over the 27 s clip: 72 and 68 lag
rows a dictation with 35 and 33 consecutive duplicates; after the change 40 rows, no duplicates,
`__stt.passes` equal to `__stt.lags.length`. A pass is now sampled once from the worker's own pass
receipt (calls the gate turned away in under five milliseconds are not passes); the in-page
fallback samples the first line event of the synchronous burst one pass produces.

The same sitting was run under a Chrome trace (`tools/trace-probe.py`: every main-thread task over
a threshold attributed to script, layout, paint and GC, with the page's own marks inside it). With
the engine in the worker the page's main thread is clean: zero tasks of 30 ms or more across 34 000
tasks and 22 s of dictation, zero rAF gaps over 40 ms, worst frame 25 ms, where the page-thread
engine had 160 and 405 ms. What remains of the frame time on this box (21 ms a frame) is the GPU's;
the phone's own perf rows on the worker build are the evidence still owed.
