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
// A pass this cheap leaves room for the next tier up: a phone that decodes tiny in 99 ms a
// pass carries small, which costs three to four times as much, well inside the slow line.
// Promotion stops at small; medium is only ever asked for.
const FAST_MS = 150;
const TOP_AUTO = 'small';
// A tier the judge once stepped down from is this device's ceiling until a forced ?stt=
// clears it, so a promotion can never climb back into a pace that already failed.
const CEILING_KEY = 'entry:stt-ceiling';
// Seconds of new audio the stream collects before it runs another pass. The runtime's own
// default is half a second; the library already stretches the gate to whatever a pass
// costs, so a shorter one only runs more often where the device can afford it. The
// encoder itself looks 1.28 s ahead (total_lookahead 16 frames of 80 ms), which is the
// floor under any first word and is not ours to move. ?sttint= overrides.
const DEFAULT_INTERVAL = 0.25;

function param(name) {
  try { return new URLSearchParams(window.location.search).get(name); } catch (_e) { return null; }
}

function remembered() {
  try { return localStorage.getItem(TIER_KEY); } catch (_e) { return null; }
}

function remember(tier) {
  try { localStorage.setItem(TIER_KEY, tier); } catch (_e) {}
}

function ceiling() {
  try { return localStorage.getItem(CEILING_KEY); } catch (_e) { return null; }
}

function setCeiling(tier) {
  try { localStorage.setItem(CEILING_KEY, tier); } catch (_e) {}
}

export function updateInterval() {
  const asked = Number(param('sttint') || 0);
  return asked > 0 ? asked : DEFAULT_INTERVAL;
}

export function supportReasons() {
  return {
    sab: typeof SharedArrayBuffer === 'function',
    iso: typeof crossOriginIsolated !== 'undefined' && !!crossOriginIsolated,
    worker: typeof Worker === 'function',
  };
}

