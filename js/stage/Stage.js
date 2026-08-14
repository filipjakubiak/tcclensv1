import * as THREE from '../vendor/three.module.js';

/**
 * Boots the single persistent WebGL stage behind the DOM.
 * Returns null (never throws) when WebGL is unavailable — Task 17
 * branches on that to install the poster fallback.
 */
export function createStage() {
  const canvas = document.getElementById('stage');
  if (!canvas) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return null; // no WebGL — Task 17 installs the poster fallback
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); // HARD CONSTRAINT: DPR cap
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08070a); // --chamber

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 8);

  const clock = new THREE.Clock();
  const updaters = [];
  const disposers = [];
  let raf = 0;

  const stage = { THREE, scene, camera, renderer, clock, frames: 0, addUpdater, addDisposer, dispose };

  function addUpdater(fn) {
    updaters.push(fn);
  }

  // Extension hook mirroring addUpdater: anything built off the scene graph
  // (PMREM environment maps and their render targets, in particular) is
  // invisible to scene.traverse() below, so callers register their own
  // teardown here instead of relying on dispose() to find it.
  function addDisposer(fn) {
    disposers.push(fn);
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    for (const fn of updaters) fn(t, dt);
    renderer.render(scene, camera);
    stage.frames += 1;
  }

  function start() {
    if (!raf) {
      clock.getDelta(); // discard the elapsed-while-stopped delta
      raf = requestAnimationFrame(frame);
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') stop();
    else start();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }, 120);
  }
  window.addEventListener('resize', onResize, { passive: true });

  // Material.dispose() does not cascade to its texture maps (by design —
  // textures are often shared across materials), so walk each material's
  // known map slots and dispose those textures explicitly.
  const TEXTURE_SLOTS = [
    'map', 'alphaMap', 'aoMap', 'bumpMap', 'clearcoatMap', 'clearcoatNormalMap',
    'clearcoatRoughnessMap', 'displacementMap', 'emissiveMap', 'envMap',
    'iridescenceMap', 'iridescenceThicknessMap', 'lightMap', 'metalnessMap',
    'normalMap', 'roughnessMap', 'sheenColorMap', 'sheenRoughnessMap',
    'specularColorMap', 'specularIntensityMap', 'thicknessMap',
    'transmissionMap',
  ];

  function disposeMaterial(material) {
    for (const slot of TEXTURE_SLOTS) material[slot]?.dispose?.();
    material.dispose();
  }

  function dispose() {
    stop();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', onResize);
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach(disposeMaterial);
      else if (o.material) disposeMaterial(o.material);
    });
    // Anything off the scene graph (env maps, PMREM render targets, …)
    // registered its own teardown via addDisposer — run those too.
    for (const fn of disposers) fn();
    renderer.dispose();
  }

  start();
  return stage;
}
