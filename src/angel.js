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

function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return p0
    .clone()
    .multiplyScalar(u * u * u)
    .add(p1.clone().multiplyScalar(3 * u * u * t))
    .add(p2.clone().multiplyScalar(3 * u * t * t))
    .add(p3.clone().multiplyScalar(t * t * t));
}

function cubicTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return p1
    .clone()
    .sub(p0)
    .multiplyScalar(3 * u * u)
    .add(p2.clone().sub(p1).multiplyScalar(6 * u * t))
    .add(p3.clone().sub(p2).multiplyScalar(3 * t * t));
}

function createFeatherGeometry() {
  const segments = 8;
  const baseWidth = 0.15;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = t;
    const w = 0.01 + baseWidth * Math.pow(1 - t, 0.55);
    const camber = Math.sin(t * Math.PI) * 0.045;
    const shade = 1;
    const edge = 0.74;
    // Left, raised quill, right. Edge vertices are darker so each blade reads.
    const row = [
      [-w, y, 0, 0, t, edge],
      [0, y, camber, 0.5, t, shade],
      [w, y, 0, 1, t, edge],
    ];
    for (const vert of row) {
      positions.push(vert[0], vert[1], vert[2]);
      uvs.push(vert[3], vert[4]);
      colors.push(vert[5], vert[5], vert[5] + 0.015);
    }
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 3;
    const b = a + 3;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
    indices.push(a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function sculptBody(geo) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > 1.62 && v.y < 1.98 && v.z > 0) {
      const ny = 1 - Math.abs(v.y - 1.8) / 0.18;
      const nx = 1 - Math.min(Math.abs(v.x) / 0.22, 1);
      const k = Math.max(0, ny) * Math.max(0, nx);
      v.z += 0.06 * k * k;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
}

function createBody(material) {
  const profile = [
    [0.0, 0.0],
    [0.05, 0.055],
    [0.16, 0.078],
    [0.38, 0.11],
    [0.58, 0.122],
    [0.78, 0.1],
    [1.02, 0.135],
    [1.22, 0.19],
    [1.36, 0.158],
    [1.5, 0.118],
    [1.64, 0.132],
    [1.78, 0.168],
    [1.92, 0.15],
    [2.04, 0.112],
    [2.14, 0.078],
    [2.24, 0.058],
  ].map(([y, r]) => new THREE.Vector2(r, y));

  const geo = new THREE.LatheGeometry(profile, 56);
  sculptBody(geo);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'body';
  return mesh;
}

function createArm(material, side) {
  const shoulder = new THREE.Group();
  shoulder.position.set(0.2 * side, 1.9, 0.06);
  shoulder.rotation.z = -0.48 * side;
  shoulder.rotation.x = 0.18;

  const upperGeo = new THREE.CapsuleGeometry(0.058, 0.34, 6, 12);
  const upper = new THREE.Mesh(upperGeo, material);
  upper.position.y = -0.25;
  shoulder.add(upper);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), material);
  cap.scale.set(1.1, 0.78, 0.78);
  cap.position.set(0.02 * side, 0.02, 0);
  shoulder.add(cap);

  const elbow = new THREE.Group();
  elbow.position.y = -0.48;
  elbow.rotation.z = 0.22 * side;
  elbow.rotation.x = 0.2;
  shoulder.add(elbow);

  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.32, 5, 10), material);
  fore.position.y = -0.23;
  elbow.add(fore);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), material);
  hand.scale.set(0.7, 1.15, 0.48);
  hand.position.y = -0.46;
  elbow.add(hand);

  return shoulder;
}

