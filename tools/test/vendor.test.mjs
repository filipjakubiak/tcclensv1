import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

test('vendored three exposes MeshPhysicalMaterial.dispersion', async () => {
  const result = await withPage((page) =>
    page.evaluate(async () => {
      const THREE = await import('/js/vendor/three.module.js');
      const m = new THREE.MeshPhysicalMaterial({ transmission: 1 });
      return { hasDispersion: 'dispersion' in m, revision: THREE.REVISION };
    })
  );
  assert.equal(result.hasDispersion, true,
    `three r${result.revision} has no dispersion — vendor a newer release`);
});

test('gsap, ScrollTrigger and Lenis are vendored locally', async () => {
  const ok = await withPage((page) =>
    page.evaluate(() =>
      Promise.all(
        ['/js/vendor/gsap.min.js', '/js/vendor/ScrollTrigger.min.js', '/js/vendor/lenis.min.js']
          .map((u) => fetch(u).then((r) => r.ok))
      ).then((rs) => rs.every(Boolean))
    )
  );
  assert.equal(ok, true);
});
