// Twenty wilder answers (ADR 0004, amended again). Where forms-more.js added breadth, these add
// instability: shear that curls into billows, fluids that finger through each other, three bodies
// that never resolve, spots that learn to be stripes. Same contract as forms.js.

export const WILD = [];
const form = (def) => { WILD.push(def); return def; };

// ─────────────────────────────────────────── family: flow ──────────────────────────────────────
form({
  slug: 'kelvinhelmholtz', name: 'billows along a shear line', family: 'flow', origin: 'band',
  defines: '#define FORM_HOME 0.0006\n#define FORM_SPEED 1.15',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float shear = tanh(p.y * 2.4);
    float roll = sin(p.x * 1.9 + uTime * 0.55 + uSeed) * exp(-p.y * p.y * 2.2);
    vec3 v = vec3(shear * 0.016, roll * 0.012, 0.0);
    v.y += -p.y * 0.004 * (1.0 - abs(roll));
    v.xy += vec2(-p.y, p.x) * roll * 0.010 * exp(-p.y * p.y * 3.0);
    v += curlNoise(p * 1.1 + vec3(uTime * 0.2, 0.0, uSeed)) * 0.0022;
    if (abs(p.x) > 3.3) v.x = -sign(p.x) * 0.3;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float side = smoothstep(-0.5, 0.5, p.y);
    float roll = abs(sin(p.x * 1.9 + t * 0.55)) * exp(-p.y * p.y * 2.2);
    return mix(vec3(0.16,0.30,0.46), vec3(0.86,0.72,0.44), side) + vec3(0.22,0.18,0.10) * roll;
  }`,
  js: { size: 0.86, soft: 1.9, alpha: 0.64, bloom: 1.2, blending: 'additive', trail: 0.78, ignite: 0.8 },
  envelope: { inhale: 0.46, exhale: 2.7, peak: 2.05 },
});

form({
  slug: 'vortexstreet', name: 'a wake shedding vortices', family: 'flow', origin: 'band',
  defines: '#define FORM_HOME 0.0007\n#define FORM_SPEED 1.3',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 v = vec3(0.015, 0.0, 0.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float lane = mod(fi, 2.0) * 2.0 - 1.0;
      float cx = mod(-2.6 + fi * 1.5 + uTime * 0.5, 6.4) - 3.2;
      vec2 d = p.xy - vec2(cx, lane * 0.45);
      float r2 = dot(d, d) + 0.09;
      v.xy += vec2(-d.y, d.x) * lane * 0.020 / r2;
    }
    v.y += (o.y - p.y) * 0.006;
    if (p.x > 3.3) v.x = -0.34;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float spin = sin(p.y * 4.0 + t * 0.5);
    return cosPal(spin * 0.2 + p.x * 0.06, vec3(0.34,0.42,0.50), vec3(0.26,0.28,0.32), vec3(1.0,1.0,1.0), vec3(0.1,0.3,0.55));
  }`,
  js: { size: 0.8, soft: 1.7, alpha: 0.64, bloom: 1.25, blending: 'additive', trail: 0.86, ignite: 0.85 },
  envelope: { inhale: 0.44, exhale: 2.5, peak: 2.1 },
});

