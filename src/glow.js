import * as THREE from 'three';

/**
 * A short cool shaft from the moon toward the water. Radiant hides it.
 * Narrow viewports use fewer sides and a lower fade so the fill rate stays small.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uFade;
  uniform vec3 uColor;
  void main() {
    float around = vUv.x;
    float along = vUv.y;
    float ray = sin(around * 48.0 + uTime * 0.22 + sin(around * 13.0) * 1.6);
    ray = smoothstep(0.2, 0.95, ray * 0.5 + 0.5);
    float streak = pow(ray, 2.8);
    float fade = pow(1.0 - along, 1.7) * smoothstep(0.0, 0.08, 1.0 - along);
    float alpha = streak * 0.42 * fade * uFade;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function stillWeight(form, t) {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, Number(t))) : 1;
  if (form === 'still') return k;
  if (form === 'radiant') return 1 - k;
  return null;
}

export function createMoonGlow(moon, quality) {
  const low = Boolean(quality?.low);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 0 },
      uColor: { value: new THREE.Color().setRGB(0.62, 0.74, 0.95) },
    },
    vertexShader,
    fragmentShader,
  });

  const height = 6.4;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(low ? 0.05 : 0.04, low ? 0.34 : 0.28, height, low ? 24 : 40, 1, true),
    material,
  );
  mesh.name = 'moon-shaft';
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  const dir = new THREE.Vector3(0.2, -1.05, 1.6).sub(moon.position);
  dir.normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  mesh.position.copy(moon.position).addScaledVector(dir, height * 0.5);

  const group = new THREE.Group();
  group.name = 'moon-glow';
  group.add(mesh);

  const cap = low ? 0.28 : 0.55;
  let blend = 0;

  function apply() {
    material.uniforms.uFade.value = blend * cap;
    mesh.visible = blend > 0.03;
  }

  return {
    group,
    update(time) {
      material.uniforms.uTime.value = Number.isFinite(time) ? time : 0;
    },
    setForm(form, t) {
      const next = stillWeight(form, t);
      if (next === null) return;
      blend = next;
      apply();
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
