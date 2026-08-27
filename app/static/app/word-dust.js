// Speech becomes writing. Vapour gathers where the words will be, then real letterforms
// are revealed through it, left to right — the smoke eats the edges of the glyphs until
// the phrase settles. Never beads, never a hard paste-in.

const MAX_PUFFS = 90;

export function createWordDust(host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dust-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });

  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d');

  // one soft puff, drawn many times — smoke is overlapping volume
  const puff = document.createElement('canvas');
  puff.width = 128;
  puff.height = 128;
  {
    const pc = puff.getContext('2d');
    const g = pc.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.14)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.03)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    pc.fillStyle = g;
    pc.fillRect(0, 0, 128, 128);
  }

  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let words = [];
  let puffs = [];
  let raf = 0;
  let running = false;
  let lastAt = 0;
  let writeHeadAt = 0;

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(2, Math.floor(r.width * dpr));
    canvas.height = Math.max(2, Math.floor(r.height * dpr));
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    scratch.width = canvas.width;
    scratch.height = canvas.height;
  }

  function curl(x, y, t) {
    const s = 0.0030;
    return [
      Math.sin(y * s + t * 0.19) + 0.5 * Math.sin(y * s * 2.1 - t * 0.11),
      Math.cos(x * s * 1.1 - t * 0.15) + 0.5 * Math.cos(x * s * 2.6 + t * 0.09),
    ];
  }

  // Voice heard: vapour gathers along the line the words will occupy.
  function breathe(level) {
    const want = Math.min(MAX_PUFFS, Math.round(14 + level * 46));
    if (puffs.length >= want) return;
    puffs.push({
      x: canvas.width * (0.18 + Math.random() * 0.64),
      y: canvas.height * (0.44 + Math.random() * 0.28),
      vx: (Math.random() - 0.5) * 0.16 * dpr,
      vy: -(0.02 + Math.random() * 0.08) * dpr,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.008,
      r0: (26 + Math.random() * 46) * dpr,
      grow: (0.08 + Math.random() * 0.16) * dpr,
      span: 260 + Math.random() * 240,
      life: 0,
    });
    start();
  }

  // A word joins the line and waits its turn to be written.
  function spawn(span) {
    const hostRect = host.getBoundingClientRect();
    const r = span.getBoundingClientRect();
    const label = span.textContent || '';
    if (!label.trim() || r.width < 1) return;
    const cs = window.getComputedStyle(span);
    const nowMs = performance.now();
    let perLetter = 78;
    const backlog = Math.max(0, writeHeadAt - nowMs);
    if (backlog > 900) perLetter = 34;
    else if (backlog > 420) perLetter = 54;
    const duration = Math.max(200, label.trim().length * perLetter);
    const startAt = Math.max(nowMs, writeHeadAt);
    writeHeadAt = startAt + duration + 40;
    words.push({
      text: label,
      x: (r.left - hostRect.left) * dpr,
      y: (r.top - hostRect.top) * dpr,
      w: r.width * dpr,
      h: r.height * dpr,
      font: `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * dpr}px ${cs.fontFamily}`,
      baseline: parseFloat(cs.fontSize) * dpr * 0.8,
      startAt,
      duration,
      seed: Math.random() * 1000,
    });
    start();
  }

  // The reveal edge is ragged and breathing — vapour eating into the glyphs.
  function maskWord(word, progress, t) {
    const pad = 26 * dpr;
    const left = word.x - pad;
    const width = word.w + pad * 2;
    const edgeX = left + width * progress;
    const feather = 62 * dpr;
    sctx.globalCompositeOperation = 'destination-in';
    const grad = sctx.createLinearGradient(edgeX - feather, 0, edgeX + feather * 0.35, 0);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(left, word.y - pad, width, word.h + pad * 2);
    // ragged bites out of the leading edge so it never reads as a wipe
    sctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5; i += 1) {
      const ph = word.seed + i * 1.7;
      const bx = edgeX + Math.sin(t * 0.9 + ph) * 26 * dpr - i * 9 * dpr;
      const by = word.y + word.h * (0.18 + 0.66 * ((Math.sin(ph * 3.1) + 1) / 2));
      const br = (13 + 12 * ((Math.cos(ph * 2.3) + 1) / 2)) * dpr;
      sctx.globalAlpha = 0.5;
      sctx.drawImage(puff, bx - br, by - br, br * 2, br * 2);
    }
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(2.4, lastAt ? (now - lastAt) / 16.7 : 1);
    lastAt = now;
    const t = now * 0.001;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // smoke first, beneath the writing
    ctx.globalCompositeOperation = 'lighter';
    for (let i = puffs.length - 1; i >= 0; i -= 1) {
      const h = puffs[i];
      h.life += dt;
      const aged = h.life / h.span;
      if (aged >= 1) { puffs.splice(i, 1); continue; }
      const [cx, cy] = curl(h.x, h.y, t);
      h.vx += cx * 0.016 * dpr * dt;
      h.vy += (cy * 0.012 - 0.004) * dpr * dt;
      // vapour is allowed to come to rest
      const calm = Math.pow(0.968, dt);
      h.vx *= calm;
      h.vy *= calm;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.spin * dt;
      const radius = h.r0 + h.life * h.grow;
      const alpha = 0.05 * Math.min(1, aged * 6) * Math.pow(1 - aged, 1.35);
      if (alpha <= 0.002) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.drawImage(puff, -radius, -radius * 0.72, radius * 2, radius * 1.44);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';

    // then the words, each revealed through the vapour
    let pending = false;
    for (const word of words) {
      const elapsed = now - word.startAt;
      if (elapsed < 0) { pending = true; continue; }
      const progress = Math.min(1, elapsed / word.duration);
      if (progress < 1) pending = true;
      const settle = Math.min(1, Math.max(0, (elapsed - word.duration) / 620));
      if (settle < 1) pending = true;
      const rx = Math.max(0, word.x - 46 * dpr);
      const ry = Math.max(0, word.y - 46 * dpr);
      const rw = Math.min(canvas.width - rx, word.w + 92 * dpr);
      const rh = Math.min(canvas.height - ry, word.h + 92 * dpr);
      sctx.clearRect(rx, ry, rw, rh);
      const blur = (1 - settle) * 2.4;
      sctx.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
      sctx.fillStyle = 'rgba(246, 248, 255, 0.97)';
      sctx.font = word.font;
      sctx.textBaseline = 'alphabetic';
      sctx.fillText(word.text, word.x, word.y + word.baseline);
      sctx.filter = 'none';
      if (progress < 1 || settle < 1) maskWord(word, progress, t);
      if (rw > 0 && rh > 0) ctx.drawImage(scratch, rx, ry, rw, rh, rx, ry, rw, rh);
    }

    if (puffs.length || pending) raf = requestAnimationFrame(frame);
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
      words = [];
      puffs = [];
      writeHeadAt = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    disperse() {
      for (const h of puffs) { h.vy -= 0.35 * dpr; h.grow += 0.4; }
      words = [];
      start();
      window.setTimeout(() => {
        puffs = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 1200);
    },
  };
}