// ────────────────────────────────────────── family: cosmic ─────────────────────────────────────
form({
  slug: 'collision', name: 'two galaxies passing through', family: 'cosmic', origin: 'spiral',
  defines: '#define FORM_HOME 0.0004\n#define FORM_SPEED 1.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float sweep = sin(uTime * 0.16 + uSeed) * 2.1;
    vec3 a = vec3(-sweep, 0.35, 0.0);
    vec3 b = vec3(sweep, -0.35, 0.0);
    vec3 da = a - p, db = b - p;
    float ra = max(length(da), 0.5), rb = max(length(db), 0.5);
    vec3 g = da / ra * (0.030 / (ra * ra)) + db / rb * (0.030 / (rb * rb));
    vec2 spinA = vec2(-da.y, da.x) / ra * (0.020 / ra);
    vec2 spinB = vec2(db.y, -db.x) / rb * (0.020 / rb);
    return g + vec3(spinA + spinB, -p.z * 0.02);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float sweep = sin(t * 0.16) * 2.1;
    float near = smoothstep(2.6, 0.3, min(length(p - vec3(-sweep, 0.35, 0.0)), length(p - vec3(sweep, -0.35, 0.0))));
    return mix(vec3(0.22,0.20,0.38), vec3(1.0,0.86,0.62), near * near);
  }`,
  js: { size: 0.78, soft: 1.6, alpha: 0.66, bloom: 1.5, blending: 'additive', trail: 0.86, ignite: 1.2 },
  envelope: { inhale: 0.42, exhale: 2.9, peak: 2.3 },
});

form({
  slug: 'photonring', name: 'the light that circled once', family: 'cosmic', origin: 'ring',
  defines: '#define FORM_HOME 0.0016\n#define FORM_SPEED 1.1',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float r = length(p.xy) + 0.001;
    float photon = 1.25;
    vec2 radial = p.xy / r;
    vec2 tang = vec2(-radial.y, radial.x);
    float grip = exp(-pow((r - photon) * 2.2, 2.0));
    vec3 v = vec3(tang * (0.012 + grip * 0.05), 0.0);
    v.xy += radial * (photon - r) * (0.004 + grip * 0.05);
    v.xy -= radial * smoothstep(photon, photon * 0.55, r) * 0.03;
    v.z += (o.z * 0.3 - p.z) * 0.02;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float r = length(p.xy);
    float ring = exp(-pow((r - 1.25) * 5.0, 2.0));
    float doppler = 0.5 + 0.5 * sin(atan(p.y, p.x) - t * 0.4);
    return mix(vec3(0.05,0.04,0.10), mix(vec3(1.0,0.62,0.30), vec3(0.72,0.86,1.0), doppler), ring);
  }`,
  js: { size: 0.8, soft: 1.4, alpha: 0.7, bloom: 1.9, blending: 'additive', trail: 0.8, ignite: 1.6 },
  envelope: { inhale: 0.4, exhale: 2.6, peak: 2.4 },
});

// ───────────────────────────────────────── family: organic ─────────────────────────────────────
form({
  slug: 'predator', name: 'a murmuration with something hunting it', family: 'organic', origin: 'cluster',
  defines: '#define FORM_HOME 0.0006\n#define FORM_SPEED 1.5',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 hawk = vec3(sin(uTime * 0.62 + uSeed) * 2.4, cos(uTime * 0.47) * 1.3, sin(uTime * 0.31) * 0.5);
    vec3 away = p - hawk;
    float r = length(away) + 0.001;
    float panic = exp(-r * r * 0.55);
    vec3 flock = vec3(sin(uTime * 0.21) * 1.2, cos(uTime * 0.17) * 0.7, 0.0);
    vec3 v = normalize(flock - p + 0.0001) * 0.005 * (1.0 - panic);
    v += away / r * panic * 0.055;
    v += curlNoise(p * 1.4 + vec3(id * 4.0, uTime * 0.5, 0.0)) * 0.005;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec3 hawk = vec3(sin(t * 0.62) * 2.4, cos(t * 0.47) * 1.3, sin(t * 0.31) * 0.5);
    float panic = exp(-dot(p - hawk, p - hawk) * 0.5);
    return mix(vec3(0.30,0.32,0.40), vec3(1.0,0.72,0.52), panic);
  }`,
  js: { size: 0.74, soft: 1.5, alpha: 0.66, bloom: 1.3, blending: 'additive', trail: 0.82, ignite: 1.0 },
  envelope: { inhale: 0.38, exhale: 2.4, peak: 2.25 },
});

form({
  slug: 'slime', name: 'a slime mould solving a maze', family: 'organic', origin: 'cluster',
  defines: '#define FORM_HOME 0.0016\n#define FORM_SPEED 0.95',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 v = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec3 food = vec3(sin(fi * 2.4 + uSeed) * 2.2, cos(fi * 1.7 + uSeed) * 1.2, 0.0);
      vec3 d = food - p;
      float r = length(d) + 0.2;
      v += d / r * (0.0045 / r);
    }
    float trail = snoise(vec3(p.xy * 2.2, uTime * 0.1 + uSeed));
    v += vec3(cos(trail * TAU), sin(trail * TAU), 0.0) * 0.010;
    v -= p * 0.0018 * smoothstep(2.4, 3.8, length(p));
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float vein = abs(snoise(vec3(p.xy * 2.2, t * 0.1)));
    return mix(vec3(0.44,0.40,0.14), vec3(0.94,0.88,0.52), pow(1.0 - vein, 3.0));
  }`,
  js: { size: 1.05, soft: 1.8, alpha: 0.78, bloom: 1.4, blending: 'additive', trail: 0.84, ignite: 1.0 },
  envelope: { inhale: 0.5, exhale: 2.8, peak: 1.95 },
});

