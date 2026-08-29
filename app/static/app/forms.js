// The forms of the dark (ADR 0004, amended: fifty became eighty, then a hundred). Each form is data: a GLSL force program, a GLSL palette,
// tuning defines, a JS config, and an origin layout. The engine (entry.js) injects force/color into
// its shared shader templates and compiles lazily, once per form. Contract available to form GLSL:
//   uniforms  uTime uSeed uEnergy uRelease uPulse uPointer
//   helpers   snoise(vec3) curlNoise(vec3) rot(float)->mat2 cosPal(t,a,b,c,d) idOf(vec3) PI TAU
//   formForce returns a per-frame velocity contribution (~0.001..0.06); the engine template adds
//   pointer/pulse (×FORM_POINTER), release breath (×FORM_RELEASE), homing (×FORM_HOME), applies
//   FORM_SPEED, and clamps runaway particles back toward origin.
// Defines a form may override: FORM_HOME FORM_POINTER FORM_RELEASE FORM_SPEED (sim) and
// FORM_SIZE FORM_SOFT FORM_ALPHA FORM_SHIMMER (render).

const F = [];
const form = (def) => { F.push(def); return def; };

// ─────────────────────────────────────────── family: flow ──────────────────────────────────────
form({
  slug: 'murmuration', name: 'a murmuration of starlings', family: 'flow', origin: 'band',
  defines: '#define FORM_HOME 0.0006\n#define FORM_SPEED 1.35',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 heart = vec3(sin(uTime * 0.31 + uSeed) * 1.5, cos(uTime * 0.23 + uSeed * 2.0) * 0.8, sin(uTime * 0.17) * 0.5);
    vec3 toHeart = heart - p;
    vec3 flow = curlNoise(p * 0.42 + vec3(0.0, 0.0, uTime * 0.16));
    vec3 v = flow * 0.011 + normalize(toHeart) * 0.0075 * smoothstep(0.4, 2.6, length(toHeart));
    v.xy += vec2(cos(id * TAU + uTime), sin(id * TAU + uTime)) * 0.0016;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(length(p.xy) * 0.24 + t * 0.05, vec3(0.44,0.50,0.62), vec3(0.28,0.30,0.38), vec3(1.0,1.0,1.0), vec3(0.0,0.08,0.18));
  }`,
  js: { size: 0.9, soft: 1.9, alpha: 0.62, bloom: 1.05, blending: 'additive', trail: 0.55, ignite: 0.9 },
  envelope: { inhale: 0.42, exhale: 2.6, peak: 2.1 },
});

form({
  slug: 'river', name: 'a river in the dark', family: 'flow', origin: 'band',
  defines: '#define FORM_HOME 0.0011',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float bend = snoise(vec3(p.x * 0.35, uSeed, uTime * 0.05)) * 0.9;
    vec3 v = vec3(0.012 + uEnergy * 0.004, (bend - p.y * 0.55) * 0.012, -p.z * 0.01);
    v += curlNoise(p * 0.9 + vec3(uTime * 0.1, 0.0, 0.0)) * 0.0035;
    if (p.x > 3.4) v.x = -0.35;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(p.x * 0.12 + t * 0.03, vec3(0.22,0.44,0.56), vec3(0.16,0.30,0.34), vec3(1.0,1.0,1.0), vec3(0.55,0.42,0.30));
  }`,
  js: { size: 0.85, soft: 1.7, alpha: 0.6, bloom: 1.0, blending: 'additive', trail: 0.7, ignite: 0.7 },
  envelope: { inhale: 0.5, exhale: 2.4, peak: 2.0 },
});

form({
  slug: 'aurora', name: 'an aurora', family: 'flow', origin: 'band',
  defines: '#define FORM_HOME 0.0018\n#define FORM_SIZE 1.35\n#define FORM_SOFT 2.4',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float curtain = snoise(vec3(p.x * 0.55, uTime * 0.09, uSeed));
    float lift = snoise(vec3(p.x * 1.4 + uTime * 0.22, p.y * 0.3, uSeed * 3.0));
    return vec3(curtain * 0.004, lift * 0.016 + (o.y + 0.9 - p.y) * 0.004, sin(uTime * 0.2 + p.x) * 0.002);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float h = smoothstep(-1.4, 1.8, p.y);
    return mix(vec3(0.05, 0.55, 0.34), mix(vec3(0.18, 0.8, 0.52), vec3(0.62, 0.28, 0.72), h), h) * (0.7 + 0.3 * sin(p.x * 2.0 + t));
  }`,
  js: { size: 1.3, soft: 2.4, alpha: 0.5, bloom: 1.5, blending: 'additive', trail: 0.8, ignite: 0.5 },
  envelope: { inhale: 0.55, exhale: 3.0, peak: 1.8 },
});

form({
  slug: 'silk', name: 'ribbons of silk', family: 'flow', origin: 'ring',
  defines: '#define FORM_HOME 0.0009\n#define FORM_SPEED 1.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float ribbon = floor(id * 7.0) / 7.0;
    vec3 axis = normalize(vec3(sin(ribbon * TAU), cos(ribbon * TAU), 0.6));
    vec3 swirl = cross(axis, p) * 0.012;
    return swirl + curlNoise(p * 0.7 + ribbon * 9.0 + uTime * 0.1) * 0.006;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(floor(id * 7.0) / 7.0 + t * 0.02, vec3(0.62,0.42,0.52), vec3(0.32,0.28,0.34), vec3(1.0,1.0,1.0), vec3(0.0,0.33,0.66));
  }`,
  js: { size: 0.95, soft: 2.0, alpha: 0.58, bloom: 1.2, blending: 'additive', trail: 0.88, ignite: 0.8 },
  envelope: { inhale: 0.45, exhale: 2.5, peak: 2.0 },
});

