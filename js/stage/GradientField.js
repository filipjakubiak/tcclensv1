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
const MAX_TINT = 0.3;

export function createGradientField(stage, { z = -14 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const from = new THREE.Color(CHAMBER);
  const to = new THREE.Color(CHAMBER);

  function paint() {
    // 105deg in CSS, read as a diagonal across the square — the same axis
    // the brand book's gradients run on.
    const g = ctx.createLinearGradient(0, SIZE, SIZE, 0);
    g.addColorStop(0, '#' + from.getHexString());
    g.addColorStop(1, '#' + to.getHexString());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    texture.needsUpdate = true;
  }
  paint();

  // Cover the frustum at this depth from the nearest the camera ever gets,
  // with margin, so the field never shows an edge.
  const dist = Math.abs(z) + 8;
  const h = 2 * dist * Math.tan((stage.camera.fov * Math.PI) / 180 / 2);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(h * Math.max(stage.camera.aspect, 1.9) * 1.6, h * 1.6),
    // Basic, not Standard: this is a backdrop, not a lit surface. Lighting
    // it would muddy the brand colours the whole act depends on.
    new THREE.MeshBasicMaterial({ map: texture })
  );
  mesh.position.set(0, 0, z);
  mesh.visible = false;
  stage.scene.add(mesh);

  const field = {
    mesh,
    /**
     * Blend toward a named gradient. `amount` 0 keeps the field at --chamber
     * (so Act 1's dark aisle can hand over without a cut), 1 lands on the
     * brand gradient tinted over --canvas at MAX_TINT.
     */
    setGradient(name, amount = 1, tint = MAX_TINT) {
      const [a, b] = GRADIENTS[name] ?? GRADIENTS.core;
      const t = Math.min(tint, MAX_TINT);
      const target = (hex) => new THREE.Color(CANVAS).lerp(new THREE.Color(hex), t);
      from.setHex(CHAMBER).lerp(target(a), amount);
      to.setHex(CHAMBER).lerp(target(b), amount);
      paint();
    },
    show() { mesh.visible = true; },
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
