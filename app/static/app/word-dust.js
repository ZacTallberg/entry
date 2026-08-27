// Speech becomes writing. Vapour gathers where the words will be, then real letterforms
// are revealed through it, left to right — the smoke eats the edges of the glyphs until
// the phrase settles. Never beads, never a hard paste-in.

const MAX_PUFFS = 150;

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
    const want = Math.min(MAX_PUFFS, Math.round(26 + level * 90));
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

  // The line is re-synced on every revision: words that survive keep their timing and
  // simply move; words that changed are rewritten; words that vanished are dropped. The
  // engine revises constantly, so nothing may be pinned to a stale position.
  function sync(spans) {
    const hostRect = host.getBoundingClientRect();
    const next = [];
    for (let i = 0; i < spans.length; i += 1) {
      const span = spans[i];
      const label = span.textContent || '';
      if (!label.trim()) continue;
      const r = span.getBoundingClientRect();
      if (r.width < 1) continue;
      const prev = words[next.length];
      if (prev && prev.label === label) {
        prev.x = (r.left - hostRect.left) * dpr;
        prev.y = (r.top - hostRect.top) * dpr;
        prev.w = r.width * dpr;
        prev.h = r.height * dpr;
        next.push(prev);
        continue;
      }
      const built = build(span, r, hostRect);
      if (built) next.push(built);
    }
    words = next;
    if (words.length) start();
  }

  function build(span, r, hostRect) {
    const label = span.textContent || '';
    const cs = window.getComputedStyle(span);
    const nowMs = performance.now();
    let perLetter = 78;
    const backlog = Math.max(0, writeHeadAt - nowMs);
    if (backlog > 900) perLetter = 34;
    else if (backlog > 420) perLetter = 54;
    const duration = Math.max(200, label.trim().length * perLetter);
    const startAt = Math.max(nowMs, writeHeadAt);
    writeHeadAt = startAt + duration + 40;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * dpr}px ${cs.fontFamily}`;
    sctx.font = font;
    const chars = [];
    let cursor = 0;
    for (let i = 0; i < label.length; i += 1) {
      const ch = label[i];
      const wid = sctx.measureText(ch).width;
      if (ch.trim()) {
        chars.push({
          ch,
          dx: cursor,
          at: startAt + chars.length * perLetter,
          seed: Math.random() * 1000,
        });
      }
      cursor += wid;
    }
    return {
      label,
      x: (r.left - hostRect.left) * dpr,
      y: (r.top - hostRect.top) * dpr,
      w: r.width * dpr,
      h: r.height * dpr,
      font,
      baseline: parseFloat(cs.fontSize) * dpr * 0.8,
      chars,
      startAt,
      duration,
    };
  }

  const CHAR_FADE = 380;

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
      const alpha = 0.085 * Math.min(1, aged * 6) * Math.pow(1 - aged, 1.3);
      if (alpha <= 0.002) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.drawImage(puff, -radius, -radius * 0.72, radius * 2, radius * 1.44);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';

    // then the letters, each one condensing in its turn
    let pending = false;
    ctx.textBaseline = 'alphabetic';
    for (const word of words) {
      const baseY = word.y + word.baseline;
      let leaving = 0;
      if (word.dissolveAt) {
        leaving = Math.min(1, Math.max(0, (now - word.dissolveAt) / 780));
        if (leaving >= 1) continue;
        pending = true;
      }
      for (const c of word.chars) {
        const age = now - c.at;
        if (age < 0) { pending = true; continue; }
        const a = Math.min(1, age / CHAR_FADE);
        if (a < 1) pending = true;
        const x = word.x + c.dx;
        // the letter's own breath of vapour, thinning as it condenses
        if (a < 1) {
          // each letter arrives wrapped in its own vapour
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let q = 0; q < 3; q += 1) {
            const spread = (1 - a) * (10 + q * 9) * dpr;
            const puffR = (18 + q * 12 + 26 * (1 - a)) * dpr;
            ctx.globalAlpha = (0.34 - q * 0.08) * (1 - a * 0.85);
            ctx.save();
            ctx.translate(
              x + word.h * 0.16 + Math.sin(c.seed + q * 2.1 + t * 0.6) * spread,
              baseY - word.h * 0.3 + Math.cos(c.seed * 1.4 + q + t * 0.5) * spread * 0.6,
            );
            ctx.rotate(c.seed + q);
            ctx.drawImage(puff, -puffR, -puffR * 0.78, puffR * 2, puffR * 1.56);
            ctx.restore();
          }
          ctx.restore();
        }
        ctx.font = word.font;
        const blur = (1 - a) * 7 + leaving * 9;
        const alpha = Math.min(1, a * 1.25) * (1 - leaving);
        const lift = (1 - a) * 2 * dpr - leaving * 10 * dpr;
        if (blur > 0.05 || alpha < 1) {
          ctx.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle = 'rgba(246, 248, 255, 0.97)';
          ctx.fillText(c.ch, x, baseY + lift);
          ctx.filter = 'none';
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = 'rgba(246, 248, 255, 0.97)';
          ctx.fillText(c.ch, x, baseY);
        }
      }
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
    sync,
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
    // the dark takes the words: they blur, lift, and leave vapour behind
    disperse() {
      const at = performance.now();
      for (const h of puffs) { h.vy -= 0.3 * dpr; h.grow += 0.35; }
      for (const word of words) {
        word.dissolveAt = at + Math.random() * 160;
        for (let ci = 0; ci < word.chars.length; ci += 3) {
          const c = word.chars[ci];
          const puffR = (18 + Math.random() * 20) * dpr;
          puffs.push({
            x: word.x + c.dx,
            y: word.y + word.baseline - word.h * 0.3,
            vx: (Math.random() - 0.5) * 0.5 * dpr,
            vy: -(0.1 + Math.random() * 0.3) * dpr,
            rot: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.01,
            r0: puffR,
            grow: (0.3 + Math.random() * 0.4) * dpr,
            span: 130 + Math.random() * 110,
            life: 0,
          });
        }
      }
      start();
      window.setTimeout(() => {
        words = [];
        puffs = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 1500);
    },
  };
}
