import * as THREE from 'three';

const GLYPHS = 84;

function drawGlyph(ctx, index, size) {
  const kind = index % 8;
  ctx.beginPath();
  if (kind === 0) {
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.72, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.72, 0);
    ctx.closePath();
  } else if (kind === 1) {
    ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
    ctx.moveTo(size * 0.16, 0);
    ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
  } else if (kind === 2) {
    ctx.moveTo(-size * 0.55, size * 0.7);
    ctx.lineTo(0, -size * 0.75);
    ctx.lineTo(size * 0.55, size * 0.7);
    ctx.moveTo(-size * 0.28, size * 0.15);
    ctx.lineTo(size * 0.28, size * 0.15);
  } else if (kind === 3) {
    ctx.arc(0, 0, size * 0.55, Math.PI * 0.15, Math.PI * 1.7);
    ctx.moveTo(-size * 0.15, -size * 0.55);
    ctx.lineTo(size * 0.45, -size * 0.15);
  } else if (kind === 4) {
    ctx.moveTo(-size * 0.7, -size * 0.45);
    ctx.lineTo(size * 0.15, -size * 0.45);
    ctx.lineTo(-size * 0.15, size * 0.5);
    ctx.lineTo(size * 0.7, size * 0.5);
  } else if (kind === 5) {
    ctx.moveTo(0, -size * 0.75);
    ctx.lineTo(0, size * 0.75);
    ctx.moveTo(-size * 0.48, -size * 0.1);
    ctx.lineTo(size * 0.48, -size * 0.1);
    ctx.moveTo(-size * 0.28, size * 0.38);
    ctx.arc(0, size * 0.38, size * 0.28, Math.PI, 0);
  } else if (kind === 6) {
    ctx.rect(-size * 0.42, -size * 0.42, size * 0.84, size * 0.84);
    ctx.moveTo(-size * 0.42, -size * 0.42);
    ctx.lineTo(size * 0.42, size * 0.42);
  } else {
    ctx.arc(0, -size * 0.18, size * 0.34, 0, Math.PI * 2);
    ctx.moveTo(0, size * 0.16);
    ctx.lineTo(0, size * 0.72);
    ctx.moveTo(-size * 0.28, size * 0.48);
    ctx.lineTo(size * 0.28, size * 0.48);
  }
  ctx.stroke();
}

function createGlyphTexture() {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // RingGeometry UVs place the annulus inside the unit square.
  // inner/outer ratio is 0.92/1.08, so the band center sits here.
  const outerUv = 0.5;
  const innerUv = (0.92 / 1.08) * 0.5;
  const mid = (outerUv + innerUv) * 0.5 * size;
  const glyph = (outerUv - innerUv) * size * 0.28;

  ctx.strokeStyle = 'rgba(255, 214, 140, 0.95)';
  ctx.fillStyle = 'rgba(255, 214, 140, 0.95)';
  ctx.lineWidth = Math.max(2, size * 0.0016);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, innerUv * size, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, outerUv * size * 0.98, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < GLYPHS; i++) {
    const a = (i / GLYPHS) * Math.PI * 2;
    ctx.save();
    ctx.translate(size / 2 + Math.cos(a) * mid, size / 2 + Math.sin(a) * mid);
    ctx.rotate(a + Math.PI / 2);
    ctx.lineWidth = Math.max(2, glyph * 0.09);
    drawGlyph(ctx, i * 3 + 1, glyph);
    ctx.restore();

    const dotA = a + Math.PI / GLYPHS;
    ctx.beginPath();
    ctx.arc(
      size / 2 + Math.cos(dotA) * mid,
      size / 2 + Math.sin(dotA) * mid,
      Math.max(1.5, glyph * 0.08),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

const RING_SPECS = [
  {
    radius: 1.22,
    position: [0.05, 2.05, -0.15],
    tiltX: 0.72,
    tiltZ: 0.38,
    spin: 0.11,
  },
  {
    radius: 1.78,
    position: [-0.08, 0.42, -0.05],
    tiltX: 0.82,
    tiltZ: -0.46,
    spin: -0.065,
  },
];

export function createRings() {
  const glyphTex = createGlyphTexture();
  const group = new THREE.Group();
  group.name = 'rings';
  const spinners = [];

  const metal = new THREE.MeshPhysicalMaterial({
    color: 0xd7b15c,
    metalness: 1,
    roughness: 0.26,
    emissive: new THREE.Color(0xffb84a),
    emissiveIntensity: 0.55,
    envMapIntensity: 1.15,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
  });

  const glyphs = new THREE.MeshBasicMaterial({
    map: glyphTex,
    color: 0xffe2ad,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  for (const spec of RING_SPECS) {
    const holder = new THREE.Group();
    holder.position.set(...spec.position);
    holder.rotation.x = spec.tiltX;
    holder.rotation.z = spec.tiltZ;

    const spin = new THREE.Group();
    holder.add(spin);

    const inner = spec.radius * 0.92;
    const outer = spec.radius * 1.08;
    const band = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 160), glyphs);
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(spec.radius, spec.radius * 0.0075, 12, 180),
      metal,
    );
    spin.add(band, torus);
    group.add(holder);
    spinners.push({ spin, speed: spec.spin });
  }

  return {
    group,
    update(_time, dt) {
      for (const item of spinners) item.spin.rotation.z += item.speed * dt;
    },
  };
}
