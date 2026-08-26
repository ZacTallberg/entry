import { pipeline, env } from './vendor/transformers/transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/static/app/models/';
env.backends.onnx.wasm.wasmPaths = '/static/app/vendor/transformers/';

let asr = null;
let loading = false;
const queued = [];

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

async function ensurePipeline() {
  if (asr || loading) return;
  loading = true;
  const opts = {
    dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    progress_callback: reportProgress,
  };
  try {
    try {
      asr = await pipeline('automatic-speech-recognition', 'moonshine-base-ONNX', { ...opts, device: 'webgpu' });
    } catch (_gpuErr) {
      asr = await pipeline('automatic-speech-recognition', 'moonshine-base-ONNX', { ...opts, device: 'wasm' });
    }
    postMessage({ t: 'ready' });
    while (queued.length) transcribe(queued.shift());
  } catch (err) {
    postMessage({ t: 'error', message: String((err && err.message) || err) });
  } finally {
    loading = false;
  }
}

async function transcribe(msg) {
  try {
    const out = await asr(msg.samples);
    postMessage({ t: 'text', text: (out.text || '').trim(), id: msg.id });
  } catch (err) {
    postMessage({ t: 'error', message: String((err && err.message) || err), id: msg.id });
  }
}

onmessage = (e) => {
  const msg = e.data;
  if (msg.t === 'init') {
    ensurePipeline();
  } else if (msg.t === 'audio') {
    if (asr) transcribe(msg);
    else {
      queued.push(msg);
      ensurePipeline();
    }
  }
};
