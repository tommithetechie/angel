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
  uniform float uTransition;
  uniform float uPixelRatio;

  varying float vAlpha;
  varying float vWarm;
  varying float vBurst;
  varying float vSeed;
  varying float vBokeh;

  void main() {
    // Radiant orbital motion around the figure, halo, and trails
    float angRad = aPhase + uTime * aSpeed;
    float breathe = 1.0 + 0.045 * sin(uTime * 0.28 + aPhase);
    float rRad = aRadius * breathe;
    vec3 pRad = vec3(cos(angRad) * rRad, 0.0, sin(angRad) * rRad * aEcc);
    float cx = cos(aTilt);
    float sx = sin(aTilt);
    float yTilt = -pRad.z * sx;
    float zTilt = pRad.z * cx;
    pRad.y = yTilt + aY0 + sin(uTime * 0.22 + aSeed * 6.28318) * aYAmp;
    pRad.z = zTilt;

    // Still rising motion: cool fine particles rising through the mandala + water-level motes
    float roleRoll = fract(aSeed * 17.3);
    bool isColumn = roleRoll < 0.58;
    bool isSurface = !isColumn && roleRoll < 0.80;
    float rScaleStill = isColumn
      ? mix(0.25, 0.58, fract(aSeed * 9.1))
      : isSurface
        ? mix(0.48, 0.88, fract(aSeed * 11.3))
        : mix(0.68, 1.02, fract(aSeed * 5.7));
    float rStill = aRadius * rScaleStill;
    float angStill = aPhase + uTime * aSpeed * (isSurface ? 0.24 : 0.14) + sin(uTime * 0.18 + aSeed * 12.0) * 0.14;
    float riseLow = isColumn ? -0.18 : isSurface ? -0.52 : -0.38;
    float riseSpan = isColumn ? 2.78 : isSurface ? 0.92 : 2.95;
    float riseSpeed = (0.038 + fract(aSeed * 23.1) * 0.062) * (isColumn ? 1.12 : isSurface ? 0.55 : 0.72);
    float riseProg = fract((aY0 - riseLow) / riseSpan + uTime * riseSpeed + aSeed);
    float yStill = riseLow + riseProg * riseSpan;
    // Gentle outward flare near the top of the mandala column so it never pinches into a sharp cone
    float columnFlare = isColumn ? mix(0.88, 1.18, smoothstep(0.15, 0.90, riseProg)) : 1.0;
    float driftX = sin(yStill * 1.45 + aSeed * 19.0 + uTime * 0.22) * 0.08;
    float driftZ = cos(yStill * 1.25 + aSeed * 13.0 + uTime * 0.18) * 0.08;
    vec3 pStill = vec3(
      cos(angStill) * rStill * columnFlare + driftX,
      yStill,
      sin(angStill) * rStill * mix(0.72, 1.0, aEcc) - 0.16 + driftZ
    );

    vec3 p = mix(pRad, pStill, uStill);

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float tw = 0.38 + 0.62 * (0.5 + 0.5 * sin(uTime * aTwinkle + aPhase));
    float isBokeh = step(1.5, aSpark);
    float isNormalSpark = step(0.5, aSpark) * (1.0 - isBokeh);
    float burst = pow(max(sin(uTime * 0.62 + aSeed * 57.0), 0.0), 22.0) * isNormalSpark * (1.0 - uStill);

    // Radiant concentrates dust around the halo/figure and keeps outer charcoal corners clean
    float radRadialFade = smoothstep(3.05, 1.25, aRadius);
    float radGate = mix(0.10, 1.0, radRadialFade);

    // Still keeps a rich rising column of cool motes with smooth vertical fade-in/out
    float riseEnv = smoothstep(0.0, 0.14, riseProg) * smoothstep(1.0, 0.64, riseProg);
    float stillKeep = smoothstep(0.94, 0.14, aSeed);
    float stillGate = stillKeep * riseEnv * (isColumn ? 1.22 : isSurface ? 1.05 : 0.72);

    float gate = mix(radGate, stillGate, uStill);
    float bokehAlpha = mix(0.34, 0.24, uStill) * (0.78 + 0.22 * tw);

    vAlpha = mix(gate * tw * mix(0.90, 0.96, uStill), bokehAlpha, isBokeh);
    vAlpha *= 1.0 + uTransition * 0.42;
    vWarm = 1.0 - uStill;
    vBurst = burst;
    vSeed = aSeed;
    vBokeh = isBokeh;

    float size = aSize * mix(1.0, isColumn ? 1.18 : 0.94, uStill);
    size *= 0.76 + 0.48 * tw;
    size += burst * aSize * 2.4;
    if (isBokeh > 0.5) {
      size = aSize * mix(1.0, 0.88, uStill);
    }
    gl_PointSize = clamp(size * uPixelRatio * (7.4 / max(-mvPosition.z, 0.2)), 0.0, 64.0);

    #include <fog_vertex>
  }
