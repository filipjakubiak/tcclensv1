import * as THREE from '../../vendor/three.module.js';

/**
 * Act 1 — Threshold (progress 0.00 → 0.22).
 *
 * A --chamber storefront wall fills the frame with one lit aperture in it,
 * right of the headline. Two glass doors part on X, the camera dollies
 * through the aperture, and the brand's core gradient opens out beyond it
 * with the glass mark hanging in front of it.
 *
 * Two things drive the construction:
 *
 * 1. **The wall is what makes it a threshold.** A full-bleed backdrop reads
 *    as a picture behind text, with no "outside" to cross from. Confining
 *    the light to an aperture and painting the rest in --chamber is what
 *    turns it into a doorway, and it keeps the hero copy on flat dark ground.
 *
 * 2. **The backdrop is the transmission content.** Before it existed the
 *    glass refracted flat near-black and its dispersion was inert no matter
 *    how the material was tuned.
 *
 * This act originally opened on store photography — three aisle stills
 * receding on Z. Replaced with the core gradient at the user's direction
 * (2026-08-15). It is also better optics: a smooth high-chroma field is
 * exactly what makes per-wavelength separation legible, where a dim
 * photograph mostly is not.
 */

// How far the core gradient is brought up behind the doors. Deliberately
// low, and the numbers look smaller than they are: three.js blends colour in
// LINEAR space, so 0.16 here already renders around 0.44 in sRGB. The hero is
// .theme-dark with white copy over this, so the backdrop
// has to stay a deep, dark reading of --grad-core rather than the pale tint
// the light body sections get. It lifts as the doors part, so the store
// coming up to brightness is still the reveal.
const FIELD_SHUT = 0.26;
const FIELD_OPEN = 0.62;

const CAM_START_Z = 8;
// The dolly ends PAST the wall, so by the act boundary the storefront is
// behind the camera. Act 2 can then swap it for the gradient field without
// anything visibly disappearing from frame.
const CAM_END_Z = 0.55;
const WALL_Z = 1.2;
const DOOR_Z = 1.0;

// The aperture sits well right of centre, clear of the headline entirely.
// While it overlapped the copy, the doorway had to stay dim to protect
// contrast, which made it read as a grey slab rather than a lit opening.
// Off the copy it can be as bright as the shot actually wants.
const APERTURE_X = 2.9;
const APERTURE_W = 3.5;
const APERTURE_H = 5.4;

const lerp = (a, b, t) => a + (b - a) * t;

// Where this act leaves everything at t = 1. Act 2 starts from these exact
// values rather than its own guesses — act-boundary continuity is the thing
// most likely to break the scroll, and neither act can see the other.
export const END = {
  cam: [APERTURE_X * 0.72, 0.16, CAM_END_Z],
  look: [APERTURE_X * 0.9, 0, -2],
  mark: [APERTURE_X * 0.62, 0.05, -2.6],
  markRotY: 0.08,
  markScale: 1.0,
};

