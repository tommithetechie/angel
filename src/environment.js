import * as THREE from 'three';

/**
 * Procedural HDR environments, one per form.
 * Generated at startup and thrown away after PMREM. This is original
 * image data, not a downloaded HDRI, so there is no third-party license.
 *
 * setForm(form, t) blends the prefiltered maps. update() is a no-op.
 * dispose() releases both PMREM targets and the blend target.
 */

function dirFromUv(u, v) {
  const phi = (u - 0.5) * Math.PI * 2;
  const lat = (v - 0.5) * Math.PI;
  const y = Math.sin(lat);
  const ring = Math.cos(lat);
  return [Math.cos(phi) * ring, y, Math.sin(phi) * ring];
}

function normalize(x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

function addLobe(color, dir, light, rgb, power) {
  const d = dir[0] * light[0] + dir[1] * light[1] + dir[2] * light[2];
  if (d <= 0) return;
  const w = d ** power;
  color[0] += rgb[0] * w;
  color[1] += rgb[1] * w;
  color[2] += rgb[2] * w;
}

function paintRadiant(dir, color) {
  const up = dir[1];
  const sky = up > 0 ? up : 0;
  const ground = up < 0 ? -up : 0;
  color[0] = 0.008 + sky * 0.012 + ground * 0.028;
  color[1] = 0.007 + sky * 0.009 + ground * 0.014;
  color[2] = 0.011 + sky * 0.014 + ground * 0.008;
  const key = normalize(-2.1, 4.4, 5.4);
  const rim = normalize(3.4, 3.6, -3.8);
  const warmA = normalize(1.25, 1.72, 1.65);
  const warmB = normalize(-1.45, 0.72, 1.55);
  addLobe(color, dir, key, [2.4, 1.7, 1.05], 3);
  addLobe(color, dir, key, [9.5, 6.8, 4.1], 22);
  addLobe(color, dir, rim, [1.8, 2.4, 4.2], 16);
  addLobe(color, dir, warmA, [16, 8.2, 2.2], 70);
  addLobe(color, dir, warmB, [11, 5.2, 1.3], 54);
  addLobe(color, dir, normalize(0.1, 1, 0.15), [1.6, 1.25, 0.85], 5);
}

function paintStill(dir, color) {
  const up = dir[1];
  const sky = up > 0 ? up : 0;
  const ground = up < 0 ? -up : 0;
  const horizon = Math.exp(-up * up * 26);
  color[0] = 0.003 + sky * 0.005 + horizon * 0.018 + ground * 0.008;
  color[1] = 0.008 + sky * 0.014 + horizon * 0.04 + ground * 0.026;
  color[2] = 0.016 + sky * 0.028 + horizon * 0.048 + ground * 0.03;
  const moon = normalize(3.15, 3.45, -6.1);
  addLobe(color, dir, moon, [4.2, 4.8, 6.4], 10);
  addLobe(color, dir, moon, [36, 40, 48], 700);
  addLobe(color, dir, normalize(-1.4, 2.8, 4.6), [0.45, 0.62, 0.75], 7);
}

function equirect(width, height, fill) {
  const data = new Float32Array(width * height * 4);
  const color = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      color[0] = 0;
      color[1] = 0;
      color[2] = 0;
      fill(dirFromUv(u, v), color);
      const i = (y * width + x) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const blendVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const blendFragment = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D mapA;
  uniform sampler2D mapB;
  uniform float uStill;
  void main() {
    gl_FragColor = mix(texture2D(mapA, vUv), texture2D(mapB, vUv), uStill);
  }
`;

export function createEnvironment(renderer, quality) {
  const width = quality?.low ? 512 : 1024;
  const height = width >> 1;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const radiantSrc = equirect(width, height, paintRadiant);
  const stillSrc = equirect(width, height, paintStill);
  const radiantTarget = pmrem.fromEquirectangular(radiantSrc);
  const stillTarget = pmrem.fromEquirectangular(stillSrc);
  radiantSrc.dispose();
  stillSrc.dispose();
  pmrem.dispose();

  const blendTarget = new THREE.WebGLRenderTarget(radiantTarget.width, radiantTarget.height, {
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    generateMipmaps: false,
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    depthBuffer: false,
  });
  blendTarget.texture.mapping = THREE.CubeUVReflectionMapping;
  blendTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
  blendTarget.texture.magFilter = THREE.LinearFilter;
  blendTarget.texture.minFilter = THREE.LinearFilter;
  blendTarget.texture.generateMipmaps = false;
  blendTarget.scissorTest = false;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      mapA: { value: radiantTarget.texture },
      mapB: { value: stillTarget.texture },
      uStill: { value: 0 },
    },
    vertexShader: blendVertex,
    fragmentShader: blendFragment,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mesh = new THREE.Mesh(geometry, material);

  let last = -1;
  let disposed = false;

  function renderBlend(still) {
    material.uniforms.uStill.value = still;
    const prev = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(blendTarget);
    renderer.render(mesh, camera);
    renderer.setRenderTarget(prev);
    renderer.autoClear = prevAuto;
    last = still;
  }

  renderBlend(0);

  return {
    texture: blendTarget.texture,
    update() {},
    setForm(form, t = 1) {
      if (disposed) return;
      const raw = Number(t);
      const k = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 1;
      let still = last < 0 ? 0 : last;
      if (form === 'still') still = k;
      else if (form === 'radiant') still = 1 - k;
      if (Math.abs(still - last) < 0.0015) return;
      renderBlend(still);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      radiantTarget.dispose();
      stillTarget.dispose();
      blendTarget.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}
