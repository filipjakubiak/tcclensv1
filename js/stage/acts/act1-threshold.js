import * as THREE from '../../vendor/three.module.js';

/**
 * Act 1 — Threshold.
 *
 * A full-bleed glass curtain covers the hero, and parts to left and right as
 * the reader starts scrolling, revealing the head-and-heart mark and the
 * morphing brand field behind it.
 *
 * Three earlier versions are worth knowing about, because each was wrong in a
 * way that is easy to repeat:
 *
 * 1. It opened on three store-aisle photographs receding on Z. Replaced with
 *    the gradient at the user's direction — and it is better optics anyway,
 *    since a smooth high-chroma field is what makes per-wavelength separation
 *    legible where a dim photograph mostly is not.
 *
 * 2. The gradient was then confined to an aperture in a --chamber storefront
 *    wall. That wall is gone: it left the page opening on a black screen,
 *    which is not what a brand gradient hero is.
 *
 * 3. The gate was a 3-unit pair standing 2.6 units RIGHT of centre. Two
 *    separate faults came out of that. It sat far off the view axis, so the
 *    perspective frustum saw it from the side and it read as slanted — fixed
 *    at the time by yawing the gate to face the camera. And with both leaves
 *    shut it covered the headline as one flat pale slab: it never read as a
 *    pair of doors at all, so the reveal it was built for never happened
 *    (user, 2026-08-16: "fix the doors so they are a reveal moment, they will
 *    be front facing and just appear and open to left and right when we start
 *    scrolling").
 *
 * The curtain is centred on the view axis, which is what makes it front-facing
 * — there is no angle to correct when the object is on the axis you are
 * looking down. The yaw-to-camera code is kept because it costs nothing at
 * zero and is what stops any future off-centre framing reading as slanted.
 */

const CAM_START_Z = 8;
// The camera no longer dollies THROUGH the gate. The reveal is the curtain
// parting, not the camera pushing past it, and stopping short of the gate
// plane keeps the leaves square to the lens for the whole act.
const CAM_END_Z = 6.1;
const GATE_Z = 2.4;

// Full-bleed: each leaf covers half the frame at the gate plane, with margin
// so no edge is ever visible while shut. Derived from the frustum at build
// time rather than guessed — a hardcoded width becomes a gap the moment the
// viewport changes.
const GATE_MARGIN = 1.25;

// The gate is centred, so its facing angle is zero and this clamp never
// engages. Kept as the guard it was written to be: if the gate is ever moved
// off the view axis again, this is what stops it whipping round.
const GATE_MAX_YAW = 0.46; // rad (~26deg)

const lerp = (a, b, t) => a + (b - a) * t;

// Where this act leaves everything at t = 1. Act 2 starts from these exact
// values rather than its own guesses — act-boundary continuity is the thing
// most likely to break the scroll, and neither act can see the other.
export const END = {
  cam: [0, 0.1, CAM_END_Z],
  look: [0, 0, 0],
  // Right of centre and above the copy, so the revealed mark is clear of the
  // headline in the bottom-left. Act 2 walks it in to the origin from here.
  mark: [1.5, 0.34, -2.2],
  markRotY: 0.08,
  markScale: 1.0,
};

let gate, doorL, doorR, aisleGlow, spill, doorMat, edgeMat;
let doorShut = 0, doorOpen = 0;

