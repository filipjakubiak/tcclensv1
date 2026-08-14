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
  let raf = 0;

  const stage = { THREE, scene, camera, renderer, clock, frames: 0, addUpdater, dispose };

  function addUpdater(fn) {
    updaters.push(fn);
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

  function dispose() {
    stop();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', onResize);
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material?.dispose?.();
    });
    renderer.dispose();
  }

  start();
  return stage;
}
