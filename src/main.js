import './ui.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createRings } from './rings.js';
import { createParticles } from './particles.js';
import { createFloor } from './floor.js';
import { createDebris } from './debris.js';

const params = new URLSearchParams(window.location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const review = parseReview(params);
const quality = detectQuality();

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x070504, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.84;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-label', 'Animated gold halo and two orbital light trails');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070504);
scene.fog = new THREE.FogExp2(0x0e171a, 0.012);

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const envTarget = pmrem.fromScene(room, 0.04);
scene.environment = envTarget.texture;
scene.environmentIntensity = 0.5;
pmrem.dispose();
room.dispose();

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.08, 80);
const lookAt = new THREE.Vector3(0, 1.14, 0);
const heroAnchorPosition = new THREE.Vector3();
const heroAnchorTarget = new THREE.Vector3();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(lookAt);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.65;
controls.enablePan = false;
controls.screenSpacePanning = false;
controls.minDistance = 2.6;
controls.maxDistance = 16;
controls.minPolarAngle = 0.32;
controls.maxPolarAngle = Math.PI * 0.68;
controls.autoRotate = false;

const lights = createLights();
scene.add(
  lights.hemi,
  lights.key,
  lights.rim,
  lights.fill,
  lights.warm,
  lights.moonDir,
  lights.moonDir.target,
  lights.moonFill,
);
const moon = createMoon();
scene.add(moon);
lights.moonDir.position.copy(moon.position);

const rings = createRings();
const particles = createParticles();
const debris = createDebris();
const floor = createFloor(scene, quality);
const modules = [rings, particles, debris, floor];
scene.add(rings.group);
scene.add(particles.group, debris.group, floor.group);

function placeMoon() {
  const portrait = window.innerWidth / Math.max(window.innerHeight, 1) < 0.82;
  moon.position.set(
    portrait ? 1.65 : 2.85,
    portrait ? 4.08 : 3.25,
    portrait ? -5.25 : -6.2,
  );
  lights.moonDir.position.copy(moon.position);
  floor.setMoonDirection(moon.position);
}

placeMoon();

const composer = new EffectComposer(renderer);
const composerSamples = quality.low ? 0 : 2;
composer.renderTarget1.samples = composerSamples;
composer.renderTarget2.samples = composerSamples;
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  quality.low ? 0.34 : 0.42,
  0.44,
  1.18,
);
bloom.highPassUniforms.smoothWidth.value = 0.24;
composer.addPass(bloom);
const grade = new ShaderPass(createGradeShader(quality));
composer.addPass(grade);

const hud = createHud();
applyReviewToggles();
let sceneOwnsCamera = true;
let heroFrameDirty = true;
let heroFrameReady = false;
let interacting = false;
let heroFrameAnimating = false;
let idleFor = 0;
let resizeLock = false;
let composerSized = false;

controls.addEventListener('start', () => {
  interacting = true;
  sceneOwnsCamera = false;
  heroFrameAnimating = false;
});
controls.addEventListener('end', () => {
  interacting = false;
  idleFor = 0;
});

const pointerRaycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const pointerFloorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.96);
const pointerHit = new THREE.Vector3();
let lastPointerRippleMs = 0;

function spawnPointerRipple(event, strength) {
  if (typeof floor.addRipple !== 'function') return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width < 2 || height < 2) return;
  pointerNdc.set((event.clientX / width) * 2 - 1, -(event.clientY / height) * 2 + 1);
  pointerRaycaster.setFromCamera(pointerNdc, camera);
  pointerFloorPlane.constant = -floor.getFloorY();
  if (pointerRaycaster.ray.intersectPlane(pointerFloorPlane, pointerHit) && pointerHit.lengthSq() < 42) {
    floor.addRipple(pointerHit.x, pointerHit.z, strength);
  }
}

function onPointerDown(event) {
  if (event.target !== renderer.domElement) return;
  lastPointerRippleMs = performance.now();
  spawnPointerRipple(event, 0.92);
}

function onPointerMove(event) {
  if (interacting || event.target !== renderer.domElement) return;
  const now = performance.now();
  if (now - lastPointerRippleMs < 120) return;
  lastPointerRippleMs = now;
  spawnPointerRipple(event, 0.58);
}

renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });

hud.resetButton.addEventListener('click', returnToHero);
window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyR' || event.repeat) return;
  if (event.target === hud.resetButton) return;
  event.preventDefault();
  returnToHero();
});

window.addEventListener('resize', resize);
if (typeof ResizeObserver === 'function') {
  const viewport = new ResizeObserver(() => resize());
  viewport.observe(document.documentElement);
}

resize();
applyHeroFrame(true);

const clock = new THREE.Clock();
clock.getDelta();
let frameId = 0;
let released = false;

