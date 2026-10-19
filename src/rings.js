import * as THREE from 'three';

const DEFAULT_CONFIG = {
  glyphDensity: 64,
  trailThickness: 0.0052,
  glowWidth: 0.036,
  speed: 1.0,
};

const HALO_POSE = {
  radiant: {
    position: [0, 1.98, -0.44],
    scale: 1.0,
    tiltX: -0.02,
  },
  radius: 1.04,
};

const TRAIL_SPECS = [
  {
    name: 'trail-waist',
    direction: 1,
    speed: 0.62,
    phase: 0.025,
    radiant: {
      position: [0.0, 1.12, -0.02],
      radiusX: 0.92,
      radiusZ: 0.78,
      tiltX: 0.22,
      tiltZ: -0.18,
    },
  },
  {
    name: 'trail-lower',
    direction: -1,
    speed: 0.48,
    phase: 0.385,
    radiant: {
      position: [0.0, 0.52, -0.02],
      radiusX: 1.12,
      radiusZ: 0.92,
      tiltX: -0.15,
      tiltZ: 0.14,
    },
  },
];

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

function isLowQuality() {
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  return narrow || coarse || saveData;
}

function drawGlyph(ctx, kind, s) {
  const k = kind % 16;
  ctx.beginPath();
  // Top metric bar inspired by sacred inscription linework
  ctx.moveTo(-s * 0.64, -s * 0.78);
  ctx.lineTo(s * 0.64, -s * 0.78);

  if (k === 0) {
    ctx.moveTo(0, -s * 0.78);
    ctx.lineTo(0, s * 0.86);
    ctx.moveTo(-s * 0.52, -s * 0.18);
    ctx.quadraticCurveTo(0, -s * 0.55, s * 0.48, -s * 0.12);
    ctx.quadraticCurveTo(0, s * 0.28, -s * 0.36, s * 0.52);
  } else if (k === 1) {
    ctx.arc(0, -s * 0.05, s * 0.44, 0, Math.PI * 2);
    ctx.moveTo(s * 0.44, -s * 0.78);
    ctx.lineTo(s * 0.44, s * 0.85);
  } else if (k === 2) {
    ctx.moveTo(-s * 0.48, s * 0.75);
    ctx.lineTo(0, -s * 0.78);
    ctx.lineTo(s * 0.48, s * 0.75);
    ctx.moveTo(-s * 0.26, s * 0.12);
    ctx.lineTo(s * 0.26, s * 0.12);
  } else if (k === 3) {
    ctx.arc(-s * 0.08, -s * 0.12, s * 0.42, Math.PI * 0.3, Math.PI * 1.85);
    ctx.moveTo(s * 0.34, -s * 0.78);
    ctx.lineTo(s * 0.34, s * 0.82);
  } else if (k === 4) {
    ctx.moveTo(-s * 0.5, -s * 0.42);
    ctx.lineTo(s * 0.2, -s * 0.42);
    ctx.lineTo(-s * 0.18, s * 0.48);
    ctx.lineTo(s * 0.52, s * 0.48);
    ctx.moveTo(s * 0.2, -s * 0.78);
    ctx.lineTo(s * 0.2, s * 0.82);
  } else if (k === 5) {
    ctx.moveTo(0, -s * 0.78);
    ctx.lineTo(0, s * 0.85);
    ctx.moveTo(-s * 0.5, -s * 0.1);
    ctx.lineTo(s * 0.5, -s * 0.1);
    ctx.moveTo(-s * 0.34, s * 0.38);
    ctx.quadraticCurveTo(0, s * 0.88, s * 0.34, s * 0.38);
  } else if (k === 6) {
    ctx.moveTo(-s * 0.38, -s * 0.78);
    ctx.lineTo(-s * 0.38, s * 0.48);
    ctx.quadraticCurveTo(-s * 0.38, s * 0.82, s * 0.38, s * 0.62);
    ctx.moveTo(s * 0.32, -s * 0.78);
    ctx.lineTo(s * 0.32, s * 0.84);
  } else if (k === 7) {
    ctx.moveTo(-s * 0.14, -s * 0.78);
    ctx.lineTo(-s * 0.14, s * 0.22);
    ctx.quadraticCurveTo(-s * 0.14, s * 0.82, s * 0.44, s * 0.78);
    ctx.moveTo(s * 0.24, -s * 0.48);
    ctx.lineTo(-s * 0.48, s * 0.18);
  } else if (k === 8) {
    ctx.moveTo(0, s * 0.85);
    ctx.lineTo(0, -s * 0.78);
    ctx.moveTo(-s * 0.46, -s * 0.24);
    ctx.quadraticCurveTo(0, s * 0.24, s * 0.46, -s * 0.24);
  } else if (k === 9) {
    ctx.arc(0, 0.04 * s, s * 0.46, Math.PI * 0.2, Math.PI * 1.75);
    ctx.moveTo(-s * 0.18, -s * 0.42);
    ctx.lineTo(s * 0.44, 0.04 * s);
    ctx.moveTo(-s * 0.15, -s * 1.05);
    ctx.quadraticCurveTo(s * 0.15, -s * 1.25, s * 0.38, -s * 0.82);
  } else if (k === 10) {
    ctx.moveTo(-s * 0.44, -s * 0.48);
    ctx.lineTo(s * 0.22, -s * 0.48);
    ctx.lineTo(s * 0.22, s * 0.78);
    ctx.moveTo(s * 0.22, 0);
    ctx.lineTo(-s * 0.38, 0);
  } else if (k === 11) {
    ctx.moveTo(0, -s * 0.68);
    ctx.lineTo(s * 0.46, s * 0.68);
    ctx.lineTo(-s * 0.46, s * 0.68);
    ctx.closePath();
    ctx.moveTo(0, -s * 0.28);
    ctx.lineTo(0, s * 0.42);
  } else if (k === 12) {
    ctx.moveTo(-s * 0.54, -s * 0.18);
    ctx.lineTo(s * 0.54, -s * 0.18);
    ctx.moveTo(0, -s * 0.78);
    ctx.lineTo(0, s * 0.84);
    ctx.moveTo(-s * 0.36, s * 0.34);
    ctx.lineTo(s * 0.36, s * 0.34);
  } else if (k === 13) {
    ctx.moveTo(-s * 0.46, s * 0.68);
    ctx.quadraticCurveTo(-s * 0.58, -s * 0.42, 0, -s * 0.68);
    ctx.quadraticCurveTo(s * 0.58, -s * 0.42, s * 0.46, s * 0.68);
    ctx.moveTo(-s * 0.22, s * 0.14);
    ctx.lineTo(s * 0.22, s * 0.14);
  } else if (k === 14) {
    ctx.moveTo(-s * 0.2, -s * 0.78);
    ctx.lineTo(-s * 0.2, s * 0.84);
    ctx.moveTo(s * 0.28, -s * 0.78);
    ctx.lineTo(s * 0.28, s * 0.72);
    ctx.moveTo(-s * 0.2, -s * 0.08);
    ctx.lineTo(s * 0.28, -s * 0.48);
  } else {
    ctx.arc(-s * 0.05, -s * 0.15, s * 0.36, Math.PI * 0.75, Math.PI * 2.15);
    ctx.moveTo(s * 0.26, -s * 0.78);
    ctx.lineTo(s * 0.26, s * 0.84);
    ctx.moveTo(-s * 0.18, s * 0.44);
    ctx.lineTo(s * 0.46, s * 0.44);
  }
  ctx.stroke();
}