form({
  slug: 'tidepool', name: 'a turning tidepool', family: 'flow', origin: 'nebula',
  defines: '#define FORM_HOME 0.0022',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = max(length(p.xy), 0.2);
    vec2 tangent = vec2(-p.y, p.x) / r;
    float pull = sin(uTime * 0.24 + uSeed) * 0.5 + 0.6;
    vec3 v = vec3(tangent * (0.011 * pull / r), (o.z - p.z) * 0.01);
    v.xy -= normalize(p.xy) * 0.0015 * sin(r * 3.0 - uTime * 0.8);
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(length(p.xy) * 0.3 - t * 0.04, vec3(0.24,0.52,0.56), vec3(0.18,0.34,0.30), vec3(1.0,1.0,1.0), vec3(0.42,0.30,0.20));
  }`,
  js: { size: 0.9, soft: 1.8, alpha: 0.6, bloom: 1.1, blending: 'additive', trail: 0.6, ignite: 0.6 },
  envelope: { inhale: 0.5, exhale: 2.3, peak: 1.9 },
});

// ────────────────────────────────────────── family: cosmic ─────────────────────────────────────
form({
  slug: 'nebula', name: 'a slow nebula', family: 'cosmic', origin: 'nebula',
  defines: '#define FORM_HOME 0.0028',
  force: `vec3 formForce(vec3 p, vec3 o) {
    return curlNoise(p * 0.5 + vec3(0.0, 0.0, uTime * 0.08)) * 0.008;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(length(p) * 0.22 + snoise(p * 0.8) * 0.15, vec3(0.28,0.22,0.42), vec3(0.26,0.20,0.28), vec3(1.0,1.0,1.0), vec3(0.85,0.60,0.35));
  }`,
  js: { size: 1.0, soft: 1.6, alpha: 0.66, bloom: 1.35, blending: 'additive', trail: 0.5, ignite: 0.6 },
  envelope: { inhale: 0.48, exhale: 2.35, peak: 2.2 },
});

form({
  slug: 'supernova', name: 'a supernova, twice', family: 'cosmic', origin: 'sphere',
  defines: '#define FORM_HOME 0.0016\n#define FORM_RELEASE 2.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float cycle = mod(uTime * 0.4 + uSeed, 7.0);
    float burst = smoothstep(0.0, 0.12, cycle) * smoothstep(1.6, 0.5, cycle);
    float r = max(length(p), 0.15);
    vec3 v = normalize(p) * burst * 0.05 / r;
    v -= normalize(p) * smoothstep(2.2, 6.5, cycle) * 0.012;
    return v + curlNoise(p * 0.8) * 0.002;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float heat = 1.0 / (0.4 + length(p) * 0.5);
    return mix(vec3(0.35, 0.12, 0.4), vec3(1.0, 0.72, 0.4), clamp(heat, 0.0, 1.0));
  }`,
  js: { size: 1.05, soft: 1.5, alpha: 0.7, bloom: 1.7, blending: 'additive', trail: 0.75, ignite: 1.5 },
  envelope: { inhale: 0.35, exhale: 2.8, peak: 2.6 },
});

form({
  slug: 'galaxy', name: 'a young galaxy', family: 'cosmic', origin: 'spiral',
  defines: '#define FORM_HOME 0.0012',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = max(length(p.xy), 0.18);
    vec2 tangent = vec2(-p.y, p.x) / r;
    return vec3(tangent * 0.014 / sqrt(r), (o.z * 0.3 - p.z) * 0.012);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float arm = sin(atan(p.y, p.x) * 2.0 - length(p.xy) * 2.6);
    return mix(vec3(0.30, 0.30, 0.55), vec3(0.95, 0.85, 0.70), smoothstep(-0.2, 0.9, arm) * 0.7 + 0.15 / (0.2 + length(p.xy)));
  }`,
  js: { size: 0.8, soft: 1.7, alpha: 0.45, bloom: 1.3, blending: 'additive', trail: 0.82, ignite: 0.8 },
  envelope: { inhale: 0.5, exhale: 2.6, peak: 2.0 },
});

form({
  slug: 'comets', name: 'a rain of comets', family: 'cosmic', origin: 'cube',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.4',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 dir = normalize(vec3(-0.55, -0.8, -0.12));
    vec3 v = dir * (0.016 + id * 0.02);
    if (p.y < -2.6 || abs(p.x) > 3.6) {
      v = (vec3(o.x + 3.0, 2.8 + id, o.z) - p) * 0.5;
    }
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.55, 0.7, 1.0), vec3(1.0, 0.9, 0.7), id) * (0.75 + 0.25 * sin(t * 3.0 + p.x * 9.0));
  }`,
  js: { size: 1.0, soft: 1.4, alpha: 0.7, bloom: 1.5, blending: 'additive', trail: 0.9, ignite: 1.4 },
  envelope: { inhale: 0.4, exhale: 2.2, peak: 2.3 },
});

form({
  slug: 'eventhorizon', name: 'the edge of a dark star', family: 'cosmic', origin: 'ring',
  defines: '#define FORM_HOME 0.0004\n#define FORM_RELEASE 1.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = max(length(p.xy), 0.3);
    vec2 tangent = vec2(-p.y, p.x) / r;
    float fall = 0.0035 / (r * r);
    vec3 v = vec3(tangent * (0.02 / r) - normalize(p.xy) * fall, -p.z * 0.02);
    if (r < 0.42) v.xy = normalize(p.xy) * 0.4;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float r = length(p.xy);
    return mix(vec3(1.0, 0.62, 0.25), vec3(0.30, 0.20, 0.45), smoothstep(0.4, 2.6, r)) * (1.4 / (0.5 + r));
  }`,
  js: { size: 0.95, soft: 1.6, alpha: 0.68, bloom: 1.6, blending: 'additive', trail: 0.85, ignite: 1.2 },
  envelope: { inhale: 0.6, exhale: 2.4, peak: 2.2 },
});

// ────────────────────────────────────────── family: organic ────────────────────────────────────
form({
  slug: 'fireflies', name: 'a field of fireflies', family: 'organic', origin: 'cube',
  defines: '#define FORM_HOME 0.002\n#define FORM_SIZE 1.2\n#define FORM_SHIMMER 0.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    return vec3(
      snoise(vec3(id * 40.0, uTime * 0.4, 0.0)),
      snoise(vec3(uTime * 0.35, id * 40.0, 4.0)),
      snoise(vec3(8.0, uTime * 0.3, id * 40.0))
    ) * 0.006;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float blink = smoothstep(0.55, 0.95, sin(t * (1.2 + id * 2.4) + id * TAU));
    return mix(vec3(0.05, 0.09, 0.05), vec3(0.98, 0.92, 0.4), blink);
  }`,
  js: { size: 1.15, soft: 2.2, alpha: 0.8, bloom: 1.5, blending: 'additive', trail: 0.08, ignite: 0.5 },
  envelope: { inhale: 0.5, exhale: 2.6, peak: 1.8 },
});