// ──────────────────────────────────────── family: elemental ────────────────────────────────────
form({
  slug: 'rayleightaylor', name: 'heavy water falling through light', family: 'elemental', origin: 'veil',
  defines: '#define FORM_HOME 0.0005\n#define FORM_SPEED 1.05',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float heavy = step(0.0, o.y);
    float finger = sin(p.x * 3.1 + uSeed * 6.0) * cos(p.x * 1.7 - uSeed * 3.0);
    float grow = smoothstep(0.0, 2.5, uTime * 0.3);
    vec3 v = vec3(0.0, mix(0.008, -0.012, heavy) * (0.4 + grow), 0.0);
    v.y += finger * 0.010 * grow * (heavy * 2.0 - 1.0) * -1.0;
    v.x += sin(p.y * 2.6 + finger * 3.0) * 0.004 * grow;
    v += curlNoise(p * 1.5 + vec3(0.0, uTime * 0.15, uSeed)) * 0.0026;
    if (abs(p.y) > 2.1) v.y = -sign(p.y) * 0.02;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float heavy = smoothstep(-0.3, 0.3, p.y);
    return mix(vec3(0.62,0.34,0.20), vec3(0.20,0.34,0.52), heavy);
  }`,
  js: { size: 0.9, soft: 2.0, alpha: 0.62, bloom: 1.15, blending: 'additive', trail: 0.72, ignite: 0.8 },
  envelope: { inhale: 0.5, exhale: 2.9, peak: 2.0 },
});

form({
  slug: 'filaments', name: 'filaments in a plasma', family: 'elemental', origin: 'helix',
  defines: '#define FORM_HOME 0.0018\n#define FORM_SPEED 1.35',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float strand = floor(id * 9.0) / 9.0;
    float phase = strand * TAU + uTime * 0.4;
    vec3 axis = normalize(vec3(cos(phase) * 0.4, 1.0, sin(phase) * 0.4));
    vec3 pinch = cross(axis, p) * 0.016;
    float kink = sin(p.y * 3.4 + phase * 2.0 + uTime * 1.2);
    vec3 v = pinch + vec3(kink * 0.006, 0.0, cos(p.y * 3.4 + phase) * 0.006);
    v -= normalize(vec3(p.x, 0.0, p.z) + 0.0001) * 0.008 * smoothstep(0.4, 1.8, length(p.xz));
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float heat = exp(-length(p.xz) * 0.9);
    float flick = 0.7 + 0.5 * sin(t * 6.0 + id * 30.0);
    return mix(vec3(0.24,0.10,0.42), vec3(0.86,0.92,1.0), heat * flick);
  }`,
  js: { size: 0.72, soft: 1.3, alpha: 0.7, bloom: 1.85, blending: 'additive', trail: 0.86, ignite: 1.6 },
  envelope: { inhale: 0.36, exhale: 2.3, peak: 2.4 },
});

