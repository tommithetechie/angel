import * as THREE from 'three';

const SIZE = 1024;

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

function valueNoise(rand, grid) {
  const cells = grid + 1;
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return (x, y) => {
    const gx = x * grid;
    const gy = y * grid;
    const x0 = Math.floor(gx) % grid;
    const y0 = Math.floor(gy) % grid;
    const x1 = (x0 + 1) % grid;
    const y1 = (y0 + 1) % grid;
    const tx = gx - Math.floor(gx);
    const ty = gy - Math.floor(gy);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const i00 = g[y0 * cells + x0];
    const i10 = g[y0 * cells + x1];
    const i01 = g[y1 * cells + x0];
    const i11 = g[y1 * cells + x1];
    const a = i00 + (i10 - i00) * sx;
    const b = i01 + (i11 - i01) * sx;
    return a + (b - a) * sy;
  };
}

function makePaths(rand, count, length) {
  const paths = [];
  for (let i = 0; i < count; i++) {
    let x = rand() * SIZE;
    let y = rand() * SIZE;
    let angle = rand() * Math.PI * 2;
    const points = [{ x, y }];
    const segs = 6 + Math.floor(rand() * 12);
    for (let s = 0; s < segs; s++) {
      angle += (rand() - 0.5) * 1.35;
      const step = length * (0.45 + rand());
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      points.push({ x, y });
      if (rand() < 0.22) {
        const branch = [];
        let bx = x;
        let by = y;
        let ba = angle + (rand() - 0.5) * 1.6;
        const bsegs = 3 + Math.floor(rand() * 5);
        branch.push({ x: bx, y: by });
        for (let b = 0; b < bsegs; b++) {
          ba += (rand() - 0.5) * 1.1;
          bx += Math.cos(ba) * step * 0.7;
          by += Math.sin(ba) * step * 0.7;
          branch.push({ x: bx, y: by });
        }
        paths.push(branch);
      }
    }
    paths.push(points);
  }
  return paths;
}

function strokeWrapped(ctx, paths, style, width) {
  ctx.save();
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const ox of [-SIZE, 0, SIZE]) {
    for (const oy of [-SIZE, 0, SIZE]) {
      ctx.beginPath();
      for (const path of paths) {
        ctx.moveTo(path[0].x + ox, path[0].y + oy);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x + ox, path[i].y + oy);
        }
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintColorCanvas() {
  const rand = mulberry32(0x5a17);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const coarse = valueNoise(rand, 8);
  const fine = valueNoise(rand, 28);
  const image = ctx.createImageData(SIZE, SIZE);
  const data = image.data;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const n = coarse(u, v) * 0.72 + fine(u, v) * 0.28;
      const shade = 168 + n * 58;
      const i = (y * SIZE + x) * 4;
      data[i] = shade;
      data[i + 1] = shade + 1;
      data[i + 2] = shade + 4;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const softVeins = makePaths(rand, 18, 54);
  strokeWrapped(ctx, softVeins, 'rgba(255,255,255,0.16)', 16);
  strokeWrapped(ctx, softVeins, 'rgba(70,72,82,0.13)', 26);

  const cracks = makePaths(rand, 70, 42);
  strokeWrapped(ctx, cracks, 'rgba(4,4,6,0.72)', 9);
  strokeWrapped(ctx, cracks, 'rgba(6,6,8,0.98)', 2.8);

  const gold = cracks.filter((_, i) => i % 2 === 0).concat(makePaths(rand, 22, 34));
  strokeWrapped(ctx, gold, 'rgba(92,58,16,0.7)', 3.4);
  strokeWrapped(ctx, gold, 'rgba(236,188,82,1)', 1.45);

  return { canvas, ctx };
}

function isGold(r, g, b) {
  return r > 145 && g > 80 && b < 140 && r > g + 8 && g > b + 15;
}

function deriveMaps(source) {
  const base = source.getImageData(0, 0, SIZE, SIZE);
  const src = base.data;
  const height = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < height.length; i++) {
    const r = src[i * 4];
    const g = src[i * 4 + 1];
    const b = src[i * 4 + 2];
    height[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  const roughC = document.createElement('canvas');
  const metalC = document.createElement('canvas');
  const emissiveC = document.createElement('canvas');
  const normalC = document.createElement('canvas');
  for (const c of [roughC, metalC, emissiveC, normalC]) {
    c.width = c.height = SIZE;
  }
  const rough = roughC.getContext('2d').createImageData(SIZE, SIZE);
  const metal = metalC.getContext('2d').createImageData(SIZE, SIZE);
  const emissive = emissiveC.getContext('2d').createImageData(SIZE, SIZE);
  const normal = normalC.getContext('2d').createImageData(SIZE, SIZE);

  const at = (x, y) => {
    const xx = (x + SIZE) % SIZE;
    const yy = (y + SIZE) % SIZE;
    return height[yy * SIZE + xx];
  };

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const o = i * 4;
      const r = src[o];
      const g = src[o + 1];
      const b = src[o + 2];
      const gold = isGold(r, g, b);
      const lum = height[i];
      const crack = !gold && lum < 0.28;

      const roughV = gold ? 48 : crack ? 210 : 70 + (1 - lum) * 40;
      rough.data[o] = rough.data[o + 1] = rough.data[o + 2] = roughV;
      rough.data[o + 3] = 255;

      const metalV = gold ? 255 : 0;
      metal.data[o] = metal.data[o + 1] = metal.data[o + 2] = metalV;
      metal.data[o + 3] = 255;

      if (gold) {
        emissive.data[o] = 255;
        emissive.data[o + 1] = 206;
        emissive.data[o + 2] = 120;
      }
      emissive.data[o + 3] = 255;

      const dx = at(x - 1, y) - at(x + 1, y);
      const dy = at(x, y - 1) - at(x, y + 1);
      const strength = gold ? 3.4 : 4.2;
      let nx = dx * strength;
      let ny = dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      normal.data[o] = (nx * 0.5 + 0.5) * 255;
      normal.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      normal.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      normal.data[o + 3] = 255;
    }
  }

  const put = (canvas, image) => {
    canvas.getContext('2d').putImageData(image, 0, 0);
    return canvas;
  };

  return {
    color: source.canvas,
    roughness: put(roughC, rough),
    metalness: put(metalC, metal),
    emissive: put(emissiveC, emissive),
    normal: put(normalC, normal),
  };
}

