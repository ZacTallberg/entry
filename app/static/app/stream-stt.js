// Rung A — the streaming engine. Moonshine's stateful streamer keeps its encoder state
// across chunks, so words arrive while the sentence is still being spoken instead of after
// a whole-buffer re-decode. Assets are self-hosted; audio never leaves the page.
//
// Three model tiers share one runtime: the tier is chosen from what the device can carry
// (cores, memory, pointer class), can be forced with ?stt=tiny|small|medium, and steps itself
// down for the next visit when the engine measurably cannot keep pace with the microphone.

const RUNTIME = '/static/app/vendor/moonshine/';
const MODELS = '/static/app/models/';
// The 26_07_30 quantized sets: the one-file frontend is what this runtime's loader accepts
// (the later sets split it into frontend.model/frontend.weights, which it rejects).
const MODEL_FILES = [
  'frontend.ort', 'encoder.ort', 'adapter.ort', 'cross_kv.ort', 'decoder_kv.ort',
  'streaming_config.json', 'tokenizer.bin',
];
export const TIERS = {
  tiny: { dir: 'tiny-streaming-en/', arch: 'TinyStreaming', bytes: 51441771 },
  small: { dir: 'small-streaming-en/', arch: 'SmallStreaming', bytes: 165489086 },
  medium: { dir: 'medium-streaming-en/', arch: 'MediumStreaming', bytes: 304690919 },
};
const ORDER = ['tiny', 'small', 'medium'];
const TIER_KEY = 'entry:stt-tier';
// A pass that costs more than this many seconds of wall clock per second of audio is a
// stream that is falling behind: the library widens its interval to cope and the words
// arrive in lumps. Measured over the first passes of a session.
const SLOW_RATIO = 1.6;
const SLOW_SAMPLE = 8;
// The first passes of a session carry the runtime's warm-up and are not the pace it will hold.
const SLOW_SKIP = 3;

function param(name) {
  try { return new URLSearchParams(window.location.search).get(name); } catch (_e) { return null; }
}

function remembered() {
  try { return localStorage.getItem(TIER_KEY); } catch (_e) { return null; }
}

function remember(tier) {
  try { localStorage.setItem(TIER_KEY, tier); } catch (_e) {}
}

// The device's class decides the opening tier. A desktop with cores to spare carries the
// small model; everything else, phones included, starts on tiny until a device measurement
// says otherwise. Medium is never chosen on its own: on a 13th-gen laptop core it ran a
// second and a half behind the voice. A forced ?stt= wins, then a tier the previous visit
// stepped down to.
export function chooseTier() {
  const forced = param('stt');
  if (forced && TIERS[forced]) return forced;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
  let tier = 'tiny';
  if (fine && cores >= 8 && mem >= 8) tier = 'small';
  const past = remembered();
  if (past && TIERS[past] && ORDER.indexOf(past) < ORDER.indexOf(tier)) tier = past;
  return tier;
}

// How the runtime may use the cores. The engine's own thread pool otherwise claims every
// core on the device and its inference runtime spins across them, which on a phone's mixed
// big/little cores and on hybrid laptop parts measured slower than a single thread, and on
// Android was the boot that never finished. ?sttpool=N and ?sttsingle=0|1 override for probes.
export function threadPlan() {
  const cores = navigator.hardwareConcurrency || 4;
  const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
  const singleParam = param('sttsingle');
  const poolParam = Number(param('sttpool') || 0);
  const single = singleParam !== null ? singleParam !== '0' : true;
  const pool = poolParam > 0 ? poolParam : (single ? 2 : Math.max(2, Math.min(fine ? 8 : 4, cores)));
  return { single, pool };
}

// A weight file can end early while still advertising its full Content-Length — a 200 with an
// honest header and a dishonest body (ADR 0008). When the engine fails to load, ask each file
// whether it is reachable and whether the server can still hand over its final bytes, so the
// report says whether the network or the model was at fault.
async function auditDelivery(dir) {
  const notes = [];
  for (const name of MODEL_FILES) {
    try {
      const head = await fetch(dir + name, { method: 'HEAD' });
      if (!head.ok) { notes.push(`${name}:${head.status}`); continue; }
      const declared = Number(head.headers.get('Content-Length') || 0);
      const want = Math.min(1024, declared || 1024);
      const tail = await fetch(dir + name, {
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
let loading = null;
let fetchIssue = '';
let tier = null;
let plan = null;
const stats = { tier: null, pool: 0, single: true, loadMs: 0, lags: [], passes: 0, slow: false };
window.__stt = stats;

export function lastFetchIssue() { return fetchIssue; }
export function activeTier() { return tier; }
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
    const t0 = performance.now();
    const mod = await import(RUNTIME + 'index.js');
    tier = chooseTier();
    plan = threadPlan();
    const spec = TIERS[tier];
    const dir = MODELS + spec.dir;
    stats.tier = tier;
    stats.pool = plan.pool;
    stats.single = plan.single;
    const files = {};
    for (const name of MODEL_FILES) files[name] = dir + name;
    const opts = {
      modelArch: mod.ModelArch[spec.arch],
      wasmUrl: RUNTIME + 'moonshine.wasm',
      moduleOptions: {
        pthreadPoolSize: plan.pool,
        env: plan.single ? { MOONSHINE_ORT_SINGLE_THREAD: '1' } : {},
      },
    };
    if (onProgress) {
      // The downloader reports positionally — (loadedBytes, totalBytes, file) — and loadFromUrls
      // opens its session without a declared total, so the bytes are cumulative across all
      // files and the total is undefined. Reading the first argument as an object left the dial
      // pinned at zero for the whole load.
      let seen = 0;
      opts.onProgress = (loaded, total) => {
        const bytes = Number(loaded) || 0;
        const whole = Number(total) || spec.bytes;
        seen = Math.max(seen, bytes / whole);
        onProgress(Math.max(0, Math.min(0.995, seen)));
      };
    }
    try {
      transcriber = await mod.Transcriber.loadFromUrls(files, opts);
    } catch (err) {
      // The engine stores its weights in Cache Storage, so it must fetch the real URLs
      // itself. Verify what the network actually delivered before blaming the model.
      fetchIssue = await auditDelivery(dir);
      throw err;
    }
    stats.loadMs = Math.round(performance.now() - t0);
    return transcriber;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

// Judged on the engine's own pass cost: when the first passes of a session each take longer
// than the audio they cover, the next visit opens one tier down. A device is never pushed
// below tiny, and a forced ?stt= is never overruled.
function judgePace(listener) {
  if (stats.slow || stats.lags.length < SLOW_SKIP + SLOW_SAMPLE) return;
  const sorted = stats.lags.slice(SLOW_SKIP, SLOW_SKIP + SLOW_SAMPLE).sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  if (median <= 500 * SLOW_RATIO) return;
  stats.slow = true;
  const at = ORDER.indexOf(tier);
  if (at > 0 && !param('stt')) {
    remember(ORDER[at - 1]);
    if (listener.onSlow) listener.onSlow({ tier, next: ORDER[at - 1], medianMs: median });
  } else if (listener.onSlow) {
    listener.onSlow({ tier, next: tier, medianMs: median });
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
    if (typeof line.lastTranscriptionLatencyMs === 'number' && line.lastTranscriptionLatencyMs > 0) {
      stats.lags.push(line.lastTranscriptionLatencyMs);
      stats.passes += 1;
      if (listener.onLag) listener.onLag(line.lastTranscriptionLatencyMs);
      judgePace(listener);
    }
  };
  transcriber.createStream({});
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
    },
  };
}
