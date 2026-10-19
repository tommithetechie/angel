import * as THREE from 'three';

let SIZE = 1024;
let LOW = 512;
let UNIT = 1;
const CELLS = 18;

function px(n) {
  return n * UNIT;
}

function pickSize(renderer) {
  const maxTex = renderer?.capabilities?.maxTextureSize || 2048;
  const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const shortSide = Math.min(w, h);
  const longSide = Math.max(w, h);
  // Phones and small windows. A 1280×720 desktop stays at 1024.
  const small = shortSide < 700 && longSide < 1100;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  let chosen = small || coarse ? 512 : 1024;
  if (maxTex < chosen) chosen = Math.max(256, maxTex);
  return chosen;
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
    const segs = 9 + Math.floor(rand() * 10);
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
        let ba = angle + (rand() < 0.5 ? -1 : 1) * (0.55 + rand() * 0.7);
        const bsegs = 2 + Math.floor(rand() * 4);
        for (let b = 0; b < bsegs; b++) {
          ba += (rand() - 0.5) * wander * 0.75;
          bx += Math.cos(ba) * len * 0.68;
          by += Math.sin(ba) * len * 0.68;
          branch.push({ x, bx, y: by });
        }
        paths.push(branch.map((pt) => ({ x: pt.bx ?? pt.x, y: pt.y })));
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
  const period = px(320);
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
  // Broad quiet ivory-silver stone with subtle tonal clouds
  const ivory = [246, 244, 240];
  const silver = [232, 233, 236];
  const mist = [214, 217, 222];
  const gray = [182, 186, 194];
  const slate = [138, 142, 152];

  for (let y = 0; y < LOW; y++) {
    const v = y / LOW;
    for (let x = 0; x < LOW; x++) {
      const u = x / LOW;
      const wx = fbm(warpN, u, v, 4);
      const wy = fbm(warpN, u + 5.2, v + 1.3, 4);
      const uu = u + (wx - 0.5) * 0.34;
      const vv = v + (wy - 0.5) * 0.34;
      const cloud = fbm(cloudN, uu * 1.15, vv * 1.25, 4);
      const fine = fbm(cloudN, uu * 2.8 + 2.0, vv * 2.6, 3);
      const flow = uu * 1.35 + (wx - 0.5) * 0.9 + cloud * 0.18;
      const band = Math.abs(Math.sin(flow * Math.PI * 2));
      const vein = smoothstep(0.24, 0.02, band);

      let rgb = mix3(ivory, silver, cloud * 0.68);
      rgb = mix3(rgb, mist, Math.max(0, fine - 0.45) * 0.42);
      rgb = mix3(rgb, gray, vein * 0.36);
      rgb = mix3(rgb, slate, vein * vein * 0.24);

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

  const soft = makePaths(rand, 5, px(76), 0.72, 0.1);
  strokeWrapped(ctx, soft, 'rgba(156,160,170,0.14)', px(16));
  strokeWrapped(ctx, soft, 'rgba(104,108,118,0.18)', px(4));

  const threads = makePaths(rand, 8, px(54), 0.88, 0.14);
  strokeWrapped(ctx, threads, 'rgba(72,76,84,0.28)', px(1.8));

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
      sitesX[k] = (i + 0.5 + (rand() - 0.5) * 0.84) * cell;
      sitesY[k] = (j + 0.5 + (rand() - 0.5) * 0.84) * cell;
    }
  }

  const warp = makeNoise(rand, 8);
  const maskN = makeNoise(rand, 6);
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
      const sx = x + (warp(u * 2.0, v * 2.0) - 0.5) * px(16);
      const sy = y + (warp(u * 2.0 + 3.1, v * 2.0 + 1.4) - 0.5) * px(16);
      let wrappedX = sx % SIZE;
      let wrappedY = sy % SIZE;
      if (wrappedX < 0) wrappedX += SIZE;
      if (wrappedY < 0) wrappedY += SIZE;
      const cx = Math.min(CELLS - 1, (wrappedX / cell) | 0);
      const cy = Math.min(CELLS - 1, (wrappedY / cell) | 0);

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
      // Preserve broad quiet areas: only selective regions carry visible fractures
      const regionMask = smoothstep(0.42, 0.68, maskN(u * 1.5 + 0.7, v * 1.5 + 1.9));
      const strength = smoothstep(0.46, 0.82, fade) * (0.25 + 0.75 * regionMask);
      const isGold = fade > 0.72 && regionMask > 0.2;
      const crack = smoothstep(px(2.4), px(0.28), edge) * strength;
      const gold = isGold ? smoothstep(px(1.85), px(0.18), edge) * strength : 0;
      const goldCore = isGold ? smoothstep(px(0.95), px(0.1), edge) * strength : 0;
      const glow = isGold ? smoothstep(px(4.2), px(0.4), edge) * strength : 0;

      const br = base[o];
      const bg = base[o + 1];
      const bb = base[o + 2];
      const lum = (0.299 * br + 0.587 * bg + 0.114 * bb) / 255;
      const softVein = smoothstep(ivoryLum, 0.6, lum);

      let r = br;
      let g = bg;
      let b = bb;
      const ink = Math.min(1, crack * 0.72);
      r = r * (1 - ink) + 28 * ink;
      g = g * (1 - ink) + 30 * ink;
      b = b * (1 - ink) + 36 * ink;
      const gr = 208 + goldCore * 47;
      const gg = 148 + goldCore * 84;
      const gb = 62 + goldCore * 82;
      r = r * (1 - gold) + gr * gold;
      g = g * (1 - gold) + gg * gold;
      b = b * (1 - gold) + gb * gold;

      color[o] = clampByte(r);
      color[o + 1] = clampByte(g);
      color[o + 2] = clampByte(b);
      color[o + 3] = 255;

      const grain = hash01(x, y);
      let roughV = 44 + grain * 12 + softVein * 18;
      roughV = mix(roughV, 132, Math.min(1, crack * (1 - gold)));
      roughV = mix(roughV, 32 + grain * 10, gold);
      roughV = mix(roughV, 20, goldCore);
      const rb = clampByte(roughV);
      rough[o] = rough[o + 1] = rough[o + 2] = rb;
      rough[o + 3] = 255;

      const metalV = clampByte(smoothstep(0.18, 0.68, gold) * 255);
      metal[o] = metal[o + 1] = metal[o + 2] = metalV;
      metal[o + 3] = 255;

      const e = Math.min(1, gold * 0.76 + glow * 0.28);
      if (e > 0.004) {
        emissive[o] = clampByte(255 * e);
        emissive[o + 1] = clampByte((176 + goldCore * 64) * e);
        emissive[o + 2] = clampByte((74 + goldCore * 64) * e);
      }
      emissive[o + 3] = 255;

      // Subtle height variation so cracks do not produce unwanted surface dents
      const micro = hash01(x * 3 + 11, y * 5 + 2);
      let h = 0.58 + (micro - 0.5) * 0.015;
      h -= softVein * 0.018;
      h -= crack * 0.035;
      h += goldCore * 0.03;
      height[row + x] = h;

      if (gold > 0.2) {
        const ax = sitesX[i1];
        const ay = sitesY[i1];
        const adx = wrapDelta(sitesX[i2] - ax);
        const ady = wrapDelta(sitesY[i2] - ay);
        const ppx = wrapDelta(sx - ax);
        const ppy = wrapDelta(sy - ay);
        const len = Math.hypot(adx, ady) || 1;
        const along = (ppx * adx + ppy * ady) / len;
        const period = px(280);
        const t = ((along % period) + period) % period;
        phase[row + x] = (t / period) * 255;
      }
    }
  }

  stone.putImageData(new ImageData(color, SIZE, SIZE), 0, 0);
  return { rough, metal, emissive, height, phase };
}

