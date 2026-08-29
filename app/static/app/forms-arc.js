// Twelve answers that change while you watch them (ADR 0004). Every other form holds one idea;
// these are staged on uRelease — the breath that is loud when the words are let go and decays as
// the field settles — so the form arrives as one thing and resolves into another.
// r = 1 at the moment of release, falling to 0. Same contract as forms.js.

export const ARC = [];
const form = (def) => { ARC.push(def); return def; };

form({
  slug: 'unfolding', name: 'something folded opening out', family: 'geometric', origin: 'cube',
  defines: '#define FORM_HOME 0.004\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    vec3 crumpled = normalize(o + 0.0001) * (0.5 + 0.35 * sin(idOf(o) * 40.0));
    vec3 flat_ = vec3(o.xy * 1.25, sin(o.x * 2.0 + o.y * 1.4) * 0.16);
    vec3 target = mix(flat_, crumpled, r);
    return (target - p) * (0.02 + r * 0.03);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float open = smoothstep(0.5, 0.05, abs(p.z));
    return cosPal(open * 0.5 + id * 0.1, vec3(0.44,0.44,0.50), vec3(0.32,0.30,0.34), vec3(1.0,1.0,1.0), vec3(0.1,0.28,0.5));
  }`,
  js: { size: 0.78, soft: 1.5, alpha: 0.66, bloom: 1.3, blending: 'additive', trail: 0.5, ignite: 0.9 },
  envelope: { inhale: 0.44, exhale: 2.8, peak: 2.1 },
});

form({
  slug: 'hatching', name: 'a shell giving way', family: 'organic', origin: 'sphere',
  defines: '#define FORM_HOME 0.003\n#define FORM_SPEED 1.15',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    float id = idOf(o);
    float crack = step(0.5, fract(sin(id * 53.7 + uSeed) * 43758.5453));
    vec3 shell = normalize(o + 0.0001) * 1.45;
    vec3 out_ = normalize(o + 0.0001) * (2.4 + id * 0.8);
    vec3 spiral = vec3(cos(id * TAU + uTime * 0.6), sin(id * TAU + uTime * 0.6), 0.0) * (0.5 + id * 0.7);
    vec3 target = mix(mix(shell, spiral, crack), out_, r * crack);
    return (target - p) * 0.022;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float crack = step(0.5, fract(sin(id * 53.7) * 43758.5453));
    return mix(vec3(0.52,0.48,0.42), vec3(0.94,0.72,0.46), crack * smoothstep(1.2, 2.4, length(p)));
  }`,
  js: { size: 0.84, soft: 1.6, alpha: 0.64, bloom: 1.3, blending: 'additive', trail: 0.7, ignite: 1.0 },
  envelope: { inhale: 0.4, exhale: 2.7, peak: 2.2 },
});

form({
  slug: 'condensation', name: 'vapour learning to be rain', family: 'elemental', origin: 'nebula',
  defines: '#define FORM_HOME 0.0008\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    vec3 drift = curlNoise(p * 0.6 + vec3(0.0, 0.0, uTime * 0.1)) * 0.012;
    vec2 bead = floor(p.xy * 1.4 + 0.5) / 1.4;
    vec3 fall = vec3((bead - p.xy) * 0.05, 0.0) + vec3(0.0, -0.016, 0.0);
    vec3 v = mix(fall, drift, r);
    if (p.y < -2.0) v.y = 0.03;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec2 bead = floor(p.xy * 1.4 + 0.5) / 1.4;
    float tight = smoothstep(0.3, 0.0, length(p.xy - bead));
    return mix(vec3(0.28,0.32,0.38), vec3(0.74,0.86,0.98), tight);
  }`,
  js: { size: 0.86, soft: 1.9, alpha: 0.6, bloom: 1.2, blending: 'additive', trail: 0.7, ignite: 0.7 },
  envelope: { inhale: 0.5, exhale: 3.0, peak: 1.95 },
});

form({
  slug: 'ignition', name: 'one spark taking the whole field', family: 'light', origin: 'cluster',
  defines: '#define FORM_HOME 0.0016\n#define FORM_SPEED 1.25',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    float front = (1.0 - r) * 4.2;
    float lit = smoothstep(front + 0.3, front - 0.3, length(o));
    vec3 v = curlNoise(p * 0.9 + vec3(uTime * 0.3, 0.0, uSeed)) * (0.003 + lit * 0.012);
    v += normalize(p + 0.0001) * lit * 0.006;
    v -= p * 0.002 * smoothstep(2.4, 3.6, length(p));
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float lit = smoothstep(3.2, 0.4, length(p));
    return mix(vec3(0.14,0.08,0.16), vec3(1.0,0.76,0.40), lit) + vec3(0.24,0.10,0.0) * pow(lit, 5.0);
  }`,
  js: { size: 0.82, soft: 1.5, alpha: 0.68, bloom: 1.75, blending: 'additive', trail: 0.8, ignite: 1.6 },
  envelope: { inhale: 0.36, exhale: 2.5, peak: 2.35 },
});

