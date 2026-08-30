// Sixteen more (ADR 0004). The previous batches chased motion — flow, instability, staging. These
// are chosen for the picture they make: a shape you could describe to someone who never saw it.
// Same contract as forms.js.

export const VISTA = [];
const form = (def) => { VISTA.push(def); return def; };

form({
  slug: 'stainedglass', name: 'a window in a dark church', family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.03\n#define FORM_SPEED 0.85',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec2 cell = floor(o.xy * 1.15);
    vec2 centre = (cell + 0.5) / 1.15;
    vec2 toEdge = o.xy - centre;
    vec3 target = vec3(centre + toEdge * 0.86, o.z * 0.4);
    vec3 v = (target - p) * 0.028;
    v.xy += vec2(sin(uTime * 0.3 + cell.x), cos(uTime * 0.26 + cell.y)) * 0.0012;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec2 cell = floor(p.xy * 1.15);
    float k = fract(sin(dot(cell, vec2(41.3, 289.1))) * 43758.5453);
    vec3 pane = cosPal(k, vec3(0.42,0.36,0.44), vec3(0.44,0.34,0.40), vec3(1.0,1.0,1.0), vec3(0.0,0.28,0.62));
    float lead = smoothstep(0.42, 0.48, max(abs(fract(p.x * 1.15) - 0.5), abs(fract(p.y * 1.15) - 0.5)));
    return mix(pane * 1.25, vec3(0.03,0.03,0.05), lead);
  }`,
  js: { size: 0.8, soft: 1.3, alpha: 0.72, bloom: 1.45, blending: 'additive', trail: 0.35, ignite: 0.9 },
  envelope: { inhale: 0.5, exhale: 2.7, peak: 2.0 },
});

form({
  slug: 'ferrofluid', name: 'iron standing up in spikes', family: 'elemental', origin: 'sphere',
  defines: '#define FORM_HOME 0.004\n#define FORM_SPEED 1.0',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 dir = normalize(o + 0.0001);
    float lat = atan(dir.y, length(dir.xz));
    float lon = atan(dir.z, dir.x);
    float spike = pow(max(0.0, sin(lat * 5.0) * sin(lon * 6.0 + uTime * 0.2)), 6.0);
    vec3 target = dir * (1.1 + spike * 1.5);
    return (target - p) * 0.03;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float r = length(p);
    float tip = smoothstep(1.2, 2.4, r);
    return mix(vec3(0.10,0.11,0.16), vec3(0.72,0.76,0.88), tip * tip);
  }`,
  js: { size: 0.76, soft: 1.4, alpha: 0.7, bloom: 1.3, blending: 'additive', trail: 0.5, ignite: 0.9 },
  envelope: { inhale: 0.44, exhale: 2.5, peak: 2.05 },
});

form({
  slug: 'automaton', name: 'a rule deciding what lives', family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.05\n#define FORM_SPEED 0.8',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float gen = floor(uTime * 0.6);
    vec2 cell = floor(o.xy * 1.6);
    float alive = step(0.52, fract(sin(dot(cell, vec2(12.99, 78.23)) + gen * 7.7) * 43758.5453));
    vec3 target = vec3(o.xy, o.z + (1.0 - alive) * 1.4);
    return (target - p) * 0.05;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float sunk = smoothstep(0.2, 1.2, p.z);
    return mix(vec3(0.80,0.86,0.94), vec3(0.10,0.12,0.20), sunk);
  }`,
  js: { size: 0.72, soft: 1.2, alpha: 0.72, bloom: 1.2, blending: 'additive', trail: 0.28, ignite: 0.8 },
  envelope: { inhale: 0.4, exhale: 2.3, peak: 2.0 },
});

form({
  slug: 'cymatics', name: 'sand finding the silent places', family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.012\n#define FORM_SPEED 0.9',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float m = 3.0 + floor(mod(uTime * 0.1, 4.0));
    float n = 2.0 + floor(mod(uTime * 0.07, 5.0));
    float a = cos(m * p.x) * cos(n * p.y) - cos(n * p.x) * cos(m * p.y);
    vec2 g = vec2(
      -m * sin(m * p.x) * cos(n * p.y) + n * sin(n * p.x) * cos(m * p.y),
      -n * cos(m * p.x) * sin(n * p.y) + m * cos(n * p.x) * sin(m * p.y));
    return vec3(-g * a * 0.02, (o.z * 0.2 - p.z) * 0.03);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float m = 3.0 + floor(mod(t * 0.1, 4.0));
    float n = 2.0 + floor(mod(t * 0.07, 5.0));
    float a = abs(cos(m * p.x) * cos(n * p.y) - cos(n * p.x) * cos(m * p.y));
    return mix(vec3(0.92,0.88,0.76), vec3(0.24,0.22,0.20), smoothstep(0.0, 0.5, a));
  }`,
  js: { size: 0.7, soft: 1.3, alpha: 0.7, bloom: 1.15, blending: 'additive', trail: 0.34, ignite: 0.7 },
  envelope: { inhale: 0.46, exhale: 2.6, peak: 1.95 },
});

