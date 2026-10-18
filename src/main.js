import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMarble } from './marble.js';
import { createAngel } from './angel.js';
import { createRings } from './rings.js';
import { createParticles } from './particles.js';

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
camera.position.set(0.1, 1.42, 7.6);

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
scene.add(angel.group, rings.group, particles.group);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.28, 1.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const clock = new THREE.Clock();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
}

window.addEventListener('resize', resize);

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  controls.update();
  angel.update(time, dt);
  rings.update(time, dt);
  particles.update(time, dt);
  composer.render();
  requestAnimationFrame(frame);
}

frame();