let doorL, doorR, wall = [], aisleGlow, spill, wallMat, doorMat;
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

    // The storefront wall: four slabs leaving a rectangular aperture. Built
    // oversized so it still covers the frame as the dolly closes on it.
    const { w: frameW, h: frameH } = frustumAt(stage.camera, WALL_Z);
    wallMat = new THREE.MeshBasicMaterial({ color: 0x08070a }); // --chamber
    const OVER = 3.2; // reach past the frame edges by this much at the start
    const slab = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      m.position.set(x, y, WALL_Z);
      stage.scene.add(m);
      return m;
    };
    const outerW = frameW + OVER * 2;
    const outerH = frameH + OVER * 2;
    const sideW = (outerW - APERTURE_W) / 2;
    const bandH = (outerH - APERTURE_H) / 2;
    wall = [
      slab(sideW, outerH, APERTURE_X - APERTURE_W / 2 - sideW / 2, 0),           // left return
      slab(sideW, outerH, APERTURE_X + APERTURE_W / 2 + sideW / 2, 0),           // right return
      slab(APERTURE_W, bandH, APERTURE_X, APERTURE_H / 2 + bandH / 2),           // header
      slab(APERTURE_W, bandH, APERTURE_X, -APERTURE_H / 2 - bandH / 2),          // threshold
    ];

    // Doors: reflective envmap glass, NOT transmissive. Only the LensMark
    // runs a transmission pass — the single largest per-frame WebGL cost,
    // and the spec allows exactly one object to pay it.
    doorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e0d12, // --ink
      metalness: 0.0,
      roughness: 0.08,
      reflectivity: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });

    // A leaf of width W is shut when its centre sits at W/2, so its inner
    // edge lands on the aperture's centre line. Deriving it beats a constant
    // that silently becomes a gap the moment the aperture changes.
    const leafW = APERTURE_W / 2;
    doorShut = leafW / 2;
    doorOpen = APERTURE_W / 2 + leafW / 2 + 0.05; // fully clear of the opening

    const geo = new THREE.BoxGeometry(leafW, APERTURE_H, 0.05);
    doorL = new THREE.Mesh(geo, doorMat);
    doorR = new THREE.Mesh(geo, doorMat);
    doorL.position.set(APERTURE_X - doorShut, 0, DOOR_Z);
    doorR.position.set(APERTURE_X + doorShut, 0, DOOR_Z);
    stage.scene.add(doorL, doorR);

    // Spill from beyond the doorway, sitting between the gradient and the
    // mark so the glass has a near source to streak, plus a cool fill so
    // the shadow side never goes fully black.
    aisleGlow = new THREE.PointLight(0xd380eb, 30, 34); // --accent
    aisleGlow.position.set(APERTURE_X, 1.1, -3.0);
    spill = new THREE.AmbientLight(0xb1bdce, 0.35); // --support
    stage.scene.add(aisleGlow, spill);

    stage.addDisposer(() => {
      stage.scene.remove(aisleGlow, spill, doorL, doorR, ...wall);
      wallMat.dispose();
      for (const m of wall) m.geometry.dispose();
      geo.dispose();
      doorMat.dispose();
    });

    window.__tccAct1 = { doorL, doorR, wall };
  },

  // Every act declares the full backdrop state on enter, so the swap is
  // correct in either scroll direction without needing exit hooks.
  enter(ctx) {
    for (const o of [...wall, doorL, doorR]) o.visible = true;
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

    // Hold shut, then part decisively across the middle of the act.
    const slide = THREE.MathUtils.smoothstep(t, 0.10, 0.78);
    doorL.position.x = APERTURE_X - lerp(doorShut, doorOpen, slide);
    doorR.position.x = APERTURE_X + lerp(doorShut, doorOpen, slide);

    // The dolly through the threshold, aimed at the aperture rather than
    // dead ahead so the doorway stays the subject as we close on it.
    const push = THREE.MathUtils.smoothstep(t, 0, 1);
    stage.camera.position.set(
      lerp(0, APERTURE_X * 0.72, push),
      lerp(0, 0.16, push),
      lerp(CAM_START_Z, CAM_END_Z, push)
    );
    stage.camera.lookAt(APERTURE_X * 0.9, 0, -2);

    // The core gradient brightens as the doors part — the reveal is now the
    // brand light coming up, not a photograph appearing. Held deliberately
    // dark while the hero is on screen: it is .theme-dark with white copy
    // sitting on this, so a pale backdrop would break the headline outright.
    //
    // It stays dark for the whole act. An earlier version ramped the backdrop
    // to the light body tint as the hero scrolled away, because the light
    // section below shares the viewport with the dark hero for a full
    // screen-height. That is now solved in CSS — light sections veil the
    // canvas — so this act no longer has to compromise between two sections
    // that want opposite things.
    ctx.field?.setGradient('core', lerp(FIELD_SHUT, FIELD_OPEN, slide));

    // The mark waits beyond the doorway and drifts forward as they clear.
    lens.group.position.set(
      APERTURE_X * lerp(1, 0.62, push),
      lerp(-0.15, END.mark[1], slide),
      lerp(-4.2, END.mark[2], slide)
    );
    lens.group.rotation.y = lerp(-0.6, END.markRotY, slide);
    lens.group.scale.setScalar(lerp(0.9, END.markScale, slide));
    aisleGlow.intensity = lerp(30, 46, slide);
  },
};
