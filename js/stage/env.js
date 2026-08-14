import * as THREE from '../vendor/three.module.js';

/**
 * Procedural brand environment for the glass LensMark.
 *
 * Generated at runtime instead of shipped as an HDR: a canvas gradient
 * from TCC Purple through Space Grey down to the chamber floor, with two
 * soft highlights for the glass to catch and streak, run through
 * PMREMGenerator and assigned to scene.environment. Because the gradient
 * is painted from the brand tokens, the glass refracts brand colour by
 * construction — and Task 15 can re-tint per capability gradient for
 * free by calling setTint() again.
 */
export function buildEnvironment(stage, { from = 0xd380eb, to = 0xb1bdce } = {}) {
  // 0xD380EB = --accent (TCC Purple), 0xB1BDCE = --support (Space Grey)
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(stage.renderer);
  pmrem.compileEquirectangularShader();
  let envRT = null;

  const hex = (n) => '#' + n.toString(16).padStart(6, '0');

  function paint(f, t) {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, hex(f));
    g.addColorStop(0.55, hex(t));
    g.addColorStop(1, '#08070A'); // --chamber (near-black chamber floor)
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Two soft highlights give the glass something to catch and streak.
    for (const [x, y, r, a] of [
      [size * 0.28, size * 0.22, size * 0.16, 0.85],
      [size * 0.74, size * 0.34, size * 0.1, 0.5],
    ]) {
      const s = ctx.createRadialGradient(x, y, 0, x, y, r);
      s.addColorStop(0, `rgba(255,255,255,${a})`);
      s.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, size, size);
    }
    texture.needsUpdate = true;

    const nextRT = pmrem.fromEquirectangular(texture);
    envRT?.dispose();
    envRT = nextRT;
    stage.scene.environment = envRT.texture;
  }

  paint(from, to);

  function dispose() {
    envRT?.dispose();
    envRT = null;
    texture.dispose();
    pmrem.dispose();
    stage.scene.environment = null;
  }
  stage.addDisposer(dispose);

  return { texture, setTint: paint, dispose };
}
