import * as THREE from 'three';

/**
 * Form blend shared with the other scene modules.
 *
 * setForm(form, t)
 *   form — destination, 'radiant' or 'still'
 *   t    — eased progress toward that destination, 0 → 1
 *
 * At rest t is 1. A reversal does not restart at 0: t jumps to the
 * progress that preserves the current mix, then eases to 1.
 * stillWeight = form === 'still' ? t : 1 - t
 *
 * Modules should look correct if setForm is never called (radiant).
 */

const FULL_SECONDS = 2.7;

const RADIANT = {
  background: new THREE.Color(0x05040a),
  fog: new THREE.Color(0x100e14),
  fogDensity: 0.016,
  exposure: 0.92,
  envIntensity: 1.25,
  bloomStrength: 0.46,
  bloomThreshold: 1.45,
  bloomRadius: 0.42,
  bloomTint: new THREE.Color(0xffe2b0),
};

const STILL = {
  background: new THREE.Color(0x07141c),
  fog: new THREE.Color(0x1a5560),
  fogDensity: 0.026,
  exposure: 0.86,
  envIntensity: 0.72,
  bloomStrength: 0.28,
  bloomThreshold: 1.65,
  bloomRadius: 0.62,
  bloomTint: new THREE.Color(0xd5e8ff),
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Optional debris module. import.meta.glob resolves at build time, so a
 * missing src/debris.js does not fail the build. When the file lands,
 * createDebris(marble) is picked up on the next build.
 */
export function createDebrisModule(marble) {
  const found = import.meta.glob('./debris.js', { eager: true });
  const mod = found['./debris.js'];
  if (!mod || typeof mod.createDebris !== 'function') return null;
  return mod.createDebris(marble);
}

export function createForms({
  scene,
  renderer,
  bloom,
  floor,
  lights,
  moon,
  modules,
  grade,
  onChange,
  reducedMotion,
}) {
  let still = 0;
  let desired = 'radiant';
  let from = 0;
  let to = 0;
  let elapsed = 0;
  let duration = FULL_SECONDS;
  let animating = false;

  const scratch = new THREE.Color();

  function destinationOf(form) {
    return form === 'still' ? 'still' : 'radiant';
  }

  function progressToward(form, weight) {
    return form === 'still' ? weight : 1 - weight;
  }

  function apply(weight) {
    const form = desired;
    const t = progressToward(form, weight);

    scene.background.copy(RADIANT.background).lerp(STILL.background, weight);
    scene.fog.color.copy(RADIANT.fog).lerp(STILL.fog, weight);
    scene.fog.density = lerp(RADIANT.fogDensity, STILL.fogDensity, weight);
    scene.environmentIntensity = lerp(RADIANT.envIntensity, STILL.envIntensity, weight);
    renderer.toneMappingExposure = lerp(RADIANT.exposure, STILL.exposure, weight);
    renderer.setClearColor(scene.background, 1);

    bloom.strength = lerp(RADIANT.bloomStrength, STILL.bloomStrength, weight);
    bloom.threshold = lerp(RADIANT.bloomThreshold, STILL.bloomThreshold, weight);
    bloom.radius = lerp(RADIANT.bloomRadius, STILL.bloomRadius, weight);
    scratch.copy(RADIANT.bloomTint).lerp(STILL.bloomTint, weight);
    for (const tint of bloom.bloomTintColors) {
      tint.set(scratch.r, scratch.g, scratch.b);
    }

    const L = lights;
    L.hemi.color.copy(L.hemi.userData.sky0).lerp(L.hemi.userData.sky1, weight);
    L.hemi.groundColor.copy(L.hemi.userData.ground0).lerp(L.hemi.userData.ground1, weight);
    L.hemi.intensity = lerp(L.hemi.userData.i0, L.hemi.userData.i1, weight);

    blendLight(L.key, weight);
    blendLight(L.rim, weight);
    blendLight(L.fill, weight);
    blendLight(L.warmA, weight);
    blendLight(L.warmB, weight);
    blendLight(L.moonDir, weight);
    blendLight(L.moonFill, weight);

    moon.material.uniforms.uIntensity.value = lerp(0, moon.userData.stillIntensity, weight);
    moon.visible = weight > 0.001;

    if (grade) grade.uniforms.uStill.value = weight;
    if (floor) floor.setForm(form, t);

    for (const mod of modules) {
      if (mod && typeof mod.setForm === 'function') mod.setForm(form, t);
    }

    document.documentElement.style.setProperty('--still', weight.toFixed(4));
    document.body.style.backgroundColor = `#${scene.background.getHexString()}`;
  }

  function blendLight(light, weight) {
    const data = light.userData;
    light.color.copy(data.color0).lerp(data.color1, weight);
    light.intensity = lerp(data.i0, data.i1, weight);
  }

  function begin(immediate) {
    const next = desired === 'still' ? 1 : 0;
    if (immediate || reducedMotion) {
      still = next;
      animating = false;
      apply(still);
      return;
    }
    from = still;
    to = next;
    elapsed = 0;
    duration = Math.max(0.45, FULL_SECONDS * Math.abs(to - from));
    animating = Math.abs(to - from) > 0.0001;
    if (!animating) apply(still);
  }

  function goTo(form, immediate = false) {
    const next = destinationOf(form);
    const changed = next !== desired;
    desired = next;
    begin(immediate);
    if (changed && onChange) onChange(desired, { animate: !immediate && !reducedMotion });
    else if (immediate && onChange) onChange(desired, { animate: false });
  }

  apply(0);

  return {
    get form() {
      return desired;
    },
    get still() {
      return still;
    },
    toggle() {
      goTo(desired === 'radiant' ? 'still' : 'radiant');
    },
    goTo,
    update(dt) {
      if (!animating) return;
      elapsed += dt;
      const p = Math.min(1, elapsed / duration);
      still = from + (to - from) * smoothstep(p);
      if (p >= 1) {
        still = to;
        animating = false;
      }
      apply(still);
    },
  };
}
