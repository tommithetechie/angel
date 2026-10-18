import * as THREE from 'three';

const SIZE = 1024;
const LOW = 512;
const CELLS = 22;

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
  const p = period;
  const stride = p + 1;
  const g = new Float32Array(stride * stride);
  for (let y = 0; y < p; y++) {
    for (let x = 0; x < p; x++) g[y * stride + x] = rand();
  }
  for (let i = 0; i < p; i++) {
    g[i * stride + p] = g[i * stride];
    g[p * stride + i] = g[i];
  }
  g[p * stride + p] = g[0];
  return (u, v) => {
    let x = u * p;
    let y = v * p;
    x -= Math.floor(x / p) * p;
    y -= Math.floor(y / p) * p;
    if (x < 0) x += p;
    if (y < 0) y += p;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
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

function fbm(noise, u, v, octaves) {
  let sum = 0;
  let weight = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += weight * noise(u * freq, v * freq);
    norm += weight;
    freq *= 2;
    weight *= 0.5;
  }
  return sum / norm;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function mix3(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function hash01(a, b) {
  let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function wrapDelta(d) {
  const half = SIZE * 0.5;
  if (d > half) return d - SIZE;
  if (d < -half) return d + SIZE;
  return d;
}

function makePaths(rand, count, step, wander, branchChance) {
  const paths = [];
  for (let i = 0; i < count; i++) {
    let x = rand() * SIZE;
    let y = rand() * SIZE;
    let angle = rand() * Math.PI * 2;
    const points = [{ x, y }];
    const segs = 10 + Math.floor(rand() * 12);
    for (let s = 0; s < segs; s++) {
      angle += (rand() - 0.5) * wander;
      const len = step * (0.55 + rand());
      x += Math.cos(angle) * len;
      y += Math.sin(angle) * len;
      points.push({ x, y });
      if (rand() < branchChance && s > 2) {
        const branch = [{ x, y }];
        let bx = x;
        let by = y;
        let ba = angle + (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.8);
        const bsegs = 3 + Math.floor(rand() * 5);
        for (let b = 0; b < bsegs; b++) {
          ba += (rand() - 0.5) * wander * 0.8;
          bx += Math.cos(ba) * len * 0.72;
          by += Math.sin(ba) * len * 0.72;
          branch.push({ x: bx, y: by });
        }
        paths.push(branch);
      }
    }
    paths.push(points);
  }
  return paths;
}

const WRAPS = [
  [-SIZE, -SIZE],
  [0, -SIZE],
  [SIZE, -SIZE],
  [-SIZE, 0],
  [0, 0],
  [SIZE, 0],
  [-SIZE, SIZE],
  [0, SIZE],
  [SIZE, SIZE],
];

function strokeWrapped(ctx, paths, style, width) {
  ctx.save();
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [ox, oy] of WRAPS) {
    ctx.beginPath();
    for (const path of paths) {
      ctx.moveTo(path[0].x + ox, path[0].y + oy);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x + ox, path[i].y + oy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function strokePhase(ctx, paths, width) {
  const period = 320;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  for (const path of paths) {
    let dist = hash01(Math.floor(path[0].x), Math.floor(path[0].y)) * period;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const p0 = (dist % period) / period;
      const p1 = ((dist + len) % period) / period;
      for (const [ox, oy] of WRAPS) {
        const grad = ctx.createLinearGradient(a.x + ox, a.y + oy, b.x + ox, b.y + oy);
        const c0 = `rgb(${(p0 * 255) | 0},0,0)`;
        const c1 = `rgb(${(p1 * 255) | 0},0,0)`;
        if (p1 >= p0) {
          grad.addColorStop(0, c0);
          grad.addColorStop(1, c1);
        } else {
          const cut = Math.min(0.97, Math.max(0.03, (period - (dist % period)) / len));
          grad.addColorStop(0, c0);
          grad.addColorStop(cut, 'rgb(255,0,0)');
          grad.addColorStop(Math.min(0.995, cut + 0.02), 'rgb(0,0,0)');
          grad.addColorStop(1, c1);
        }
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(a.x + ox, a.y + oy);
        ctx.lineTo(b.x + ox, b.y + oy);
        ctx.stroke();
      }
      dist += len;
    }
  }
  ctx.restore();
}

function paintStone(rand) {
  const low = document.createElement('canvas');
  low.width = low.height = LOW;
  const lowCtx = low.getContext('2d', { willReadFrequently: true });
  const image = lowCtx.createImageData(LOW, LOW);
  const data = image.data;
  const warpN = makeNoise(rand, 16);
  const cloudN = makeNoise(rand, 32);
  const ivory = [247, 244, 237];
  const cream = [233, 227, 216];
  const mist = [206, 208, 212];
  const gray = [158, 162, 170];
  const slate = [92, 96, 104];
  const ink = [48, 50, 56];

  for (let y = 0; y < LOW; y++) {
    const v = y / LOW;
    for (let x = 0; x < LOW; x++) {
      const u = x / LOW;
      const wx = fbm(warpN, u, v, 4);
      const wy = fbm(warpN, u + 5.2, v + 1.3, 4);
      const uu = u + (wx - 0.5) * 0.42;
      const vv = v + (wy - 0.5) * 0.42;
      const cloud = fbm(cloudN, uu * 1.25, vv * 1.35, 5);
      const fine = fbm(cloudN, uu * 3.4 + 2.0, vv * 3.1, 3);
      const flow = uu * 1.55 + (wx - 0.5) * 1.15 + cloud * 0.22;
      const band = Math.abs(Math.sin(flow * Math.PI * 2));
      const vein = smoothstep(0.34, 0.02, band);
      const thread = Math.abs(Math.sin((vv * 4.2 + wy * 2.4) * Math.PI * 2));
      const vein2 = smoothstep(0.1, 0.0, thread) * (0.35 + fine * 0.45);

      let rgb = mix3(ivory, cream, cloud * 0.72);
      rgb = mix3(rgb, mist, Math.max(0, fine - 0.42) * 0.55);
      rgb = mix3(rgb, gray, vein * 0.62);
      rgb = mix3(rgb, slate, vein * vein * 0.5 + vein2 * 0.42);
      rgb = mix3(rgb, ink, vein2 * vein * 0.35);

      const o = (y * LOW + x) * 4;
      data[o] = clampByte(rgb[0]);
      data[o + 1] = clampByte(rgb[1]);
      data[o + 2] = clampByte(rgb[2]);
      data[o + 3] = 255;
    }
  }
  lowCtx.putImageData(image, 0, 0);

  const color = document.createElement('canvas');
  color.width = color.height = SIZE;
  const ctx = color.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(low, 0, 0, SIZE, SIZE);

  const soft = makePaths(rand, 7, 70, 0.85, 0.12);
  strokeWrapped(ctx, soft, 'rgba(132,136,144,0.20)', 22);
  strokeWrapped(ctx, soft, 'rgba(74,78,86,0.30)', 6);

  const threads = makePaths(rand, 16, 46, 1.05, 0.2);
  strokeWrapped(ctx, threads, 'rgba(58,62,70,0.45)', 3.2);
  strokeWrapped(ctx, threads, 'rgba(22,24,28,0.82)', 1.25);

  return { color, ctx };
}

function buildCrackle(rand, stone) {
  const sites = CELLS * CELLS;
  const sitesX = new Float32Array(sites);
  const sitesY = new Float32Array(sites);
  const cell = SIZE / CELLS;
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
      const k = j * CELLS + i;
      sitesX[k] = (i + 0.5 + (rand() - 0.5) * 0.86) * cell;
      sitesY[k] = (j + 0.5 + (rand() - 0.5) * 0.86) * cell;
    }
  }

  const warp = makeNoise(rand, 8);
  const src = stone.getImageData(0, 0, SIZE, SIZE);
  const base = src.data;
  const color = new Uint8ClampedArray(base);
  const rough = new Uint8ClampedArray(SIZE * SIZE * 4);
  const metal = new Uint8ClampedArray(SIZE * SIZE * 4);
  const emissive = new Uint8ClampedArray(SIZE * SIZE * 4);
  const height = new Float32Array(SIZE * SIZE);
  const phase = new Uint8Array(SIZE * SIZE);

  const ivoryLum = 240 / 255;

  for (let y = 0; y < SIZE; y++) {
    const row = y * SIZE;
    for (let x = 0; x < SIZE; x++) {
      const o = (row + x) * 4;
      const u = x / SIZE;
      const v = y / SIZE;
      let sx = x + (warp(u * 2.2, v * 2.2) - 0.5) * 18;
      let sy = y + (warp(u * 2.2 + 3.1, v * 2.2 + 1.4) - 0.5) * 18;
      let px = sx % SIZE;
      let py = sy % SIZE;
      if (px < 0) px += SIZE;
      if (py < 0) py += SIZE;
      const cx = Math.min(CELLS - 1, (px / cell) | 0);
      const cy = Math.min(CELLS - 1, (py / cell) | 0);

      let d1 = 1e12;
      let d2 = 1e12;
      let i1 = 0;
      let i2 = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const iy = (cy + oy + CELLS) % CELLS;
        for (let ox = -1; ox <= 1; ox++) {
          const ix = (cx + ox + CELLS) % CELLS;
          const idx = iy * CELLS + ix;
          const dx = wrapDelta(sx - sitesX[idx]);
          const dy = wrapDelta(sy - sitesY[idx]);
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            i2 = i1;
            d1 = d;
            i1 = idx;
          } else if (d < d2) {
            d2 = d;
            i2 = idx;
          }
        }
      }

      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const lo = i1 < i2 ? i1 : i2;
      const hi = i1 < i2 ? i2 : i1;
      const fade = hash01(lo + 3, hi * 17 + 1);
      const strength = smoothstep(0.12, 0.48, fade);
      const isGold = fade > 0.6;
      const crack = smoothstep(5.4, 0.35, edge) * (0.28 + 0.72 * strength);
      const gold = isGold ? smoothstep(3.15, 0.2, edge) * strength : 0;
      const goldCore = isGold ? smoothstep(1.35, 0.12, edge) * strength : 0;
      const glow = isGold ? smoothstep(8.2, 0.6, edge) * strength : 0;

      const br = base[o];
      const bg = base[o + 1];
      const bb = base[o + 2];
      const lum = (0.299 * br + 0.587 * bg + 0.114 * bb) / 255;
      const softVein = smoothstep(ivoryLum, 0.55, lum);

      let r = br;
      let g = bg;
      let b = bb;
      const ink = Math.min(1, crack * 0.92);
      r = r * (1 - ink) + 14 * ink;
      g = g * (1 - ink) + 15 * ink;
      b = b * (1 - ink) + 18 * ink;
      const gr = 196 + goldCore * 59;
      const gg = 132 + goldCore * 96;
      const gb = 48 + goldCore * 92;
      r = r * (1 - gold) + gr * gold;
      g = g * (1 - gold) + gg * gold;
      b = b * (1 - gold) + gb * gold;

      color[o] = clampByte(r);
      color[o + 1] = clampByte(g);
      color[o + 2] = clampByte(b);
      color[o + 3] = 255;

      const grain = hash01(x, y);
      let roughV = 42 + grain * 18 + softVein * 28;
      roughV = mix(roughV, 168, Math.min(1, crack * (1 - gold)));
      roughV = mix(roughV, 36 + grain * 14, gold);
      roughV = mix(roughV, 24, goldCore);
      const rb = clampByte(roughV);
      rough[o] = rough[o + 1] = rough[o + 2] = rb;
      rough[o + 3] = 255;

      const metalV = clampByte(smoothstep(0.18, 0.72, gold) * 255);
      metal[o] = metal[o + 1] = metal[o + 2] = metalV;
      metal[o + 3] = 255;

      const e = Math.min(1, gold * 0.72 + glow * 0.38);
      if (e > 0.004) {
        emissive[o] = clampByte(255 * e);
        emissive[o + 1] = clampByte((168 + goldCore * 70) * e);
        emissive[o + 2] = clampByte((64 + goldCore * 70) * e);
      }
      emissive[o + 3] = 255;

      const micro = hash01(x * 3 + 11, y * 5 + 2);
      let h = 0.58 + (micro - 0.5) * 0.045 + (grain - 0.5) * 0.02;
      h -= softVein * 0.07;
      h -= crack * 0.2;
      h += goldCore * 0.11;
      height[row + x] = h;

      if (gold > 0.25) {
        let ax = sitesX[i1];
        let ay = sitesY[i1];
        const adx = wrapDelta(sitesX[i2] - ax);
        const ady = wrapDelta(sitesY[i2] - ay);
        const ppx = wrapDelta(sx - ax);
        const ppy = wrapDelta(sy - ay);
        const len = Math.hypot(adx, ady) || 1;
        const along = (ppx * adx + ppy * ady) / len;
        const period = 280;
        const t = ((along % period) + period) % period;
        phase[row + x] = (t / period) * 255;
      }
    }
  }

  stone.putImageData(new ImageData(color, SIZE, SIZE), 0, 0);
  return { rough, metal, emissive, height, phase };
}