form({
  slug: 'inkwater', name: 'ink dropped into still water', family: 'water', origin: 'cluster',
  defines: '#define FORM_HOME 0.0004\n#define FORM_SPEED 0.9',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 plume = curlNoise(p * 0.7 + vec3(0.0, -uTime * 0.16, uSeed)) * 0.013;
    vec3 v = plume + vec3(0.0, -0.004, 0.0);
    float ring = 0.5 + 0.5 * sin(id * TAU * 4.0);
    v.xz += normalize(p.xz + 0.0001) * ring * 0.005;
    v -= p * 0.0014 * smoothstep(2.2, 3.6, length(p));
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float thin = smoothstep(0.4, 2.6, length(p));
    return mix(vec3(0.04,0.05,0.10), vec3(0.46,0.52,0.66), thin);
  }`,
  js: { size: 1.15, soft: 2.4, alpha: 0.52, bloom: 0.95, blending: 'additive', trail: 0.82, ignite: 0.45 },
  envelope: { inhale: 0.56, exhale: 3.1, peak: 1.8 },
});

form({
  slug: 'web', name: 'a web with the dew still on it', family: 'organic', origin: 'spiral',
  defines: '#define FORM_HOME 0.04\n#define FORM_SPEED 0.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float spokes = 12.0;
    float a = atan(o.y, o.x);
    float snapped = floor(a / TAU * spokes + 0.5) / spokes * TAU;
    float r = length(o.xy);
    float ring = floor(r * 2.2 + 0.5) / 2.2;
    vec2 onWeb = vec2(cos(snapped), sin(snapped)) * mix(r, ring, 0.55);
    vec3 target = vec3(onWeb, o.z * 0.2);
    vec3 v = (target - p) * 0.03;
    v.xy += vec2(-p.y, p.x) * sin(uTime * 0.5) * 0.0016;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float bead = pow(0.5 + 0.5 * sin(id * 90.0), 8.0);
    return mix(vec3(0.26,0.30,0.38), vec3(0.94,0.97,1.0), bead);
  }`,
  js: { size: 0.7, soft: 1.2, alpha: 0.68, bloom: 1.6, blending: 'additive', trail: 0.3, ignite: 1.2 },
  envelope: { inhale: 0.5, exhale: 2.7, peak: 2.0 },
});

