import './ui.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createMarble } from './marble.js';
import { createAngel } from './angel.js';
import { createRings } from './rings.js';
import { createParticles } from './particles.js';
import { createFloor } from './floor.js';
import { createDebrisModule, createForms } from './forms.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(window.location.search);
const settle = params.has('settle') || reducedMotion;

const quality = detectQuality();

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05040a, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-label', 'Seraphim, a marble figure in a dark reflective space');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05040a);
scene.fog = new THREE.FogExp2(0x100e14, 0.016);

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.12, 140);
const lookAt = new THREE.Vector3(0, 1.0, 0);
const introFrom = new THREE.Vector3(0.72, 2.2, 14.6);
const introTo = new THREE.Vector3(0.22, 1.7, 9.5);
camera.position.copy(settle ? introTo : introFrom);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(lookAt);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.65;
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.minDistance = 3.6;
controls.maxDistance = 18;
controls.minPolarAngle = 0.48;
controls.maxPolarAngle = Math.PI * 0.5 - 0.04;
controls.autoRotateSpeed = 0.38;
controls.update();

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.18).texture;
scene.environmentIntensity = 1.25;
pmrem.dispose();

const lights = createLights();
scene.add(
  lights.hemi,
  lights.key,
  lights.rim,
  lights.fill,
  lights.warmA,
  lights.warmB,
  lights.moonDir,
  lights.moonDir.target,
  lights.moonFill,
);

const moon = createMoon();
scene.add(moon);
lights.moonDir.position.copy(moon.position);

const marble = createMarble(renderer);
const angel = createAngel(marble);
const rings = createRings();
const particles = createParticles(marble);
const debris = createDebrisModule(marble);
const modules = [angel, rings, particles];
scene.add(angel.group, rings.group, particles.group);
if (debris?.group) {
  scene.add(debris.group);
  modules.push(debris);
}

const floor = createFloor(scene, quality);
floor.setMoonDirection(moon.position);
scene.add(floor.group);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.46,
  0.42,
  1.45,
);
bloom.highPassUniforms.smoothWidth.value = 0.42;
composer.addPass(bloom);
const grade = new ShaderPass(createGradeShader(quality));
composer.addPass(grade);

const hud = createHud();

const forms = createForms({
  scene,
  renderer,
  bloom,
  floor,
  lights,
  moon,
  modules,
  grade,
  reducedMotion,
  onChange: hud.setForm,
});

if (params.get('form') === 'still') forms.goTo('still', settle);
else if (settle) forms.goTo('radiant', true);

let introActive = !settle;
let introElapsed = 0;
const introSeconds = 6.6;
let interacting = false;
let idleFor = 0;

controls.addEventListener('start', () => {
  interacting = true;
  introActive = false;
  controls.autoRotate = false;
});
controls.addEventListener('end', () => {
  interacting = false;
  idleFor = 0;
});

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  if (event.target === hud.button) return;
  event.preventDefault();
  forms.toggle();
});
hud.button.addEventListener('click', () => forms.toggle());

window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
clock.getDelta();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (introActive) {
    introElapsed += dt;
    const p = Math.min(1, introElapsed / introSeconds);
    const eased = 1 - (1 - p) ** 3;
    camera.position.lerpVectors(introFrom, introTo, eased);
    controls.target.copy(lookAt);
    if (p >= 1) introActive = false;
  }

  if (!interacting) idleFor += dt;
  controls.autoRotate = !introActive && !interacting && idleFor > 1.4;

  controls.update();
  moon.lookAt(camera.position);

  forms.update(dt);
  floor.update(time);
  for (const mod of modules) {
    if (typeof mod.update === 'function') mod.update(time, dt);
  }
  grade.uniforms.uTime.value = time;

  composer.render();
  requestAnimationFrame(frame);
}

frame();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(width, height);
  composer.setPixelRatio(quality.pixelRatio);
  composer.setSize(width, height);
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
    chroma: low ? 0 : 0.0016,
    grain: low ? 0.018 : 0.03,
    vignette: low ? 0.28 : 0.38,
  };
}

function tagLight(light, color0, intensity0, color1, intensity1) {
  light.userData.color0 = new THREE.Color(color0);
  light.userData.color1 = new THREE.Color(color1);
  light.userData.i0 = intensity0;
  light.userData.i1 = intensity1;
  return light;
}