`;

const particleFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform sampler2D uSprite;
  uniform float uTransition;
  varying float vAlpha;
  varying float vWarm;
  varying float vBurst;
  varying float vSeed;
  varying float vBokeh;

  void main() {
    vec4 tex = texture2D(uSprite, gl_PointCoord);
    if (tex.a < 0.020) discard;
    float tone = fract(vSeed * 7.13);
    vec3 gold = mix(vec3(1.12, 0.76, 0.34), vec3(1.48, 1.20, 0.76), tone);
    vec3 hot = vec3(2.65, 2.08, 1.42);
    vec3 cool = mix(vec3(0.80, 1.00, 1.12), vec3(1.18, 1.26, 1.36), tone);
    float flare = clamp(vBurst * 1.25, 0.0, 1.0);
    vec3 warmCol = mix(gold, hot, flare);
    vec3 col = mix(cool, warmCol, vWarm);
    col = mix(col, vec3(2.2, 1.86, 1.22), uTransition * 0.48);

    // Soft out-of-focus foreground bokeh disc with a warm ivory/cool ice core
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float bokehCore = smoothstep(0.48, 0.06, d) * 0.55;
    float bokehHalo = exp(-d * d * 2.4) * smoothstep(1.0, 0.06, d);
    float bokehShape = clamp(bokehHalo + bokehCore, 0.0, 1.0);
    col = mix(col, mix(vec3(1.15, 1.24, 1.32), vec3(1.45, 1.28, 0.98), vWarm), vBokeh * 0.55);
    float shapeAlpha = mix(tex.a, bokehShape, vBokeh);

    float alpha = shapeAlpha * clamp(vAlpha + flare + uTransition * 0.12, 0.0, 1.0);
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
  { pos: [0.0, 1.92, -0.92], scale: [4.2, 2.8], radOpacity: 0.14, stillOpacity: 0.16, phase: 0.4 },
  { pos: [-1.15, -0.32, 0.25], scale: [3.2, 1.15], radOpacity: 0.10, stillOpacity: 0.13, phase: 1.7 },
  { pos: [0.95, -0.48, 0.20], scale: [3.4, 1.20], radOpacity: 0.09, stillOpacity: 0.13, phase: 2.4 },
  { pos: [-1.75, 0.48, -0.45], scale: [3.0, 1.35], radOpacity: 0.09, stillOpacity: 0.14, phase: 0.9 },
  { pos: [1.65, 0.38, -0.35], scale: [3.0, 1.30], radOpacity: 0.09, stillOpacity: 0.14, phase: 3.1 },
  { pos: [0.10, -0.76, 0.55], scale: [3.8, 1.20], radOpacity: 0.08, stillOpacity: 0.11, phase: 4.2 },
  { pos: [0.0, 0.98, -1.30], scale: [4.6, 2.35], radOpacity: 0.11, stillOpacity: 0.17, phase: 5.0 },
];

function buildAttributes(count, sparks, bokehCount, rand) {
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

  const bokehSlots = [
    [-1.48, 0.08, 0.55],
    [1.36, -0.06, 0.62],
    [-1.68, 0.62, 0.35],
    [1.58, 0.48, 0.38],
    [-0.96, -0.28, 0.72],
  ];

  for (let i = 0; i < count; i++) {
    const roll = rand();
    let r;
    let y;
    let px;
    if (roll < 0.58) {
      // Inner halo & figure column
      r = 0.26 + rand() * 1.28;
      y = -0.12 + rand() * 3.25;
      px = 1.45 + rand() * 2.10;
    } else if (roll < 0.90) {
      // Mid-range orbital & rising field
      r = 1.10 + rand() * 1.48;
      y = -0.68 + rand() * 3.95;
      px = 1.25 + rand() * 2.00;
    } else {
      // Restrained outer atmospheric motes
      r = 2.25 + rand() * 1.35;
      y = -0.85 + rand() * 4.10;
      px = 1.00 + rand() * 1.35;
    }
    const isBokeh = i >= count - bokehCount;
    const isSpark = !isBokeh && i >= count - bokehCount - sparks;
    if (isSpark && r < 0.88) r += 0.68;
    let ph = rand() * Math.PI * 2;
    if (isBokeh) {
      const slot = bokehSlots[(i - (count - bokehCount)) % bokehSlots.length];
      r = Math.hypot(slot[0], slot[2]);
      ph = Math.atan2(slot[2], slot[0]);
      y = slot[1];
    } else if (isSpark && Math.sin(ph) > 0 && Math.abs(Math.cos(ph) * r) < 0.72 && y > -0.1 && y < 2.4) {
      // Keep foreground sparks from overlapping the central dark torso/pelvis/face in the hero view
      ph += Math.PI;
    }
    size[i] = isBokeh ? 32.0 + rand() * 12.0 : isSpark ? 4.4 + rand() * 3.2 : px;
    radius[i] = r;
    const dir = rand() < 0.5 ? -1 : 1;
    speed[i] = dir * (0.04 + rand() * 0.24) * (isSpark ? 1.2 : isBokeh ? 0.14 : 1);
    phase[i] = ph;
    y0[i] = y;
    yAmp[i] = isBokeh ? 0.04 + rand() * 0.05 : 0.07 + rand() * 0.24;
    ecc[i] = isBokeh ? 0.92 : 0.54 + rand() * 0.56;
    tilt[i] = isBokeh ? 0.05 : (rand() - 0.5) * 1.45;
    twinkle[i] = 1.3 + rand() * 3.8;
    spark[i] = isBokeh ? 2 : isSpark ? 1 : 0;
    seed[i] = rand();
  }

  return { size, radius, speed, phase, y0, yAmp, ecc, tilt, twinkle, spark, seed };
}

/**
 * Charcoal-and-gold dust, soft peripheral bokeh, and warm haze in Radiant;
 * cool fine rising particles and deep-teal cloudy mist in Still.
 */
export function createParticles(marble) {
  void marble;
  const group = new THREE.Group();
  group.name = 'particles';

  const low = isLowQuality();
  const count = low ? 480 : 1560;
  const sparks = low ? 20 : 64;
  const bokehCount = low ? 3 : 5;
  const rand = mulberry32(0x0d57);

  const attrs = buildAttributes(count, sparks, bokehCount, rand);
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
        uTransition: { value: 0 },
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
  const radWispColor = new THREE.Color().setRGB(0.56, 0.43, 0.25);
  const stillWispColor = new THREE.Color().setRGB(0.15, 0.36, 0.43);
  const transitionWispColor = new THREE.Color(0xffe4b6);

  const wisps = WISPS.slice(0, low ? 4 : WISPS.length).map((spec) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: wispMap,
        color: radWispColor.clone(),
        transparent: true,
        depthWrite: false,
        opacity: spec.radOpacity,
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
  let transitionEnvelope = 0;

  function applyWisps() {
    for (const sprite of wisps) {
      const spec = sprite.userData;
      sprite.material.color.copy(radWispColor).lerp(stillWispColor, blend);
      sprite.material.color.lerp(transitionWispColor, transitionEnvelope * 0.24);
      sprite.material.opacity = THREE.MathUtils.lerp(spec.radOpacity, spec.stillOpacity, blend) + transitionEnvelope * 0.035;
      sprite.visible = sprite.material.opacity > 0.01;
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
      material.uniforms.uTransition.value = transitionEnvelope;
      applyWisps();
      for (const sprite of wisps) {
        const spec = sprite.userData;
        const drift = Math.sin(time * 0.16 + spec.phase);
        sprite.position.x = spec.pos[0] + drift * 0.16;
        sprite.position.y = spec.pos[1] + Math.cos(time * 0.12 + spec.phase) * 0.07 - blend * 0.22;
        sprite.scale.set(spec.scale[0] * (1 + drift * 0.04), spec.scale[1] * (1 + blend * 0.12), 1);
      }
    },
    setForm(form, t) {
      const next = stillWeight(form, t);
      if (next === null) return;
      blend = next;
      material.uniforms.uStill.value = blend;
      applyWisps();
    },
    setTransition(signal) {
      const value = Number(signal?.envelope);
      transitionEnvelope = Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 0;
      material.uniforms.uTransition.value = transitionEnvelope;
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