form({
  slug: 'dandelion', name: 'a dandelion letting go', family: 'organic', origin: 'sphere',
  defines: '#define FORM_HOME 0.0007\n#define FORM_RELEASE 1.8',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float gust = smoothstep(-0.4, 0.8, snoise(vec3(uTime * 0.12, uSeed, 0.0)));
    vec3 wind = vec3(0.012 * gust, 0.004 * gust + snoise(p + uTime * 0.2) * 0.002, 0.0);
    return wind + curlNoise(p * 1.3 + uTime * 0.15) * 0.0045;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.9, 0.9, 0.85), vec3(1.0, 0.98, 0.9), id) * 0.9;
  }`,
  js: { size: 0.85, soft: 2.6, alpha: 0.5, bloom: 1.0, blending: 'additive', trail: 0.3, ignite: 0.4 },
  envelope: { inhale: 0.7, exhale: 3.4, peak: 1.6 },
});

form({
  slug: 'moths', name: 'moths around a lantern', family: 'organic', origin: 'sphere',
  defines: '#define FORM_HOME 0.0009\n#define FORM_SPEED 1.3',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 lantern = vec3(0.0, 0.3, 0.0);
    vec3 toL = lantern - p;
    float d = max(length(toL), 0.25);
    vec3 v = normalize(toL) * 0.009 / d;
    v += vec3(cos(uTime * (3.0 + id * 4.0) + id * 40.0), sin(uTime * (2.4 + id * 5.0) + id * 30.0), cos(uTime * (2.0 + id * 3.0))) * 0.0085;
    if (d < 0.5) v -= normalize(toL) * 0.03;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float near = 1.0 / (0.4 + length(p - vec3(0.0, 0.3, 0.0)));
    return mix(vec3(0.35, 0.30, 0.28), vec3(1.0, 0.85, 0.55), clamp(near * 0.5, 0.0, 1.0));
  }`,
  js: { size: 1.0, soft: 1.8, alpha: 0.64, bloom: 1.3, blending: 'additive', trail: 0.25, ignite: 0.7 },
  envelope: { inhale: 0.45, exhale: 2.4, peak: 2.0 },
});

form({
  slug: 'jellyfish', name: 'a bloom of jellyfish', family: 'organic', origin: 'cluster',
  defines: '#define FORM_HOME 0.0026',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = floor(idOf(o) * 9.0);
    float pulse = max(sin(uTime * 1.4 + id * 1.7), 0.0);
    vec3 up = vec3(0.0, pulse * pulse * 0.012 - 0.003, 0.0);
    return up + curlNoise(p * 1.1 + id * 5.0) * 0.003;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(id * 0.4 + 0.5, vec3(0.35,0.25,0.45), vec3(0.30,0.22,0.30), vec3(1.0,1.0,1.0), vec3(0.0,0.25,0.5)) * (0.8 + 0.3 * sin(t * 1.4));
  }`,
  js: { size: 1.1, soft: 2.3, alpha: 0.55, bloom: 1.35, blending: 'additive', trail: 0.45, ignite: 0.5 },
  envelope: { inhale: 0.6, exhale: 2.8, peak: 1.8 },
});

form({
  slug: 'mycelium', name: 'mycelium finding its way', family: 'organic', origin: 'ring',
  defines: '#define FORM_HOME 0.0005\n#define FORM_SPEED 0.85',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 n = curlNoise(p * 2.4 + uSeed);
    vec3 out2 = normalize(vec3(p.xy, 0.0) + 0.0001) * 0.004;
    return out2 + n * 0.0055 + vec3(0.0, 0.0, (o.z - p.z) * 0.02);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.75, 0.72, 0.62), vec3(0.45, 0.55, 0.42), snoise(p * 2.0)) * (0.55 + 0.2 * sin(t + p.x));
  }`,
  js: { size: 0.7, soft: 1.5, alpha: 0.52, bloom: 0.9, blending: 'additive', trail: 0.65, ignite: 0.3 },
  envelope: { inhale: 0.55, exhale: 3.2, peak: 1.5 },
});

// ───────────────────────────────────────── family: elemental ───────────────────────────────────
form({
  slug: 'embers', name: 'embers off a night fire', family: 'elemental', origin: 'cluster',
  defines: '#define FORM_HOME 0.0006',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 v = vec3(snoise(vec3(p.y * 1.4, uTime * 0.5, id * 10.0)) * 0.005, 0.011 + id * 0.006, 0.0);
    if (p.y > 2.8) return (vec3(o.x, -1.8, o.z) - p) * 0.4;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float life = smoothstep(3.0, -1.6, p.y);
    return mix(vec3(1.0, 0.85, 0.45), vec3(0.55, 0.12, 0.05), 1.0 - life) * (0.6 + life);
  }`,
  js: { size: 0.95, soft: 1.7, alpha: 0.75, bloom: 1.55, blending: 'additive', trail: 0.6, ignite: 1.2 },
  envelope: { inhale: 0.4, exhale: 2.4, peak: 2.2 },
});

form({
  slug: 'snowfall', name: 'snow that never lands', family: 'elemental', origin: 'cube',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 0.8\n#define FORM_SHIMMER 0.25',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 v = vec3(sin(uTime * 0.7 + id * 20.0 + p.y * 2.0) * 0.003, -0.006 - id * 0.004, 0.0);
    if (p.y < -2.6) return (vec3(o.x, 2.7, o.z) - p) * 0.5;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return vec3(0.85, 0.9, 1.0) * (0.55 + 0.45 * id);
  }`,
  js: { size: 1.0, soft: 2.4, alpha: 0.6, bloom: 0.85, blending: 'additive', trail: 0.12, ignite: 0.2 },
  envelope: { inhale: 0.8, exhale: 3.6, peak: 1.4 },
});