// ──────────────────────────────────────── family: geometric ────────────────────────────────────
form({
  slug: 'turing', name: 'spots learning to be stripes', family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.02\n#define FORM_SPEED 0.9',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float k = mix(2.6, 7.0, 0.5 + 0.5 * sin(uTime * 0.12 + uSeed));
    float a = sin(o.x * k) + sin(o.y * k * 0.92 + 1.7);
    float b = sin(o.x * k * 0.51 + 2.3) * sin(o.y * k * 0.47);
    float field = a + b * 1.3;
    vec2 push = vec2(cos(field * 2.0), sin(field * 2.0)) * 0.22;
    return (vec3(o.xy + push, o.z) - p) * 0.024;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float k = mix(2.6, 7.0, 0.5 + 0.5 * sin(t * 0.12));
    float field = sin(p.x * k) + sin(p.y * k * 0.92 + 1.7);
    return cosPal(field * 0.18 + 0.5, vec3(0.42,0.40,0.36), vec3(0.34,0.30,0.26), vec3(1.0,1.0,1.0), vec3(0.0,0.2,0.45));
  }`,
  js: { size: 0.74, soft: 1.4, alpha: 0.66, bloom: 1.25, blending: 'additive', trail: 0.4, ignite: 0.8 },
  envelope: { inhale: 0.48, exhale: 2.6, peak: 1.95 },
});

form({
  slug: 'hopf', name: 'a Hopf fibration turning', family: 'geometric', origin: 'shell',
  defines: '#define FORM_HOME 0.006\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float fibre = id * TAU;
    mat2 spin = rot(uTime * 0.16);
    vec2 base = spin * vec2(cos(fibre), sin(fibre)) * (0.7 + 0.9 * fract(id * 3.7));
    float lift = sin(fibre * 2.0 + uTime * 0.5) * 0.8;
    vec3 target = vec3(base, lift);
    vec3 v = (target - p) * 0.02;
    v.xy += vec2(-p.y, p.x) * 0.008;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(id + t * 0.03, vec3(0.48,0.42,0.56), vec3(0.34,0.30,0.36), vec3(1.0,1.0,1.0), vec3(0.0,0.28,0.58));
  }`,
  js: { size: 0.76, soft: 1.5, alpha: 0.68, bloom: 1.4, blending: 'additive', trail: 0.68, ignite: 0.95 },
  envelope: { inhale: 0.44, exhale: 2.6, peak: 2.05 },
});

// ───────────────────────────────────────── family: textual ─────────────────────────────────────
form({
  slug: 'erasure', name: 'an erasure poem', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.024\n#define FORM_SPEED 0.9',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float kept = step(0.62, fract(sin(id * 71.3 + uSeed) * 43758.5453));
    float sink = smoothstep(0.0, 1.0, fract(uTime * 0.09 + id * 0.2));
    vec3 gone = o + vec3(0.0, -2.4 * sink, 0.0);
    vec3 target = mix(gone, o, kept);
    return (target - p) * 0.024;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float kept = step(0.62, fract(sin(id * 71.3) * 43758.5453));
    float fade = smoothstep(-2.0, 0.4, p.y);
    return mix(vec3(0.16,0.16,0.18), vec3(0.92,0.90,0.84), mix(fade * 0.4, 1.0, kept));
  }`,
  js: { size: 0.8, soft: 1.5, alpha: 0.64, bloom: 1.1, blending: 'additive', trail: 0.55, ignite: 0.6 },
  envelope: { inhale: 0.5, exhale: 2.7, peak: 1.85 },
});

form({
  slug: 'concordance', name: 'every word at once', family: 'textual', origin: 'glyph',
  defines: '#define FORM_HOME 0.012\n#define FORM_SPEED 1.1',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float ring = floor(id * 5.0);
    float ang = id * TAU * 7.0 + uTime * (0.12 + ring * 0.05);
    float rad = 0.5 + ring * 0.42;
    vec3 target = vec3(cos(ang) * rad * 1.5, sin(ang) * rad, o.z * 0.4);
    float settle = 0.5 + 0.5 * sin(uTime * 0.2 + uSeed);
    return (mix(target, o, settle) - p) * 0.02;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float ring = floor(id * 5.0) / 5.0;
    return cosPal(ring * 0.6 + t * 0.02, vec3(0.44,0.44,0.46), vec3(0.30,0.30,0.34), vec3(1.0,1.0,1.0), vec3(0.1,0.3,0.5));
  }`,
  js: { size: 0.74, soft: 1.5, alpha: 0.64, bloom: 1.2, blending: 'additive', trail: 0.62, ignite: 0.8 },
  envelope: { inhale: 0.46, exhale: 2.5, peak: 2.0 },
});