function layHeroVeins(rand, colorCtx, maps) {
  // Restrained, fine broken gold veins rather than wide dark trenches
  const heroes = makePaths(rand, 5, px(56), 0.68, 0.22);
  strokeWrapped(colorCtx, heroes, 'rgba(18,19,24,0.75)', px(3.4));
  strokeWrapped(colorCtx, heroes, '#8a5a18', px(2.2));
  strokeWrapped(colorCtx, heroes, '#eab954', px(1.35));
  strokeWrapped(colorCtx, heroes, '#ffebc0', px(0.75));

  const mask = document.createElement('canvas');
  mask.width = mask.height = SIZE;
  const maskCtx = mask.getContext('2d', { willReadFrequently: true });
  maskCtx.globalCompositeOperation = 'lighter';
  strokeWrapped(maskCtx, heroes, 'rgb(255,0,0)', px(3.6));
  strokeWrapped(maskCtx, heroes, 'rgb(0,255,0)', px(4.6));
  strokeWrapped(maskCtx, heroes, 'rgb(0,0,255)', px(1.8));

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
  strokePhase(phaseCtx, heroes, px(2.6));

  const maskData = maskCtx.getImageData(0, 0, SIZE, SIZE).data;
  const { rough, metal, emissive, height } = maps;

  for (let i = 0; i < height.length; i++) {
    const o = i * 4;
    const crackA = maskData[o] / 255;
    const glowA = maskData[o + 1] / 255;
    const core = maskData[o + 2] / 255;
    if (crackA < 0.04 && glowA < 0.04 && core < 0.04) continue;
    height[i] -= crackA * 0.03;
    height[i] += core * 0.035;
    if (core > 0.12) {
      const rb = clampByte(mix(rough[o], 24, core));
      rough[o] = rough[o + 1] = rough[o + 2] = rb;
      const mv = clampByte(Math.max(metal[o] * (1 - crackA * 0.4), core * 255));
      metal[o] = metal[o + 1] = metal[o + 2] = mv;
    } else if (crackA > 0.25) {
      const rb = clampByte(mix(rough[o], 124, crackA));
      rough[o] = rough[o + 1] = rough[o + 2] = rb;
      const mv = clampByte(metal[o] * (1 - crackA));
      metal[o] = metal[o + 1] = metal[o + 2] = mv;
    }
    const e = Math.min(1, core * 0.88 + glowA * 0.18);
    if (e > emissive[o] / 255) {
      emissive[o] = clampByte(255 * e);
      emissive[o + 1] = clampByte(210 * e);
      emissive[o + 2] = clampByte(116 * e);
    }
  }

  return phaseCanvas;
}

