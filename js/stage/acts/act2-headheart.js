import * as THREE from '../../vendor/three.module.js';
import { END as ACT1_END } from './act1-threshold.js';

/**
 * Act 2 — Head & Heart (progress 0.22 → 0.55).
 *
 * The mark stays whole. "Loyalty lives in the head and the heart" is a claim
 * that the two work TOGETHER, and pulling the halves 1.55 units apart said
 * the opposite (user, 2026-09-27: "instead of head and heart symbol
 * separating from each other we need a more subtle way to animate it").
 *
 * So the two halves are told apart by light, not distance:
 *
 *   1. Depth breath — the halves ease a hair apart along Z only. Seen through
 *      the glass that reads as two layers of one object, never as two objects.
 *   2. A slow sway turns the mark toward the cool Space Grey light on the
 *      head, then across to the TCC Purple light on the heart.
 *   3. As the emphasis crosses to the heart, it beats once — lub-dub — a
 *      scale swell of a few percent.
 *
 * Every offset rises and falls back to exactly zero by t = 1, so Act 3 takes
 * over an assembled, front-facing mark with nothing to unwind.
 *
 * All motion is a pure function of t — no per-frame accumulation (§2.4 of
 * SESSION.md) — so every value below is bounded by construction.
 */

const lerp = (a, b, t) => a + (b - a) * t;
const ss = THREE.MathUtils.smoothstep;

// How far each half drifts along Z at the peak of the breath. Front-on this
// is invisible as position; it shows as the two layers refracting each
// other differently while the mark turns.
const DEPTH = 0.16;
// Peak yaw of the sway, radians. Enough to show the bevel catch the light,
// small enough that the silhouette never reads as a different shape.
const SWAY = 0.3;
// Peak swell of the heartbeat.
const BEAT = 0.045;

// 0 → 1 → 0 across the act: a hump that is exactly zero at both ends.
const hump = (t, a, b) => ss(t, a, (a + b) / 2) * (1 - ss(t, (a + b) / 2, b));

// Lub-dub: two gaussian pulses, the second softer, centred on the moment the
// light hands over from head to heart.
const pulse = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
const beatAt = (t) => BEAT * (pulse(t, 0.6, 0.028) + 0.6 * pulse(t, 0.67, 0.028));

// Where this act settles the camera and the mark once it has taken over.
const CAM_SETTLED = [0, 0.12, 5.4];
const LOOK_SETTLED = [0, 0, 0];

// Handed to Act 3. The mark leaves this act assembled and front-facing, so
// Act 3 has no split or spin to unwind.
export const END = {
  cam: CAM_SETTLED,
  look: LOOK_SETTLED,
  mark: [0, 0, 0],
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
    // Close to the half each one belongs to — the head sits upper-left in
    // the mark, the heart lower-right — so each light mostly lands on its own.
    headLight.position.set(-2.2, 1.4, 2.2);
    heartLight.position.set(2.2, -1.0, 2.2);
    ctx.stage.scene.add(headLight, heartLight);
    ctx.stage.addDisposer(() => ctx.stage.scene.remove(headLight, heartLight));
    window.__tccAct2 = { headLight, heartLight, beatAt, BEAT, SWAY, DEPTH };
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
    const settle = ss(t, 0, 0.42);
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
    lens.group.scale.setScalar(lerp(ACT1_END.markScale, 1, settle));

    // The sway: toward the head (negative yaw shows the left side to the
    // camera) through the first half, across to the heart through the
    // second, back to front-on at the hand-over. Enveloped so it starts
    // only once the settle is under way.
    const sway = -SWAY * Math.sin(Math.PI * 2 * ss(t, 0.18, 0.96)) * ss(t, 0.1, 0.3);
    lens.group.rotation.y = lerp(ACT1_END.markRotY, 0, settle) + sway;

    // The brand gradient comes up from --chamber as Act 1's aisle fades out
    // into it, so the two backdrops cross-fade rather than cut.
    field?.setGradient('core', ss(t, 0, 0.24));

    // Depth breath, on the PIVOTS — never on head/heart directly: the meshes
    // carry the recentring offset in their own position.
    const breath = hump(t, 0.2, 0.95);
    lens.headPivot.position.set(0, 0, -DEPTH * breath);
    lens.heartPivot.position.set(0, 0, DEPTH * breath);
    // A trace of counter-tilt so the two layers catch the light differently.
    lens.headPivot.rotation.set(0, -0.06 * breath, 0);
    lens.heartPivot.rotation.set(0, 0.06 * breath, 0);

    lens.headPivot.scale.setScalar(1);
    lens.heartPivot.scale.setScalar(1 + beatAt(t));

    // Emphasis hands over from head to heart around the beat. The lights
    // never both go dark: the one not in focus rests at a third.
    const on = hump(t, 0.12, 1.0);
    const toHeart = ss(t, 0.45, 0.65);
    headLight.intensity = on * 30 * lerp(1, 0.33, toHeart);
    heartLight.intensity = on * 30 * lerp(0.33, 1, toHeart) * (1 + 4 * beatAt(t));
  },

  exit(ctx) {
    headLight.intensity = 0;
    heartLight.intensity = 0;
    // Every pivot offset has already returned to zero by t = 1; restating it
    // here keeps a fast scroll that skips the last frames honest.
    for (const p of [ctx.lens.headPivot, ctx.lens.heartPivot]) {
      p.position.set(0, 0, 0);
      p.rotation.set(0, 0, 0);
      p.scale.setScalar(1);
    }
  },
};