form({
  slug: 'updraft', name: 'rain remembering upward', family: 'elemental', origin: 'cube',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.25',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 v = vec3(0.0, 0.014 + id * 0.012, 0.0);
    v.x += snoise(vec3(p.y * 0.6, id * 30.0, uTime * 0.2)) * 0.002;
    if (p.y > 2.8) return (vec3(o.x, -2.7, o.z) - p) * 0.5;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.35, 0.55, 0.75), vec3(0.75, 0.9, 1.0), smoothstep(-2.5, 2.5, p.y));
  }`,
  js: { size: 0.8, soft: 1.3, alpha: 0.6, bloom: 1.1, blending: 'additive', trail: 0.55, ignite: 0.8 },
  envelope: { inhale: 0.45, exhale: 2.2, peak: 2.0 },
});

form({
  slug: 'lightning', name: 'veins of slow lightning', family: 'elemental', origin: 'band',
  defines: '#define FORM_HOME 0.004\n#define FORM_SPEED 1.5\n#define FORM_SHIMMER 0.8',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float strike = step(0.86, fract(sin(floor(uTime * 1.6) * 91.7 + uSeed) * 437.5));
    vec3 branch = vec3(snoise(p * 3.0 + uTime), snoise(p * 3.0 + 40.0), 0.0);
    return branch * (0.003 + strike * 0.045);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float strike = step(0.86, fract(sin(floor(t * 1.6) * 91.7) * 437.5));
    return mix(vec3(0.58, 0.62, 0.82), vec3(0.9, 0.94, 1.0), strike) * (1.05 + strike * 1.4);
  }`,
  js: { size: 0.85, soft: 1.4, alpha: 0.7, bloom: 1.8, blending: 'additive', trail: 0.78, ignite: 1.6 },
  envelope: { inhale: 0.3, exhale: 2.0, peak: 2.6 },
});

form({
  slug: 'geyser', name: 'a patient geyser', family: 'elemental', origin: 'cluster',
  defines: '#define FORM_HOME 0.001',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float cycle = mod(uTime * 0.5 + uSeed, 6.0);
    float blast = smoothstep(0.0, 0.3, cycle) * smoothstep(1.8, 0.6, cycle);
    float nozzle = smoothstep(0.7, 0.0, abs(p.x));
    vec3 v = vec3(p.x * 0.004, blast * nozzle * 0.05, 0.0);
    v.y -= 0.006 * smoothstep(0.4, 2.4, p.y) * (1.0 - blast);
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.5, 0.68, 0.72), vec3(0.95, 0.98, 1.0), smoothstep(-1.0, 2.4, p.y));
  }`,
  js: { size: 0.95, soft: 2.0, alpha: 0.6, bloom: 1.25, blending: 'additive', trail: 0.5, ignite: 1.1 },
  envelope: { inhale: 0.5, exhale: 2.5, peak: 2.1 },
});

// ───────────────────────────────────────── family: geometric ───────────────────────────────────
form({
  slug: 'crystallize', name: 'a crystal remembering its lattice', family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.02\n#define FORM_POINTER 2.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    return curlNoise(p * 1.8 + uTime * 0.05) * 0.0028 * (1.0 + uPulse * 3.0);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(dot(p, vec3(0.4)) + t * 0.02, vec3(0.55,0.62,0.70), vec3(0.25,0.25,0.30), vec3(1.0,1.0,1.0), vec3(0.0,0.1,0.2));
  }`,
  js: { size: 0.85, soft: 1.5, alpha: 0.66, bloom: 1.15, blending: 'additive', trail: 0.15, ignite: 0.6 },
  envelope: { inhale: 0.4, exhale: 2.0, peak: 2.2 },
});

form({
  slug: 'mandala', name: 'a breathing mandala', family: 'geometric', origin: 'ring',
  defines: '#define FORM_HOME 0.012',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float a = atan(p.y, p.x);
    float fold = sin(a * 8.0 + uTime * 0.4) * 0.004;
    float breath = sin(uTime * 0.5) * 0.005;
    return vec3(normalize(p.xy + 0.0001) * (fold + breath), (sin(a * 4.0 + uTime) * 0.3 - p.z) * 0.01);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float a = atan(p.y, p.x);
    return cosPal(a / TAU + length(p.xy) * 0.15, vec3(0.5,0.35,0.4), vec3(0.35,0.25,0.3), vec3(1.0,1.0,1.0), vec3(0.0,0.33,0.67));
  }`,
  js: { size: 0.9, soft: 1.9, alpha: 0.62, bloom: 1.3, blending: 'additive', trail: 0.5, ignite: 0.5 },
  envelope: { inhale: 0.5, exhale: 2.6, peak: 1.9 },
});

form({
  slug: 'phyllotaxis', name: 'the sunflower spiral', family: 'geometric', origin: 'spiral',
  defines: '#define FORM_HOME 0.016',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = length(p.xy);
    vec2 tangent = vec2(-p.y, p.x) / max(r, 0.1);
    return vec3(tangent * 0.003 * sin(uTime * 0.3), (snoise(vec3(r * 3.0, uTime * 0.2, uSeed)) * 0.2 - p.z) * 0.02);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.85, 0.68, 0.25), vec3(0.45, 0.3, 0.5), smoothstep(0.2, 2.4, length(p.xy)));
  }`,
  js: { size: 0.95, soft: 1.8, alpha: 0.66, bloom: 1.2, blending: 'additive', trail: 0.45, ignite: 0.5 },
  envelope: { inhale: 0.45, exhale: 2.4, peak: 2.0 },
});

form({
  slug: 'hypercube', name: "a hypercube's shadow", family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.03\n#define FORM_SPEED 1.1',
  force: `vec3 formForce(vec3 p, vec3 o) {
    mat2 ra = rot(uTime * 0.22);
    mat2 rb = rot(uTime * 0.31);
    vec3 target = o;
    target.xy = ra * target.xy;
    target.xz = rb * target.xz;
    return (target - p) * 0.06 - (o - p) * 0.03;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.45, 0.75, 0.85), vec3(0.9, 0.5, 0.8), 0.5 + 0.5 * sin(dot(p, vec3(1.4)) + t * 0.6));
  }`,
  js: { size: 0.9, soft: 1.6, alpha: 0.64, bloom: 1.25, blending: 'additive', trail: 0.6, ignite: 0.7 },
  envelope: { inhale: 0.4, exhale: 2.2, peak: 2.1 },
});

