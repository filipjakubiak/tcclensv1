import * as THREE from '../vendor/three.module.js';

/**
 * A full-frame brand-gradient backdrop for Acts 2–4.
 *
 * Act 1's aisle plates are the store; once past the threshold the backdrop
 * becomes the brand book's own gradients instead of photography.
 *
 * Two hard requirements shaped this:
 *
 * 1. **It must be opaque.** three.js renders only opaque objects into the
 *    transmission render target, so a `transparent: true` backdrop is
 *    invisible to the glass mark's refraction — measured directly in Task 13,
 *    where transparent aisle plates left the mark's centre pixel unchanged
 *    even when forced to blazing magenta. Fading is therefore done by
 *    driving the gradient's colours toward --chamber, never by opacity.
 *
 * 2. **It is the mark's refraction content.** A saturated two-stop brand
 *    gradient is the best thing this scene can put behind the glass: it is
 *    exactly the smooth, high-chroma field that makes per-wavelength IOR
 *    separation legible.
 */

// css/tokens.css, verified byte-for-byte against the token values.
export const GRADIENTS = {
  core:           [0xd380eb, 0xb1bdce], // --grad-core: TCC Purple -> Space Grey
  performance:    [0xffadbd, 0xcfd0f7], // --grad-performance
  insight:        [0xb7f4e6, 0xcfd0f7], // --grad-insight
  creativity:     [0xfdffcf, 0xf8c1f7], // --grad-creativity
  operational:    [0xffc896, 0xd9caf6], // --grad-operational
  sustainability: [0xb7f4e6, 0xe6f5a9], // --grad-sustainability
};

const CHAMBER = 0x08070a; // --chamber
const CANVAS = 0xfcfcfc;  // --canvas, the page's paper colour
const SIZE = 512;

/**
 * How far the backdrop is allowed to travel from --canvas toward the raw
 * brand gradient. NOT a taste value — a measured ceiling.
 *
 * The stage canvas sits above `body`'s --canvas fill and below `main`, and
 * only .theme-dark sections paint their own background. So this field IS
 * the page background for every light section it plays under, and the text
 * over it is the site's ordinary dark-on-paper copy.
 *
 * At full strength the gradient measured rgb(205,177,216) behind the copy:
 * eyebrows fell to 2.01:1 against a 4.5:1 requirement and body copy to
 * 4.19:1. Both are real WCAG AA failures, and the repo's existing contrast
 * guard could not see them — it measures tokens against --canvas, which
 * stopped being the background the moment this field existed.
 */
const MAX_TINT = 0.46;