function layHeroVeins(rand, colorCtx, maps) {
  const heroes = makePaths(rand, 8, 58, 0.72, 0.28);
  strokeWrapped(colorCtx, heroes, 'rgba(8,8,10,0.95)', 8);
  strokeWrapped(colorCtx, heroes, '#7a4e12', 4.6);
  strokeWrapped(colorCtx, heroes, '#e7b44a', 2.5);
  strokeWrapped(colorCtx, heroes, '#ffe6b0', 1.05);

  const mask = document.createElement('canvas');
  mask.width = mask.height = SIZE;
  const maskCtx = mask.getContext('2d', { willReadFrequently: true });
  maskCtx.globalCompositeOperation = 'lighter';
  strokeWrapped(maskCtx, heroes, 'rgb(255,0,0)', 8);
  strokeWrapped(maskCtx, heroes, 'rgb(0,255,0)', 9);
  strokeWrapped(maskCtx, heroes, 'rgb(0,0,255)', 3.1);

  const phaseCanvas = document.createElement('canvas');
  phaseCanvas.width = phaseCanvas.height = SIZE;
  const phaseCtx = phaseCanvas.getContext('2d', { willReadFrequently: true });
  const phaseImage = phaseCtx.createImageData(SIZE, SIZE);
  for (let i = 0; i < maps.phase.length; i++) {
    const o = i * 4;
    phaseImage.data[o] = maps.phase[i];
    phaseImage.data[o + 3] = 255;
  }
  phaseCtx.putImageData(phaseImage, 0, 0);
  strokePhase(phaseCtx, heroes, 4);

  const maskData = maskCtx.getImageData(0, 0, SIZE, SIZE).data;
  const { rough, metal, emissive, height } = maps;

  for (let i = 0; i < height.length; i++) {
    const o = i * 4;
    const crackA = maskData[o] / 255;
    const glowA = maskData[o + 1] / 255;
    const core = maskData[o + 2] / 255;
    if (crackA < 0.04 && glowA < 0.04 && core < 0.04) continue;
    height[i] -= crackA * 0.16;
    height[i] += core * 0.13;
    if (core > 0.12) {
      const rb = clampByte(mix(rough[o], 28, core));
      rough[o] = rough[o + 1] = rough[o + 2] = rb;
      const mv = clampByte(Math.max(metal[o] * (1 - crackA * 0.5), core * 255));
      metal[o] = metal[o + 1] = metal[o + 2] = mv;
    } else if (crackA > 0.25) {
      const rb = clampByte(mix(rough[o], 155, crackA));
      rough[o] = rough[o + 1] = rough[o + 2] = rb;
      const mv = clampByte(metal[o] * (1 - crackA));
      metal[o] = metal[o + 1] = metal[o + 2] = mv;
    }
    const e = Math.min(1, core * 0.92 + glowA * 0.24);
    if (e > emissive[o] / 255) {
      emissive[o] = clampByte(255 * e);
      emissive[o + 1] = clampByte(208 * e);
      emissive[o + 2] = clampByte(112 * e);
    }
  }

  return phaseCanvas;
}

