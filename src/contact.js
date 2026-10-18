import * as THREE from 'three';

/**
 * Soft contact shadow from a top-down mask of the body (not the wings).
 * Wings are wide in plan and would paint a false shadow across the floor.
 * Low quality updates every other frame and skips the second blur.
 */

const blurVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const blurFragment = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform vec2 uTexel;
  void main() {
    vec2 step = uTexel * 7.2;
    vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
    c += texture2D(tDiffuse, vUv + step).rgb * 0.1945946;
    c += texture2D(tDiffuse, vUv - step).rgb * 0.1945946;
    c += texture2D(tDiffuse, vUv + step * 2.0).rgb * 0.1216216;
    c += texture2D(tDiffuse, vUv - step * 2.0).rgb * 0.1216216;
    c += texture2D(tDiffuse, vUv + step * 3.0).rgb * 0.054054;
    c += texture2D(tDiffuse, vUv - step * 3.0).rgb * 0.054054;
    c += texture2D(tDiffuse, vUv + step * 4.0).rgb * 0.016216;
    c += texture2D(tDiffuse, vUv - step * 4.0).rgb * 0.016216;
    gl_FragColor = vec4(c, 1.0);
  }
`;

function target(size, depth) {
  return new THREE.WebGLRenderTarget(size, size, {
    depthBuffer: depth,
    stencilBuffer: false,
    samples: 0,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
}

export function createContact(renderer, angel, quality) {
  const low = Boolean(quality?.low);
  const size = low ? 160 : 320;
  const maskTarget = target(size, true);
  const blurA = target(size, false);
  const blurB = target(size, false);

  const maskMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const cam = new THREE.OrthographicCamera(-3.4, 3.4, 3.4, -3.4, 0.2, 16);
  cam.position.set(0, 8, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  cam.layers.set(1);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();

  // The body mesh arrives after the GLB loads, so tag casters again each update.
  markContactCasters(angel);

  const matrix = new THREE.Matrix4();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  matrix.multiplyMatrices(bias, cam.projectionMatrix);
  matrix.multiply(cam.matrixWorldInverse);

  const blurMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      uTexel: { value: new THREE.Vector2(1 / size, 0) },
    },
    vertexShader: blurVertex,
    fragmentShader: blurFragment,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  const blurCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurMesh = new THREE.Mesh(geometry, blurMat);

  const clear = new THREE.Color();
  let frame = 0;
  let disposed = false;
  const stride = low ? 2 : 1;

  function markContactCasters(root) {
    root.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh) return;
      if (obj.userData.contact === false) return;
      obj.layers.enable(1);
    });
  }

  function blit(src, dest, dirX, dirY) {
    blurMat.uniforms.tDiffuse.value = src.texture;
    blurMat.uniforms.uTexel.value.set(dirX / size, dirY / size);
    renderer.setRenderTarget(dest);
    renderer.render(blurMesh, blurCam);
  }

  return {
    texture: blurB.texture,
    matrix,
    update() {
      if (disposed) return;
      frame += 1;
      if (stride > 1 && frame % stride !== 1) return;
      const scene = angel.parent;
      if (!scene) return;
      markContactCasters(angel);
      const prevTarget = renderer.getRenderTarget();
      const prevAlpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      const prevAuto = renderer.autoClear;
      const prevOverride = scene.overrideMaterial;
      const prevBackground = scene.background;
      const prevFog = scene.fog;
      try {
        scene.overrideMaterial = maskMat;
        scene.background = null;
        scene.fog = null;
        renderer.autoClear = true;
        renderer.setRenderTarget(maskTarget);
        renderer.setClearColor(0x000000, 1);
        renderer.render(scene, cam);
        scene.overrideMaterial = prevOverride;
        scene.background = prevBackground;
        scene.fog = prevFog;
        blit(maskTarget, blurA, 1, 0);
        blit(blurA, blurB, 0, 1);
        if (!low) {
          blit(blurB, blurA, 1, 0);
          blit(blurA, blurB, 0, 1);
        }
      } finally {
        scene.overrideMaterial = prevOverride;
        scene.background = prevBackground;
        scene.fog = prevFog;
        renderer.setClearColor(clear, prevAlpha);
        renderer.setRenderTarget(prevTarget);
        renderer.autoClear = prevAuto;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      maskTarget.dispose();
      blurA.dispose();
      blurB.dispose();
      maskMat.dispose();
      blurMat.dispose();
      geometry.dispose();
    },
  };
}