// ──────────────────────────────────────── family: attractor ────────────────────────────────────
form({
  slug: 'doublependulum', name: 'a double pendulum, twice', family: 'attractor', origin: 'orbit',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.0\n#define FORM_SIZE 0.72',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float t1 = uTime * (0.7 + id * 0.6) + id * TAU;
    float t2 = uTime * (1.1 + id * 0.9) + id * TAU * 2.0;
    vec3 target = vec3(
      sin(t1) * 1.1 + sin(t2) * 0.8,
      -cos(t1) * 1.1 - cos(t2) * 0.8 + 0.6,
      sin(t1 - t2) * 0.3);
    return (target - p) * 0.03;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(id * 2.0 + t * 0.05, vec3(0.46,0.40,0.48), vec3(0.34,0.28,0.32), vec3(1.0,1.0,1.0), vec3(0.0,0.25,0.5));
  }`,
  js: { size: 0.68, soft: 1.3, alpha: 0.68, bloom: 1.4, blending: 'additive', trail: 0.92, ignite: 1.05 },
  envelope: { inhale: 0.4, exhale: 2.6, peak: 2.2 },
});

form({
  slug: 'fourwing', name: 'the four-wing attractor', family: 'attractor', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.0\n#define FORM_SIZE 0.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 q = p * 1.5;
    float a = 0.2, b = 0.01, c = -0.4;
    vec3 dq = vec3(
      a * q.x + q.y * q.z,
      b * q.x + c * q.y - q.x * q.z,
      -q.z - q.x * q.y);
    return dq * 0.012;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    return cosPal(atan(p.y, p.x) / TAU + 0.5, vec3(0.44,0.46,0.40), vec3(0.32,0.30,0.28), vec3(1.0,1.0,1.0), vec3(0.15,0.35,0.6));
  }`,
  js: { size: 0.68, soft: 1.3, alpha: 0.66, bloom: 1.4, blending: 'additive', trail: 0.9, ignite: 1.0 },
  envelope: { inhale: 0.42, exhale: 2.6, peak: 2.15 },
});