form({
  slug: 'loom', name: 'threads on an unseen loom', family: 'geometric', origin: 'band',
  defines: '#define FORM_HOME 0.008',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float warp = sin(p.x * 5.0 + uTime * 0.8) * sin(p.y * 5.0 - uTime * 0.6);
    return vec3(0.0, warp * 0.006, (warp * 0.4 - p.z) * 0.02);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float weave = sin(p.x * 5.0 + t * 0.8) * sin(p.y * 5.0 - t * 0.6);
    return mix(vec3(0.65, 0.5, 0.35), vec3(0.35, 0.55, 0.65), 0.5 + 0.5 * weave);
  }`,
  js: { size: 0.8, soft: 1.6, alpha: 0.6, bloom: 1.0, blending: 'additive', trail: 0.55, ignite: 0.4 },
  envelope: { inhale: 0.5, exhale: 2.4, peak: 1.8 },
});

// ─────────────────────────────────── family: textual (glyph origins) ───────────────────────────
form({
  slug: 'thewords', name: 'the words themselves', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.05\n#define FORM_POINTER 2.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    return curlNoise(p * 1.2 + uTime * 0.1) * 0.0022 * (1.0 + abs(uRelease) * 24.0);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.9, 0.88, 0.82), vec3(0.65, 0.75, 1.0), id) * (0.85 + 0.15 * sin(t * 2.0 + p.x * 6.0));
  }`,
  js: { size: 0.65, soft: 1.8, alpha: 0.3, bloom: 1.1, blending: 'additive', trail: 0.3, ignite: 0.5 },
  envelope: { inhale: 0.9, exhale: 3.2, peak: 2.4 },
});

form({
  slug: 'letterfall', name: 'letters falling like leaves', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 0.9',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    return vec3(sin(uTime * 1.2 + id * 30.0 + p.y * 3.0) * 0.004, -0.005 - id * 0.003, 0.0);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.85, 0.7, 0.4), vec3(0.7, 0.45, 0.3), id);
  }`,
  js: { size: 0.7, soft: 1.9, alpha: 0.42, bloom: 1.0, blending: 'additive', trail: 0.5, ignite: 0.5 },
  envelope: { inhale: 1.1, exhale: 3.8, peak: 1.6 },
});

form({
  slug: 'constellation', name: 'a constellation of what you said', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.03\n#define FORM_SHIMMER 0.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float chosen = step(0.88, id);
    return curlNoise(p + uTime * 0.05) * 0.0012 * (1.0 - chosen);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float star = step(0.88, id);
    float tw = 0.5 + 0.5 * sin(t * (2.0 + id * 6.0) + id * 40.0);
    return mix(vec3(0.38, 0.42, 0.62) * 0.85, vec3(1.0, 0.97, 0.88) * (1.0 + tw), star);
  }`,
  js: { size: 0.9, soft: 2.1, alpha: 0.5, bloom: 1.3, blending: 'additive', trail: 0.2, ignite: 0.4 },
  envelope: { inhale: 1.0, exhale: 3.4, peak: 2.0 },
});

form({
  slug: 'inkbleed', name: 'ink bleeding through paper', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.006\n#define FORM_SPEED 0.8',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 spread = normalize(p - o + 0.0001) * 0.0035;
    return spread * smoothstep(0.0, 2.0, uTime * 0.25) + curlNoise(p * 2.6) * 0.0022;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.30, 0.36, 0.55), vec3(0.55, 0.62, 0.85), id * 0.7);
  }`,
  js: { size: 0.95, soft: 1.5, alpha: 0.34, bloom: 0.95, blending: 'additive', trail: 0.7, ignite: 0.3 },
  envelope: { inhale: 0.8, exhale: 3.0, peak: 1.8 },
});

form({
  slug: 'emberscript', name: 'a sentence burning gently', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.012',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float burn = smoothstep(0.0, 4.0, uTime * 0.5 - o.x - 2.0);
    return vec3(0.0, burn * (0.008 + id * 0.006), 0.0) + curlNoise(p * 2.0 + uTime * 0.3) * 0.002 * burn;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float burn = smoothstep(0.0, 4.0, t * 0.5 - p.x - 2.0);
    return mix(vec3(0.88, 0.84, 0.75), vec3(1.0, 0.45, 0.12), clamp(burn * 1.4, 0.0, 1.0));
  }`,
  js: { size: 0.7, soft: 1.7, alpha: 0.4, bloom: 1.25, blending: 'additive', trail: 0.65, ignite: 1.0 },
  envelope: { inhale: 0.9, exhale: 3.2, peak: 2.1 },
});

// ────────────────────────────── family: strange attractors ─────────────────────────────────────
form({
  slug: 'lorenz', name: 'the Lorenz butterfly', family: 'attractor', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_RELEASE 0.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 q = p * vec3(9.0, 9.0, 9.0) + vec3(0.0, 0.0, 24.0);
    vec3 d = vec3(10.0 * (q.y - q.x), q.x * (28.0 - q.z) - q.y, q.x * q.y - 2.6667 * q.z);
    return d * 0.00055;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(length(p.xy) * 0.3 + t * 0.03, vec3(0.72,0.45,0.66), vec3(0.40,0.34,0.40), vec3(1.0,1.0,1.0), vec3(0.0,0.25,0.5));
  }`,
  js: { size: 1.05, soft: 1.5, alpha: 0.74, bloom: 1.5, blending: 'additive', trail: 0.86, ignite: 1.0 },
  envelope: { inhale: 0.5, exhale: 2.8, peak: 1.8 },
});

form({
  slug: 'rossler', name: "Rössler's slow coil", family: 'attractor', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_RELEASE 0.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 q = p * 5.5;
    vec3 d = vec3(-q.y - q.z, q.x + 0.2 * q.y, 0.2 + q.z * (q.x - 5.7));
    return clamp(d * 0.0012, vec3(-0.05), vec3(0.05));
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(p.z * 0.4 + 0.3, vec3(0.3,0.5,0.45), vec3(0.25,0.3,0.3), vec3(1.0,1.0,1.0), vec3(0.15,0.4,0.6));
  }`,
  js: { size: 0.8, soft: 1.6, alpha: 0.6, bloom: 1.3, blending: 'additive', trail: 0.86, ignite: 0.9 },
  envelope: { inhale: 0.5, exhale: 2.8, peak: 1.8 },
});

