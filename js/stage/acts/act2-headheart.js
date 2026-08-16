import * as THREE from '../../vendor/three.module.js';
import { END as ACT1_END } from './act1-threshold.js';

/**
 * Act 2 — Head & Heart (progress 0.22 → 0.55).
 *
 * Past the threshold, the mark separates. The circle drifts left under cool
 * Space Grey light, the heart drifts right under TCC Purple, flanking the
 * copy about the shopper's two simultaneous decisions. Both counter-rotate
 * slowly through the stat wall.
 *
 * The storefront is gone by now, so the backdrop becomes the brand book's
 * own core gradient — which is also the best refraction content the scene
 * can offer the glass.
 */

const lerp = (a, b, t) => a + (b - a) * t;
const SPLIT = 1.55;

// The counter-rotation the two halves carry, as a function of how far the
// split has gone and how far through the act we are. Defined once and used
// both by update() and by END below — writing the end value as a literal is
// how it silently stopped matching what the act actually leaves on screen.
const spinAt = (split, t) => split * 0.9 + t * 0.6;

// Where this act settles the camera and the mark once it has taken over.
const CAM_SETTLED = [0, 0.12, 5.4];
const LOOK_SETTLED = [0, 0, 0];

// Handed to Act 3 for the same reason Act 1 hands its end state here: an act
// cannot see its neighbours, and a snap at a boundary is the most visible
// way this scroll can fail.
export const END = {
  cam: CAM_SETTLED,
  look: LOOK_SETTLED,
  mark: [0, 0, 0],
  split: 1.55,
  splitY: 0.35,
  // The halves are still counter-rotating when this act hands over. Act 3
  // must unwind from this value; it used to assign 0 on its first frame,
  // which snapped both halves 1.5 rad at the top of #what-we-do — the exact
  // point the boundary lands (user, 2026-08-16: "the 3d suddenly breaks the
  // motion when scrolling so the sequence kind of breaks").
  spin: spinAt(1, 1),
};

let headLight, heartLight;
const look = new THREE.Vector3();

export default {
  id: 'headheart',
  anchor: '#thesis', // spec: Act 2 covers Thesis and Proof
  range: [0.22, 0.55],

  build(ctx) {
    headLight = new THREE.PointLight(0xb1bdce, 0, 18);  // --support, the rational half
    heartLight = new THREE.PointLight(0xd380eb, 0, 18); // --accent, the emotional half
    headLight.position.set(-3, 1.2, 2.4);
    heartLight.position.set(3, -0.6, 2.4);
    ctx.stage.scene.add(headLight, heartLight);
    ctx.stage.addDisposer(() => ctx.stage.scene.remove(headLight, heartLight));
    window.__tccAct2 = { headLight, heartLight };
  },

  enter(ctx) {
    // We are past the threshold: the storefront goes, the gradient arrives.
    // Stated in full here rather than as a diff, so entering from either
    // direction lands on the same state.
    const a1 = window.__tccAct1;
    if (a1) for (const o of [a1.doorL, a1.doorR]) o.visible = false;
    ctx.field?.show();
  },

  update(t, ctx) {
    const { stage, lens, field } = ctx;

    // Take over from Act 1's exact end state rather than snapping to this
    // act's own framing — a pop at the boundary is the most visible way
    // this whole scroll can fail.
    const settle = THREE.MathUtils.smoothstep(t, 0, 0.42);
    stage.camera.position.set(
      lerp(ACT1_END.cam[0], CAM_SETTLED[0], settle),
      lerp(ACT1_END.cam[1], CAM_SETTLED[1], settle),
      lerp(ACT1_END.cam[2], CAM_SETTLED[2], settle)
    );
    look.set(
      lerp(ACT1_END.look[0], LOOK_SETTLED[0], settle),
      lerp(ACT1_END.look[1], LOOK_SETTLED[1], settle),
      lerp(ACT1_END.look[2], LOOK_SETTLED[2], settle)
    );
    stage.camera.lookAt(look);

    lens.group.position.set(
      lerp(ACT1_END.mark[0], 0, settle),
      lerp(ACT1_END.mark[1], 0, settle),
      lerp(ACT1_END.mark[2], 0, settle)
    );
    lens.group.rotation.y = lerp(ACT1_END.markRotY, 0, settle);
    lens.group.scale.setScalar(lerp(ACT1_END.markScale, 1, settle));

    // The brand gradient comes up from --chamber as Act 1's aisle fades out
    // into it, so the two backdrops cross-fade rather than cut.
    field?.setGradient('core', THREE.MathUtils.smoothstep(t, 0, 0.24));

    // The separation itself, held back until the camera has settled so the
    // two moves read as consecutive rather than simultaneous.
    const split = THREE.MathUtils.smoothstep(t, 0.22, 0.78);

    // Driven on the PIVOTS, never on head/heart directly: the meshes carry
    // the recentring offset in their own position, and assigning to that
    // would discard it.
    lens.headPivot.position.set(lerp(0, -SPLIT, split), lerp(0, 0.35, split), 0);
    lens.heartPivot.position.set(lerp(0, SPLIT, split), lerp(0, -0.35, split), 0);

    // Counter-rotation through the stat wall.
    const spin = spinAt(split, t);
    lens.headPivot.rotation.y = spin;
    lens.heartPivot.rotation.y = -spin;

    headLight.intensity = split * 26;
    heartLight.intensity = split * 26;
  },

  exit(ctx) {
    headLight.intensity = 0;
    heartLight.intensity = 0;
    // The halves are deliberately LEFT split. Act 3 opens by recombining
    // them, so zeroing them here would snap them together at the boundary
    // and steal the move Act 3 exists to make. Act 1's enter() re-assembles
    // the mark for anyone scrolling back up.
  },
};