export function createGradientField(stage, { z = -14 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const from = new THREE.Color(CHAMBER);
  const to = new THREE.Color(CHAMBER);
  // How hard the bottom-left is weighted down, where the copy sits.
  let shade = 0.55;

  function paint() {
    // 105deg in CSS, read as a diagonal across the square — the same axis
    // the brand book's gradients run on.
    const g = ctx.createLinearGradient(0, SIZE, SIZE, 0);
    g.addColorStop(0, '#' + from.getHexString());
    g.addColorStop(1, '#' + to.getHexString());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Soft blooms. These are not decoration — they are what makes the glass
    // visible. Clear glass in front of a perfectly smooth field refracts a
    // uniform colour into the same uniform colour, so the mark vanishes into
    // its own background: measured at rgb(97,99,115) inside the silhouette
    // against a near-identical field outside it. Refraction only reads when
    // there is structure to bend, so the field carries some.
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r, a] of [
      // One tight, bright hotspot behind where the mark sits, and one broad
      // soft one for general lift. The tight one is doing the work: a broad
      // 0.42-radius bloom is almost as smooth as no bloom at all, and the
      // mark measured a mean delta of 10.7/765 against it — present in the
      // scene graph, invisible on screen.
      [0.70, 0.30, 0.13, 0.46],
      [0.74, 0.28, 0.38, 0.18],
      [0.28, 0.66, 0.30, 0.12],
    ]) {
      const s = ctx.createRadialGradient(x * SIZE, y * SIZE, 0, x * SIZE, y * SIZE, r * SIZE);
      s.addColorStop(0, `rgba(255,255,255,${a})`);
      s.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Weight the bottom-left down. Page copy sits left; the brightest part of
    // the field belongs on the opposite diagonal, away from the text.
    const v = ctx.createLinearGradient(0, SIZE, SIZE * 0.75, SIZE * 0.15);
    v.addColorStop(0, `rgba(8,7,10,${shade})`);
    v.addColorStop(1, 'rgba(8,7,10,0)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, SIZE, SIZE);

    texture.needsUpdate = true;
  }
  paint();

  // The field rides the camera at a fixed distance rather than sitting at a
  // fixed point in the scene.
  //
  // As a world-space plane it drifted under the copy: the acts dolly and pan,
  // so whichever part of the gradient sat behind the headline changed with
  // every frame, and the bright end slid under the text mid-dolly — measured
  // at 3.37:1 against a 4.5:1 floor at exactly the point the camera had moved
  // furthest. Locked to the camera, "dark under the copy, bright top-right"
  // is a property of the design instead of a coincidence of one frame.
  //
  // It is also what a section background actually is: a backdrop, not scenery.
  const DIST = Math.abs(z);
  const h = 2 * DIST * Math.tan((stage.camera.fov * Math.PI) / 180 / 2);
  const mesh = new THREE.Mesh(
    // Generous margin so no edge shows at any aspect ratio.
    new THREE.PlaneGeometry(h * Math.max(stage.camera.aspect, 2.4) * 1.3, h * 1.3),
    // Basic, not Standard: this is a backdrop, not a lit surface. Lighting
    // it would muddy the brand colours the whole act depends on.
    new THREE.MeshBasicMaterial({ map: texture })
  );
  mesh.visible = false;
  stage.scene.add(mesh);

  const fwd = new THREE.Vector3();
  function follow() {
    stage.camera.updateMatrixWorld();
    stage.camera.getWorldDirection(fwd);
    mesh.position.copy(stage.camera.position).addScaledVector(fwd, DIST);
    mesh.quaternion.copy(stage.camera.quaternion);
    mesh.updateMatrixWorld();
  }
  // Every frame for the live page, and again whenever an act repaints — the
  // rAF loop alone would leave the position stale for any synchronous render,
  // which is exactly what the tests and probes do.
  stage.addUpdater(follow);
  follow();

  const field = {
    mesh,
    /**
     * Blend toward a named gradient. `amount` 0 keeps the field at --chamber
     * (so Act 1's dark aisle can hand over without a cut), 1 lands on the
     * brand gradient tinted over --canvas at MAX_TINT.
     */
    setGradient(name, amount = 1, tint = MAX_TINT, shadeAmount = 0.55) {
      const [a, b] = GRADIENTS[name] ?? GRADIENTS.core;
      const t = Math.min(tint, MAX_TINT);
      const target = (hex) => new THREE.Color(CANVAS).lerp(new THREE.Color(hex), t);
      from.setHex(CHAMBER).lerp(target(a), amount);
      to.setHex(CHAMBER).lerp(target(b), amount);
      shade = shadeAmount;
      paint();
      follow();
    },

    /**
     * Full-strength brand gradient, ignoring the light-section tint ceiling.
     * For the hero, which is .theme-dark: its copy is white, so the backdrop
     * wants the brand colours at real saturation and a hard weight under the
     * text, not the pale wash the light body sections need.
     */
    setHeroGradient(name = 'core', depth = 0.72, shadeAmount = 0.4) {
      const [a, b] = GRADIENTS[name] ?? GRADIENTS.core;
      // The DARK end sits at bottom-left, under the headline, and the bright
      // end runs off to the top-right where the gate and the mark are. Using
      // the raw brand stops at both ends put full-strength TCC Purple
      // directly behind white copy — bright, on-brand, and unreadable.
      from.setHex(a).lerp(new THREE.Color(CHAMBER), depth);
      to.setHex(b);
      shade = shadeAmount;
      paint();
      follow();
    },
    show() { mesh.visible = true; follow(); },
    hide() { mesh.visible = false; },
    dispose() {
      mesh.geometry.dispose();
      mesh.material.dispose();
      texture.dispose();
      mesh.removeFromParent();
    },
  };

  stage.addDisposer(field.dispose);
  window.__tccField = field;
  return field;
}