form({
  slug: 'settling', name: 'a surface coming back to still', family: 'water', origin: 'band',
  defines: '#define FORM_HOME 0.008\n#define FORM_SPEED 1.1',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    float wave = sin(length(p.xy) * 4.0 - uTime * 3.0) * r;
    vec3 target = vec3(o.x, o.y + wave * 0.6, o.z);
    vec3 v = (target - p) * (0.02 + (1.0 - r) * 0.03);
    v.xy += normalize(p.xy + 0.0001) * r * 0.01;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float ripple = 0.5 + 0.5 * sin(length(p.xy) * 4.0 - t * 3.0);
    return mix(vec3(0.16,0.26,0.34), vec3(0.70,0.86,0.94), ripple * 0.6 + 0.2);
  }`,
  js: { size: 0.82, soft: 1.7, alpha: 0.62, bloom: 1.25, blending: 'additive', trail: 0.72, ignite: 0.8 },
  envelope: { inhale: 0.42, exhale: 2.8, peak: 2.1 },
});

form({
  slug: 'migration', name: 'scattered birds finding one direction', family: 'organic', origin: 'cluster',
  defines: '#define FORM_HOME 0.0006\n#define FORM_SPEED 1.4',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    float id = idOf(o);
    vec3 scatter = curlNoise(p * 1.5 + vec3(id * 8.0, uTime * 0.6, 0.0)) * 0.014;
    vec3 lane = vec3(0.014, sin(p.x * 0.9 + id * 0.6) * 0.004 + (o.y * 0.4 - p.y) * 0.01, 0.0);
    vec3 v = mix(lane, scatter, r);
    if (p.x > 3.3) v.x = -0.34;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(p.x * 0.1 + id * 0.2, vec3(0.38,0.40,0.44), vec3(0.26,0.28,0.30), vec3(1.0,1.0,1.0), vec3(0.1,0.3,0.55));
  }`,
  js: { size: 0.74, soft: 1.5, alpha: 0.64, bloom: 1.2, blending: 'additive', trail: 0.84, ignite: 0.9 },
  envelope: { inhale: 0.4, exhale: 2.6, peak: 2.15 },
});

form({
  slug: 'collapse', name: 'everything falling back into a disk', family: 'gravity', origin: 'sphere',
  defines: '#define FORM_HOME 0.0006\n#define FORM_SPEED 1.15',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    float rad = max(length(p.xy), 0.2);
    vec2 tang = vec2(-p.y, p.x) / rad;
    vec3 v = vec3(tang * 0.016 / sqrt(rad), 0.0);
    v.xy -= normalize(p.xy + 0.0001) * (1.0 - r) * 0.006;
    v.z += -p.z * (0.006 + (1.0 - r) * 0.05);
    v += normalize(p + 0.0001) * r * 0.012;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float flat_ = smoothstep(0.9, 0.05, abs(p.z));
    return mix(vec3(0.22,0.22,0.36), vec3(0.94,0.82,0.60), flat_);
  }`,
  js: { size: 0.78, soft: 1.6, alpha: 0.66, bloom: 1.45, blending: 'additive', trail: 0.84, ignite: 1.1 },
  envelope: { inhale: 0.4, exhale: 2.9, peak: 2.25 },
});

form({
  slug: 'annealing', name: 'chaos cooling into order', family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.006\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    vec3 heat = curlNoise(p * 1.7 + vec3(uTime * 0.7, uSeed, 0.0)) * 0.02 * r;
    vec3 lock = (o - p) * (0.006 + (1.0 - r) * 0.04);
    return heat + lock;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec2 cell = fract(p.xy * 1.2);
    float edge = min(min(cell.x, 1.0 - cell.x), min(cell.y, 1.0 - cell.y));
    return mix(vec3(0.60,0.34,0.24), vec3(0.62,0.72,0.86), smoothstep(0.05, 0.4, edge));
  }`,
  js: { size: 0.74, soft: 1.4, alpha: 0.66, bloom: 1.3, blending: 'additive', trail: 0.6, ignite: 1.0 },
  envelope: { inhale: 0.42, exhale: 2.9, peak: 2.1 },
});

