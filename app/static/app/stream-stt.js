// Rung A — the streaming engine. Moonshine's stateful streamer keeps its encoder state
// across chunks, so words arrive while the sentence is still being spoken instead of after
// a whole-buffer re-decode. Assets are self-hosted; audio never leaves the page.

const RUNTIME = '/static/app/vendor/moonshine/';
const MODEL = '/static/app/models/tiny-streaming-en/';
// left = the canonical key the loader recognizes, right = our hosted filename
const MODEL_FILES = [
  'frontend.ort', 'encoder.ort', 'adapter.ort', 'cross_kv.ort',
  'decoder_kv.ort', 'streaming_config.json', 'tokenizer.bin',
];
export const MODEL_BYTES = 45233659;

let transcriber = null;
let stream = null;
let loading = null;

export function streamingSupported() {
  return typeof SharedArrayBuffer === 'function'
    && typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
    && typeof Worker === 'function';
}

export async function loadStreaming(onProgress) {
  if (transcriber) return transcriber;
  if (loading) return loading;
  loading = (async () => {
    const mod = await import(RUNTIME + 'index.js');
    const files = {};
    for (const name of MODEL_FILES) files[name] = MODEL + name;
    const opts = { modelArch: mod.ModelArch.TinyStreaming, wasmUrl: RUNTIME + 'moonshine.wasm' };
    if (onProgress) {
      opts.onProgress = (p) => {
        const loaded = (p && (p.loaded || (p.bytes && p.bytes.loaded))) || 0;
        onProgress(Math.min(0.995, loaded / MODEL_BYTES));
      };
    }
    transcriber = await mod.Transcriber.loadFromUrls(files, opts);
    return transcriber;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

// The listener receives every revision of the in-flight line plus each committed line.
export function openStream(listener) {
  if (!transcriber) throw new Error('not loaded');
  const lines = new Map();
  const emit = () => {
    let committed = '';
    let partial = '';
    for (const l of lines.values()) {
      if (l.complete) committed += (committed ? ' ' : '') + l.text;
      else partial += (partial ? ' ' : '') + l.text;
    }
    listener.onText(committed.trim(), partial.trim());
  };
  const upsert = (line, complete) => {
    if (!line || typeof line.text !== 'string') return;
    lines.set(String(line.id), { text: line.text.trim(), complete: complete || !!line.isComplete });
    emit();
    if (listener.onLag && typeof line.lastTranscriptionLatencyMs === 'number') {
      listener.onLag(line.lastTranscriptionLatencyMs);
    }
  };
  stream = transcriber.createStream({});
  transcriber.addListener({
    onLineStarted: (e) => upsert(e.line, false),
    onLineUpdated: (e) => upsert(e.line, false),
    onLineTextChanged: (e) => upsert(e.line, false),
    onLineCompleted: (e) => upsert(e.line, true),
    onError: (e) => listener.onError && listener.onError(String((e && e.error) || e)),
  });
  transcriber.start();
  return {
    addAudio(samples, sampleRate) {
      try {
        transcriber.addAudio(samples, sampleRate);
      } catch (err) {
        listener.onError && listener.onError(String((err && err.message) || err));
      }
    },
    stop() {
      try { transcriber.stop(); } catch (_e) {}
      try { transcriber.removeAllListeners(); } catch (_e) {}
      lines.clear();
      stream = null;
    },
  };
}