function bleedEmissive(emissive) {
  const w = SIZE;
  const src = emissive;
  const tmp = new Uint8ClampedArray(src.length);
  const rad = 2;
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = -rad; k <= rad; k++) {
        const xx = (x + k + w) % w;
        const o = (y * w + xx) * 4;
        r += src[o];
        g += src[o + 1];
        b += src[o + 2];
      }
      const o = (y * w + x) * 4;
      const n = rad * 2 + 1;
      tmp[o] = r / n;
      tmp[o + 1] = g / n;
      tmp[o + 2] = b / n;
      tmp[o + 3] = 255;
    }
  }
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = -rad; k <= rad; k++) {
        const yy = (y + k + w) % w;
        const o = (yy * w + x) * 4;
        r += tmp[o];
        g += tmp[o + 1];
        b += tmp[o + 2];
      }
      const o = (y * w + x) * 4;
      const n = rad * 2 + 1;
      src[o] = Math.max(src[o], (r / n) * 0.72);
      src[o + 1] = Math.max(src[o + 1], (g / n) * 0.72);
      src[o + 2] = Math.max(src[o + 2], (b / n) * 0.72);
    }
  }
}

function normalsFromHeight(height) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const image = canvas.getContext('2d').createImageData(SIZE, SIZE);
  const data = image.data;
  const at = (x, y) => {
    const xx = (x + SIZE) % SIZE;
    const yy = (y + SIZE) % SIZE;
    return height[yy * SIZE + xx];
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = at(x - 2, y) - at(x + 2, y);
      const dy = at(x, y - 2) - at(x, y + 2);
      let nx = dx * 3.1;
      let ny = dy * 3.1;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const o = (y * SIZE + x) * 4;
      data[o] = (nx * 0.5 + 0.5) * 255;
      data[o + 1] = (ny * 0.5 + 0.5) * 255;
      data[o + 2] = (nz * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(image, 0, 0);
  return canvas;
}

function canvasTexture(canvas, colorSpace, renderer) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

function putCanvas(image) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas.getContext('2d').putImageData(new ImageData(image, SIZE, SIZE), 0, 0);
  return canvas;
}