/** World size of the camera frustum at a world Z, seen from the dolly start. */
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
    // Wide enough that a leaf still covers its half on an ultra-wide viewport,
    // tall enough that neither top nor bottom edge enters frame.
    const leafW = (frameW / 2) * GATE_MARGIN;
    const leafH = frameH * GATE_MARGIN;

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
      // Heavier than the 0.22 it carried as a small side object. A curtain
      // covering the whole frame has to read as a surface you are looking
      // THROUGH, not as a haze — but the hero's white copy sits over this, so
      // it is deliberately short of frosted. Checked by the composited
      // contrast guard, which screenshots the real page.
      opacity: 0.3,
      depthWrite: false,
    });

    // A leaf of width W is shut when its centre sits at W/2, so its inner
    // edge lands on the centre line. Deriving it beats a constant that
    // silently becomes a gap the moment the frame changes.
    doorShut = leafW / 2;
    doorOpen = leafW * 1.5 + 0.1; // fully clear of frame

    // The leaves live in the gate's LOCAL space, so their x is an offset from
    // the gate centre rather than a world position. Sliding them in local x
    // means they always part along the gate's own plane.
    const geo = new THREE.BoxGeometry(leafW, leafH, 0.05);
    doorL = new THREE.Mesh(geo, doorMat);
    doorR = new THREE.Mesh(geo, doorMat);
    doorL.position.set(-doorShut, 0, 0);
    doorR.position.set(doorShut, 0, 0);

    // A lit edge down each leaf's INNER side.
    //
    // Without it the shut curtain is a single even sheet of glass across the
    // frame — it reads as a haze over the hero, not as two doors about to
    // part, which is exactly how the previous gate failed. The seam is the
    // only thing that says "this opens". Once the leaves move, these are the
    // two bright lines travelling apart, and they are what the eye follows.
    //
    // Parented to the leaves, so they carry the seam with them rather than
    // needing their own animation to stay put.
    const edgeGeo = new THREE.BoxGeometry(0.045, leafH, 0.06);
    edgeMat = new THREE.MeshBasicMaterial({
      color: 0xd380eb, // --accent
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const edgeL = new THREE.Mesh(edgeGeo, edgeMat);
    const edgeR = new THREE.Mesh(edgeGeo, edgeMat);
    edgeL.position.set(leafW / 2, 0, 0.04);   // inner (right) side of the left leaf
    edgeR.position.set(-leafW / 2, 0, 0.04);  // inner (left) side of the right leaf
    doorL.add(edgeL);
    doorR.add(edgeR);

    gate = new THREE.Group();
    gate.position.set(0, 0, GATE_Z);
    gate.add(doorL, doorR);
    stage.scene.add(gate);

    // Spill from beyond the curtain, sitting between the field and the mark
    // so the glass has a near source to streak, plus a cool fill so the
    // shadow side never goes fully black.
    aisleGlow = new THREE.PointLight(0xd380eb, 30, 34); // --accent
    aisleGlow.position.set(0.6, 1.1, -3.0);
    spill = new THREE.AmbientLight(0xb1bdce, 0.35); // --support
    stage.scene.add(aisleGlow, spill);

    stage.addDisposer(() => {
      stage.scene.remove(aisleGlow, spill, gate);
      geo.dispose();
      edgeGeo.dispose();
      doorMat.dispose();
      edgeMat.dispose();
    });

    // REMOVED: an idle spin that ran before the first scroll.
    //
    // It was written as `rotation.y += sin(elapsed)` inside a per-frame
    // updater, which does not oscillate — it ACCUMULATES. Every frame added
    // another increment on top of the last, so the mark span up continuously
    // instead of drifting: measured 2.2 radians in 1.5 seconds, and slowing
    // the frequency only changed how fast it ran away.
    //
    // A correct version would assign an offset from a stored base rotation
    // rather than adding to the live value.

    window.__tccAct1 = { gate, doorL, doorR, leafW, leafH };
  },

  // Every act declares the full backdrop state on enter, so the swap is
  // correct in either scroll direction without needing exit hooks.
  enter(ctx) {
    gate.visible = true;
    // Acts 2-4 hide the leaves individually, so re-showing the group is not
    // enough on the way back up.
    for (const o of [doorL, doorR]) o.visible = true;
    // The hero runs the morphing shader field; the painted canvas field owns
    // Acts 2-4, where its measured tint ceilings apply.
    ctx.fluid?.show();
    ctx.field?.hide();
    // Act 1 is the only act where the mark is a single assembled object, so
    // it owns putting the halves back together for anyone scrolling up.
    for (const p of [ctx.lens.headPivot, ctx.lens.heartPivot]) {
      p.position.set(0, 0, 0);
      p.rotation.set(0, 0, 0);
    }
  },

  exit(ctx) {
    // Hand the backdrop back before Act 2 blends its own colours in.
    ctx.fluid?.hide();
    ctx.field?.show();
  },

  update(t, ctx) {
    const { stage, lens } = ctx;

    // Shut and still at the top of the page, then parting decisively as soon
    // as the reader starts moving. The hold is short on purpose: the curtain
    // is the first thing on the page and waiting on it is not a reveal.
    const slide = THREE.MathUtils.smoothstep(t, 0.04, 0.72);
    doorL.position.x = -lerp(doorShut, doorOpen, slide);
    doorR.position.x = lerp(doorShut, doorOpen, slide);

    // The leaves fade back as they clear, so the last of the glass does not
    // sit as a hard edge at the frame margin.
    const clearing = THREE.MathUtils.smoothstep(t, 0.45, 0.95);
    doorMat.opacity = lerp(0.3, 0.06, clearing);
    // The seam fades with them. It is the brightest thing on screen while the
    // curtain is shut, and it has no business still glowing at the frame
    // edges once the reveal is over.
    edgeMat.opacity = lerp(0.85, 0, clearing);

    // A short push, not a dolly through the threshold. The curtain parting is
    // the move; the camera only leans in behind it.
    const push = THREE.MathUtils.smoothstep(t, 0, 1);
    stage.camera.position.set(
      lerp(0, END.cam[0], push),
      lerp(0, END.cam[1], push),
      lerp(CAM_START_Z, CAM_END_Z, push)
    );
    stage.camera.lookAt(END.look[0], END.look[1], END.look[2]);

    // Square the gate to the lens. Must run AFTER the camera is placed for
    // this frame, or it faces where the camera was last frame.
    //
    // A Y-rotation of θ maps the leaves' +Z face onto (sin θ, cos θ), so the
    // angle that points that face at the camera is atan2 of the horizontal
    // offset over the depth offset. Assigned outright from the camera's
    // position — never accumulated onto the live rotation, which is how the
    // idle spin ran away (see the removal note in build()).
    //
    // With the gate centred this resolves to 0 every frame. It is kept as the
    // guard described at the top of the file, not as an active transform.
    const facing = Math.atan2(
      stage.camera.position.x - gate.position.x,
      stage.camera.position.z - GATE_Z
    );
    gate.rotation.y = THREE.MathUtils.clamp(facing, -GATE_MAX_YAW, GATE_MAX_YAW);

    // The mark waits beyond the curtain and comes forward as it clears.
    lens.group.position.set(
      lerp(0.4, END.mark[0], slide),
      lerp(-0.1, END.mark[1], slide),
      lerp(-5.0, END.mark[2], slide)
    );
    lens.group.rotation.y = lerp(-0.6, END.markRotY, slide);
    lens.group.scale.setScalar(lerp(0.86, END.markScale, slide));
    aisleGlow.intensity = lerp(30, 46, slide);
  },
};
