import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const MAX_RIPPLES = 8;

const waveGlsl = /* glsl */ `
uniform vec4 uRipples[${MAX_RIPPLES}];
uniform float uRippleTime;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float cloudyFbm(vec2 p) {
  float v = 0.0;
  v += 0.56 * valueNoise(p);
  p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.02 + vec2(4.7, 1.9);
  v += 0.30 * valueNoise(p);
  p = mat2(0.8, 0.6, -0.6, 0.8) * p * 1.98 + vec2(2.3, 8.1);
  v += 0.14 * valueNoise(p);
  return v;
}

float packetWave(vec2 xz, vec2 center, float rate, float phaseOffset, float maxRadius, float freq) {
  float age = fract(uTime * rate + phaseOffset);
  float life = sin(age * 3.14159265) * smoothstep(0.0, 0.15, age) * smoothstep(1.0, 0.25, age);
  vec2 rel = xz - center;
  float r = length(rel);
  float warp = (valueNoise(rel * 1.7 + center) - 0.5) * 0.09;
  float rw = max(0.0, r + warp);
  float front = 0.20 + age * maxRadius;
  // Multi-wavelet packet envelope that decays with distance and never forms a thick painted band
  float packet = exp(-pow(rw - front, 2.0) * 6.8) * exp(-r * 0.85) * smoothstep(0.05, 0.22, r);
  float wave = sin((rw - front) * freq) + 0.35 * sin((rw - front) * freq * 1.65 + 0.8);
  return wave * packet * life;
}

vec2 evaluateWater(vec2 xz) {
  // Localized ripple field beneath the figure that perturbs the reflection into horizontal wavy bands
  vec2 centerRel = vec2(xz.x * 0.88, (xz.y - 0.25) * 0.95);
  float dCenter = length(centerRel);
  float centerMask = exp(-dCenter * dCenter * 0.34) * smoothstep(2.8, 0.12, dCenter);
  float centerWarp = (valueNoise(xz * 1.75 - vec2(0.0, uTime * 0.22)) - 0.5) * 0.14;
  float w1 = sin((dCenter + centerWarp) * 14.5 - uTime * 1.55);
  float w2 = sin((dCenter - centerWarp * 0.65) * 23.0 - uTime * 2.15 + 1.1) * 0.38;
  float centerRings = (w1 + w2) * centerMask * 0.14;

  // Restrained, finite-lifetime localized ripple packets away from the central platform
  float pktA = packetWave(xz, vec2(-2.15, 0.78), 0.105, 0.18, 1.50, 15.5);
  float pktB = packetWave(xz, vec2(2.25, 0.44), 0.088, 0.62, 1.45, 14.8);
  float pktC = packetWave(xz, vec2(-0.72, 1.85), 0.076, 0.83, 1.32, 16.0);
  float localPackets = (pktA * 0.16 + pktB * 0.14 + pktC * 0.12);

  // Interactive pointer-generated ripples with finite lifetime and multi-wavelet ring packets
  float pointerWaves = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 rp = uRipples[i];
    float strength = rp.w;
    if (strength > 0.001) {
      float age = uRippleTime - rp.z;
      if (age >= 0.0 && age < 4.2) {
        float normAge = age / 4.2;
        float env = smoothstep(0.0, 0.04, normAge) * pow(1.0 - normAge, 1.55) * strength;
        vec2 rel = xz - rp.xy;
        float r = length(rel);
        float warp = (valueNoise(rel * 1.6 + rp.xy) - 0.5) * 0.09;
        float rw = max(0.0, r + warp);
        float front = 0.14 + age * 0.78;
        float band = exp(-pow(rw - front, 2.0) * 5.2) * exp(-r * 0.70) * smoothstep(0.03, 0.18, r);
        float wave = sin((rw - front) * 16.0) + 0.32 * sin((rw - front) * 26.0 + 0.6);
        pointerWaves += wave * band * env * 0.28;
      }
    }
  }

  // Broad, non-repetitive background swell that fades out smoothly
  float dOrigin = length(xz);
  float swellEnv = exp(-dOrigin * 0.11) * smoothstep(28.0, 3.0, dOrigin);
  vec2 warped = xz * 0.34 + vec2(uTime * 0.06, -uTime * 0.045);
  float gentleSwell = (valueNoise(warped) - 0.5) * 0.16 * swellEnv;

  float totalHeight = centerRings + localPackets + pointerWaves + gentleSwell;
  float packetActivity = clamp(abs(localPackets) * 1.5 + abs(pointerWaves) * 2.1, 0.0, 1.0);
  return vec2(totalHeight, packetActivity);
}

float waveHeight(vec2 xz) {
  return evaluateWater(xz).x;
}
`;