function frame() {
  if (released) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = review.enabled
    ? review.time
    : reducedMotion
      ? clock.elapsedTime * 0.12
      : clock.elapsedTime;

  if (!interacting) idleFor += dt;
  controls.update();

  if (heroFrameDirty && sceneOwnsCamera && !interacting) applyHeroFrame(true);
  if (heroFrameAnimating && sceneOwnsCamera && !interacting) {
    const positionStep = Math.min(1, dt * 3.2);
    const targetStep = Math.min(1, dt * 3.8);
    camera.position.lerp(heroAnchorPosition, positionStep);
    controls.target.lerp(heroAnchorTarget, targetStep);
    if (
      camera.position.distanceToSquared(heroAnchorPosition) < 1e-5 &&
      controls.target.distanceToSquared(heroAnchorTarget) < 1e-5
    ) {
      camera.position.copy(heroAnchorPosition);
      controls.target.copy(heroAnchorTarget);
      heroFrameAnimating = false;
    }
  }
  applyHeroDrift(dt);
  moon.lookAt(camera.position);
  rings.update(time, dt);
  particles.update(time, dt);
  debris.update(time, dt);
  floor.update(time, dt);
  grade.uniforms.uTime.value = time;

  composer.render();
  frameId = requestAnimationFrame(frame);
}

function resize() {
  if (resizeLock) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width < 2 || height < 2) return;
  const next = detectQuality();
  const bufferW = Math.floor(width * next.pixelRatio);
  const bufferH = Math.floor(height * next.pixelRatio);
  const sameBuffer = renderer.domElement.width === bufferW && renderer.domElement.height === bufferH;
  const sameGrade =
    grade.uniforms.uGrain.value === next.grain &&
    grade.uniforms.uVignette.value === next.vignette &&
    grade.uniforms.uChroma.value === next.chroma;
  quality.low = next.low;
  quality.pixelRatio = next.pixelRatio;
  quality.grain = next.grain;
  quality.vignette = next.vignette;
  quality.chroma = next.chroma;
  if (sameBuffer && sameGrade && composerSized) return;

  resizeLock = true;
  grade.uniforms.uGrain.value = next.grain;
  grade.uniforms.uVignette.value = next.vignette;
  grade.uniforms.uChroma.value = next.chroma;
  if (!sameBuffer) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(next.pixelRatio);
    renderer.setSize(width, height);
    composer.setPixelRatio(next.pixelRatio);
    composer.setSize(width, height);
  }
  placeMoon();
  composerSized = true;
  resizeLock = false;
  heroFrameDirty = true;
  if (heroFrameReady && sceneOwnsCamera && !interacting) applyHeroFrame(true);
}

function detectQuality() {
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const low = narrow || coarse || saveData;
  return {
    low,
    pixelRatio: low
      ? Math.min(window.devicePixelRatio || 1, 1.15)
      : Math.min(window.devicePixelRatio || 1, 1.6),
    chroma: low ? 0 : 0.0011,
    grain: low ? 0.004 : 0.008,
    vignette: low ? 0.12 : 0.18,
  };
}

function parseReview(search) {
  const enabled = search.has('review') && search.get('review') !== '0';
  const readNumber = (name) => {
    const raw = search.get(name);
    if (raw === null || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  return {
    enabled,
    time: Math.max(0, readNumber('time') ?? readNumber('t') ?? 0),
    showRings: search.get('rings') !== '0',
    showAtmosphere: search.get('atmosphere') !== '0',
  };
}

function applyReviewToggles() {
  if (!review.enabled) return;
  if (!review.showRings) rings.group.visible = false;
  if (!review.showAtmosphere) {
    particles.group.visible = false;
    debris.group.visible = false;
    floor.group.visible = false;
    moon.visible = false;
  }
}

function callDispose(target) {
  if (!target || typeof target.dispose !== 'function') return;
  try {
    target.dispose();
  } catch (error) {
    console.error(error);
  }
}

function applyHeroFrame(snap = false) {
  rings.update(review.enabled ? review.time : 0, 0);
  rings.group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(rings.group);
  if (bounds.isEmpty()) return;

  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const safeHalfWidth = Math.max(size.x * 0.5, 0.1) * 1.12;
  const safeHalfHeight = Math.max(size.y * 0.5, 0.1) * 1.1;
  const aspect = Math.max(camera.aspect, 0.1);
  const portrait = THREE.MathUtils.clamp((1.35 - aspect) / 0.9, 0, 1);
  camera.fov = THREE.MathUtils.lerp(32, 44, portrait);
  camera.updateProjectionMatrix();
  const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
  const distance = Math.max(
    safeHalfHeight / Math.tan(verticalHalfFov),
    safeHalfWidth / Math.tan(horizontalHalfFov),
  ) + Math.max(0.24, size.z * 0.5 + 0.08);
  const target = center.clone();
  target.y += 0.02;
  const position = target.clone().add(new THREE.Vector3(0.04, 0.02, distance));

  heroAnchorPosition.copy(position);
  heroAnchorTarget.copy(target);
  heroFrameReady = true;
  heroFrameDirty = false;
  if (!snap) return;
  heroFrameAnimating = false;
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
}

function applyHeroDrift(dt) {
  if (reducedMotion || review.enabled || !sceneOwnsCamera || interacting || !heroFrameReady || heroFrameAnimating || idleFor < 2.2) return;
  const phase = (idleFor - 2.2) * 0.12;
  const angle = Math.sin(phase) * 0.012;
  const desired = heroAnchorPosition.clone().sub(heroAnchorTarget);
  desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(heroAnchorTarget);
  camera.position.lerp(desired, Math.min(1, dt * 0.45));
  controls.target.lerp(heroAnchorTarget, Math.min(1, dt * 0.6));
}

function returnToHero() {
  sceneOwnsCamera = true;
  interacting = false;
  idleFor = 0;
  heroFrameDirty = true;
  applyHeroFrame(true);
}

function release() {
  if (released) return;
  released = true;
  cancelAnimationFrame(frameId);
  renderer.domElement.removeEventListener('pointerdown', onPointerDown);
  renderer.domElement.removeEventListener('pointermove', onPointerMove);
  for (const module of modules) callDispose(module);
  composer.dispose();
  controls.dispose();
  envTarget.dispose();
  moon.geometry.dispose();
  moon.material.dispose();
  renderer.dispose();
  renderer.domElement.remove();
}

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) release();
});

