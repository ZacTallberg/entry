// The dark learns thirty more answers (ADR 0004, amended). Same contract as forms.js: each form is
// a GLSL force program, a GLSL palette, tuning defines, a JS config, and an origin layout.
// Available: uTime uSeed uEnergy uRelease uPulse uPointer · snoise curlNoise rot cosPal idOf PI TAU.

export const MORE = [];
const form = (def) => { MORE.push(def); return def; };

// ─────────────────────────────────────────── family: flow ──────────────────────────────────────
form({
  slug: 'smoke', name: 'smoke finding the ceiling', family: 'flow', origin: 'veil',
  defines: '#define FORM_HOME 0.0004\n#define FORM_SPEED 0.9\n#define FORM_SOFT 2.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float ceil = 1.9;
    float head = smoothstep(ceil - 1.2, ceil, p.y);
    vec3 curl = curlNoise(p * 0.5 + vec3(0.0, -uTime * 0.12, uSeed));
    vec3 v = vec3(curl.x * 0.006, (1.0 - head) * 0.011 + curl.y * 0.003, curl.z * 0.004);
    v.xz += normalize(p.xz + 0.0001) * head * 0.009;
    v.y -= head * 0.006;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float h = clamp((p.y + 1.7) * 0.26, 0.0, 1.0);
    return cosPal(h * 0.5 + t * 0.02, vec3(0.34,0.35,0.40), vec3(0.24,0.24,0.27), vec3(1.0,1.0,1.0), vec3(0.0,0.12,0.26));
  }`,
  js: { size: 1.5, soft: 2.8, alpha: 0.6, bloom: 1.1, blending: 'additive', trail: 0.78, ignite: 0.6 },
  envelope: { inhale: 0.58, exhale: 3.1, peak: 1.7 },
});

form({
  slug: 'windfield', name: 'wind crossing a field', family: 'flow', origin: 'dunes',
  defines: '#define FORM_HOME 0.004\n#define FORM_SPEED 1.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float gust = snoise(vec3(p.x * 0.28 - uTime * 0.5, p.y * 0.6, uSeed));
    float sway = sin(p.x * 1.1 - uTime * 1.7 + p.y * 0.5);
    vec3 v = vec3(0.006 + gust * 0.008, sway * 0.0035 * (0.4 + gust), 0.0);
    v.y += (o.y - p.y) * 0.02;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float g = 0.5 + 0.5 * sin(p.x * 0.7 - t * 1.2);
    return cosPal(g * 0.3 + p.y * 0.1, vec3(0.46,0.44,0.34), vec3(0.26,0.26,0.20), vec3(1.0,1.0,1.0), vec3(0.1,0.2,0.35));
  }`,
  js: { size: 0.82, soft: 1.8, alpha: 0.58, bloom: 0.95, blending: 'additive', trail: 0.66, ignite: 0.55 },
  envelope: { inhale: 0.46, exhale: 2.5, peak: 1.9 },
});

form({
  slug: 'estuary', name: 'where the river meets the tide', family: 'flow', origin: 'band',
  defines: '#define FORM_HOME 0.0009',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float side = sign(p.x + 0.0001);
    float meet = exp(-p.x * p.x * 0.7);
    vec3 v = vec3(-side * 0.011 * (1.0 - meet), 0.0, 0.0);
    v += curlNoise(p * 0.8 + vec3(uTime * 0.14, uSeed, 0.0)) * (0.002 + meet * 0.011);
    v.y += sin(p.x * 2.0 + uTime * 0.6) * meet * 0.004;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float m = exp(-p.x * p.x * 0.7);
    vec3 fresh = vec3(0.30, 0.46, 0.44);
    vec3 salt = vec3(0.22, 0.30, 0.52);
    return mix(mix(fresh, salt, step(0.0, p.x)), vec3(0.62, 0.66, 0.70), m * 0.7);
  }`,
  js: { size: 0.88, soft: 2.0, alpha: 0.6, bloom: 1.05, blending: 'additive', trail: 0.7, ignite: 0.6 },
  envelope: { inhale: 0.5, exhale: 2.7, peak: 2.0 },
});

// ────────────────────────────────────────── family: cosmic ─────────────────────────────────────
form({
  slug: 'pulsar', name: 'a pulsar keeping time', family: 'cosmic', origin: 'sphere',
  defines: '#define FORM_HOME 0.006\n#define FORM_SPEED 1.3',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = length(p) + 0.0001;
    float beat = fract(uTime * 0.55);
    float shell = smoothstep(0.06, 0.0, abs(r - beat * 3.4));
    vec3 out_ = p / r;
    vec3 v = out_ * shell * 0.05;
    float axis = abs(normalize(o).y);
    v += out_ * axis * 0.004 * sin(uTime * 1.1);
    v -= out_ * 0.003;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float r = length(p);
    float beat = fract(t * 0.55);
    float shell = smoothstep(0.35, 0.0, abs(r - beat * 3.4));
    return mix(vec3(0.24,0.30,0.52), vec3(0.85,0.90,1.0), shell);
  }`,
  js: { size: 0.85, soft: 1.5, alpha: 0.66, bloom: 1.5, blending: 'additive', trail: 0.6, ignite: 1.3 },
  envelope: { inhale: 0.36, exhale: 2.2, peak: 2.3 },
});

