import * as THREE from '../vendor/three.module.js';

/**
 * The hero's morphing brand backdrop.
 *
 * A camera-locked plane running a fragment shader: the core gradient with
 * three soft colour bodies drifting across it and merging into each other.
 *
 * WHY THIS IS A SEPARATE LAYER, not a mode on GradientField
 * --------------------------------------------------------
 * GradientField paints a 2D canvas and re-uploads it as a texture whenever an
 * act changes the colour. That is right for Acts 2-4, where the field changes
 * a handful of times per scroll and its exact output is pinned by measured
 * contrast ceilings (MAX_TINT) that took two passes to get right. Animating it
 * would mean repainting and re-uploading 512x512 every frame, and would put
 * those measured light-section guarantees back in play for a change that only
 * concerns the hero.
 *
 * This runs on the GPU with no per-frame upload, and it is only ever visible
 * during Act 1 — a dark section with white copy, where the contrast budget is
 * completely different from the light body sections.
 *
 * TWO CONSTRAINTS INHERITED FROM THE FIELD IT REPLACES
 * ---------------------------------------------------
 * 1. OPAQUE. three.js renders only opaque objects into the transmission
 *    render target, so a transparent backdrop is invisible to the glass
 *    mark's refraction. Never set `transparent: true` here.
 * 2. It IS the mark's refraction content while it is up, which is why the
 *    colour bodies matter beyond decoration: clear glass in front of a
 *    perfectly smooth field refracts a uniform colour into the same uniform
 *    colour and the mark vanishes into its own background. Structure in the
 *    field is what makes the glass legible.
 */