function bleedEmissive(emissive) {
  const w = SIZE;
  const src = emissive;
  const tmp = new Uint8ClampedArray(src.length);
  const rad = Math.max(1, Math.round(px(1.5)));
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
      src[o] = Math.max(src[o], (r / n) * 0.62);
      src[o + 1] = Math.max(src[o + 1], (g / n) * 0.62);
      src[o + 2] = Math.max(src[o + 2], (b / n) * 0.62);
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
      const step = Math.max(1, Math.round(px(2)));
      const dx = at(x - step, y) - at(x + step, y);
      const dy = at(x, y - step) - at(x, y + step);
      let nx = dx * 0.9;
      let ny = dy * 0.9;
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
  tex.anisotropy = Math.min(SIZE >= 1024 ? 8 : 4, renderer.capabilities.getMaxAnisotropy());
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
uniform float uMarbleTransition;
uniform float uNeutralSpecular;
uniform float uClay;
uniform sampler2D uMarblePhase;
varying vec3 vAngelPos;
`;

const BODY_DECL = /* glsl */ `
uniform float uProject;
uniform mat4 uMarbleMatrix;
uniform mat3 uMarbleNormalMatrix;
varying vec3 vMarblePos;
varying vec3 vMarbleNormal;

vec4 marbleSample(sampler2D tex, vec3 p, vec3 w) {
  return texture2D(tex, p.zy) * w.x
    + texture2D(tex, p.xz) * w.y
    + texture2D(tex, p.xy) * w.z;
}
`;

const BODY_MAP = /* glsl */ `
vec3 marbleP = vAngelPos * 0.42;
vec3 marbleN = normalize(uMarbleNormalMatrix * vMarbleNormal);
vec3 marbleW = abs(marbleN);
marbleW = pow(max(marbleW, vec3(1.0e-4)), vec3(4.0));
marbleW /= (marbleW.x + marbleW.y + marbleW.z);
vec4 sampledMarbleMap = vec4(0.92, 0.92, 0.91, 1.0);
#ifdef USE_MAP
  if (uProject > 0.5) sampledMarbleMap = marbleSample(map, marbleP, marbleW);
  else sampledMarbleMap = texture2D(map, vMapUv);
  sampledMarbleMap = mix(sampledMarbleMap, vec4(0.92, 0.92, 0.91, 1.0), max(uNeutralSpecular, uClay));
  diffuseColor *= sampledMarbleMap;
#endif
`;

const BODY_ROUGH = /* glsl */ `
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  vec4 texelRoughness;
  if (uProject > 0.5) texelRoughness = marbleSample(roughnessMap, marbleP, marbleW);
  else texelRoughness = texture2D(roughnessMap, vRoughnessMapUv);
  roughnessFactor *= mix(texelRoughness.g, 0.24, uNeutralSpecular);
#endif
`;

const BODY_METAL = /* glsl */ `
float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
  vec4 texelMetalness;
  if (uProject > 0.5) texelMetalness = marbleSample(metalnessMap, marbleP, marbleW);
  else texelMetalness = texture2D(metalnessMap, vMetalnessMapUv);
  metalnessFactor *= mix(texelMetalness.b, 0.0, max(uNeutralSpecular, uClay));
#endif
`;

const BODY_EMISSIVE = /* glsl */ `
#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor;
  if (uProject > 0.5) emissiveColor = marbleSample(emissiveMap, marbleP, marbleW);
  else emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);
  totalEmissiveRadiance *= emissiveColor.rgb * (1.0 - max(uNeutralSpecular, uClay));
