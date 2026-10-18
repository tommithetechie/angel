import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMarble } from '../src/marble.js';
import { createAngel } from '../src/angel.js';
import { createRings } from '../src/rings.js';
import { createParticles } from '../src/particles.js';
import { createDebris } from '../src/debris.js';

const params = new URLSearchParams(location.search);
const showUi = params.get('ui') !== '0';
if (!showUi) document.getElementById('bar').style.display = 'none';

function qualityPixelRatio() {
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const low = narrow || coarse || saveData;
  const dpr = window.devicePixelRatio || 1;
  return low ? Math.min(dpr, 1.15) : Math.min(dpr, 1.6);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(qualityPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x07060a, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060a);
scene.fog = new THREE.FogExp2(0x07060a, 0.02);

const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 50);
if (params.get('view') === 'side') camera.position.set(5.4, 1.55, 4.6);
else camera.position.set(0.1, 1.42, 7.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.42, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3.2;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * 0.92;
controls.update();

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0x14161c, 0x000000, 0.12));

const key = new THREE.DirectionalLight(0xf2f4ff, 1.55);
key.position.set(-2.4, 4.2, 3.2);
scene.add(key);

const rim = new THREE.DirectionalLight(0xb7c6ee, 1.15);
rim.position.set(2.2, 2.6, -3.4);
scene.add(rim);

const fill = new THREE.DirectionalLight(0x8ea0c4, 0.18);
fill.position.set(0.2, 1.1, 4.2);
scene.add(fill);

const warmA = new THREE.PointLight(0xffc56a, 2.4, 6, 2);
warmA.position.set(1.15, 2.35, 1.4);
scene.add(warmA);

const warmB = new THREE.PointLight(0xffc56a, 1.8, 6.5, 2);
warmB.position.set(-1.35, 0.45, 1.5);
scene.add(warmB);

const marble = createMarble(renderer);
const angel = createAngel(marble);
const rings = createRings();
const particles = createParticles(marble);
const debris = createDebris(marble);
scene.add(angel.group, rings.group, particles.group, debris.group);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.28, 1.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());

renderer.info.autoReset = false;

const clock = new THREE.Clock();
let form = params.get('form') === 'still' ? 'still' : 'radiant';
let shown = form === 'still' ? 1 : 0;

const audit = params.get('audit') === '1';
window.__logs = [];
for (const level of ['error', 'warn']) {
  const orig = console[level].bind(console);
  console[level] = (...args) => {
    window.__logs.push({
      level,
      text: args
        .map((item) => (item && item.stack) || (item && item.message) || String(item))
        .join('\n')
        .slice(0, 700),
    });
    orig(...args);
  };
}

function applyForm() {
  const goingStill = form === 'still';
  const t = goingStill ? shown : 1 - shown;
  for (const mod of [marble, angel, rings, particles, debris]) {
    if (typeof mod.setForm === 'function') mod.setForm(form, t);
  }
}

window.__effects = { rings, particles, debris, marble, angel, renderer, scene, camera };
window.__drive = (next, value) => {
  form = next === 'still' ? 'still' : 'radiant';
  shown = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1));
  applyForm();
};
if (audit) window.__frames = [];

applyForm();

const radiantBtn = document.getElementById('radiant');
const stillBtn = document.getElementById('still');

function select(next) {
  form = next;
  radiantBtn.setAttribute('aria-pressed', String(next === 'radiant'));
  stillBtn.setAttribute('aria-pressed', String(next === 'still'));
}

radiantBtn.addEventListener('click', () => select('radiant'));
stillBtn.addEventListener('click', () => select('still'));

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(qualityPixelRatio());
  renderer.setSize(width, height);
  composer.setPixelRatio(qualityPixelRatio());
  composer.setSize(width, height);
}

window.addEventListener('resize', resize);

let frames = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  const target = form === 'still' ? 1 : 0;
  shown = THREE.MathUtils.damp(shown, target, 2.4, dt);
  applyForm();
  controls.update();
  if (typeof marble.update === 'function') marble.update(time, dt);
  angel.update(time, dt);
  rings.update(time, dt);
  particles.update(time, dt);
  debris.update(time, dt);
  renderer.info.reset();
  const start = performance.now();
  composer.render();
  const frameMs = performance.now() - start;
  frames += 1;
  if (audit) {
    const info = renderer.info;
    window.__frames.push({
      frameMs,
      calls: info.render.calls,
      triangles: info.render.triangles,
      lines: info.render.lines,
      points: info.render.points,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    });
    info.reset();
  }
  if (frames === 2) window.__ready = true;
  requestAnimationFrame(frame);
}

frame();
