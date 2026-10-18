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

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

const clock = new THREE.Clock();
let form = params.get('form') === 'still' ? 'still' : 'radiant';
let shown = form === 'still' ? 1 : 0;

function applyForm() {
  const goingStill = form === 'still';
  const t = goingStill ? shown : 1 - shown;
  rings.setForm(form, t);
  particles.setForm(form, t);
  debris.setForm(form, t);
}

const origError = console.error.bind(console);
console.error = (...args) => {
  origError(...args);
  const note = document.createElement('pre');
  note.textContent = args
    .map((item) => (typeof item === 'string' ? item : item?.message || String(item)))
    .join('\n')
    .slice(0, 1800);
  note.style.cssText =
    'position:fixed;top:0;left:0;right:0;max-height:40vh;overflow:auto;color:#ffb4a8;background:rgba(0,0,0,0.85);z-index:9;font:12px/1.4 ui-monospace,monospace;padding:8px;white-space:pre-wrap';
  document.body.appendChild(note);
};

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
  renderer.setSize(width, height);
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
  angel.update(time, dt);
  rings.update(time, dt);
  particles.update(time, dt);
  debris.update(time, dt);
  composer.render();
  frames += 1;
  if (frames === 2) window.__ready = true;
  requestAnimationFrame(frame);
}

frame();