form({
  slug: 'accretion', name: 'an accretion disk', family: 'cosmic', origin: 'ring',
  defines: '#define FORM_HOME 0.0016\n#define FORM_SPEED 1.25',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = length(p.xy) + 0.12;
    float kep = 0.055 / (r * sqrt(r));
    vec2 tang = vec2(-p.y, p.x) / r;
    vec3 v = vec3(tang * kep, 0.0);
    v.xy -= normalize(p.xy + 0.0001) * 0.0012;
    v.z += (-p.z * 0.05 + snoise(vec3(p.xy * 1.4, uTime * 0.2)) * 0.002);
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float r = length(p.xy);
    float heat = clamp(1.6 / (r + 0.4) - 0.35, 0.0, 1.4);
    return mix(vec3(0.30,0.16,0.34), vec3(1.0,0.78,0.46), heat);
  }`,
  js: { size: 0.8, soft: 1.6, alpha: 0.68, bloom: 1.55, blending: 'additive', trail: 0.82, ignite: 1.2 },
  envelope: { inhale: 0.44, exhale: 2.6, peak: 2.2 },
});

form({
  slug: 'darkflow', name: 'the long drift between galaxies', family: 'cosmic', origin: 'nebula',
  defines: '#define FORM_HOME 0.0002\n#define FORM_SPEED 0.7\n#define FORM_SIZE 0.8',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 tide = vec3(
      snoise(vec3(p.yz * 0.16, uTime * 0.02 + uSeed)),
      snoise(vec3(p.zx * 0.16, uTime * 0.02 + uSeed + 9.1)),
      snoise(vec3(p.xy * 0.16, uTime * 0.02 + uSeed + 3.7)));
    return tide * 0.0062 + vec3(0.0011, 0.0005, 0.0);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float d = length(p) * 0.18;
    return cosPal(d + id * 0.1, vec3(0.20,0.22,0.30), vec3(0.14,0.14,0.20), vec3(1.0,1.0,1.0), vec3(0.0,0.2,0.4));
  }`,
  js: { size: 1.05, soft: 2.3, alpha: 0.7, bloom: 1.15, blending: 'additive', trail: 0.55, ignite: 0.55 },
  envelope: { inhale: 0.7, exhale: 3.4, peak: 1.5 },
});