#endif
`;

const BODY_PHASE = /* glsl */ `
{
  float phase = uProject > 0.5
    ? marbleSample(uMarblePhase, marbleP, marbleW).r
    : texture2D(uMarblePhase, vEmissiveMapUv).r;
  float travel = fract(phase - uMarbleTime * 0.09);
  float band = smoothstep(0.02, 0.18, travel) * smoothstep(0.64, 0.28, travel);
  band *= 1.0 - smoothstep(0.045, 0.2, fwidth(phase));
  float breath = 0.92 + 0.08 * sin(uMarbleTime * 0.48 + phase * 6.2831853);
  float glow = (0.80 + 0.18 * band) * breath;
  glow *= mix(0.54, 0.04, uMarbleStill) * (1.0 - max(uNeutralSpecular, uClay));
  float eLuma = dot(totalEmissiveRadiance, vec3(0.2126, 0.7152, 0.0722));
  vec3 cooled = vec3(0.58, 0.68, 0.74) * eLuma;
  totalEmissiveRadiance = mix(totalEmissiveRadiance, cooled, uMarbleStill) * glow;
}
`;

// Radiant body: glossy charcoal/obsidian with subtle pale/gold fracture accents.
// Still body: shifts smoothly to quiet warm-cool ivory marble.
const BODY_FORM = /* glsl */ `
{
  vec3 texRgb = diffuseColor.rgb;
  float luma = dot(texRgb, vec3(0.2126, 0.7152, 0.0722));
  float patternOn = 1.0 - max(uNeutralSpecular, uClay);
  float goldMask = smoothstep(0.16, 0.62, metalnessFactor) * patternOn;
  float paleCrack = smoothstep(0.66, 0.24, luma) * (1.0 - goldMask) * patternOn;

  // Glossy charcoal/obsidian base in Radiant, with subtle pale mineral lines and gold fractures
  vec3 obsidian = mix(vec3(0.015, 0.016, 0.020), vec3(0.034, 0.036, 0.044), smoothstep(0.48, 0.98, luma));
  vec3 fractureTint = vec3(0.22, 0.21, 0.20);
  vec3 goldTint = vec3(0.92, 0.68, 0.28);
  vec3 radiantBody = mix(obsidian, fractureTint, paleCrack * 0.44);
  radiantBody = mix(radiantBody, goldTint, goldMask * 0.92);

  // Quiet ivory stone in Still with subdued silver-champagne veins
  vec3 stillIvory = mix(vec3(0.73, 0.77, 0.82), vec3(0.87, 0.90, 0.93), smoothstep(0.45, 0.95, luma));
  stillIvory = mix(stillIvory, vec3(0.58, 0.65, 0.72), paleCrack * 0.28);
  stillIvory = mix(stillIvory, vec3(0.66, 0.72, 0.77), goldMask * 0.50);

  // Perceptual curve so midpoint (uMarbleStill = 0.5) reads as balanced slate-ivory
  float stillCurve = smoothstep(0.12, 0.96, uMarbleStill * uMarbleStill);
  vec3 formColor = mix(radiantBody, stillIvory, stillCurve);
  diffuseColor.rgb = mix(formColor, vec3(0.52, 0.52, 0.50), uClay);

  // Broad readable specular lobe across dark glossy anatomy without pinprick joint hotspots
  float targetRough = mix(0.24, 0.34, uMarbleStill);
  roughnessFactor = mix(targetRough, roughnessFactor * 0.68 + 0.14, 0.34 * patternOn);
  roughnessFactor = mix(roughnessFactor, 0.15, goldMask * 0.68);
  roughnessFactor = mix(roughnessFactor, 0.84, uClay);
  metalnessFactor *= patternOn;
}
`;

// Swept volumetric hair: related dark charcoal finish in Radiant with broader, softer highlights
// and reduced crackle so locks remain distinct from the glossy body; pearl-ash ivory in Still.
const HAIR_FORM = /* glsl */ `
{
  vec3 texRgb = diffuseColor.rgb;
  float luma = dot(texRgb, vec3(0.2126, 0.7152, 0.0722));
  float patternOn = 1.0 - max(uNeutralSpecular, uClay);
  float goldMask = smoothstep(0.26, 0.74, metalnessFactor) * patternOn;

  vec3 radiantHair = mix(vec3(0.030, 0.028, 0.036), vec3(0.068, 0.064, 0.078), smoothstep(0.44, 0.98, luma));
  radiantHair = mix(radiantHair, vec3(0.76, 0.56, 0.26), goldMask * 0.42);

  vec3 stillHair = mix(vec3(0.46, 0.53, 0.62), vec3(0.64, 0.71, 0.79), smoothstep(0.44, 0.96, luma));

  float stillCurve = smoothstep(0.12, 0.96, uMarbleStill * uMarbleStill);
  vec3 formColor = mix(radiantHair, stillHair, stillCurve);
  diffuseColor.rgb = mix(formColor, vec3(0.52, 0.52, 0.50), uClay);
  roughnessFactor = mix(mix(0.30, 0.40, uMarbleStill), 0.84, uClay);
  metalnessFactor *= 0.25 * patternOn;
}
`;

// Radiant wings: ivory-silver feather faces, darker charcoal-slate roots and recessed layers
// (encoded in vFeatherInst + vFeatherLocalUv + vColor), and fine broken gold veins.
// Still wings: cool pale silver with preserved layer separation and crisp individual feather blades.
const WING_FORM = /* glsl */ `
{
  float patternOn = 1.0 - max(uNeutralSpecular, uClay);
  float instRoot = clamp(vFeatherInst.r, 0.05, 1.0);
  float instRowLayer = clamp(vFeatherInst.g, 0.05, 1.0);
  float instRole = clamp(vFeatherInst.b, 0.0, 1.0);
  #ifdef USE_COLOR
    vec3 rawTex = diffuseColor.rgb / max(vColor.rgb, vec3(0.001));
    float vShade = clamp(vColor.g / max(vFeatherInst.g, 0.001), 0.0, 1.0);
  #else
    vec3 rawTex = diffuseColor.rgb;
    float vShade = 0.88;
  #endif
  vec3 texRgb = mix(rawTex, vec3(0.92, 0.91, 0.89), max(uNeutralSpecular, uClay));
  float luma = dot(texRgb, vec3(0.2126, 0.7152, 0.0722));
  float goldMask = smoothstep(0.18, 0.65, metalnessFactor) * patternOn;
  float veinMask = smoothstep(0.68, 0.25, luma) * (1.0 - goldMask) * patternOn;

  // Local feather base-to-tip and lateral vane contour so individual blades and shafts remain distinct
  float isPrimary = 1.0 - smoothstep(0.0, 0.35, instRole);
  float isSecondary = smoothstep(0.15, 0.45, instRole) * (1.0 - smoothstep(0.55, 0.85, instRole));
  float primaryTuck = isPrimary * (1.0 - smoothstep(0.12, 0.48, vFeatherLocalUv.y));
  float quillRoot = smoothstep(0.0, 0.38, vFeatherLocalUv.y);
  float signedS = (vFeatherLocalUv.x - 0.5) * 2.0;
  float edgeDist = abs(signedS);
  // Directional rachis bevel + subtle barb striations so each feather blade and central quill read clearly
  float shaftAccent = -signedS * exp(-(signedS * signedS) / 0.018) * 0.14;
  float barbLines = sin((vFeatherLocalUv.y * 36.0 - edgeDist * 14.0) * 6.2831853) * 0.018 * smoothstep(0.08, 0.4, edgeDist);
  float vaneBevel = 1.0 - 0.22 * smoothstep(0.52, 1.0, edgeDist);
  float localFace = clamp(quillRoot * (1.0 - 0.68 * primaryTuck) * (1.0 - 0.22 * isSecondary), 0.0, 1.0);
  float exposureMask = clamp(instRoot * instRowLayer * (0.18 + 0.82 * localFace) * (0.58 + 0.42 * vShade) * vaneBevel, 0.0, 1.0);
  float featherRelief = clamp((0.68 + 0.32 * vShade) * vaneBevel + shaftAccent + barbLines, 0.42, 1.08);

  // Radiant: dark charcoal-slate roots & recessed tiers -> mid slate -> warm ivory-silver main faces
  vec3 darkRoot = vec3(0.030, 0.033, 0.042);
  vec3 midSlate = vec3(0.21, 0.22, 0.26);
  vec3 ivorySilver = mix(vec3(0.72, 0.70, 0.67), vec3(0.90, 0.87, 0.83), smoothstep(0.42, 0.98, luma));
  ivorySilver = mix(ivorySilver, vec3(0.38, 0.40, 0.44), veinMask * 0.40);
  ivorySilver *= featherRelief;

  vec3 radiantWing = mix(darkRoot, midSlate, smoothstep(0.04, 0.40, exposureMask));
  radiantWing = mix(radiantWing, ivorySilver, smoothstep(0.24, 0.95, exposureMask));
  radiantWing = mix(radiantWing, vec3(0.92, 0.70, 0.30), goldMask * (0.42 + 0.48 * smoothstep(0.25, 0.8, exposureMask)));

  // Still: cool pale silver with crisp depth separation between folded layers
  vec3 stillRecess = vec3(0.22, 0.30, 0.39);
  vec3 stillMid = vec3(0.48, 0.57, 0.66);
  vec3 stillSilver = mix(vec3(0.76, 0.82, 0.88), vec3(0.90, 0.95, 0.98), smoothstep(0.44, 0.98, luma));
  stillSilver = mix(stillSilver, vec3(0.54, 0.62, 0.72), veinMask * 0.28);
  stillSilver *= clamp((0.70 + 0.30 * vShade) * vaneBevel + shaftAccent * 0.85 + barbLines, 0.46, 1.06);
  vec3 stillWing = mix(stillRecess, stillMid, smoothstep(0.04, 0.40, exposureMask));
  stillWing = mix(stillWing, stillSilver, smoothstep(0.24, 0.95, exposureMask));
  stillWing = mix(stillWing, vec3(0.72, 0.78, 0.83), goldMask * 0.46);

  vec3 formWing = mix(radiantWing, stillWing, uMarbleStill);
  diffuseColor.rgb = mix(formWing, vec3(0.52, 0.52, 0.50) * (0.76 + 0.24 * vShade), uClay);
  roughnessFactor = mix(0.32, 0.38, uMarbleStill);
  roughnessFactor = mix(roughnessFactor, 0.18, goldMask * 0.68);
  roughnessFactor = mix(roughnessFactor, 0.84, uClay);
  metalnessFactor *= patternOn;
}
`;

const SHADER_SSS = /* glsl */ `
{
  float stoneMask = (1.0 - metalnessFactor * 0.75) * (1.0 - uClay);
  vec3 viewN = normalize(normal);
  vec3 viewV = normalize(vViewPosition);
  float ndv = saturate(dot(viewN, viewV));
  float baseLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float isDarkSurface = 1.0 - smoothstep(0.06, 0.32, baseLuma);

  // Broad, view-coherent studio highlights along the dark glossy anatomy and swept hair ridges
  // so torso, chest, limbs, and locks read clearly from the hero view and during orbit without washing out the dark core.
  vec3 broadLightDir = normalize(vec3(-0.32, 0.58, 0.75));
  vec3 broadHalf = normalize(broadLightDir + viewV);
  float broadPrimary = pow(saturate(dot(viewN, broadHalf)), 6.5);
  vec3 fillLightDir = normalize(vec3(0.42, 0.34, 0.84));
  vec3 fillHalf = normalize(fillLightDir + viewV);
  float broadSecondary = pow(saturate(dot(viewN, fillHalf)), 8.0) * 0.45;
  float broadHighlight = broadPrimary + broadSecondary;
  totalDiffuse += vec3(0.95, 0.90, 0.84) * broadHighlight * isDarkSurface * stoneMask * mix(0.078, 0.035, uMarbleStill);

  // Controlled grazing contour rim: defines dark charcoal anatomy against the dark stage
  // while staying restrained on pale feathers so feather edges never wash out.
  float rimExp = mix(3.2, 2.75, isDarkSurface);
  float rim = pow(1.0 - ndv, rimExp);
  float rimStrength = mix(0.052, 0.138, isDarkSurface);
  rimStrength = mix(rimStrength, 0.105, uMarbleStill);
  vec3 rimTint = mix(vec3(0.80, 0.75, 0.68), vec3(0.76, 0.88, 0.98), uMarbleStill);
  totalDiffuse += rimTint * stoneMask * rim * rimStrength;

  // Localized gold illumination from the upright halo (center 0, 1.98, -0.44, radius ~0.90)
  // and the two moving waist/lower trails (around y = 0.52..1.12).
  // Kept grazing on dark obsidian anatomy so the dark core remains deep charcoal while edges and inner feathers catch warm gold.
  vec2 haloDelta = vAngelPos.xy - vec2(0.0, mix(1.98, 1.15, uMarbleStill));
  float haloRingDist = length(vec2(length(haloDelta) - 0.88, vAngelPos.z + 0.42));
  float haloProx = exp(-haloRingDist * haloRingDist * 2.5);

  vec2 trailDelta = vAngelPos.xz;
  float trailRad = length(trailDelta);
  float waistDist = length(vec2(trailRad - 0.84, (vAngelPos.y - mix(1.08, 0.16, uMarbleStill)) * 1.5));
  float lowerDist = length(vec2(trailRad - 0.98, (vAngelPos.y - mix(0.54, 0.10, uMarbleStill)) * 1.5));
  float trailProx = exp(-waistDist * waistDist * 2.8) + exp(-lowerDist * lowerDist * 2.8) * 0.85;

  float localGold = clamp(haloProx * 0.90 + trailProx * 0.68, 0.0, 1.0) * stoneMask;
  float localRimProfile = mix(0.065 + 0.13 * pow(1.0 - ndv, 1.8), 0.185 * pow(1.0 - ndv, 2.35), isDarkSurface);
  vec3 localWarmTint = vec3(1.04, 0.72, 0.28) * localRimProfile;
  vec3 localCoolTint = vec3(0.58, 0.84, 0.98) * (0.045 + 0.075 * pow(1.0 - ndv, 2.1));
  totalDiffuse += mix(localWarmTint, localCoolTint, uMarbleStill) * localGold;

  // A short gold-white envelope gathers over the existing surfaces during a
  // form change. It is deliberately additive and low enough to preserve the
  // dark body, pale feather edges, and vein detail outside the peak.
  float transitionFacing = 0.32 + 0.68 * pow(1.0 - ndv, 1.45);
  vec3 transitionTint = mix(vec3(1.06, 0.54, 0.16), vec3(1.18, 1.02, 0.80), uMarbleStill);
  totalDiffuse += transitionTint * uMarbleTransition * transitionFacing * (0.035 + 0.065 * stoneMask);
}
`;

const SHADER_PULSE = /* glsl */ `
{
  totalEmissiveRadiance *= (1.0 - max(uNeutralSpecular, uClay));
  float phase = texture2D(uMarblePhase, vEmissiveMapUv).r;
  float travel = fract(phase - uMarbleTime * 0.09);
  float band = smoothstep(0.02, 0.18, travel) * smoothstep(0.64, 0.28, travel);
  band *= 1.0 - smoothstep(0.045, 0.2, fwidth(phase));
  float breath = 0.92 + 0.08 * sin(uMarbleTime * 0.48 + phase * 6.2831853);
  float glow = (0.82 + 0.16 * band) * breath;
  glow *= mix(0.58, 0.05, uMarbleStill);
  float eLuma = dot(totalEmissiveRadiance, vec3(0.2126, 0.7152, 0.0722));
  vec3 cooled = vec3(0.58, 0.68, 0.74) * eLuma;
  totalEmissiveRadiance = mix(totalEmissiveRadiance, cooled, uMarbleStill) * glow;
}
`;

const WING_UV = /* glsl */ `
#if defined( USE_UV ) || defined( USE_ANISOTROPY )
  vUv = uv;
