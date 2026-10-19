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
function stillWeight(form, t) {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
  if (form === 'still') return k;
  if (form === 'radiant') return 1 - k;
  return null;
}

// Sparse peripheral subset for narrow/low-quality devices, chosen from
// upper-outer and lower-outer corners well clear of the wings and halo.
const LOW_INDEX = new Set([0, 2, 4, 6, 8, 10, 12, 14]);

function spanScale() {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  if (aspect >= 1) return { x: 1, y: 1 };
  // Portrait camera widens FOV up to 44° so the full wing span fits on screen.
  // Keep peripheral chips outside the wing tips rather than pulling them onto the figure.
  return {
    x: Math.max(0.68, Math.min(1, aspect / 0.85)),
    y: Math.max(0.88, Math.min(1, aspect / 0.65)),
  };
}

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

function facetedShard(rand) {
  const kind = rand();
  // Thin, flaky stone/ivory chip geometry rather than bulky polyhedra
  const geo =
    kind < 0.55
      ? new THREE.OctahedronGeometry(1, 0)
      : new THREE.DodecahedronGeometry(1, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 3) {
    const sx = 0.54 + rand() * 0.62;
    const sy = 0.38 + rand() * 0.54;
    const sz = 0.14 + rand() * 0.20;
    const jx = (rand() - 0.5) * 0.10;
    const jy = (rand() - 0.5) * 0.10;
    const jz = (rand() - 0.5) * 0.05;
    for (let k = 0; k < 3; k++) {
      pos.setXYZ(
        i + k,
        pos.getX(i + k) * sx + jx,
        pos.getY(i + k) * sy + jy,
        pos.getZ(i + k) * sz + jz,
      );
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function windowUvs(geo, rand) {
  const uv = geo.attributes.uv;
  if (!uv) return;
  const ox = rand();
  const oy = rand();
  const scale = 0.18 + rand() * 0.16;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * scale + ox, uv.getY(i) * scale + oy);
  }
}

function goldVeins(geo, rand) {
  const edges = new THREE.EdgesGeometry(geo, 28);
  const pos = edges.attributes.position;
  const kept = [];
  for (let i = 0; i < pos.count; i += 2) {
    if (rand() < 0.20 && kept.length < 24) {
      kept.push(
        pos.getX(i),
        pos.getY(i),
        pos.getZ(i),
        pos.getX(i + 1),
        pos.getY(i + 1),
        pos.getZ(i + 1),
      );
    }
  }
  edges.dispose();
  if (kept.length < 6) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
  return g;
}

// [x, y, z, scale, kind, floatsInStill]:
// kind 0 = dark charcoal chip, kind 1 = veined dark/gold chip, kind 2 = pale ivory chip
// All positions stay in the outer periphery clear of the six wings, body, and halo.
const LAYOUT = [
  [-2.28, 2.95, -0.15, 0.072, 0, false],
  [-2.58, 1.98, 0.22, 0.082, 2, false],
  [-2.38, 0.68, 0.35, 0.076, 1, false],
  [-2.62, -0.16, -0.10, 0.080, 0, true],
  [-1.95, -0.68, 0.42, 0.068, 2, true],
  [-1.58, 3.28, -0.32, 0.062, 1, false],
  [-1.72, -0.42, 0.28, 0.066, 0, true],
  [-2.15, 1.32, -0.22, 0.070, 2, false],
  [2.26, 2.88, -0.12, 0.074, 2, false],
  [2.60, 1.84, 0.18, 0.080, 0, false],
  [2.40, 0.62, 0.32, 0.074, 1, false],
  [2.68, -0.22, -0.14, 0.078, 0, true],
  [1.98, -0.72, 0.38, 0.066, 2, true],
  [1.62, 3.24, -0.28, 0.060, 0, false],
  [1.76, -0.38, 0.26, 0.064, 2, true],
  [2.18, 1.24, -0.18, 0.068, 1, false],
];

function stoneMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.16,
    clearcoat: 0.34,
    clearcoatRoughness: 0.32,
    envMapIntensity: 0.68,
    flatShading: true,
    vertexColors: true,
  });
}

function veinedMaterial(marble) {
  const source = marble && marble.body;
  if (!source) return null;
  // Share the marble maps without cloning the body material. A clone would
  // join the marble shader list and pick up its onBeforeCompile program.
  return new THREE.MeshPhysicalMaterial({
    map: source.map || null,
    roughnessMap: source.roughnessMap || null,
    metalnessMap: source.metalnessMap || null,
    emissiveMap: source.emissiveMap || null,
    color: new THREE.Color(0x28231e),
    emissive: new THREE.Color(0xffca7a),
    emissiveIntensity: 0.38,
    roughness: 0.50,
    metalness: 0.82,
    clearcoat: 0.28,
    clearcoatRoughness: 0.34,
    envMapIntensity: 0.58,
    flatShading: true,
    side: THREE.FrontSide,
  });
}

