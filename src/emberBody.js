import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from '../ember/source/body.glb?url';

const WAIST_RADIUS_X = 0.92;
const WAIST_RADIUS_Z = 0.78;
const FIT_MARGIN = 0.9;
const WAIST_Y = 1.12;
const TRAIL_Z = -0.02;
const HALO_Z = -0.44;
const HALO_GAP = 0.08;

const MAP_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'lightMap',
  'bumpMap',
  'alphaMap',
];

export function createEmberBody() {
  const group = new THREE.Group();
  group.name = 'ember-body';

  const placement = {
    scale: 1,
    position: [0, WAIST_Y, TRAIL_Z],
    rotationY: 0,
    emissiveIntensity: 0,
    sockets: null,
  };

  let disposed = false;
  let root = null;

  const ready = new GLTFLoader()
    .loadAsync(modelUrl)
    .then((gltf) => {
      const scene = gltf.scene;
      if (disposed) {
        disposeObject(scene);
        return placement;
      }

      root = scene;
      root.name = 'ember-sculpt';
      const fitted = fitToWaist(root);
      silenceEmissive(root);
      const sockets = measureSockets(root);
      group.add(root);
      group.scale.setScalar(fitted.scale);
      group.position.set(fitted.position[0], fitted.position[1], fitted.position[2]);
      // Baked export faces +Z, toward the camera.
      group.rotation.y = fitted.rotationY;

      placement.scale = fitted.scale;
      placement.position = fitted.position.slice();
      placement.rotationY = fitted.rotationY;
      placement.sockets = sockets;
      group.userData.placement = placement;
      return placement;
    });

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (root) disposeObject(root);
    root = null;
    group.removeFromParent();
  }

  return { group, ready, placement, dispose };
}

function fitToWaist(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const halfX = Math.max(size.x * 0.5, 1e-4);
  const halfZ = Math.max(size.z * 0.5, 1e-4);
  const scale = Math.min(
    (WAIST_RADIUS_X * FIT_MARGIN) / halfX,
    (WAIST_RADIUS_Z * FIT_MARGIN) / halfZ,
  );

  object.position.sub(center);

  const scaledHalfZ = halfZ * scale;
  const clearanceZ = HALO_Z + HALO_GAP + scaledHalfZ;
  const minZ = TRAIL_Z - WAIST_RADIUS_Z + scaledHalfZ;
  const maxZ = TRAIL_Z + WAIST_RADIUS_Z - scaledHalfZ;
  const z = THREE.MathUtils.clamp(clearanceZ, minZ, maxZ);

  return {
    scale,
    position: [0, WAIST_Y, z],
    rotationY: 0,
  };
}

function measureSockets(root) {
  root.updateMatrixWorld(true);
  const samples = [];
  const point = new THREE.Vector3();
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return;
    const position = child.geometry.attributes.position;
    const step = Math.max(1, Math.floor(position.count / 24000));
    for (let i = 0; i < position.count; i += step) {
      point.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
      root.worldToLocal(point);
      samples.push(point.x, point.y, point.z);
    }
  });

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < samples.length; i += 3) {
    minY = Math.min(minY, samples[i]);
    maxY = Math.max(maxY, samples[i]);
  }
  const height = Math.max(maxY - minY, 1e-4);

  function place(heightT, xFactor, zPush) {
    const y = minY + height * heightT;
    const half = height * 0.045;
    const absX = [];
    const zs = [];
    for (let i = 0; i < samples.length; i += 3) {
      if (Math.abs(samples[i + 1] - y) > half) continue;
      if (Math.abs(samples[i]) > 0.28) continue;
      absX.push(Math.abs(samples[i]));
      zs.push(samples[i + 2]);
    }
    absX.sort((a, b) => a - b);
    zs.sort((a, b) => a - b);
    const x = absX.length ? absX[Math.floor(0.86 * (absX.length - 1))] * xFactor : 0.12;
    const backZ = zs.length ? zs[Math.floor(0.2 * (zs.length - 1))] : -0.04;
    const node = new THREE.Group();
    node.position.set(THREE.MathUtils.clamp(x, 0.045, 0.22), y, backZ - zPush);
    return node;
  }

  const upper = place(0.78, 0.9, 0.016);
  const mid = place(0.6, 0.74, 0.022);
  const lower = place(0.45, 0.5, 0.016);
  const mirror = (node, name, sign) => {
    const socket = new THREE.Group();
    socket.name = name;
    socket.position.set(node.position.x * sign, node.position.y, node.position.z);
    root.add(socket);
    return socket;
  };

  return {
    wingUL: mirror(upper, 'wingUL', 1),
    wingUR: mirror(upper, 'wingUR', -1),
    wingML: mirror(mid, 'wingML', 1),
    wingMR: mirror(mid, 'wingMR', -1),
    wingLL: mirror(lower, 'wingLL', 1),
    wingLR: mirror(lower, 'wingLR', -1),
  };
}

function silenceEmissive(object) {
  object.traverse((child) => {
    for (const material of materialsOf(child)) {
      if (!material) continue;
      if (material.emissive?.set) material.emissive.set(0x000000);
      if ('emissiveIntensity' in material) material.emissiveIntensity = 0;
      material.emissiveMap = null;
      material.toneMapped = true;
    }
  });
}

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of materialsOf(child)) {
      if (!material || materials.has(material)) continue;
      materials.add(material);
      for (const key of MAP_KEYS) {
        const value = material[key];
        if (value && value.isTexture) textures.add(value);
      }
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

function materialsOf(child) {
  if (!child.material) return [];
  return Array.isArray(child.material) ? child.material : [child.material];
}