#endif
vFeatherLocalUv = uv;
#ifdef USE_INSTANCING_COLOR
  vFeatherInst = instanceColor.xyz;
#else
  vFeatherInst = vec3(0.86, 0.84, 0.0);
#endif
#ifdef USE_INSTANCING
  vec3 featherPos = (instanceMatrix * vec4(position, 1.0)).xyz;
#else
  vec3 featherPos = position;
#endif
vAngelPos = featherPos;
vec2 featherUv = featherPos.xy * vec2(0.42, 0.42);
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

function replaceChunk(source, needle, insert) {
  if (!source.includes(needle)) throw new Error(`marble shader is missing ${needle}`);
  return source.replace(needle, insert);
}

function injectFragment(source, role) {
  const projectBody = role !== 'wing';
  const formChunk = role === 'wing' ? WING_FORM : role === 'hair' ? HAIR_FORM : BODY_FORM;
  let out = replaceChunk(source, '#include <common>', `#include <common>\n${SHADER_DECL}`);
  if (projectBody) {
    out = replaceChunk(out, '#include <common>', `#include <common>\n${BODY_DECL}`);
    out = replaceChunk(out, '#include <map_fragment>', BODY_MAP);
    out = replaceChunk(out, '#include <roughnessmap_fragment>', BODY_ROUGH);
    out = replaceChunk(out, '#include <metalnessmap_fragment>', BODY_METAL);
    out = replaceChunk(out, '#include <emissivemap_fragment>', `${BODY_EMISSIVE}\n${BODY_PHASE}`);
  } else {
    out = replaceChunk(out, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SHADER_PULSE}`);
  }
  // Omit diffuse-luminance derivative normal perturbation so veins never read as dents.
  out = replaceChunk(out, '#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${formChunk}`);
  out = replaceChunk(
    out,
    'vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
    `vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n${SHADER_SSS}`,
  );
  return out;
}