function hairRibbon(points, width) {
  const curve = new THREE.CatmullRomCurve3(points);
  const steps = 16;
  const frames = curve.computeFrenetFrames(steps, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const p = curve.getPointAt(i / steps);
    const n = frames.normals[i];
    const w = width * (1 - (i / steps) * 0.55);
    positions.push(p.x + n.x * w, p.y + n.y * w, p.z + n.z * w);
    positions.push(p.x - n.x * w, p.y - n.y * w, p.z - n.z * w);
    uvs.push(0, i / steps, 1, i / steps);
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createHead(material) {
  const group = new THREE.Group();

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 28, 20), material);
  head.scale.set(0.84, 1.1, 0.92);
  head.position.set(0.01, 2.46, 0.03);
  head.rotation.set(0.1, 0.22, 0.05);
  group.add(head);

  const mass = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), material);
  mass.scale.set(1.2, 0.7, 0.9);
  mass.position.set(-0.02, 2.54, -0.04);
  group.add(mass);

  const strands = [
    [
      [0.02, 2.6, 0.05],
      [-0.06, 2.5, 0.1],
      [-0.2, 2.32, 0.1],
      [-0.32, 2.12, 0.04],
    ],
    [
      [-0.01, 2.58, 0.0],
      [-0.12, 2.44, 0.04],
      [-0.26, 2.22, 0.02],
      [-0.38, 2.0, -0.02],
    ],
    [
      [0.04, 2.56, 0.08],
      [-0.02, 2.4, 0.12],
      [-0.14, 2.18, 0.08],
      [-0.22, 1.98, 0.02],
    ],
    [
      [0.0, 2.62, -0.03],
      [-0.08, 2.48, -0.06],
      [-0.16, 2.28, -0.04],
      [-0.24, 2.08, -0.06],
    ],
  ];

  const hairMat = material.clone();
  hairMat.side = THREE.DoubleSide;
  for (const strand of strands) {
    const points = strand.map((p) => new THREE.Vector3(...p));
    group.add(new THREE.Mesh(hairRibbon(points, 0.07), hairMat));
  }

  return group;
}

/**
 * Six wings. Each spine is a cubic curve; feathers are one shared
 * blade drawn with InstancedMesh. `flow: 'out'` trails off the leading
 * edge (upper arch). `flow: 'along'` follows the spine and fans by row
 * (spread middle wings and the long lower pair).
 */
const WING_SPECS = [
  {
    name: 'upper',
    rows: 6,
    count: 18,
    fan: 0.12,
    length: [0.68, 1.2],
    flow: 'out',
    hint: (side) => new THREE.Vector3(side * 0.28, 1, 0),
    plane: (side) => new THREE.Vector3(side * 0.05, 0.02, 1).normalize(),
    points: (side) => [
      new THREE.Vector3(0.14 * side, 2.02, -0.34),
      new THREE.Vector3(0.72 * side, 2.48, -0.42),
      new THREE.Vector3(0.58 * side, 3.12, -0.3),
      new THREE.Vector3(0.04 * side, 3.38, -0.14),
    ],
  },
  {
    name: 'middle',
    rows: 7,
    count: 16,
    fan: 0.14,
    length: [0.78, 1.38],
    flow: 'along',
    hint: (side) => new THREE.Vector3(side, -0.22, 0),
    plane: (side) => new THREE.Vector3(side * 0.04, -0.02, 1).normalize(),
    points: (side) => [
      new THREE.Vector3(0.16 * side, 1.78, -0.32),
      new THREE.Vector3(0.72 * side, 2.02, -0.36),
      new THREE.Vector3(1.28 * side, 2.12, -0.22),
      new THREE.Vector3(1.62 * side, 2.0, -0.08),
    ],
  },
  {
    name: 'lower',
    rows: 6,
    count: 16,
    fan: 0.12,
    length: [0.88, 1.5],
    flow: 'along',
    hint: (side) => new THREE.Vector3(side * 0.35, -1, 0),
    plane: (side) => new THREE.Vector3(side * 0.04, -0.05, 1).normalize(),
    points: (side) => [
      new THREE.Vector3(0.12 * side, 1.48, -0.32),
      new THREE.Vector3(0.36 * side, 0.72, -0.26),
      new THREE.Vector3(0.4 * side, -0.05, -0.12),
      new THREE.Vector3(0.26 * side, -0.62, 0.0),
    ],
  },
];

