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

// Nearer shards: marble veins mixed with dark stone. The even-index half is
// mostly the outer ring, which a portrait camera never sees.
const LOW_INDEX = [1, 3, 5, 9, 11, 13, 15, 16, 17];

function spanScale(low) {
  if (!low) return { x: 1, y: 1 };
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  if (aspect >= 1) return { x: 1, y: 1 };
  // A 32° portrait camera only sees about a unit of half-width beside the
  // figure. Pull the kept shards in so the field stays on screen.
  return {
    x: Math.max(0.34, Math.min(1, aspect / 1.35)),
    y: Math.max(0.62, Math.min(1, aspect / 0.75)),
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
  // Polyhedron geometries are already non-indexed, one triangle per face.
  const geo =
    kind < 0.4
      ? new THREE.OctahedronGeometry(1, 0)
      : kind < 0.75
        ? new THREE.DodecahedronGeometry(1, 0)
        : new THREE.IcosahedronGeometry(1, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 3) {
    const sx = 0.55 + rand() * 0.85;
    const sy = 0.4 + rand() * 0.9;
    const sz = 0.5 + rand() * 0.75;
    const jx = (rand() - 0.5) * 0.18;
    const jy = (rand() - 0.5) * 0.18;
    const jz = (rand() - 0.5) * 0.18;
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
  const scale = 0.22 + rand() * 0.2;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * scale + ox, uv.getY(i) * scale + oy);
  }
}

function goldVeins(geo, rand) {
  const edges = new THREE.EdgesGeometry(geo, 18);
  const pos = edges.attributes.position;
  const kept = [];
  for (let i = 0; i < pos.count; i += 2) {
    if (rand() < 0.42) {
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

const LAYOUT = [
  [-2.65, 3.15, 0.62, 0.11, 0],
  [-2.25, 2.05, 1.2, 0.17, 1],
  [-2.95, 1.15, 0.28, 0.13, 0],
  [-1.75, 0.05, 1.4, 0.19, 1],
  [-2.55, -0.62, 0.72, 0.14, 0],
  [-1.15, -1.0, 1.1, 0.1, 1],
  [-3.2, 0.45, -0.35, 0.12, 0],
  [2.6, 2.55, 0.9, 0.13, 1],
  [3.0, 1.25, 0.42, 0.18, 0],
  [2.1, 0.15, 1.3, 0.15, 1],
  [2.75, -0.7, 0.68, 0.16, 0],
  [1.25, -1.1, 1.05, 0.11, 1],
  [3.05, 3.2, 0.12, 0.08, 0],
  [-0.9, 3.65, 0.4, 0.07, 0],
  [1.2, 3.75, -0.2, 0.08, 1],
  [0.35, -1.3, 1.55, 0.14, 0],
  [-0.55, 1.15, 1.9, 0.08, 0],
  [1.85, 1.65, -1.2, 0.12, 1],
];

function stoneMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.02,
    clearcoat: 0.08,
    clearcoatRoughness: 0.62,
    envMapIntensity: 0.42,
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
    color: new THREE.Color(0x3a342c),
    emissive: new THREE.Color(0xffd59a),
    emissiveIntensity: 0.42,
    roughness: 0.46,
    metalness: 1,
    clearcoat: 0.12,
    clearcoatRoughness: 0.32,
    envMapIntensity: 1.05,
    flatShading: true,
    side: THREE.FrontSide,
  });
}

/**
 * Low-poly shards drifting around the figure. Some carry the marble's
 * gold veins, some a few bright edges. Still form sinks and fades them.
 */
export function createDebris(marble) {
  const group = new THREE.Group();
  group.name = 'debris';

  const low = isLowQuality();
  const layout = (low ? LOW_INDEX : LAYOUT.map((_, index) => index)).map((index) => ({
    spec: LAYOUT[index],
    index,
  }));
  const fit = spanScale(low);
  const stone = stoneMaterial();
  const veined = veinedMaterial(marble);
  const veinMat = additiveFog(
    new THREE.LineBasicMaterial({
      color: new THREE.Color().setRGB(1.9, 1.35, 0.62),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const shards = layout.map(({ spec, index }) => {
    const rand = mulberry32(0x5eed + index * 131);
    const geo = facetedShard(rand);
    const useMarble = spec[4] === 1 && veined;
    if (useMarble) windowUvs(geo, rand);

    if (!useMarble) {
      const shade = 0.75 + rand() * 0.55;
      const color = new THREE.Color().setRGB(0.34 * shade, 0.31 * shade, 0.27 * shade);
      const colors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < geo.attributes.position.count; i++) {
        const flicker = 0.85 + rand() * 0.3;
        colors[i * 3] = color.r * flicker;
        colors[i * 3 + 1] = color.g * flicker;
        colors[i * 3 + 2] = color.b * flicker;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    const mesh = new THREE.Mesh(geo, useMarble ? veined : stone);
    const y = 1.2 + (spec[1] - 1.2) * fit.y;
    mesh.position.set(spec[0] * fit.x, y, spec[2]);
    mesh.scale.setScalar(spec[3] * (0.85 + rand() * 0.35));
    mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    mesh.userData = {
      base: mesh.position.clone(),
      rot: new THREE.Vector3(
        (rand() - 0.5) * 0.28,
        (rand() - 0.5) * 0.36,
        (rand() - 0.5) * 0.2,
      ),
      phase: rand() * Math.PI * 2,
      freq: 0.12 + rand() * 0.18,
      amp: 0.05 + rand() * 0.09,
      sink: 0.85 + rand() * 1.35,
    };

    if (!useMarble && rand() < 0.72) {
      const veinGeo = goldVeins(geo, rand);
      if (veinGeo) mesh.add(new THREE.LineSegments(veinGeo, veinMat));
    }

    group.add(mesh);
    return mesh;
  });

  let blend = 0;

  function applyFade() {
    const fade = 1 - blend;
    const fading = fade < 0.995;
    for (const mat of [stone, veined]) {
      if (!mat) continue;
      if (mat.transparent !== fading) {
        mat.transparent = fading;
        mat.needsUpdate = true;
      }
      mat.opacity = fade;
      mat.depthWrite = fade > 0.25;
    }
    veinMat.opacity = fade;
    const show = fade > 0.02;
    for (const mesh of shards) mesh.visible = show;
  }

  return {
    group,
    update(time, dt) {
      applyFade();
      for (const mesh of shards) {
        const u = mesh.userData;
        mesh.rotation.x += u.rot.x * dt;
        mesh.rotation.y += u.rot.y * dt;
        mesh.rotation.z += u.rot.z * dt;
        const bob = Math.sin(time * u.freq + u.phase);
        mesh.position.set(
          u.base.x + Math.sin(time * u.freq * 0.62 + u.phase) * u.amp,
          u.base.y + bob * u.amp * 0.85 - blend * u.sink,
          u.base.z + Math.cos(time * u.freq * 0.48 + u.phase) * u.amp * 0.65,
        );
      }
    },
    setForm(form, t) {
      const next = stillWeight(form, t);
      if (next === null) return;
      blend = next;
      applyFade();
    },
    dispose() {
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