// ───────────────────────────────────────── family: organic ─────────────────────────────────────
form({
  slug: 'coral', name: 'coral opening at night', family: 'organic', origin: 'cluster',
  defines: '#define FORM_HOME 0.0022\n#define FORM_SPEED 0.85',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 branch = normalize(o + 0.0001);
    float open = 0.5 + 0.5 * sin(uTime * 0.35 + id * TAU);
    vec3 v = branch * (0.004 + open * 0.006);
    v += curlNoise(p * 1.3 + vec3(uSeed, uTime * 0.06, 0.0)) * 0.0026;
    v -= p * 0.0016 * smoothstep(1.6, 3.0, length(p));
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float tipping = smoothstep(0.6, 2.2, length(p));
    return mix(vec3(0.38,0.16,0.30), vec3(0.95,0.62,0.52), tipping) * (0.7 + 0.4 * sin(t * 0.5 + id * 12.0));
  }`,
  js: { size: 0.95, soft: 1.8, alpha: 0.6, bloom: 1.25, blending: 'additive', trail: 0.58, ignite: 0.8 },
  envelope: { inhale: 0.55, exhale: 2.8, peak: 1.9 },
});

form({
  slug: 'swarm', name: 'a swarm deciding', family: 'organic', origin: 'cluster',
  defines: '#define FORM_HOME 0.0008\n#define FORM_SPEED 1.45',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 mind = vec3(sin(uTime * 0.27 + uSeed) * 2.0, cos(uTime * 0.19) * 1.1, sin(uTime * 0.13) * 0.6);
    vec3 toMind = mind - p;
    float doubt = 0.5 + 0.5 * sin(uTime * 0.6 + id * TAU * 3.0);
    vec3 v = normalize(toMind + 0.0001) * 0.006 * doubt;
    v += curlNoise(p * 1.6 + vec3(id * 5.0, uTime * 0.4, 0.0)) * 0.007 * (1.0 - doubt);
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float doubt = 0.5 + 0.5 * sin(t * 0.6 + id * TAU * 3.0);
    return mix(vec3(0.30,0.34,0.24), vec3(0.86,0.84,0.58), doubt * doubt);
  }`,
  js: { size: 0.7, soft: 1.4, alpha: 0.66, bloom: 1.1, blending: 'additive', trail: 0.74, ignite: 0.9 },
  envelope: { inhale: 0.4, exhale: 2.3, peak: 2.1 },
});

form({
  slug: 'roots', name: 'roots finding water', family: 'organic', origin: 'veil',
  defines: '#define FORM_HOME 0.0018\n#define FORM_SPEED 0.8',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float seek = snoise(vec3(p.x * 0.7, p.y * 0.4 - uTime * 0.06, uSeed + id));
    vec3 v = vec3(seek * 0.005, -0.006 - abs(seek) * 0.003, seek * 0.002);
    v.x += sin(p.y * 2.2 + id * TAU) * 0.0022;
    if (p.y < -1.9) v.y = 0.004;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float depth = clamp((-p.y + 1.8) * 0.24, 0.0, 1.0);
    return mix(vec3(0.44,0.34,0.22), vec3(0.16,0.26,0.30), depth);
  }`,
  js: { size: 0.78, soft: 1.7, alpha: 0.56, bloom: 0.85, blending: 'additive', trail: 0.8, ignite: 0.45 },
  envelope: { inhale: 0.6, exhale: 3.0, peak: 1.7 },
});

// ──────────────────────────────────────── family: elemental ────────────────────────────────────
form({
  slug: 'sandstorm', name: 'a sandstorm passing through', family: 'elemental', origin: 'dunes',
  defines: '#define FORM_HOME 0.0006\n#define FORM_SPEED 1.5\n#define FORM_SIZE 0.75',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float front = snoise(vec3(p.x * 0.2 - uTime * 0.8, p.y * 0.5, uSeed));
    float dense = smoothstep(-0.2, 0.8, front);
    vec3 v = vec3(0.02 * dense + 0.004, front * 0.004, 0.0);
    v += curlNoise(p * 1.9 + vec3(uTime * 0.5, 0.0, uSeed)) * 0.005 * dense;
    if (p.x > 3.2) v.x = -0.3;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float front = snoise(vec3(p.x * 0.2 - t * 0.8, p.y * 0.5, 1.0));
    return mix(vec3(0.26,0.22,0.18), vec3(0.86,0.70,0.44), smoothstep(-0.3, 0.9, front));
  }`,
  js: { size: 0.7, soft: 2.1, alpha: 0.5, bloom: 0.9, blending: 'additive', trail: 0.68, ignite: 0.5 },
  envelope: { inhale: 0.42, exhale: 2.4, peak: 2.0 },
});