const rootInverse = new THREE.Matrix4();

function marbleMatrix(object, target) {
  let root = object;
  while (root.parent && !root.parent.isScene) root = root.parent;
  rootInverse.copy(root.matrixWorld).invert();
  target.multiplyMatrices(rootInverse, object.matrixWorld);
}

function uvSpan(geometry) {
  const cached = geometry.userData.marbleUvSpan;
  if (cached !== undefined) return cached;
  const uv = geometry.attributes?.uv;
  if (!uv || uv.count === 0) {
    geometry.userData.marbleUvSpan = 1;
    return 1;
  }
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  const step = Math.max(1, Math.floor(uv.count / 240));
  for (let i = 0; i < uv.count; i += step) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const span = Math.max(maxU - minU, maxV - minV);
  geometry.userData.marbleUvSpan = span;
  return span;
}

function bindShader(material, uniforms, role) {
  const isWing = role === 'wing';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMarbleTime = uniforms.uMarbleTime;
    shader.uniforms.uMarbleStill = uniforms.uMarbleStill;
    shader.uniforms.uMarbleTransition = uniforms.uMarbleTransition;
    shader.uniforms.uNeutralSpecular = uniforms.uNeutralSpecular;
    shader.uniforms.uClay = uniforms.uClay;
    shader.uniforms.uMarblePhase = uniforms.uMarblePhase;
    if (!isWing) {
      shader.uniforms.uProject = uniforms.uProject;
      shader.uniforms.uMarbleMatrix = uniforms.uMarbleMatrix;
      shader.uniforms.uMarbleNormalMatrix = uniforms.uMarbleNormalMatrix;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform mat4 uMarbleMatrix;\nvarying vec3 vMarblePos;\nvarying vec3 vMarbleNormal;\nvarying vec3 vAngelPos;\n`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\nvMarblePos = position;\nvMarbleNormal = normal;\nvAngelPos = (uMarbleMatrix * vec4(position, 1.0)).xyz;\n`,
        );
    }
    shader.fragmentShader = injectFragment(shader.fragmentShader, role);
    if (isWing) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec2 vFeatherLocalUv;\nvarying vec3 vFeatherInst;\nvarying vec3 vAngelPos;\n`)
        .replace('#include <uv_vertex>', WING_UV);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>\nvarying vec2 vFeatherLocalUv;\nvarying vec3 vFeatherInst;\n`,
      );
    }
  };
  material.customProgramCacheKey = () => `marble-${role}-v8`;
  if (!isWing) {
    material.onBeforeRender = (renderer, scene, camera, geometry, object) => {
      const project = uvSpan(geometry) > 0.75 ? 1 : 0;
      uniforms.uProject.value = project;
      marbleMatrix(object, uniforms.uMarbleMatrix.value);
      uniforms.uMarbleNormalMatrix.value.getNormalMatrix(uniforms.uMarbleMatrix.value);
    };
  }
}