function createUprightHaloOuterTexture(size, glyphCount) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size * 0.5;
  const R = size * 0.48;
  const u = size / 2048;

  ctx.translate(c, c);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const strokeCircle = (rFrac, width, alpha = 1) => {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 246, 224, ${alpha})`;
    ctx.lineWidth = width * u;
    ctx.beginPath();
    ctx.arc(0, 0, R * rFrac, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  // Outer double border & inner inscription border
  strokeCircle(0.955, 1.9, 0.56);
  strokeCircle(0.928, 3.6, 0.98);
  strokeCircle(0.808, 3.2, 0.94);
  strokeCircle(0.782, 1.6, 0.62);

  // Sacred glyphs along the outer inscription band (r = 0.808 .. 0.928)
  const rMid = R * 0.868;
  const glyphSize = 22.5 * u * Math.min(1.15, 64 / Math.max(24, glyphCount));
  ctx.strokeStyle = 'rgba(255, 250, 236, 0.98)';
  ctx.fillStyle = 'rgba(255, 250, 236, 0.98)';

  for (let i = 0; i < glyphCount; i++) {
    const a = (i / glyphCount) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -rMid);
    if (i % 8 === 0) {
      // Double-bar section divider (॥) with flanking dots
      ctx.lineWidth = 2.8 * u;
      ctx.beginPath();
      ctx.moveTo(-5.5 * u, -glyphSize * 0.72);
      ctx.lineTo(-5.5 * u, glyphSize * 0.72);
      ctx.moveTo(5.5 * u, -glyphSize * 0.72);
      ctx.lineTo(5.5 * u, glyphSize * 0.72);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-14 * u, 0, 2.8 * u, 0, Math.PI * 2);
      ctx.arc(14 * u, 0, 2.8 * u, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 3.0 * u;
      ctx.scale(0.84, 0.92);
      drawGlyph(ctx, i * 5 + 3, glyphSize);
    }
    ctx.restore();
  }

  // Fine astrolabe degree ticks along r = 0.742 .. 0.782
  const ticks = 144;
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2;
    const major = i % 12 === 0;
    const medium = i % 4 === 0;
    const r0 = R * (major ? 0.724 : medium ? 0.742 : 0.756);
    const r1 = R * 0.78;
    ctx.strokeStyle = `rgba(255, 244, 214, ${major ? 0.92 : medium ? 0.66 : 0.42})`;
    ctx.lineWidth = (major ? 2.4 : 1.45) * u;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

function createUprightHaloInnerTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size * 0.5;
  const R = size * 0.48;
  const u = size / 2048;

  ctx.translate(c, c);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Delicate broken concentric astrolabe arcs (staying outside r = 0.42 so the head center stays clear)
  const arcSpecs = [
    { r: 0.68, segments: 6, gap: 0.14, width: 2.2, alpha: 0.78, rot: 0.15 },
    { r: 0.56, segments: 4, gap: 0.18, width: 1.9, alpha: 0.66, rot: -0.35 },
    { r: 0.44, segments: 4, gap: 0.24, width: 1.65, alpha: 0.54, rot: 0.52 },
  ];

  for (const spec of arcSpecs) {
    const step = (Math.PI * 2) / spec.segments;
    ctx.strokeStyle = `rgba(255, 246, 220, ${spec.alpha})`;
    ctx.lineWidth = spec.width * u;
    for (let i = 0; i < spec.segments; i++) {
      const a0 = spec.rot + i * step + spec.gap * 0.5;
      const a1 = spec.rot + (i + 1) * step - spec.gap * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, R * spec.r, a0, a1);
      ctx.stroke();
    }
  }

  // Subtle radial hairlines between r = 0.44 and r = 0.68 (never crossing the central face region)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const major = i % 3 === 0;
    const r0 = R * (major ? 0.44 : 0.56);
    const r1 = R * 0.68;
    ctx.strokeStyle = `rgba(255, 244, 214, ${major ? 0.48 : 0.28})`;
    ctx.lineWidth = (major ? 1.65 : 1.15) * u;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();

    // Small star/node dots on the astrolabe circles
    const dotR = R * (major ? 0.56 : 0.68);
    ctx.fillStyle = 'rgba(255, 250, 236, 0.94)';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * dotR, Math.sin(a) * dotR, (major ? 3.6 : 2.5) * u, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

const haloDiscVertex = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec3 viewN = normalize(normalMatrix * normal);
    vFacing = abs(viewN.z);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const haloCrispFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vFacing;

  void main() {
    vec4 sampleCol = texture2D(uMap, vUv);
    float rearScale = gl_FrontFacing ? 1.0 : 0.74;
    float alpha = sampleCol.a * uOpacity * rearScale;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      alpha *= 1.0 - fogFactor;
    #endif
    if (alpha < 0.02) discard;
    float strokeMask = smoothstep(0.08, 0.72, sampleCol.r);
    vec3 col = mix(vec3(0.03, 0.02, 0.01), uColor * (0.86 + 0.28 * sampleCol.r) * (gl_FrontFacing ? 1.0 : 0.86), strokeMask);
    gl_FragColor = vec4(col, alpha);
  }
`;

const haloGlowFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uStill;
  uniform float uGather;
  varying vec2 vUv;
  varying float vFacing;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    // Focus soft glow along the outer and inner border rims so the gold
    // inscription remains crisp and high-contrast against the dark stage.
    float innerTarget = mix(0.775, 0.565, uStill);
    float midTarget = mix(0.835, 0.73, uStill);
    float widthScale = mix(1.0, 0.72, uGather);
    float outerRim = exp(-pow((r - 0.89) / (0.028 * widthScale), 2.0)) * mix(0.36, 0.24, uStill);
    float innerRim = exp(-pow((r - innerTarget) / (0.025 * widthScale), 2.0)) * mix(0.28, 0.18, uStill);
    float bandAura = exp(-pow((r - midTarget) / (0.090 * mix(1.0, 0.78, uGather)), 2.0)) * mix(0.10, 0.06, uStill);
    float cutoff = smoothstep(0.42, 0.54, r) * smoothstep(1.0, 0.9, r);
    float viewGate = (0.48 + 0.52 * smoothstep(0.08, 0.55, vFacing)) * (gl_FrontFacing ? 1.0 : 0.45);
    float alpha = (outerRim + innerRim + bandAura) * cutoff * uOpacity * viewGate;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      alpha *= 1.0 - fogFactor;
    #endif
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function createOrbitTubeGeometry(tubeRadius, segments, radialSegments = 8) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const theta = u * Math.PI * 2;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const phi = v * Math.PI * 2;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const nx = ct * cp;
      const ny = sp;
      const nz = st * cp;
      positions.push(ct + nx * tubeRadius, ny * tubeRadius, st + nz * tubeRadius);
      normals.push(nx, ny, nz);
      uvs.push(u, v);
    }
  }
  const stride = radialSegments + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createCrossedOrbitRibbonGeometry(halfWidth, segments) {
  const positions = [];
  const uvs = [];
  const indices = [];

  // Plane 0: horizontal XZ annulus; Plane 1: vertical cylindrical ribbon
  for (let plane = 0; plane < 2; plane++) {
    const base = (positions.length / 3) | 0;
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const theta = u * Math.PI * 2;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      if (plane === 0) {
        const rIn = 1 - halfWidth;
        const rOut = 1 + halfWidth;
        positions.push(ct * rIn, 0, st * rIn, ct * rOut, 0, st * rOut);
      } else {
        positions.push(ct, -halfWidth, st, ct, halfWidth, st);
      }
      uvs.push(u, 0, u, 1);
    }
    for (let i = 0; i < segments; i++) {
      const a = base + i * 2;
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

const trailVertex = /* glsl */ `
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

const trailCoreFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform float uHead;
  uniform float uDirection;
  uniform float uStill;
  uniform float uTime;
  uniform float uTransition;
  varying vec2 vUv;

  void main() {
    // Angular distance behind the moving head along the orbit (0 at head → 1 full turn)
    float d1 = uDirection > 0.0
      ? fract(uHead - vUv.x)
      : fract(vUv.x - uHead);

    // Compact bright moving head + smooth fading tail over ~38% of the orbit
    float head = exp(-d1 * 72.0);
    float tail = exp(-d1 * 6.2) * smoothstep(0.42, 0.015, d1);

    // Secondary quieter echo filament on the opposite side so rear/side views also catch motion
    float d2 = fract(d1 + 0.5);
    float echoHead = exp(-d2 * 64.0) * 0.42;
    float echoTail = exp(-d2 * 9.5) * smoothstep(0.24, 0.01, d2) * 0.34;

    // Fine shimmer modulation along the tail while leaving >50% of the path nearly absent
    float micro = 0.82 + 0.18 * sin(vUv.x * 188.4955 + uTime * 3.2);
    float intensity = head * 1.45 + tail * 0.92 * micro + echoHead + echoTail * micro + 0.018;
    intensity *= 1.0 + uTransition * 0.72;

    vec3 radiantCore = mix(vec3(1.95, 1.32, 0.58), vec3(4.2, 3.3, 2.0), clamp(head * 1.25, 0.0, 1.0));
    vec3 stillCore = mix(vec3(0.95, 1.35, 1.65), vec3(2.8, 3.2, 3.6), clamp(head * 1.25, 0.0, 1.0));
    vec3 col = mix(radiantCore, stillCore, uStill);
    col = mix(col, vec3(2.9, 2.35, 1.55), uTransition * 0.58);

    float alpha = clamp(intensity, 0.0, 1.0);
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      alpha *= 1.0 - fogFactor;
    #endif
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const trailGlowFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform float uHead;
  uniform float uDirection;
  uniform float uStill;
  uniform float uTransition;
  uniform float uGather;
  varying vec2 vUv;

  void main() {
    float crossD = abs(vUv.y - 0.5) * 2.0;
    float crossProfile = pow(1.0 - smoothstep(0.0, 1.0, crossD), mix(2.1, 3.4, uGather));

    float d1 = uDirection > 0.0
      ? fract(uHead - vUv.x)
      : fract(vUv.x - uHead);
    float d2 = fract(d1 + 0.5);

    float headGlow = exp(-d1 * 38.0) * 0.95;
    float tailGlow = exp(-d1 * 5.8) * smoothstep(0.4, 0.0, d1) * 0.46;
    float echoGlow = exp(-d2 * 11.0) * smoothstep(0.22, 0.0, d2) * 0.22;

    float alpha = crossProfile * (headGlow + tailGlow + echoGlow) * 0.58;
    alpha *= 1.0 + uTransition * 0.62;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      alpha *= 1.0 - fogFactor;
    #endif
    if (alpha < 0.008) discard;

    vec3 radiantGlow = mix(vec3(1.55, 0.95, 0.36), vec3(2.8, 2.05, 1.05), clamp(headGlow, 0.0, 1.0));
    vec3 stillGlow = mix(vec3(0.68, 1.05, 1.32), vec3(1.65, 2.05, 2.4), clamp(headGlow, 0.0, 1.0));
    vec3 col = mix(radiantGlow, stillGlow, uStill);
    col = mix(col, vec3(2.2, 1.9, 1.3), uTransition * 0.52);
    gl_FragColor = vec4(col, alpha);
  }
`;

const trailSparkVertex = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>

  attribute float aLag;
  attribute float aRadial;
  attribute float aVertical;
  attribute float aSize;
  attribute float aSeed;

  uniform float uHead;
  uniform float uDirection;
  uniform float uTime;
  uniform float uStill;
  uniform float uTransition;
  uniform float uPixelRatio;

  varying float vAlpha;
  varying float vStill;
  varying float vHeadProximity;

  void main() {
    // Cluster sparks near the moving head and trailing tail (or echo)
    float branch = aSeed > 0.78 ? 0.5 : 0.0;
    float turn = fract(uHead - uDirection * (aLag + branch));
    float theta = turn * 6.2831853;

    float drift = sin(uTime * 1.6 + aSeed * 19.0) * 0.014;
    float r = 1.0 + aRadial + drift;
    vec3 p = vec3(
      cos(theta) * r,
      aVertical + cos(uTime * 1.3 + aSeed * 11.0) * 0.012,
      sin(theta) * r
    );

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float twinkle = 0.45 + 0.55 * sin(uTime * 3.4 + aSeed * 31.0);
    float tailFade = exp(-aLag * 6.5) * smoothstep(0.38, 0.0, aLag);
    vAlpha = twinkle * tailFade * (branch > 0.1 ? 0.55 : 1.0) * (1.0 + uTransition * 0.7);
    vStill = uStill;
    vHeadProximity = exp(-aLag * 24.0);

    float ptSize = aSize * (0.75 + 0.65 * vHeadProximity) * mix(1.0, 0.78, uStill);
    ptSize *= 1.0 + uTransition * 0.18;
    gl_PointSize = clamp(ptSize * uPixelRatio * (6.8 / max(-mvPosition.z, 0.25)), 0.0, 42.0);
    #include <fog_vertex>
  }
`;

const trailSparkFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  varying float vAlpha;
  varying float vStill;
  varying float vHeadProximity;
  uniform float uTransition;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float falloff = exp(-r2 * 3.6) * (1.0 - r2);
    float alpha = falloff * vAlpha * (1.0 + uTransition * 0.35);
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      alpha *= 1.0 - fogFactor;
    #endif
    if (alpha < 0.015) discard;

    vec3 warm = mix(vec3(1.85, 1.25, 0.55), vec3(3.6, 2.8, 1.75), vHeadProximity);
    vec3 cool = mix(vec3(0.88, 1.28, 1.62), vec3(2.2, 2.6, 3.0), vHeadProximity);
    vec3 col = mix(warm, cool, vStill);
    col = mix(col, vec3(2.4, 2.0, 1.36), uTransition * 0.50);
    gl_FragColor = vec4(col, alpha);
  }
`;

function createTrailSparksGeometry(count, seed) {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const lag = new Float32Array(count);
  const radial = new Float32Array(count);
  const vertical = new Float32Array(count);
  const size = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Index 0 is pinned right at the leading head (lag = 0) so the head has a crisp point flare
    const isLead = i === 0;
    const u = isLead ? 0 : Math.pow(rand(), 1.55) * 0.34;
    lag[i] = u;
    radial[i] = isLead ? 0 : (rand() - 0.5) * 0.075;
    vertical[i] = isLead ? 0 : (rand() - 0.5) * 0.045;
    size[i] = isLead ? 12.5 : 3.2 + rand() * 4.6;
    seeds[i] = isLead ? 0.1 : rand();
    // Initial unit-circle positions so Box3 bounds stay strictly on the unit orbit
    const angle = (i / count) * Math.PI * 2;
    positions[i * 3] = Math.cos(angle);
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(angle);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aLag', new THREE.BufferAttribute(lag, 1));
  geo.setAttribute('aRadial', new THREE.BufferAttribute(radial, 1));
  geo.setAttribute('aVertical', new THREE.BufferAttribute(vertical, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  return geo;
}

function createTrailInstance(spec, tubeGeo, ribbonGeo, sparkCount, seed) {
  const holder = new THREE.Group();
  holder.name = spec.name;

  const coreMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uHead: { value: 0 },
        uDirection: { value: spec.direction },
        uStill: { value: 0 },
        uTime: { value: 0 },
        uTransition: { value: 0 },
      },
    ]),
    vertexShader: trailVertex,
    fragmentShader: trailCoreFragment,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });

  const glowMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uHead: { value: 0 },
        uDirection: { value: spec.direction },
        uStill: { value: 0 },
        uTransition: { value: 0 },
        uGather: { value: 0 },
      },
    ]),
    vertexShader: trailVertex,
    fragmentShader: trailGlowFragment,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: true,
  });

  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.6) : 1;
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uHead: { value: 0 },
        uDirection: { value: spec.direction },
        uTime: { value: 0 },
        uStill: { value: 0 },
        uTransition: { value: 0 },
        uPixelRatio: { value: dpr },
      },
    ]),
    vertexShader: trailSparkVertex,
    fragmentShader: trailSparkFragment,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });

  const coreMesh = new THREE.Mesh(tubeGeo, coreMat);
  const glowMesh = new THREE.Mesh(ribbonGeo, glowMat);

  const sparkGeo = createTrailSparksGeometry(sparkCount, seed);
  const sparks = new THREE.Points(sparkGeo, sparkMat);

  glowMesh.renderOrder = 2;
  coreMesh.renderOrder = 3;
  sparks.renderOrder = 4;

  holder.add(glowMesh, coreMesh, sparks);

  return {
    spec,
    holder,
    coreMesh,
    glowMesh,
    sparks,
    coreMat,
    glowMat,
    sparkMat,
  };
}

