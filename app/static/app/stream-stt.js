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
export const MODEL_BYTES = 51441771;

// A response can end early while still advertising its full Content-Length, and the loader
// would hand the engine a half-read weight file. Every file is measured against what the
// server declared and any shortfall is re-requested by range before the engine sees it.
async function fetchWhole(url, onDelta) {
  const parts = [];
  let have = 0;
  let total = 0;
  let stalls = 0;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const init = have ? { headers: { Range: `bytes=${have}-` } } : {};
    const res = await fetch(url, init);
    if (res.status !== 200 && res.status !== 206) throw new Error(`${url} → ${res.status}`);
    if (!total) {
      const range = res.headers.get('Content-Range');
      total = range ? Number(range.split('/').pop()) : Number(res.headers.get('Content-Length') || 0);
    }
    const body = new Uint8Array(await res.arrayBuffer());
    // a server that ignores Range replays from the start; keep only what is still missing
    const fresh = res.status === 206 ? body : body.subarray(Math.min(have, body.length));
    if (fresh.length) {
      parts.push(fresh);
      have += fresh.length;
      stalls = 0;
      if (onDelta) onDelta(fresh.length);
    } else if ((stalls += 1) >= 3) {
      break;
    }
    if (!total || have >= total) break;
  }
  if (total && have < total) throw new Error(`short read ${url} ${have}/${total}`);
  if (parts.length === 1) return parts[0];
  const whole = new Uint8Array(have);
  let at = 0;
  for (const part of parts) { whole.set(part, at); at += part.length; }
  return whole;
}

let transcriber = null;
let stream = null;
let loading = null;
let fetchIssue = '';

export function lastFetchIssue() { return fetchIssue; }
// The engine keeps its lines across sessions; ids retired with a session must never
// reappear in the next one, or a second utterance inherits the first one's words.
const retiredIds = new Set();

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
    let loaded = 0;
    const tick = (n) => {
      loaded += n;
      if (onProgress) onProgress(Math.min(0.995, loaded / MODEL_BYTES));
    };
    const files = {};
    const blobs = [];
    try {
      // each file becomes a blob the moment it lands, so the peak is one file's bytes
      // and not the whole fifty megabytes held twice
      await Promise.all(MODEL_FILES.map((name) => fetchWhole(MODEL + name, tick).then((bytes) => {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
        files[name] = url;
        blobs.push(url);
      })));
    } catch (err) {
      // repair failed: fall back to letting the loader fetch directly rather than refusing to start
      for (const url of blobs.splice(0)) URL.revokeObjectURL(url);
      fetchIssue = String((err && err.message) || err);
      for (const name of MODEL_FILES) files[name] = MODEL + name;
    }
    const opts = { modelArch: mod.ModelArch.TinyStreaming, wasmUrl: RUNTIME + 'moonshine.wasm' };
    try {
      transcriber = await mod.Transcriber.loadFromUrls(files, opts);
    } finally {
      for (const url of blobs) URL.revokeObjectURL(url);
    }
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
    const id = String(line.id);
    if (retiredIds.has(id)) return;
    lines.set(id, { text: line.text.trim(), complete: complete || !!line.isComplete });
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
      for (const id of lines.keys()) retiredIds.add(id);
      lines.clear();
      stream = null;
    },
  };
}