form({
  slug: 'frost', name: 'frost climbing the glass', family: 'elemental', origin: 'lattice',
  defines: '#define FORM_HOME 0.02\n#define FORM_SPEED 0.75',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float front = uTime * 0.4 - 2.2;
    float frozen = smoothstep(front - 0.4, front, p.y + id * 0.5);
    vec3 needle = normalize(vec3(sin(id * 30.0), cos(id * 21.0), 0.0) + 0.0001);
    vec3 v = needle * (1.0 - frozen) * 0.004;
    v += (o - p) * frozen * 0.03;
    v.y += (1.0 - frozen) * 0.002;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float front = t * 0.4 - 2.2;
    float frozen = smoothstep(front - 0.4, front, p.y + id * 0.5);
    return mix(vec3(0.16,0.24,0.34), vec3(0.82,0.92,1.0), frozen);
  }`,
  js: { size: 0.72, soft: 1.4, alpha: 0.62, bloom: 1.35, blending: 'additive', trail: 0.42, ignite: 0.9 },
  envelope: { inhale: 0.5, exhale: 2.9, peak: 1.8 },
});

form({
  slug: 'magma', name: 'magma turning over', family: 'elemental', origin: 'nebula',
  defines: '#define FORM_HOME 0.0007\n#define FORM_SPEED 0.85',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float cell = snoise(vec3(p.xy * 0.55, uTime * 0.08 + uSeed));
    vec2 g = vec2(
      snoise(vec3(p.xy * 0.55 + vec2(0.1, 0.0), uTime * 0.08 + uSeed)) - cell,
      snoise(vec3(p.xy * 0.55 + vec2(0.0, 0.1), uTime * 0.08 + uSeed)) - cell);
    vec3 v = vec3(-g.y, g.x, 0.0) * 0.09;
    v.y += cell * 0.004;
    v.z += (-p.z) * 0.02;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float cell = snoise(vec3(p.xy * 0.55, t * 0.08));
    float heat = smoothstep(-0.4, 0.7, cell);
    return mix(vec3(0.16,0.05,0.05), vec3(1.0,0.52,0.18), heat) + vec3(0.3,0.06,0.0) * pow(heat, 4.0);
  }`,
  js: { size: 1.0, soft: 2.0, alpha: 0.6, bloom: 1.5, blending: 'additive', trail: 0.6, ignite: 1.4 },
  envelope: { inhale: 0.55, exhale: 2.8, peak: 2.0 },
});

// ──────────────────────────────────────── family: geometric ────────────────────────────────────
form({
  slug: 'tessellate', name: 'a plane folding into itself', family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.026\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec2 q = p.xy;
    float k = 1.1 + 0.4 * sin(uTime * 0.3);
    q = abs(fract(q * k) - 0.5) / k;
    vec3 target = vec3(q * 2.6 - 1.3, o.z);
    return (target - p) * 0.02;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec2 cell = fract(p.xy * 1.1);
    float edge = min(min(cell.x, 1.0 - cell.x), min(cell.y, 1.0 - cell.y));
    return cosPal(edge * 2.0 + t * 0.04, vec3(0.42,0.44,0.52), vec3(0.30,0.28,0.34), vec3(1.0,1.0,1.0), vec3(0.1,0.25,0.5));
  }`,
  js: { size: 0.76, soft: 1.4, alpha: 0.64, bloom: 1.2, blending: 'additive', trail: 0.4, ignite: 0.7 },
  envelope: { inhale: 0.48, exhale: 2.4, peak: 1.9 },
});

form({
  slug: 'moire', name: 'two grids disagreeing', family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.03\n#define FORM_SPEED 0.9',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float a = uTime * 0.06;
    mat2 r = rot(a);
    vec2 g1 = fract(o.xy * 1.7) - 0.5;
    vec2 g2 = fract((r * o.xy) * 1.75) - 0.5;
    vec3 target = vec3(o.xy + (g1 - g2) * 0.42, o.z);
    return (target - p) * 0.026;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float beat = sin(p.x * 5.3) * sin(p.y * 5.1 + t * 0.2);
    return cosPal(beat * 0.3 + 0.4, vec3(0.46,0.46,0.50), vec3(0.34,0.34,0.36), vec3(1.0,1.0,1.0), vec3(0.0,0.15,0.3));
  }`,
  js: { size: 0.66, soft: 1.2, alpha: 0.7, bloom: 1.25, blending: 'additive', trail: 0.36, ignite: 0.8 },
  envelope: { inhale: 0.46, exhale: 2.3, peak: 1.85 },
});

