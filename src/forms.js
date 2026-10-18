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
  background: new THREE.Color(0x040308),
  fog: new THREE.Color(0x09080d),
  fogDensity: 0.012,
  exposure: 0.74,
  envIntensity: 0.78,
  bloomStrength: 0.34,
  bloomThreshold: 1.62,
  bloomRadius: 0.58,
  bloomTint: new THREE.Color(0xffd7a2),
};

const STILL = {
  background: new THREE.Color(0x07141c),
  fog: new THREE.Color(0x1a5560),
  fogDensity: 0.024,
  exposure: 0.78,
  envIntensity: 0.55,
  bloomStrength: 0.32,
  bloomThreshold: 1.18,
  bloomRadius: 0.7,
  bloomTint: new THREE.Color(0xd5e8ff),
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const formBroken = new WeakSet();

function callSetForm(target, form, t) {
  if (!target || formBroken.has(target) || typeof target.setForm !== 'function') return;
  try {
    target.setForm(form, t);
  } catch (error) {
    formBroken.add(target);
    console.error(error);
  }
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
  try {
    const debris = mod.createDebris(marble);
    if (!debris?.group) return null;
    return debris;
  } catch (error) {
    console.warn('Skipping debris module.', error);
    return null;
  }
}

export function createForms({
  scene,
  renderer,
  bloom,
  floor,
  lights,
  moon,
  marble,
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
    // Floor, marble, and scene modules all share this contract.
    // Marble's setForm lands in #3; until then the method is absent.
    // Angel, rings, and particles may gain setForm in later PRs.
    callSetForm(floor, form, t);
    callSetForm(marble, form, t);
    for (const mod of modules) callSetForm(mod, form, t);

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
