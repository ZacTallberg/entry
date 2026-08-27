// Words arrive as dust. Each new word's glyphs are rasterized offscreen and sampled into
// target points; motes stream in from off-center, gather into the letterforms, and keep
// breathing there — close to type, never hard type.

const MAX_MOTES = 9000;
const STRIDE = 2;
const PALETTE = [
  [214, 226, 255],
  [186, 205, 255],
  [206, 190, 255],
  [255, 232, 214],
];

export function createWordDust(host, mirror) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dust-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { willReadFrequently: true });

  const MAX_HAZE = 130;
  // one soft puff, drawn many times — real smoke is overlapping volume, not dots
  const puff = document.createElement('canvas');
  puff.width = 128;
  puff.height = 128;
  {
    const pc = puff.getContext('2d');
    const g = pc.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.20)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    pc.fillStyle = g;
    pc.fillRect(0, 0, 128, 128);
  }
  // a cheap curl field: smoke must turn through the air, not drift in a line
  function curl(x, y, t) {
    const s = 0.0032;
    const a = Math.sin(y * s + t * 0.21) + 0.6 * Math.sin(y * s * 2.3 - t * 0.13);
    const b = Math.cos(x * s * 1.1 - t * 0.17) + 0.6 * Math.cos(x * s * 2.7 + t * 0.11);
    return [a, b];
  }
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let motes = [];
  let haze = [];
  let raf = 0;
  let running = false;
  let lastAt = 0;
  let seedCounter = 0;
  // the writing hand: words queue behind one another so the line is written, not bloomed
  let writeHeadAt = 0;

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(2, Math.floor(r.width * dpr));
    canvas.height = Math.max(2, Math.floor(r.height * dpr));
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
  }

  // A word's glyphs become a cloud of destinations.
  function sampleWord(span) {
    const hostRect = host.getBoundingClientRect();
    const r = span.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return [];
    const cs = window.getComputedStyle(span);
    const w = Math.ceil(r.width * dpr) + 8;
    const h = Math.ceil(r.height * dpr) + 8;
    off.width = w;
    off.height = h;
    offCtx.clearRect(0, 0, w, h);
    offCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * dpr}px ${cs.fontFamily}`;
    offCtx.textBaseline = 'alphabetic';
    offCtx.fillStyle = '#fff';
    const baseline = (parseFloat(cs.fontSize) * dpr) * 0.82 + 2;
    offCtx.fillText(span.textContent, 2, baseline);
    const data = offCtx.getImageData(0, 0, w, h).data;
    const originX = (r.left - hostRect.left) * dpr;
    const originY = (r.top - hostRect.top) * dpr;
    const points = [];
    for (let y = 0; y < h; y += STRIDE) {
      for (let x = 0; x < w; x += STRIDE) {
        if (data[(y * w + x) * 4 + 3] > 110) {
          points.push(originX + x - 2, originY + y - 2);
        }
      }
    }
    return points;
  }

  // Voice heard: smoke gathers in the writing band before any word exists.
  function breathe(level) {
    const want = Math.min(MAX_HAZE, Math.round(20 + level * 90));
    const add = Math.min(3, want - haze.length);
    for (let i = 0; i < add; i += 1) {
      haze.push({
        x: canvas.width * (0.16 + Math.random() * 0.68),
        y: canvas.height * (0.42 + Math.random() * 0.34),
        vx: (Math.random() - 0.5) * 0.22 * dpr,
        vy: -(0.05 + Math.random() * 0.16) * dpr,
        spin: (Math.random() - 0.5) * 0.012,
        rot: Math.random() * Math.PI * 2,
        r0: (16 + Math.random() * 30) * dpr,
        grow: (0.16 + Math.random() * 0.3) * dpr,
        span: 190 + Math.random() * 190,
        tint: PALETTE[(Math.random() * PALETTE.length) | 0],
        warm: Math.random() * 0.6,
        life: 0,
      });
    }
    if (haze.length) start();
  }

  // A word claims the smoke nearest each of its letter points; the rest arrives from the dark.
  function recruit(tx, ty) {
    if (!haze.length) return null;
    let best = -1;
    let bestD = Infinity;
    const probes = Math.min(haze.length, 9);
    for (let i = 0; i < probes; i += 1) {
      const idx = (Math.random() * haze.length) | 0;
      const h = haze[idx];
      const d = (h.x - tx) * (h.x - tx) + (h.y - ty) * (h.y - ty);
      if (d < bestD) { bestD = d; best = idx; }
    }
    if (best < 0) return null;
    const claimed = haze[best];
    haze.splice(best, 1);
    return claimed;
  }

  function spawn(span) {
    const points = sampleWord(span);
    if (!points.length) return;
    seedCounter += 1;
    const reach = Math.max(canvas.width, canvas.height);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      if (points[i] < minX) minX = points[i];
      if (points[i] > maxX) maxX = points[i];
    }
    const wordSpan = Math.max(1, maxX - minX);
    const nowMs = performance.now();
    const letters = Math.max(1, (span.textContent || '').trim().length);
    // ~105ms a letter, compressed if the hand is falling behind the voice
    let perLetter = 6.3;
    const backlog = Math.max(0, writeHeadAt - nowMs);
    if (backlog > 900) perLetter *= 0.45;
    else if (backlog > 420) perLetter *= 0.7;
    const wordFrames = letters * perLetter;
    const startMs = Math.max(nowMs, writeHeadAt);
    const startFrames = (startMs - nowMs) / 16.7;
    writeHeadAt = startMs + wordFrames * 16.7 + 40;
    for (let i = 0; i < points.length; i += 2) {
      if (motes.length >= MAX_MOTES) motes.shift();
      const tint = PALETTE[(i + seedCounter) % PALETTE.length];
      // the word writes itself left to right; each mote waits its turn
      const along = (points[i] - minX) / wordSpan;
      const delay = startFrames + along * wordFrames + Math.random() * 2.5;
      // and drifts in from its own direction — smoke arriving from everywhere
      const a = Math.random() * Math.PI * 2;
      const far = (0.3 + Math.random() * 0.55) * reach;
      const big = Math.random() < 0.09;
      const claimed = recruit(points[i], points[i + 1]);
      motes.push({
        x: claimed ? claimed.x : points[i] + Math.cos(a) * far,
        y: claimed ? claimed.y : points[i + 1] + Math.sin(a) * far * 0.5,
        tx: points[i],
        ty: points[i + 1],
        vx: 0,
        vy: 0,
        k: 0.019 + Math.random() * 0.016,
        drag: 0.9 + Math.random() * 0.045,
        phase: Math.random() * Math.PI * 2,
        wob: (0.3 + Math.random() * 0.62) * dpr,
        bobRate: 0.8 + Math.random() * 0.9,
        size: (big ? 1.5 + Math.random() * 1.1 : 0.8 + Math.random() * 0.6) * dpr,
        halo: big,
        warm: Math.random() * 0.5,
        tint,
        delay,
        life: 0,
      });
    }
    start();
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(2.4, lastAt ? (now - lastAt) / 16.7 : 1);
    lastAt = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    let alive = 0;
    const fadeW = 46 * dpr;
    for (let i = 0; i < motes.length; i += 1) {
      const m = motes[i];
      m.life += dt;
      if (m.life < m.delay) continue;
      // straight for the letter, held back by drag — smoke settling, not orbiting
      const dx = m.tx - m.x;
      const dy = m.ty - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      m.vx += dx * m.k * dt;
      m.vy += dy * m.k * dt;
      m.vx *= Math.pow(m.drag, dt);
      m.vy *= Math.pow(m.drag, dt);
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      // always bobbing — the letters never harden
      const t = m.life * 0.05 * m.bobRate + m.phase;
      const bx = Math.sin(t) * m.wob;
      const by = Math.cos(t * 0.77) * m.wob * 0.85;
      const near = 1 - Math.min(1, dist / (200 * dpr));
      const px = m.x + bx;
      const py = m.y + by;
      // nothing may pile up against the frame — motes dissolve before the edge
      const edge = Math.min(
        1,
        Math.max(0, px) / fadeW,
        Math.max(0, canvas.width - px) / fadeW,
        Math.max(0, py) / fadeW,
        Math.max(0, canvas.height - py) / fadeW,
      );
      const ramp = Math.min(1, (m.life - m.delay) / 10);
      const alpha = Math.min(1, 0.04 + near * near * 1.0) * edge * ramp;
      if (alpha <= 0.012) continue;
      const size = m.size * (0.7 + near * 0.6);
      const r = Math.round(m.tint[0] + m.warm * 22);
      const g = Math.round(m.tint[1] - m.warm * 6);
      const b = Math.round(m.tint[2] - m.warm * 26);
      if (m.halo) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.11).toFixed(3)})`;
        ctx.fillRect(px - size, py - size, size * 3, size * 3);
      }
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
      ctx.fillRect(px, py, size, size);
      if (dist > 0.6 * dpr || Math.abs(m.vx) > 0.02) alive += 1;
    }
    // unclaimed smoke: volume that turns through the air, swells, and thins away
    const clock = now * 0.001;
    for (let i = haze.length - 1; i >= 0; i -= 1) {
      const h = haze[i];
      h.life += dt;
      const aged = h.life / h.span;
      if (aged >= 1) { haze.splice(i, 1); continue; }
      const [cx, cy] = curl(h.x, h.y, clock);
      h.vx += cx * 0.026 * dpr * dt;
      h.vy += (cy * 0.02 - 0.006) * dpr * dt;
      h.vx *= Math.pow(0.985, dt);
      h.vy *= Math.pow(0.985, dt);
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.spin * dt;
      const radius = h.r0 + h.life * h.grow;
      // in fast, out slow — a breath of vapour
      const alpha = 0.115 * Math.min(1, aged * 7) * Math.pow(1 - aged, 1.5);
      const edge = Math.min(
        1,
        Math.max(0, h.x) / (fadeW * 2),
        Math.max(0, canvas.width - h.x) / (fadeW * 2),
        Math.max(0, h.y) / (fadeW * 1.4),
        Math.max(0, canvas.height - h.y) / (fadeW * 1.4),
      );
      const a = alpha * edge;
      if (a <= 0.004) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.drawImage(puff, -radius, -radius * 0.78, radius * 2, radius * 1.56);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (motes.length || haze.length) raf = requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (running) return;
    running = true;
    lastAt = 0;
    raf = requestAnimationFrame(frame);
  }

  return {
    resize,
    spawn,
    breathe,
    clear() {
      motes = [];
      haze = [];
      writeHeadAt = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    // words drift apart when the field takes them
    disperse() {
      for (const m of motes) {
        m.k = 0;
        m.vx += (Math.random() - 0.5) * 6 * dpr;
        m.vy += (Math.random() - 0.5) * 6 * dpr - 1.2 * dpr;
        m.drag = 0.985;
      }
      for (const h of haze) { h.vy -= 0.5 * dpr; h.grow += 0.5; }
      window.setTimeout(() => {
        motes = [];
        haze = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 1400);
      start();
    },
  };
}