const SHADER_DECL = /* glsl */ `
uniform float uMarbleTime;
uniform float uMarbleStill;
uniform sampler2D uMarblePhase;
`;

const SHADER_FORM = /* glsl */ `
{
  vec3 albedo = diffuseColor.rgb;
  float luma = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  vec3 pale = mix(albedo, vec3(luma), 0.42);
  pale *= vec3(0.90, 0.96, 1.08);
  pale += vec3(0.03, 0.045, 0.08);
  pale = mix(pale, vec3(0.78, 0.83, 0.90), smoothstep(0.55, 0.06, luma) * 0.62);
  diffuseColor.rgb = mix(albedo, clamp(pale, 0.0, 1.0), uMarbleStill);
  vec3 paleGold = mix(diffuseColor.rgb, vec3(0.55, 0.60, 0.58), 0.82);
  diffuseColor.rgb = mix(diffuseColor.rgb, paleGold, uMarbleStill * smoothstep(0.15, 0.65, metalnessFactor));
}
`;

const SHADER_SSS = /* glsl */ `
{
  float stoneMask = 1.0 - metalnessFactor;
  float ndv = saturate(dot(normalize(normal), normalize(vViewPosition)));
  float rim = pow(1.0 - ndv, 2.6);
  vec3 milk = mix(vec3(1.0, 0.93, 0.84), vec3(0.80, 0.88, 1.0), uMarbleStill);
  totalDiffuse += milk * stoneMask * rim * 0.16;
}
`;