form({
  slug: 'thomas', name: "Thomas's cyclic garden", family: 'attractor', origin: 'sphere',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 2.2\n#define FORM_RELEASE 0.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 q = p * 2.2;
    vec3 d = vec3(sin(q.y) - 0.19 * q.x, sin(q.z) - 0.19 * q.y, sin(q.x) - 0.19 * q.z);
    return d * 0.011;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(dot(sin(p * 2.2), vec3(0.33)) + 0.5, vec3(0.4,0.45,0.35), vec3(0.3,0.3,0.25), vec3(1.0,1.0,1.0), vec3(0.3,0.2,0.1));
  }`,
  js: { size: 0.85, soft: 1.7, alpha: 0.62, bloom: 1.25, blending: 'additive', trail: 0.8, ignite: 0.8 },
  envelope: { inhale: 0.55, exhale: 3.0, peak: 1.7 },
});

form({
  slug: 'aizawa', name: "Aizawa's lantern", family: 'attractor', origin: 'sphere',
  defines: '#define FORM_HOME 0.0\n#define FORM_RELEASE 0.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 q = p * 1.6;
    float a = 0.95, b = 0.7, c = 0.6, dd = 3.5, e = 0.25, f = 0.1;
    vec3 d = vec3(
      (q.z - b) * q.x - dd * q.y,
      dd * q.x + (q.z - b) * q.y,
      c + a * q.z - q.z * q.z * q.z / 3.0 - (q.x * q.x + q.y * q.y) * (1.0 + e * q.z) + f * q.z * q.x * q.x * q.x
    );
    return clamp(d * 0.0045, vec3(-0.05), vec3(0.05));
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(p.z * 0.5 + t * 0.02, vec3(0.68,0.5,0.72), vec3(0.36,0.3,0.4), vec3(1.0,1.0,1.0), vec3(0.6,0.4,0.2));
  }`,
  js: { size: 1.05, soft: 1.6, alpha: 0.74, bloom: 1.55, blending: 'additive', trail: 0.84, ignite: 1.0 },
  envelope: { inhale: 0.5, exhale: 2.8, peak: 1.8 },
});

form({
  slug: 'halvorsen', name: "Halvorsen's braided orbit", family: 'attractor', origin: 'sphere',
  defines: '#define FORM_HOME 0.0\n#define FORM_RELEASE 0.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 q = p * 3.4;
    float a = 1.89;
    vec3 d = vec3(
      -a * q.x - 4.0 * q.y - 4.0 * q.z - q.y * q.y,
      -a * q.y - 4.0 * q.z - 4.0 * q.x - q.z * q.z,
      -a * q.z - 4.0 * q.x - 4.0 * q.y - q.x * q.x
    );
    return clamp(d * 0.0011, vec3(-0.05), vec3(0.05));
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(length(p) * 0.35, vec3(0.35,0.5,0.55), vec3(0.28,0.3,0.32), vec3(1.0,1.0,1.0), vec3(0.5,0.35,0.15));
  }`,
  js: { size: 0.8, soft: 1.6, alpha: 0.6, bloom: 1.35, blending: 'additive', trail: 0.86, ignite: 0.9 },
  envelope: { inhale: 0.5, exhale: 2.8, peak: 1.8 },
});

// ───────────────────────────────────── family: water & air ─────────────────────────────────────
form({
  slug: 'ripples', name: 'rings on still water', family: 'water', origin: 'nebula',
  defines: '#define FORM_HOME 0.014',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = length(p.xy);
    float wave = sin(r * 7.0 - uTime * 2.2) * 0.006 / (0.6 + r);
    return vec3(normalize(p.xy + 0.0001) * wave * 0.35, (wave * 3.0 - p.z) * 0.03);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float wave = sin(length(p.xy) * 7.0 - t * 2.2);
    return mix(vec3(0.15, 0.3, 0.42), vec3(0.6, 0.8, 0.92), 0.5 + 0.5 * wave) * 0.9;
  }`,
  js: { size: 0.85, soft: 1.8, alpha: 0.6, bloom: 1.1, blending: 'additive', trail: 0.4, ignite: 0.5 },
  envelope: { inhale: 0.5, exhale: 2.6, peak: 1.9 },
});

form({
  slug: 'fog', name: 'fog against a window', family: 'water', origin: 'cube',
  defines: '#define FORM_HOME 0.0012\n#define FORM_SIZE 2.4\n#define FORM_SOFT 3.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    return curlNoise(p * 0.28 + vec3(uTime * 0.04, 0.0, 0.0)) * 0.0045;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return vec3(0.55, 0.6, 0.68) * (0.5 + 0.3 * snoise(p * 0.8 + t * 0.05));
  }`,
  js: { size: 2.2, soft: 3.2, alpha: 0.16, bloom: 0.7, blending: 'additive', trail: 0.75, ignite: 0.2 },
  envelope: { inhale: 0.9, exhale: 3.8, peak: 1.3 },
});

form({
  slug: 'whirlpool', name: 'a whirlpool breathing in', family: 'water', origin: 'nebula',
  defines: '#define FORM_HOME 0.0008\n#define FORM_RELEASE 1.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = max(length(p.xy), 0.2);
    vec2 tangent = vec2(-p.y, p.x) / r;
    vec3 v = vec3(tangent * 0.016 / r - normalize(p.xy) * 0.0035 / r, 0.0);
    v.z = (-0.4 / (0.4 + r) - p.z) * 0.02;
    if (r < 0.3) v.xy += normalize(p.xy) * 0.3;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.1, 0.35, 0.4), vec3(0.5, 0.85, 0.85), smoothstep(0.2, 2.2, length(p.xy)));
  }`,
  js: { size: 0.9, soft: 1.7, alpha: 0.62, bloom: 1.2, blending: 'additive', trail: 0.8, ignite: 0.9 },
  envelope: { inhale: 0.6, exhale: 2.4, peak: 2.1 },
});