form({
  slug: 'spillover', name: 'a basin filling until it doesn\'t hold', family: 'water', origin: 'nebula',
  defines: '#define FORM_HOME 0.0012\n#define FORM_SPEED 1.05',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    float level = -1.4 + (1.0 - r) * 2.2;
    float held = step(p.y, level);
    vec3 v = vec3(0.0, held * -0.004 + (1.0 - held) * 0.008, 0.0);
    v.xy += vec2(-p.y, p.x) * held * 0.004;
    v.x += (1.0 - held) * sign(p.x + 0.0001) * 0.012;
    v += curlNoise(p * 0.9 + vec3(uTime * 0.12, 0.0, uSeed)) * 0.0028;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float deep = smoothstep(0.6, -1.4, p.y);
    return mix(vec3(0.66,0.72,0.78), vec3(0.10,0.26,0.40), deep);
  }`,
  js: { size: 0.84, soft: 1.8, alpha: 0.62, bloom: 1.2, blending: 'additive', trail: 0.74, ignite: 0.8 },
  envelope: { inhale: 0.48, exhale: 2.9, peak: 2.0 },
});

form({
  slug: 'resurrection', name: 'embers deciding to burn again', family: 'cosmic', origin: 'cluster',
  defines: '#define FORM_HOME 0.0008\n#define FORM_SPEED 1.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    float revive = smoothstep(0.55, 0.15, r);
    vec3 out_ = normalize(p + 0.0001);
    vec3 v = out_ * (r * 0.02 + revive * 0.028);
    v -= out_ * (1.0 - r) * (1.0 - revive) * 0.004;
    v += out_ * (1.6 - length(p)) * 0.006;
    v += curlNoise(p * 0.8 + vec3(0.0, uTime * 0.2, uSeed)) * 0.004;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float heat = 1.0 / (0.5 + length(p) * 0.42);
    return mix(vec3(0.24,0.06,0.10), vec3(1.0,0.68,0.34), clamp(heat, 0.0, 1.0));
  }`,
  js: { size: 1.15, soft: 1.7, alpha: 0.8, bloom: 1.8, blending: 'additive', trail: 0.82, ignite: 1.6 },
  envelope: { inhale: 0.38, exhale: 3.0, peak: 2.4 },
});

form({
  slug: 'unravelling', name: 'a sentence coming apart into thread', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.014\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    float id = idOf(o);
    float pull = (1.0 - r);
    vec3 thread = vec3(-3.0 + id * 6.0, sin(id * TAU * 3.0 + uTime * 0.5) * 0.3, 0.0);
    vec3 target = mix(o, thread, pull * pull);
    return (target - p) * 0.02;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float strung = smoothstep(0.8, 0.05, abs(p.y));
    return mix(vec3(0.70,0.68,0.64), vec3(0.34,0.40,0.52), strung);
  }`,
  js: { size: 0.76, soft: 1.5, alpha: 0.64, bloom: 1.15, blending: 'additive', trail: 0.8, ignite: 0.7 },
  envelope: { inhale: 0.46, exhale: 3.0, peak: 1.95 },
});

form({
  slug: 'verdict', name: 'a wandering that suddenly decides', family: 'attractor', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.1\n#define FORM_SIZE 0.72',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = clamp(uRelease, 0.0, 1.0);
    vec3 q = p * 1.5;
    vec3 chaos = vec3(
      10.0 * (q.y - q.x),
      q.x * (28.0 - q.z) - q.y,
      q.x * q.y - 2.66 * q.z) * 0.0009;
    float rad = max(length(p.xy), 0.3);
    vec3 orbit = vec3(vec2(-p.y, p.x) / rad * 0.016, -p.z * 0.03);
    orbit.xy += normalize(p.xy + 0.0001) * (1.35 - rad) * 0.02;
    return mix(orbit, chaos, smoothstep(0.1, 0.7, r));
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float settled = smoothstep(2.2, 1.0, length(p.xy));
    return mix(vec3(0.40,0.34,0.46), vec3(0.92,0.88,0.72), settled);
  }`,
  js: { size: 0.7, soft: 1.4, alpha: 0.68, bloom: 1.4, blending: 'additive', trail: 0.9, ignite: 1.1 },
  envelope: { inhale: 0.4, exhale: 2.8, peak: 2.25 },
});