const SHADER_PULSE = /* glsl */ `
{
  float phase = texture2D(uMarblePhase, vEmissiveMapUv).r;
  float travel = fract(phase - uMarbleTime * 0.09);
  float band = smoothstep(0.02, 0.18, travel) * smoothstep(0.64, 0.28, travel);
  band *= 1.0 - smoothstep(0.045, 0.2, fwidth(phase));
  float breath = 0.92 + 0.08 * sin(uMarbleTime * 0.48 + phase * 6.2831853);
  float glow = (0.46 + 0.54 * band) * breath;
  glow *= mix(1.0, 0.07, uMarbleStill);
  float eLuma = dot(totalEmissiveRadiance, vec3(0.2126, 0.7152, 0.0722));
  vec3 cooled = vec3(0.58, 0.66, 0.56) * eLuma;
  totalEmissiveRadiance = mix(totalEmissiveRadiance, cooled, uMarbleStill) * glow;
}
`;

const WING_UV = /* glsl */ `
#if defined( USE_UV ) || defined( USE_ANISOTROPY )
  vUv = uv;
#endif
vec3 featherPos = (instanceMatrix * vec4(position, 1.0)).xyz;
vec2 featherUv = featherPos.xy * vec2(0.95, 1.05);
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
`;

function injectFragment(source) {
  const replacements = [
    ['#include <common>', `#include <common>\n${SHADER_DECL}`],
    ['#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${SHADER_FORM}`],
    [
      'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
      `vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n${SHADER_SSS}`,
    ],
    ['#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SHADER_PULSE}`],
  ];
  let out = source;
  for (const [needle, insert] of replacements) {
    if (!out.includes(needle)) throw new Error(`marble shader is missing ${needle}`);
    out = out.replace(needle, insert);
  }
  return out;
}

function bindShader(material, uniforms, projectFeathers) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMarbleTime = uniforms.uMarbleTime;
    shader.uniforms.uMarbleStill = uniforms.uMarbleStill;
    shader.uniforms.uMarblePhase = uniforms.uMarblePhase;
    shader.fragmentShader = injectFragment(shader.fragmentShader);
    if (projectFeathers) {
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', WING_UV);
    }
  };
  material.customProgramCacheKey = () => (projectFeathers ? 'marble-wing-v2' : 'marble-body-v2');
}