form({
  slug: 'penrose', name: 'a tiling that never repeats', family: 'geometric', origin: 'spiral',
  defines: '#define FORM_HOME 0.024\n#define FORM_SPEED 0.95',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float acc = 0.0;
    vec2 dir = vec2(1.0, 0.0);
    for (int i = 0; i < 5; i++) {
      acc += cos(dot(dir, p.xy) * 3.1 + uTime * 0.18);
      dir = rot(PI * 0.4) * dir;
    }
    vec2 push = normalize(p.xy + 0.0001) * acc * 0.0016;
    return vec3(push, (o.z - p.z) * 0.02);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float acc = 0.0;
    vec2 dir = vec2(1.0, 0.0);
    for (int i = 0; i < 5; i++) {
      acc += cos(dot(dir, p.xy) * 3.1 + t * 0.18);
      dir = rot(PI * 0.4) * dir;
    }
    return cosPal(acc * 0.12 + 0.5, vec3(0.48,0.42,0.52), vec3(0.32,0.28,0.34), vec3(1.0,1.0,1.0), vec3(0.15,0.35,0.6));
  }`,
  js: { size: 0.74, soft: 1.5, alpha: 0.66, bloom: 1.3, blending: 'additive', trail: 0.44, ignite: 0.85 },
  envelope: { inhale: 0.5, exhale: 2.6, peak: 1.95 },
});

// ───────────────────────────────────────── family: textual ─────────────────────────────────────
form({
  slug: 'margin', name: 'a note in the margin', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.02\n#define FORM_SPEED 0.9',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float drift = smoothstep(0.0, 1.0, fract(uTime * 0.08 + id * 0.3));
    vec3 target = o + vec3(2.7 * drift, -0.5 * drift, 0.0);
    vec3 v = (target - p) * 0.02;
    v.y += sin(uTime * 0.7 + id * TAU) * 0.0012;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float fade = clamp(1.0 - (p.x - 0.4) * 0.4, 0.15, 1.0);
    return mix(vec3(0.30,0.28,0.24), vec3(0.88,0.86,0.80), fade);
  }`,
  js: { size: 0.78, soft: 1.5, alpha: 0.62, bloom: 1.0, blending: 'additive', trail: 0.5, ignite: 0.6 },
  envelope: { inhale: 0.5, exhale: 2.6, peak: 1.8 },
});

form({
  slug: 'palimpsest', name: 'a page written twice', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.018\n#define FORM_SPEED 0.85',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float layer = step(0.5, fract(id * 7.7));
    float t = uTime * 0.22 + layer * PI;
    vec3 ghost = vec3(o.x * 0.92 + 0.25, -o.y * 0.9, o.z + 0.2);
    vec3 target = mix(o, ghost, 0.5 + 0.5 * sin(t));
    return (target - p) * 0.019;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float layer = step(0.5, fract(id * 7.7));
    float breath = 0.5 + 0.5 * sin(t * 0.22 + layer * PI);
    return mix(vec3(0.24,0.22,0.26), vec3(0.78,0.74,0.68), mix(breath, 1.0 - breath, layer));
  }`,
  js: { size: 0.8, soft: 1.7, alpha: 0.56, bloom: 1.05, blending: 'additive', trail: 0.62, ignite: 0.55 },
  envelope: { inhale: 0.55, exhale: 2.8, peak: 1.8 },
});

form({
  slug: 'cipher', name: 'a message not yet decoded', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.016\n#define FORM_SPEED 1.15',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float step_ = floor(uTime * 0.8);
    float jump = fract(sin(id * 91.7 + step_ * 13.1) * 43758.5453);
    vec3 scrambled = vec3(
      mix(-2.4, 2.4, fract(jump * 3.1)),
      mix(-0.9, 0.9, fract(jump * 7.7)),
      o.z);
    float settle = smoothstep(0.55, 1.0, fract(uTime * 0.8));
    return (mix(scrambled, o, settle) - p) * 0.05;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float settle = smoothstep(0.55, 1.0, fract(t * 0.8));
    return mix(vec3(0.20,0.44,0.36), vec3(0.86,0.90,0.82), settle);
  }`,
  js: { size: 0.74, soft: 1.4, alpha: 0.66, bloom: 1.2, blending: 'additive', trail: 0.3, ignite: 0.9 },
  envelope: { inhale: 0.4, exhale: 2.2, peak: 2.0 },
});