// css/tokens.css. Hex is allowed in WebGL JS when the token is named.
const ACCENT = 0xd380eb;  // --accent, TCC Purple
const SUPPORT = 0xb1bdce; // --support, Space Grey
const CHAMBER = 0x08070a; // --chamber

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uAspect;
  uniform vec3  uDark;    // the gradient's dark end (bottom-left, under the copy)
  uniform vec3  uLight;   // the gradient's light end (top-right, where the mark is)
  uniform vec3  uAccent;
  uniform vec3  uSupport;
  uniform float uShade;   // how hard the bottom-left is weighted down
  uniform float uFluid;   // 0 = still, 1 = full drift

  // Smooth, wide falloff. Not a hard circle: these have to read as colour
  // bodies merging, not as discs sliding over one another.
  float body(vec2 p, vec2 c, float r) {
    float d = length((p - c) * vec2(uAspect, 1.0));
    return 1.0 - smoothstep(0.0, r, d);
  }

  void main() {
    vec2 uv = vUv;

    // Base ramp on the brand's 105deg axis, read as a diagonal across the
    // plane: dark at bottom-left, light at top-right.
    float ramp = clamp((uv.x + (1.0 - uv.y)) * 0.5, 0.0, 1.0);
    vec3 col = mix(uDark, uLight, ramp);

    // Three bodies on slow, mutually prime cycles so the composition never
    // visibly repeats. uFluid scales the TRAVEL, not the presence — at 0 they
    // are still there, holding their still positions, so freezing the clock
    // for ?shot=1 leaves a composed frame rather than a bare ramp.
    float t = uTime;
    vec2 c1 = vec2(0.70, 0.68) + uFluid * vec2(sin(t * 0.21) * 0.13, cos(t * 0.17) * 0.10);
    vec2 c2 = vec2(0.32, 0.30) + uFluid * vec2(cos(t * 0.13) * 0.16, sin(t * 0.19) * 0.12);
    vec2 c3 = vec2(0.52, 0.82) + uFluid * vec2(sin(t * 0.11) * 0.18, cos(t * 0.23) * 0.09);

    float b1 = body(uv, c1, 0.72);
    float b2 = body(uv, c2, 0.64);
    float b3 = body(uv, c3, 0.56);

    // The two brand hues trade places slowly, so the bodies morph into each
    // other's colour as well as each other's shape.
    float phase = 0.5 + 0.5 * sin(t * 0.09);
    vec3 hueA = mix(uAccent, uSupport, phase);
    vec3 hueB = mix(uSupport, uAccent, phase);

    // Mixed hard into the base (user, 2026-08-16: "really make those gradients
    // pop"). At the weights this started with — 0.55/0.42/0.30 — the bodies
    // were a wash over the ramp rather than the subject of it, and the morph
    // was legible only as a slight shimmer. The bottom-left shade below is
    // what keeps the copy safe, so the field itself can afford to be loud.
    col = mix(col, hueA, b1 * 0.92);
    col = mix(col, hueB, b2 * 0.78);
    col = mix(col, hueA, b3 * 0.60);

    // Push chroma away from the mean. Mixing brand colours toward each other
    // pulls everything to a muddy middle; this pulls the result back out so
    // purple stays purple where it lands.
    float mean = (col.r + col.g + col.b) / 3.0;
    col = clamp(mean + (col - mean) * 1.28, 0.0, 1.0);

    // Weight the bottom-left down, hard. The hero's copy sits there in white,
    // and this is the only thing keeping it off a bright field. Applied AFTER
    // the bodies so a drifting body can never lift the corner the text is on.
    float corner = clamp(((1.0 - uv.x) + uv.y) * 0.5, 0.0, 1.0);
    col = mix(col, uDark * 0.35, corner * uShade);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createFluidField(stage, { z = -14 } = {}) {
  // 0.72, not the 0.88 this started at: the dark end is still the anchor the
  // white copy needs, but at 0.88 it was almost pure --chamber and the ramp
  // read as black-to-grey with a purple tint somewhere in the middle.
  const dark = new THREE.Color(ACCENT).lerp(new THREE.Color(CHAMBER), 0.72);
  const light = new THREE.Color(SUPPORT);

  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: Math.max(stage.camera.aspect, 1) },
    uDark: { value: new THREE.Vector3(dark.r, dark.g, dark.b) },
    uLight: { value: new THREE.Vector3(light.r, light.g, light.b) },
    uAccent: { value: (() => { const c = new THREE.Color(ACCENT); return new THREE.Vector3(c.r, c.g, c.b); })() },
    uSupport: { value: (() => { const c = new THREE.Color(SUPPORT); return new THREE.Vector3(c.r, c.g, c.b); })() },
    uShade: { value: 0.62 },
    uFluid: { value: 1 },
  };

  const DIST = Math.abs(z);
  const h = 2 * DIST * Math.tan((stage.camera.fov * Math.PI) / 180 / 2);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(h * Math.max(stage.camera.aspect, 2.4) * 1.3, h * 1.3),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      // NEVER transparent — see the note at the top of this file.
      transparent: false,
      depthWrite: true,
    })
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
    uniforms.uAspect.value = Math.max(stage.camera.aspect, 1);
  }

  // The clock is OWNED here and advanced by elapsed time, never accumulated
  // per frame onto itself — an additive per-frame updater in this codebase
  // once turned an oscillation into a runaway (see act1's removal note).
  // Frozen when motion is off so ?shot=1 renders one reproducible frame.
  const start = performance.now();
  let animate = true;
  stage.addUpdater(() => {
    if (animate) uniforms.uTime.value = (performance.now() - start) / 1000;
    follow();
  });
  follow();

  const field = {
    mesh,
    uniforms,
    /** Freeze the drift on a fixed frame (reduced motion, ?shot=1). */
    freeze(at = 0) {
      animate = false;
      uniforms.uTime.value = at;
      uniforms.uFluid.value = 0;
    },
    show() { mesh.visible = true; follow(); },
    hide() { mesh.visible = false; },
    dispose() {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.removeFromParent();
    },
  };

  stage.addDisposer(field.dispose);
  window.__tccFluid = field;
  return field;
}