function applySurface(material, textures, role) {
  material.map = textures.map;
  material.roughnessMap = textures.roughnessMap;
  material.metalnessMap = textures.metalnessMap;
  material.normalMap = textures.normalMap;
  material.emissiveMap = textures.emissiveMap;
  material.color.set(0xffffff);
  material.emissive.set(0xffffff);
  material.roughness = 1;
  material.metalness = 1;
  material.ior = 1.54;
  material.specularIntensity = 1;
  material.dithering = true;

  if (role === 'body') {
    material.emissiveIntensity = 0.95;
    material.normalScale.set(0.14, 0.14);
    material.clearcoat = 0.76;
    material.clearcoatRoughness = 0.21;
    material.envMapIntensity = 0.44;
    material.sheen = 0.14;
    material.sheenColor.set(0x363c4a);
    material.sheenRoughness = 0.48;
  } else if (role === 'hair') {
    material.emissiveIntensity = 0.36;
    material.normalScale.set(0.06, 0.06);
    material.clearcoat = 0.46;
    material.clearcoatRoughness = 0.24;
    material.envMapIntensity = 0.46;
    material.sheen = 0.32;
    material.sheenColor.set(0x5c5248);
    material.sheenRoughness = 0.44;
  } else {
    material.emissiveIntensity = 1.12;
    material.normalScale.set(0.20, 0.20);
    material.clearcoat = 0.48;
    material.clearcoatRoughness = 0.18;
    material.envMapIntensity = 0.56;
    material.sheen = 0.24;
    material.sheenColor.set(0xfff5ea);
    material.sheenRoughness = 0.64;
  }
}

/**
 * Video-inspired contrasting body, hair, and wing materials:
 * - Radiant body: glossy charcoal/obsidian with restrained gold fractures
 * - Radiant hair: related dark finish with softer highlights so locks read distinctly
 * - Radiant wings: ivory-silver feather faces, darker charcoal-slate roots/recessed layers, fine broken gold veins
 * - Still: shifts body to quiet ivory and wings to cool pale silver with preserved layer contrast.
 */
