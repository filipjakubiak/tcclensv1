import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });

test('doors slide apart on X as the act progresses', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, a = window.__tccAct1;
      const THREE = window.__tccStage.THREE;
      const halfWidth = new THREE.Box3().setFromObject(a.doorL).getSize(new THREE.Vector3()).x / 2;
      d.setProgress(0);
      const shut = { l: a.doorL.position.x, r: a.doorR.position.x };
      d.setProgress(0.20);
      const open = { l: a.doorL.position.x, r: a.doorR.position.x };
      // The leaves are shut when their inner EDGES meet on the centre line.
      // Comparing their centres instead only works for a door about 0.8
      // wide, which is not a door that covers the frame.
      return { shut, open, gap: (shut.r - halfWidth) - (shut.l + halfWidth) };
    });
  });
  assert.ok(Math.abs(r.gap) < 0.15, `doors did not start closed — ${r.gap.toFixed(2)} units of gap between the leaves`);
  assert.ok(r.open.l < r.shut.l, 'left door did not slide left');
  assert.ok(r.open.r > r.shut.r, 'right door did not slide right');
});

test('the camera dollies forward through the threshold', async () => {
  const z = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, cam = window.__tccStage.camera;
      d.setProgress(0);   const start = cam.position.z;
      d.setProgress(0.21); const end = cam.position.z;
      return { start, end };
    });
  });
  assert.ok(z.start > 7 && z.start < 9, `dolly should start near z=8, got ${z.start}`);
  assert.ok(z.end < z.start - 3, `dolly should travel forward, got ${z.start} -> ${z.end}`);
});

test('doors are reflective, not transmissive — only the lens uses transmission', async () => {
  const t = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      // Count distinct MATERIALS, not meshes: head and heart deliberately
      // share one material, so counting meshes double-counts the one
      // transmission pass that actually runs.
      const seen = new Set();
      window.__tccStage.scene.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) if ((m.transmission ?? 0) > 0) seen.add(m);
      });
      return {
        door: window.__tccAct1.doorL.material.transmission ?? 0,
        lens: window.__tccLens.material.transmission,
        transmissive: seen.size,
      };
    });
  });
  assert.equal(t.door, 0, 'doors must not run a transmission pass');
  assert.equal(t.lens, 1);
  // HARD CONSTRAINT: exactly one transmissive object in the whole scene.
  assert.equal(t.transmissive, 1, `${t.transmissive} transmissive materials in the scene, expected 1`);
});

test('the aisle plates stay behind the mark for the whole act', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, a = window.__tccAct1, lens = window.__tccLens;
      const samples = [];
      for (const p of [0, 0.05, 0.11, 0.17, 0.21]) {
        d.setProgress(p);
        samples.push({
          p,
          markZ: lens.group.position.z,
          plateZ: a.planes.map((m) => m.position.z),
        });
      }
      return { samples, count: a.planes.length };
    });
  });
  assert.equal(r.count, 3, 'expected three aisle plates');
  for (const s of r.samples) {
    for (const z of s.plateZ) {
      // Smaller z is further from the camera, which looks down -Z.
      assert.ok(z < s.markZ, `at p=${s.p} a plate at z=${z} was in front of the mark at z=${s.markZ}`);
    }
  }
});

test('every aisle plate fills the doorway it is seen through', async () => {
  // The store is seen through an aperture, so a plate does not need to fill
  // the viewport — it needs to fill the cone the aperture exposes at its own
  // depth. A plate narrower than that shows its own edge inside the doorway,
  // which is the failure this guards.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, a = window.__tccAct1, cam = window.__tccStage.camera;
      const THREE = window.__tccStage.THREE;
      d.setProgress(0);
      const ap = new THREE.Box3().setFromObject(a.wall[0]); // left return -> aperture edge
      const apRight = new THREE.Box3().setFromObject(a.wall[1]);
      const apTop = new THREE.Box3().setFromObject(a.wall[2]);
      const apBottom = new THREE.Box3().setFromObject(a.wall[3]);
      const apW = apRight.min.x - ap.max.x;
      const apH = apTop.min.y - apBottom.max.y;
      const apZ = ap.max.z;
      return a.planes.map((m) => {
        // The aperture cone widens linearly with distance from the camera.
        const spread = (cam.position.z - m.position.z) / (cam.position.z - apZ);
        const box = new THREE.Box3().setFromObject(m);
        return {
          coversW: (box.max.x - box.min.x) / (apW * spread),
          coversH: (box.max.y - box.min.y) / (apH * spread),
        };
      });
    });
  });
  for (const [i, p] of r.entries()) {
    assert.ok(p.coversW >= 1, `plate ${i} spans only ${p.coversW.toFixed(2)}x the doorway width at its depth`);
    assert.ok(p.coversH >= 1, `plate ${i} spans only ${p.coversH.toFixed(2)}x the doorway height at its depth`);
  }
});

test('the storefront wall covers the frame so the store reads as a doorway', async () => {
  // The wall is the whole reason this is a threshold rather than a photo
  // behind text: everything outside the aperture must be flat --chamber.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, a = window.__tccAct1, cam = window.__tccStage.camera;
      const THREE = window.__tccStage.THREE;
      d.setProgress(0);
      const b = new THREE.Box3();
      for (const s of a.wall) b.union(new THREE.Box3().setFromObject(s));
      const dist = cam.position.z - a.wall[0].position.z;
      const visH = 2 * dist * Math.tan((cam.fov * Math.PI) / 180 / 2);
      return {
        coversH: (b.max.y - b.min.y) / visH,
        coversW: (b.max.x - b.min.x) / (visH * cam.aspect),
        colour: '#' + a.wall[0].material.color.getHexString(),
      };
    });
  });
  assert.ok(r.coversH >= 1, `wall covers only ${r.coversH.toFixed(2)}x the frame height`);
  assert.ok(r.coversW >= 1, `wall covers only ${r.coversW.toFixed(2)}x the frame width`);
  assert.equal(r.colour, '#08070a', 'the wall must be --chamber');
});

test('the letterboxed stills are cropped so no black bar is sampled', async () => {
  const crops = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() =>
      window.__tccAct1.planes.map((m) => ({
        src: m.material.map.image?.currentSrc || m.material.map.image?.src || '',
        offsetY: m.material.map.offset.y,
        repeatY: m.material.map.repeat.y,
      }))
    );
  });
  for (const c of crops) {
    const letterboxed = /brand-film-[23]\.jpg$/.test(c.src);
    if (letterboxed) {
      assert.equal(c.repeatY, 0.8, `${c.src} should crop its 90px bars to repeat.y 0.8`);
      assert.equal(c.offsetY, 0.1, `${c.src} should offset past its bottom bar`);
    } else {
      assert.equal(c.repeatY, 1, `${c.src} has no bars and must not be cropped`);
    }
  }
});
