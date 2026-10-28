# Local patches to the vendored @moonshine-ai/moonshine-wasm 0.1.5 runtime

Re-apply after any re-vendor (the files are otherwise verbatim from the npm `dist/`).

1. `moonshine.mjs`: `var pthreadPoolSize=navigator.hardwareConcurrency;` →
   `var pthreadPoolSize=Module["pthreadPoolSize"]??navigator.hardwareConcurrency;`
   The Emscripten pool otherwise claims every core at boot (and must finish spawning them all
   before the module runs), which on a phone's mixed cores was the boot that never finished.
2. `moonshine.mjs`: `var ENV={};` → `var ENV=Module["env"]||{};`
   Lets the page set `MOONSHINE_ORT_SINGLE_THREAD=1`, the engine's own switch that keeps
   onnxruntime on one thread. Measured on an i5-1340P: the multi-threaded default decoded 20 s
   of audio in 21.3 s, single-thread in 7.2 s.
3. `module.js` `emscriptenModuleArgs`: forwards `options.pthreadPoolSize` and `options.env` from
   `loadFromUrls(..., { moduleOptions })` into the module constructor.

4. `stt-worker-host.js` `loadTranscriber` forwards `config.pthreadPoolSize` and `config.env` in the
   `loadTranscriber` message, and `stt-worker.js` `loadTranscriber` copies them into the
   `moduleOptions` it hands `Transcriber.loadFromUrls`. Without this the worker's engine would
   boot with a pool the size of every core and multi-threaded onnxruntime, the two things
   patches 1 and 2 exist to prevent.

`stream-stt.js` is the only caller; its `threadPlan()` decides both knobs.