// ──────────────────────────────────────── family: attractor ────────────────────────────────────
form({
  slug: 'chen', name: 'the Chen attractor', family: 'attractor', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.0\n#define FORM_SIZE 0.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 q = p * 1.6;
    float a = 5.0, b = -10.0, c = -0.38;
    vec3 d = vec3(a * q.x - q.y * q.z, b * q.y + q.x * q.z, c * q.z + q.x * q.y / 3.0);
    return d * 0.00035;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(length(p) * 0.2 + id * 0.15, vec3(0.42,0.38,0.52), vec3(0.30,0.26,0.34), vec3(1.0,1.0,1.0), vec3(0.0,0.2,0.45));
  }`,
  js: { size: 0.66, soft: 1.3, alpha: 0.66, bloom: 1.35, blending: 'additive', trail: 0.88, ignite: 0.9 },
  envelope: { inhale: 0.42, exhale: 2.6, peak: 2.1 },
});

form({
  slug: 'dadras', name: 'the Dadras attractor', family: 'attractor', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.0\n#define FORM_SIZE 0.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 q = p * 1.4;
    float a = 3.0, b = 2.7, c = 1.7, d = 2.0, e = 9.0;
    vec3 dq = vec3(
      q.y - a * q.x + b * q.y * q.z,
      c * q.y - q.x * q.z + q.z,
      d * q.x * q.y - e * q.z);
    return dq * 0.0016;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(p.z * 0.18 + 0.4, vec3(0.40,0.46,0.42), vec3(0.28,0.32,0.28), vec3(1.0,1.0,1.0), vec3(0.2,0.4,0.6));
  }`,
  js: { size: 0.66, soft: 1.3, alpha: 0.68, bloom: 1.3, blending: 'additive', trail: 0.9, ignite: 0.85 },
  envelope: { inhale: 0.42, exhale: 2.6, peak: 2.1 },
});

form({
  slug: 'sprott', name: 'the Sprott attractor', family: 'attractor', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.0\n#define FORM_SIZE 0.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 q = p * 1.5;
    float a = 2.07, b = 1.79;
    vec3 dq = vec3(
      q.y + a * q.x * q.y + q.x * q.z,
      1.0 - b * q.x * q.x + q.y * q.z,
      q.x - q.x * q.x - q.y * q.y);
    return dq * 0.0028;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(length(p.xy) * 0.24 + t * 0.02, vec3(0.50,0.40,0.36), vec3(0.32,0.26,0.24), vec3(1.0,1.0,1.0), vec3(0.05,0.25,0.5));
  }`,
  js: { size: 0.66, soft: 1.3, alpha: 0.66, bloom: 1.35, blending: 'additive', trail: 0.88, ignite: 0.9 },
  envelope: { inhale: 0.42, exhale: 2.6, peak: 2.1 },
});

// ────────────────────────────────────────── family: water ──────────────────────────────────────
form({
  slug: 'tide', name: 'the tide deciding', family: 'water', origin: 'band',
  defines: '#define FORM_HOME 0.004\n#define FORM_SPEED 0.8',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float breath = sin(uTime * 0.24 + uSeed);
    float reach = 1.4 + breath * 1.1;
    float wet = smoothstep(reach + 0.3, reach - 0.3, p.x);
    vec3 v = vec3((reach - p.x) * 0.004 * wet, 0.0, 0.0);
    v.y += sin(p.x * 2.4 - uTime * 1.3) * 0.0026 * wet;
    v.y += (o.y - p.y) * 0.012;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float reach = 1.4 + sin(t * 0.24) * 1.1;
    float wet = smoothstep(reach + 0.5, reach - 0.5, p.x);
    return mix(vec3(0.34,0.32,0.28), vec3(0.24,0.44,0.54), wet);
  }`,
  js: { size: 0.86, soft: 1.9, alpha: 0.58, bloom: 1.0, blending: 'additive', trail: 0.66, ignite: 0.55 },
  envelope: { inhale: 0.58, exhale: 3.0, peak: 1.75 },
});

