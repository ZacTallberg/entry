let THREE;
let EffectComposer;
let RenderPass;
let UnrealBloomPass;
let graphicsModules;

const body = document.body;
const canvas = document.getElementById('particle-field');
const text = document.getElementById('entry-text');
const releaseButton = document.getElementById('release');
const status = document.getElementById('entry-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

const simVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const simFragmentShader = `
  uniform sampler2D tPositions;
  uniform sampler2D tOrigin;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPulse;
  uniform float uPulseType;
  uniform float uRelease;
  varying vec2 vUv;

  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m *= m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  vec3 curlNoise(vec3 p) {
    const float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    vec3 x0 = vec3(snoise(p-dx), snoise(p-dx+7.23), snoise(p-dx+13.5));
    vec3 x1 = vec3(snoise(p+dx), snoise(p+dx+7.23), snoise(p+dx+13.5));
    vec3 y0 = vec3(snoise(p-dy), snoise(p-dy+7.23), snoise(p-dy+13.5));
    vec3 y1 = vec3(snoise(p+dy), snoise(p+dy+7.23), snoise(p+dy+13.5));
    vec3 z0 = vec3(snoise(p-dz), snoise(p-dz+7.23), snoise(p-dz+13.5));
    vec3 z1 = vec3(snoise(p+dz), snoise(p+dz+7.23), snoise(p+dz+13.5));
    return normalize(vec3(
      y1.z-y0.z-z1.y+z0.y,
      z1.x-z0.x-x1.z+x0.z,
      x1.y-x0.y-y1.x+y0.x
    ) / (2.0 * e));
  }

  void main() {
    vec3 pos = texture2D(tPositions, vUv).xyz;
    vec3 origin = texture2D(tOrigin, vUv).xyz;
    vec3 flow = curlNoise(pos * 0.58 + vec3(0.0, 0.0, uTime * 0.11));
    vec3 velocity = flow * 0.0095;

    vec2 pointerDelta = pos.xy - uPointer;
    float pointerDistance = max(length(pointerDelta), 0.12);
    vec3 pointerDirection = normalize(vec3(pointerDelta, pos.z * 0.2));
    velocity += pointerDirection * (0.0018 / pointerDistance);

    if (uPulse > 0.001) {
      float falloff = 1.0 / (pointerDistance + 0.18);
      if (uPulseType < 0.5) {
        velocity += pointerDirection * 0.035 * falloff * uPulse;
      } else if (uPulseType < 1.5) {
        velocity -= pointerDirection * 0.025 * falloff * uPulse;
      } else if (uPulseType < 2.5) {
        velocity += vec3(-pointerDirection.y, pointerDirection.x, 0.03) * 0.04 * falloff * uPulse;
      } else {
        velocity += flow * 0.055 * uPulse + pointerDirection * 0.02 * falloff * uPulse;
      }
    }

    float centerDistance = max(length(pos), 0.12);
    velocity += normalize(pos) * uRelease * (0.036 / centerDistance);
    velocity += (origin - pos) * 0.0032;
    pos += velocity;
    gl_FragColor = vec4(pos, 1.0);
  }
`;

const renderVertexShader = `
  uniform sampler2D tPositions;
  uniform float uTime;
  uniform float uPointSize;
  varying vec3 vColor;

  vec3 palette(float t) {
    vec3 midnight = vec3(0.18, 0.25, 0.58);
    vec3 blue = vec3(0.43, 0.58, 1.0);
    vec3 pearl = vec3(1.0, 0.82, 0.72);
    float warmth = smoothstep(0.45, 1.9, t);
    return mix(mix(midnight, blue, smoothstep(0.0, 1.1, t)), pearl, warmth * 0.38);
  }

  void main() {
    vec3 p = texture2D(tPositions, position.xy).xyz;
    float radius = length(p.xy);
    float shimmer = 0.82 + 0.18 * sin(uTime * 0.7 + p.x * 8.0 + p.y * 5.0);
    vColor = palette(radius + p.z * 0.28) * shimmer;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uPointSize / max(0.48, -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const renderFragmentShader = `
  varying vec3 vColor;
  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float alpha = pow(1.0 - radius * 2.0, 1.6) * 0.68;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

class ParticleField {
  constructor(target) {
    if (!document.createElement('canvas').getContext('webgl2')) {
      throw new Error('WebGL2 unavailable');
    }

    const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const lowConcurrency = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const lowPower = lowMemory || lowConcurrency;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 720;
    this.textureSize = lowPower || narrow ? 256 : 384;
    this.target = target;
    this.active = true;
    this.disposed = false;
    this.pulse = 0;
    this.pulseType = 0;
    this.releaseStarted = 0;
    this.releaseEnergy = 0;
    this.pointerTarget = new THREE.Vector2(0, 0);
    this.pointer = new THREE.Vector2(0, 0);
    this.clock = new THREE.Clock();
    this.lastFrame = 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.z = 4.4;
    this.renderer = new THREE.WebGLRenderer({
      canvas: target,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.6));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      narrow ? 1.15 : 1.42,
      0.52,
      0.16,
    );
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloom);

    this.initializeSimulation();
    this.initializeParticles();
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.contextLost = this.contextLost.bind(this);
    window.addEventListener('resize', this.resize, { passive: true });
    target.addEventListener('webglcontextlost', this.contextLost);
    this.raf = requestAnimationFrame(this.frame);
  }

  initializeSimulation() {
    const size = this.textureSize;
    const options = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.targetA = new THREE.WebGLRenderTarget(size, size, options);
    this.targetB = new THREE.WebGLRenderTarget(size, size, options);
    const values = new Float32Array(size * size * 4);

    for (let i = 0; i < values.length; i += 4) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 0.72 + Math.pow(Math.random(), 0.62) * 1.62;
      const depth = (Math.random() - 0.5) * (0.55 + radius * 0.34);
      const breathing = 1 + Math.sin(theta * 3) * 0.09;
      values[i] = Math.cos(theta) * radius * breathing;
      values[i + 1] = Math.sin(theta) * radius * 0.61;
      values[i + 2] = depth;
      values[i + 3] = 1;
    }

    this.origin = new THREE.DataTexture(values, size, size, THREE.RGBAFormat, THREE.FloatType);
    this.origin.needsUpdate = true;
    this.simScene = new THREE.Scene();
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.simMaterial = new THREE.ShaderMaterial({
      vertexShader: simVertexShader,
      fragmentShader: simFragmentShader,
      uniforms: {
        tPositions: { value: this.origin },
        tOrigin: { value: this.origin },
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uPulse: { value: 0 },
        uPulseType: { value: 0 },
        uRelease: { value: 0 },
      },
    });
    this.simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMaterial));
    this.renderer.setRenderTarget(this.targetA);
    this.renderer.render(this.simScene, this.simCamera);
    this.renderer.setRenderTarget(this.targetB);
    this.renderer.render(this.simScene, this.simCamera);
    this.renderer.setRenderTarget(null);
  }

  initializeParticles() {
    const size = this.textureSize;
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
    this.renderMaterial = new THREE.ShaderMaterial({
      vertexShader: renderVertexShader,
      fragmentShader: renderFragmentShader,
      uniforms: {
        tPositions: { value: this.targetA.texture },
        uTime: { value: 0 },
        uPointSize: { value: window.innerWidth < 640 ? 3.8 : 4.4 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particles = new THREE.Points(this.geometry, this.renderMaterial);
    this.scene.add(this.particles);
  }

  contextLost(event) {
    event.preventDefault();
    this.dispose();
    body.dataset.graphics = 'fallback';
  }

  setPointer(x, y) {
    this.pointerTarget.set(x * 2.2, y * 1.45);
  }

  excite(kind, energy = 1) {
    const types = { outward: 0, inward: 1, orbit: 2, scatter: 3 };
    this.pulseType = types[kind] ?? 0;
    this.pulse = Math.max(this.pulse, clamp(energy, 0.25, 2.8));
  }

  release(length) {
    this.releaseStarted = performance.now();
    this.releaseEnergy = clamp(0.7 + Math.log2(Math.max(2, length)) * 0.12, 0.85, 1.65);
    this.excite('inward', 2.2);
  }

  settle() {
    this.releaseStarted = 0;
    this.releaseEnergy = 0;
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
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.renderMaterial.uniforms.uPointSize.value = window.innerWidth < 640 ? 3.8 : 4.4;
  }

  frame(now) {
    this.raf = 0;
    if (this.disposed || !this.active) return;
    const interacting = this.pulse > 0.03 || this.releaseStarted > 0;
    const interval = interacting ? 1000 / 60 : 1000 / 32;
    if (now - this.lastFrame < interval) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    this.lastFrame = now;
    const time = this.clock.getElapsedTime();
    this.pointer.lerp(this.pointerTarget, 0.055);
    this.pulse *= 0.91;

    let releaseForce = 0;
    if (this.releaseStarted) {
      const elapsed = (now - this.releaseStarted) / 1000;
      if (elapsed < 0.48) {
        releaseForce = -this.releaseEnergy * Math.sin((elapsed / 0.48) * Math.PI);
      } else if (elapsed < 2.35) {
        const phase = (elapsed - 0.48) / 1.87;
        releaseForce = this.releaseEnergy * 2.35 * Math.pow(1 - phase, 2.1);
      } else {
        this.releaseStarted = 0;
      }
    }

    this.simMaterial.uniforms.uTime.value = time;
    this.simMaterial.uniforms.uPointer.value.copy(this.pointer);
    this.simMaterial.uniforms.uPulse.value = this.pulse;
    this.simMaterial.uniforms.uPulseType.value = this.pulseType;
    this.simMaterial.uniforms.uRelease.value = releaseForce;
    this.simMaterial.uniforms.tPositions.value = this.targetA.texture;
    this.renderer.setRenderTarget(this.targetB);
    this.renderer.render(this.simScene, this.simCamera);
    [this.targetA, this.targetB] = [this.targetB, this.targetA];
    this.renderMaterial.uniforms.tPositions.value = this.targetA.texture;
    this.renderMaterial.uniforms.uTime.value = time;
    this.renderer.setRenderTarget(null);
    this.composer.render();
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
    this.renderMaterial?.dispose();
    this.simMaterial?.dispose();
    this.origin?.dispose();
    this.targetA?.dispose();
    this.targetB?.dispose();
    this.composer?.dispose?.();
    this.renderer?.dispose();
  }
}

let field = null;
let composing = false;
let locked = false;
let lastInputAt = 0;
let cadence = 420;
let releaseDeadline = 0;
let releaseDelay = 0;
let releaseTimer = 0;
let holdingTimer = 0;
let progressFrame = 0;
let clearTimer = 0;
let restoreTimer = 0;
let emptyTimer = 0;
let fieldGeneration = 0;

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
    ]);
    const [threeModule, composerModule, renderPassModule, bloomModule] = await graphicsModules;
    if (generation !== fieldGeneration || reducedMotion.matches) return;
    THREE = threeModule;
    EffectComposer = composerModule.EffectComposer;
    RenderPass = renderPassModule.RenderPass;
    UnrealBloomPass = bloomModule.UnrealBloomPass;
    field = new ParticleField(canvas);
    body.dataset.graphics = 'webgl';
  } catch (_error) {
    body.dataset.graphics = 'fallback';
  }
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
  releaseTimer = 0;
  holdingTimer = 0;
  progressFrame = 0;
  releaseDeadline = 0;
  setProgress(0);
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
    if (!locked && text.value.trim()) setState('holding', 'holding');
  }, Math.min(900, releaseDelay * 0.25));
  progressFrame = requestAnimationFrame(paintProgress);
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
  autoSize();
  const hasText = text.value.trim().length > 0;
  body.dataset.hasText = String(hasText);
  releaseButton.disabled = !hasText;
  if (!hasText) {
    cancelReleaseSchedule();
    setState('empty', 'listening');
    return;
  }
  setState('writing', 'listening');
  field?.excite(classifyInput(event), event.inputType === 'insertFromPaste' ? 2.1 : clamp(1.45 - cadence / 1000, .55, 1.35));
  if (!composing) scheduleRelease();
}

function beginRelease() {
  if (locked || composing || !text.value.trim()) return;
  locked = true;
  cancelReleaseSchedule();
  const length = text.value.length;
  text.readOnly = true;
  releaseButton.disabled = true;
  releaseButton.setAttribute('aria-busy', 'true');
  setState('releasing', 'letting go');
  field?.release(length);

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
    setState('returned', 'gone');
    if (finePointer.matches && document.visibilityState === 'visible') text.focus({ preventScroll: true });
  }, reducedMotion.matches ? 360 : 2200);

  emptyTimer = window.setTimeout(() => {
    if (!text.value) setState('empty', 'listening');
  }, reducedMotion.matches ? 900 : 3900);
}

function resetExperience() {
  clearTimeout(clearTimer);
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

document.addEventListener('pointermove', (event) => {
  const x = (event.clientX / window.innerWidth) - .5;
  const y = .5 - (event.clientY / window.innerHeight);
  field?.setPointer(x, y);
}, { passive: true });

document.addEventListener('visibilitychange', () => {
  field?.setActive(document.visibilityState === 'visible');
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
});
