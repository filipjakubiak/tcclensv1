import * as THREE from '../../vendor/three.module.js';

/**
 * Act 1 — Threshold (progress 0.00 → 0.22).
 *
 * You are outside, at night. A storefront wall fills the frame with one lit
 * aperture in it, right of the headline. Two glass doors part on X, the
 * camera dollies through the aperture, and the store opens out: three aisle
 * plates receding on Z with the glass mark hanging among them.
 *
 * Two things drive the construction:
 *
 * 1. **The wall is what makes it a threshold.** With the aisle plates
 *    full-bleed across the viewport there is no "outside" — the shot reads
 *    as a photograph behind text, not as a doorway. Confining the store to
 *    an aperture and painting the rest in --chamber is what turns it into a
 *    place you cross into, and it keeps the hero copy on flat dark ground.
 *
 * 2. **The plates are the transmission content.** Until this act the glass
 *    mark refracted a flat near-black background, so its dispersion was
 *    inert no matter how the material was tuned. The plates are the first
 *    thing in the scene with colour and contrast behind the mark.
 */

// Near → far, and a narrative in three frames: taking a basket at the
// entrance, walking in past the produce wall, the aisle receding to its
// vanishing point. All three are TCC's own brand-film footage.
//
// `bars` is the letterbox burned into the still — measured, not guessed:
// brand-film-2 and -3 are a 2.39:1 crop inside a 1600x900 frame, exactly
// 90px top and bottom, so 0.1 of the height at each end.
const AISLE_PLATES = [
  { src: 'assets/media/stills/home-banner-2.jpg', bars: 0,   z: -6.5,  dim: 0x2f3038 },
  { src: 'assets/media/stills/brand-film-3.jpg',  bars: 0.1, z: -12.0, dim: 0x3c3e4a },
  { src: 'assets/media/stills/brand-film-2.jpg',  bars: 0.1, z: -19.0, dim: 0x4a4c5c },
];

const CAM_START_Z = 8;
const CAM_END_Z = 1.55;      // just short of the wall — the dolly ends mid-threshold
const WALL_Z = 1.2;
const DOOR_Z = 1.0;

// The aperture sits right of centre so the headline lands on flat wall
// rather than fighting the store behind it.
const APERTURE_X = 1.85;
const APERTURE_W = 4.6;
const APERTURE_H = 4.9;

const lerp = (a, b, t) => a + (b - a) * t;

let doorL, doorR, planes = [], wall = [], aisleGlow, spill;
let doorShut = 0, doorOpen = 0;

/** World size of the camera frustum at a world Z, for the camera at its dolly start. */
function frustumAt(camera, z, fromZ = CAM_START_Z) {
  const h = 2 * (fromZ - z) * Math.tan((camera.fov * Math.PI) / 180 / 2);
  return { h, w: h * camera.aspect };
}

export default {
  id: 'threshold',
  range: [0.0, 0.22],

  build(ctx) {
    const { stage } = ctx;
    const loader = new THREE.TextureLoader();

    planes = AISLE_PLATES.map(({ src, bars, z, dim }) => {
      const tex = loader.load(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      // Sample only the live band, so no black bar is ever stretched.
      tex.offset.y = bars;
      tex.repeat.y = 1 - bars * 2;

      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        // These are bright white supermarket interiors under a dark hero
        // with white copy. `color` multiplies them down to a night-exterior
        // glow; update() lifts it as the doors part, so the store coming up
        // to brightness IS the reveal.
        color: new THREE.Color(dim),
        // MUST stay opaque. three.js renders ONLY opaque objects into the
        // transmission render target, so a `transparent: true` plate is
        // invisible to the glass mark's refraction — measured directly:
        // with transparent plates, the pixel at the mark's centre was
        // byte-identical whether the plates were dim, blazing magenta, or
        // deleted from the scene. That, not "nothing colourful behind it",
        // is why the dispersion read as inert. The plates are full opaque
        // rectangles and need no alpha, so this costs nothing.
        transparent: false,
      });

      // Sized to the aperture's cone rather than the whole frustum: the
      // store is seen THROUGH a doorway, so a plate only ever needs to fill
      // what the doorway exposes at its own depth.
      const spread = (CAM_START_Z - z) / (CAM_START_Z - WALL_Z);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(APERTURE_W * spread * 1.15, APERTURE_H * spread * 1.15),
        mat
      );
      mesh.position.set(APERTURE_X * spread, 0, z);
      stage.scene.add(mesh);
      return mesh;
    });

    // The storefront wall: four slabs leaving a rectangular aperture. Built
    // oversized so it still covers the frame as the dolly closes on it.
    const { w: frameW, h: frameH } = frustumAt(stage.camera, WALL_Z);
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x08070a }); // --chamber
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
    const doorMat = new THREE.MeshPhysicalMaterial({
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

    // Spill from inside the store, sitting between the plates and the mark
    // so the glass has a near source to streak, plus a cool fill so the
    // shadow side never goes fully black.
    aisleGlow = new THREE.PointLight(0xd380eb, 30, 34); // --accent
    aisleGlow.position.set(APERTURE_X, 1.1, -3.0);
    spill = new THREE.AmbientLight(0xb1bdce, 0.35); // --support
    stage.scene.add(aisleGlow, spill);

    stage.addDisposer(() => {
      stage.scene.remove(aisleGlow, spill, doorL, doorR, ...planes, ...wall);
      wallMat.dispose();
      for (const m of [...planes, ...wall]) m.geometry.dispose();
      geo.dispose();
      doorMat.dispose();
    });

    window.__tccAct1 = { doorL, doorR, planes, wall };
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

    planes.forEach((p, i) => {
      // Nearer plates travel further: that difference is the parallax.
      p.position.z = AISLE_PLATES[i].z + push * (3.4 - i * 0.9);
      // The store comes up to brightness as the doors clear — and this is
      // what finally puts colour into the transmission pass behind the glass.
      p.material.color.setHex(AISLE_PLATES[i].dim).multiplyScalar(lerp(1, 2.6 - i * 0.3, slide));
    });

    // The mark waits in the aisle and drifts forward as the doors clear.
    lens.group.position.set(APERTURE_X * lerp(1, 0.62, push), lerp(-0.15, 0.05, slide), lerp(-4.2, -1.4, slide));
    lens.group.rotation.y = lerp(-0.6, 0.08, slide);
    lens.group.scale.setScalar(lerp(0.9, 1.05, slide));
    aisleGlow.intensity = lerp(30, 46, slide);
  },
};