form({
  slug: 'fireworks', name: 'something celebrated far away', family: 'light', origin: 'cluster',
  defines: '#define FORM_HOME 0.0\n#define FORM_SPEED 1.4',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float shell = floor(id * 5.0);
    float phase = fract(uTime * 0.16 + shell * 0.23);
    vec3 seat = vec3(sin(shell * 2.7) * 2.1, cos(shell * 1.9) * 1.1, 0.0);
    if (phase < 0.12) return (seat - p) * 0.6;
    vec3 out_ = normalize(vec3(sin(id * 300.0), cos(id * 211.0), sin(id * 97.0)));
    float burst = smoothstep(0.12, 0.3, phase) * (1.0 - smoothstep(0.3, 1.0, phase));
    return out_ * burst * 0.06 + vec3(0.0, -0.004 * smoothstep(0.3, 0.9, phase), 0.0);
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float shell = floor(id * 5.0);
    float phase = fract(t * 0.16 + shell * 0.23);
    float fade = 1.0 - smoothstep(0.3, 0.95, phase);
    return cosPal(shell * 0.2, vec3(0.6,0.5,0.5), vec3(0.5,0.45,0.4), vec3(1.0,1.0,1.0), vec3(0.0,0.33,0.67)) * fade;
  }`,
  js: { size: 0.78, soft: 1.3, alpha: 0.72, bloom: 1.85, blending: 'additive', trail: 0.9, ignite: 1.6 },
  envelope: { inhale: 0.36, exhale: 2.4, peak: 2.4 },
});

form({
  slug: 'circuit', name: 'a city seen from very high up', family: 'geometric', origin: 'lattice',
  defines: '#define FORM_HOME 0.035\n#define FORM_SPEED 0.9',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float lane = floor(id * 14.0) / 14.0;
    vec2 target = o.xy;
    if (fract(id * 3.7) < 0.5) target.y = floor(o.y * 2.2 + 0.5) / 2.2;
    else target.x = floor(o.x * 2.2 + 0.5) / 2.2;
    vec3 v = (vec3(target, o.z * 0.3) - p) * 0.03;
    float pulse = fract(uTime * 0.3 + lane);
    v.xy += normalize(target - o.xy + 0.0001) * exp(-pow((pulse - 0.5) * 6.0, 2.0)) * 0.004;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float lane = floor(id * 14.0) / 14.0;
    float pulse = exp(-pow((fract(t * 0.3 + lane) - 0.5) * 5.0, 2.0));
    return mix(vec3(0.16,0.24,0.26), vec3(0.86,0.94,0.72), pulse);
  }`,
  js: { size: 0.66, soft: 1.2, alpha: 0.7, bloom: 1.5, blending: 'additive', trail: 0.55, ignite: 1.1 },
  envelope: { inhale: 0.44, exhale: 2.5, peak: 2.05 },
});

form({
  slug: 'plumage', name: 'a wing opening once', family: 'organic', origin: 'veil',
  defines: '#define FORM_HOME 0.02\n#define FORM_SPEED 0.85',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float barb = floor(id * 40.0) / 40.0;
    float along = fract(id * 40.0);
    float open = 0.5 + 0.5 * sin(uTime * 0.3 + uSeed);
    float sweep = (barb - 0.5) * 2.6;
    vec2 spine = vec2(sweep, sin(sweep * 0.8) * 0.4);
    vec2 out_ = vec2(-sin(sweep * 0.8), 1.0) * (along - 0.5) * (0.5 + open * 1.1);
    vec3 target = vec3(spine + out_, o.z * 0.3);
    return (target - p) * 0.026;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float along = fract(id * 40.0);
    return cosPal(along * 0.5 + 0.1, vec3(0.34,0.40,0.44), vec3(0.30,0.32,0.34), vec3(1.0,1.0,1.0), vec3(0.1,0.35,0.6));
  }`,
  js: { size: 0.72, soft: 1.5, alpha: 0.66, bloom: 1.3, blending: 'additive', trail: 0.5, ignite: 0.85 },
  envelope: { inhale: 0.48, exhale: 2.7, peak: 2.0 },
});

form({
  slug: 'pillars', name: 'pillars where stars are made', family: 'cosmic', origin: 'veil',
  defines: '#define FORM_HOME 0.0016\n#define FORM_SPEED 0.75',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float column = abs(snoise(vec3(o.x * 0.8, uSeed, 0.0)));
    float shielded = smoothstep(0.25, 0.7, column);
    vec3 wind = vec3(0.0, -0.010, 0.0) * (1.0 - shielded);
    vec3 v = wind + curlNoise(p * 0.6 + vec3(0.0, uTime * 0.07, uSeed)) * 0.0032;
    v.y += shielded * 0.002;
    v.x += (o.x - p.x) * 0.008 * shielded;
    if (p.y < -2.2) v.y = 0.02;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float h = smoothstep(-2.0, 1.6, p.y);
    return mix(vec3(0.38,0.20,0.14), vec3(0.52,0.44,0.72), h) + vec3(0.16,0.10,0.0) * (1.0 - h);
  }`,
  js: { size: 1.05, soft: 2.2, alpha: 0.6, bloom: 1.3, blending: 'additive', trail: 0.6, ignite: 0.8 },
  envelope: { inhale: 0.55, exhale: 3.0, peak: 1.95 },
});