// The device's class decides the opening tier. A desktop with cores to spare carries the
// small model; everything else, phones included, starts on tiny. Medium is never chosen on
// its own: on a 13th-gen laptop core it ran a second and a half behind the voice. A forced
// ?stt= wins and clears what the device remembered about itself; otherwise the tier a
// previous visit measured its way to, down or up, outranks the class guess, as long as it
// stays under the ceiling the judge once set.
export function chooseTier() {
  const forced = param('stt');
  if (forced && TIERS[forced]) {
    try { localStorage.removeItem(TIER_KEY); localStorage.removeItem(CEILING_KEY); } catch (_e) {}
    return forced;
  }
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
  let tier = 'tiny';
  if (fine && cores >= 8 && mem >= 8) tier = 'small';
  const past = remembered();
  if (past && TIERS[past]) tier = past;
  const cap = ceiling();
  if (cap && TIERS[cap] && ORDER.indexOf(cap) > 0 && ORDER.indexOf(tier) >= ORDER.indexOf(cap)) {
    tier = ORDER[ORDER.indexOf(cap) - 1];
  }
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
// The engine's home. The runtime's worker host keeps every pass off the page thread, which
// is where the field draws; the in-page transcriber stays as the fallback for a browser
// that cannot nest workers. ?sttplace=page forces the fallback for a comparison.
let host = null;
let streamSeq = 0;
let workerIssue = '';
let loading = null;
let fetchIssue = '';
let tier = null;
let plan = null;
const stats = { tier: null, pool: 0, single: true, loadMs: 0, lags: [], passes: 0, slow: false, fast: false, interval: 0, place: '' };
window.__stt = stats;

export function lastFetchIssue() { return fetchIssue; }
export function enginePlace() { return stats.place; }
export function lastWorkerIssue() { return workerIssue; }
export function activeTier() { return tier; }
export function streamingSupported() {
  return typeof SharedArrayBuffer === 'function'
    && typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
    && typeof Worker === 'function';
}

export async function loadStreaming(onProgress) {
  if (host || transcriber) return host || transcriber;
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
    if (param('sttplace') !== 'page') {
      let h = null;
      try {
        const hostMod = await import(RUNTIME + 'stt-worker-host.js');
        if (!hostMod.sttWorkerSupported()) throw new Error('no worker here');
        h = new hostMod.SttWorkerHost();
        if (opts.onProgress) h.onProgress = (_id, loaded, total) => opts.onProgress(loaded, total);
        await h.loadTranscriber({
          transcriberId: 'entry',
          modelArch: opts.modelArch,
          source: { kind: 'urls', files },
          pthreadPoolSize: plan.pool,
          env: opts.moduleOptions.env,
        });
        host = h;
        stats.place = 'worker';
      } catch (err) {
        workerIssue = String((err && err.message) || err).slice(0, 160);
        try { if (h) h.close(); } catch (_e) {}
      }
    }
    if (!host) {
      try {
        transcriber = await mod.Transcriber.loadFromUrls(files, opts);
        stats.place = 'page';
      } catch (err) {
        // The engine stores its weights in Cache Storage, so it must fetch the real URLs
        // itself. Verify what the network actually delivered before blaming the model.
        fetchIssue = await auditDelivery(dir);
        throw err;
      }
    }
    stats.loadMs = Math.round(performance.now() - t0);
    return host || transcriber;
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
  if (stats.slow || stats.fast || stats.lags.length < SLOW_SKIP + SLOW_SAMPLE) return;
  const sorted = stats.lags.slice(SLOW_SKIP, SLOW_SKIP + SLOW_SAMPLE).sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  const at = ORDER.indexOf(tier);
  if (median > 500 * SLOW_RATIO) {
    stats.slow = true;
    if (at > 0 && !param('stt')) {
      remember(ORDER[at - 1]);
      setCeiling(tier);
      if (listener.onSlow) listener.onSlow({ tier, next: ORDER[at - 1], medianMs: median });
    } else if (listener.onSlow) {
      listener.onSlow({ tier, next: tier, medianMs: median });
    }
    return;
  }
  if (median <= FAST_MS && at < ORDER.indexOf(TOP_AUTO) && !param('stt')) {
    const next = ORDER[at + 1];
    const cap = ceiling();
    if (cap && TIERS[cap] && ORDER.indexOf(next) >= ORDER.indexOf(cap)) return;
    stats.fast = true;
    remember(next);
    if (listener.onFast) listener.onFast({ tier, next, medianMs: median });
  }
}

// The listener receives every revision of the in-flight line plus each committed line.
export function openStream(listener) {
  if (!host && !transcriber) throw new Error('not loaded');
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
    lines.set(id, { text: line.text.trim(), complete: complete || !!line.isComplete });
    emit();
    if (typeof line.lastTranscriptionLatencyMs === 'number' && line.lastTranscriptionLatencyMs > 0) {
      stats.lags.push(line.lastTranscriptionLatencyMs);
      stats.passes += 1;
      if (listener.onLag) listener.onLag(line.lastTranscriptionLatencyMs);
      judgePace(listener);
    }
  };
  // One stream per session, closed with it. The runtime's convenience methods all drive a
  // single default stream that keeps its lines and is never released; a stream of our own
  // starts empty, carries the pass gate, and frees its engine state when the microphone
  // closes, so a second utterance can never inherit the first one's words.
  stats.interval = updateInterval();
  const events = {
    onLineStarted: (e) => upsert(e.line, false),
    onLineUpdated: (e) => upsert(e.line, false),
    onLineTextChanged: (e) => upsert(e.line, false),
    onLineCompleted: (e) => upsert(e.line, true),
    onError: (e) => listener.onError && listener.onError(String((e && e.error) || e)),
  };
  if (host) {
    // The worker answers create and start in order; audio that arrives before the start
    // is acknowledged waits here, because the worker ingests audio the moment it lands
    // and would not yet know the stream.
    const id = 's' + (streamSeq += 1);
    const fail = (err) => listener.onError && listener.onError(String((err && err.message) || err));
    host.setListener(id, events);
    let queued = [];
    let live = false;
    const ready = host.createStream('entry', id, { updateInterval: stats.interval })
      .then(() => host.start(id))
      .then(() => {
        live = true;
        for (const [s, r] of queued) host.addAudio(id, s, r);
        queued = [];
      })
      .catch(fail);
    return {
      addAudio(samples, sampleRate) {
        if (!live) { queued.push([samples.slice(0), sampleRate]); return; }
        try { host.addAudio(id, samples, sampleRate); } catch (err) { fail(err); }
      },
      stop() {
        // The worker's forced final pass answers after this returns; the caller keeps
        // listening to this session's events until the stream is closed.
        const done = ready.then(() => host.stop(id)).then(() => host.closeStream(id)).catch(() => {});
        return done.then(() => { lines.clear(); });
      },
    };
  }
  const stream = transcriber.createStream({ updateInterval: stats.interval });
  stream.addListener(events);
  stream.start();
  return {
    addAudio(samples, sampleRate) {
      try {
        stream.addAudio(samples, sampleRate);
        stream.transcribe();
      } catch (err) {
        listener.onError && listener.onError(String((err && err.message) || err));
      }
    },
    stop() {
      try { stream.stop(); } catch (_e) {}
      try { stream.removeAllListeners(); } catch (_e) {}
      try { stream.close(); } catch (_e) {}
      lines.clear();
      return Promise.resolve();
    },
  };
}