form({
  slug: 'breath', name: 'breath on cold air', family: 'water', origin: 'cluster',
  defines: '#define FORM_HOME 0.0016\n#define FORM_SIZE 1.7\n#define FORM_SOFT 2.8',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float cycle = sin(uTime * 0.45);
    vec3 v = vec3(0.008 * max(cycle, 0.0), 0.004 * max(cycle, 0.0), 0.0);
    return v + curlNoise(p * 0.9 + uTime * 0.1) * 0.004;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return vec3(0.75, 0.8, 0.88) * (0.35 + 0.3 * max(sin(t * 0.45), 0.0));
  }`,
  js: { size: 1.7, soft: 2.8, alpha: 0.22, bloom: 0.9, blending: 'additive', trail: 0.7, ignite: 0.3 },
  envelope: { inhale: 0.8, exhale: 3.4, peak: 1.5 },
});

form({
  slug: 'standingwaves', name: 'two waves agreeing', family: 'water', origin: 'band',
  defines: '#define FORM_HOME 0.01',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float w = sin(p.x * 3.0 - uTime * 1.6) + sin(p.x * 3.0 + uTime * 1.6);
    return vec3(0.0, (w * 0.5 - p.y + o.y) * 0.03, (sin(p.x * 6.0 + uTime) * 0.2 - p.z) * 0.02);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float node = abs(sin(p.x * 3.0));
    return mix(vec3(0.9, 0.85, 0.6), vec3(0.3, 0.5, 0.7), node);
  }`,
  js: { size: 0.9, soft: 1.8, alpha: 0.6, bloom: 1.1, blending: 'additive', trail: 0.5, ignite: 0.6 },
  envelope: { inhale: 0.5, exhale: 2.5, peak: 1.9 },
});

// ─────────────────────────────────────── family: gravity ───────────────────────────────────────
form({
  slug: 'resonance', name: 'orbits in resonance', family: 'gravity', origin: 'ring',
  defines: '#define FORM_HOME 0.0\n#define FORM_RELEASE 0.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float ring = floor(id * 5.0) + 1.0;
    float targetR = 0.55 + ring * 0.42;
    float r = max(length(p.xy), 0.15);
    vec2 tangent = vec2(-p.y, p.x) / r;
    return vec3(tangent * 0.014 / sqrt(ring) + normalize(p.xy) * (targetR - r) * 0.03, -p.z * 0.02);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(floor(id * 5.0) / 5.0, vec3(0.55,0.45,0.35), vec3(0.3,0.28,0.25), vec3(1.0,1.0,1.0), vec3(0.0,0.2,0.4));
  }`,
  js: { size: 0.85, soft: 1.7, alpha: 0.64, bloom: 1.2, blending: 'additive', trail: 0.7, ignite: 0.7 },
  envelope: { inhale: 0.5, exhale: 2.6, peak: 1.9 },
});

form({
  slug: 'pendulums', name: 'a wave of pendulums', family: 'gravity', origin: 'band',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.1',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float freq = 1.1 + (o.x + 3.0) * 0.12;
    float target = sin(uTime * freq) * 1.15;
    return vec3((o.x - p.x) * 0.05, (target + o.y * 0.3 - p.y) * 0.045, (o.z - p.z) * 0.04);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(p.x * 0.14 + 0.5, vec3(0.5,0.4,0.5), vec3(0.35,0.3,0.3), vec3(1.0,1.0,1.0), vec3(0.0,0.33,0.67));
  }`,
  js: { size: 1.0, soft: 1.9, alpha: 0.66, bloom: 1.2, blending: 'additive', trail: 0.6, ignite: 0.8 },
  envelope: { inhale: 0.45, exhale: 2.4, peak: 1.9 },
});

form({
  slug: 'dipole', name: 'iron filings over two hearts', family: 'gravity', origin: 'cube',
  defines: '#define FORM_HOME 0.0014',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 a = vec3(-1.1, 0.0, 0.0);
    vec3 b = vec3(1.1, 0.0, 0.0);
    vec3 da = p - a; vec3 db = p - b;
    float la = max(dot(da, da), 0.05); float lb = max(dot(db, db), 0.05);
    vec3 fieldv = da / (la * la) - db / (lb * lb);
    return normalize(fieldv + 0.0001) * 0.008;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float pole = smoothstep(2.4, 0.2, min(length(p - vec3(-1.1,0.0,0.0)), length(p - vec3(1.1,0.0,0.0))));
    return mix(vec3(0.35, 0.4, 0.55), vec3(1.0, 0.7, 0.5), pole);
  }`,
  js: { size: 0.8, soft: 1.6, alpha: 0.6, bloom: 1.15, blending: 'additive', trail: 0.5, ignite: 0.6 },
  envelope: { inhale: 0.5, exhale: 2.5, peak: 1.9 },
});

form({
  slug: 'springlattice', name: 'a lattice of springs', family: 'gravity', origin: 'lattice',
  defines: '#define FORM_HOME 0.04\n#define FORM_POINTER 3.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float wave = snoise(vec3(o.xy * 0.8, uTime * 0.35));
    return vec3(0.0, 0.0, (wave * 0.8 - p.z) * 0.06);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.4, 0.55, 0.6), vec3(0.95, 0.8, 0.55), smoothstep(-0.6, 0.8, p.z));
  }`,
  js: { size: 0.85, soft: 1.7, alpha: 0.66, bloom: 1.1, blending: 'additive', trail: 0.3, ignite: 0.7 },
  envelope: { inhale: 0.4, exhale: 2.2, peak: 2.0 },
});

