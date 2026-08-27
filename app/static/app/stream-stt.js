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

// A weight file can end early while still advertising its full Content-Length — a 200 with an
// honest header and a dishonest body (ADR 0008). When the engine fails to load, ask each file
// whether it is reachable and whether the server can still hand over its final bytes, so the
// report says whether the network or the model was at fault.
async function auditDelivery() {
  const notes = [];
  for (const name of MODEL_FILES) {
    try {
      const head = await fetch(MODEL + name, { method: 'HEAD' });
      if (!head.ok) { notes.push(`${name}:${head.status}`); continue; }
      const declared = Number(head.headers.get('Content-Length') || 0);
      const want = Math.min(1024, declared || 1024);
      const tail = await fetch(MODEL + name, {
        headers: { Range: `bytes=${Math.max(0, declared - want)}-` },
      });
      const got = (await tail.arrayBuffer()).byteLength;
      if (declared && got < want) notes.push(`${name}:tail ${got}/${want}`);
    } catch (err) {
      notes.push(`${name}:${String((err && err.message) || err).slice(0, 40)}`);
    }
  }
  return notes.length ? notes.join(' ') : 'delivery ok';
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
    const files = {};
    for (const name of MODEL_FILES) files[name] = MODEL + name;
    const opts = { modelArch: mod.ModelArch.TinyStreaming, wasmUrl: RUNTIME + 'moonshine.wasm' };
    if (onProgress) {
      // The downloader reports positionally — (loadedBytes, totalBytes, file) — and loadFromUrls
      // opens its session without a declared total, so the bytes are cumulative across all seven
      // files and the total is undefined. Reading the first argument as an object left the dial
      // pinned at zero for the whole load.
      let seen = 0;
      opts.onProgress = (loaded, total) => {
        const bytes = Number(loaded) || 0;
        const whole = Number(total) || MODEL_BYTES;
        seen = Math.max(seen, bytes / whole);
        onProgress(Math.max(0, Math.min(0.995, seen)));
      };
    }
    try {
      transcriber = await mod.Transcriber.loadFromUrls(files, opts);
    } catch (err) {
      // The engine stores its weights in Cache Storage, so it must fetch the real URLs
      // itself. Verify what the network actually delivered before blaming the model.
      fetchIssue = await auditDelivery();
      throw err;
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
