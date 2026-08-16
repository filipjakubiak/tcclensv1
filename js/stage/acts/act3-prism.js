import * as THREE from '../../vendor/three.module.js';
import { END as ACT2_END } from './act2-headheart.js';
import { GRADIENTS } from '../GradientField.js';

/**
 * Act 3 — Prism (progress: #what-we-do → #clients).
 *
 * The load-bearing idea of the whole page. The brand book names five
 * secondary gradients — Performance, Insight, Creativity, Operational
 * excellence, Sustainability. That is literally a spectrum of five. A prism
 * splits light into a spectrum. So the halves recombine, the mark turns
 * edge-on into a slab, and the capabilities section below it IS the spectrum
 * that slab throws. The mapping already existed inside the brand system;
 * this is the first artefact to draw it.
 *
 * Edge-on is also where the optics earn their keep: it is the longest light
 * path through the glass, so it is where per-wavelength separation has the
 * best chance of reading.
 */

const lerp = (a, b, t) => a + (b - a) * t;

// Handed to Act 4, which opens by unwinding the prism. Same contract as the
// two boundaries before it.
export const END = {
  cam: [-0.8, 0, 4.4],
  mark: [0.9, 0, 0],
  rotY: (Math.PI / 2) * 1.18,
  rotZ: 0.14,
  thickness: 5.2,
  dispersion: 7.5,
};

// Which capability the environment and backdrop are currently tuned to.
let observer = null;
let current = null;
let ctxRef = null;

function tintFor(name) {
  if (!GRADIENTS[name] || name === current || !ctxRef) return;
  current = name;
  const [from, to] = GRADIENTS[name];
  // Both surfaces move together: the environment map drives what the glass
  // REFLECTS, the gradient field drives what it REFRACTS. Tinting only one
  // leaves the mark visibly disagreeing with the section behind it.
  ctxRef.env?.setTint(from, to);
  ctxRef.field?.setGradient(name, 1);
}

export default {
  id: 'prism',
  anchor: '#what-we-do', // spec: Act 3 covers Fork, How it works, Capabilities, Monitor
  range: [0.55, 0.82],

  build(ctx) {
    ctxRef = ctx;
    const cards = document.querySelectorAll('#capabilities .capability');
    // The tint follows whichever capability is actually on screen, so the
    // glass and the section agree without hand-tuning scroll offsets.
    observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) tintFor(hit.target.dataset.gradient);
      },
      { threshold: [0.3, 0.6, 0.9] }
    );
    cards.forEach((c) => observer.observe(c));
    ctx.stage.addDisposer(() => observer?.disconnect());

    window.__tccAct3 = { tintFor, GRADIENTS };
  },

  enter(ctx) {
    // Same full-state declaration as Act 2, so entering from either side
    // lands identically.
    const a1 = window.__tccAct1;
    if (a1) for (const o of [a1.doorL, a1.doorR]) o.visible = false;
    ctx.field?.show();
  },

  update(t, ctx) {
    const { stage, lens } = ctx;

    // The halves recombine — picked up from exactly where Act 2 left them
    // rather than from zero. Act 2 deliberately does NOT reset its split on
    // exit, because that reset would consume this move before it starts.
    const join = 1 - THREE.MathUtils.smoothstep(t, 0, 0.32);
    lens.headPivot.position.set(-ACT2_END.split * join, ACT2_END.splitY * join, 0);
    lens.heartPivot.position.set(ACT2_END.split * join, -ACT2_END.splitY * join, 0);
    // Unwind the counter-rotation Act 2 leaves behind, on the same curve as
    // the recombination. Assigning 0 here instead — which is what this did —
    // snapped both halves through 1.5 rad on the first frame of the act, and
    // the boundary lands at the top of #what-we-do, so that snap was the
    // "sequence breaking" the user reported. The positions were already
    // blended from ACT2_END; only the rotation was not.
    lens.headPivot.rotation.y = ACT2_END.spin * join;
    lens.heartPivot.rotation.y = -ACT2_END.spin * join;

    // Then the whole mark rotates edge-on and becomes a prism slab.
    const edge = THREE.MathUtils.smoothstep(t, 0.28, 0.72);
    lens.group.rotation.y = edge * (Math.PI / 2) * 1.18;
    lens.group.rotation.z = edge * 0.14;
    lens.group.position.set(
      lerp(ACT2_END.mark[0], 0.9, edge),
      ACT2_END.mark[1],
      ACT2_END.mark[2]
    );
    lens.group.scale.setScalar(1);

    // Thicker glass at the edge-on angle lengthens the light path, which is
    // what exaggerates the split into visible colour separation.
    lens.material.thickness = lerp(2.4, 5.2, edge);
    lens.material.dispersion = lerp(4.0, 7.5, edge);

    stage.camera.position.set(
      lerp(ACT2_END.cam[0], -0.8, edge),
      ACT2_END.cam[1],
      lerp(ACT2_END.cam[2], 4.4, t)
    );
    stage.camera.lookAt(0, 0, 0);
  },

  exit(ctx) {
    // Material only. The ROTATION is deliberately left where it is: Act 4
    // opens by unwinding the prism, so zeroing it here would snap the mark
    // flat at the boundary and steal that move — the same mistake Act 2 made
    // with the head/heart split. Act 2's update rewrites rotation every frame,
    // so scrolling back up self-corrects.
    ctx.lens.material.thickness = 2.4;
    ctx.lens.material.dispersion = 4.0;
    ctx.env?.setTint(...GRADIENTS.core);
    ctx.field?.setGradient('core', 1);
    current = null;
  },
};