form({
  slug: 'crepuscular', name: 'light coming through in bars', family: 'light', origin: 'veil',
  defines: '#define FORM_HOME 0.01\n#define FORM_SPEED 0.9',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec3 sun = vec3(sin(uTime * 0.08 + uSeed) * 1.6, 2.6, 0.0);
    vec3 ray = normalize(p - sun);
    float slot = 0.5 + 0.5 * sin(atan(p.x - sun.x, p.y - sun.y) * 9.0);
    vec3 v = ray * (0.004 + slot * 0.010);
    v += (o - p) * 0.014;
    if (length(p) > 3.4) v = (o - p) * 0.06;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec3 sun = vec3(sin(t * 0.08) * 1.6, 2.6, 0.0);
    float slot = pow(0.5 + 0.5 * sin(atan(p.x - sun.x, p.y - sun.y) * 9.0), 3.0);
    float near = smoothstep(4.2, 0.6, length(p - sun));
    return mix(vec3(0.14,0.15,0.22), vec3(1.0,0.94,0.78), 0.25 + slot * near * 0.9);
  }`,
  js: { size: 1.25, soft: 2.1, alpha: 0.8, bloom: 1.9, blending: 'additive', trail: 0.66, ignite: 1.4 },
  envelope: { inhale: 0.46, exhale: 2.7, peak: 2.15 },
});

form({
  slug: 'whalefall', name: 'something enormous going down', family: 'water', origin: 'cluster',
  defines: '#define FORM_HOME 0.0018\n#define FORM_SPEED 0.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 body = vec3(o.x * 1.5, o.y * 0.5 + sin(uTime * 0.1) * 0.2, o.z * 0.6);
    vec3 v = (body - p) * 0.014;
    v.y -= 0.004;
    v += curlNoise(p * 0.5 + vec3(0.0, uTime * 0.05, uSeed)) * 0.0022;
    if (p.y < -2.4) v.y = 0.012;
    float drift = step(0.86, fract(id * 17.3));
    v.y += drift * 0.006;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float depth = smoothstep(1.0, -2.2, p.y);
    float mote = step(0.86, fract(id * 17.3));
    return mix(mix(vec3(0.24,0.30,0.36), vec3(0.04,0.06,0.12), depth), vec3(0.90,0.94,1.0), mote * 0.6);
  }`,
  js: { size: 0.88, soft: 1.9, alpha: 0.58, bloom: 1.1, blending: 'additive', trail: 0.72, ignite: 0.6 },
  envelope: { inhale: 0.58, exhale: 3.2, peak: 1.75 },
});

