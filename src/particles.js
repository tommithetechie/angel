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

function isLowQuality() {
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  return narrow || coarse || saveData;
}

function pixelRatioCap() {
  const dpr = window.devicePixelRatio || 1;
  return isLowQuality() ? Math.min(dpr, 1.15) : Math.min(dpr, 1.6);
}

function stillWeight(form, t) {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
  if (form === 'still') return k;
  if (form === 'radiant') return 1 - k;
  return null;
}

function sparkTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function wispTexture() {
  const rand = mulberry32(0xc0ffee);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const x = 30 + rand() * 190;
    const y = 40 + rand() * 170;
    const r = 36 + rand() * 58;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = 0.08 + rand() * 0.16;
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.45, `rgba(255,255,255,${alpha * 0.35})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

const particleVertex = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>

  attribute float aSize;
  attribute float aRadius;
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aY0;
  attribute float aYAmp;
  attribute float aEcc;
  attribute float aTilt;
  attribute float aTwinkle;
  attribute float aSpark;
  attribute float aSeed;

  uniform float uTime;
  uniform float uStill;
  uniform float uPixelRatio;

  varying float vAlpha;
  varying float vWarm;
  varying float vBurst;
  varying float vSeed;

  void main() {
    float ang = aPhase + uTime * aSpeed * mix(1.0, 0.35, uStill);
    float breathe = 1.0 + 0.05 * sin(uTime * 0.28 + aPhase);
    float r = aRadius * breathe;
    vec3 p = vec3(cos(ang) * r, 0.0, sin(ang) * r * aEcc);
    float cx = cos(aTilt);
    float sx = sin(aTilt);
    float y = -p.z * sx;
    float z = p.z * cx;
    p.y = y + aY0 + sin(uTime * 0.22 + aSeed * 6.28318) * aYAmp;
    p.z = z;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float tw = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * aTwinkle + aPhase));
    float burst = pow(max(sin(uTime * 0.62 + aSeed * 57.0), 0.0), 22.0) * aSpark * (1.0 - uStill);
    float gate = mix(1.0, smoothstep(0.1, 0.015, aSeed), uStill);

    vAlpha = gate * tw * mix(1.0, 0.55, uStill);
    vWarm = 1.0 - uStill;
    vBurst = burst;
    vSeed = aSeed;

    float size = aSize * mix(1.0, 0.62, uStill);
    size *= 0.72 + 0.5 * tw;
    size += burst * aSize * 2.8;
    gl_PointSize = clamp(size * uPixelRatio * (7.4 / max(-mvPosition.z, 0.2)), 0.0, 64.0);

    #include <fog_vertex>
  }
`;

const particleFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform sampler2D uSprite;
  varying float vAlpha;
  varying float vWarm;
  varying float vBurst;
  varying float vSeed;

  void main() {
    vec4 tex = texture2D(uSprite, gl_PointCoord);
    if (tex.a < 0.03) discard;
    float tone = fract(vSeed * 7.13);
    vec3 gold = mix(vec3(1.15, 0.68, 0.28), vec3(1.45, 1.12, 0.68), tone);
    vec3 hot = vec3(3.1, 2.35, 1.55);
    vec3 cool = vec3(0.72, 0.84, 1.08);
    float flare = clamp(vBurst * 1.35, 0.0, 1.0);
    vec3 col = mix(gold, hot, flare);
    col = mix(col, cool * mix(1.15, 0.7, vWarm), 1.0 - vWarm);
    float alpha = tex.a * clamp(vAlpha + flare, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
    // Additive blending must fade alpha. Mixing toward fogColor would add the
    // still-form teal fog into the motes.
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      gl_FragColor.a *= 1.0 - fogFactor;
    #endif
  }
`;

const WISPS = [
  { pos: [-1.05, -0.15, 0.55], scale: [3.1, 1.15], opacity: 0.2, phase: 0.4 },
  { pos: [0.85, -0.45, 0.35], scale: [3.6, 1.35], opacity: 0.16, phase: 1.7 },
  { pos: [-1.8, 0.15, -0.15], scale: [2.4, 0.95], opacity: 0.13, phase: 2.4 },
  { pos: [1.65, -0.05, 0.7], scale: [2.6, 1.05], opacity: 0.14, phase: 0.9 },
  { pos: [0.15, -0.85, 0.95], scale: [4.0, 1.45], opacity: 0.12, phase: 3.1 },
  { pos: [-0.35, 0.35, -0.55], scale: [2.2, 0.85], opacity: 0.1, phase: 4.2 },
  { pos: [0.4, -0.25, 1.35], scale: [2.8, 1.0], opacity: 0.11, phase: 5.0 },
];

function buildAttributes(count, sparks, rand) {
  const size = new Float32Array(count);
  const radius = new Float32Array(count);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  const y0 = new Float32Array(count);
  const yAmp = new Float32Array(count);
  const ecc = new Float32Array(count);
  const tilt = new Float32Array(count);
  const twinkle = new Float32Array(count);
  const spark = new Float32Array(count);
  const seed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const roll = rand();
    let r;
    let y;
    let px;
    if (roll < 0.42) {
      r = 0.35 + rand() * 1.55;
      y = -0.2 + rand() * 3.5;
      px = 1.5 + rand() * 2.1;
    } else if (roll < 0.82) {
      r = 1.2 + rand() * 2.3;
      y = -0.9 + rand() * 5.0;
      px = 1.3 + rand() * 2.4;
    } else {
      r = 2.8 + rand() * 2.4;
      y = -1.3 + rand() * 5.6;
      px = 1.2 + rand() * 1.8;
    }
    const isSpark = i >= count - sparks;
    size[i] = isSpark ? 5.5 + rand() * 4.5 : px;
    radius[i] = r;
    const dir = rand() < 0.5 ? -1 : 1;
    speed[i] = dir * (0.045 + rand() * 0.28) * (isSpark ? 1.25 : 1);
    phase[i] = rand() * Math.PI * 2;
    y0[i] = y;
    yAmp[i] = 0.08 + rand() * 0.28;
    ecc[i] = 0.5 + rand() * 0.62;
    tilt[i] = (rand() - 0.5) * 1.7;
    twinkle[i] = 1.4 + rand() * 4.2;
    spark[i] = isSpark ? 1 : 0;
    seed[i] = rand();
  }

  return { size, radius, speed, phase, y0, yAmp, ecc, tilt, twinkle, spark, seed };
}

/**
 * Gold dust, orbiting sparks, and faint wisps near the floor.
 * `marble` is accepted so the shared signature stays stable.
 * Still form keeps a sparse field of cool-white motes.
 */
export function createParticles(marble) {
  void marble;
  const group = new THREE.Group();
  group.name = 'particles';

  const low = isLowQuality();
  const count = low ? 480 : 1680;
  const sparks = low ? 24 : 84;
  const rand = mulberry32(0x0d57);

  const attrs = buildAttributes(count, sparks, rand);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  const bind = (name, array) => geo.setAttribute(name, new THREE.BufferAttribute(array, 1));
  bind('aSize', attrs.size);
  bind('aRadius', attrs.radius);
  bind('aSpeed', attrs.speed);
  bind('aPhase', attrs.phase);
  bind('aY0', attrs.y0);
  bind('aYAmp', attrs.yAmp);
  bind('aEcc', attrs.ecc);
  bind('aTilt', attrs.tilt);
  bind('aTwinkle', attrs.twinkle);
  bind('aSpark', attrs.spark);
  bind('aSeed', attrs.seed);

  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uStill: { value: 0 },
        uPixelRatio: { value: pixelRatioCap() },
        uSprite: { value: sparkTexture() },
      },
    ]),
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  group.add(points);

  const wispMap = wispTexture();
  const wisps = WISPS.slice(0, low ? 3 : WISPS.length).map((spec) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: wispMap,
        color: new THREE.Color().setRGB(0.72, 0.58, 0.38),
        transparent: true,
        depthWrite: false,
        opacity: spec.opacity,
        blending: THREE.NormalBlending,
        fog: true,
      }),
    );
    sprite.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    sprite.scale.set(spec.scale[0], spec.scale[1], 1);
    sprite.userData = spec;
    group.add(sprite);
    return sprite;
  });

  let blend = 0;

  function applyWisps() {
    const fade = 1 - blend;
    for (const sprite of wisps) {
      sprite.material.opacity = sprite.userData.opacity * fade;
      sprite.visible = fade > 0.02;
    }
  }

  const onResize = () => {
    material.uniforms.uPixelRatio.value = pixelRatioCap();
  };
  window.addEventListener('resize', onResize);

  return {
    group,
    update(time, dt) {
      void dt;
      material.uniforms.uTime.value = time;
      material.uniforms.uStill.value = blend;
      applyWisps();
      for (const sprite of wisps) {
        const spec = sprite.userData;
        const drift = Math.sin(time * 0.18 + spec.phase);
        sprite.position.x = spec.pos[0] + drift * 0.18;
        sprite.position.y = spec.pos[1] + Math.cos(time * 0.13 + spec.phase) * 0.08 - blend * 0.35;
        sprite.scale.set(spec.scale[0] * (1 + drift * 0.04), spec.scale[1], 1);
      }
    },
    setForm(form, t) {
      const next = stillWeight(form, t);
      if (next === null) return;
      blend = next;
      material.uniforms.uStill.value = blend;
      applyWisps();
    },
    dispose() {
      window.removeEventListener('resize', onResize);
      geo.dispose();
      const sprite = material.uniforms.uSprite.value;
      if (sprite) sprite.dispose();
      material.dispose();
      wispMap.dispose();
      for (const sprite of wisps) sprite.material.dispose();
      group.removeFromParent();
    },
  };
}
