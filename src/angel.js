import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Virgo's body, with the scene's six feathered wings.
 *
 * The sculpt is one static mesh: a gowned figure and a single pair of wings.
 * Those wings are removed and the existing six-wing rig is hung on the back,
 * so radiant still opens and still still folds, and the feathers are not a
 * second copy cutting through the gown. Wheat and staff are the same shell as
 * the hands, so they stay and take the marble.
 *
 * Contract: { group, update(time, dt), setForm(form, t), dispose }
 *   form — 'radiant' or 'still'
 *   t    — 0 at the other form, 1 at the named form
 */

const TARGET_BODY_HEIGHT = 2.16;
const HEM_Y = 0.2;
const WING_REACH = 0.76;
const BACK_PAD = 0.16;

const TEXTURE_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function v3(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _x = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(0, 0, 1);

function cubicInto(out, p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  out.set(0, 0, 0);
  out.addScaledVector(p0, uu * u);
  out.addScaledVector(p1, 3 * uu * t);
  out.addScaledVector(p2, 3 * u * tt);
  out.addScaledVector(p3, tt * t);
  return out;
}

function cubicTangentInto(out, p0, p1, p2, p3, t) {
  const u = 1 - t;
  out.set(0, 0, 0);
  out.addScaledVector(_a.copy(p1).sub(p0), 3 * u * u);
  out.addScaledVector(_b.copy(p2).sub(p1), 6 * u * t);
  out.addScaledVector(_c.copy(p3).sub(p2), 3 * t * t);
  if (out.lengthSq() < 1e-8) out.set(0, 1, 0);
  return out.normalize();
}

function basisQuat(out, dir, normal) {
  _y.copy(dir).normalize();
  _z.copy(normal);
  _z.addScaledVector(_y, -_z.dot(_y));
  if (_z.lengthSq() < 1e-8) _z.crossVectors(_y, _fwd);
  if (_z.lengthSq() < 1e-8) _z.set(1, 0, 0);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

/**
 * Unit-length feather. Local +Y runs base → tip, +X across the vane,
 * +Z is the camber / quill. Instanced scale is (width, length, 1).
 */
function createFeatherGeometry() {
  const lengthSegs = 11;
  const across = 4;
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  const halfWidth = (t, sign) => {
    const grow = t / (0.07 + t);
    const belly = Math.sin(Math.PI * Math.pow(t, 0.62));
    const tip = Math.pow(1 - t, 0.42);
    const w = 0.0035 + 0.078 * belly * tip * (0.22 + 0.78 * grow);
    return w * (sign < 0 ? 0.8 : 1.14);
  };

  for (let i = 0; i <= lengthSegs; i++) {
    const t = i / lengthSegs;
    const y = t;
    const arc = Math.sin(t * Math.PI) * 0.028 + t * t * 0.02;
    for (let c = 0; c <= across; c++) {
      const u = c / across;
      const s = u * 2 - 1;
      const sign = s < 0 ? -1 : 1;
      const w = halfWidth(t, sign);
      const x = s * w;
      const quill = Math.exp(-(s * s) / 0.012) * 0.011 * (1 - t * 0.35);
      const camber = Math.cos(s * Math.PI * 0.5) * Math.sin(t * Math.PI) * 0.034;
      const z = camber + quill - arc;
      positions.push(x, y, z);
      uvs.push(u, t);
      const edge = 1 - 0.42 * Math.pow(Math.abs(s), 1.15);
      const shaft = 1 - 0.22 * Math.exp(-(s * s) / 0.006);
      const tipShade = 1 - 0.1 * smoothstep(0.72, 1, t);
      const baseShade = 0.82 + 0.18 * smoothstep(0, 0.18, t);
      const shade = edge * shaft * tipShade * baseShade;
      colors.push(shade, shade, Math.min(1, shade + 0.02));
    }
  }

  const stride = across + 1;
  for (let i = 0; i < lengthSegs; i++) {
    for (let c = 0; c < across; c++) {
      const a = i * stride + c;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function preferLight() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const narrow = window.matchMedia('(max-width: 760px), (max-height: 520px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return narrow || (coarse && window.matchMedia('(max-width: 1100px)').matches);
}

function useMobileModel() {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth || 1280;
  const h = window.innerHeight || 800;
  const dpr = window.devicePixelRatio || 1;
  const narrow = Math.min(w, h) < 760 || w < 820;
  const touch =
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  if (narrow) return true;
  if (touch && w < 1180) return true;
  if (dpr >= 2.4 && w < 1100) return true;
  return false;
}

function modelUrl() {
  const base = import.meta.env.BASE_URL || '/';
  const name = useMobileModel() ? 'virgo-50k-mobile.glb' : 'virgo-100k.glb';
  return `${base}models/${name}`;
}

function featherEnvelope(kind, t, rowF, layerF) {
  const layer = THREE.MathUtils.lerp(1, 0.32, Math.pow(layerF, 0.85));
  if (kind === 'upper') {
    const arch = Math.sin(Math.PI * Math.pow(Math.max(t, 0.001), 0.78));
    const point = 1 - 0.55 * smoothstep(0.72, 1, t);
    const base = (0.24 + 0.7 * arch) * point;
    const row = THREE.MathUtils.lerp(0.68, 1, 1 - Math.abs(rowF) * 0.35);
    return base * row * layer;
  }
  if (kind === 'middle') {
    const base = THREE.MathUtils.lerp(0.42, 0.7, Math.pow(t, 0.55));
    const row = THREE.MathUtils.lerp(0.38, 1, smoothstep(-0.15, 1, rowF));
    const primary = t > 0.74 ? THREE.MathUtils.lerp(0.45, 1.2, smoothstep(0.15, 1, rowF) * (layerF < 0.45 ? 1 : 0.35)) : 1;
    return base * row * layer * primary;
  }
  const belly = Math.sin(Math.PI * Math.pow(Math.max(t, 0.001), 0.72));
  const taper = THREE.MathUtils.lerp(1, 0.1, Math.pow(t, 1.3));
  const base = THREE.MathUtils.lerp(0.26, 0.98, Math.pow(belly, 0.5)) * taper;
  const row = THREE.MathUtils.lerp(0.55, 1, 1 - Math.abs(rowF) * 0.35);
  return base * row * layer;
}

function makeWingSpecs(light) {
  const along = (n) => (light ? Math.max(10, Math.round(n * 0.75)) : n);
  const rows = (n) => (light ? Math.max(3, n - 1) : n);
  const layers = light ? 2 : 3;
  const specs = [];
  for (const side of [1, -1]) {
    const s = side;
    specs.push({
      name: `upper-${s > 0 ? 'l' : 'r'}`,
      kind: 'upper',
      bone: s > 0 ? 'wingUL' : 'wingUR',
      side: s,
      along: along(18),
      rows: rows(4),
      layers,
      flutter: 0.055,
      open: {
        points: [v3(0, 0, 0), v3(0.22 * s, 0.3, -0.05), v3(0.06 * s, 1.05, -0.01), v3(-0.11 * s, 1.6, 0.03)],
        hints: [v3(0.15 * s, 0.95, -0.08), v3(0.55 * s, 0.72, -0.1), v3(0.02 * s, 0.99, -0.06)],
        fan0: 0.14,
        fan1: 0.28,
        out: 0.8,
        lenMul: 1,
        width: 1.02,
      },
      closed: {
        points: [v3(0, 0, 0), v3(0.05 * s, -0.28, -0.06), v3(0.03 * s, -0.58, -0.04), v3(0.01 * s, -0.92, -0.02)],
        hints: [v3(0.08 * s, -0.98, -0.04), v3(0.05 * s, -1, -0.02), v3(0.02 * s, -1, 0)],
        fan0: 0.05,
        fan1: 0.08,
        out: 0.22,
        lenMul: 0.48,
        width: 0.72,
      },
    });
    specs.push({
      name: `middle-${s > 0 ? 'l' : 'r'}`,
      kind: 'middle',
      bone: s > 0 ? 'wingML' : 'wingMR',
      side: s,
      along: along(17),
      rows: rows(4),
      layers,
      flutter: 0.07,
      open: {
        points: [v3(0, 0, 0), v3(0.28 * s, 0.1, -0.05), v3(0.55 * s, 0.22, -0.02), v3(0.78 * s, 0.34, 0.02)],
        hints: [v3(0.02 * s, -0.99, -0.1), v3(0.22 * s, -0.92, -0.08), v3(0.72 * s, -0.48, -0.06)],
        fan0: 0.18,
        fan1: 0.62,
        out: 0.86,
        lenMul: 1,
        width: 0.88,
      },
      closed: {
        points: [v3(0, 0, 0), v3(0.08 * s, -0.32, -0.08), v3(0.05 * s, -0.68, -0.05), v3(0.02 * s, -1.05, -0.02)],
        hints: [v3(0.1 * s, -0.96, -0.05), v3(0.06 * s, -1, -0.03), v3(0.02 * s, -1, 0)],
        fan0: 0.06,
        fan1: 0.1,
        out: 0.24,
        lenMul: 0.5,
        width: 0.7,
      },
    });
    specs.push({
      name: `lower-${s > 0 ? 'l' : 'r'}`,
      kind: 'lower',
      bone: s > 0 ? 'wingLL' : 'wingLR',
      side: s,
      along: along(15),
      rows: rows(5),
      layers,
      flutter: 0.085,
      lenBias: s < 0 ? 1.06 : 1,
      open: {
        points: [v3(0, 0, 0), v3(0.14 * s, -0.55, -0.06), v3(0.18 * s, -1.18, -0.03), v3(0.04 * s, -1.95, 0.0)],
        hints: [v3(0.2 * s, -0.94, -0.04), v3(0.28 * s, -0.9, -0.02), v3(0.05 * s, -1, 0.0)],
        fan0: 0.42,
        fan1: 0.1,
        out: 0.82,
        lenMul: 1,
        width: 1.05,
      },
      closed: {
        points: [v3(0, 0, 0), v3(0.05 * s, -0.22, -0.05), v3(0.03 * s, -0.42, -0.03), v3(0.01 * s, -0.62, -0.01)],
        hints: [v3(0.12 * s, -0.97, -0.04), v3(0.06 * s, -1, -0.02), v3(0, -1, 0)],
        fan0: 0.1,
        fan1: 0.06,
        out: 0.2,
        lenMul: 0.55,
        width: 0.75,
      },
    });
  }
  for (const spec of specs) {
    for (const pose of [spec.open, spec.closed]) {
      for (const p of pose.points) {
        p.multiplyScalar(WING_REACH);
        // Keep the vane behind the gown. Group +Z faces the camera.
        p.z -= 0.1;
      }
    }
  }
  return specs;
}

function buildRecipes(specs, rand) {
  const recipes = [];
  for (const spec of specs) {
    const list = [];
    for (let i = 0; i < spec.along; i++) {
      const t = spec.along === 1 ? 0 : i / (spec.along - 1);
      for (let row = 0; row < spec.rows; row++) {
        const rowF = spec.rows === 1 ? 0 : (row / (spec.rows - 1)) * 2 - 1;
        for (let layer = 0; layer < spec.layers; layer++) {
          const layerF = spec.layers === 1 ? 0 : layer / (spec.layers - 1);
          list.push({
            t,
            rowF,
            layerF,
            seed: rand(),
            alt: rand(),
          });
        }
      }
    }
    recipes.push(list);
  }
  return recipes;
}

function sampleHint(out, hints, t) {
  if (t < 0.5) return out.copy(hints[0]).lerp(hints[1], t / 0.5);
  return out.copy(hints[1]).lerp(hints[2], (t - 0.5) / 0.5);
}

function lerpPose(outP, outH, a, b, t) {
  for (let i = 0; i < 4; i++) outP[i].copy(a.points[i]).lerp(b.points[i], t);
  for (let i = 0; i < 3; i++) outH[i].copy(a.hints[i]).lerp(b.hints[i], t);
}

// Virgo's own wings are one asymmetric curtain welded into the gown.
// The body sits near x = 0.17. Anything outside the gown, and outside the
// forward reach of the arms, is that curtain.
const BODY_X = 0.17;

function gownRadius(y) {
  if (y > 0.5) return 0.2;
  if (y > 0.4) return 0.24;
  if (y > 0.12) return 0.27;
  if (y > -0.08) return 0.3;
  if (y > -0.28) return 0.38;
  const flare = Math.min(1, (-0.28 - y) / 0.5);
  return 0.38 + flare * 0.16;
}

function isWing(x, y, z) {
  const dx = x - BODY_X;
  // Raised wing beside and above the head. The head itself stays left of x = 0.36.
  if (y > 0.47 && x > 0.36) return true;
  if (y > 0.6) return true;
  const radius = gownRadius(y);
  if (Math.abs(dx) <= radius && z < 0.18) return false;
  // Forearms, hands, staff, and wheat sit ahead of the ribs.
  if (y > -0.12 && y < 0.46 && z < -0.16 && Math.abs(dx) < 0.52) return false;
  // Upper arms lie against the gown.
  if (y > 0.05 && y < 0.46 && z < -0.02 && Math.abs(dx) < radius + 0.1) return false;
  return true;
}

function takeTriangles(src, keep) {
  const pos = src.attributes.position;
  const nrm = src.attributes.normal;
  const index = src.index;
  if (!index) return null;
  const kept = [];
  for (let t = 0, n = index.count; t < n; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const y = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    if (keep(x, y, z)) kept.push(a, b, c);
  }
  if (kept.length === 0) return null;
  const map = new Map();
  const positions = [];
  const normals = [];
  const out = [];
  for (const vi of kept) {
    let ni = map.get(vi);
    if (ni === undefined) {
      ni = positions.length / 3;
      map.set(vi, ni);
      positions.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
      if (nrm) normals.push(nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi));
    }
    out.push(ni);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (nrm) geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else geo.computeVertexNormals();
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const vi = i / 3;
    uvs[vi * 2] = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
    uvs[vi * 2 + 1] = y * 0.4 + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(out);
  // Full-span flag forces the marble shader onto the figure, not the GLB atlas.
  geo.userData.marbleUvSpan = 1;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function disposeMaterialTextures(material) {
  if (!material) return;
  for (const key of TEXTURE_KEYS) {
    if (material[key]) material[key].dispose();
  }
  material.dispose();
}

function releaseGltf(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = obj.material == null ? [] : Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of mats) disposeMaterialTextures(material);
  });
}

export function createAngel(marble) {
  const group = new THREE.Group();
  group.name = 'angel';

  const surface = marble.body.clone();
  surface.side = THREE.DoubleSide;
  surface.name = 'VirgoMarble';

  let disposed = false;
  let ready = false;
  let formBlend = 0;
  let gltfRoot = null;
  const ownedGeometries = [];
  const nodes = {};
  let wingList = [];

  const scratchP = [v3(), v3(), v3(), v3()];
  const scratchH = [v3(), v3(), v3()];
  const invGroup = new THREE.Matrix4();
  const boneM = new THREE.Matrix4();
  const origin = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const hint = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const stack = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scaleV = new THREE.Vector3(1, 1, 1);
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let calmMotion = 1;

  function bone(name, position) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(position[0], position[1], position[2]);
    group.add(g);
    nodes[name] = g;
    return g;
  }

  // Bones live in group space, where +X is the viewer's right and -Z is
  // behind the figure. Feather curves grow along their own side's X, so the
  // joint is placed on that side rather than on the mesh's pre-turn X.
  function wingAnchor(side, localY, localZ, scale, modelY) {
    return [side * 0.16 * scale, modelY + localY * scale, -localZ * scale];
  }

  function buildFigure(gltf) {
    gltfRoot = gltf.scene;
    let source = null;
    gltf.scene.traverse((obj) => {
      if (!source && obj.isMesh) source = obj;
    });
    if (!source || !source.geometry) {
      console.error('Virgo model has no mesh');
      return;
    }

    const bodyGeo = takeTriangles(source.geometry, (x, y, z) => !isWing(x, y, z));
    if (!bodyGeo) {
      console.error('Virgo body mesh is empty after the wing cut');
      return;
    }
    ownedGeometries.push(bodyGeo);

    const box = bodyGeo.boundingBox;
    const height = Math.max(0.2, box.max.y - box.min.y);
    const scale = TARGET_BODY_HEIGHT / height;
    const modelY = HEM_Y - box.min.y * scale;

    const model = new THREE.Group();
    model.name = 'figure';
    model.scale.setScalar(scale);
    model.position.y = modelY;
    // The sculpt faces -Z. The camera sits on +Z.
    model.rotation.y = Math.PI;
    group.add(model);

    const body = new THREE.Mesh(bodyGeo, surface);
    body.name = 'body';
    body.castShadow = false;
    body.receiveShadow = false;
    body.layers.enable(1);
    model.add(body);

    const span = box.max.y - box.min.y;
    const shoulder = box.min.y + span * 0.76;
    const mid = box.min.y + span * 0.64;
    const low = box.min.y + span * 0.44;
    const back = box.max.z + BACK_PAD;

    bone('wingUL', wingAnchor(1, shoulder, back, scale, modelY));
    bone('wingUR', wingAnchor(-1, shoulder, back, scale, modelY));
    bone('wingML', wingAnchor(1, mid, back, scale, modelY));
    bone('wingMR', wingAnchor(-1, mid, back, scale, modelY));
    bone('wingLL', wingAnchor(1, low, back + 0.03, scale, modelY));
    bone('wingLR', wingAnchor(-1, low, back + 0.03, scale, modelY));

    const light = preferLight();
    const specs = makeWingSpecs(light);
    const rand = mulberry32(0xa11e);
    const recipes = buildRecipes(specs, rand);
    const featherGeo = createFeatherGeometry();
    ownedGeometries.push(featherGeo);
    wingList = specs.map((spec, index) => {
      const count = recipes[index].length;
      const mesh = new THREE.InstancedMesh(featherGeo, marble.wing, count);
      mesh.name = spec.name;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.contact = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const lift = 0.9 + (1 - recipes[index][i].layerF) * 0.1;
        color.setRGB(lift, lift, Math.min(1, lift + 0.01));
        mesh.setColorAt(i, color);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
      return { spec, mesh, recipes: recipes[index] };
    });

    ready = true;
    group.updateMatrixWorld(true);
  }

  const loader = new GLTFLoader();
  loader.load(
    modelUrl(),
    (gltf) => {
      if (disposed) {
        releaseGltf(gltf.scene);
        return;
      }
      try {
        buildFigure(gltf);
      } catch (error) {
        console.error(error);
      }
    },
    undefined,
    (error) => {
      console.error(error);
    },
  );

  function applyLife(time, blend) {
    const swayAmp = (1 - blend * 0.62) * calmMotion;
    const wingMotion = {
      wingUL: [Math.sin(time * 0.7 + 0.4) * 0.045, 0, Math.sin(time * 0.62 + 1.1) * 0.07],
      wingUR: [Math.sin(time * 0.7 + 0.4) * 0.045, 0, -Math.sin(time * 0.62 + 1.1) * 0.07],
      wingML: [Math.sin(time * 0.52 + 0.6) * 0.04, 0, Math.sin(time * 0.58) * 0.09],
      wingMR: [Math.sin(time * 0.52 + 0.6) * 0.04, 0, -Math.sin(time * 0.58) * 0.09],
      wingLL: [Math.sin(time * 0.46 + 1.4) * 0.06, 0, Math.sin(time * 0.4 + 0.8) * 0.05],
      wingLR: [Math.sin(time * 0.46 + 1.4) * 0.06, 0, -Math.sin(time * 0.4 + 0.8) * 0.05],
    };
    for (const name of Object.keys(wingMotion)) {
      const node = nodes[name];
      if (!node) continue;
      const [x, y, z] = wingMotion[name];
      node.rotation.set(x * swayAmp, y * swayAmp, z * swayAmp);
    }
  }

  function updateFeathers(time, blend) {
    invGroup.copy(group.matrixWorld).invert();
    const breathLift = Math.sin(time * 1.45);
    for (const wing of wingList) {
      const spec = wing.spec;
      const node = nodes[spec.bone];
      if (!node) continue;
      boneM.multiplyMatrices(invGroup, node.matrixWorld);
      lerpPose(scratchP, scratchH, spec.open, spec.closed, blend);
      const open = spec.open;
      const closed = spec.closed;
      const outW = THREE.MathUtils.lerp(open.out, closed.out, blend);
      const lenMul = THREE.MathUtils.lerp(open.lenMul, closed.lenMul, blend) * (spec.lenBias || 1);
      const widthMul = THREE.MathUtils.lerp(open.width, closed.width, blend);
      const fan0 = THREE.MathUtils.lerp(open.fan0, closed.fan0, blend);
      const fan1 = THREE.MathUtils.lerp(open.fan1, closed.fan1, blend);

      wing.recipes.forEach((recipe, index) => {
        const t = recipe.t;
        cubicInto(origin, scratchP[0], scratchP[1], scratchP[2], scratchP[3], t);
        cubicTangentInto(tangent, scratchP[0], scratchP[1], scratchP[2], scratchP[3], t);
        sampleHint(hint, scratchH, t);
        origin.applyMatrix4(boneM);
        tangent.transformDirection(boneM);
        hint.transformDirection(boneM);

        const fan = THREE.MathUtils.lerp(fan0, fan1, t);
        let ang = recipe.rowF * fan + (recipe.layerF - 0.5) * fan * 0.35 + (recipe.seed - 0.5) * 0.06;
        if (spec.kind === 'middle' && t > 0.72) ang += recipe.rowF * (t - 0.72) * 0.55;
        if (spec.kind === 'lower') ang *= 1 - t * 0.35;
        dir.copy(hint).lerp(tangent, 1 - outW).normalize();
        _q.setFromAxisAngle(tangent, ang);
        dir.applyQuaternion(_q);

        stack.crossVectors(tangent, dir);
        if (stack.lengthSq() < 1e-8) stack.set(0, 0, 1);
        stack.normalize();
        if (stack.z < 0) stack.negate();

        const flap =
          (Math.sin(time * 2.4 - t * 4.2 + recipe.seed * 7.5) * 0.65 +
            Math.sin(time * 0.7 - t * 1.6 + recipe.alt * 4) * 0.35) *
          spec.flutter *
          1.35 *
          (0.35 + t) *
          (recipe.layerF < 0.34 ? 1.15 : 0.75) *
          (1 - blend * 0.5) *
          calmMotion;
        _q2.setFromAxisAngle(stack, flap);
        dir.applyQuaternion(_q2).normalize();

        const scallop = recipe.layerF < 0.34 && recipe.seed > 0.62 ? 1.2 : 1;
        const len =
          featherEnvelope(spec.kind, t, recipe.rowF, recipe.layerF) *
          lenMul *
          (0.84 + recipe.seed * 0.3) *
          scallop;
        const lift = (recipe.layerF - 0.5) * 0.05 + (recipe.alt - 0.5) * 0.012;
        origin.addScaledVector(stack, lift);
        origin.y += breathLift * 0.004 * (1 - blend);
        origin.addScaledVector(dir, 0.01 + recipe.layerF * 0.006);

        basisQuat(quat, dir, stack);
        _q.setFromAxisAngle(dir, (recipe.alt - 0.5) * 0.35);
        quat.multiply(_q);
        scaleV.set(widthMul * (0.82 + recipe.seed * 0.36) * (1 - recipe.layerF * 0.18), Math.max(0.05, len), 1);
        _m.compose(origin, quat, scaleV);
        wing.mesh.setMatrixAt(index, _m);
      });
      wing.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    group,
    update(time) {
      if (disposed || !ready) return;
      if (!Number.isFinite(formBlend)) formBlend = 0;
      const t = Number.isFinite(time) ? time : 0;
      const reduce = motionQuery && motionQuery.matches ? 0.2 : 1;
      calmMotion = reduce;
      const motion = (1 - formBlend * 0.7) * reduce;
      group.position.y = Math.sin(t * 0.62) * 0.06 * motion;
      group.position.x = Math.sin(t * 0.23) * 0.02 * motion;
      group.rotation.z = Math.sin(t * 0.31) * 0.012 * motion;
      group.rotation.y = Math.sin(t * 0.17) * 0.03 * motion;
      applyLife(t, formBlend);
      group.updateMatrixWorld(true);
      updateFeathers(t, formBlend);
    },
    setForm(form, blend) {
      const raw = blend === undefined || blend === null ? 1 : Number(blend);
      if (!Number.isFinite(raw)) return;
      const k = THREE.MathUtils.clamp(raw, 0, 1);
      if (form === 'still') formBlend = k;
      else if (form === 'radiant') formBlend = 1 - k;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ready = false;
      for (const wing of wingList) {
        if (wing.mesh) wing.mesh.dispose();
      }
      wingList = [];
      for (const geometry of ownedGeometries) geometry.dispose();
      ownedGeometries.length = 0;
      surface.dispose();
      releaseGltf(gltfRoot);
      gltfRoot = null;
      group.removeFromParent();
    },
  };
}
