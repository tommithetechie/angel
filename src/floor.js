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
    uReflFacing: { value: 0.74 },
    uReflGrazing: { value: 0.9 },
    uDistort: { value: 0.001 },
    uBlur: { value: 0.0012 },
    uMoonDir: { value: new THREE.Vector3(0.4, 0.8, -0.4) },
    uMoonStrength: { value: 0 },
    uFogColor: { value: new THREE.Color(0x0c0b10) },
    uFogDensity: { value: 0.02 },
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
    uniform float uTime;
    uniform float uStill;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform float uReflFacing;
    uniform float uReflGrazing;
    uniform float uDistort;
    uniform float uBlur;
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

    void main() {
      float e = 0.22;
      float h0 = waveHeight(vWorld.xz);
      float hx = waveHeight(vWorld.xz + vec2(e, 0.0));
      float hz = waveHeight(vWorld.xz + vec2(0.0, e));
      float slope = mix(0.15, 2.4, uStill);
      vec3 normal = normalize(vec3((h0 - hx) * slope, 1.0, (h0 - hz) * slope));

      vec4 coord = vCoord;
      coord.xy += normal.xz * uDistort * coord.w;
      float blur = uBlur * coord.w;
      vec3 refl = sampleRefl(coord);
      refl += sampleRefl(coord + vec4(blur, 0.0, 0.0, 0.0));
      refl += sampleRefl(coord + vec4(-blur, 0.0, 0.0, 0.0));
      refl += sampleRefl(coord + vec4(0.0, blur, 0.0, 0.0));
      refl += sampleRefl(coord + vec4(0.0, -blur, 0.0, 0.0));
      refl *= 0.2;
      refl *= mix(0.95, 0.64, uStill);

      vec3 viewDir = normalize(cameraPosition - vWorld);
      float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);
      float fresnel = pow(1.0 - ndv, 4.0);
      float facing = smoothstep(0.0, 0.65, ndv);
      vec3 water = mix(uShallow, uDeep, facing);
      float reflAmt = mix(uReflFacing, uReflGrazing, fresnel);
      vec3 col = mix(water, refl, reflAmt);

      vec3 moonDir = normalize(uMoonDir);
      vec3 halfDir = normalize(moonDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), mix(28.0, 70.0, 1.0 - uStill));
      float broad = pow(max(dot(normal, halfDir), 0.0), 8.0);
      col += vec3(0.72, 0.82, 1.0) * (spec * 1.15 + broad * 0.07) * uMoonStrength;

      float contact = exp(-dot(vWorld.xz, vWorld.xz) * 0.28);
      col *= mix(1.0, 0.78, contact * mix(0.5, 0.18, uStill));

      float dist = length(cameraPosition - vWorld);
      float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      float edge = smoothstep(36.0, 14.0, length(vWorld.xz));
      col = mix(uFogColor, col, edge * (1.0 - fogF));

      gl_FragColor = vec4(col, 1.0);
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

/**
 * Dark mirror in the radiant form, calm rippled water in the still form.
 * One reflector, retinted by setForm — a second reflection pass would
 * double the cost of an already reflected scene.
 */
export function createFloor(scene, quality) {
  const size = quality.low ? 512 : 1024;
  const segments = quality.low ? 24 : 40;
  const geometry = new THREE.PlaneGeometry(96, 96, segments, segments);

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

  const deepRadiant = new THREE.Color(0x07060a);
  const deepStill = new THREE.Color(0x0d4450);
  const shallowRadiant = new THREE.Color(0x121016);
  const shallowStill = new THREE.Color(0x2f8f98);
  const glowRadiant = new THREE.Color(0xc4a36a);
  const glowStill = new THREE.Color(0xb7e4e2);

  const group = new THREE.Group();
  group.name = 'floor';
  group.add(sky, mirror);

  const moonDir = new THREE.Vector3(5.4, 5.1, -7.6);

  function stillOf(form, t) {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
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
    /**
     * form is the destination ('radiant' | 'still').
     * t is progress toward that destination, 0 → 1.
     */
    setForm(form, t) {
      const still = stillOf(form, t);
      uniforms.uStill.value = still;
      sky.material.uniforms.uStill.value = still;
      uniforms.uDeep.value.copy(deepRadiant).lerp(deepStill, still);
      uniforms.uShallow.value.copy(shallowRadiant).lerp(shallowStill, still);
      sky.material.uniforms.uGlow.value.copy(glowRadiant).lerp(glowStill, still);
      uniforms.uReflFacing.value = THREE.MathUtils.lerp(0.9, 0.28, still);
      uniforms.uReflGrazing.value = THREE.MathUtils.lerp(0.97, 0.7, still);
      uniforms.uDistort.value = THREE.MathUtils.lerp(0.0004, 0.046, still);
      uniforms.uDisplace.value = THREE.MathUtils.lerp(0.0, 0.028, still);
      uniforms.uBlur.value = THREE.MathUtils.lerp(0.0008, 0.0065, still);
      uniforms.uMoonStrength.value = THREE.MathUtils.lerp(0.0, 1.35, still);
    },
    dispose() {
      mirror.dispose();
      geometry.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      group.removeFromParent();
    },
  };
}