frame();

function createLights() {
  const hemi = new THREE.HemisphereLight(0x273744, 0x080605, 0.55);
  const key = new THREE.DirectionalLight(0xfff2df, 1.25);
  key.position.set(-2.2, 4.2, 5.2);
  const rim = new THREE.DirectionalLight(0x9ec8d6, 0.52);
  rim.position.set(3.2, 3.5, -3.6);
  const fill = new THREE.DirectionalLight(0x8eaeb8, 0.34);
  fill.position.set(1.8, 1.6, 4.8);
  const warm = new THREE.PointLight(0xffbe5c, 1.6, 5.0, 1.3);
  warm.position.set(0, 1.95, -0.9);
  const moonDir = new THREE.DirectionalLight(0xdceafa, 0.22);
  moonDir.position.set(2.85, 3.25, -6.2);
  moonDir.target.position.set(0, 1.15, 0);
  const moonFill = new THREE.PointLight(0xbdd9e8, 0.28, 14, 2);
  moonFill.position.set(1.8, 2.6, -1.4);
  return { hemi, key, rim, fill, warm, moonDir, moonFill };
}

function createMoon() {
  const material = new THREE.ShaderMaterial({
    name: 'Moon',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uIntensity: { value: 1 },
      uColor: { value: new THREE.Color(0xdceaf8) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uIntensity;
      uniform vec3 uColor;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float disc = smoothstep(0.22, 0.04, r);
        float glow = exp(-r * r * 3.2) * smoothstep(1.0, 0.14, r);
        vec3 col = uColor * uIntensity * (glow * 0.55 + disc * 0.72);
        float alpha = clamp(glow * 0.85 + disc, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  moon.name = 'moon';
  moon.position.set(2.85, 3.25, -6.2);
  moon.scale.setScalar(1.65);
  moon.renderOrder = 1;
  return moon;
}

function createGradeShader(level) {
  return {
    name: 'HaloGrade',
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uGrain: { value: level.grain },
      uVignette: { value: level.vignette },
      uChroma: { value: level.chroma },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uGrain;
      uniform float uVignette;
      uniform float uChroma;
      varying vec2 vUv;

      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      void main() {
        vec2 centered = vUv - 0.5;
        float radius = dot(centered, centered);
        vec2 shift = centered * uChroma * radius;
        vec3 col = vec3(
          texture2D(tDiffuse, vUv + shift).r,
          texture2D(tDiffuse, vUv).g,
          texture2D(tDiffuse, vUv - shift).b
        );
        float vig = smoothstep(0.92, 0.28, radius * 2.1);
        col *= mix(1.0 - uVignette, 1.0, vig);
        gl_FragColor = vec4(max(col, 0.0), 1.0);
        #include <tonemapping_fragment>
        float n1 = hash(gl_FragCoord.xy + fract(uTime * 13.1) * 90.0);
        float n2 = hash(gl_FragCoord.xy * 0.45 + 19.0 + fract(uTime * 7.3) * 40.0);
        float grain = (n1 + n2) * 0.5 - 0.5;
        float luma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor.rgb = max(gl_FragColor.rgb + grain * uGrain * (0.75 + luma * 0.35), 0.0);
        #include <colorspace_fragment>
      }
    `,
  };
}

function createHud() {
  const root = document.createElement('div');
  root.className = 'hud';
  root.classList.add('is-settled');
  root.style.opacity = '1';
  root.style.animation = 'none';

  const title = document.createElement('p');
  title.className = 'hud-title';
  title.textContent = 'Halo';
  title.setAttribute('aria-label', 'Animated gold halo');

  const resetButton = document.createElement('button');
  resetButton.className = 'hud-reset';
  resetButton.type = 'button';
  resetButton.textContent = 'Hero';
  resetButton.setAttribute('aria-label', 'Return to centered halo view');

  const actions = document.createElement('div');
  actions.className = 'hud-actions';
  actions.append(resetButton);
  root.append(title, actions);
  document.body.append(root);

  return { root, resetButton };
}
