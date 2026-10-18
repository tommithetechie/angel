import * as THREE from 'three';

function softCircle() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePoints(count, radius, height, color, size, sprite) {
  const positions = new Float32Array(count * 3);
  const baseX = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    baseX[i] = Math.cos(a) * r;
    positions[i * 3] = baseX[i];
    positions[i * 3 + 1] = Math.random() * height - height * 0.28;
    positions[i * 3 + 2] = (Math.random() - 0.5) * radius * 0.85;
    speeds[i] = 0.04 + Math.random() * 0.16;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color,
    map: sprite,
    size,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    opacity: 0.9,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, speeds, height, baseX };
}

function rockGeometry(seed) {
  const rand = mulberry32(seed);
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const scale = 0.78 + rand() * 0.4;
    pos.setXYZ(i, pos.getX(i) * scale, pos.getY(i) * scale, pos.getZ(i) * scale);
  }
  geo.computeVertexNormals();
  const uv = geo.attributes.uv;
  const ox = rand();
  const oy = rand();
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * 0.22 + ox, uv.getY(i) * 0.22 + oy);
  }
  return geo;
}

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

const ROCKS = [
  { pos: [-2.55, 2.85, 0.7], scale: 0.1, marble: false },
  { pos: [-2.85, 1.15, 1.05], scale: 0.16, marble: false },
  { pos: [-2.15, -0.15, 1.15], scale: 0.09, marble: true },
  { pos: [-2.4, -0.85, 0.55], scale: 0.18, marble: false },
  { pos: [2.6, 2.15, 0.85], scale: 0.11, marble: false },
  { pos: [2.9, 0.45, 1.1], scale: 0.15, marble: false },
  { pos: [2.2, -0.75, 0.7], scale: 0.12, marble: true },
  { pos: [1.15, -1.15, 1.15], scale: 0.08, marble: false },
  { pos: [-1.15, 3.55, -0.2], scale: 0.07, marble: false },
  { pos: [0.9, 3.65, 0.45], scale: 0.06, marble: false },
  { pos: [-3.05, 2.05, 0.15], scale: 0.13, marble: false },
  { pos: [3.05, 2.7, 0.2], scale: 0.1, marble: false },
];

export function createParticles(marble) {
  const group = new THREE.Group();
  group.name = 'particles';
  const sprite = softCircle();

  const dust = makePoints(860, 3.6, 5.6, 0xe7c98a, 0.02, sprite);
  const motes = makePoints(140, 3.1, 5.2, 0xffe3b0, 0.055, sprite);
  group.add(dust.points, motes.points);

  const stone = new THREE.MeshStandardMaterial({
    color: 0x141311,
    roughness: 0.96,
    metalness: 0.04,
    envMapIntensity: 0.15,
  });

  const rocks = ROCKS.map((spec, i) => {
    const rand = mulberry32(0x51ed + i * 97);
    const mesh = new THREE.Mesh(rockGeometry(0x51ed + i * 97), spec.marble ? marble.body : stone);
    mesh.position.set(...spec.pos);
    mesh.scale.setScalar(spec.scale);
    mesh.rotation.set(rand() * 3, rand() * 3, rand() * 2);
    mesh.userData = {
      base: mesh.position.clone(),
      sx: (rand() - 0.5) * 0.35,
      sy: (rand() - 0.5) * 0.45,
      phase: rand() * Math.PI * 2,
    };
    group.add(mesh);
    return mesh;
  });

  const clouds = [dust, motes];

  return {
    group,
    update(time, dt) {
      for (const cloud of clouds) {
        const pos = cloud.points.geometry.attributes.position;
        for (let i = 0; i < cloud.speeds.length; i++) {
          let y = pos.getY(i) + cloud.speeds[i] * dt;
          if (y > cloud.height * 0.78) y = -cloud.height * 0.28;
          pos.setY(i, y);
          pos.setX(i, cloud.baseX[i] + Math.sin(time * 0.35 + i) * 0.08);
        }
        pos.needsUpdate = true;
      }
      for (const rock of rocks) {
        const { base, sx, sy, phase } = rock.userData;
        rock.rotation.x += sx * dt;
        rock.rotation.y += sy * dt;
        rock.position.y = base.y + Math.sin(time * 0.4 + phase) * 0.07;
        rock.position.x = base.x + Math.sin(time * 0.17 + phase) * 0.03;
      }
    },
  };
}
