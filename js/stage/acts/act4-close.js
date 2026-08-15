import * as THREE from '../../vendor/three.module.js';
import { END as ACT3_END } from './act3-prism.js';
import { motionEnabled } from '../../motion/reveal.js';

/**
 * Act 4 — Close.
 *
 * The prism unwinds, the mark recedes, and glass becomes the actual logo:
 * transmission animates to zero and the material resolves to a flat brand
 * mark resting above the footer. The optical event that opened the page
 * closes by turning into the thing it was always a picture of.
 *
 * This act was a bare placeholder until now, which is why the mark visibly
 * froze on scrolling into #clients — the director handed control to an act
 * with no update(), so nothing touched the transform again for the last
 * quarter of the page.
 */

const lerp = (a, b, t) => a + (b - a) * t;

// Where the mark comes to rest: small, high, right of the copy.
const REST = [1.55, 0.55, -1.2];
const CAM_REST = [0, 0, 6.4];

let localT = 1;

export default {
  id: 'close',
  anchor: '#clients', // spec: Act 4 covers Clients → Contact
  range: [0.82, 1.0],

  build(ctx) {
    // Even at rest the mark keeps breathing. The complaint that started this
    // act was that it "stops animating" — landing it on an exact pose and
    // holding there forever is the same failure with extra steps.
    ctx.stage.addUpdater((elapsed) => {
      if (!motionEnabled()) return;
      const settled = THREE.MathUtils.smoothstep(localT, 0.55, 1);
      if (settled <= 0) return;
      ctx.lens.group.rotation.y += Math.sin(elapsed * 0.11) * 0.16 * settled;
      ctx.lens.group.position.y += Math.sin(elapsed * 0.19) * 0.05 * settled;
    });

    window.__tccAct4 = { REST };
  },

  enter(ctx) {
    const a1 = window.__tccAct1;
    if (a1) for (const o of [a1.doorL, a1.doorR]) o.visible = false;
    ctx.field?.show();
  },

  update(t, ctx) {
    const { stage, lens } = ctx;
    localT = t;

    // Unwind the prism back to face-on, picked up from exactly where Act 3
    // left it rather than from zero.
    const unwind = THREE.MathUtils.smoothstep(t, 0, 0.42);
    lens.group.rotation.y = lerp(ACT3_END.rotY, 0, unwind);
    lens.group.rotation.z = lerp(ACT3_END.rotZ, 0, unwind);

    // Recede: smaller, further, and up out of the reading column.
    const settle = THREE.MathUtils.smoothstep(t, 0.15, 0.85);
    lens.group.position.set(
      lerp(ACT3_END.mark[0], REST[0], settle),
      lerp(ACT3_END.mark[1], REST[1], settle),
      lerp(ACT3_END.mark[2], REST[2], settle)
    );
    lens.group.scale.setScalar(lerp(1, 0.62, settle));

    stage.camera.position.set(
      lerp(ACT3_END.cam[0], CAM_REST[0], unwind),
      lerp(ACT3_END.cam[1], CAM_REST[1], unwind),
      lerp(ACT3_END.cam[2], CAM_REST[2], settle)
    );
    stage.camera.lookAt(0, 0, 0);

    // Glass becomes the logo. Transmission falls away and the material
    // resolves to a flat brand mark — the spec's closing image.
    const solid = THREE.MathUtils.smoothstep(t, 0.45, 0.95);
    lens.material.transmission = 1 - solid;
    lens.material.thickness = lerp(ACT3_END.thickness, 0.4, solid);
    lens.material.dispersion = lerp(ACT3_END.dispersion, 0, solid);
    lens.material.metalness = solid * 0.15;
    lens.material.roughness = lerp(0.04, 0.28, solid);
    lens.material.color.setHex(0xffffff).lerp(new THREE.Color(0xd380eb), solid); // --accent
  },

  exit(ctx) {
    // Hand the glass back intact for anyone scrolling up into Act 3.
    const m = ctx.lens.material;
    m.transmission = 1;
    m.thickness = 2.4;
    m.dispersion = 4.0;
    m.metalness = 0;
    m.roughness = 0.04;
    m.color.setHex(0xffffff);
    ctx.lens.group.scale.setScalar(1);
  },
};