function applySurface(material, textures) {
  material.map = textures.map;
  material.roughnessMap = textures.roughnessMap;
  material.metalnessMap = textures.metalnessMap;
  material.normalMap = textures.normalMap;
  material.emissiveMap = textures.emissiveMap;
  material.color.set(0xffffff);
  material.emissive.set(0xffffff);
  material.emissiveIntensity = 1.9;
  material.roughness = 1;
  material.metalness = 1;
  material.normalScale.set(0.62, 0.62);
  material.clearcoat = 1;
  material.clearcoatRoughness = 0.055;
  material.envMapIntensity = 1.12;
  material.ior = 1.54;
  material.specularIntensity = 1;
  material.sheen = 0.24;
  material.sheenColor.set(0xfff4ea);
  material.sheenRoughness = 0.78;
  material.dithering = true;
}

/**
 * Polished Carrara body and wing materials.
 * `setForm('radiant' | 'still', t)` blends with t in 0..1 toward that form.
 * `update(time)` drives the slow pulse along the gold veins.
 * Hair clones of `body` keep the same shader and form uniforms.
 */
export function createMarble(renderer) {
  const rand = mulberry32(0x5a17);
  const painted = paintStone(rand);
  const maps = buildCrackle(rand, painted.ctx);
  const phaseCanvas = layHeroVeins(rand, painted.ctx, maps);
  bleedEmissive(maps.emissive);
  const normalCanvas = normalsFromHeight(maps.height);

  const textures = {
    map: canvasTexture(painted.color, THREE.SRGBColorSpace, renderer),
    roughnessMap: canvasTexture(putCanvas(maps.rough), THREE.NoColorSpace, renderer),
    metalnessMap: canvasTexture(putCanvas(maps.metal), THREE.NoColorSpace, renderer),
    emissiveMap: canvasTexture(putCanvas(maps.emissive), THREE.SRGBColorSpace, renderer),
    normalMap: canvasTexture(normalCanvas, THREE.NoColorSpace, renderer),
    phaseMap: canvasTexture(phaseCanvas, THREE.NoColorSpace, renderer),
  };
  textures.phaseMap.generateMipmaps = false;
  textures.phaseMap.minFilter = THREE.LinearFilter;
  textures.phaseMap.magFilter = THREE.LinearFilter;

  const repeat = new THREE.Vector2(1.15, 1.5);
  for (const [name, tex] of Object.entries(textures)) {
    // Phase is sampled with the emissive UV, which already includes this repeat.
    if (name === 'phaseMap') continue;
    tex.repeat.copy(repeat);
  }

  const uniforms = {
    uMarbleTime: { value: 0 },
    uMarbleStill: { value: 0 },
    uMarblePhase: { value: textures.phaseMap },
  };

  const warmSheen = new THREE.Color(0xfff4ea);
  const coolSheen = new THREE.Color(0xe3eef8);
  const materials = [];

  const body = new THREE.MeshPhysicalMaterial();
  applySurface(body, textures);
  bindShader(body, uniforms, false);

  const wing = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  applySurface(wing, textures);
  wing.envMapIntensity = 0.78;
  wing.clearcoat = 0.82;
  wing.emissiveIntensity = 1.45;
  bindShader(wing, uniforms, true);

  materials.push(body, wing);

  const protoClone = THREE.MeshPhysicalMaterial.prototype.clone;
  body.clone = function cloneMarbleBody() {
    const cloned = protoClone.call(this);
    cloned.onBeforeCompile = this.onBeforeCompile;
    cloned.customProgramCacheKey = this.customProgramCacheKey;
    cloned.clone = this.clone;
    materials.push(cloned);
    return cloned;
  };

  function applyStill(still) {
    uniforms.uMarbleStill.value = still;
    for (const material of materials) {
      material.sheenColor.copy(warmSheen).lerp(coolSheen, still);
      material.clearcoatRoughness = 0.055 + still * 0.1;
    }
  }

  return {
    body,
    wing,
    textures,
    update(time = 0) {
      uniforms.uMarbleTime.value = time;
    },
    setForm(form, t = 1) {
      const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
      if (form === 'still') applyStill(k);
      else if (form === 'radiant') applyStill(1 - k);
    },
  };
}
