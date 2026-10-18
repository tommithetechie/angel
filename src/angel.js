import * as THREE from 'three';

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
const _e = new THREE.Euler(0, 0, 0, 'XYZ');
const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(0, 0, 1);

function quatEuler(x, y, z) {
  _e.set(x, y, z, 'XYZ');
  return new THREE.Quaternion().setFromEuler(_e);
}

function quatAimDown(dir, twist = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  if (twist) q.premultiply(new THREE.Quaternion().setFromAxisAngle(dir.clone().normalize(), twist));
  return q;
}

// Local -Y aligns with `dir`. Local +Z stays as close as possible to `upHint`.
function quatAimDownWithUp(dir, upHint) {
  const y = dir.clone().normalize().negate();
  const z = upHint.clone();
  z.addScaledVector(y, -z.dot(y));
  if (z.lengthSq() < 1e-8) z.crossVectors(y, new THREE.Vector3(1, 0, 0));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  z.crossVectors(x, y).normalize();
  const basis = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

function solveTwoBone(origin, target, lenA, lenB, bendHint) {
  const to = target.clone().sub(origin);
  const reach = to.length();
  const max = lenA + lenB - 1e-4;
  const min = Math.abs(lenA - lenB) + 1e-4;
  const dist = THREE.MathUtils.clamp(reach, min, max);
  const handN = to.multiplyScalar(1 / Math.max(reach, 1e-6));
  const cosA = THREE.MathUtils.clamp((lenA * lenA + dist * dist - lenB * lenB) / (2 * lenA * dist), -1, 1);
  const along = cosA * lenA;
  const height = Math.sqrt(Math.max(0, lenA * lenA - along * along));
  const perp = bendHint.clone().addScaledVector(handN, -bendHint.dot(handN));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1);
  perp.normalize();
  const dirA = handN.clone().multiplyScalar(along).addScaledVector(perp, height).normalize();
  const joint = origin.clone().addScaledVector(dirA, lenA);
  const dirB = target.clone().sub(joint);
  if (dirB.lengthSq() < 1e-8) dirB.copy(dirA);
  dirB.normalize();
  return { dirA, dirB };
}

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

function ensureOutward(geo) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  let dot = 0;
  const step = Math.max(1, Math.floor(pos.count / 48));
  for (let i = 0; i < pos.count; i += step) {
    dot += pos.getX(i) * nor.getX(i) + pos.getZ(i) * nor.getZ(i);
  }
  if (dot < 0) {
    const idx = geo.index;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      idx.setX(i, idx.getX(i + 1));
      idx.setX(i + 1, a);
    }
    geo.computeVertexNormals();
  }
  return geo;
}

function lathe(profile, segments, displace) {
  const pts = profile.map(([y, r]) => new THREE.Vector2(Math.max(r, 0.001), y));
  const geo = new THREE.LatheGeometry(pts, segments);
  if (displace) {
    const pos = geo.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      vertex.fromBufferAttribute(pos, i);
      displace(vertex);
      pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
  }
  return ensureOutward(geo);
}

