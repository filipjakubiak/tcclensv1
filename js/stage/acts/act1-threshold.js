import * as THREE from '../../vendor/three.module.js';
import { motionEnabled } from '../../motion/reveal.js';

/**
 * Act 1 — Threshold.
 *
 * The brand's core gradient fills the whole hero. A pair of glass gate leaves
 * stands in it, right of the headline, and parts on X while the camera
 * dollies through; the head-and-heart mark waits beyond them and comes
 * forward as they clear.
 *
 * Two earlier versions of this act are worth knowing about, because both
 * were wrong in ways that are easy to repeat:
 *
 * 1. It opened on three store-aisle photographs receding on Z. Replaced with
 *    the gradient at the user's direction — and it is better optics anyway,
 *    since a smooth high-chroma field is what makes per-wavelength separation
 *    legible where a dim photograph mostly is not.
 *
 * 2. The gradient was then confined to an aperture in a --chamber storefront
 *    wall. That wall is gone: it left the page opening on a black screen,
 *    which is not what a brand gradient hero is. The gradient is the hero now,
 *    and the gate is an object standing in it rather than a hole cut through it.
 */

// Core gradient strength behind the gate, shut → open. The hero is
// .theme-dark with white copy on it, so brightness is steered by WHERE it
// falls (the field weights its bottom-left down, under the text) rather than
// by holding the whole field dim.
const FIELD_SHUT = 0.62;
const FIELD_OPEN = 0.9;

const CAM_START_Z = 8;
const CAM_END_Z = 0.55;
const GATE_Z = 1.0;

// The gate stands right of centre, clear of the headline.
const GATE_X = 2.6;
const GATE_W = 3.0;
const GATE_H = 4.6;

const lerp = (a, b, t) => a + (b - a) * t;

// Where this act leaves everything at t = 1. Act 2 starts from these exact
// values rather than its own guesses — act-boundary continuity is the thing
// most likely to break the scroll, and neither act can see the other.
export const END = {
  cam: [GATE_X * 0.72, 0.16, CAM_END_Z],
  look: [GATE_X * 0.9, 0, -2],
  mark: [GATE_X * 0.92, 0.05, -2.6],
  markRotY: 0.08,
  markScale: 1.0,
};

let doorL, doorR, aisleGlow, spill, doorMat;
// Local progress, kept so the per-frame idle spin knows how far in we are.
let localT = 0;
let doorShut = 0, doorOpen = 0;

/** World size of the camera frustum at a world Z, for the camera at its dolly start. */
function frustumAt(camera, z, fromZ = CAM_START_Z) {
  const h = 2 * (fromZ - z) * Math.tan((camera.fov * Math.PI) / 180 / 2);
  return { h, w: h * camera.aspect };
}