// ────────────────────────────────────────── family: water ──────────────────────────────────────
form({
  slug: 'soliton', name: 'two waves passing through each other', family: 'water', origin: 'band',
  defines: '#define FORM_HOME 0.006\n#define FORM_SPEED 1.1',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float c1 = mod(uTime * 0.9 + uSeed, 8.0) - 4.0;
    float c2 = 4.0 - mod(uTime * 0.6 + uSeed * 2.0, 8.0);
    float s1 = 1.0 / cosh((p.x - c1) * 1.6);
    float s2 = 1.0 / cosh((p.x - c2) * 1.2);
    float h = s1 * s1 * 0.9 + s2 * s2 * 0.7;
    vec3 target = vec3(o.x, o.y + h, o.z);
    vec3 v = (target - p) * 0.03;
    v.x += (s1 * s1 - s2 * s2) * 0.006;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float c1 = mod(t * 0.9, 8.0) - 4.0;
    float c2 = 4.0 - mod(t * 0.6, 8.0);
    float h = pow(1.0 / cosh((p.x - c1) * 1.6), 2.0) + pow(1.0 / cosh((p.x - c2) * 1.2), 2.0);
    return mix(vec3(0.14,0.26,0.38), vec3(0.80,0.92,1.0), clamp(h, 0.0, 1.0));
  }`,
  js: { size: 0.8, soft: 1.6, alpha: 0.66, bloom: 1.35, blending: 'additive', trail: 0.7, ignite: 0.9 },
  envelope: { inhale: 0.44, exhale: 2.5, peak: 2.05 },
});

form({
  slug: 'superfluid', name: 'a vortex lattice in a cold fluid', family: 'water', origin: 'lattice',
  defines: '#define FORM_HOME 0.012\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec2 cell = floor(p.xy * 0.9 + 0.5) / 0.9;
    vec2 d = p.xy - cell;
    float r2 = dot(d, d) + 0.02;
    vec3 v = vec3(vec2(-d.y, d.x) * 0.016 / r2, 0.0);
    v.xy -= d * 0.004;
    v.xy += vec2(-p.y, p.x) * 0.002;
    v.z += (o.z * 0.5 - p.z) * 0.02;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec2 cell = floor(p.xy * 0.9 + 0.5) / 0.9;
    float core = smoothstep(0.35, 0.0, length(p.xy - cell));
    return mix(vec3(0.16,0.30,0.46), vec3(0.88,0.96,1.0), core);
  }`,
  js: { size: 0.72, soft: 1.4, alpha: 0.66, bloom: 1.5, blending: 'additive', trail: 0.7, ignite: 1.1 },
  envelope: { inhale: 0.44, exhale: 2.6, peak: 2.1 },
});

// ───────────────────────────────────────── family: gravity ─────────────────────────────────────
form({
  slug: 'threebody', name: 'the three-body problem', family: 'gravity', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.15',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 v = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float ang = uTime * (0.28 + fi * 0.11) + fi * TAU / 3.0 + uSeed;
      vec3 body = vec3(cos(ang) * (1.5 + fi * 0.3), sin(ang) * (0.9 + fi * 0.2), 0.0);
      vec3 d = body - p;
      float r = max(length(d), 0.42);
      v += d / r * (0.020 / (r * r));
    }
    v.xy += vec2(-p.y, p.x) * 0.004;
    v -= p * 0.0022 * smoothstep(2.6, 4.2, length(p));
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float near = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float ang = t * (0.28 + fi * 0.11) + fi * TAU / 3.0;
      near = max(near, smoothstep(1.8, 0.2, length(p - vec3(cos(ang) * (1.5 + fi * 0.3), sin(ang) * (0.9 + fi * 0.2), 0.0))));
    }
    return mix(vec3(0.20,0.22,0.34), vec3(0.98,0.88,0.66), near);
  }`,
  js: { size: 0.74, soft: 1.5, alpha: 0.68, bloom: 1.5, blending: 'additive', trail: 0.9, ignite: 1.15 },
  envelope: { inhale: 0.4, exhale: 2.7, peak: 2.25 },
});

form({
  slug: 'rochelobe', name: 'mass falling between two stars', family: 'gravity', origin: 'orbit',
  defines: '#define FORM_HOME 0.0008\n#define FORM_SPEED 1.2',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float ang = uTime * 0.3 + uSeed;
    vec3 a = vec3(cos(ang) * 1.5, sin(ang) * 0.9, 0.0);
    vec3 b = -a;
    vec3 da = a - p, db = b - p;
    float ra = max(length(da), 0.42), rb = max(length(db), 0.42);
    vec3 v = da / ra * (0.030 / (ra * ra)) + db / rb * (0.014 / (rb * rb));
    vec2 stream = normalize((a - b).xy) * exp(-abs(dot(normalize(p.xy + 0.0001), normalize(a.xy))) * 2.0);
    v.xy += stream * 0.012;
    v.xy += vec2(-p.y, p.x) * 0.006;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float ang = t * 0.3;
    float near = smoothstep(1.6, 0.15, length(p - vec3(cos(ang) * 1.5, sin(ang) * 0.9, 0.0)));
    float far = smoothstep(1.6, 0.15, length(p + vec3(cos(ang) * 1.5, sin(ang) * 0.9, 0.0)));
    return mix(vec3(0.24,0.18,0.30), vec3(1.0,0.80,0.52), near) + vec3(0.20,0.32,0.52) * far;
  }`,
  js: { size: 0.76, soft: 1.5, alpha: 0.68, bloom: 1.55, blending: 'additive', trail: 0.88, ignite: 1.2 },
  envelope: { inhale: 0.42, exhale: 2.7, peak: 2.2 },
});

