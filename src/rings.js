import * as THREE from 'three';

const REF_RADIUS = 1.36;
const GLYPHS_PER_LOOP = 48;

const RING_SPECS = [
  {
    radius: 1.05,
    half: 0.062,
    position: [0.04, 1.95, -0.22],
    tiltX: -0.68,
    tiltZ: 0.38,
    spin: 0.07,
  },
  {
    radius: 1.28,
    half: 0.07,
    position: [-0.02, 0.18, 0.06],
    tiltX: -0.78,
    tiltZ: -0.46,
    spin: -0.046,
  },
];

function glyphLoops(radius) {
  return Math.max(1, Math.round((radius / REF_RADIUS) * 2));
}

function isLowQuality() {
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  return narrow || coarse || saveData;
}

// t is eased progress toward `form` (0 = the other form, 1 = fully there).
function stillWeight(form, t) {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
  if (form === 'still') return k;
  if (form === 'radiant') return 1 - k;
  return null;
}

// Scale alpha in fog instead of mixing toward fogColor. These materials use
// additive blending, and the still-form fog is teal.
function additiveFog(material) {
  material.fog = true;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `#ifdef USE_FOG
        #ifdef FOG_EXP2
          float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        #else
          float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        #endif
        gl_FragColor.a *= 1.0 - fogFactor;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'additive-fog-alpha';
  return material;
}

function drawGlyph(ctx, kind, s) {
  const k = kind % 16;
  ctx.beginPath();
  if (k === 0) {
    ctx.moveTo(0, -s);
    ctx.lineTo(0, s * 0.92);
    ctx.moveTo(-s * 0.62, -s * 0.28);
    ctx.lineTo(s * 0.48, -s * 0.28);
    ctx.moveTo(-s * 0.4, s * 0.32);
    ctx.lineTo(s * 0.62, s * 0.32);
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.7, -s * 0.72, s * 0.55, -s * 0.28);
  } else if (k === 1) {
    ctx.arc(0, -s * 0.08, s * 0.48, 0, Math.PI * 2);
    ctx.moveTo(0, -s * 0.08);
    ctx.arc(0, -s * 0.08, s * 0.12, 0, Math.PI * 2);
    ctx.moveTo(0, s * 0.4);
    ctx.lineTo(0, s * 0.92);
  } else if (k === 2) {
    ctx.moveTo(-s * 0.55, s * 0.78);
    ctx.lineTo(0, -s * 0.92);
    ctx.lineTo(s * 0.55, s * 0.78);
    ctx.moveTo(-s * 0.28, s * 0.18);
    ctx.lineTo(s * 0.28, s * 0.18);
  } else if (k === 3) {
    ctx.arc(0, s * 0.05, s * 0.62, Math.PI * 1.15, Math.PI * 1.85, true);
    ctx.moveTo(-s * 0.15, -s * 0.42);
    ctx.lineTo(s * 0.5, -s * 0.05);
    ctx.moveTo(0, s * 0.22);
    ctx.lineTo(0, s * 0.9);
  } else if (k === 4) {
    ctx.moveTo(-s * 0.7, -s * 0.55);
    ctx.lineTo(s * 0.15, -s * 0.55);
    ctx.lineTo(-s * 0.15, s * 0.45);
    ctx.lineTo(s * 0.7, s * 0.45);
  } else if (k === 5) {
    ctx.moveTo(0, -s);
    ctx.lineTo(0, s);
    ctx.moveTo(-s * 0.55, -s * 0.15);
    ctx.lineTo(s * 0.55, -s * 0.15);
    ctx.moveTo(-s * 0.34, s * 0.42);
    ctx.quadraticCurveTo(0, s * 0.95, s * 0.34, s * 0.42);
  } else if (k === 6) {
    ctx.moveTo(-s * 0.42, -s * 0.7);
    ctx.lineTo(-s * 0.42, s * 0.55);
    ctx.lineTo(s * 0.48, s * 0.55);
    ctx.moveTo(-s * 0.42, -s * 0.05);
    ctx.lineTo(s * 0.22, -s * 0.05);
    ctx.moveTo(s * 0.15, -s * 0.7);
    ctx.lineTo(s * 0.15, -s * 0.05);
  } else if (k === 7) {
    ctx.moveTo(-s * 0.15, -s);
    ctx.lineTo(-s * 0.15, s * 0.2);
    ctx.quadraticCurveTo(-s * 0.15, s * 0.85, s * 0.45, s * 0.85);
    ctx.moveTo(s * 0.15, -s * 0.55);
    ctx.lineTo(-s * 0.5, s * 0.15);
  } else if (k === 8) {
    ctx.moveTo(0, s * 0.9);
    ctx.lineTo(0, -s * 0.15);
    ctx.moveTo(0, -s * 0.15);
    ctx.lineTo(-s * 0.55, -s * 0.72);
    ctx.moveTo(0, -s * 0.15);
    ctx.lineTo(s * 0.55, -s * 0.72);
    ctx.moveTo(-s * 0.38, s * 0.28);
    ctx.lineTo(s * 0.38, s * 0.28);
  } else if (k === 9) {
    ctx.arc(0, 0, s * 0.58, Math.PI * 0.2, Math.PI * 1.75);
    ctx.moveTo(-s * 0.2, -s * 0.62);
    ctx.lineTo(s * 0.48, 0);
    ctx.lineTo(-s * 0.05, s * 0.2);
  } else if (k === 10) {
    ctx.moveTo(-s * 0.5, -s * 0.8);
    ctx.lineTo(s * 0.15, -s * 0.8);
    ctx.lineTo(s * 0.15, s * 0.8);
    ctx.lineTo(-s * 0.5, s * 0.8);
    ctx.moveTo(s * 0.15, 0);
    ctx.lineTo(-s * 0.35, 0);
  } else if (k === 11) {
    ctx.moveTo(0, -s * 0.9);
    ctx.lineTo(s * 0.5, s * 0.72);
    ctx.lineTo(-s * 0.5, s * 0.72);
    ctx.closePath();
    ctx.moveTo(0, -s * 0.35);
    ctx.lineTo(0, s * 0.42);
  } else if (k === 12) {
    ctx.moveTo(-s * 0.62, -s * 0.2);
    ctx.lineTo(s * 0.62, -s * 0.2);
    ctx.moveTo(0, -s * 0.2);
    ctx.lineTo(0, s * 0.85);
    ctx.moveTo(-s * 0.4, s * 0.35);
    ctx.lineTo(s * 0.4, s * 0.35);
    ctx.moveTo(0, -s * 0.2);
    ctx.lineTo(0, -s * 0.85);
  } else if (k === 13) {
    ctx.moveTo(-s * 0.55, s * 0.7);
    ctx.quadraticCurveTo(-s * 0.7, -s * 0.5, 0, -s * 0.85);
    ctx.quadraticCurveTo(s * 0.7, -s * 0.5, s * 0.55, s * 0.7);
    ctx.moveTo(-s * 0.22, s * 0.15);
    ctx.lineTo(s * 0.22, s * 0.15);
  } else if (k === 14) {
    ctx.moveTo(-s * 0.15, -s);
    ctx.lineTo(-s * 0.15, s);
    ctx.moveTo(s * 0.28, -s * 0.55);
    ctx.lineTo(s * 0.28, s * 0.7);
    ctx.moveTo(-s * 0.15, -s * 0.1);
    ctx.lineTo(s * 0.28, -s * 0.55);
  } else {
    ctx.arc(-s * 0.05, -s * 0.25, s * 0.38, Math.PI * 0.85, Math.PI * 2.15);
    ctx.moveTo(s * 0.22, -s * 0.02);
    ctx.lineTo(s * 0.22, s * 0.88);
    ctx.moveTo(-s * 0.18, s * 0.48);
    ctx.lineTo(s * 0.48, s * 0.48);
  }
  ctx.stroke();
}

function createGlyphTexture(width = 4096) {
  const height = 256;
  const scale = width / 4096;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const cell = width / GLYPHS_PER_LOOP;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#fff8ea';
  ctx.fillStyle = '#fff8ea';
  ctx.lineWidth = Math.max(8, 16 * scale);

  for (let i = 0; i < GLYPHS_PER_LOOP; i++) {
    const cx = cell * (i + 0.5);
    ctx.save();
    ctx.translate(cx, height * 0.5);
    // Taller than wide in the strip so the glyphs stay nearly square once
    // the band is wrapped around the ring.
    ctx.scale(0.62, 1.45);
    drawGlyph(ctx, i * 3 + 1, 46 * scale);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cell * i, height * 0.5, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function annulusGeometry(inner, outer, segments, repeats) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = t * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    positions.push(c * inner, s * inner, 0, c * outer, s * outer, 0);
    const u = t * repeats;
    uvs.push(u, 0, u, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const crispVertex = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const crispFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform sampler2D uGlyphs;
  uniform vec3 uColor;
  uniform float uFade;
  varying vec2 vUv;

  float hairline(float v, float at) {
    float aa = max(fwidth(v) * 1.35, 0.0035);
    return 1.0 - smoothstep(aa * 0.25, aa, abs(v - at));
  }

  void main() {
    float v = vUv.y;
    float borders = clamp(hairline(v, 0.1) + hairline(v, 0.9), 0.0, 1.0);
    float glyph = texture2D(uGlyphs, vUv).a;
    glyph *= smoothstep(0.08, 0.2, v) * smoothstep(0.92, 0.8, v);
    float alpha = max(glyph, borders) * uFade;
    if (alpha < 0.04) discard;
    vec3 col = mix(uColor, uColor * 1.28, borders);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }
`;

const glowVertex = crispVertex;

const glowFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform vec3 uColor;
  uniform float uFade;
  varying vec2 vUv;

  void main() {
    float d = abs(vUv.y - 0.5) * 2.0;
    float glow = pow(1.0 - smoothstep(0.05, 1.0, d), 1.45);
    float alpha = glow * uFade * 0.72;
    #ifdef USE_FOG
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      alpha *= 1.0 - fogFactor;
    #endif
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function createHaloTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, c * 0.2, c, c, c * 0.98);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(0.52, 'rgba(255,244,214,0.18)');
  g.addColorStop(0.6, 'rgba(255,236,196,0.55)');
  g.addColorStop(0.66, 'rgba(255,248,230,1)');
  g.addColorStop(0.72, 'rgba(255,220,150,0.45)');
  g.addColorStop(0.84, 'rgba(255,196,110,0.12)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,248,230,0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.655, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, c * 0.74, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createMandalaTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const R = c * 0.96;
  ctx.translate(c, c);
  ctx.strokeStyle = 'rgba(232, 240, 248, 0.95)';
  ctx.fillStyle = 'rgba(232, 240, 248, 0.95)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const circle = (r, width) => {
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  const poly = (n, r, rot, width) => {
    ctx.beginPath();
    ctx.lineWidth = width;
    for (let i = 0; i <= n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  circle(R * 0.12, 1.5);
  circle(R * 0.22, 1.05);
  circle(R * 0.36, 1.45);
  circle(R * 0.5, 1.05);
  circle(R * 0.66, 1.55);
  circle(R * 0.8, 1.05);
  circle(R * 0.92, 1.7);

  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const major = i % 2 === 0;
    ctx.beginPath();
    ctx.lineWidth = major ? 1.2 : 0.7;
    const inner = major ? R * 0.12 : R * 0.36;
    const outer = major ? R * 0.92 : R * 0.66;
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }

  poly(6, R * 0.5, Math.PI / 6, 1.35);
  poly(6, R * 0.5, 0, 1.35);
  poly(12, R * 0.66, Math.PI / 12, 1.0);

  ctx.lineWidth = 1.15;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25, R * 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, R * 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

const shaftVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shaftFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uFade;
  uniform vec3 uColor;
  void main() {
    float around = vUv.x;
    float along = vUv.y;
    float ray = sin(around * 54.0 + uTime * 0.28 + sin(around * 11.0 + uTime * 0.17) * 1.8);
    ray = smoothstep(0.25, 0.98, ray * 0.5 + 0.5);
    float streak = pow(ray, 2.8);
    float fade = pow(along, 1.35) * smoothstep(0.0, 0.14, along);
    float alpha = (streak * 0.62 + 0.05) * fade * uFade;
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function createRing(spec, crispMat, glowMat, goldMat, segments, low) {
  const holder = new THREE.Group();
  holder.position.set(spec.position[0], spec.position[1], spec.position[2]);
  holder.rotation.x = spec.tiltX;
  holder.rotation.z = spec.tiltZ;

  const spin = new THREE.Group();
  holder.add(spin);

  const repeats = glyphLoops(spec.radius);
  const inner = spec.radius - spec.half;
  const outer = spec.radius + spec.half;
  const crisp = new THREE.Mesh(annulusGeometry(inner, outer, segments, repeats), crispMat);
  const glow = new THREE.Mesh(
    annulusGeometry(spec.radius - spec.half * 2.35, spec.radius + spec.half * 2.35, Math.max(64, segments >> 1), 1),
    glowMat,
  );
  glow.position.z = -0.004;
  glow.renderOrder = 1;
  crisp.renderOrder = 2;
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(spec.radius, Math.max(0.007, spec.radius * 0.0095), low ? 8 : 12, low ? 72 : 112),
    goldMat,
  );
  torus.name = 'gold-band';
  torus.position.z = -0.012;
  spin.add(torus, glow, crisp);

  return { holder, spin, speed: spec.spin, tiltX: spec.tiltX, tiltZ: spec.tiltZ, crisp, glow };
}

/**
 * Tilted glyph rings, a bright head halo, and the still-form mandala.
 * `setForm('still', t)` fades the gold toward the pale halo as t goes 0 → 1.
 * `setForm('radiant', t)` brings the gold back as t goes 0 → 1.
 */
export function createRings() {
  const group = new THREE.Group();
  group.name = 'rings';
  // Motion stays on an inner rig so callers can position `group` themselves.
  const rig = new THREE.Group();
  rig.name = 'rings-rig';
  group.add(rig);

  const low = isLowQuality();
  const glyphTex = createGlyphTexture(low ? 2048 : 4096);
  const fogUniforms = THREE.UniformsLib.fog;
  const crispMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      fogUniforms,
      {
        uGlyphs: { value: glyphTex },
        uColor: { value: new THREE.Color().setRGB(1.85, 1.28, 0.62) },
        uFade: { value: 1 },
      },
    ]),
    vertexShader: crispVertex,
    fragmentShader: crispFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    fog: true,
  });
  const glowMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color().setRGB(1.35, 0.78, 0.28) },
        uFade: { value: 1 },
      },
    ]),
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: true,
  });

  const goldMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setRGB(1, 0.716, 0.291),
    metalness: 1,
    roughness: 0.17,
    envMapIntensity: 1.35,
    clearcoat: 0.2,
    clearcoatRoughness: 0.16,
    emissive: new THREE.Color().setRGB(0.22, 0.1, 0.02),
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 1,
    depthWrite: true,
  });

  const segments = low ? 160 : 288;
  const rings = RING_SPECS.map((spec) => {
    const ring = createRing(spec, crispMat, glowMat, goldMat, segments, low);
    rig.add(ring.holder);
    return ring;
  });

  const halo = new THREE.Group();
  halo.name = 'halo';
  halo.position.set(0, 2.46, -0.42);
  halo.scale.setScalar(0.28);
  halo.rotation.x = -0.08;
  rig.add(halo);

  const haloMap = createHaloTexture();
  const haloPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.35, 2.35),
    additiveFog(
      new THREE.MeshBasicMaterial({
        map: haloMap,
        color: new THREE.Color().setRGB(3.4, 2.05, 0.95),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 1,
      }),
    ),
  );
  const core = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.011, 12, 160),
    additiveFog(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(4.4, 2.55, 1.05),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(0.66, 0.0035, 8, 128),
    additiveFog(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(3.2, 2.1, 1.05),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.0032, 8, 140),
    additiveFog(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setRGB(2.6, 1.7, 0.75),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  halo.add(haloPlane, inner, core, outer);

  let shaft = null;
  if (!low) {
    const shaftMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uFade: { value: 1 },
        uColor: { value: new THREE.Color().setRGB(1.15, 0.72, 0.32) },
      },
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
    });
    shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 1.15, 2.35, 24, 1, true), shaftMat);
    shaft.name = 'halo-shaft';
    shaft.position.y = -1.02;
    shaft.frustumCulled = false;
    shaft.renderOrder = 1;
    halo.add(shaft);
  }

  const mandala = new THREE.Mesh(
    new THREE.PlaneGeometry(3.35, 3.35),
    new THREE.MeshBasicMaterial({
      map: createMandalaTexture(),
      color: new THREE.Color().setRGB(0.78, 0.86, 0.98),
      transparent: true,
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
    }),
  );
  mandala.position.set(0, 2.48, -0.96);
  mandala.name = 'mandala';
  mandala.visible = false;
  rig.add(mandala);

  const haloMats = [haloPlane.material, core.material, inner.material, outer.material];
  let blend = 0;

  function apply() {
    const gold = 1 - blend;
    crispMat.uniforms.uFade.value = gold;
    glowMat.uniforms.uFade.value = gold;
    const showGold = gold > 0.02;
    for (const ring of rings) {
      ring.crisp.visible = showGold;
      ring.glow.visible = showGold;
    }
    for (const mat of haloMats) mat.opacity = gold;
    goldMat.opacity = gold;
    goldMat.depthWrite = gold > 0.65;
    if (shaft) {
      shaft.material.uniforms.uFade.value = gold;
      shaft.visible = gold > 0.03;
    }
    mandala.material.opacity = blend * 0.5;
    mandala.visible = blend > 0.02;
    halo.visible = showGold;
  }

  return {
    group,
    update(time, dt) {
      const calm = 0.22 + 0.78 * (1 - blend);
      for (const ring of rings) {
        ring.spin.rotation.z += ring.speed * dt * calm;
        ring.holder.rotation.x = ring.tiltX + Math.sin(time * 0.12 + ring.speed) * 0.02;
        ring.holder.rotation.z = ring.tiltZ + Math.cos(time * 0.1 + ring.tiltZ) * 0.018;
      }
      halo.rotation.z = Math.sin(time * 0.05) * 0.04;
      mandala.rotation.z = -time * 0.018 * blend;
      const pulse = 0.9 + 0.1 * Math.sin(time * 0.8);
      glowMat.uniforms.uFade.value = (1 - blend) * pulse;
      if (shaft) shaft.material.uniforms.uTime.value = time;
    },
    setForm(form, t) {
      const next = stillWeight(form, t);
      if (next === null) return;
      blend = next;
      apply();
    },
    dispose() {
      const geometries = new Set();
      const materials = new Set();
      const textures = new Set();
      const takeMaterial = (material) => {
        if (!material) return;
        materials.add(material);
        if (material.map) textures.add(material.map);
        const uniforms = material.uniforms;
        if (!uniforms) return;
        for (const key of Object.keys(uniforms)) {
          const value = uniforms[key]?.value;
          if (value?.isTexture) textures.add(value);
        }
      };
      group.traverse((obj) => {
        if (obj.geometry) geometries.add(obj.geometry);
        if (Array.isArray(obj.material)) obj.material.forEach(takeMaterial);
        else takeMaterial(obj.material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      group.removeFromParent();
    },
  };
}