form({
  slug: 'rainfall', name: 'rain on the surface', family: 'water', origin: 'rain',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.35',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float fall = fract(uTime * 0.22 + id);
    if (p.y < -1.7) {
      vec2 out_ = normalize(p.xz + 0.0001);
      return vec3(out_.x * 0.02, 0.006, out_.y * 0.02);
    }
    return vec3(sin(id * 40.0) * 0.0008, -0.03 - fall * 0.01, 0.0);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float splash = smoothstep(-1.5, -1.9, p.y);
    return mix(vec3(0.30,0.42,0.56), vec3(0.82,0.90,0.96), splash);
  }`,
  js: { size: 0.7, soft: 1.3, alpha: 0.62, bloom: 1.2, blending: 'additive', trail: 0.9, ignite: 0.7 },
  envelope: { inhale: 0.38, exhale: 2.2, peak: 2.0 },
});

form({
  slug: 'undertow', name: 'the undertow', family: 'water', origin: 'band',
  defines: '#define FORM_HOME 0.0012\n#define FORM_SPEED 1.05',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float deep = smoothstep(0.4, -0.9, p.y);
    vec3 v = vec3(mix(0.012, -0.014, deep), 0.0, 0.0);
    v.y += sin(p.x * 1.6 + uTime * 0.9) * 0.003 * (1.0 - deep);
    v += curlNoise(p * 0.7 + vec3(uTime * 0.1, uSeed, 0.0)) * 0.0022;
    if (abs(p.x) > 3.2) v.x = -sign(p.x) * 0.3;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float deep = smoothstep(0.5, -1.0, p.y);
    return mix(vec3(0.46,0.60,0.66), vec3(0.08,0.16,0.28), deep);
  }`,
  js: { size: 0.84, soft: 1.9, alpha: 0.58, bloom: 1.0, blending: 'additive', trail: 0.76, ignite: 0.5 },
  envelope: { inhale: 0.5, exhale: 2.7, peak: 1.9 },
});

// ───────────────────────────────────────── family: gravity ─────────────────────────────────────
form({
  slug: 'tidal', name: 'a moon pulling the sea', family: 'gravity', origin: 'sphere',
  defines: '#define FORM_HOME 0.004\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 moon = vec3(cos(uTime * 0.22) * 3.2, sin(uTime * 0.22) * 1.5, 0.0);
    vec3 d = moon - p;
    float r2 = max(dot(d, d), 0.4);
    vec3 pull = d / sqrt(r2) * (0.02 / r2);
    vec3 anti = -normalize(d) * (0.006 / r2);
    return pull + anti + (normalize(p + 0.0001) * (1.45 - length(p))) * 0.028;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec3 moon = vec3(cos(t * 0.22) * 3.2, sin(t * 0.22) * 1.5, 0.0);
    float near = smoothstep(3.2, 0.8, length(moon - p));
    return mix(vec3(0.18,0.24,0.38), vec3(0.80,0.84,0.94), near);
  }`,
  js: { size: 0.96, soft: 1.8, alpha: 0.74, bloom: 1.45, blending: 'additive', trail: 0.66, ignite: 0.95 },
  envelope: { inhale: 0.5, exhale: 2.7, peak: 1.95 },
});

form({
  slug: 'slingshot', name: 'a slingshot around a dark mass', family: 'gravity', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.4',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 mass = vec3(0.0, 0.0, 0.0);
    vec3 d = mass - p;
    float r = max(length(d), 0.5);
    vec3 pull = d / r * (0.05 / (r * r));
    vec2 tang = vec2(-d.y, d.x) / r;
    float id = idOf(o);
    vec3 v = pull + vec3(tang * 0.02 * sign(fract(id * 3.3) - 0.5), 0.0);
    if (r > 3.4) v += d / r * 0.02;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float speed = smoothstep(3.0, 0.6, length(p));
    return mix(vec3(0.20,0.22,0.34), vec3(0.94,0.86,0.70), speed);
  }`,
  js: { size: 0.72, soft: 1.4, alpha: 0.68, bloom: 1.45, blending: 'additive', trail: 0.9, ignite: 1.1 },
  envelope: { inhale: 0.4, exhale: 2.4, peak: 2.2 },
});