form({
  slug: 'murmurwall', name: 'a shape that turns all at once', family: 'flow', origin: 'band',
  defines: '#define FORM_HOME 0.0007\n#define FORM_SPEED 1.4',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float turn = floor(uTime * 0.25);
    float dir = fract(sin(turn * 41.3 + uSeed) * 43758.5453) * TAU;
    vec2 heading = vec2(cos(dir), sin(dir));
    float ease = smoothstep(0.0, 0.45, fract(uTime * 0.25));
    vec3 v = vec3(heading * 0.014 * ease, 0.0);
    v += curlNoise(p * 1.1 + vec3(uTime * 0.3, 0.0, uSeed)) * 0.0038;
    v -= p * 0.0026 * smoothstep(2.2, 3.6, length(p));
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float dens = smoothstep(2.6, 0.4, length(p));
    return mix(vec3(0.22,0.24,0.30), vec3(0.76,0.78,0.86), dens);
  }`,
  js: { size: 0.7, soft: 1.5, alpha: 0.64, bloom: 1.15, blending: 'additive', trail: 0.86, ignite: 0.8 },
  envelope: { inhale: 0.38, exhale: 2.4, peak: 2.2 },
});

form({
  slug: 'saltflat', name: 'a plain that cracked as it dried', family: 'elemental', origin: 'lattice',
  defines: '#define FORM_HOME 0.03\n#define FORM_SPEED 0.7',
  force: `vec3 formForce(vec3 p, vec3 o) {
    vec2 seedc = floor(o.xy * 1.05) + 0.5;
    vec2 jitter = vec2(fract(sin(dot(seedc, vec2(3.1, 7.7))) * 4375.5), fract(sin(dot(seedc, vec2(9.2, 2.3))) * 8731.1)) - 0.5;
    vec2 centre = (seedc + jitter * 0.7) / 1.05;
    vec2 toward = centre - o.xy;
    float dry = smoothstep(0.0, 3.0, uTime * 0.25);
    vec3 target = vec3(o.xy + toward * 0.34 * dry, o.z * 0.2);
    return (target - p) * 0.024;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    vec2 seedc = floor(p.xy * 1.05) + 0.5;
    float k = fract(sin(dot(seedc, vec2(5.3, 11.1))) * 4375.5);
    return mix(vec3(0.62,0.60,0.54), vec3(0.86,0.84,0.78), k) * 0.8;
  }`,
  js: { size: 0.74, soft: 1.4, alpha: 0.64, bloom: 1.0, blending: 'additive', trail: 0.3, ignite: 0.6 },
  envelope: { inhale: 0.5, exhale: 2.8, peak: 1.85 },
});

form({
  slug: 'shoal', name: 'a shoal turning through a shaft of light', family: 'water', origin: 'cluster',
  defines: '#define FORM_HOME 0.0009\n#define FORM_SPEED 1.3',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    vec3 lead = vec3(sin(uTime * 0.33 + uSeed) * 1.9, cos(uTime * 0.24) * 0.9, sin(uTime * 0.19) * 0.5);
    vec3 v = normalize(lead - p + 0.0001) * 0.008;
    v += curlNoise(p * 1.7 + vec3(id * 3.0, uTime * 0.45, 0.0)) * 0.005;
    float beam = exp(-p.x * p.x * 0.5);
    v.y += beam * 0.003;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float beam = exp(-p.x * p.x * 0.45);
    float flash = pow(0.5 + 0.5 * sin(id * 120.0 + t * 2.0), 4.0);
    return mix(vec3(0.12,0.22,0.30), vec3(0.90,0.96,1.0), beam * (0.3 + flash));
  }`,
  js: { size: 0.68, soft: 1.4, alpha: 0.68, bloom: 1.55, blending: 'additive', trail: 0.8, ignite: 1.2 },
  envelope: { inhale: 0.4, exhale: 2.5, peak: 2.15 },
});

form({
  slug: 'contrail', name: 'lines drawn by something already gone', family: 'flow', origin: 'rain',
  defines: '#define FORM_HOME 0.0012\n#define FORM_SPEED 1.15',
  force: `vec3 formForce(vec3 p, vec3 o) {
    float id = idOf(o);
    float lane = floor(id * 6.0);
    float tilt = (fract(sin(lane * 21.7 + uSeed) * 4375.5) - 0.5) * 0.7;
    vec2 heading = normalize(vec2(1.0, tilt));
    float seat = (lane / 6.0 - 0.5) * 3.2;
    vec3 v = vec3(heading * 0.02, 0.0);
    v.y += (seat - p.y) * 0.02;
    v += curlNoise(p * 0.8 + vec3(uTime * 0.1, 0.0, lane)) * 0.0022;
    if (p.x > 3.4) v.x = -0.4;
    return v;
  }`,
  color: `vec3 formColor(vec3 p, float t, float id, float glow) {
    float age = smoothstep(-3.0, 3.0, p.x);
    return mix(vec3(0.88,0.90,0.96), vec3(0.20,0.24,0.34), age);
  }`,
  js: { size: 0.72, soft: 1.8, alpha: 0.6, bloom: 1.2, blending: 'additive', trail: 0.9, ignite: 0.7 },
  envelope: { inhale: 0.44, exhale: 2.6, peak: 2.0 },
});
