import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import modelUrl from '../virgo/source/model.glb?url';

const WAIST_RADIUS_X = 0.92;
const WAIST_RADIUS_Z = 0.78;
const FIT_MARGIN = 0.9;
const WAIST_Y = 1.12;
const TRAIL_Z = -0.02;
const HALO_Z = -0.44;
const HALO_GAP = 0.08;
// glTF emissiveFactor is (1, 1, 1). Full strength blooms into a white core.
const EMISSIVE_INTENSITY = 0.18;

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

export function createVirgoModel() {
  const group = new THREE.Group();
  group.name = 'virgo';

  const placement = {
    scale: 1,
    position: [0, WAIST_Y, TRAIL_Z],
    rotationY: 0,
    emissiveIntensity: EMISSIVE_INTENSITY,
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
      root.name = 'virgo-sculpt';
      const fitted = fitToWaist(root);
      tuneEmissive(root, EMISSIVE_INTENSITY);
      group.add(root);
      group.scale.setScalar(fitted.scale);
      group.position.set(fitted.position[0], fitted.position[1], fitted.position[2]);
      group.rotation.y = fitted.rotationY;

      placement.scale = fitted.scale;
      placement.position = fitted.position.slice();
      placement.rotationY = fitted.rotationY;
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
    // Source front already faces +Z, toward the camera.
    rotationY: 0,
  };
}

function tuneEmissive(object, intensity) {
  object.traverse((child) => {
    const materials = materialsOf(child);
    for (const material of materials) {
      if (!material || !('emissiveIntensity' in material)) continue;
      material.emissiveIntensity = intensity;
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