/**
 * Upright world-space inscribed halo and two slender moving orbital light
 * trails, presented as a standalone gold-on-dark stage element.
 */
export function createRings(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const group = new THREE.Group();
  group.name = 'rings';

  const rig = new THREE.Group();
  rig.name = 'rings-rig';
  group.add(rig);

  const low = isLowQuality();
  const texSize = low ? 1024 : 2048;

  // 1. Upright gold halo (outer inscription + inner astrolabe)
  const halo = new THREE.Group();
  halo.name = 'halo';
  rig.add(halo);

  const R = HALO_POSE.radius;
  const outerTex = createUprightHaloOuterTexture(texSize, config.glyphDensity);
  const innerTex = createUprightHaloInnerTexture(texSize);

  const haloGlowMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color().setRGB(1.48, 0.92, 0.34) },
        uOpacity: { value: 1 },
        uStill: { value: 0 },
        uGather: { value: 0 },
      },
    ]),
    vertexShader: haloDiscVertex,
    fragmentShader: haloGlowFragment,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    fog: true,
  });

  const haloOuterMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uMap: { value: outerTex },
        uColor: { value: new THREE.Color().setRGB(1.86, 1.36, 0.64) },
        uOpacity: { value: 1 },
      },
    ]),
    vertexShader: haloDiscVertex,
    fragmentShader: haloCrispFragment,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    fog: true,
  });

  const haloInnerMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uMap: { value: innerTex },
        uColor: { value: new THREE.Color().setRGB(1.68, 1.22, 0.58) },
        uOpacity: { value: 1 },
      },
    ]),
    vertexShader: haloDiscVertex,
    fragmentShader: haloCrispFragment,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    fog: true,
  });

  const haloPlaneGeo = new THREE.PlaneGeometry(R * 2, R * 2);
  const haloGlowMesh = new THREE.Mesh(haloPlaneGeo, haloGlowMat);
  haloGlowMesh.position.z = -0.0012;
  haloGlowMesh.renderOrder = 1;

  const haloOuterMesh = new THREE.Mesh(haloPlaneGeo, haloOuterMat);
  haloOuterMesh.renderOrder = 2;

  const haloInnerMesh = new THREE.Mesh(haloPlaneGeo, haloInnerMat);
  haloInnerMesh.position.z = 0.0012;
  haloInnerMesh.renderOrder = 2;

  halo.add(haloGlowMesh, haloOuterMesh, haloInnerMesh);

  // 2. Two slender moving orbital light trails
  const segments = low ? 144 : 240;
  const tubeGeo = createOrbitTubeGeometry(config.trailThickness, segments, 8);
  const ribbonGeo = createCrossedOrbitRibbonGeometry(config.glowWidth, segments);
  const sparkCount = low ? 24 : 44;

  const trails = TRAIL_SPECS.map((spec, index) => {
    const trail = createTrailInstance(
      spec,
      tubeGeo,
      ribbonGeo,
      sparkCount,
      0x7a11 + index * 97,
    );
    rig.add(trail.holder);
    return trail;
  });

  let lastTime = 0;

  function applyPoseAndMaterials(time) {
    const t = Number.isFinite(time) ? time : 0;
    const pulse = 0.94 + 0.06 * Math.sin(t * 0.9);

    halo.position.set(...HALO_POSE.radiant.position);
    halo.scale.setScalar(HALO_POSE.radiant.scale);
    halo.rotation.x = HALO_POSE.radiant.tiltX;
    haloOuterMesh.rotation.z = t * 0.016 * config.speed;
    haloInnerMesh.rotation.z = -t * 0.032 * config.speed;
    haloGlowMat.uniforms.uColor.value.setRGB(1.48, 0.92, 0.34);
    haloGlowMat.uniforms.uStill.value = 0;
    haloGlowMat.uniforms.uGather.value = 0;
    haloGlowMat.uniforms.uOpacity.value = 0.92 * pulse;
    haloOuterMat.uniforms.uOpacity.value = 1;
    haloInnerMat.uniforms.uOpacity.value = 0.94;

    // Update both moving trails deterministically from time.
    for (let i = 0; i < trails.length; i++) {
      const trail = trails[i];
      const { radiant, speed, phase } = trail.spec;
      const wobble = 0.016;
      trail.holder.position.set(
        radiant.position[0],
        radiant.position[1] + Math.sin(t * 0.55 + i * 1.7) * 0.015,
        radiant.position[2],
      );
      trail.holder.scale.set(radiant.radiusX, 1, radiant.radiusZ);
      trail.holder.rotation.set(
        radiant.tiltX + Math.sin(t * 0.24 + phase) * wobble,
        0,
        radiant.tiltZ + Math.cos(t * 0.2 + phase) * wobble,
      );

      const rate = speed * config.speed;
      const head = (((phase + (trail.spec.direction * t * rate) / (Math.PI * 2)) % 1) + 1) % 1;

      trail.coreMat.uniforms.uHead.value = head;
      trail.coreMat.uniforms.uStill.value = 0;
      trail.coreMat.uniforms.uTime.value = t;
      trail.coreMat.uniforms.uTransition.value = 0;

      trail.glowMat.uniforms.uHead.value = head;
      trail.glowMat.uniforms.uStill.value = 0;
      trail.glowMat.uniforms.uTransition.value = 0;
      trail.glowMat.uniforms.uGather.value = 0;

      trail.sparkMat.uniforms.uHead.value = head;
      trail.sparkMat.uniforms.uStill.value = 0;
      trail.sparkMat.uniforms.uTime.value = t;
      trail.sparkMat.uniforms.uTransition.value = 0;
    }
  }

  const onResize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, isLowQuality() ? 1.15 : 1.6);
    for (const trail of trails) {
      trail.sparkMat.uniforms.uPixelRatio.value = dpr;
    }
  };
  window.addEventListener('resize', onResize);

  applyPoseAndMaterials(0);

  return {
    group,
    config,
    update(time, dt) {
      void dt;
      lastTime = Number.isFinite(time) ? time : lastTime;
      applyPoseAndMaterials(lastTime);
    },
    dispose() {
      window.removeEventListener('resize', onResize);
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
