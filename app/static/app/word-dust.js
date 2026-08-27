// Words arrive as dust. Each new word's glyphs are rasterized offscreen and sampled into
// target points; motes stream in from off-center, gather into the letterforms, and keep
// breathing there — close to type, never hard type.

const MAX_MOTES = 4200;
const STRIDE = 3;
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

  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let motes = [];
  let raf = 0;
  let running = false;
  let lastAt = 0;
  let seedCounter = 0;

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

  function spawn(span) {
    const points = sampleWord(span);
    if (!points.length) return;
    seedCounter += 1;
    const reach = Math.max(canvas.width, canvas.height);
    for (let i = 0; i < points.length; i += 2) {
      if (motes.length >= MAX_MOTES) motes.shift();
      const tint = PALETTE[(i + seedCounter) % PALETTE.length];
      // each mote drifts in from its own direction — smoke arriving from everywhere
      const a = Math.random() * Math.PI * 2;
      const far = (0.45 + Math.random() * 0.75) * reach;
      motes.push({
        x: points[i] + Math.cos(a) * far,
        y: points[i + 1] + Math.sin(a) * far * 0.55,
        tx: points[i],
        ty: points[i + 1],
        vx: 0,
        vy: 0,
        k: 0.019 + Math.random() * 0.016,
        drag: 0.9 + Math.random() * 0.045,
        phase: Math.random() * Math.PI * 2,
        wob: (0.45 + Math.random() * 0.85) * dpr,
        bobRate: 0.8 + Math.random() * 0.9,
        size: (1.05 + Math.random() * 1.15) * dpr,
        tint,
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
    for (let i = 0; i < motes.length; i += 1) {
      const m = motes[i];
      m.life += dt;
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
      const alpha = Math.min(1, 0.06 + near * near * 1.0);
      ctx.fillStyle = `rgba(${m.tint[0]}, ${m.tint[1]}, ${m.tint[2]}, ${alpha.toFixed(3)})`;
      const size = m.size * (0.7 + near * 0.6);
      ctx.fillRect(m.x + bx, m.y + by, size, size);
      if (dist > 0.6 * dpr || Math.abs(m.vx) > 0.02) alive += 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    if (motes.length) raf = requestAnimationFrame(frame);
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
    clear() {
      motes = [];
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
      window.setTimeout(() => {
        motes = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 1400);
      start();
    },
  };
}
