import { FORMS, FORM_INDEX, FAMILIES } from 'forms';

let THREE;
let EffectComposer;
let RenderPass;
let UnrealBloomPass;
let OutputPass;
let graphicsModules;

const body = document.body;
const canvas = document.getElementById('particle-field');
const text = document.getElementById('entry-text');
const releaseButton = document.getElementById('release');
const status = document.getElementById('entry-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// ── deterministic-from-utterance, remembered nowhere: session salt dies with the tab ──
const sessionSalt = Math.floor(Math.random() * 0xffffffff);
const fnv = (str, seed = 0x811c9dc5) => {
  let h = (seed ^ sessionSalt) >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

// ─────────────────────────────────────── shader templates ──────────────────────────────────────
const GLSL_PRELUDE = `
  #ifndef FORM_HOME
  #define FORM_HOME 0.0032
  #endif
  #ifndef FORM_POINTER
  #define FORM_POINTER 1.0
  #endif
  #ifndef FORM_RELEASE
  #define FORM_RELEASE 1.0
  #endif
  #ifndef FORM_SPEED
  #define FORM_SPEED 1.0
  #endif
  #define PI 3.14159265359
  #define TAU 6.28318530718

  uniform float uTime;
  uniform float uDt;
  uniform float uSeed;
  uniform float uEnergy;
  uniform float uRelease;
  uniform float uPulse;
  uniform float uPulseType;
  uniform float uForm;
  uniform vec2 uPointer;
  uniform vec2 uPulseCenter;
  uniform vec2 uStir;

  mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
  vec3 hueRotate(vec3 c, float a) {
    const vec3 w = vec3(0.299, 0.587, 0.114);
    float l = dot(c, w);
    vec3 d = c - l;
    return l + d * cos(a) + cross(vec3(0.57735), d) * sin(a);
  }
  float idOf(vec3 o) { return fract(sin(dot(o, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  vec3 cosPal(float t, vec3 a, vec3 b, vec3 c, vec3 d) { return a + b * cos(TAU * (c * t + d)); }

  uniform highp sampler3D tNoise;
  uniform vec3 uNoiseOff;
  #define NOISE_PERIOD 16.0
  uniform float uOctave;
  vec4 noiseField(vec3 p) { return texture(tNoise, fract((p + uNoiseOff) * (1.0 / NOISE_PERIOD))); }
  float snoise(vec3 v) { return noiseField(v).a + uOctave * noiseField(v * 2.3 + 7.7).a * 0.5; }
  vec3 curlNoise(vec3 p) { return normalize(noiseField(p).rgb + uOctave * noiseField(p * 2.6 + 13.1).rgb * 0.6); }
`;

const simVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const buildSimFragment = (formDef) => `
  uniform sampler2D tPositions;
  uniform sampler2D tOrigin;
  varying vec2 vUv;
  ${formDef.defines || ''}
  ${GLSL_PRELUDE}
  ${formDef.force}

  uniform sampler2D tDensity;
  uniform float uDenseForce;
  uniform float uDenseSwirl;
  uniform float uRingR;
  uniform float uRingAmp;

  void main() {
    vec3 pos = texture2D(tPositions, vUv).xyz;
    vec3 origin = texture2D(tOrigin, vUv).xyz;
    vec3 velocity = formForce(pos, origin) * (0.7 + uEnergy * 0.6);

    if (abs(uDenseForce) > 0.001 || abs(uDenseSwirl) > 0.001) {
      vec2 duv = pos.xy * 0.147 + 0.5;
      float e = 0.02;
      float dxp = texture2D(tDensity, duv + vec2(e, 0.0)).r;
      float dxm = texture2D(tDensity, duv - vec2(e, 0.0)).r;
      float dyp = texture2D(tDensity, duv + vec2(0.0, e)).r;
      float dym = texture2D(tDensity, duv - vec2(0.0, e)).r;
      vec2 grad = vec2(dxp - dxm, dyp - dym);
      velocity.xy += grad * uDenseForce * 0.05;
      velocity.xy += vec2(-grad.y, grad.x) * uDenseSwirl * 0.05;
    }

    if (uRingAmp > 0.001) {
      float rd = length(pos.xy) - uRingR;
      velocity.xy += normalize(pos.xy + vec2(0.0001, 0.0)) * exp(-rd * rd * 9.0) * uRingAmp * 0.05;
    }

    vec2 pointerDelta = pos.xy - uPointer;
    float pointerDistance = max(length(pointerDelta), 0.12);
    vec3 pointerDirection = normalize(vec3(pointerDelta, pos.z * 0.2));
    velocity += pointerDirection * (0.0018 * FORM_POINTER / pointerDistance);
    velocity.xy += uStir * (0.16 * FORM_POINTER / (pointerDistance * pointerDistance + 0.4));

    vec2 pulseDelta = pos.xy - uPulseCenter;
    float pulseDistance = max(length(pulseDelta), 0.12);
    vec3 pulseDirection = normalize(vec3(pulseDelta, pos.z * 0.2));
    if (uPulse > 0.001) {
      float falloff = 1.0 / (pulseDistance + 0.18);
      if (uPulseType < 0.5) {
        velocity += pulseDirection * 0.035 * falloff * uPulse * FORM_POINTER;
      } else if (uPulseType < 1.5) {
        velocity -= pulseDirection * 0.025 * falloff * uPulse * FORM_POINTER;
      } else if (uPulseType < 2.5) {
        velocity += vec3(-pulseDirection.y, pulseDirection.x, 0.03) * 0.04 * falloff * uPulse * FORM_POINTER;
      } else {
        velocity += curlNoise(pos) * 0.055 * uPulse + pulseDirection * 0.02 * falloff * uPulse * FORM_POINTER;
      }
    }

    float centerDistance = max(length(pos), 0.12);
    velocity += normalize(pos) * uRelease * (0.036 * FORM_RELEASE / centerDistance);
    velocity += (origin - pos) * (FORM_HOME + uForm * 0.055);
    pos += velocity * FORM_SPEED * uDt;
    if (length(pos) > 6.5) pos = mix(pos, origin, 0.5);
    gl_FragColor = vec4(pos, 1.0);
  }
`;

const buildRenderVertex = (formDef) => `
  uniform sampler2D tPositions;
  uniform sampler2D tOrigin;
  uniform float uPointSize;
  uniform float uGlowAmt;
  ${formDef.defines || ''}
  #ifndef FORM_SIZE
  #define FORM_SIZE 1.0
  #endif
  #ifndef FORM_SHIMMER
  #define FORM_SHIMMER 0.18
  #endif
  ${GLSL_PRELUDE}
  varying vec3 vColor;
  ${formDef.color}

  uniform sampler2D tPrev;
  uniform float uIgnite;
  uniform float uHueShift;
  uniform float uFxTurb;
  uniform float uFxShimmer;
  uniform float uFxSizeWave;
  uniform float uFxFog;
  varying float vDepthA;
  void main() {
    vec3 p = texture2D(tPositions, position.xy).xyz;
    vec3 prev = texture2D(tPrev, position.xy).xyz;
    vec3 origin = texture2D(tOrigin, position.xy).xyz;
    float id = idOf(origin);
    float glow = uGlowAmt / (0.35 + length(p.xy - uPointer));
    float shimmerAmt = clamp(FORM_SHIMMER + uFxShimmer, 0.0, 0.85);
    float shimmer = (1.0 - shimmerAmt) + shimmerAmt * sin(uTime * 0.7 + p.x * 8.0 + p.y * 5.0 + id * 12.0);
    vec3 base = formColor(p, uTime, id, glow) * shimmer;
    base *= 1.0 - uFxTurb * 0.5 + uFxTurb * (snoise(p * 1.6 + uSeed * 0.13) * 0.5 + 0.5);
    base = hueRotate(base, uHueShift);
    float speed = length(p - prev);
    float ignite = smoothstep(0.02, 0.12, speed) * uIgnite;
    vColor = mix(base, vec3(1.0, 0.97, 0.9) * (1.0 + ignite * 1.6), ignite * 0.7);
    vDepthA = 1.0 - uFxFog * smoothstep(0.2, 1.6, abs(p.z));
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float size = uPointSize * FORM_SIZE / max(0.48, -mvPosition.z);
    size *= 1.0 + uFxSizeWave * 0.4 * sin(uTime * 1.9 + id * TAU);
    size *= 1.0 + uForm * 0.45;
    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const buildRenderFragment = () => `
  uniform float uExposure;
  uniform float uSoft;
  uniform float uAlpha;
  varying vec3 vColor;
  varying float vDepthA;
  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float core = pow(1.0 - radius * 2.0, uSoft);
    float skirt = exp(-radius * radius * 9.0) * 0.12;
    gl_FragColor = vec4(vColor * uExposure, (core + skirt) * uAlpha * vDepthA);
  }
`;

function orientOrigins(values, seedHash, originKind) {
  const glyph = originKind === 'glyph';
  const a = ((((seedHash >>> 5) % 1000) / 1000) - 0.5) * (glyph ? 0.24 : Math.PI * 2);
  const mirror = !glyph && ((seedHash >>> 16) & 1) === 1 ? -1 : 1;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (let i = 0; i < values.length; i += 4) {
    const x = values[i] * mirror;
    const y = values[i + 1];
    values[i] = x * ca - y * sa;
    values[i + 1] = x * sa + y * ca;
  }
}

// ─────────────────────────────────────── origin layouts ────────────────────────────────────────
const ORIGIN_GENERATORS = {
  nebula(values, rng) {
    for (let i = 0; i < values.length; i += 4) {
      const theta = rng() * Math.PI * 2;
      const radius = 0.72 + Math.pow(rng(), 0.62) * 1.62;
      const breathing = 1 + Math.sin(theta * 3) * 0.09;
      values[i] = Math.cos(theta) * radius * breathing;
      values[i + 1] = Math.sin(theta) * radius * 0.61;
      values[i + 2] = (rng() - 0.5) * (0.55 + radius * 0.34);
      values[i + 3] = 1;
    }
  },
  sphere(values, rng) {
    for (let i = 0; i < values.length; i += 4) {
      const u = rng() * 2 - 1;
      const theta = rng() * Math.PI * 2;
      const r = 1.15 + rng() * 0.55;
      const s = Math.sqrt(1 - u * u);
      values[i] = Math.cos(theta) * s * r;
      values[i + 1] = u * r * 0.82;
      values[i + 2] = Math.sin(theta) * s * r * 0.7;
      values[i + 3] = 1;
    }
  },
  spiral(values, rng) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const count = values.length / 4;
    for (let n = 0; n < count; n += 1) {
      const i = n * 4;
      const frac = n / count;
      const radius = Math.sqrt(frac) * 2.5;
      const theta = n * golden;
      values[i] = Math.cos(theta) * radius;
      values[i + 1] = Math.sin(theta) * radius * 0.62;
      values[i + 2] = (rng() - 0.5) * 0.24;
      values[i + 3] = 1;
    }
  },
  ring(values, rng) {
    for (let i = 0; i < values.length; i += 4) {
      const theta = rng() * Math.PI * 2;
      const radius = 1.5 + (rng() - 0.5) * 0.5;
      values[i] = Math.cos(theta) * radius;
      values[i + 1] = Math.sin(theta) * radius * 0.72;
      values[i + 2] = (rng() - 0.5) * 0.3;
      values[i + 3] = 1;
    }
  },
  lattice(values, rng) {
    const count = values.length / 4;
    const side = Math.ceil(Math.cbrt(count));
    for (let n = 0; n < count; n += 1) {
      const i = n * 4;
      const x = n % side;
      const y = Math.floor(n / side) % side;
      const z = Math.floor(n / (side * side));
      values[i] = (x / (side - 1) - 0.5) * 3.6;
      values[i + 1] = (y / (side - 1) - 0.5) * 2.2;
      values[i + 2] = (z / (side - 1) - 0.5) * 1.4;
      values[i + 3] = 1;
    }
  },
  band(values, rng) {
    for (let i = 0; i < values.length; i += 4) {
      values[i] = (rng() - 0.5) * 5.6;
      values[i + 1] = (rng() - 0.5) * 1.5 + Math.sin(values[i] * 0.9) * 0.2;
      values[i + 2] = (rng() - 0.5) * 0.6;
      values[i + 3] = 1;
    }
  },
  cube(values, rng) {
    for (let i = 0; i < values.length; i += 4) {
      values[i] = (rng() - 0.5) * 5.2;
      values[i + 1] = (rng() - 0.5) * 4.4;
      values[i + 2] = (rng() - 0.5) * 1.8;
      values[i + 3] = 1;
    }
  },
  cluster(values, rng) {
    for (let i = 0; i < values.length; i += 4) {
      const g = () => (rng() + rng() + rng() - 1.5) * 0.66;
      values[i] = g() * 0.9;
      values[i + 1] = g() * 0.7 - 0.4;
      values[i + 2] = g() * 0.5;
      values[i + 3] = 1;
    }
  },
  glyph(values, rng, utterance) {
    const words = (utterance || '').trim() || '○';
    const off = document.createElement('canvas');
    off.width = 840;
    off.height = 280;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, off.width, off.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = [];
    let fontSize = 118;
    const maxWidth = off.width - 60;
    const fit = (size) => {
      ctx.font = `700 ${size}px "Roboto Flex", system-ui, sans-serif`;
      lines.length = 0;
      let line = '';
      for (const word of words.split(/\s+/)) {
        const probe = line ? `${line} ${word}` : word;
        if (ctx.measureText(probe).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = probe;
        }
      }
      if (line) lines.push(line);
      return lines.length <= 3 && lines.every((l) => ctx.measureText(l).width <= maxWidth);
    };
    while (fontSize > 30 && !fit(fontSize)) fontSize -= 8;
    fit(fontSize);
    const lineHeight = fontSize * 1.12;
    const y0 = off.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, off.width / 2, y0 + i * lineHeight));
    const pixels = ctx.getImageData(0, 0, off.width, off.height).data;
    const lit = [];
    for (let y = 0; y < off.height; y += 2) {
      for (let x = 0; x < off.width; x += 2) {
        if (pixels[(y * off.width + x) * 4] > 110) lit.push(x, y);
      }
    }
    const spanX = 5.4;
    const spanY = spanX * (off.height / off.width);
    if (!lit.length) return ORIGIN_GENERATORS.nebula(values, rng);
    for (let i = 0; i < values.length; i += 4) {
      const pick = (Math.floor(rng() * (lit.length / 2)) * 2);
      const x = lit[pick] + (rng() - 0.5) * 2.2;
      const y = lit[pick + 1] + (rng() - 0.5) * 2.2;
      values[i] = (x / off.width - 0.5) * spanX;
      values[i + 1] = (0.5 - y / off.height) * spanY;
      values[i + 2] = (rng() - 0.5) * 0.16;
      values[i + 3] = 1;
    }
  },
};

// ── baked noise: snoise + curl as one 3D texture, built once at boot ────────────────────────────
// The procedural GLSL noise (18 inlined simplex calls per curl) made every form's D3D shader take
// seconds to compile; a texture read compiles in milliseconds and runs faster. Grid wraps at
// NOISE_PERIOD=16 world units; the field spans well inside one period, so the seam is unreachable.
const SIMPLEX_GRAD = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];

function makeSimplex(seed) {
  const perm = new Uint8Array(512);
  const source = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) source[i] = i;
  let state = seed >>> 0 || 1;
  for (let i = 255; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = source[i]; source[i] = source[j]; source[j] = tmp;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = source[i & 255];
  const F3 = 1 / 3, G3 = 1 / 6;
  return (xin, yin, zin) => {
    const skew = (xin + yin + zin) * F3;
    const i = Math.floor(xin + skew), j = Math.floor(yin + skew), k = Math.floor(zin + skew);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0;
    let c = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (c > 0) { const g = SIMPLEX_GRAD[perm[ii + perm[jj + perm[kk]]] % 12]; n += c * c * c * c * (g[0] * x0 + g[1] * y0 + g[2] * z0); }
    c = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (c > 0) { const g = SIMPLEX_GRAD[perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12]; n += c * c * c * c * (g[0] * x1 + g[1] * y1 + g[2] * z1); }
    c = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (c > 0) { const g = SIMPLEX_GRAD[perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12]; n += c * c * c * c * (g[0] * x2 + g[1] * y2 + g[2] * z2); }
    c = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (c > 0) { const g = SIMPLEX_GRAD[perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12]; n += c * c * c * c * (g[0] * x3 + g[1] * y3 + g[2] * z3); }
    return 32 * n;
  };
}

function bakeNoiseTexture() {
  const size = 40;
  const period = 16;
  const cell = period / size;
  const count = size * size * size;
  const n1 = makeSimplex(101);
  const n2 = makeSimplex(2027);
  const n3 = makeSimplex(90210);
  const f1 = new Float32Array(count);
  const f2 = new Float32Array(count);
  const f3 = new Float32Array(count);
  let idx = 0;
  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const wx = x * cell, wy = y * cell, wz = z * cell;
        f1[idx] = n1(wx, wy, wz);
        f2[idx] = n2(wx, wy, wz);
        f3[idx] = n3(wx, wy, wz);
        idx += 1;
      }
    }
  }
  const at = (f, x, y, z) => f[((z + size) % size) * size * size + ((y + size) % size) * size + ((x + size) % size)];
  const data = new Uint16Array(count * 4);
  const half = THREE.DataUtils.toHalfFloat;
  idx = 0;
  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const cx = (at(f3, x, y + 1, z) - at(f3, x, y - 1, z)) - (at(f2, x, y, z + 1) - at(f2, x, y, z - 1));
        const cy = (at(f1, x, y, z + 1) - at(f1, x, y, z - 1)) - (at(f3, x + 1, y, z) - at(f3, x - 1, y, z));
        const cz = (at(f2, x + 1, y, z) - at(f2, x - 1, y, z)) - (at(f1, x, y + 1, z) - at(f1, x, y - 1, z));
        const len = Math.max(1e-5, Math.hypot(cx, cy, cz));
        data[idx] = half(cx / len);
        data[idx + 1] = half(cy / len);
        data[idx + 2] = half(cz / len);
        data[idx + 3] = half(f1[(z * size + y) * size + x]);
        idx += 4;
      }
    }
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.HalfFloatType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.wrapR = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

// ─────────────────────────────────── the listener (form choice) ────────────────────────────────
const recentForms = [];
const rememberForm = (slug) => {
  recentForms.push(slug);
  if (recentForms.length > 14) recentForms.shift();
};

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const NON_LATIN_RE = /[぀-ヿ㐀-鿿가-힯Ѐ-ӿ֐-׿؀-ۿ]/;

function analyzeUtterance(raw, typingCadence) {
  const trimmed = raw.trim();
  const letters = trimmed.replace(/\s/g, '');
  const upper = (trimmed.match(/[A-Z]/g) || []).length;
  const alpha = (trimmed.match(/[a-zA-Z]/g) || []).length;
  return {
    text: trimmed,
    length: trimmed.length,
    words: trimmed.split(/\s+/).filter(Boolean).length,
    lines: trimmed.split(/\r\n?|\n/).length,
    question: /\?/.test(trimmed),
    exclaim: /!/.test(trimmed),
    ellipsis: /(\.\.\.|…)$/.test(trimmed) || /…/.test(trimmed),
    digits: (trimmed.match(/\d/g) || []).length,
    upperRatio: alpha ? upper / alpha : 0,
    emoji: EMOJI_RE.test(trimmed),
    nonLatin: NON_LATIN_RE.test(trimmed),
    cadence: typingCadence,
    letters: letters.length,
  };
}

function chooseFamily(features, hash) {
  if (hash % 23 === 0) {
    const all = ['flow', 'cosmic', 'organic', 'elemental', 'geometric', 'textual', 'attractor', 'water', 'gravity', 'light'];
    return all[(hash >>> 4) % all.length];
  }
  if (features.emoji) return 'light';
  if (features.question) return 'attractor';
  if (features.exclaim) return features.length < 60 ? 'elemental' : 'cosmic';
  if (features.ellipsis) return 'water';
  if (features.lines > 1) return 'textual';
  if (features.digits >= 2) return 'geometric';
  if (features.upperRatio > 0.6 && features.letters >= 4) return 'elemental';
  if (features.nonLatin) return 'textual';
  if (features.length <= 14) return 'organic';
  if (features.length >= 140) return 'flow';
  if (features.words >= 18) return 'textual';
  const pool = ['flow', 'cosmic', 'organic', 'gravity', 'light', 'water', 'geometric'];
  return pool[(hash >>> 8) % pool.length];
}

function chooseForm(raw, typingCadence) {
  const features = analyzeUtterance(raw, typingCadence);
  const hash = fnv(features.text || 'the dark');
  let family = chooseFamily(features, hash);
  if ((Math.imul(hash ^ 0x51ed270b, 2654435761) >>> 0) % 100 < 35) {
    family = FAMILIES[(Math.imul(hash ^ 0x9c406bb5, 2654435761) >>> 0) % FAMILIES.length];
  }
  const candidates = FORMS.filter((f) => f.family === family);
  let index = (hash >>> 12) % candidates.length;
  for (let hop = 0; hop < candidates.length; hop += 1) {
    const candidate = candidates[(index + hop) % candidates.length];
    if (!recentForms.includes(candidate.slug)) return { form: candidate, hash };
  }
  return { form: candidates[index], hash };
}

// ───────────────────────────────────────── the field ───────────────────────────────────────────
class ParticleField {
  constructor(target) {
    if (!document.createElement('canvas').getContext('webgl2')) {
      throw new Error('WebGL2 unavailable');
    }

    const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const lowConcurrency = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const lowPower = lowMemory || lowConcurrency;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 720;
    this.textureSize = lowPower || narrow ? 256 : 448;
    this.target = target;
    this.narrow = narrow;
    this.active = true;
    this.disposed = false;
    this.pulse = 0;
    this.pulseType = 0;
    this.releaseStarted = 0;
    this.releaseEnergy = 0;
    this.envelope = { inhale: 0.48, exhale: 2.35, peak: 2.35 };
    this.pointerTarget = new THREE.Vector2(0, 0);
    this.pointer = new THREE.Vector2(0, 0);
    this.stir = new THREE.Vector2(0, 0);
    this.stirTarget = new THREE.Vector2(0, 0);
    this.pulseAnchor = null;
    this.lastBreath = 0;
    this.clock = new THREE.Clock();
    this.lastFrame = 0;
    this.materialCache = new Map();
    this.animatedUntil = 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.z = 4.4;
    this.renderer = new THREE.WebGLRenderer({
      canvas: target,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const budgetDpr = Math.sqrt(1700000 / Math.max(1, window.innerWidth * window.innerHeight));
    this.baseDpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.1 : 1.35, budgetDpr);
    this.renderScale = 1;
    this.renderer.setPixelRatio(this.baseDpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.trailScene = new THREE.Scene();
    this.trailCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fadeMaterial = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tPrev; uniform float uPersist; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tPrev, vUv).rgb * uPersist, 1.0); }',
      uniforms: { tPrev: { value: null }, uPersist: { value: 0.35 } },
      depthTest: false,
      depthWrite: false,
    });
    this.fadeMaterial.toneMapped = false;
    this.fadeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fadeMaterial);
    this.trailScene.add(this.fadeQuad);
    this.displayMaterial = new THREE.MeshBasicMaterial({ map: null });
    this.displayQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.displayMaterial);
    this.displayScene = new THREE.Scene();
    this.displayScene.add(this.displayQuad);
    this.allocTrailTargets();

    this.simScene = new THREE.Scene();
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.simScene.add(this.simQuad);

    this.densityRT = new THREE.WebGLRenderTarget(96, 96, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.densityMaterial = new THREE.ShaderMaterial({
      vertexShader: [
        'uniform sampler2D tPositions;',
        'void main() {',
        '  vec3 p = texture2D(tPositions, position.xy).xyz;',
        '  float keep = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);',
        '  gl_PointSize = keep < 0.3 ? 3.0 : 0.0;',
        '  gl_Position = vec4(p.xy * 0.294, 0.0, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'void main() {',
        '  vec2 q = gl_PointCoord - 0.5;',
        '  gl_FragColor = vec4(exp(-dot(q, q) * 6.0) * 0.3, 0.0, 0.0, 1.0);',
        '}',
      ].join('\n'),
      uniforms: { tPositions: { value: null } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.densityMaterial.toneMapped = false;
    this.densityScene = new THREE.Scene();
    this.densityActive = false;

    const size = this.textureSize;
    const options = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.noiseTexture = bakeNoiseTexture();
    this.targetA = new THREE.WebGLRenderTarget(size, size, options);
    this.targetB = new THREE.WebGLRenderTarget(size, size, options);
    this.warmTarget = new THREE.WebGLRenderTarget(4, 4, options);
    this.originValues = new Float32Array(size * size * 4);
    this.origin = null;

    const points = new Float32Array(size * size * 3);
    let cursor = 0;
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        points[cursor++] = (x + 0.5) / size;
        points[cursor++] = (y + 0.5) / size;
        points[cursor++] = 0;
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    this.particles = new THREE.Points(this.geometry, null);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    this.densityPoints = new THREE.Points(this.geometry, this.densityMaterial);
    this.densityPoints.frustumCulled = false;
    this.densityScene.add(this.densityPoints);


    this.setForm(FORM_INDEX.get('nebula'), '', { fromCenter: false, seedHash: sessionSalt });

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.contextLost = this.contextLost.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    target.addEventListener('webglcontextlost', this.contextLost);
    this.raf = requestAnimationFrame(this.frame);
  }

  materialsFor(formDef) {
    let cached = this.materialCache.get(formDef.slug);
    if (cached) return cached;
    const simMaterial = new THREE.ShaderMaterial({
      vertexShader: simVertexShader,
      fragmentShader: buildSimFragment(formDef),
      uniforms: {
        tPositions: { value: null },
        tOrigin: { value: null },
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uPulse: { value: 0 },
        uPulseType: { value: 0 },
        uRelease: { value: 0 },
        uSeed: { value: 0 },
        uEnergy: { value: 0.5 },
        uDt: { value: 1 },
        uForm: { value: 0 },
        uNoiseOff: { value: new THREE.Vector3(0, 0, 0) },
        uOctave: { value: 0 },
        tDensity: { value: null },
        uDenseForce: { value: 0 },
        uDenseSwirl: { value: 0 },
        uRingR: { value: 0 },
        uRingAmp: { value: 0 },
        uPulseCenter: { value: new THREE.Vector2(0, 0) },
        uStir: { value: new THREE.Vector2(0, 0) },
        tNoise: { value: this.noiseTexture },
      },
    });
    const js = formDef.js || {};
    const renderMaterial = new THREE.ShaderMaterial({
      vertexShader: buildRenderVertex(formDef),
      fragmentShader: buildRenderFragment(),
      uniforms: {
        tPositions: { value: null },
        tOrigin: { value: null },
        uTime: { value: 0 },
        uPointSize: { value: this.basePointSize() * (js.size || 1) },
        uExposure: { value: 1.7 },
        uSoft: { value: js.soft || 1.6 },
        uAlpha: { value: Math.min(0.92, (js.alpha || 0.68) * 1.08) },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uPulse: { value: 0 },
        uPulseType: { value: 0 },
        uRelease: { value: 0 },
        uSeed: { value: 0 },
        uEnergy: { value: 0.5 },
        uGlowAmt: { value: js.pointerGlow ? 0.85 : 0.0 },
        uDt: { value: 1 },
        uPulseCenter: { value: new THREE.Vector2(0, 0) },
        uStir: { value: new THREE.Vector2(0, 0) },
        tNoise: { value: this.noiseTexture },
        tPrev: { value: null },
        uIgnite: { value: 0 },
        uHueShift: { value: 0 },
        uFxTurb: { value: 0.15 },
        uFxShimmer: { value: 0 },
        uFxSizeWave: { value: 0 },
        uFxFog: { value: 0 },
        uForm: { value: 0 },
        uNoiseOff: { value: new THREE.Vector3(0, 0, 0) },
        uOctave: { value: 0 },
      },
      transparent: true,
      blending: js.blending === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
    });
    renderMaterial.toneMapped = false;
    cached = { simMaterial, renderMaterial, js };
    this.materialCache.set(formDef.slug, cached);
    return cached;
  }

  prepare(formDef, utterance, seedHash) {
    const key = `${formDef.slug}|${seedHash}|${utterance}`;
    if (this.preparedKey === key) return this.preparedPromise;
    const size = this.textureSize;
    let rngState = (seedHash >>> 0) || 1;
    const rng = () => {
      rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
      return rngState / 0x100000000;
    };
    const values = new Float32Array(size * size * 4);
    const generator = ORIGIN_GENERATORS[formDef.origin] || ORIGIN_GENERATORS.nebula;
    generator(values, rng, utterance);
    orientOrigins(values, seedHash, formDef.origin);
    const half = THREE.DataUtils.toHalfFloat;
    const packed = new Uint16Array(values.length);
    const primePacked = new Uint16Array(values.length);
    for (let i = 0; i < values.length; i += 1) {
      packed[i] = half(values[i]);
      primePacked[i] = i % 4 === 3 ? packed[i] : half(values[i] * 0.45 + (Math.random() - 0.5) * 0.08);
    }
    const texture = new THREE.DataTexture(packed, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
    texture.needsUpdate = true;
    const primeTexture = new THREE.DataTexture(primePacked, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
    primeTexture.needsUpdate = true;
    this.renderer.initTexture(texture);
    this.renderer.initTexture(primeTexture);
    if (this.prepared) {
      if (this.prepared.texture !== this.origin) this.prepared.texture.dispose();
      this.prepared.primeTexture?.dispose();
    }
    this.preparedKey = key;
    this.prepared = { formDef, values, texture, primeTexture };
    const warmT0 = performance.now();
    this.preparedPromise = this.warmForm(formDef).then(() => { this.lastWarmMs = performance.now() - warmT0; }).catch(() => {});
    return this.preparedPromise;
  }

  async warmForm(formDef) {
    if (this.disposed) return;
    this.warmedForms ||= new Set();
    if (this.warmedForms.has(formDef.slug)) return;
    this.warmedForms.add(formDef.slug);
    const { simMaterial, renderMaterial } = this.materialsFor(formDef);
    simMaterial.uniforms.tPositions.value = this.targetA.texture;
    simMaterial.uniforms.tOrigin.value = this.origin;
    renderMaterial.uniforms.tPositions.value = this.targetA.texture;
    renderMaterial.uniforms.tOrigin.value = this.origin;
    renderMaterial.uniforms.tPrev.value = this.targetB.texture;
    const heldPoints = this.particles.material;
    const heldQuad = this.simQuad.material;
    this.particles.material = renderMaterial;
    this.simQuad.material = simMaterial;
    try {
      if (this.renderer.compileAsync) {
        await Promise.all([
          this.renderer.compileAsync(this.scene, this.camera),
          this.renderer.compileAsync(this.simScene, this.simCamera),
        ]);
        if (!this.disposed) {
          this.renderer.setRenderTarget(this.warmTarget);
          this.renderer.render(this.simScene, this.simCamera);
          this.renderer.render(this.scene, this.camera);
          this.renderer.setRenderTarget(null);
        }
      } else {
        this.renderer.setRenderTarget(this.warmTarget);
        this.renderer.render(this.simScene, this.simCamera);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
      }
    } finally {
      if (!this.disposed) {
        this.particles.material = heldPoints;
        this.simQuad.material = heldQuad;
      }
    }
  }

  setForm(formDef, utterance, { fromCenter, seedHash }) {
    const swapT0 = performance.now();
    const size = this.textureSize;
    const key = `${formDef.slug}|${seedHash}|${utterance}`;
    let preparedPrime = null;
    if (this.preparedKey === key && this.prepared) {
      this.origin?.dispose();
      this.origin = this.prepared.texture;
      this.originValues = this.prepared.values;
      preparedPrime = this.prepared.primeTexture;
      this.prepared = null;
      this.preparedKey = null;
    } else {
      let rngState = (seedHash >>> 0) || 1;
      const rng = () => {
        rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
        return rngState / 0x100000000;
      };
      const generator = ORIGIN_GENERATORS[formDef.origin] || ORIGIN_GENERATORS.nebula;
      generator(this.originValues, rng, utterance);
      orientOrigins(this.originValues, seedHash, formDef.origin);
      this.origin?.dispose();
      this.origin = new THREE.DataTexture(this.originValues, size, size, THREE.RGBAFormat, THREE.FloatType);
      this.origin.needsUpdate = true;
    }

    const { simMaterial, renderMaterial, js } = this.materialsFor(formDef);
    this.simMaterial = simMaterial;
    this.renderMaterial = renderMaterial;
    this.formJs = js;
    this.formDef = formDef;
    this.envelope = formDef.envelope || { inhale: 0.48, exhale: 2.35, peak: 2.35 };
    this.simMaterial.uniforms.tOrigin.value = this.origin;
    this.renderMaterial.uniforms.tOrigin.value = this.origin;
    this.simMaterial.uniforms.uSeed.value = ((seedHash >>> 0) % 997) * 0.37;
    this.renderMaterial.uniforms.uSeed.value = this.simMaterial.uniforms.uSeed.value;
    this.renderMaterial.uniforms.uPointSize.value = this.basePointSize() * (js.size || 1);
    const v1 = ((seedHash >>> 8) % 1000) / 1000;
    const v2 = ((seedHash >>> 13) % 1000) / 1000;
    const v3 = ((seedHash >>> 18) % 1000) / 1000;
    const roll = (salt, chance) => ((Math.imul(seedHash ^ salt, 2654435761) >>> 0) % 1000) / 1000 < chance;
    const fx = {
      trails: roll(0x9e3779b9, 0.45),
      ignite: roll(0x85ebca6b, 0.4),
      hueDrift: roll(0xc2b2ae35, 0.3),
      turb: roll(0x27d4eb2f, 0.35),
      shimmer: roll(0x165667b1, 0.28),
      fog: roll(0xd3a2646c, 0.3),
      beat: roll(0xfd7046c5, 0.3),
      sizeWave: roll(0xb55a4f09, 0.28),
      dense: roll(0x94d049bb, 0.55),
      octave: roll(0xbf58476d, 0.5),
      ring: roll(0x2545f491, 0.4),
    };
    if (!Object.values(fx).some(Boolean)) fx.turb = true;
    const cosmeticDropOrder = ['beat', 'sizeWave', 'shimmer', 'fog', 'turb', 'hueDrift', 'ignite'];
    let activeCount = Object.values(fx).filter(Boolean).length;
    for (const k of cosmeticDropOrder) {
      if (activeCount <= 3) break;
      if (fx[k]) {
        fx[k] = false;
        activeCount -= 1;
      }
    }
    this.effects = fx;
    const ru2 = this.renderMaterial.uniforms;
    this.baseHueShift = (v1 - 0.5) * 0.34;
    this.hueDriftRate = fx.hueDrift ? 0.04 + v2 * 0.05 : 0;
    ru2.uHueShift.value = this.baseHueShift;
    ru2.uIgnite.value = fx.ignite ? (js.ignite ?? 1) : 0;
    ru2.uFxTurb.value = fx.turb ? 0.22 + v3 * 0.2 : 0.1;
    ru2.uFxShimmer.value = fx.shimmer ? 0.22 + v1 * 0.25 : 0;
    ru2.uFxSizeWave.value = fx.sizeWave ? 0.35 + v2 * 0.35 : 0;
    ru2.uFxFog.value = fx.fog ? 0.35 + v1 * 0.3 : 0;
    this.beatTempo = fx.beat ? 0.6 + v3 * 0.8 : 0;
    ru2.uPointSize.value = this.basePointSize() * (js.size || 1) * (0.88 + v2 * 0.28);
    this.speedVariant = 0.78 + v3 * 0.24;
    this.timeScale = 0.62 + (((seedHash >>> 11) % 1000) / 1000) * 0.38;
    const nOff = new THREE.Vector3(v1 * 16, v2 * 16, v3 * 16);
    this.simMaterial.uniforms.uNoiseOff.value.copy(nOff);
    this.renderMaterial.uniforms.uNoiseOff.value.copy(nOff);
    const su2 = this.simMaterial.uniforms;
    const octave = fx.octave ? 0.35 + v2 * 0.45 : 0;
    su2.uOctave.value = octave;
    ru2.uOctave.value = octave;
    this.densityActive = fx.dense;
    if (fx.dense) {
      const mode = (Math.imul(seedHash ^ 0x94d049bb, 2246822519) >>> 0) % 3;
      su2.uDenseForce.value = mode === 0 ? -(0.42 + v1 * 0.6) : mode === 1 ? 0.35 + v3 * 0.5 : (v2 - 0.5) * 0.4;
      su2.uDenseSwirl.value = mode === 2 ? (v1 < 0.5 ? -1 : 1) * (0.5 + v3 * 0.6) : 0;
      su2.tDensity.value = this.densityRT.texture;
    } else {
      su2.uDenseForce.value = 0;
      su2.uDenseSwirl.value = 0;
    }
    this.fxRing = fx.ring;
    su2.uRingAmp.value = 0;
    this.trailPersist = fx.trails ? Math.min(0.9, Math.max(0.35, (js.trail ?? 0.5) + (v2 - 0.5) * 0.14)) : 0.08;
    this.particles.material = this.renderMaterial;

    let prime = fromCenter ? preparedPrime : null;
    if (!prime) {
      let primeValues = this.originValues;
      if (fromCenter) {
        this.primeBuffer ||= new Float32Array(this.originValues.length);
        for (let i = 0; i < this.originValues.length; i += 1) {
          this.primeBuffer[i] = i % 4 === 3 ? 1 : this.originValues[i] * 0.45 + (Math.random() - 0.5) * 0.08;
        }
        primeValues = this.primeBuffer;
      }
      prime = new THREE.DataTexture(primeValues, size, size, THREE.RGBAFormat, THREE.FloatType);
      prime.needsUpdate = true;
    }
    this.simMaterial.uniforms.tPositions.value = prime;
    this.simQuad.material = this.simMaterial;
    this.renderer.setRenderTarget(this.targetA);
    this.renderer.render(this.simScene, this.simCamera);
    this.simMaterial.uniforms.tPositions.value = this.targetA.texture;
    this.renderer.setRenderTarget(this.targetB);
    this.renderer.render(this.simScene, this.simCamera);
    this.renderer.setRenderTarget(null);
    prime.dispose();
    this.lastSwapMs = performance.now() - swapT0;
    this.formStartedAt = performance.now();
    this.animatedUntil = performance.now() + 4200;
  }

  allocTrailTargets() {
    const w = Math.max(2, Math.floor(window.innerWidth * this.baseDpr * this.renderScale));
    const h = Math.max(2, Math.floor(window.innerHeight * this.baseDpr * this.renderScale));
    const options = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.trailA?.dispose();
    this.trailB?.dispose();
    this.trailA = new THREE.WebGLRenderTarget(w, h, options);
    this.trailB = new THREE.WebGLRenderTarget(w, h, options);
  }

  basePointSize() {
    return window.innerWidth < 640 ? 3.8 : 4.4;
  }

  governFidelity(now, interacting) {
    if (!this.lastGovern) this.lastGovern = now;
    if (now - this.lastGovern < 1600) return;
    if (this.releaseStarted || now < this.animatedUntil - 2600) { this.lastGovern = now; return; }
    this.lastGovern = now;
    const previous = this.renderScale;
    const slow = interacting ? 27 : 48;
    const fast = interacting ? 18 : 36;
    if (this.frameEma > slow) this.renderScale = Math.max(0.6, this.renderScale * 0.88);
    else if (this.frameEma < fast && this.renderScale < 1) this.renderScale = Math.min(1, this.renderScale * 1.25);
    if (this.renderScale !== previous) {
      this.renderer.setPixelRatio(this.baseDpr * this.renderScale);
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.allocTrailTargets();
      if (this.renderMaterial) {
        const compensate = Math.pow(1 / this.renderScale, 0.5);
        const px = this.basePointSize() * ((this.formJs || {}).size || 1) * compensate;
        this.renderMaterial.uniforms.uPointSize.value = px;
        if (this.haloMaterial) this.haloMaterial.uniforms.uPointSize.value = px;
      }
    }
  }

  contextLost(event) {
    event.preventDefault();
    this.dispose();
    body.dataset.graphics = 'fallback';
  }

  setPointer(x, y) {
    const nx = x * 2.2;
    const ny = y * 1.45;
    const now = performance.now();
    if (this.lastPointerAt) {
      const dtMs = Math.max(8, now - this.lastPointerAt);
      const vx = (nx - this.pointerTarget.x) / dtMs * 16.7;
      const vy = (ny - this.pointerTarget.y) / dtMs * 16.7;
      this.stirTarget.set(clamp(vx, -0.9, 0.9), clamp(vy, -0.9, 0.9));
      this.animatedUntil = Math.max(this.animatedUntil, now + 900);
    }
    this.lastPointerAt = now;
    this.pointerTarget.set(nx, ny);
  }

  ripple(x, y, energy = 1.4) {
    this.pulseAnchor = new THREE.Vector2(x * 2.2, y * 1.45);
    this.pulseType = 0;
    this.pulse = Math.max(this.pulse, clamp(energy, 0.4, 2.8));
    this.animatedUntil = Math.max(this.animatedUntil, performance.now() + 1600);
  }

  anchorPulses(vec) {
    this.pulseAnchor = vec;
  }

  setTypingEnergy(value) {
    this.energyTarget = clamp(value, 0.2, 1.6);
  }

  setVoiceLevel(rms) {
    this.voiceLevel = (this.voiceLevel || 0) * 0.75 + rms * 0.25;
  }

  pop(amount = 0.12) {
    this.exposurePop = Math.min(0.4, (this.exposurePop || 0) + amount);
  }

  excite(kind, energy = 1, anchor = null) {
    const types = { outward: 0, inward: 1, orbit: 2, scatter: 3 };
    this.pulseType = types[kind] ?? 0;
    this.pulse = Math.max(this.pulse, clamp(energy, 0.25, 2.8));
    this.pulseAnchor = anchor;
    this.animatedUntil = Math.max(this.animatedUntil, performance.now() + 1400);
  }

  release(length, energy) {
    this.releaseStarted = performance.now();
    this.releaseEnergy = clamp(0.7 + Math.log2(Math.max(2, length)) * 0.12, 0.85, 1.65) * (energy || 1);
    this.excite('inward', 2.2);
  }

  settle() {
    this.releaseStarted = 0;
    this.releaseEnergy = 0;
    this.energyTarget = 0.5;
  }

  setActive(active) {
    this.active = active;
    if (active && !this.raf && !this.disposed) {
      this.clock.getDelta();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  resize() {
    if (this.disposed) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.allocTrailTargets();
    if (this.renderMaterial) {
      this.renderMaterial.uniforms.uPointSize.value = this.basePointSize() * ((this.formJs || {}).size || 1);
    }
  }

  frame(now) {
    this.raf = 0;
    if (this.disposed || !this.active) return;
    const interacting = this.pulse > 0.03 || this.releaseStarted > 0 || now < this.animatedUntil;
    const interval = interacting ? 1000 / 50 : 1000 / 30;
    if (now - this.lastFrame < interval) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const frameGap = this.prevFrameAt ? now - this.prevFrameAt : 16.7;
    this.prevFrameAt = now;
    this.lastFrame = now;
    const dt = clamp(frameGap / 16.7, 0.5, 2.5);
    this.frameEma = this.frameEma ? this.frameEma * 0.92 + frameGap * 0.08 : frameGap;
    this.governFidelity(now, interacting);
    const time = this.clock.getElapsedTime();
    this.pointer.lerp(this.pointerTarget, 0.055);
    this.stir.lerp(this.stirTarget, 0.12);
    this.stirTarget.multiplyScalar(Math.pow(0.82, dt));
    this.pulse *= Math.pow(0.91, dt);

    if (!interacting && now - (this.lastBreath || 0) > 16000) {
      this.lastBreath = now;
      this.pulseType = 3;
      this.pulse = Math.max(this.pulse, 0.55);
      this.pulseAnchor = null;
    }

    this.camera.position.x += (this.pointer.x * 0.14 - this.camera.position.x) * 0.03;
    this.camera.position.y += (this.pointer.y * 0.1 - this.camera.position.y) * 0.03;
    this.camera.lookAt(0, 0, 0);

    let releaseForce = 0;
    if (this.releaseStarted) {
      const { inhale, exhale, peak } = this.envelope;
      const elapsed = (now - this.releaseStarted) / 1000;
      if (elapsed < inhale) {
        releaseForce = -this.releaseEnergy * Math.sin((elapsed / inhale) * Math.PI);
      } else if (elapsed < inhale + exhale) {
        const phase = (elapsed - inhale) / exhale;
        releaseForce = this.releaseEnergy * peak * Math.pow(1 - phase, 2.1);
      } else {
        this.releaseStarted = 0;
      }
    }

    this.energyCurrent = (this.energyCurrent ?? 0.5) + ((this.energyTarget ?? 0.5) - (this.energyCurrent ?? 0.5)) * 0.06;
    this.exposurePop = (this.exposurePop || 0) * Math.pow(0.86, dt);
    let exposure = 1.56 + this.exposurePop;
    if (this.voiceLevel > 0.012) {
      this.energyCurrent = Math.min(1.6, this.energyCurrent + this.voiceLevel * 2.4);
      exposure += Math.min(0.55, this.voiceLevel * 1.8);
      if (this.voiceLevel > 0.09 && now - (this.lastVoicePulse || 0) > 650) {
        this.lastVoicePulse = now;
        this.pulseType = 3;
        this.pulse = Math.max(this.pulse, Math.min(1.1, this.voiceLevel * 4));
      }
      this.animatedUntil = Math.max(this.animatedUntil, now + 450);
    }
    let surge = 0;
    if (this.releaseStarted) {
      const surgePhase = Math.min(1, ((now - this.releaseStarted) / 1000) / (this.envelope.inhale + 0.7));
      surge = Math.sin(surgePhase * Math.PI);
      exposure += surge * 0.95;
    }


    const su = this.simMaterial.uniforms;
    su.uDt.value = dt * (this.speedVariant || 1);
    su.uTime.value = time * (this.timeScale || 1);
    su.uEnergy.value = this.energyCurrent;
    su.uPointer.value.copy(this.pointer);
    su.uPulse.value = this.pulse;
    su.uPulseType.value = this.pulseType;
    su.uRelease.value = releaseForce;
    su.uStir.value.copy(this.stir);
    su.uPulseCenter.value.copy(this.pulseAnchor || this.pointer);

    if (this.fxRing && this.releaseStarted) {
      const ringT = (now - this.releaseStarted) / 1000 - this.envelope.inhale;
      if (ringT > 0) {
        su.uRingR.value = ringT * 3.4;
        su.uRingAmp.value = Math.max(0, 1 - ringT * 0.5) * (this.releaseEnergy || 1) * 1.25;
      }
    } else if (su.uRingAmp.value > 0) {
      su.uRingAmp.value = 0;
    }

    if (this.densityActive) {
      this.densityMaterial.uniforms.tPositions.value = this.targetA.texture;
      this.renderer.setRenderTarget(this.densityRT);
      this.renderer.render(this.densityScene, this.trailCamera);
    }

    this.simQuad.material = this.simMaterial;
    su.tPositions.value = this.targetA.texture;
    this.renderer.setRenderTarget(this.targetB);
    this.renderer.render(this.simScene, this.simCamera);
    [this.targetA, this.targetB] = [this.targetB, this.targetA];
    const ru = this.renderMaterial.uniforms;
    ru.tPositions.value = this.targetA.texture;
    ru.tPrev.value = this.targetB.texture;
    ru.uTime.value = time * (this.timeScale || 1);
    ru.uPointer.value.copy(this.pointer);
    ru.uRelease.value = releaseForce;
    const formPhase = this.formStartedAt ? Math.max(0, 1 - (now - this.formStartedAt) / 1400) : 0;
    su.uForm.value = formPhase;
    ru.uForm.value = formPhase;
    exposure += formPhase * 0.3;
    if (this.hueDriftRate) ru.uHueShift.value = this.baseHueShift + time * this.hueDriftRate;
    if (this.beatTempo) exposure += 0.12 * Math.sin(time * this.beatTempo);
    ru.uExposure.value = exposure;

    const persist = Math.pow(this.trailPersist ?? 0.35, dt);
    this.fadeMaterial.uniforms.tPrev.value = this.trailA.texture;
    this.fadeMaterial.uniforms.uPersist.value = persist;
    this.renderer.setRenderTarget(this.trailB);
    this.renderer.render(this.trailScene, this.trailCamera);
    this.renderer.autoClear = false;
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = true;
    [this.trailA, this.trailB] = [this.trailB, this.trailA];
    this.displayMaterial.map = this.trailA.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.displayScene, this.trailCamera);
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('resize', this.resize);
    this.target.removeEventListener('webglcontextlost', this.contextLost);
    this.geometry?.dispose();
    for (const { simMaterial, renderMaterial } of this.materialCache.values()) {
      simMaterial.dispose();
      renderMaterial.dispose();
    }
    this.materialCache.clear();
    this.origin?.dispose();
    this.noiseTexture?.dispose();
    this.targetA?.dispose();
    this.targetB?.dispose();
    this.warmTarget?.dispose();
    this.trailA?.dispose();
    this.trailB?.dispose();
    this.densityRT?.dispose();
    this.densityMaterial?.dispose();
    this.renderer?.dispose();
  }
}

// ── content-free device diagnostics (ADR 0005): the machinery's health, never the words ─────────
const diag = (() => {
  const sid = Math.random().toString(36).slice(2, 10);
  const build = (document.querySelector('meta[name=build]') || {}).content || '';
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const body = JSON.stringify({ sid, build, probe: navigator.webdriver === true, events: buf.splice(0, 60) });
    try {
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/debug-log', new Blob([body], { type: 'application/json' })))) {
        fetch('/api/debug-log', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch (_e) {}
  };
  const log = (type, data) => {
    buf.push({ ms: Math.round(performance.now()), type, ...(data || {}) });
    if (buf.length >= 40) flush();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  setInterval(flush, 12000);
  window.addEventListener('error', (e) => log('jserror', { msg: String(e.message || '').slice(0, 300), src: String(e.filename || '').slice(-80), line: e.lineno || 0 }));
  window.addEventListener('unhandledrejection', (e) => log('rejection', { msg: String((e.reason && e.reason.message) || e.reason || '').slice(0, 300) }));
  document.addEventListener('securitypolicyviolation', (e) => log('csp', { dir: e.violatedDirective, uri: String(e.blockedURI || '').slice(0, 100) }));
  log('boot', {
    gpu: !!navigator.gpu,
    cores: navigator.hardwareConcurrency || 0,
    mem: navigator.deviceMemory || 0,
    dpr: Math.round(window.devicePixelRatio * 100) / 100,
    w: window.innerWidth,
    h: window.innerHeight,
    touch: navigator.maxTouchPoints > 0,
    lang: (navigator.language || '').slice(0, 12),
  });
  return log;
})();

// ───────────────────────────────────── experience shell ────────────────────────────────────────
let field = null;
let composing = false;
let locked = false;
let lastInputAt = 0;
let cadence = 420;
let deletions = 0;
let releaseDeadline = 0;
let releaseDelay = 0;
let releaseTimer = 0;
let holdingTimer = 0;
let progressFrame = 0;
let clearTimer = 0;
let swapTimer = 0;
let restoreTimer = 0;
let emptyTimer = 0;
let fieldGeneration = 0;
let warmHandle = 0;
let lastForm = null;
let lastRelease = null;
let forcedForm = null;

async function initializeField() {
  const generation = ++fieldGeneration;
  field?.dispose();
  field = null;
  if (reducedMotion.matches) {
    body.dataset.graphics = 'reduced';
    return;
  }
  body.dataset.graphics = 'fallback';
  try {
    graphicsModules ||= Promise.all([
      import('three'),
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
    ]);
    const [threeModule, composerModule, renderPassModule, bloomModule, outputModule] = await graphicsModules;
    if (generation !== fieldGeneration || reducedMotion.matches) return;
    THREE = threeModule;
    EffectComposer = composerModule.EffectComposer;
    RenderPass = renderPassModule.RenderPass;
    UnrealBloomPass = bloomModule.UnrealBloomPass;
    OutputPass = outputModule.OutputPass;
    field = new ParticleField(canvas);
    body.dataset.graphics = 'webgl';
  } catch (error) {
    body.dataset.graphics = 'fallback';
    diag('graphics-fail', { msg: String((error && error.message) || error).slice(0, 200) });
  }
  diag('graphics', { mode: body.dataset.graphics });
}

function setState(next, message) {
  body.dataset.state = next;
  if (message) status.textContent = message;
}

function autoSize() {
  text.style.height = 'auto';
  text.style.height = `${Math.min(text.scrollHeight, window.innerHeight * 0.34)}px`;
}

function setProgress(fraction) {
  releaseButton.style.setProperty('--release-progress', `${clamp(fraction, 0, 1) * 360}deg`);
}

function cancelReleaseSchedule() {
  clearTimeout(releaseTimer);
  clearTimeout(holdingTimer);
  cancelAnimationFrame(progressFrame);
  cancelIdleWarm();
  releaseTimer = 0;
  holdingTimer = 0;
  progressFrame = 0;
  releaseDeadline = 0;
  setProgress(0);
}

function cancelIdleWarm() {
  if (warmHandle) {
    clearTimeout(warmHandle);
    warmHandle = 0;
  }
}

function scheduleWarm() {
  cancelIdleWarm();
  warmHandle = setTimeout(() => {
    warmHandle = 0;
    const raw = text.value;
    if (!raw.trim() || !field) return;
    if (field.frameEma && field.frameEma > 45) return;
    const chosen = forcedForm
      ? { form: FORM_INDEX.get(forcedForm), hash: fnv(raw.trim() || 'the dark') }
      : chooseForm(raw, cadence);
    if (!chosen.form) return;
    field.prepare(chosen.form, raw, chosen.hash);
  }, 550);
}

function paintProgress(now) {
  if (!releaseDeadline || locked) return;
  setProgress(1 - ((releaseDeadline - now) / releaseDelay));
  if (now < releaseDeadline) progressFrame = requestAnimationFrame(paintProgress);
}

function scheduleRelease() {
  cancelReleaseSchedule();
  const length = text.value.trim().length;
  if (!length || composing || locked) return;
  const readingTime = Math.min(3400, length * 16);
  const rhythm = clamp(cadence * 1.8, 500, 1700);
  releaseDelay = clamp(1900 + readingTime + rhythm, 2600, 6600);
  releaseDeadline = performance.now() + releaseDelay;
  releaseTimer = window.setTimeout(beginRelease, releaseDelay);
  holdingTimer = window.setTimeout(() => {
    if (!locked && text.value.trim()) setState('holding', '');
  }, Math.min(900, releaseDelay * 0.25));
  progressFrame = requestAnimationFrame(paintProgress);
  scheduleWarm();
}

function classifyInput(event) {
  if (event.inputType?.includes('delete')) return 'inward';
  if (event.inputType === 'insertLineBreak') return 'orbit';
  if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop') return 'scatter';
  const character = event.data || '';
  if (/\s/.test(character)) return 'orbit';
  if (/[.!?,;:—–-]/.test(character)) return 'scatter';
  return /[aeiou]/i.test(character) ? 'outward' : 'inward';
}

function onInput(event) {
  if (locked) return;
  const now = performance.now();
  if (lastInputAt) cadence = cadence * 0.72 + clamp(now - lastInputAt, 45, 1100) * 0.28;
  lastInputAt = now;
  if (event.inputType?.includes('delete')) deletions += 1;
  autoSize();
  const hasText = text.value.trim().length > 0;
  body.dataset.hasText = String(hasText);
  releaseButton.disabled = !hasText;
  if (!hasText) {
    cancelReleaseSchedule();
    setState('empty', '');
    return;
  }
  setState('writing', '');
  if (field) {
    const box = text.getBoundingClientRect();
    const kind = classifyInput(event);
    const seedChar = (event.data || ' ').charCodeAt(0) || 32;
    const jx = (Math.sin(seedChar * 12.9898 + text.value.length * 3.7) * 0.5) * 0.9;
    const jy = (Math.sin(seedChar * 78.233 + text.value.length * 1.3) * 0.5) * 0.5;
    const ax = ((box.left + box.width / 2) / window.innerWidth - .5) * 2.2 + jx;
    const ay = (.5 - (box.top + box.height / 2) / window.innerHeight) * 1.45 + jy;
    let energy = event.inputType === 'insertFromPaste' ? 2.4 : clamp(1.85 - cadence / 1000, .8, 1.8);
    if (kind === 'orbit') energy *= 1.45;
    field.excite(kind, energy, new THREE.Vector2(ax, ay));
    field.setTypingEnergy(clamp(1.5 - cadence / 650, 0.35, 1.5));
    field.pop(kind === 'scatter' ? 0.2 : 0.1);
  }
  if (!composing) scheduleRelease();
}

function beginRelease() {
  if (locked || composing || !text.value.trim()) return;
  locked = true;
  cancelReleaseSchedule();
  const raw = text.value;
  const length = raw.length;
  const chosen = forcedForm && FORM_INDEX.get(forcedForm)
    ? { form: FORM_INDEX.get(forcedForm), hash: fnv(raw.trim() || 'the dark') }
    : chooseForm(raw, cadence);
  forcedForm = null;
  lastForm = chosen.form.slug;
  lastRelease = { slug: chosen.form.slug, family: chosen.form.family, len: raw.length, lines: raw.split(/\r\n?|\n/).length };
  rememberForm(chosen.form.slug);
  const energy = clamp(0.7 + length / 220 + (deletions > 3 ? 0.15 : 0), 0.7, 1.5);
  deletions = 0;

  text.readOnly = true;
  releaseButton.disabled = true;
  releaseButton.setAttribute('aria-busy', 'true');
  setState('releasing', '');
  if (listening) stopListening();
  const ready = field ? field.prepare(chosen.form, raw, chosen.hash) : Promise.resolve();
  field?.release(length, energy);

  const inhaleMs = field ? field.envelope.inhale * 1000 : 480;
  const swapAt = reducedMotion.matches ? 200 : Math.max(360, inhaleMs);

    const revealLine = chosen.form.name;
  swapTimer = window.setTimeout(() => {
    Promise.resolve(ready).then(() => {
      if (body.dataset.state !== 'releasing') return;
      body.dataset.form = chosen.form.slug;
      field?.setForm(chosen.form, raw, { fromCenter: true, seedHash: chosen.hash });
      setState('releasing', revealLine);
      diag('release', {
        slug: chosen.form.slug,
        fx: field ? Object.keys(field.effects || {}).filter((k) => field.effects[k]).join(',') : '',
        swapMs: field ? Math.round(field.lastSwapMs || 0) : -1,
      });
      window.setTimeout(() => {
        if (field) diag('perf', { frameMs: Math.round(field.frameEma || 0), scale: Math.round((field.renderScale || 1) * 100) / 100 });
      }, 3000);
    });
  }, swapAt);

  clearTimer = window.setTimeout(() => {
    text.value = '';
    autoSize();
    body.dataset.hasText = 'false';
  }, reducedMotion.matches ? 160 : 920);

  restoreTimer = window.setTimeout(() => {
    locked = false;
    text.readOnly = false;
    releaseButton.removeAttribute('aria-busy');
    field?.settle();
    setState('returned', revealLine);
    if (finePointer.matches && document.visibilityState === 'visible') text.focus({ preventScroll: true });
  }, reducedMotion.matches ? 420 : Math.max(2200, swapAt + 1500));

  emptyTimer = window.setTimeout(() => {
    if (!text.value) setState('empty', '');
  }, reducedMotion.matches ? 1400 : 5600);
}

function resetExperience() {
  clearTimeout(clearTimer);
  clearTimeout(swapTimer);
  clearTimeout(restoreTimer);
  clearTimeout(emptyTimer);
  cancelReleaseSchedule();
  locked = false;
  text.readOnly = false;
  releaseButton.removeAttribute('aria-busy');
  autoSize();
  const hasText = text.value.trim().length > 0;
  body.dataset.hasText = String(hasText);
  releaseButton.disabled = !hasText;
  setState(hasText ? 'writing' : 'empty', 'listening');
  field?.settle();
  if (hasText) scheduleRelease();
}

text.addEventListener('input', onInput);
text.addEventListener('compositionstart', () => {
  composing = true;
  cancelReleaseSchedule();
});
text.addEventListener('compositionend', (event) => {
  composing = false;
  onInput(event);
});
text.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !locked) {
    cancelReleaseSchedule();
    setState(text.value.trim() ? 'writing' : 'empty', 'listening');
  }
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    beginRelease();
  }
});
releaseButton.addEventListener('click', beginRelease);

// ── voice: speak into the dark. Transcription is a local model in a worker — the audio never
// leaves the page, exactly as the front door promises. One mic stream feeds both the field's
// amplitude reactivity and the transcriber; chunks cut on natural pauses.
const speakButton = document.getElementById('speak');
let listening = false;
let voiceBase = '';
let sttWorker = null;
let sttReady = false;
let sttFailed = false;
let voiceCapture = null;
let chunkBuf = [];
let chunkLen = 0;
let voicedLen = 0;
let silenceLen = 0;
let pendingChunks = 0;
let noiseFloor = 0.004;
let statSamples = 0;
let statPeak = 0;
let lastInterimAt = 0;
let idleSilence = 0;
let hasFlushedChunk = false;

const assetVersion = encodeURIComponent(((document.querySelector('meta[name=build]') || {}).content || 'v0').slice(0, 24));

let sttWasmForced = true;

function ensureSttWorker() {
  if (sttWorker || sttFailed) return;
  const sttStarted = performance.now();
  let lastPct = 0;
  diag('stt-init', { wasm: sttWasmForced });
  sttWorker = new Worker(new URL('./stt-worker.js?v=' + assetVersion, import.meta.url), { type: 'module' });
  sttWorker.onmessage = (e) => {
    const msg = e.data;
    if (msg.t === 'progress') {
      speakButton.style.setProperty('--stt-pct', String(Math.round(msg.pct * 100)));
      speakButton.dataset.loading = 'true';
      if (msg.pct - lastPct >= 0.25) {
        lastPct = msg.pct;
        diag('stt-progress', { pct: Math.round(msg.pct * 100) });
      }
    } else if (msg.t === 'ready') {
      sttReady = true;
      speakButton.dataset.loading = 'false';
      diag('stt-ready', { device: msg.device || '?', sec: Math.round((performance.now() - sttStarted) / 100) / 10 });
    } else if (msg.t === 'interim') {
      if (msg.gen === bufferGen && listening && !locked && msg.text) feedVoice(msg.text, false);
      diag('stt-interim', { ms: msg.ms, chars: (msg.text || '').length });
    } else if (msg.t === 'final') {
      window.clearTimeout(wedgeTimer);
      settleChunk();
      diag('stt-final', { ms: msg.ms, chars: (msg.text || '').length, len: msg.len });
      applyFinal(msg.id, msg.text, 'tiny');
    } else if (msg.t === 'error') {
      if (msg.mode !== 'interim' && msg.mode !== 'refine') settleChunk();
      diag('stt-error', { msg: String(msg.message || '').slice(0, 250), fatal: !sttReady });
      if (!sttReady) {
        sttFailed = true;
        stopListening();
        speakButton.hidden = !serverSttOk;
      }
    }
  };
  sttWorker.onerror = (e) => {
    diag('stt-worker-crash', { msg: String((e && e.message) || 'worker error').slice(0, 250) });
    sttFailed = true;
    pendingChunks = 0;
    speakButton.dataset.busy = 'false';
    stopListening();
    speakButton.hidden = !serverSttOk;
  };
  sttWorker.postMessage({ t: 'init', model: 'moonshine-tiny-ONNX', forceWasm: sttWasmForced });
}

let wedgeTimer = 0;

function armWedgeWatchdog(id, samplesCopy) {
  window.clearTimeout(wedgeTimer);
  wedgeTimer = window.setTimeout(() => {
    const st = chunkStates.get(id);
    if (!st || st.applied || sttWasmForced) return;
    diag('stt-wedge', { id });
    sttWasmForced = true;
    sttReady = false;
    try { sttWorker.terminate(); } catch (_e) {}
    sttWorker = null;
    ensureSttWorker();
    if (sttWorker && samplesCopy) {
      sttWorker.postMessage({ t: 'audio', mode: 'final', id, samples: samplesCopy }, [samplesCopy.buffer]);
    }
  }, 6000);
}

function resampleTo16k(samples, fromRate) {
  if (fromRate === 16000) return samples;
  const outLen = Math.floor(samples.length * 16000 / fromRate);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    const src = i * fromRate / 16000;
    const lo = Math.floor(src);
    const frac = src - lo;
    out[i] = samples[lo] * (1 - frac) + (samples[Math.min(lo + 1, samples.length - 1)] || 0) * frac;
  }
  return out;
}

function resetChunker() {
  chunkBuf = [];
  chunkLen = 0;
  voicedLen = 0;
  silenceLen = 0;
}

function collectSamples() {
  const rate = voiceCapture ? voiceCapture.ctx.sampleRate : 16000;
  const all = new Float32Array(chunkLen);
  let offset = 0;
  for (const f of chunkBuf) {
    all.set(f, offset);
    offset += f.length;
  }
  return resampleTo16k(all, rate);
}

function flushChunk() {
  const rate = voiceCapture ? voiceCapture.ctx.sampleRate : 16000;
  if (voicedLen < rate * 0.35) {
    resetChunker();
    return;
  }
  const samples = collectSamples();
  resetChunker();
  bufferGen += 1;
  chunkSeq += 1;
  const id = chunkSeq;
  chunkStates.set(id, { applied: false, baseBefore: '', snapshot: '', finalText: '' });
  chunkStates.delete(id - 8);
  pendingChunks += 1;
  speakButton.dataset.busy = 'true';
  diag('chunk', { sec: Math.round(samples.length / 1600) / 10 });
  const serverCopy = serverSttOk ? samples.slice(0) : null;
  ensureSttWorker();
  if (sttWorker && !sttFailed) {
    const wedgeCopy = sttWasmForced ? null : samples.slice(0);
    sttWorker.postMessage({ t: 'audio', mode: 'final', id, samples }, [samples.buffer]);
    armWedgeWatchdog(id, wedgeCopy);
  } else if (!serverCopy) {
    settleChunk();
  }
  if (serverCopy) refineViaServer(id, serverCopy, !sttWorker || sttFailed);
}

let serverSttOk = true;
let bufferGen = 0;
let chunkSeq = 0;
const chunkStates = new Map();

function settleChunk() {
  pendingChunks = Math.max(0, pendingChunks - 1);
  if (!pendingChunks) speakButton.dataset.busy = 'false';
}

function applyFinal(id, transcript, src) {
  const st = chunkStates.get(id);
  if (!st || st.applied) return;
  st.applied = true;
  if (locked || !transcript) return;
  st.baseBefore = voiceBase;
  feedVoice(transcript, true);
  st.finalText = transcript;
  st.snapshot = text.value;
}

function maybeRefine(id, refined, src, ms) {
  const st = chunkStates.get(id);
  if (!st || !st.applied || locked || !refined) return;
  const applies = st.finalText && refined !== st.finalText && text.value === st.snapshot;
  diag('stt-refine', { src, ms: ms || 0, applied: !!applies });
  if (!applies) return;
  text.value = (st.baseBefore + refined).slice(0, 360);
  voiceBase = text.value.endsWith(' ') ? text.value : text.value + ' ';
  st.finalText = refined;
  st.snapshot = text.value;
  onInput(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' ' }));
}

async function refineViaServer(id, samples, isPrimary) {
  const t0 = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), isPrimary ? 32000 : 8000);
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      body: samples.buffer,
      headers: { 'Content-Type': 'application/octet-stream' },
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    const ms = Math.round(performance.now() - t0);
    const st = chunkStates.get(id);
    if (isPrimary || (st && !st.applied)) {
      diag('stt-server', { ms, chars: (data.text || '').length, primary: true });
      settleChunk();
      applyFinal(id, data.text, 'server');
    } else {
      maybeRefine(id, data.text, 'server', ms);
    }
  } catch (err) {
    serverSttOk = false;
    diag('stt-server-fail', { msg: String((err && err.message) || err).slice(0, 120) });
    if (isPrimary) settleChunk();
  }
}

function onVoiceFrame(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
  const rms = Math.sqrt(sum / frame.length);
  field?.setVoiceLevel(rms * 2.2);
  const rate = voiceCapture ? voiceCapture.ctx.sampleRate : 16000;
  const gate = Math.min(0.02, Math.max(0.0035, noiseFloor * 3));
  chunkBuf.push(frame);
  chunkLen += frame.length;
  if (rms > gate) {
    voicedLen += frame.length;
    silenceLen = 0;
  } else {
    silenceLen += frame.length;
    noiseFloor = noiseFloor * 0.97 + rms * 0.03;
  }
  statSamples += frame.length;
  statPeak = Math.max(statPeak, rms);
  if (statSamples > rate * 2.5) {
    diag('listen', {
      peak: Math.round(statPeak * 10000) / 10000,
      gate: Math.round(gate * 10000) / 10000,
      voicedSec: Math.round(voicedLen / rate * 10) / 10,
    });
    statSamples = 0;
    statPeak = 0;
  }
  if (!voicedLen && chunkLen > rate * 2) {
    idleSilence += frame.length;
    while (chunkLen > rate * 0.75 && chunkBuf.length > 1) chunkLen -= chunkBuf.shift().length;
    if (idleSilence > rate * (hasFlushedChunk ? 4 : 9)) stopListening();
  } else if ((voicedLen > rate * 0.35 && silenceLen > rate * 0.45) || chunkLen > rate * 10) {
    flushChunk();
    hasFlushedChunk = true;
    idleSilence = 0;
  } else if (
    sttReady && sttWorker && voicedLen > rate * 0.5 && silenceLen < rate * 0.3
    && chunkLen < rate * 5 && performance.now() - lastInterimAt > 1200
  ) {
    lastInterimAt = performance.now();
    sttWorker.postMessage({ t: 'audio', mode: 'interim', gen: bufferGen, samples: collectSamples() });
  }
  if (voicedLen) idleSilence = 0;
}

async function startCapture() {
  let ctx;
  try {
    ctx = new AudioContext({ sampleRate: 16000 });
  } catch (_e) {
    ctx = new AudioContext();
  }
  await ctx.audioWorklet.addModule(new URL('./capture-worklet.js?v=' + assetVersion, import.meta.url));
  const node = new AudioWorkletNode(ctx, 'capture');
  node.port.onmessage = (e) => { if (listening) onVoiceFrame(e.data); };
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute).connect(ctx.destination);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  if (!listening) {
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
    return;
  }
  noiseFloor = 0.004;
  statSamples = 0;
  statPeak = 0;
  idleSilence = 0;
  hasFlushedChunk = false;
  ctx.createMediaStreamSource(stream).connect(node);
  voiceCapture = { stream, ctx, node };
  const track = stream.getAudioTracks()[0];
  diag('capture', { rate: ctx.sampleRate, state: ctx.state, track: track ? track.readyState : 'none', muted: track ? track.muted : null });
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  track?.addEventListener('mute', () => diag('track-mute'));
  track?.addEventListener('ended', () => diag('track-ended'));
}

function stopListening() {
  const wasListening = listening;
  listening = false;
  speakButton.dataset.listening = 'false';
  if (nativeRecognizer) {
    const r = nativeRecognizer;
    nativeRecognizer = null;
    try { r.stop(); } catch (_e) {}
  }
  if (voiceCapture) {
    if (wasListening) flushChunk();
    voiceCapture.stream.getTracks().forEach((t) => t.stop());
    voiceCapture.ctx.close().catch(() => {});
    voiceCapture = null;
  }
  resetChunker();
  if (field) field.voiceLevel = 0;
}

function feedVoice(transcript, isFinal) {
  const joined = (voiceBase + transcript).slice(0, 360);
  if (text.value === joined) return;
  text.value = joined;
  const tail = transcript.trim().slice(-1) || ' ';
  onInput(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: tail }));
  if (isFinal) voiceBase = joined.endsWith(' ') ? joined : joined + ' ';
}

// The transcription ladder: the platform's own on-device recognizer first (true streaming,
// nothing downloaded, audio never leaves the device), the in-page model second, the server
// only ever as quiet refinement. No rung is load-bearing for a device that lacks it.
const SRNative = window.SpeechRecognition || window.webkitSpeechRecognition;
const workerPathOk = !!(navigator.mediaDevices && window.Worker && window.AudioWorkletNode);
let nativeStatus = 'unavailable';
let nativeFailed = false;
let nativeRecognizer = null;

function startNative() {
  listening = true;
  speakButton.dataset.listening = 'true';
  voiceBase = text.value ? (text.value.endsWith(' ') ? text.value : text.value + ' ') : '';
  nativeRecognizer = new SRNative();
  nativeRecognizer.processLocally = true;
  nativeRecognizer.lang = 'en-US';
  nativeRecognizer.continuous = true;
  nativeRecognizer.interimResults = true;
  nativeRecognizer.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const chunk = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        voiceBase = (voiceBase + chunk).slice(0, 360);
        if (!voiceBase.endsWith(' ')) voiceBase += ' ';
        feedVoice('', true);
        diag('stt-native-final', { chars: chunk.length });
      } else {
        interim += chunk;
      }
    }
    if (interim && !locked) feedVoice(interim, false);
    field?.setVoiceLevel(0.1);
  };
  nativeRecognizer.onerror = (e) => {
    diag('stt-native-error', { err: (e && e.error) || '?' });
    const wasListening = listening;
    nativeFailed = true;
    stopListening();
    if (wasListening && workerPathOk && !sttFailed && !locked) speakButton.click();
  };
  nativeRecognizer.onend = () => { if (listening && nativeRecognizer) stopListening(); };
  try {
    nativeRecognizer.start();
    diag('stt-native-start');
  } catch (_e) {
    nativeFailed = true;
    stopListening();
  }
}

if (speakButton && (SRNative || workerPathOk)) {
  speakButton.hidden = false;
  if (SRNative && typeof SRNative.available === 'function') {
    SRNative.available({ langs: ['en-US'], processLocally: true }).then((status) => {
      nativeStatus = status;
      diag('stt-native', { status });
      if (status === 'downloadable') {
        SRNative.install({ langs: ['en-US'], processLocally: true })
          .then((ok) => { diag('stt-native-install', { ok }); if (ok) nativeStatus = 'available'; })
          .catch(() => {});
      }
    }).catch(() => {});
  }
  const conn = navigator.connection;
  if (workerPathOk && !(conn && (conn.saveData || /2g/.test(conn.effectiveType || '')))) {
    const preload = () => { if (!sttWorker && !sttFailed && nativeStatus !== 'available') ensureSttWorker(); };
    if ('requestIdleCallback' in window) window.requestIdleCallback(preload, { timeout: 6000 });
    else window.setTimeout(preload, 3500);
    text.addEventListener('focus', preload, { once: true });
  }
  speakButton.addEventListener('click', async () => {
    if (locked) return;
    if (listening) { stopListening(); return; }
    if (SRNative && nativeStatus === 'available' && !nativeFailed) {
      startNative();
      return;
    }
    if (!workerPathOk || (sttFailed && !serverSttOk)) return;
    listening = true;
    speakButton.dataset.listening = 'true';
    voiceBase = text.value ? (text.value.endsWith(' ') ? text.value : text.value + ' ') : '';
    try {
      await startCapture();
    } catch (err) {
      diag('capture-error', { msg: String((err && err.name) || '') + ' ' + String((err && err.message) || err).slice(0, 200) });
      stopListening();
    }
  });
}


document.addEventListener('pointermove', (event) => {
  const x = (event.clientX / window.innerWidth) - .5;
  const y = .5 - (event.clientY / window.innerHeight);
  field?.setPointer(x, y);
}, { passive: true });

document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.composer, .site-mark, .quiet-footer')) return;
  const x = (event.clientX / window.innerWidth) - .5;
  const y = .5 - (event.clientY / window.innerHeight);
  field?.ripple(x, y, event.pointerType === 'touch' ? 1.7 : 1.4);
}, { passive: true });

if (window.DeviceOrientationEvent && !finePointer.matches && typeof DeviceOrientationEvent.requestPermission !== 'function') {
  window.addEventListener('deviceorientation', (event) => {
    if (event.gamma == null || event.beta == null) return;
    field?.setPointer(clamp(event.gamma / 60, -0.5, 0.5), clamp((event.beta - 45) / -70, -0.5, 0.5));
  }, { passive: true });
}

document.addEventListener('visibilitychange', () => {
  field?.setActive(document.visibilityState === 'visible');
  if (document.visibilityState === 'hidden' && listening) stopListening();
});

window.addEventListener('resize', autoSize, { passive: true });
window.addEventListener('pageshow', (event) => {
  field?.setActive(true);
  if (event.persisted) resetExperience();
});
window.addEventListener('pagehide', () => field?.setActive(false));

reducedMotion.addEventListener('change', () => {
  initializeField();
  resetExperience();
});

body.dataset.hasText = 'false';
autoSize();
initializeField();
if (finePointer.matches) requestAnimationFrame(() => text.focus({ preventScroll: true }));

window.entryExperience = Object.freeze({
  release: beginRelease,
  reset: resetExperience,
  mode: () => body.dataset.graphics,
  state: () => body.dataset.state,
  forms: () => FORMS.map((f) => f.slug),
  families: () => FORMS.map((f) => [f.slug, f.family]),
  preview: (raw) => {
    const cleaned = String(raw ?? '');
    const { form, hash } = chooseForm(cleaned, cadence);
    return { slug: form.slug, family: form.family, wildcard: hash % 23 === 0 };
  },
  lastForm: () => lastForm,
  lastRelease: () => lastRelease,
  lastEffects: () => field?.effects || null,
  perf: () => field ? { frameMs: Math.round(field.frameEma || 0), scale: Number((field.renderScale || 1).toFixed(2)), swapMs: Math.round(field.lastSwapMs || 0), warmMs: Math.round(field.lastWarmMs || 0) } : null,
  force: (slug) => { forcedForm = FORM_INDEX.has(slug) ? slug : null; return forcedForm; },
});
