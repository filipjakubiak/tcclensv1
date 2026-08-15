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
    iridescence: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    color: 0xffffff,
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

  const group = new T.Group();
  group.add(head, heart);
  group.scale.y *= -1; // SVG Y-down → Three Y-up

  // Centre the combined head+heart bounding box on the origin. group's
  // scale is a diagonal ±1 matrix (self-inverse), so multiplying the
  // world-space centre by (1,-1,1) converts it back to a local-space
  // offset; subtracting that same offset from every child is a rigid
  // shift that leaves head/heart position relative to each other intact.
  const box = new T.Box3().setFromObject(group);
  const size = box.getSize(new T.Vector3());
  const centre = box.getCenter(new T.Vector3());
  const localOffset = centre.clone().multiply(new T.Vector3(1, -1, 1));
  for (const m of group.children) m.position.sub(localOffset);

  // Three nested groups, each owning exactly one job:
  //   group  — the -1 Y flip (SVG Y-down -> Three Y-up)
  //   fitted — normalise to ~2 world units tall
  //   outer  — free for acts to position, rotate and scale
  //
  // The nesting is what makes the 2-unit invariant safe. When acts drove
  // `outer.scale` directly against a single group that also carried the
  // normalisation, `scale.setScalar(0.86)` REPLACED the fit factor instead
  // of multiplying it and the mark snapped back to its raw extrusion size —
  // 22 units tall, three times the height of the frame. Splitting the two
  // scales apart makes that mistake unrepresentable rather than merely
  // documented.
  const fitted = new T.Group();
  fitted.add(group);
  fitted.scale.setScalar(2 / size.y);

  const outer = new T.Group();
  outer.add(fitted);

  const lens = {
    group: outer,
    fitted,
    head,
    heart,
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
