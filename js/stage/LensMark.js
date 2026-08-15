import * as THREE from '../vendor/three.module.js';
import { SVGLoader } from '../vendor/SVGLoader.js';

// depth ~0.62 with a generous bevel — the bevel is what makes it read as
// glass; a flat extrusion reads as plastic. bevelSize sits below the
// brief's suggested 0.07: at 0.07 the heart's lower cusp self-intersected
// (the two converging curves collide before the bevel profile clears the
// point), producing visible pinching/flicker at the tip. 0.045 clears it.
const EXTRUDE = {
  depth: 0.62,
  bevelEnabled: true,
  bevelThickness: 0.09,
  bevelSize: 0.045,
  bevelSegments: 6,
  curveSegments: 48,
};

export async function createLensMark(stage) {
  const { THREE: T } = stage;
  const svg = await new SVGLoader().loadAsync('assets/img/logo-icon.svg');

  const material = new T.MeshPhysicalMaterial({
    transmission: 1.0,
    thickness: 2.4,
    ior: 1.52,
    dispersion: 4.0,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    color: 0xffffff,

    // Everything below exists because perfectly clear glass in front of a
    // smooth gradient is INVISIBLE. Measured: the mark's silhouette scored
    // 0.035 luminance contrast against the field immediately around it —
    // refraction returned the backdrop's own colour, so there was nothing to
    // see. The optics were correct and the object was not there.
    //
    // Attenuation: light is absorbed as it travels through the glass, so
    // thick parts tint and thin edges stay clear — a gradient across the body
    // that comes from the geometry rather than from a painted-on tint.
    //
    // --support, NOT --accent. Attenuating toward the accent tinted the glass
    // the same purple as the field behind it, so it cancelled out and the
    // mark stayed invisible. The cool token reads as denser, cooler glass
    // against a warm purple backdrop.
    attenuationColor: new T.Color(0xb1bdce), // --support
    attenuationDistance: 0.55,

    // Stronger thin-film and a hotter environment give the bevel a crisp
    // specular to catch, which is the other half of reading as glass.
    iridescence: 0.5,
    iridescenceIOR: 1.35,
    envMapIntensity: 2.1,
  });

  const meshFor = (path) => {
    const geo = new T.ExtrudeGeometry(SVGLoader.createShapes(path), EXTRUDE);
    geo.computeVertexNormals();
    return new T.Mesh(geo, material);
  };

  // logo-icon.svg contains exactly two <path> elements: paths[0] is the
  // head circle, paths[1] is the heart — that separation is what makes
  // Act 2's split possible.
  const head = meshFor(svg.paths[0]);
  const heart = meshFor(svg.paths[1]);

  // Centre the combined head+heart bounding box on the origin. Measured
  // through a temporary Y-flipped group: its scale is a diagonal ±1 matrix
  // (self-inverse), so multiplying the world-space centre by (1,-1,1)
  // converts it back to a local-space offset; subtracting that same offset
  // from both meshes is a rigid shift that leaves head and heart in the
  // same position relative to each other.
  const measure = new T.Group();
  measure.add(head, heart);
  measure.scale.y *= -1; // SVG Y-down → Three Y-up
  const box = new T.Box3().setFromObject(measure);
  const size = box.getSize(new T.Vector3());
  const centre = box.getCenter(new T.Vector3());
  const localOffset = centre.clone().multiply(new T.Vector3(1, -1, 1));
  for (const m of measure.children) m.position.sub(localOffset);

  // Every transform gets its own group, and no group does two jobs:
  //
  //   outer      — whole-mark placement; acts own this
  //   fitted     — normalise to ~2 world units tall; NOTHING else touches it
  //   headPivot  \ per-half placement; acts own these (Act 2 splits them)
  //   heartPivot /
  //   *Flip      — the -1 Y flip, SVG Y-down -> Three Y-up
  //   head/heart — carry the recentring offset baked into position
  //
  // The separation is the whole point. Twice now a state carried on a
  // shared group has been destroyed by an act assigning to it rather than
  // composing with it: `outer.scale.setScalar()` wiped the 2-unit
  // normalisation (the mark rendered 22 units tall, 305% of frame), and
  // `head.position.x = …` would equally wipe the recentring offset below.
  // Splitting them makes both mistakes unrepresentable instead of merely
  // documented. The flip sits under each pivot rather than above both, so
  // acts work in ordinary Y-up space and +y means up.
  //
  // The fit sits BELOW each pivot, not above both. Above, a pivot's
  // translation would be expressed in raw SVG units and then shrunk by the
  // fit factor — a 1.55-unit split became 0.14 world units and the halves
  // visibly never parted, while a test reading pivot.position.x passed.
  // Below the pivot, an act's numbers are world units and mean what they say.
  const FIT = 2 / size.y;
  const withPivot = (mesh) => {
    const flip = new T.Group();
    flip.scale.y = -1;
    flip.add(mesh);
    const fit = new T.Group();
    fit.scale.setScalar(FIT);
    fit.add(flip);
    const pivot = new T.Group();
    pivot.add(fit);
    return pivot;
  };
  const headPivot = withPivot(head);
  const heartPivot = withPivot(heart);

  const outer = new T.Group();
  outer.add(headPivot, heartPivot);

  const lens = {
    group: outer,
    fit: FIT,
    head,
    heart,
    headPivot,
    heartPivot,
    material,
    setTransmission(v) {
      material.transmission = v;
      material.needsUpdate = true;
    },
    dispose() {
      head.geometry.dispose();
      heart.geometry.dispose();
      material.dispose();
      outer.removeFromParent();
    },
  };

  stage.scene.add(outer);
  stage.addDisposer(lens.dispose);
  window.__tccLens = lens;
  return lens;
}