form({
  slug: 'twinvortex', name: 'two vortices courting', family: 'gravity', origin: 'nebula',
  defines: '#define FORM_HOME 0.0012',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 a = vec3(sin(uTime * 0.3) * 1.1, cos(uTime * 0.27) * 0.5, 0.0);
    vec3 b = -a;
    vec2 da = p.xy - a.xy; vec2 db = p.xy - b.xy;
    float la = max(length(da), 0.25); float lb = max(length(db), 0.25);
    vec2 v = vec2(-da.y, da.x) * (0.010 / (la * la)) + vec2(db.y, -db.x) * (0.010 / (lb * lb));
    return vec3(v, (o.z - p.z) * 0.02);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(atan(p.y, p.x) / TAU + t * 0.02, vec3(0.45,0.38,0.55), vec3(0.3,0.28,0.35), vec3(1.0,1.0,1.0), vec3(0.1,0.35,0.6));
  }`,
  js: { size: 0.9, soft: 1.7, alpha: 0.62, bloom: 1.25, blending: 'additive', trail: 0.8, ignite: 0.9 },
  envelope: { inhale: 0.5, exhale: 2.6, peak: 2.0 },
});

// ──────────────────────────────────────── family: light ────────────────────────────────────────
form({
  slug: 'bioluminescence', name: 'a bioluminescent wake', family: 'light', origin: 'nebula',
  defines: '#define FORM_HOME 0.0024\n#define FORM_POINTER 3.6\n#define FORM_SHIMMER 0.5',
  force: `vec3 formForce(vec3 p, vec3 o) {
    return curlNoise(p * 0.6 + uTime * 0.06) * 0.004;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return mix(vec3(0.04, 0.1, 0.16), vec3(0.25, 0.95, 0.85), clamp(glow, 0.04, 1.0));
  }`,
  js: { size: 1.0, soft: 2.0, alpha: 0.6, bloom: 1.6, blending: 'additive', pointerGlow: true, trail: 0.6, ignite: 0.6 },
  envelope: { inhale: 0.5, exhale: 2.8, peak: 2.0 },
});

form({
  slug: 'prism', name: 'light through a prism', family: 'light', origin: 'band',
  defines: '#define FORM_HOME 0.0016\n#define FORM_SPEED 1.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float band = floor(id * 6.0) / 6.0;
    vec3 dir = normalize(vec3(1.0, (band - 0.5) * 1.3, 0.0));
    vec3 v = dir * 0.012;
    if (p.x > 3.4) return (vec3(-3.2, o.y * 0.3, o.z) - p) * 0.4;
    return v + curlNoise(p + band * 10.0) * 0.0012;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(floor(id * 6.0) / 6.0, vec3(0.5,0.5,0.5), vec3(0.5,0.5,0.5), vec3(1.0,1.0,1.0), vec3(0.0,0.33,0.67));
  }`,
  js: { size: 0.85, soft: 1.6, alpha: 0.66, bloom: 1.5, blending: 'additive', trail: 0.75, ignite: 1.0 },
  envelope: { inhale: 0.45, exhale: 2.4, peak: 2.1 },
});

form({
  slug: 'candle', name: 'a candle refusing the wind', family: 'light', origin: 'cluster',
  defines: '#define FORM_HOME 0.006',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float flicker = snoise(vec3(uTime * 1.8, uSeed, 0.0)) * 0.5;
    float coreness = smoothstep(0.9, 0.0, length(p.xz));
    return vec3(flicker * 0.004 * coreness, 0.012 * coreness, 0.0) + curlNoise(p * 1.6 + uTime * 0.4) * 0.0022;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float heat = smoothstep(2.2, -0.6, p.y) * smoothstep(1.2, 0.0, length(p.xz));
    return mix(vec3(0.2, 0.1, 0.12), mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.9, 0.6), heat), clamp(heat * 1.6, 0.0, 1.0));
  }`,
  js: { size: 1.0, soft: 2.0, alpha: 0.66, bloom: 1.5, blending: 'additive', trail: 0.45, ignite: 0.8 },
  envelope: { inhale: 0.55, exhale: 2.8, peak: 1.9 },
});

form({
  slug: 'wisps', name: 'a parade of will-o-wisps', family: 'light', origin: 'sphere',
  defines: '#define FORM_HOME 0.0007\n#define FORM_SPEED 1.15',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float leaderPhase = uTime * 0.35;
    vec3 path = vec3(sin(leaderPhase + id * 0.8) * 2.2, cos(leaderPhase * 1.3 + id * 0.8) * 1.1, sin(leaderPhase * 0.7 + id) * 0.6);
    return (path - p) * 0.012 + curlNoise(p * 1.5 + id * 12.0) * 0.0035;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(id * 0.3 + 0.35, vec3(0.3,0.45,0.35), vec3(0.25,0.3,0.25), vec3(1.0,1.0,1.0), vec3(0.2,0.4,0.25)) * 1.1;
  }`,
  js: { size: 1.1, soft: 2.2, alpha: 0.62, bloom: 1.55, blending: 'additive', trail: 0.72, ignite: 0.8 },
  envelope: { inhale: 0.5, exhale: 2.7, peak: 2.0 },
});

form({
  slug: 'meteors', name: 'a shower of meteors', family: 'light', origin: 'cube',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.6',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float phase = fract(uTime * 0.14 + id);
    float alive = step(phase, 0.42);
    vec3 v = vec3(-0.038, -0.026, 0.0) * alive;
    if (phase > 0.42) return (vec3(1.9 + id * 1.4, 1.6 + fract(id * 7.3) * 1.4, o.z) - p) * 0.5;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float phase = fract(t * 0.14 + id);
    float alive = step(phase, 0.42);
    float tw = 0.18 + 0.12 * sin(t * (2.0 + id * 5.0) + id * 40.0);
    return vec3(1.0, 0.92, 0.78) * mix(tw, 0.75 + 0.5 * id, alive);
  }`,
  js: { size: 0.9, soft: 1.3, alpha: 0.75, bloom: 1.6, blending: 'additive', trail: 0.92, ignite: 1.6 },
  envelope: { inhale: 0.4, exhale: 2.2, peak: 2.3 },
});

import { MORE } from './forms-more.js';
import { WILD } from './forms-wild.js';
import { ARC } from './forms-arc.js';

const ALL = F.concat(MORE, WILD, ARC);

export const FORMS = ALL;
export const FORM_INDEX = new Map(ALL.map((f) => [f.slug, f]));
export const FAMILIES = [...new Set(ALL.map((f) => f.family))];