function canvasTexture(canvas, colorSpace, renderer) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

function applyMaps(material, textures) {
  material.map = textures.map;
  material.roughnessMap = textures.roughnessMap;
  material.metalnessMap = textures.metalnessMap;
  material.normalMap = textures.normalMap;
  material.emissiveMap = textures.emissiveMap;
  material.emissive = new THREE.Color(0xffd59a);
  material.emissiveIntensity = 2.2;
  material.roughness = 1;
  material.metalness = 1;
  material.normalScale = new THREE.Vector2(1.1, 1.1);
  material.clearcoat = 0.4;
  material.clearcoatRoughness = 0.32;
  material.envMapIntensity = 0.24;
}

/**
 * Pale stone, dark fissures, and thin gold kintsugi.
 * One MeshPhysicalMaterial keeps real environment reflections;
 * the metalness map makes only the veins metallic.
 */
export function createMarble(renderer) {
  const painted = paintColorCanvas();
  const maps = deriveMaps(painted.ctx);

  const textures = {
    map: canvasTexture(maps.color, THREE.SRGBColorSpace, renderer),
    roughnessMap: canvasTexture(maps.roughness, THREE.NoColorSpace, renderer),
    metalnessMap: canvasTexture(maps.metalness, THREE.NoColorSpace, renderer),
    emissiveMap: canvasTexture(maps.emissive, THREE.SRGBColorSpace, renderer),
    normalMap: canvasTexture(maps.normal, THREE.NoColorSpace, renderer),
  };
  const repeat = new THREE.Vector2(1.8, 2.7);
  for (const tex of Object.values(textures)) tex.repeat.copy(repeat);

  const body = new THREE.MeshPhysicalMaterial();
  applyMaps(body, textures);

  const wing = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  applyMaps(wing, textures);
  wing.envMapIntensity = 0.2;
  wing.emissiveIntensity = 1.35;
  // Feathers are instanced. Project marble from each feather's position
  // so the cracks continue across the wing as one stone surface.
  wing.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      /* glsl */ `
        #if defined( USE_UV ) || defined( USE_ANISOTROPY )
          vUv = uv;
        #endif
        vec3 featherPos = (instanceMatrix * vec4(position, 1.0)).xyz;
        vec2 featherUv = featherPos.xy * 0.92;
        #ifdef USE_MAP
          vMapUv = featherUv;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = featherUv;
        #endif
        #ifdef USE_METALNESSMAP
          vMetalnessMapUv = featherUv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = featherUv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = featherUv;
        #endif
      `,
    );
  };
  wing.customProgramCacheKey = () => 'marble-wing-uv';

  return { body, wing, textures };
}
