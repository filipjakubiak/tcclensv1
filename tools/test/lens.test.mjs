import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

test('the lens mark builds head and heart as separate meshes', async () => {
  const info = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccLens, null, { timeout: 10000 });
    return page.evaluate(() => {
      const l = window.__tccLens;
      return {
        hasHead: !!l.head, hasHeart: !!l.heart,
        headVerts: l.head.geometry.attributes.position.count,
        heartVerts: l.heart.geometry.attributes.position.count,
        sameMaterial: l.head.material === l.heart.material,
      };
    });
  });
  assert.ok(info.hasHead && info.hasHeart);
  assert.ok(info.headVerts > 0 && info.heartVerts > 0, 'extrusion produced empty geometry');
  assert.equal(info.sameMaterial, true, 'head and heart must share one material');
});

test('the glass material carries the spec optical values', async () => {
  const m = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccLens, null, { timeout: 10000 });
    return page.evaluate(() => {
      const x = window.__tccLens.material;
      return { transmission: x.transmission, ior: x.ior, dispersion: x.dispersion,
               thickness: x.thickness, roughness: x.roughness };
    });
  });
  assert.equal(m.transmission, 1);
  assert.equal(m.ior, 1.52);
  assert.equal(m.dispersion, 4);
  assert.equal(m.thickness, 2.4);
  assert.ok(m.roughness <= 0.05);
});

test('the mark is centred inside its own group', async () => {
  // Measured in the group's LOCAL space, not world space. Acts own where the
  // mark sits in the scene — Act 1 parks it in the storefront aperture at
  // x≈1.85 — so a world-space assertion would just be re-asserting whichever
  // act happens to be active. What must hold for every act is that the mark
  // is centred on its OWN origin, because that is the pivot they rotate it
  // about, and that it stays ~2 units tall.
  const c = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });
    return page.evaluate(() => {
      const THREE = window.__tccStage.THREE;
      const g = window.__tccLens.group;
      const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g).applyMatrix4(inv);
      const c = b.getCenter(new THREE.Vector3());
      return { x: c.x, y: c.y, height: b.max.y - b.min.y };
    });
  });
  assert.ok(Math.abs(c.x) < 0.05, `x off-centre: ${c.x}`);
  assert.ok(Math.abs(c.y) < 0.05, `y off-centre: ${c.y}`);
  assert.ok(c.height > 1.5 && c.height < 2.5, `height ${c.height} outside the ~2-unit target`);
});

test('an act scaling lens.group cannot destroy the 2-unit normalisation', async () => {
  // Acts own lens.group's transform. The normalising scale lives on the
  // inner `fitted` group precisely so that setScalar() on the outer one
  // composes with it instead of replacing it. Driven directly here rather
  // than through an act, so it keeps holding for Tasks 14-16 too.
  const h = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });
    return page.evaluate(() => {
      const THREE = window.__tccStage.THREE;
      const g = window.__tccLens.group;
      const measure = () => {
        g.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(g);
        return b.max.y - b.min.y;
      };
      g.scale.setScalar(1);
      const unit = measure();
      g.scale.setScalar(0.5);
      const half = measure();
      return { unit, half };
    });
  });
  assert.ok(h.unit > 1.5 && h.unit < 2.5, `at scale 1 the mark is ${h.unit}, not ~2 units`);
  assert.ok(Math.abs(h.half - h.unit / 2) < 0.01, `scale 0.5 gave ${h.half}, expected ${h.unit / 2}`);
});