const reflectorShader = {
  name: 'SeraphFloor',
  uniforms: {
    color: { value: new THREE.Color(0xffffff) },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uRippleTime: { value: 0 },
    uDisplace: { value: 0 },
    uStill: { value: 0 },
    uTransition: { value: 0 },
    uGather: { value: 0 },
    uDeep: { value: new THREE.Color(0x090808) },
    uShallow: { value: new THREE.Color(0x171412) },
    uCloudTint: { value: new THREE.Color(0x231c15) },
    uReflFacing: { value: 0.28 },
    uReflGrazing: { value: 0.46 },
    uDistort: { value: 0.014 },
    uBlur: { value: 0.0062 },
    uMoonDir: { value: new THREE.Vector3(0.4, 0.8, -0.4) },
    uMoonStrength: { value: 0 },
    uFogColor: { value: new THREE.Color(0x151210) },
    uFogDensity: { value: 0.014 },
    uHorizonGlow: { value: new THREE.Color(0xb89254) },
    uRipples: {
      value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)),
    },
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
    uniform float uTransition;
    uniform float uGather;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec3 uCloudTint;
    uniform float uReflFacing;
    uniform float uReflGrazing;
    uniform float uDistort;
    uniform float uBlur;
    uniform vec3 uMoonDir;
    uniform float uMoonStrength;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform vec3 uHorizonGlow;
    varying vec4 vCoord;
    varying vec3 vWorld;
    ${waveGlsl}

    vec3 sampleRefl(vec4 coord) {
      return texture2DProj(tDiffuse, coord).rgb;
    }

    void main() {
      // Fine derivative step so multi-wavelet ripples produce smooth normal slopes without aliasing
      float e = 0.055;
      vec2 w0 = evaluateWater(vWorld.xz);
      float h0 = w0.x;
      float packetActivity = w0.y;
      float hx = waveHeight(vWorld.xz + vec2(e, 0.0));
      float hz = waveHeight(vWorld.xz + vec2(0.0, e));
      float slope = mix(0.85, 1.35, uStill);
      vec3 normal = normalize(vec3((h0 - hx) * slope, 1.0, (h0 - hz) * slope));

      float radialDist = length(vWorld.xz);
      // Localize reflection directly beneath the figure (fading before the mobile foreground HUD)
      vec2 reflFocusVec = vec2(vWorld.x * 0.85, (vWorld.z - 0.55) * 0.72);
      float focusDistSq = dot(reflFocusVec, reflFocusVec);

      vec4 coord = vCoord;
      // Horizontal wave-crest shear breaks vertical reflections into soft horizontal wavy bands
      float horizWaveShear = normal.z * 0.52 * sin(vWorld.x * 2.4 + vWorld.z * 3.1 - uTime * 0.75);
      vec2 distortVec = vec2(
        (normal.x * 1.15 + horizWaveShear) * uDistort,
        normal.z * 0.78 * uDistort
      );
      coord.xy += distortVec * coord.w;

      // Soft multi-ring disk blur that diffuses strongly toward the foreground and outer stage
      float blurScale = uBlur * coord.w * mix(0.95, 2.15, smoothstep(0.30, 2.8, sqrt(focusDistSq)));
      vec2 bx = vec2(blurScale * 1.30, 0.0);
      vec2 by = vec2(0.0, blurScale * 0.90);
      vec2 bd1 = vec2(blurScale * 0.96, blurScale * 0.70);
      vec2 bd2 = vec2(-blurScale * 0.96, blurScale * 0.70);
      vec2 bo1 = vec2(blurScale * 1.84, blurScale * 0.40);
      vec2 bo2 = vec2(-blurScale * 1.84, -blurScale * 0.40);

      vec3 refl = sampleRefl(coord) * 0.20;
      refl += sampleRefl(coord + vec4(bx, 0.0, 0.0)) * 0.12;
      refl += sampleRefl(coord - vec4(bx, 0.0, 0.0)) * 0.12;
      refl += sampleRefl(coord + vec4(by, 0.0, 0.0)) * 0.12;
      refl += sampleRefl(coord - vec4(by, 0.0, 0.0)) * 0.12;
      refl += sampleRefl(coord + vec4(bd1, 0.0, 0.0)) * 0.08;
      refl += sampleRefl(coord - vec4(bd1, 0.0, 0.0)) * 0.08;
      refl += sampleRefl(coord + vec4(bd2, 0.0, 0.0)) * 0.06;
      refl += sampleRefl(coord - vec4(bd2, 0.0, 0.0)) * 0.06;
      refl += sampleRefl(coord + vec4(bo1, 0.0, 0.0)) * 0.02;
      refl += sampleRefl(coord - vec4(bo2, 0.0, 0.0)) * 0.02;

      // Single-stage localized reflection envelope so reflections stay soft and never duplicate the angel on mobile
      float centerFocus = mix(
        mix(0.12, 0.22, uStill),
        1.0,
        exp(-focusDistSq * mix(0.42, 0.34, uStill))
      );
      refl *= mix(0.62, 0.58, uStill);

      vec3 viewDir = normalize(cameraPosition - vWorld);
      float ndv = clamp(dot(normal, viewDir), 0.0, 1.0);
      float fresnel = pow(1.0 - ndv, 4.2);
      float facing = smoothstep(0.0, 0.68, ndv);

      // Broad cloudy depth modulation (deep teal clouds in Still, smoky charcoal-umber in Radiant)
      float cloudsA = cloudyFbm(vWorld.xz * 0.24 + vec2(uTime * 0.014, -uTime * 0.010));
      float cloudsB = cloudyFbm(vWorld.xz * 0.085 - vec2(uTime * 0.008, uTime * 0.012));
      float cloudVal = cloudsA * 0.62 + cloudsB * 0.38;
      float cloudMix = smoothstep(0.24, 0.78, cloudVal);
      float cloudTrough = smoothstep(0.46, 0.16, cloudVal);

      vec3 baseWater = mix(uShallow, uDeep, facing);
      baseWater *= mix(1.0, 0.82, cloudTrough * mix(0.22, 0.45, uStill));
      vec3 water = mix(baseWater, uCloudTint, cloudMix * mix(0.34, 0.58, uStill));

      float reflAmt = mix(uReflFacing, uReflGrazing, fresnel) * centerFocus;
      vec3 col = mix(water, refl, reflAmt);

      // Keep the transformation light close to the figure and its reflection;
      // the floor should gather gold-white without becoming a second flash.
      float transitionPool = uTransition * exp(-dot(vWorld.xz, vWorld.xz) * (0.26 + uGather * 0.14));
      col += mix(vec3(0.18, 0.08, 0.025), vec3(0.16, 0.22, 0.26), uStill)
        * transitionPool * (0.56 + fresnel * 0.72);

      // Warm gold-charcoal pool in Radiant; cool teal-silver mandala bounce in Still
      float underGlow = exp(-dot(vWorld.xz, vWorld.xz) * 0.22);
      col += mix(vec3(0.036, 0.024, 0.011), vec3(0.024, 0.056, 0.068), uStill) * underGlow;

      // Subtle grazing wavelet sheen on active autonomous/pointer ripple packets (no painted bullseye rings)
      float waveletGlint = smoothstep(0.015, 0.085, abs(normal.z) + abs(normal.x)) * packetActivity;
      float rippleRange = smoothstep(5.2, 0.35, radialDist);
      col += mix(vec3(0.09, 0.065, 0.03), vec3(0.11, 0.21, 0.25), uStill) * waveletGlint * rippleRange * mix(0.18, 0.34, uStill);

      // Restrained secondary moon shimmer in Still
      vec3 moonDir = normalize(uMoonDir);
      vec3 halfDir = normalize(moonDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);
      float broad = pow(max(dot(normal, halfDir), 0.0), 16.0);
      col += vec3(0.62, 0.80, 0.90) * (spec * 0.26 + broad * 0.015) * uMoonStrength;

      float contact = exp(-dot(vWorld.xz, vWorld.xz) * 0.42);
      col *= mix(1.0, 0.92, contact * mix(0.18, 0.10, uStill));

      // Seamless horizon blend matching the sky's exact horizon color at h = 0
      vec3 horizonTarget = uFogColor + uHorizonGlow * (0.024 + uStill * 0.045);
      float dist = length(cameraPosition - vWorld);
      float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      float edge = smoothstep(42.0, 10.5, radialDist);
      float horizonVis = edge * (1.0 - fogF);
      col = mix(horizonTarget, col, horizonVis);

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
      uTop: { value: new THREE.Color(0x090808) },
      uHorizon: { value: new THREE.Color(0x151210) },
      uGlow: { value: new THREE.Color(0xb89254) },
      uStill: { value: 0 },
      uTime: { value: 0 },
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
      uniform float uTime;

      float hash21(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        float t = smoothstep(0.0, 0.72, max(h, 0.0));
        vec3 horizonBase = uHorizon + uGlow * (0.024 + uStill * 0.045);
        vec3 col = mix(horizonBase, uTop, t);

        // Subtle cloudy atmospheric depth in the upper sky/horizon
        vec2 cloudUv = dir.xz / (abs(h) + 0.38) * 1.35 + vec2(uTime * 0.008, -uTime * 0.006);
        float cloud = valueNoise(cloudUv) * 0.65 + valueNoise(cloudUv * 2.1 + 3.7) * 0.35;
        float cloudBand = smoothstep(-0.05, 0.12, h) * smoothstep(0.68, 0.10, h);
        col += uGlow * (cloud - 0.45) * cloudBand * mix(0.028, 0.078, uStill);

        // Warm central gold-charcoal halo haze in Radiant; soft teal mist in Still
        float centerAz = exp(-dir.x * dir.x * 2.1) * smoothstep(-1.0, -0.2, dir.z);
        float mistBand = exp(-pow((h - 0.12) * 3.8, 2.0));
        col += uGlow * centerAz * mistBand * mix(0.052, 0.038, uStill);

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
 * Dark charcoal satin stage in the radiant form, deep teal cloudy water with
 * localized ripples in the still form.
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
  mirror.position.y = -0.96;
  mirror.material.toneMapped = false;

  const target = mirror.getRenderTarget();
  target.texture.generateMipmaps = false;
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;

  const sky = createSky();
  const uniforms = mirror.material.uniforms;

  const deepRadiant = new THREE.Color(0x090808);
  const deepStill = new THREE.Color(0x0b2028);
  const shallowRadiant = new THREE.Color(0x171412);
  const shallowStill = new THREE.Color(0x183844);
  const cloudRadiant = new THREE.Color(0x231c15);
  const cloudStill = new THREE.Color(0x26505e);
  const glowRadiant = new THREE.Color(0xb89254);
  const glowStill = new THREE.Color(0x6daab6);

  const group = new THREE.Group();
  group.name = 'floor';
  group.add(sky, mirror);

  const moonDir = new THREE.Vector3(5.4, 5.1, -7.6);
  // The halo scene has no form controller anymore, so initialize the water
  // directly in its restrained gold-on-teal stage state. A small vertical
  // displacement and slightly stronger reflection keep the floor readable as
  // water without turning it into a duplicate halo.
  uniforms.uDeep.value.set(0x091318);
  uniforms.uShallow.value.set(0x1b2427);
  uniforms.uCloudTint.value.set(0x244044);
  uniforms.uReflFacing.value = 0.34;
  uniforms.uReflGrazing.value = 0.54;
  uniforms.uDistort.value = 0.019;
  uniforms.uDisplace.value = 0.006;
  uniforms.uBlur.value = 0.006;
  uniforms.uMoonStrength.value = 0.06;
  let rippleCursor = 0;
  const bootMs = performance.now();

  function nowRippleSeconds() {
    return (performance.now() - bootMs) * 0.001;
  }

  function stillOf(form, t) {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
    return form === 'still' ? clamped : 1 - clamped;
  }

  return {
    group,
    mirror,
    getFloorY() {
      return mirror.position.y;
    },
    addRipple(x, z, strength = 0.85) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const clampedX = THREE.MathUtils.clamp(x, -6.5, 6.5);
      const clampedZ = THREE.MathUtils.clamp(z, -6.5, 6.5);
      const slot = uniforms.uRipples.value[rippleCursor];
      slot.set(clampedX, clampedZ, nowRippleSeconds(), THREE.MathUtils.clamp(strength, 0.1, 1.2));
      rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
    },
    update(time) {
      uniforms.uTime.value = time;
      uniforms.uRippleTime.value = nowRippleSeconds();
      sky.material.uniforms.uTime.value = time;
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
      mirror.position.y = THREE.MathUtils.lerp(-0.96, -0.62, still);
      uniforms.uDeep.value.copy(deepRadiant).lerp(deepStill, still);
      uniforms.uShallow.value.copy(shallowRadiant).lerp(shallowStill, still);
      uniforms.uCloudTint.value.copy(cloudRadiant).lerp(cloudStill, still);
      uniforms.uHorizonGlow.value.copy(glowRadiant).lerp(glowStill, still);
      sky.material.uniforms.uGlow.value.copy(glowRadiant).lerp(glowStill, still);
      uniforms.uReflFacing.value = THREE.MathUtils.lerp(0.28, 0.26, still);
      uniforms.uReflGrazing.value = THREE.MathUtils.lerp(0.46, 0.44, still);
      uniforms.uDistort.value = THREE.MathUtils.lerp(0.012, 0.022, still);
      uniforms.uDisplace.value = THREE.MathUtils.lerp(0.002, 0.010, still);
      uniforms.uBlur.value = THREE.MathUtils.lerp(0.0058, 0.0076, still);
      uniforms.uMoonStrength.value = THREE.MathUtils.lerp(0.0, 0.14, still);
    },
    setTransition(signal) {
      const value = Number(signal?.envelope);
      uniforms.uTransition.value = Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 0;
      const gather = Number(signal?.gather);
      uniforms.uGather.value = Number.isFinite(gather) ? THREE.MathUtils.clamp(gather, 0, 1) : 0;
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