export default {
  id: 'threshold',
  // Act 1 owns the hero; Act 2 begins at #thesis. The director re-derives
  // these from the real section offsets, so the numbers here are only the
  // pre-layout fallback.
  anchor: '#hero',
  range: [0.0, 0.22],

  build(ctx) {
    const { stage } = ctx;

    const { w: frameW, h: frameH } = frustumAt(stage.camera, GATE_Z);

    // Doors: reflective envmap glass, NOT transmissive. Only the LensMark
    // runs a transmission pass — the single largest per-frame WebGL cost,
    // and the spec allows exactly one object to pay it.
    doorMat = new THREE.MeshPhysicalMaterial({
      color: 0xb1bdce, // --support: a cool tint, not a dark panel
      metalness: 0.0,
      roughness: 0.04,
      reflectivity: 1.0,
      envMapIntensity: 1.6,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });

    // A leaf of width W is shut when its centre sits at W/2, so its inner
    // edge lands on the aperture's centre line. Deriving it beats a constant
    // that silently becomes a gap the moment the aperture changes.
    const leafW = GATE_W / 2;
    doorShut = leafW / 2;
    doorOpen = GATE_W / 2 + leafW / 2 + 0.05; // fully clear of the opening

    const geo = new THREE.BoxGeometry(leafW, GATE_H, 0.05);
    doorL = new THREE.Mesh(geo, doorMat);
    doorR = new THREE.Mesh(geo, doorMat);
    doorL.position.set(GATE_X - doorShut, 0, GATE_Z);
    doorR.position.set(GATE_X + doorShut, 0, GATE_Z);
    stage.scene.add(doorL, doorR);

    // Spill from beyond the doorway, sitting between the gradient and the
    // mark so the glass has a near source to streak, plus a cool fill so
    // the shadow side never goes fully black.
    aisleGlow = new THREE.PointLight(0xd380eb, 30, 34); // --accent
    aisleGlow.position.set(GATE_X, 1.1, -3.0);
    spill = new THREE.AmbientLight(0xb1bdce, 0.35); // --support
    stage.scene.add(aisleGlow, spill);

    stage.addDisposer(() => {
      stage.scene.remove(aisleGlow, spill, doorL, doorR);
      geo.dispose();
      doorMat.dispose();
    });

    // The mark turns on its own before anyone scrolls.
    //
    // update() only runs when setProgress is called — i.e. on scroll — so a
    // rotation written there is frozen on a still page. This is a per-frame
    // updater instead, and it ADDS to whatever the act set rather than
    // replacing it. It fades out as the act gets under way, so the scroll
    // choreography takes over cleanly and nothing fights for the transform.
    stage.addUpdater((elapsed) => {
      if (!motionEnabled()) return; // ?shot=1 and reduced motion stay settled
      const idle = 1 - THREE.MathUtils.smoothstep(localT, 0.02, 0.3);
      if (idle <= 0) return;
      ctx.lens.group.rotation.y += Math.sin(elapsed * 0.45) * 0.55 * idle;
      ctx.lens.group.rotation.x = Math.sin(elapsed * 0.31) * 0.09 * idle;
    });

    window.__tccAct1 = { doorL, doorR };
  },

  // Every act declares the full backdrop state on enter, so the swap is
  // correct in either scroll direction without needing exit hooks.
  enter(ctx) {
    for (const o of [doorL, doorR]) o.visible = true;
    // The gradient field runs from the very first frame now — the store
    // photography behind the doors is gone (user direction, 2026-08-15).
    // It is also the mark's refraction content from frame one, which is
    // strictly better than the dim plates it replaces.
    ctx.field?.show();
    // Act 1 is the only act where the mark is a single assembled object, so
    // it owns putting the halves back together for anyone scrolling up.
    for (const p of [ctx.lens.headPivot, ctx.lens.heartPivot]) {
      p.position.set(0, 0, 0);
      p.rotation.set(0, 0, 0);
    }
  },

  update(t, ctx) {
    const { stage, lens } = ctx;
    localT = t;

    // Hold shut, then part decisively across the middle of the act.
    const slide = THREE.MathUtils.smoothstep(t, 0.10, 0.78);
    doorL.position.x = GATE_X - lerp(doorShut, doorOpen, slide);
    doorR.position.x = GATE_X + lerp(doorShut, doorOpen, slide);

    // The dolly through the threshold, aimed at the aperture rather than
    // dead ahead so the doorway stays the subject as we close on it.
    const push = THREE.MathUtils.smoothstep(t, 0, 1);
    stage.camera.position.set(
      lerp(0, GATE_X * 0.72, push),
      lerp(0, 0.16, push),
      lerp(CAM_START_Z, CAM_END_Z, push)
    );
    stage.camera.lookAt(GATE_X * 0.9, 0, -2);

    // Full brand saturation, not the pale tint the light body sections get:
    // the hero is .theme-dark, so its copy is white and the backdrop wants
    // the real colours. Legibility is handled by WHERE the brightness falls —
    // the field weights its bottom-left down, under the text — rather than by
    // holding the whole thing dim, which is what made it read as a grey slab.
    // Constant for the whole act. Ramping it brighter as the gate opened
    // read well in isolation but the hero copy is still on screen through all
    // of it, and the brighter end measured 2.92:1 against a 4.5:1 floor. The
    // reveal is the gate parting and the mark coming forward — it does not
    // also need the backdrop to change.
    ctx.field?.setHeroGradient('core', 0.9, 0.55);

    // The mark waits beyond the doorway and drifts forward as they clear.
    lens.group.position.set(
      // Stays right of the headline for the whole act — drifting to 0.62 of
      // the gate position walked it straight across the copy.
      lerp(GATE_X, GATE_X * 0.92, push),
      lerp(-0.15, END.mark[1], slide),
      lerp(-4.2, END.mark[2], slide)
    );
    lens.group.rotation.y = lerp(-0.6, END.markRotY, slide);
    lens.group.scale.setScalar(lerp(0.9, END.markScale, slide));
    aisleGlow.intensity = lerp(30, 46, slide);
  },
};
