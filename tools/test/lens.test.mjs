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

test('the mark is centred on the origin', async () => {
  const c = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccLens, null, { timeout: 10000 });
    return page.evaluate(() => {
      const THREE = window.__tccStage.THREE;
      const b = new THREE.Box3().setFromObject(window.__tccLens.group);
      const c = b.getCenter(new THREE.Vector3());
      return { x: c.x, y: c.y, height: b.max.y - b.min.y };
    });
  });
  assert.ok(Math.abs(c.x) < 0.05, `x off-centre: ${c.x}`);
  assert.ok(Math.abs(c.y) < 0.05, `y off-centre: ${c.y}`);
  assert.ok(c.height > 1.5 && c.height < 2.5, `height ${c.height} outside the ~2-unit target`);
});