form({
  slug: 'lagrange', name: 'the quiet points between', family: 'gravity', origin: 'orbit',
  defines: '#define FORM_HOME 0.002\n#define FORM_SPEED 0.95',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 a = vec3(-1.5, 0.0, 0.0);
    vec3 b = vec3(1.5, 0.0, 0.0);
    vec3 da = a - p, db = b - p;
    float ra = max(length(da), 0.7), rb = max(length(db), 0.7);
    vec3 g = da / ra * (0.010 / (ra * ra)) + db / rb * (0.008 / (rb * rb));
    vec2 spin = vec2(-p.y, p.x) * 0.013;
    return g + vec3(spin, -p.z * 0.02) + (o - p) * 0.005;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float calm = smoothstep(1.4, 0.2, min(length(p - vec3(0.0, 1.3, 0.0)), length(p - vec3(0.0, -1.3, 0.0))));
    return mix(vec3(0.22,0.26,0.36), vec3(0.88,0.82,0.60), calm);
  }`,
  js: { size: 0.92, soft: 1.7, alpha: 0.76, bloom: 1.55, blending: 'additive', trail: 0.74, ignite: 1.0 },
  envelope: { inhale: 0.46, exhale: 2.6, peak: 2.0 },
});

// ────────────────────────────────────────── family: light ──────────────────────────────────────
form({
  slug: 'caustics', name: 'light bent through water', family: 'light', origin: 'veil',
  defines: '#define FORM_HOME 0.012\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float w1 = sin(o.x * 2.1 + uTime * 0.9);
    float w2 = sin(o.y * 1.8 - uTime * 0.7 + uSeed);
    float w3 = sin((o.x + o.y) * 1.4 + uTime * 0.5);
    vec3 target = o + vec3(w1 * 0.22, w2 * 0.18, w3 * 0.1);
    return (target - p) * 0.03;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float w = sin(p.x * 2.1 + t * 0.9) * sin(p.y * 1.8 - t * 0.7);
    float bright = pow(smoothstep(0.1, 0.95, w), 2.0);
    return mix(vec3(0.10,0.20,0.30), vec3(0.86,0.96,1.0), bright);
  }`,
  js: { size: 0.8, soft: 1.6, alpha: 0.62, bloom: 1.7, blending: 'additive', trail: 0.5, ignite: 1.3 },
  envelope: { inhale: 0.44, exhale: 2.5, peak: 2.1 },
});

form({
  slug: 'lighthouse', name: 'a lighthouse sweeping', family: 'light', origin: 'ring',
  defines: '#define FORM_HOME 0.006\n#define FORM_SPEED 1.05',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float beam = uTime * 0.5;
    float a = atan(p.y, p.x);
    float lit = pow(max(0.0, cos(a - beam)), 12.0);
    vec3 out_ = normalize(vec3(p.xy, 0.0) + 0.0001);
    return out_ * lit * 0.02 - out_ * 0.002 + vec3(0.0, 0.0, (o.z - p.z) * 0.02);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float a = atan(p.y, p.x);
    float lit = pow(max(0.0, cos(a - t * 0.5)), 8.0);
    return mix(vec3(0.14,0.16,0.24), vec3(1.0,0.94,0.76), lit);
  }`,
  js: { size: 0.82, soft: 1.5, alpha: 0.64, bloom: 1.75, blending: 'additive', trail: 0.72, ignite: 1.4 },
  envelope: { inhale: 0.42, exhale: 2.4, peak: 2.15 },
});

form({
  slug: 'halo', name: 'a halo around the moon', family: 'light', origin: 'shell',
  defines: '#define FORM_HOME 0.01\n#define FORM_SPEED 0.85',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = length(p.xy) + 0.0001;
    float ring = 1.85;
    vec2 radial = p.xy / r;
    vec3 v = vec3(radial * (ring - r) * 0.02, 0.0);
    vec2 tang = vec2(-radial.y, radial.x);
    v.xy += tang * 0.0035;
    v.z += (o.z * 0.4 - p.z) * 0.02;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float r = length(p.xy);
    float band = smoothstep(0.42, 0.0, abs(r - 1.85));
    vec3 spectrum = cosPal((r - 1.6) * 1.4, vec3(0.5,0.5,0.5), vec3(0.45,0.42,0.40), vec3(1.0,1.0,1.0), vec3(0.0,0.33,0.67));
    return mix(vec3(0.10,0.12,0.20), spectrum, band);
  }`,
  js: { size: 0.86, soft: 1.9, alpha: 0.56, bloom: 1.5, blending: 'additive', trail: 0.5, ignite: 1.0 },
  envelope: { inhale: 0.5, exhale: 2.8, peak: 1.9 },
});