// ────────────────────────────────────────── family: light ──────────────────────────────────────
form({
  slug: 'lensing', name: 'light bent around what is not there', family: 'light', origin: 'veil',
  defines: '#define FORM_HOME 0.008\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 lens = vec3(sin(uTime * 0.13 + uSeed) * 0.9, cos(uTime * 0.11) * 0.5, 0.0);
    vec2 d = p.xy - lens.xy;
    float r = length(d) + 0.12;
    vec2 bend = normalize(d) * (0.055 / (r * r));
    vec2 tang = vec2(-d.y, d.x) / r * (0.030 / r);
    vec3 v = vec3(bend * -1.0 + tang, 0.0);
    v.xy += (o.xy - p.xy) * 0.012;
    v.z += (o.z - p.z) * 0.02;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec3 lens = vec3(sin(t * 0.13) * 0.9, cos(t * 0.11) * 0.5, 0.0);
    float r = length(p.xy - lens.xy);
    float arc = exp(-pow((r - 0.85) * 3.4, 2.0));
    return mix(vec3(0.10,0.12,0.20), vec3(0.94,0.96,1.0), arc) * (1.0 - smoothstep(0.5, 0.0, r));
  }`,
  js: { size: 0.8, soft: 1.5, alpha: 0.66, bloom: 1.8, blending: 'additive', trail: 0.7, ignite: 1.4 },
  envelope: { inhale: 0.42, exhale: 2.6, peak: 2.2 },
});

form({
  slug: 'interference', name: 'two slits, one photon', family: 'light', origin: 'rain',
  defines: '#define FORM_HOME 0.014\n#define FORM_SPEED 1.05',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec2 s1 = vec2(-2.4, 0.42);
    vec2 s2 = vec2(-2.4, -0.42);
    float phase = length(p.xy - s1) * 5.2 - length(p.xy - s2) * 5.2;
    float band = cos(phase);
    vec3 target = vec3(o.x, o.y + band * 0.34, o.z);
    vec3 v = (target - p) * 0.024;
    v.x += 0.004 * (1.0 + band * 0.4);
    if (p.x > 3.2) v.x = -0.3;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float phase = length(p.xy - vec2(-2.4, 0.42)) * 5.2 - length(p.xy - vec2(-2.4, -0.42)) * 5.2;
    float band = pow(0.5 + 0.5 * cos(phase), 3.0);
    return mix(vec3(0.08,0.10,0.20), vec3(0.86,0.90,1.0), band);
  }`,
  js: { size: 0.72, soft: 1.4, alpha: 0.68, bloom: 1.7, blending: 'additive', trail: 0.6, ignite: 1.3 },
  envelope: { inhale: 0.42, exhale: 2.5, peak: 2.15 },
});