export function createMarble(renderer) {
  SIZE = pickSize(renderer);
  LOW = Math.max(128, SIZE >> 1);
  UNIT = SIZE / 1024;
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

  for (const tex of Object.values(textures)) {
    tex.repeat.set(1, 1);
  }

  const uniforms = {
    uMarbleTime: { value: 0 },
    uMarbleStill: { value: 0 },
    uMarbleTransition: { value: 0 },
    uNeutralSpecular: { value: 0 },
    uClay: { value: 0 },
    uMarblePhase: { value: textures.phaseMap },
    uProject: { value: 0 },
    uMarbleMatrix: { value: new THREE.Matrix4() },
    uMarbleNormalMatrix: { value: new THREE.Matrix3() },
  };

  const warmSheen = new THREE.Color(0xfff4ea);
  const coolSheen = new THREE.Color(0xe3eef8);
  const bodyRadiantSheen = new THREE.Color(0x363c4a);
  const bodyStillSheen = new THREE.Color(0xdde8f4);
  const hairRadiantSheen = new THREE.Color(0x5c5248);
  const hairStillSheen = new THREE.Color(0xd4e2f0);
  const materials = [];

  const body = new THREE.MeshPhysicalMaterial();
  applySurface(body, textures, 'body');
  bindShader(body, uniforms, 'body');

  const hair = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  applySurface(hair, textures, 'hair');
  bindShader(hair, uniforms, 'hair');

  const wing = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  applySurface(wing, textures, 'wing');
  bindShader(wing, uniforms, 'wing');

  materials.push(body, hair, wing);

  const protoClone = THREE.MeshPhysicalMaterial.prototype.clone;
  body.clone = function cloneMarbleBody() {
    const cloned = protoClone.call(this);
    cloned.onBeforeCompile = this.onBeforeCompile;
    cloned.customProgramCacheKey = this.customProgramCacheKey;
    cloned.onBeforeRender = this.onBeforeRender;
    cloned.clone = this.clone;
    materials.push(cloned);
    return cloned;
  };

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const material of materials) {
      material.map = null;
      material.roughnessMap = null;
      material.metalnessMap = null;
      material.normalMap = null;
      material.emissiveMap = null;
      material.dispose();
    }
    for (const tex of Object.values(textures)) {
      tex.dispose();
      tex.image = null;
    }
  }

  function applyStill(still) {
    uniforms.uMarbleStill.value = still;
    for (const mat of materials) {
      if (mat === wing || mat === hair) continue;
      if (mat.userData?.isJoint) {
        mat.clearcoat = THREE.MathUtils.lerp(0.24, 0.20, still);
        mat.clearcoatRoughness = THREE.MathUtils.lerp(0.44, 0.46, still);
        mat.envMapIntensity = THREE.MathUtils.lerp(0.32, 0.48, still);
      } else {
        mat.clearcoat = THREE.MathUtils.lerp(0.76, 0.52, still);
        mat.clearcoatRoughness = THREE.MathUtils.lerp(0.23, 0.25, still);
        mat.envMapIntensity = THREE.MathUtils.lerp(0.44, 0.62, still);
      }
      mat.sheen = THREE.MathUtils.lerp(0.14, 0.24, still);
      mat.sheenColor.copy(bodyRadiantSheen).lerp(bodyStillSheen, still);
    }
    hair.clearcoat = THREE.MathUtils.lerp(0.46, 0.34, still);
    hair.envMapIntensity = THREE.MathUtils.lerp(0.46, 0.58, still);
    hair.sheen = THREE.MathUtils.lerp(0.32, 0.26, still);
    hair.sheenColor.copy(hairRadiantSheen).lerp(hairStillSheen, still);
    wing.sheenColor.copy(warmSheen).lerp(coolSheen, still);
    wing.clearcoatRoughness = THREE.MathUtils.lerp(0.18, 0.22, still);
  }

  return {
    body,
    hair,
    wing,
    textures,
    uniforms,
    update(time = 0) {
      if (Number.isFinite(time)) uniforms.uMarbleTime.value = time;
    },
    setForm(form, t = 1) {
      const k = Number.isFinite(Number(t)) ? Math.min(1, Math.max(0, Number(t))) : 1;
      if (form === 'still') applyStill(k);
      else if (form === 'radiant') applyStill(1 - k);
    },
    setTransition(signal) {
      const value = Number(signal?.envelope);
      uniforms.uMarbleTransition.value = Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 0;
    },
    setNeutralSpecular(enabled) {
      const v = enabled ? 1 : 0;
      uniforms.uNeutralSpecular.value = v;
      for (const material of materials) {
        material.normalScale.setScalar(enabled ? 0 : material === hair ? 0.06 : material === body ? 0.14 : 0.20);
      }
    },
    setClay(enabled) {
      const v = enabled ? 1 : 0;
      uniforms.uClay.value = v;
      for (const material of materials) {
        if (enabled) {
          material.clearcoat = 0;
          material.sheen = 0;
          material.normalScale.set(0, 0);
        }
      }
    },
    dispose,
    size: SIZE,
  };
}