function createLights() {
  const hemi = new THREE.HemisphereLight(0x1a1c24, 0x070605, 0.22);
  hemi.userData.sky0 = new THREE.Color(0x1a1c24);
  hemi.userData.sky1 = new THREE.Color(0x1c4650);
  hemi.userData.ground0 = new THREE.Color(0x070605);
  hemi.userData.ground1 = new THREE.Color(0x062028);
  hemi.userData.i0 = 0.22;
  hemi.userData.i1 = 0.48;

  const key = tagLight(new THREE.DirectionalLight(0xfff3e6, 2.15), 0xfff3e6, 2.15, 0xd5e4ea, 0.72);
  key.position.set(-3.4, 5.6, 4.4);

  const rim = tagLight(new THREE.DirectionalLight(0xd7e4ff, 1.7), 0xd7e4ff, 1.7, 0x8eb8c4, 0.38);
  rim.position.set(3.6, 3.4, -4.4);

  const fill = tagLight(new THREE.DirectionalLight(0x93a6c8, 0.24), 0x93a6c8, 0.24, 0x7f9aa6, 0.4);
  fill.position.set(0.2, 1.5, 5.6);

  const warmA = tagLight(new THREE.PointLight(0xffc56a, 3.4, 8, 2), 0xffc56a, 3.4, 0xffc56a, 0.35);
  warmA.position.set(1.05, 2.2, 1.45);

  const warmB = tagLight(new THREE.PointLight(0xffb25a, 2.2, 8.5, 2), 0xffb25a, 2.2, 0xffb25a, 0.12);
  warmB.position.set(-1.4, 0.62, 1.4);

  const moonDir = tagLight(new THREE.DirectionalLight(0xe7eeff, 0), 0xe7eeff, 0, 0xe7eeff, 0.85);
  moonDir.position.set(3.15, 3.45, -6.1);
  moonDir.target.position.set(0, 1.3, 0);

  const moonFill = tagLight(new THREE.PointLight(0xd5e4ff, 0, 16, 2), 0xd5e4ff, 0, 0xd5e4ff, 3.4);
  moonFill.position.set(2.2, 3.1, -1.2);

  return { hemi, key, rim, fill, warmA, warmB, moonDir, moonFill };
}

function createMoon() {
  const material = new THREE.ShaderMaterial({
    name: 'Moon',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uIntensity: { value: 0 },
      uColor: { value: new THREE.Color(0xe7eefc) },
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
        float disc = smoothstep(0.26, 0.05, r);
        float glow = exp(-r * r * 2.1) * smoothstep(1.0, 0.12, r);
        vec3 col = uColor * uIntensity * (glow * 0.7 + disc * 0.85);
        float alpha = clamp(glow + disc, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  moon.name = 'moon';
  moon.position.set(3.15, 3.45, -6.1);
  moon.scale.setScalar(8.4);
  moon.userData.stillIntensity = 1.45;
  moon.renderOrder = 1;
  return moon;
}

function createGradeShader(level) {
  return {
    name: 'SeraphGrade',
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uStill: { value: 0 },
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
      uniform float uStill;
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
        float r = texture2D(tDiffuse, vUv + shift).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - shift).b;
        vec3 col = vec3(r, g, b);

        col.r *= mix(1.0, 0.94, uStill);
        col.g *= mix(1.0, 1.015, uStill);
        col.b *= mix(1.0, 1.07, uStill);
        col += vec3(0.004, 0.0035, 0.004) * (1.0 - uStill);
        col += vec3(0.002, 0.006, 0.008) * uStill;

        float vig = smoothstep(0.92, 0.28, radius * 2.1);
        col *= mix(1.0 - uVignette, 1.0, vig);

        gl_FragColor = vec4(max(col, 0.0), 1.0);
        #include <tonemapping_fragment>
        float n1 = hash(gl_FragCoord.xy + fract(uTime * 13.1) * 90.0);
        float n2 = hash(gl_FragCoord.xy * 0.45 + 19.0 + fract(uTime * 7.3) * 40.0);
        float grain = (n1 + n2) * 0.5 - 0.5;
        float luma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor.rgb = max(gl_FragColor.rgb + grain * uGrain * (1.2 - luma * 0.45), 0.0);
        #include <colorspace_fragment>
      }
    `,
  };
}

function createHud() {
  const root = document.createElement('div');
  root.className = 'hud';

  const title = document.createElement('p');
  title.className = 'hud-title';
  title.textContent = 'Seraphim';

  const caption = document.createElement('p');
  caption.className = 'hud-caption';
  caption.setAttribute('aria-live', 'polite');
  const lineA = document.createElement('span');
  const lineB = document.createElement('span');
  lineA.className = 'line';
  lineB.className = 'line';
  caption.append(lineA, lineB);

  const button = document.createElement('button');
  button.className = 'hud-toggle';
  button.type = 'button';

  root.append(title, caption, button);
  document.body.append(root);

  const copy = {
    radiant: ['Marble split by quiet fire,', 'wings raised in a dark orbit.'],
    still: ['A moon on sleeping water,', 'the wings at last at rest.'],
  };

  let shown = 'radiant';
  let timer = 0;

  function write(form) {
    const lines = copy[form] || copy.radiant;
    lineA.textContent = lines[0];
    lineB.textContent = lines[1];
    shown = form;
  }

  function setForm(form, { animate } = {}) {
    const label = form === 'radiant' ? 'Still' : 'Radiant';
    button.textContent = label;
    button.setAttribute('aria-label', `Switch to the ${label.toLowerCase()} form`);
    button.setAttribute('aria-pressed', form === 'still' ? 'true' : 'false');
    if (!animate || form === shown) {
      caption.classList.remove('is-out');
      write(form);
      return;
    }
    caption.classList.add('is-out');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      write(form);
      caption.classList.remove('is-out');
    }, 420);
  }

  write('radiant');
  setForm('radiant', { animate: false });

  return { root, button, setForm };
}
