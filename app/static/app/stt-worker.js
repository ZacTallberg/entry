import { pipeline, env } from './vendor/transformers/transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/static/app/models/';
env.backends.onnx.wasm.wasmPaths = '/static/app/vendor/transformers/';

// ONE model per worker. Two models sharing a WebGPU runtime instance wedged silently —
// decodes never returned while a second set of sessions existed. The page spawns a
// second worker for the refiner instead; isolation is the fix, not scheduling.
let modelId = 'moonshine-tiny-ONNX';
let asr = null;
let device = null;
let booting = false;
let busy = false;
const queue = [];

const progress = {};
function reportProgress(p) {
  if (p.status !== 'progress' || !p.total) return;
  progress[p.file] = { loaded: p.loaded, total: p.total };
  let loaded = 0;
  let total = 0;
  for (const f of Object.values(progress)) {
    loaded += f.loaded;
    total += f.total;
  }
  postMessage({ t: 'progress', pct: Math.min(0.99, loaded / total) });
}

let forceWasm = false;

async function boot() {
  if (asr || booting) return;
  booting = true;
  try {
    try {
      if (forceWasm) throw new Error('wasm forced');
      asr = await pipeline('automatic-speech-recognition', modelId, {
        dtype: { encoder_model: 'q8', decoder_model_merged: 'q4' },
        progress_callback: reportProgress,
        device: 'webgpu',
      });
      device = 'webgpu';
    } catch (_gpuErr) {
      asr = await pipeline('automatic-speech-recognition', modelId, {
        dtype: { encoder_model: 'q8', decoder_model_merged: 'q4' },
        device: 'wasm',
      });
      device = 'wasm';
    }
    try { await asr(new Float32Array(6400)); } catch (_w) {}
    postMessage({ t: 'ready', device, model: modelId });
    work();
  } catch (err) {
    postMessage({ t: 'error', message: String((err && err.message) || err) });
  } finally {
    booting = false;
  }
}

async function work() {
  if (busy || !asr) return;
  busy = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      try {
        const t0 = performance.now();
        let out = await asr(job.samples);
        let text = (out.text || '').trim();
        if (!text && job.mode === 'final' && job.samples && job.samples.length > 24000) {
          const padded = new Float32Array(job.samples.length + 5600);
          padded.set(job.samples);
          out = await asr(padded);
          text = (out.text || '').trim();
          if (!text && job.samples.length > 96000) {
            out = await asr(padded.subarray(padded.length - 101600));
            text = (out.text || '').trim();
          }
        }
        postMessage({
          t: job.mode,
          text,
          id: job.id,
          gen: job.gen,
          ms: Math.round(performance.now() - t0),
          len: job.samples ? job.samples.length : -1,
        });
      } catch (err) {
        postMessage({ t: 'error', message: String((err && err.message) || err), id: job.id, mode: job.mode });
      }
    }
  } finally {
    busy = false;
  }
}

onmessage = (e) => {
  const msg = e.data;
  if (msg.t === 'init') {
    if (msg.model) modelId = msg.model;
    forceWasm = !!msg.forceWasm;
    if (msg.threads && typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) {
      env.backends.onnx.wasm.numThreads = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 2));
    } else {
      env.backends.onnx.wasm.numThreads = 1;
    }
    boot();
  } else if (msg.t === 'audio') {
    if (msg.mode === 'interim' && (busy || queue.length || !asr)) return;
    queue.push(msg);
    if (asr) work();
    else boot();
  }
};
