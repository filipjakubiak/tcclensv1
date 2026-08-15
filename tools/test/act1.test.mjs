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

test('the hero opens on the brand gradient, not on black', async () => {
  // The page used to open on a --chamber storefront wall with the gradient
  // confined to a hole in it, which meant the first thing anyone saw was a
  // black screen. The gradient IS the hero now.
  //
  // Measured over the whole field rather than one pixel: it carries blooms
  // and a weighted-down corner, so any single sample describes a detail
  // rather than the backdrop.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, f = window.__tccField;
      const survey = () => {
        const img = f.mesh.material.map.image;
        const px = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
        let lum = 0, chroma = 0, n = 0;
        for (let i = 0; i < px.length; i += 4 * 97) { // stride-sample
          const [r0, g0, b0] = [px[i], px[i + 1], px[i + 2]];
          lum += (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
          chroma += (Math.max(r0, g0, b0) - Math.min(r0, g0, b0)) / 255;
          n += 1;
        }
        return { lum: lum / n, chroma: chroma / n, visible: f.mesh.visible };
      };
      setLocal(d, 'threshold', 0);
      const shut = survey();
      setLocal(d, 'threshold', 0.95);
      return { shut, open: survey() };
    });
  });
  assert.equal(r.shut.visible, true, 'the gradient field is not showing during Act 1');
  assert.ok(r.shut.lum > 0.12, `the hero opens on near-black: mean luminance ${r.shut.lum.toFixed(3)}`);
  // Grey is the failure mode this act kept falling into — a desaturated
  // backdrop is not a brand gradient no matter how bright it is.
  assert.ok(r.shut.chroma > 0.06, `the backdrop is desaturated grey: mean chroma ${r.shut.chroma.toFixed(3)}`);
  // The backdrop is deliberately CONSTANT across the act, so this asserts it
  // holds rather than that it moves. An earlier version brightened it as the
  // gate opened; it looked right in isolation but the hero copy is on screen
  // throughout, and the brighter end measured 2.92:1 against a 4.5:1 floor.
  // The reveal is the gate parting and the mark coming forward.
  assert.ok(
    Math.abs(r.open.lum - r.shut.lum) < 0.02,
    `the backdrop shifts during the act (${r.shut.lum.toFixed(3)} -> ${r.open.lum.toFixed(3)}); legibility depends on it not doing that`
  );
  // Deliberately NOT capping brightness here. Legibility is measured against
  // the real rendered pixel in composited-contrast.test.mjs; a second,
  // guessed bound in this file would only argue with it.
});
