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
      setLocal(d, 'threshold', 0);
      const shut = { l: a.doorL.position.x, r: a.doorR.position.x };
      setLocal(d, 'threshold', 0.91);
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
      setLocal(d, 'threshold', 0);   const start = cam.position.z;
      setLocal(d, 'threshold', 0.95); const end = cam.position.z;
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

test('the core gradient runs behind the doorway from the first frame', async () => {
  // Act 1 originally opened on three store stills; they were replaced by the
  // brand core gradient. It has to be live and dark from frame one — dark
  // because the hero is .theme-dark with white copy sitting on it.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, f = window.__tccField;
      const sample = () => {
        const px = f.mesh.material.map.image.getContext('2d').getImageData(8, 8, 1, 1).data;
        return { lum: (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]) / 255, visible: f.mesh.visible };
      };
      setLocal(d, 'threshold', 0);
      const shut = sample();
      setLocal(d, 'threshold', 0.95);
      return { shut, open: sample() };
    });
  });
  assert.equal(r.shut.visible, true, 'the gradient field is not showing during Act 1');
  assert.ok(r.shut.lum > 0.02, `the backdrop is effectively black: luminance ${r.shut.lum.toFixed(3)}`);
  assert.ok(r.open.lum > r.shut.lum * 1.3, 'the backdrop does not brighten as the doors open');
  // Deliberately NOT capping brightness here. An earlier version did, to
  // protect the hero's white copy — but the aperture now sits clear of the
  // headline entirely, and legibility is measured properly against the real
  // rendered pixel in backdrop-contrast.test.mjs. A second, guessed bound
  // in this file would only argue with it.
});

test('the storefront wall covers the frame so the store reads as a doorway', async () => {
  // The wall is the whole reason this is a threshold rather than a photo
  // behind text: everything outside the aperture must be flat --chamber.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, a = window.__tccAct1, cam = window.__tccStage.camera;
      const THREE = window.__tccStage.THREE;
      setLocal(d, 'threshold', 0);
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

