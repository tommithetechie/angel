import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const waveGlsl = /* glsl */ `
float waveHeight(vec2 xz) {
  float d = length(xz);
  float rings = sin(d * 1.85 - uTime * 0.72);
  float swell = sin(xz.x * 0.42 + xz.y * 0.28 + uTime * 0.28);
  float crossw = sin(xz.x * 1.05 - xz.y * 0.86 + uTime * 0.4);
  return rings * 0.52 + swell * 0.3 + crossw * 0.22;
}
`;

const reflectorShader = {
  name: 'SeraphFloor',
  uniforms: {
    color: { value: new THREE.Color(0xffffff) },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uDisplace: { value: 0 },
    uStill: { value: 0 },
    uDeep: { value: new THREE.Color(0x07060a) },
    uShallow: { value: new THREE.Color(0x100e12) },
    uReflFacing: { value: 0.62 },
    uReflGrazing: { value: 0.94 },
    uDistort: { value: 0.001 },
    uBlur: { value: 0.0012 },
    uMoonDir: { value: new THREE.Vector3(0.4, 0.8, -0.4) },
    uMoonStrength: { value: 0 },
    uFogColor: { value: new THREE.Color(0x0c0b10) },
    uFogDensity: { value: 0.02 },
    uRipple: { value: null },
    uRippleAmt: { value: 0.04 },
    uDetail: { value: 1 },
    uContact: { value: null },
    uContactMatrix: { value: new THREE.Matrix4() },
    uContactStrength: { value: 0.55 },
    uPresence: { value: 0 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    uniform float uTime;
    uniform float uDisplace;
    varying vec4 vCoord;
    varying vec3 vWorld;
    ${waveGlsl}
    void main() {
      vec4 worldFlat = modelMatrix * vec4(position, 1.0);
      float h = waveHeight(worldFlat.xz) * uDisplace;
      vec4 world = modelMatrix * vec4(position + vec3(0.0, 0.0, h), 1.0);
      vWorld = world.xyz;
      vCoord = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D uRipple;
    uniform sampler2D uContact;
    uniform mat4 uContactMatrix;
    uniform float uTime;
    uniform float uStill;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform float uReflFacing;
    uniform float uReflGrazing;
    uniform float uDistort;
    uniform float uBlur;
    uniform float uRippleAmt;
    uniform float uDetail;
    uniform float uContactStrength;
    uniform float uPresence;
    uniform vec3 uMoonDir;
    uniform float uMoonStrength;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    varying vec4 vCoord;
    varying vec3 vWorld;
    ${waveGlsl}

    vec3 sampleRefl(vec4 coord) {
      return texture2DProj(tDiffuse, coord).rgb;
    }

    vec3 rippleAt(vec2 uv) {
      vec3 n = texture2D(uRipple, uv).rgb * 2.0 - 1.0;
      return vec3(n.r, n.b, n.g);
    }

    void main() {
      float e = 0.22;
      float h0 = waveHeight(vWorld.xz);
      float hx = waveHeight(vWorld.xz + vec2(e, 0.0));
      float hz = waveHeight(vWorld.xz + vec2(0.0, e));
      float slope = mix(0.12, 1.7, uStill);
      vec3 waveN = normalize(vec3((h0 - hx) * slope, 1.0, (h0 - hz) * slope));

      vec2 flowA = vWorld.xz * 0.38 + vec2(uTime * 0.017, uTime * 0.011);
      vec2 flowB = vWorld.xz * 0.73 + vec2(-uTime * 0.013, uTime * 0.019);
      vec3 rip = rippleAt(flowA);
      if (uDetail > 0.5) {
        vec3 ripB = rippleAt(flowB);
        rip = normalize(rip + ripB);
      }
      float ripAmt = uRippleAmt;
      vec3 normal = normalize(vec3(waveN.x + rip.x * ripAmt, 1.0, waveN.z + rip.z * ripAmt));

      vec4 coord = vCoord;
      coord.xy += normal.xz * uDistort * coord.w;

      float radial = length(vWorld.xz);
      float viewDist = length(cameraPosition - vWorld);
      float falloff = 1.0 + viewDist * mix(0.01, 0.038, uStill) + radial * mix(0.006, 0.02, uStill);
      float under = exp(-radial * radial * 0.11);
      float blur = uBlur * falloff * coord.w * mix(1.0, mix(0.4, 0.72, uStill), under);

      float ang = fract(sin(dot(vWorld.xz, vec2(127.1, 311.7))) * 43758.5453) * 6.2831853;
      float ca = cos(ang);
      float sa = sin(ang);
      vec2 rot1 = vec2(ca, sa) * blur;
      vec2 rot2 = vec2(-sa, ca) * blur;
      vec3 refl = sampleRefl(coord);
      refl += sampleRefl(coord + vec4(rot1, 0.0, 0.0));
      refl += sampleRefl(coord + vec4(-rot1, 0.0, 0.0));
      refl += sampleRefl(coord + vec4(rot2, 0.0, 0.0));
      refl += sampleRefl(coord + vec4(-rot2, 0.0, 0.0));
      float samples = 5.0;
      if (uDetail > 0.5) {
        vec2 diag = (rot1 + rot2) * 0.65;
        refl += sampleRefl(coord + vec4(diag, 0.0, 0.0));
        refl += sampleRefl(coord + vec4(-diag, 0.0, 0.0));
        refl += sampleRefl(coord + vec4(diag.y, -diag.x, 0.0, 0.0));
        refl += sampleRefl(coord + vec4(-diag.y, diag.x, 0.0, 0.0));
        samples = 9.0;
      }
      refl /= samples;
      refl *= mix(0.98, 0.78, uStill);

      vec3 viewDir = normalize(cameraPosition - vWorld);
      float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);
      float schlick = pow(1.0 - ndv, 5.0);
      float fresnel = mix(uReflFacing, uReflGrazing, schlick);
      float facing = smoothstep(0.0, 0.7, ndv);
      fresnel *= mix(1.0, 0.78, facing * uStill);
      float distFade = smoothstep(40.0, 9.0, radial);
      fresnel *= mix(0.42, 1.0, distFade);
      fresnel = clamp(fresnel, 0.0, 1.0);

      vec3 water = mix(uShallow, uDeep, facing);
      float absorb = mix(0.22, 1.25, facing);
      vec3 beer = exp(-vec3(1.25, 0.38, 0.18) * absorb * uStill);
      vec3 reflected = refl * mix(vec3(1.0), beer, 0.8);
      vec3 col = mix(water * mix(vec3(1.0), beer, 0.45), reflected, fresnel);

      vec3 moonDir = normalize(uMoonDir);
      vec3 halfDir = normalize(moonDir + viewDir);
      float broad = pow(max(dot(normal, halfDir), 0.0), mix(22.0, 70.0, uStill));
      vec3 micro = normalize(mix(vec3(0.0, 1.0, 0.0), rip, mix(0.2, 1.0, uStill)));
      float glint = pow(max(dot(micro, halfDir), 0.0), 520.0);
      float crest = smoothstep(0.58, 0.94, micro.y);
      col += vec3(0.84, 0.91, 1.0) * uMoonStrength * (broad * 0.32 + glint * crest * 2.8);

      vec4 cproj = uContactMatrix * vec4(vWorld, 1.0);
      vec2 suv = cproj.xy / max(cproj.w, 1.0e-4);
      float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
      float edge = smoothstep(0.0, 0.07, suv.x) * smoothstep(1.0, 0.93, suv.x);
      edge *= smoothstep(0.0, 0.07, suv.y) * smoothstep(1.0, 0.93, suv.y);
      float shade = texture2D(uContact, suv).r * inside * edge;
      float ao = smoothstep(0.02, 0.42, shade);
      col *= mix(1.0, mix(0.46, 0.68, uStill), ao * uContactStrength);

      float dist = length(cameraPosition - vWorld);
      float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      float horizon = smoothstep(36.0, 14.0, radial);
      col = mix(uFogColor, col, horizon * (1.0 - fogF));

      gl_FragColor = vec4(col, uPresence);
    }
  `,
};

function createSky() {
  const material = new THREE.ShaderMaterial({
    name: 'SeraphSky',
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x05040a) },
      uHorizon: { value: new THREE.Color(0x0c0b10) },
      uGlow: { value: new THREE.Color(0x8fd4d2) },
      uStill: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform float uStill;
      void main() {
        float h = normalize(vDir).y;
        float t = smoothstep(-0.12, 0.78, h);
        vec3 col = mix(uHorizon, uTop, t);
        float band = exp(-pow(h * 6.5, 2.0));
        col += uGlow * band * (0.01 + uStill * 0.14);
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 36, 22), material);
  sky.name = 'sky';
  sky.frustumCulled = false;
  return sky;
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

function makeNoise(rand, period) {
  const stride = period + 1;
  const g = new Float32Array(stride * stride);
  for (let y = 0; y < period; y++) {
    for (let x = 0; x < period; x++) g[y * stride + x] = rand();
  }
  for (let i = 0; i < period; i++) {
    g[i * stride + period] = g[i * stride];
    g[period * stride + i] = g[i];
  }
  g[period * stride + period] = g[0];
  return (u, v) => {
    let x = u * period;
    let y = v * period;
    x -= Math.floor(x / period) * period;
    y -= Math.floor(y / period) * period;
    if (x < 0) x += period;
    if (y < 0) y += period;
    const x0 = x | 0;
    const y0 = y | 0;
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const i00 = g[y0 * stride + x0];
    const i10 = g[y0 * stride + x0 + 1];
    const i01 = g[(y0 + 1) * stride + x0];
    const i11 = g[(y0 + 1) * stride + x0 + 1];
    const a = i00 + (i10 - i00) * sx;
    const b = i01 + (i11 - i01) * sx;
    return a + (b - a) * sy;
  };
}

function createRippleNormal(size) {
  const rand = mulberry32(0xc0a1);
  const coarse = makeNoise(rand, 6);
  const fine = makeNoise(rand, 18);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      height[y * size + x] = coarse(u, v) * 0.62 + fine(u, v) * 0.38;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const image = canvas.getContext('2d').createImageData(size, size);
  const data = image.data;
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = at(x - 1, y) - at(x + 1, y);
      const dy = at(x, y - 1) - at(x, y + 1);
      let nx = dx * 2.6;
      let nz = dy * 2.6;
      let ny = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const o = (y * size + x) * 4;
      data[o] = (nx * 0.5 + 0.5) * 255;
      data[o + 1] = (nz * 0.5 + 0.5) * 255;
      data[o + 2] = (ny * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Dark mirror in the radiant form, calm rippled water in the still form.
 * One reflector, retinted by setForm — a second reflection pass would
 * double the cost of an already reflected scene.
 */
export function createFloor(scene, quality, contact) {
  const low = Boolean(quality?.low);
  const size = low ? 512 : 1024;
  const segments = low ? 24 : 48;
  const geometry = new THREE.PlaneGeometry(96, 96, segments, segments);
  const ripple = createRippleNormal(low ? 128 : 256);

  const mirror = new Reflector(geometry, {
    textureWidth: size,
    textureHeight: size,
    clipBias: 0.003,
    multisample: 0,
    color: 0xffffff,
    shader: reflectorShader,
  });
  mirror.name = 'reflector';
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -1.08;
  mirror.material.toneMapped = false;

  const target = mirror.getRenderTarget();
  target.texture.generateMipmaps = false;
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;

  const sky = createSky();
  const uniforms = mirror.material.uniforms;
  uniforms.uRipple.value = ripple;
  uniforms.uDetail.value = low ? 0 : 1;
  if (contact) {
    uniforms.uContact.value = contact.texture;
    uniforms.uContactMatrix.value = contact.matrix;
  }

  const deepRadiant = new THREE.Color(0x040308);
  const deepStill = new THREE.Color(0x06141c);
  const shallowRadiant = new THREE.Color(0x040306);
  const shallowStill = new THREE.Color(0x0a2c34);
  const glowRadiant = new THREE.Color(0xc4a36a);
  const glowStill = new THREE.Color(0xb7e4e2);

  const group = new THREE.Group();
  group.name = 'floor';
  group.add(sky, mirror);

  const moonDir = new THREE.Vector3(5.4, 5.1, -7.6);

  function stillOf(form, t) {
    const raw = Number(t);
    const clamped = Number.isFinite(raw) ? THREE.MathUtils.clamp(raw, 0, 1) : 1;
    return form === 'still' ? clamped : 1 - clamped;
  }

  return {
    group,
    mirror,
    update(time) {
      uniforms.uTime.value = time;
      uniforms.uFogColor.value.copy(scene.fog.color);
      uniforms.uFogDensity.value = scene.fog.density;
      sky.material.uniforms.uTop.value.copy(scene.background);
      sky.material.uniforms.uHorizon.value.copy(scene.fog.color);
      uniforms.uMoonDir.value.copy(moonDir);
    },
    setMoonDirection(position) {
      moonDir.copy(position);
    },
    setDetail(isLow) {
      uniforms.uDetail.value = isLow ? 0 : 1;
    },
    /**
     * form is the destination ('radiant' | 'still').
     * t is progress toward that destination, 0 → 1.
     */
    setForm(form, t) {
      if (form !== 'still' && form !== 'radiant') return;
      const still = stillOf(form, t);
      uniforms.uStill.value = still;
      sky.material.uniforms.uStill.value = still;
      uniforms.uDeep.value.copy(deepRadiant).lerp(deepStill, still);
      uniforms.uShallow.value.copy(shallowRadiant).lerp(shallowStill, still);
      sky.material.uniforms.uGlow.value.copy(glowRadiant).lerp(glowStill, still);
      uniforms.uReflFacing.value = THREE.MathUtils.lerp(0.04, 0.18, still);
      uniforms.uReflGrazing.value = THREE.MathUtils.lerp(0.08, 0.84, still);
      uniforms.uPresence.value = still;
      mirror.visible = still > 0.02;
      mirror.material.transparent = still < 0.985;
      mirror.material.depthWrite = still >= 0.985;
      uniforms.uDistort.value = THREE.MathUtils.lerp(0.00035, 0.05, still);
      uniforms.uDisplace.value = THREE.MathUtils.lerp(0.0, 0.032, still);
      uniforms.uBlur.value = THREE.MathUtils.lerp(0.00055, 0.008, still);
      uniforms.uRippleAmt.value = THREE.MathUtils.lerp(0.04, 1.08, still);
      uniforms.uMoonStrength.value = THREE.MathUtils.lerp(0.05, 1.65, still);
      uniforms.uContactStrength.value = THREE.MathUtils.lerp(0.85, 0.55, still);
    },
    dispose() {
      mirror.dispose();
      geometry.dispose();
      ripple.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      group.removeFromParent();
    },
  };
}