function radialDisplace(vertex, radiusFn) {
  const theta = Math.atan2(vertex.x, vertex.z);
  const r = Math.hypot(vertex.x, vertex.z);
  const next = Math.max(0.004, radiusFn(theta, vertex.y, r));
  const scale = r > 1e-5 ? next / r : 1;
  vertex.x *= scale;
  vertex.z *= scale;
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

function bodyDisplace(vertex) {
  radialDisplace(vertex, (theta, y) => {
    const profile = [
      [-0.22, 0.048],
      [-0.14, 0.078],
      [-0.06, 0.1],
      [0.02, 0.116],
      [0.1, 0.12],
      [0.16, 0.092],
      [0.22, 0.074],
      [0.3, 0.086],
      [0.38, 0.1],
      [0.46, 0.108],
      [0.54, 0.1],
      [0.62, 0.086],
      [0.7, 0.058],
      [0.78, 0.042],
    ];
    let r = profile[0][1];
    for (let i = 0; i < profile.length - 1; i++) {
      const [y0, r0] = profile[i];
      const [y1, r1] = profile[i + 1];
      if (y >= y0 && y <= y1) {
        const f = (y - y0) / (y1 - y0);
        r = r0 + (r1 - r0) * f;
        break;
      }
      if (y > y1) r = r1;
    }

    const front = Math.max(0, Math.cos(theta));
    const rear = Math.max(0, -Math.cos(theta));
    const side = Math.abs(Math.sin(theta));

    for (const s of [1, -1]) {
      const dy = (y - 0.5) / 0.1;
      const dt = (theta - s * 0.48) / 0.36;
      const d2 = dy * dy + dt * dt;
      if (d2 < 1) {
        const k = Math.cos(Math.sqrt(d2) * Math.PI * 0.5);
        r += 0.05 * k * k;
      }
    }

    const shoulder = Math.exp(-((y - 0.64) ** 2) / (2 * 0.05 * 0.05));
    r += 0.058 * shoulder * Math.pow(side, 0.55);
    const glute = Math.exp(-((y - 0.0) ** 2) / (2 * 0.065 * 0.065));
    r += 0.04 * glute * rear * (0.5 + 0.5 * side);
    const hip = Math.exp(-((y - 0.06) ** 2) / (2 * 0.055 * 0.055));
    r += 0.018 * hip * side;
    const scapula = Math.exp(-((y - 0.58) ** 2) / (2 * 0.045 * 0.045));
    r += 0.014 * scapula * rear;
    const clav = Math.exp(-((y - 0.69) ** 2) / (2 * 0.018 * 0.018));
    const clavSide = Math.exp(-((Math.abs(theta) - 0.65) ** 2) / (2 * 0.22 * 0.22));
    r += 0.01 * clav * clavSide * front;
    const navel = Math.exp(-((y - 0.3) ** 2) / (2 * 0.012 * 0.012) - (theta * theta) / (2 * 0.045 * 0.045));
    r -= 0.011 * navel;
    const sternum = Math.exp(-((y - 0.52) ** 2) / (2 * 0.055 * 0.055) - (theta * theta) / (2 * 0.05 * 0.05));
    r -= 0.012 * sternum;

    return r;
  });

  const y = vertex.y;
  vertex.z += 0.02 * Math.exp(-((y - 0.5) ** 2) / (2 * 0.11 * 0.11));
  vertex.z -= 0.014 * Math.exp(-((y - 0.2) ** 2) / (2 * 0.07 * 0.07));
  vertex.z -= 0.01 * Math.exp(-((y - 0.0) ** 2) / (2 * 0.06 * 0.06));
}

function limbGeometry(profile, length, kind) {
  const shaped = profile.map(([t, r]) => [t * length, r]);
  const geo = lathe(shaped, kind === 'thigh' ? 28 : 22, (vertex) => {
    const t = THREE.MathUtils.clamp(vertex.y / length, 0, 1);
    radialDisplace(vertex, (th, _y, r) => {
      let R = r;
      if (kind === 'thigh') {
        const inner = Math.max(0, -Math.cos(th));
        R -= 0.008 * inner * Math.sin(Math.PI * t);
        const quad = Math.exp(-((t - 0.35) ** 2) / 0.04) * Math.max(0, Math.cos(th));
        R += 0.008 * quad;
      } else if (kind === 'shin') {
        const calf = Math.exp(-((t - 0.28) ** 2) / 0.02) * Math.max(0, -Math.cos(th));
        R += 0.01 * calf;
      } else if (kind === 'upper') {
        const biceps = Math.exp(-((t - 0.4) ** 2) / 0.03) * Math.max(0, Math.cos(th));
        R += 0.006 * biceps;
      }
      return R;
    });
  });
  geo.rotateX(Math.PI);
  geo.computeVertexNormals();
  return geo;
}

function footGeometry() {
  const geo = lathe(
    [
      [0, 0.022],
      [0.035, 0.028],
      [0.08, 0.02],
      [0.13, 0.012],
      [0.175, 0.0035],
    ],
    16,
    (vertex) => {
      radialDisplace(vertex, (_th, y, r) => r * (1 + 0.15 * Math.exp(-((y - 0.05) ** 2) / 0.002)));
      vertex.z += 0.01 * smoothstep(0.02, 0.12, vertex.y);
    },
  );
  geo.rotateX(Math.PI);
  geo.computeVertexNormals();
  return geo;
}

function sculptHead(geo) {
  const pos = geo.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    vertex.fromBufferAttribute(pos, i);
    vertex.x *= 0.9;
    vertex.y *= 1.08;
    vertex.z *= 0.96;
    const lower = smoothstep(0.02, -0.55, vertex.y);
    vertex.x *= 1 - 0.18 * lower;
    vertex.z *= 1 - 0.06 * lower;
    if (vertex.y < -0.15 && vertex.z > 0) {
      const chin = smoothstep(-0.15, -0.62, vertex.y) * smoothstep(0.0, 0.35, vertex.z);
      const narrow = Math.exp(-(vertex.x * vertex.x) / 0.02);
      vertex.y -= 0.045 * chin * narrow;
      vertex.z += 0.02 * chin * narrow;
    }
    const nose = Math.exp(-(vertex.x * vertex.x) / 0.008 - ((vertex.y - 0.01) ** 2) / 0.012);
    if (vertex.z > 0) vertex.z += 0.055 * nose;
    pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function stampUv(mesh) {
  mesh.updateWorldMatrix(true, false);
  const pos = mesh.geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    vertex.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    uv[i * 2] = Math.atan2(vertex.x, vertex.z) / (Math.PI * 2) + 0.5;
    uv[i * 2 + 1] = vertex.y * 0.36 + 0.12;
  }
  mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

function attach(parent, geo, material, position, name) {
  let geometry = geo;
  if (geo.userData.template) {
    geometry = geo.clone();
    geometry.userData = { ...geo.userData, template: false };
  }
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  mesh.name = name;
  mesh.castShadow = false;
  parent.add(mesh);
  return mesh;
}

function bone(parent, name, position) {
  const g = new THREE.Group();
  g.name = name;
  if (position) g.position.set(position[0], position[1], position[2]);
  parent.add(g);
  return g;
}

function poseOf(position, euler) {
  return {
    p: v3(position[0], position[1], position[2]),
    q: euler instanceof THREE.Quaternion ? euler.clone() : quatEuler(euler[0], euler[1], euler[2]),
  };
}

const THIGH = 0.45;
const SHIN = 0.44;
const UPPER = 0.38;
const FORE = 0.34;

const THIGH_GEO = limbGeometry(
  [
    [0, 0.078],
    [0.12, 0.08],
    [0.4, 0.06],
    [0.75, 0.05],
    [1, 0.042],
  ],
  THIGH,
  'thigh',
);
const SHIN_GEO = limbGeometry(
  [
    [0, 0.042],
    [0.18, 0.05],
    [0.4, 0.038],
    [0.78, 0.026],
    [1, 0.02],
  ],
  SHIN,
  'shin',
);
const UPPER_GEO = limbGeometry(
  [
    [0, 0.046],
    [0.2, 0.044],
    [0.6, 0.036],
    [1, 0.03],
  ],
  UPPER,
  'upper',
);
const FORE_GEO = limbGeometry(
  [
    [0, 0.03],
    [0.25, 0.028],
    [0.7, 0.022],
    [1, 0.017],
  ],
  FORE,
  'fore',
);
const FOOT_GEO = footGeometry();

for (const geo of [THIGH_GEO, SHIN_GEO, UPPER_GEO, FORE_GEO, FOOT_GEO]) {
  geo.userData.template = true;
}

// Phones and narrow windows get fewer feather instances. A wide desktop,
// including a portrait preview, keeps the full wing.
function preferLight() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const narrow = window.matchMedia('(max-width: 760px), (max-height: 520px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return narrow || (coarse && window.matchMedia('(max-width: 1100px)').matches);
}

function featherEnvelope(kind, t, rowF, layerF) {
  const layer = THREE.MathUtils.lerp(1, 0.32, Math.pow(layerF, 0.85));
  if (kind === 'upper') {
    const arch = Math.sin(Math.PI * Math.pow(Math.max(t, 0.001), 0.72));
    const point = 1 - 0.62 * smoothstep(0.78, 1, t);
    const base = (0.42 + 0.82 * arch) * point;
    const row = THREE.MathUtils.lerp(0.72, 1, 1 - Math.abs(rowF) * 0.28);
    return base * row * layer;
  }
  if (kind === 'middle') {
    const base = THREE.MathUtils.lerp(0.58, 0.92, Math.pow(t, 0.42));
    const row = THREE.MathUtils.lerp(0.46, 1, smoothstep(-0.15, 1, rowF));
    const primary = t > 0.74 ? THREE.MathUtils.lerp(0.5, 1.05, smoothstep(0.15, 1, rowF) * (layerF < 0.45 ? 1 : 0.4)) : 1;
    return base * row * layer * primary;
  }
  const belly = Math.sin(Math.PI * Math.pow(Math.max(t, 0.001), 0.55));
  const taper = THREE.MathUtils.lerp(1, 0.2, Math.pow(t, 1.55));
  const base = THREE.MathUtils.lerp(0.48, 1.2, Math.pow(belly, 0.42)) * taper;
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
        points: [v3(0, 0, 0), v3(0.24 * s, 0.12, -0.06), v3(0.14 * s, 0.38, -0.01), v3(0.015 * s, 0.58, 0.04)],
        hints: [v3(0.16 * s, 0.92, 0.1), v3(0.06 * s, 0.98, 0.05), v3(0.0, 1, 0.02)],
        fan0: 0.48,
        fan1: 0.18,
        out: 0.84,
        lenMul: 0.78,
        width: 1.18,
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
        points: [v3(0, 0, 0), v3(0.24 * s, -0.02, -0.04), v3(0.5 * s, 0.04, 0.0), v3(0.66 * s, 0.1, 0.03)],
        hints: [v3(0.64 * s, -0.5, 0.06), v3(0.9 * s, -0.12, 0.04), v3(0.97 * s, 0.06, 0.02)],
        fan0: 1.25,
        fan1: 0.5,
        out: 0.92,
        lenMul: 0.8,
        width: 1.05,
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
        points: [v3(0, 0, 0), v3(0.32 * s, -0.32, -0.03), v3(0.2 * s, -1.05, 0.02), v3(0.05 * s, -2.08, 0.04)],
        hints: [v3(0.8 * s, -0.32, 0.04), v3(0.2 * s, -0.94, 0.02), v3(0.04 * s, -1, 0.0)],
        fan0: 1.08,
        fan1: 0.32,
        out: 0.88,
        lenMul: 1.08,
        width: 1.18,
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

function writeRibbon(geo, points, width, upHint, vertexOffset = 0, curve) {
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return false;
  }
  let span = 0;
  for (let i = 1; i < points.length; i++) span += points[i].distanceTo(points[i - 1]);
  if (span < 1e-4) return false;

  if (!curve) curve = new THREE.CatmullRomCurve3(points);
  else {
    for (let i = 0; i < points.length; i++) curve.points[i].copy(points[i]);
    curve.needsUpdate = true;
  }

  const steps = geo.userData.steps;
  const pos = geo.attributes.position;
  const up = upHint || _up;
  let k = vertexOffset;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPointAt(t);
    const tang = curve.getTangentAt(t);
    _x.crossVectors(tang, up);
    if (_x.lengthSq() < 1e-6) _x.crossVectors(tang, _fwd);
    _x.normalize();
    const w = width * Math.pow(1 - t, 0.62);
    pos.setXYZ(k++, p.x + _x.x * w, p.y + _x.y * w, p.z + _x.z * w);
    pos.setXYZ(k++, p.x - _x.x * w, p.y - _x.y * w, p.z - _x.z * w);
  }
  pos.needsUpdate = true;
  return true;
}

function createHair(material) {
  const steps = 14;
  const stride = (steps + 1) * 2;
  const positions = new Float32Array(HAIR.length * stride * 3);
  const uvs = new Float32Array(HAIR.length * stride * 2);
  const indices = [];
  const strands = HAIR.map((spec, index) => {
    const base = spec.pts.map((p) => v3(p[0], p[1], p[2]));
    const vertex = index * stride;
    for (let i = 0; i <= steps; i++) {
      const o = (vertex + i * 2) * 2;
      uvs[o] = 0;
      uvs[o + 1] = i / steps;
      uvs[o + 2] = 1;
      uvs[o + 3] = i / steps;
      if (i < steps) {
        const a = vertex + i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    return {
      base,
      width: spec.w,
      up: v3(spec.up[0], spec.up[1], spec.up[2]),
      vertex,
      scratch: base.map(() => new THREE.Vector3()),
      curve: new THREE.CatmullRomCurve3(base.map((p) => p.clone())),
    };
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.userData.steps = steps;
  for (const strand of strands) {
    writeRibbon(geo, strand.base, strand.width, strand.up, strand.vertex, strand.curve);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'hairMesh';
  mesh.frustumCulled = false;
  return { mesh, strands };
}

const HAIR = [
  { w: 0.072, up: [0, 1, 0], pts: [[0.05, 0.1, 0.12], [-0.04, 0.02, 0.18], [-0.16, -0.08, 0.14], [-0.3, -0.16, 0.04]] },
  { w: 0.064, up: [0, 1, 0], pts: [[0.1, 0.06, 0.1], [0.0, -0.02, 0.17], [-0.14, -0.12, 0.13], [-0.28, -0.22, 0.03]] },
  { w: 0.058, up: [0, 0, 1], pts: [[-0.02, 0.12, 0.1], [-0.12, 0.02, 0.17], [-0.24, -0.1, 0.1], [-0.36, -0.2, 0.0]] },
  { w: 0.05, up: [0, 1, 0], pts: [[0.02, 0.14, 0.06], [-0.08, 0.08, 0.14], [-0.2, -0.02, 0.12], [-0.32, -0.12, 0.04]] },
  { w: 0.046, up: [0, 1, 0], pts: [[0.08, 0.12, 0.04], [-0.02, 0.06, 0.15], [-0.16, -0.06, 0.12], [-0.28, -0.18, 0.02]] },
  { w: 0.042, up: [1, 0, 0], pts: [[-0.06, 0.04, 0.14], [-0.16, -0.08, 0.12], [-0.26, -0.22, 0.04], [-0.32, -0.4, -0.02]] },
  { w: 0.038, up: [1, 0, 0], pts: [[0.0, 0.0, 0.16], [-0.12, -0.12, 0.12], [-0.22, -0.28, 0.04], [-0.28, -0.46, -0.04]] },
  { w: 0.044, up: [0, 0, 1], pts: [[0.12, 0.08, 0.06], [0.04, -0.02, 0.14], [-0.1, -0.14, 0.1], [-0.22, -0.28, 0.02]] },
  { w: 0.036, up: [0, 1, 0], pts: [[0.0, 0.16, 0.02], [-0.1, 0.14, 0.1], [-0.22, 0.04, 0.12], [-0.32, -0.06, 0.04]] },
  { w: 0.034, up: [0, 1, 0], pts: [[0.06, 0.16, -0.02], [-0.06, 0.16, 0.06], [-0.18, 0.08, 0.1], [-0.28, -0.02, 0.04]] },
  { w: 0.04, up: [0, 1, 0], pts: [[-0.08, 0.12, 0.02], [-0.16, 0.04, 0.08], [-0.26, -0.1, 0.04], [-0.34, -0.24, -0.02]] },
  { w: 0.032, up: [0, 0, 1], pts: [[-0.1, 0.08, -0.04], [-0.18, -0.04, 0.02], [-0.26, -0.18, 0.0], [-0.3, -0.34, -0.04]] },
  { w: 0.036, up: [0, 1, 0], pts: [[0.04, 0.13, -0.08], [-0.06, 0.04, -0.1], [-0.14, -0.12, -0.06], [-0.18, -0.32, -0.02]] },
  { w: 0.028, up: [0, 1, 0], pts: [[0.1, 0.1, -0.02], [0.12, -0.02, 0.02], [0.04, -0.16, 0.04], [-0.08, -0.3, 0.0]] },
  { w: 0.03, up: [0, 0, 1], pts: [[-0.02, 0.15, 0.08], [-0.12, 0.18, 0.12], [-0.22, 0.1, 0.14], [-0.3, 0.0, 0.06]] },
  { w: 0.026, up: [1, 0, 0], pts: [[0.02, -0.02, 0.15], [-0.08, -0.16, 0.1], [-0.16, -0.32, 0.02], [-0.2, -0.48, -0.04]] },
];

function createFigure(material, hairMat, jointMat) {
  const hips = new THREE.Group();
  hips.name = 'hips';

  const realBody = lathe(
    [
      [-0.22, 0.048],
      [-0.14, 0.078],
      [-0.06, 0.1],
      [0.02, 0.116],
      [0.1, 0.12],
      [0.16, 0.092],
      [0.22, 0.074],
      [0.3, 0.086],
      [0.38, 0.1],
      [0.46, 0.108],
      [0.54, 0.1],
      [0.62, 0.086],
      [0.7, 0.058],
      [0.78, 0.042],
    ],
    72,
    bodyDisplace,
  );
  const bodyMesh = attach(hips, realBody, material, null, 'body');

  const neck = bone(hips, 'neck', [0, 0.74, 0.012]);
  const neckGeo = lathe(
    [
      [0, 0.04],
      [0.045, 0.036],
      [0.1, 0.038],
      [0.14, 0.044],
    ],
    28,
  );
  const neckMesh = attach(neck, neckGeo, jointMat, null, 'neck');

  const head = bone(neck, 'head', [0, 0.145, 0.01]);
  const headGeo = sculptHead(new THREE.SphereGeometry(0.145, 40, 28));
  const headMesh = attach(head, headGeo, material, null, 'head');

  const scalpGeo = new THREE.SphereGeometry(0.15, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62);
  scalpGeo.scale(0.96, 0.82, 1.02);
  scalpGeo.translate(0, 0.045, -0.03);
  scalpGeo.computeVertexNormals();
  const scalp = attach(head, scalpGeo, hairMat, null, 'scalp');

  const hair = new THREE.Group();
  hair.name = 'hair';
  head.add(hair);
  const builtHair = createHair(hairMat);
  hair.add(builtHair.mesh);
  const strands = builtHair.strands;

  const shoulderGeo = new THREE.SphereGeometry(0.052, 18, 14);
  const elbowGeo = new THREE.SphereGeometry(0.032, 14, 12);
  const kneeGeo = new THREE.SphereGeometry(0.046, 16, 12);
  const ankleGeo = new THREE.SphereGeometry(0.024, 12, 10);
  const palmGeo = new THREE.SphereGeometry(0.034, 16, 12);
  palmGeo.scale(1.05, 1.25, 0.48);
  for (const geo of [shoulderGeo, elbowGeo, kneeGeo, ankleGeo, palmGeo]) {
    geo.userData.template = true;
  }

  const fingers = [];
  const arms = {};

  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    const upper = bone(hips, `upper${tag}`, [0.2 * side, 0.63, 0.03]);
    attach(upper, UPPER_GEO, material, null, `upper${tag}`);
    attach(upper, shoulderGeo, jointMat, [0, 0.01, 0], `shoulder${tag}`);
    const fore = bone(upper, `fore${tag}`, [0, -UPPER, 0]);
    attach(fore, FORE_GEO, material, null, `fore${tag}`);
    attach(fore, elbowGeo, jointMat, [0, 0.01, 0], `elbow${tag}`);
    const hand = bone(fore, `hand${tag}`, [0, -FORE, 0]);
    const palm = attach(hand, palmGeo, material, [0, -0.04, 0], `palm${tag}`);
    palm.scale.set(side > 0 ? 1 : 1, 1, 1);

    const fingerSpecs = [
      { x: -0.02, z: 0.008, len: 0.078, r: 0.0082, curlR: 0.2, curlS: 0.12 },
      { x: -0.006, z: 0.011, len: 0.09, r: 0.0086, curlR: 0.16, curlS: 0.1 },
      { x: 0.009, z: 0.009, len: 0.082, r: 0.008, curlR: 0.18, curlS: 0.12 },
      { x: 0.022, z: 0.005, len: 0.066, r: 0.007, curlR: 0.24, curlS: 0.16 },
    ];
    for (const spec of fingerSpecs) {
      const finger = bone(hand, `finger${tag}`, [spec.x * side, -0.075, spec.z]);
      const capLen = Math.max(0.012, spec.len - spec.r * 2);
      const cap = new THREE.CapsuleGeometry(spec.r, capLen, 3, 6);
      const mesh = attach(finger, cap, material, [0, -spec.len * 0.5, 0], `fingerMesh${tag}`);
      mesh.rotation.order = 'XYZ';
      finger.rotation.order = 'XYZ';
      fingers.push({ bone: finger, curlR: spec.curlR, curlS: spec.curlS });
    }
    const thumb = bone(hand, `thumb${tag}`, [-0.03 * side, -0.028, 0.012]);
    thumb.rotation.order = 'XYZ';
    const thumbGeo = new THREE.CapsuleGeometry(0.009, 0.04, 3, 6);
    attach(thumb, thumbGeo, material, [0, -0.03, 0], `thumbMesh${tag}`);
    fingers.push({
      bone: thumb,
      curlR: 0.32,
      curlS: 0.25,
      z: 0.42 * side,
      stillZ: 0.35 * side,
    });

    arms[tag] = { upper, fore, hand };
  }

  const legs = {};
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    const thigh = bone(hips, `thigh${tag}`, [0.055 * side, -0.02, 0.012]);
    attach(thigh, THIGH_GEO, material, null, `thigh${tag}`);
    const shin = bone(thigh, `shin${tag}`, [0, -THIGH, 0]);
    attach(shin, SHIN_GEO, material, null, `shin${tag}`);
    attach(shin, kneeGeo, jointMat, [0, 0.012, 0.006], `knee${tag}`);
    const foot = bone(shin, `foot${tag}`, [0, -SHIN, 0]);
    attach(foot, FOOT_GEO, material, null, `foot${tag}`);
    attach(foot, ankleGeo, jointMat, [0, 0.008, 0], `ankle${tag}`);
    legs[tag] = { thigh, shin, foot };
  }

  const wingUL = bone(hips, 'wingUL', [0.09, 0.68, -0.15]);
  const wingUR = bone(hips, 'wingUR', [-0.09, 0.68, -0.15]);
  const wingML = bone(hips, 'wingML', [0.18, 0.44, -0.12]);
  const wingMR = bone(hips, 'wingMR', [-0.18, 0.44, -0.12]);
  const wingLL = bone(hips, 'wingLL', [0.11, 0.2, -0.1]);
  const wingLR = bone(hips, 'wingLR', [-0.11, 0.2, -0.1]);

  const nodes = {
    hips,
    neck,
    head,
    upperL: arms.L.upper,
    foreL: arms.L.fore,
    handL: arms.L.hand,
    upperR: arms.R.upper,
    foreR: arms.R.fore,
    handR: arms.R.hand,
    thighL: legs.L.thigh,
    shinL: legs.L.shin,
    footL: legs.L.foot,
    thighR: legs.R.thigh,
    shinR: legs.R.shin,
    footR: legs.R.foot,
    wingUL,
    wingUR,
    wingML,
    wingMR,
    wingLL,
    wingLR,
  };

  return { hips, nodes, bodyMesh, neckMesh, headMesh, scalp, hair, strands, fingers };
}

function stillLimbPoses() {
  const up = v3(0, 1, 0);
  const pose = {};

  const legs = [
    { tag: 'L', side: 1, knee: v3(0.86, -0.06, 0.42), foot: v3(0.02, 0.02, 0.22), toes: v3(-0.15, 0.25, 0.7) },
    { tag: 'R', side: -1, knee: v3(-0.86, -0.08, 0.38), foot: v3(-0.04, -0.06, 0.16), toes: v3(0.15, 0.2, 0.72) },
  ];
  for (const leg of legs) {
    const thighPos = v3(0.06 * leg.side, -0.02, 0.02);
    const kneeDir = leg.knee.clone().normalize();
    const knee = thighPos.clone().addScaledVector(kneeDir, THIGH);
    const shinDir = leg.foot.clone().sub(knee).normalize();
    const thighQ = quatAimDown(kneeDir);
    const shinQ = quatAimDown(shinDir.clone().applyQuaternion(thighQ.clone().invert()));
    const shinWorld = thighQ.clone().multiply(shinQ);
    const footDir = leg.toes.clone().normalize();
    const footQ = quatAimDownWithUp(
      footDir.clone().applyQuaternion(shinWorld.clone().invert()),
      up.clone().applyQuaternion(shinWorld.clone().invert()),
    );
    pose[`thigh${leg.tag}`] = poseOf(thighPos.toArray(), thighQ);
    pose[`shin${leg.tag}`] = poseOf([0, -THIGH, 0], shinQ);
    pose[`foot${leg.tag}`] = poseOf([0, -SHIN, 0], footQ);
  }

  const arms = [
    { tag: 'L', side: 1, hand: v3(0.4, 0.04, 0.28), hint: v3(0.7, -0.1, -0.45) },
    { tag: 'R', side: -1, hand: v3(-0.4, 0.02, 0.28), hint: v3(-0.7, -0.1, -0.45) },
  ];
  for (const arm of arms) {
    const shoulder = v3(0.19 * arm.side, 0.63, 0.03);
    const ik = solveTwoBone(shoulder, arm.hand, UPPER, FORE, arm.hint);
    const upperQ = quatAimDown(ik.dirA);
    const foreQ = quatAimDown(ik.dirB.clone().applyQuaternion(upperQ.clone().invert()));
    const armWorld = upperQ.clone().multiply(foreQ);
    const fingerDir = v3(arm.side * 0.55, -0.2, 0.35).normalize();
    const handQ = quatAimDownWithUp(
      fingerDir.applyQuaternion(armWorld.clone().invert()),
      up.clone().applyQuaternion(armWorld.clone().invert()),
    );
    pose[`upper${arm.tag}`] = poseOf(shoulder.toArray(), upperQ);
    pose[`fore${arm.tag}`] = poseOf([0, -UPPER, 0], foreQ);
    pose[`hand${arm.tag}`] = poseOf([0, -FORE, 0], handQ);
  }
  return pose;
}

function radiantLimbPoses() {
  const up = v3(0, 1, 0);
  const pose = {};
  const legs = [
    { tag: 'L', side: 1, knee: v3(0.045, -1, 0.02), foot: v3(0.07, -0.9, 0.04), toes: v3(0.02, -0.9, 0.4) },
    { tag: 'R', side: -1, knee: v3(-0.035, -1, 0.015), foot: v3(-0.05, -0.9, 0.03), toes: v3(-0.01, -0.9, 0.38) },
  ];
  for (const leg of legs) {
    const thighPos = v3(0.05 * leg.side, -0.02, 0.012);
    const kneeDir = leg.knee.clone().normalize();
    const knee = thighPos.clone().addScaledVector(kneeDir, THIGH);
    const shinDir = leg.foot.clone().sub(knee).normalize();
    const thighQ = quatAimDown(kneeDir);
    const shinQ = quatAimDown(shinDir.clone().applyQuaternion(thighQ.clone().invert()));
    const shinWorld = thighQ.clone().multiply(shinQ);
    const footDir = leg.toes.clone().normalize();
    const footQ = quatAimDownWithUp(
      footDir.clone().applyQuaternion(shinWorld.clone().invert()),
      up.clone().applyQuaternion(shinWorld.clone().invert()),
    );
    pose[`thigh${leg.tag}`] = poseOf(thighPos.toArray(), thighQ);
    pose[`shin${leg.tag}`] = poseOf([0, -THIGH, 0], shinQ);
    pose[`foot${leg.tag}`] = poseOf([0, -SHIN, 0], footQ);
  }

  const arms = [
    { tag: 'L', side: 1, hand: v3(0.34, 0.16, 0.16), hint: v3(0.72, 0.05, -0.38) },
    { tag: 'R', side: -1, hand: v3(-0.32, 0.14, 0.14), hint: v3(-0.68, 0.02, -0.34) },
  ];
  for (const arm of arms) {
    const shoulder = v3(0.2 * arm.side, 0.62, 0.02);
    const ik = solveTwoBone(shoulder, arm.hand, UPPER, FORE, arm.hint);
    const upperQ = quatAimDown(ik.dirA);
    const foreQ = quatAimDown(ik.dirB.clone().applyQuaternion(upperQ.clone().invert()));
    const armWorld = upperQ.clone().multiply(foreQ);
    const fingerDir = v3(arm.side * 0.12, -0.92, 0.22).normalize();
    const handQ = quatAimDownWithUp(
      fingerDir.applyQuaternion(armWorld.clone().invert()),
      up.clone().applyQuaternion(armWorld.clone().invert()),
    );
    pose[`upper${arm.tag}`] = poseOf(shoulder.toArray(), upperQ);
    pose[`fore${arm.tag}`] = poseOf([0, -UPPER, 0], foreQ);
    pose[`hand${arm.tag}`] = poseOf([0, -FORE, 0], handQ);
  }
  return pose;
}

function assignPoses(nodes) {
  const limbs = stillLimbPoses();
  const hanging = radiantLimbPoses();

  const radiant = {
    hips: poseOf([0, 1.32, 0], [0.05, -0.04, 0.012]),
    neck: poseOf([0, 0.74, 0.016], [0.1, -0.14, 0.03]),
    head: poseOf([0, 0.145, 0.008], [0.2, -0.22, 0.06]),
    upperL: hanging.upperL,
    foreL: hanging.foreL,
    handL: hanging.handL,
    upperR: hanging.upperR,
    foreR: hanging.foreR,
    handR: hanging.handR,
    thighL: hanging.thighL,
    shinL: hanging.shinL,
    footL: hanging.footL,
    thighR: hanging.thighR,
    shinR: hanging.shinR,
    footR: hanging.footR,
  };

  const still = {
    hips: poseOf([0, 0.4, 0], [0.02, 0, 0]),
    neck: poseOf([0, 0.74, 0.012], [0.04, 0, 0]),
    head: poseOf([0, 0.145, 0.01], [0.12, 0, 0]),
    upperL: limbs.upperL,
    foreL: limbs.foreL,
    handL: limbs.handL,
    upperR: limbs.upperR,
    foreR: limbs.foreR,
    handR: limbs.handR,
    thighL: limbs.thighL,
    shinL: limbs.shinL,
    footL: limbs.footL,
    thighR: limbs.thighR,
    shinR: limbs.shinR,
    footR: limbs.footR,
  };

  const posed = [
    'hips', 'neck', 'head',
    'upperL', 'foreL', 'handL', 'upperR', 'foreR', 'handR',
    'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
  ];
  for (const name of posed) {
    nodes[name].userData.radiant = radiant[name];
    nodes[name].userData.still = still[name];
  }

  const wings = ['wingUL', 'wingUR', 'wingML', 'wingMR', 'wingLL', 'wingLR'];
  for (const name of wings) {
    const node = nodes[name];
    node.userData.rest = node.position.clone();
    node.userData.radiant = poseOf(node.position.toArray(), [0, 0, 0]);
    node.userData.still = poseOf(node.position.toArray(), [0, 0, 0]);
  }
  return posed.concat(wings);
}

function sampleHint(out, hints, t) {
  if (t < 0.5) return out.copy(hints[0]).lerp(hints[1], t / 0.5);
  return out.copy(hints[1]).lerp(hints[2], (t - 0.5) / 0.5);
}

function lerpPose(outP, outH, a, b, t) {
  for (let i = 0; i < 4; i++) outP[i].copy(a.points[i]).lerp(b.points[i], t);
  for (let i = 0; i < 3; i++) outH[i].copy(a.hints[i]).lerp(b.hints[i], t);
}

/**
 * Seraph sculpt. `setForm('still', t)` settles into a seated meditation
 * with the wings folded in; `setForm('radiant', t)` opens the reference
 * pose. `t` is 0 at the other form and 1 at the named form. If setForm
 * is never called the figure stays radiant.
 */
export function createAngel(marble) {
  const group = new THREE.Group();
  group.name = 'angel';

  const hairMat = marble.body.clone();
  hairMat.side = THREE.DoubleSide;
  hairMat.polygonOffset = true;
  hairMat.polygonOffsetFactor = -1;
  hairMat.polygonOffsetUnits = -2;

  const jointMat = marble.body.clone();
  jointMat.polygonOffset = true;
  jointMat.polygonOffsetFactor = -1;
  jointMat.polygonOffsetUnits = -4;

  const figure = createFigure(marble.body, hairMat, jointMat);
  group.add(figure.hips);

  const light = preferLight();
  const specs = makeWingSpecs(light);
  const rand = mulberry32(0xa11e);
  const recipes = buildRecipes(specs, rand);
  const featherGeo = createFeatherGeometry();
  const wings = specs.map((spec, index) => {
    const count = recipes[index].length;
    const mesh = new THREE.InstancedMesh(featherGeo, marble.wing, count);
    mesh.name = spec.name;
    mesh.frustumCulled = false;
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

  const posedNames = assignPoses(figure.nodes);
  let formBlend = 0;

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
  const scale = new THREE.Vector3(1, 1, 1);
  const hairPoint = new THREE.Vector3();
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let calmMotion = 1;
  let disposed = false;

  function applyPose(blend) {
    for (const name of posedNames) {
      const node = figure.nodes[name];
      const a = node.userData.radiant;
      const b = node.userData.still;
      node.position.lerpVectors(a.p, b.p, blend);
      node.quaternion.copy(a.q).slerp(b.q, blend);
    }
    for (const finger of figure.fingers) {
      const curl = THREE.MathUtils.lerp(finger.curlR, finger.curlS, blend);
      finger.bone.rotation.x = curl;
      if (finger.z !== undefined) {
        finger.bone.rotation.z = THREE.MathUtils.lerp(finger.z, finger.stillZ, blend);
      }
    }
  }

  function applyLife(time, blend) {
    const breath = Math.sin(time * 1.45);
    const calm = 1 - blend * 0.45;
    figure.bodyMesh.scale.set(1 + breath * 0.018, 1, 1 + breath * 0.03 * calm);
    figure.nodes.neck.position.y += breath * 0.01;
    for (const side of ['L', 'R']) {
      figure.nodes[`upper${side}`].position.y += breath * 0.014;
    }
    const swayAmp = (1 - blend * 0.62) * calm * calmMotion;
    const wingMotion = {
      wingUL: [Math.sin(time * 0.7 + 0.4) * 0.045, 0, Math.sin(time * 0.62 + 1.1) * 0.07],
      wingUR: [Math.sin(time * 0.7 + 0.4) * 0.045, 0, -Math.sin(time * 0.62 + 1.1) * 0.07],
      wingML: [Math.sin(time * 0.52 + 0.6) * 0.04, 0, Math.sin(time * 0.58) * 0.09 + breath * 0.028],
      wingMR: [Math.sin(time * 0.52 + 0.6) * 0.04, 0, -(Math.sin(time * 0.58) * 0.09 + breath * 0.028)],
      wingLL: [Math.sin(time * 0.46 + 1.4) * 0.06, 0, Math.sin(time * 0.4 + 0.8) * 0.05],
      wingLR: [Math.sin(time * 0.46 + 1.4) * 0.06, 0, -Math.sin(time * 0.4 + 0.8) * 0.05],
    };
    for (const name of Object.keys(wingMotion)) {
      const [x, y, z] = wingMotion[name];
      figure.nodes[name].rotation.set(x * swayAmp, y * swayAmp, z * swayAmp);
    }
  }

  function updateHair(time, blend, motion) {
    const geo = figure.hair.children[0].geometry;
    figure.strands.forEach((strand, index) => {
      const base = strand.base;
      const current = strand.scratch;
      for (let i = 0; i < base.length; i++) {
        const t = base.length === 1 ? 0 : i / (base.length - 1);
        const settledX = base[i].x * (1 - t * 0.62);
        const settledY = base[i].y - t * 0.2;
        const settledZ = THREE.MathUtils.lerp(base[i].z, -0.1, t * 0.7);
        const flutter = Math.sin(time * 1.15 + index * 0.7 + t * 2.4) * 0.018 * t * (1 - blend * 0.55) * motion;
        const flutter2 = Math.sin(time * 0.45 + index) * 0.012 * t * motion;
        hairPoint.set(
          THREE.MathUtils.lerp(base[i].x, settledX, blend) + flutter,
          THREE.MathUtils.lerp(base[i].y, settledY, blend) + flutter2 * 0.4,
          THREE.MathUtils.lerp(base[i].z, settledZ, blend) + flutter * 0.35,
        );
        current[i].copy(hairPoint);
      }
      writeRibbon(geo, current, strand.width, strand.up, strand.vertex, strand.curve);
    });
    geo.computeVertexNormals();
    const wind = (1 - blend * 0.7) * motion;
    figure.hair.rotation.z = Math.sin(time * 0.7) * 0.025 * wind;
    figure.hair.rotation.x = Math.sin(time * 0.5 + 0.4) * 0.015 * wind;
  }

  function updateFeathers(time, blend) {
    invGroup.copy(group.matrixWorld).invert();
    const breathLift = Math.sin(time * 1.45);
    for (const wing of wings) {
      const spec = wing.spec;
      const node = figure.nodes[spec.bone];
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
        // Separate layers along the wing normal by more than the vane camber,
        // plus a stable per-feather bias so neighbors don't sit on one plane.
        const lift = (recipe.layerF - 0.5) * 0.05 + (recipe.alt - 0.5) * 0.012;
        origin.addScaledVector(stack, lift);
        origin.y += breathLift * 0.004 * (1 - blend);
        origin.addScaledVector(dir, 0.01 + recipe.layerF * 0.006);

        basisQuat(quat, dir, stack);
        _q.setFromAxisAngle(dir, (recipe.alt - 0.5) * 0.35);
        quat.multiply(_q);
        scale.set(widthMul * (0.82 + recipe.seed * 0.36) * (1 - recipe.layerF * 0.18), Math.max(0.05, len), 1);
        _m.compose(origin, quat, scale);
        wing.mesh.setMatrixAt(index, _m);
      });
      wing.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  const bodyMeshes = [];
  figure.hips.traverse((obj) => {
    if (obj.isMesh) bodyMeshes.push(obj);
  });

  applyPose(0);
  group.updateMatrixWorld(true);
  for (const mesh of bodyMeshes) stampUv(mesh);

  return {
    group,
    update(time) {
      if (disposed) return;
      if (!Number.isFinite(formBlend)) formBlend = 0;
      const t = Number.isFinite(time) ? time : 0;
      const reduce = motionQuery && motionQuery.matches ? 0.2 : 1;
      calmMotion = reduce;
      const motion = (1 - formBlend * 0.7) * reduce;
      group.position.y = Math.sin(t * 0.62) * 0.085 * motion;
      group.position.x = Math.sin(t * 0.23) * 0.02 * motion;
      group.rotation.z = Math.sin(t * 0.31) * 0.018 * motion;
      group.rotation.y = Math.sin(t * 0.17) * 0.04 * motion;
      applyPose(formBlend);
      applyLife(t, formBlend);
      updateHair(t, formBlend, reduce);
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
      const geometries = new Set();
      group.traverse((obj) => {
        if (obj.geometry && !obj.geometry.userData.template) geometries.add(obj.geometry);
        if (obj.isInstancedMesh) obj.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      hairMat.dispose();
      jointMat.dispose();
      group.removeFromParent();
    },
  };
}