/**
 * Restrained peripheral dark charcoal and pale ivory chips drifting around
 * the outer stage. Still form settles a few quiet flakes near the water.
 */
export function createDebris(marble) {
  const group = new THREE.Group();
  group.name = 'debris';

  const stone = stoneMaterial();
  const veined = veinedMaterial(marble);
  const veinMat = additiveFog(
    new THREE.LineBasicMaterial({
      color: new THREE.Color().setRGB(0.84, 0.62, 0.30),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const shards = LAYOUT.map((spec, index) => {
    const rand = mulberry32(0x5eed + index * 131);
    const geo = facetedShard(rand);
    const kind = spec[4];
    const floatsInStill = Boolean(spec[5]);
    const useMarble = kind === 1 && veined;
    if (useMarble) windowUvs(geo, rand);

    if (!useMarble) {
      const isPaleChip = kind === 2;
      const shade = isPaleChip ? 0.78 + rand() * 0.16 : 0.42 + rand() * 0.26;
      const color = isPaleChip
        ? new THREE.Color().setRGB(0.90 * shade, 0.87 * shade, 0.80 * shade)
        : new THREE.Color().setRGB(0.28 * shade, 0.24 * shade, 0.20 * shade);
      const colors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < geo.attributes.position.count; i++) {
        const flicker = 0.86 + rand() * 0.26;
        colors[i * 3] = color.r * flicker;
        colors[i * 3 + 1] = color.g * flicker;
        colors[i * 3 + 2] = color.b * flicker;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    const mesh = new THREE.Mesh(geo, useMarble ? veined : stone);
    const baseScale = spec[3] * (0.90 + rand() * 0.22);
    const rot0 = new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    mesh.scale.setScalar(baseScale);
    mesh.rotation.copy(rot0);
    mesh.userData = {
      spec,
      index,
      base: new THREE.Vector3(),
      baseScale,
      floatsInStill,
      lowAllowed: true,
      rot0,
      rot: new THREE.Vector3(
        (rand() - 0.5) * 0.22,
        (rand() - 0.5) * 0.28,
        (rand() - 0.5) * 0.16,
      ),
      phase: rand() * Math.PI * 2,
      freq: 0.11 + rand() * 0.15,
      amp: 0.035 + rand() * 0.055,
      sink: 0.75 + rand() * 0.95,
      stillY: -0.48 + (rand() - 0.5) * 0.12,
    };

    if (!useMarble && kind === 0 && rand() < 0.65) {
      const veinGeo = goldVeins(geo, rand);
      if (veinGeo) mesh.add(new THREE.LineSegments(veinGeo, veinMat));
    }

    group.add(mesh);
    return mesh;
  });

  let blend = 0;
  let transitionEnvelope = 0;
  let lastTime = 0;

  function updateLayoutFit() {
    const low = isLowQuality();
    const fit = spanScale();
    for (const mesh of shards) {
      const u = mesh.userData;
      const spec = u.spec;
      u.lowAllowed = !low || LOW_INDEX.has(u.index);
      const y = 1.2 + (spec[1] - 1.2) * fit.y;
      u.base.set(spec[0] * fit.x, y, spec[2]);
    }
  }

  function applyState(time) {
    const formScale = Math.max(0, 1.0 - blend * 1.15);
    veinMat.opacity = formScale * 0.74 + transitionEnvelope * 0.42;
    for (const mesh of shards) {
      const u = mesh.userData;
      const visible = u.lowAllowed && formScale > 0.02;
      mesh.visible = visible;
      if (!visible) continue;
      mesh.scale.setScalar(u.baseScale * formScale * (1 + transitionEnvelope * 0.08));
      mesh.rotation.set(
        u.rot0.x + u.rot.x * time,
        u.rot0.y + u.rot.y * time,
        u.rot0.z + u.rot.z * time,
      );
      const bob = Math.sin(time * u.freq + u.phase);
      mesh.position.set(
        u.base.x + Math.sin(time * u.freq * 0.62 + u.phase) * u.amp,
        u.base.y + bob * u.amp * 0.85 - blend * u.sink,
        u.base.z + Math.cos(time * u.freq * 0.48 + u.phase) * u.amp * 0.65,
      );
    }
  }

  const onResize = () => {
    updateLayoutFit();
    applyState(lastTime);
  };
  window.addEventListener('resize', onResize);

  updateLayoutFit();
  applyState(0);

  return {
    group,
    update(time, dt) {
      void dt;
      lastTime = time;
      applyState(time);
    },
    setForm(form, t) {
      const next = stillWeight(form, t);
      if (next === null) return;
      blend = next;
      applyState(lastTime);
    },
    setTransition(signal) {
      const value = Number(signal?.envelope);
      transitionEnvelope = Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 0;
      applyState(lastTime);
    },
    dispose() {
      window.removeEventListener('resize', onResize);
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
      });
      stone.dispose();
      if (veined) veined.dispose();
      veinMat.dispose();
      group.removeFromParent();
    },
  };
}