function featherDirection(flow, tangent, hint) {
  const tang = tangent.clone().normalize();
  if (flow === 'along') {
    const dir = tang.clone();
    const side = hint.clone();
    side.addScaledVector(tang, -side.dot(tang));
    if (side.lengthSq() > 1e-6) dir.add(side.normalize().multiplyScalar(0.28));
    return dir.normalize();
  }
  const dir = hint.clone();
  dir.addScaledVector(tang, -dir.dot(tang));
  if (dir.lengthSq() < 1e-6) dir.crossVectors(tang, new THREE.Vector3(0, 0, 1));
  return dir.normalize();
}

function basisQuaternion(dir, planeNormal) {
  const y = dir.clone().normalize();
  let z = planeNormal.clone().normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  if (x.lengthSq() < 1e-6) x.crossVectors(y, new THREE.Vector3(1, 0, 0));
  x.normalize();
  z = new THREE.Vector3().crossVectors(x, y).normalize();
  const basis = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

function buildWing(spec, side, geometry, material, rand) {
  const total = spec.rows * spec.count;
  const mesh = new THREE.InstancedMesh(geometry, material, total);
  mesh.name = `${spec.name}-${side > 0 ? 'l' : 'r'}`;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const pts = spec.points(side);
  const hint = spec.hint(side);
  const plane = spec.plane(side);
  const dummy = new THREE.Object3D();
  const midRow = (spec.rows - 1) / 2;
  let index = 0;

  for (let i = 0; i < spec.count; i++) {
    const t = spec.count === 1 ? 0 : i / (spec.count - 1);
    const origin = cubicPoint(pts[0], pts[1], pts[2], pts[3], t);
    const tangent = cubicTangent(pts[0], pts[1], pts[2], pts[3], t);
    const baseDir = featherDirection(spec.flow, tangent, hint);
    const along = spec.name === 'lower' ? 0.35 + t * 0.65 : Math.sin(t * Math.PI) * 0.65 + 0.35;

    for (let row = 0; row < spec.rows; row++) {
      const rowF = spec.rows === 1 ? 1 : row / (spec.rows - 1);
      const fan = (row - midRow) * spec.fan * (0.55 + rowF) + (rand() - 0.5) * 0.03;
      const dir = baseDir.clone().applyAxisAngle(plane, fan + ((i + row) % 2 === 0 ? 0.035 : -0.03));
      const fringe = 0.5 + 0.5 * rowF;
      const stutter = 0.94 + ((i + row) % 3) * 0.035;
      const length =
        THREE.MathUtils.lerp(spec.length[0], spec.length[1], along) * fringe * stutter;
      const width = THREE.MathUtils.lerp(1.2, 0.72, rowF) * THREE.MathUtils.lerp(1.05, 0.78, t);

      dummy.position
        .copy(origin)
        .addScaledVector(plane, (row - midRow) * 0.01)
        .addScaledVector(dir, 0.015);
      dummy.quaternion.copy(basisQuaternion(dir, plane));
      dummy.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.12),
      );
      dummy.scale.set(width, length, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function createAngel(marble) {
  const group = new THREE.Group();
  group.name = 'angel';

  group.add(createBody(marble.body));
  group.add(createHead(marble.body));
  group.add(createArm(marble.body, 1));
  group.add(createArm(marble.body, -1));

  const feather = createFeatherGeometry();
  const rand = mulberry32(0xa11e);
  for (const spec of WING_SPECS) {
    group.add(buildWing(spec, 1, feather, marble.wing, rand));
    group.add(buildWing(spec, -1, feather, marble.wing, rand));
  }

  return {
    group,
    update(time) {
      group.position.y = Math.sin(time * 0.45) * 0.055;
    },
  };
}
