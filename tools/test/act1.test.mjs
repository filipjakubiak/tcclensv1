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
      // The leaves are children of the gate group, so their position is a
      // LOCAL offset from the gate centre. Measuring the leaf's own width in
      // local space keeps the edge maths in one coordinate system — a world
      // Box3 here would shrink by cos(yaw) once the gate turned to face the
      // camera and quietly change what "shut" means.
      const halfWidth = new THREE.Box3().setFromObject(a.doorL, true)
        .getSize(new THREE.Vector3()).x / 2;
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
  // Symmetric about the gate centre: the leaves are a pair, not two
  // independently placed panels.
  assert.ok(
    Math.abs(r.open.l + r.open.r) < 1e-6,
    `leaves parted asymmetrically: ${r.open.l.toFixed(3)} / ${r.open.r.toFixed(3)}`
  );
});

test('the gate faces the camera square-on rather than being seen from the side', async () => {
  // User, 2026-08-16: the leaves read as slanted because they sat axis-aligned
  // 2.6 units off the view axis. The camera was deliberately NOT moved to fix
  // it — every other composition on the page holds — so what is asserted here
  // is that the GATE turned instead.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, a = window.__tccAct1;
      const THREE = window.__tccStage.THREE;
      const cam = window.__tccStage.camera;

      const sample = (t) => {
        setLocal(d, 'threshold', t);
        // Angle between the gate's own forward normal and the direction from
        // the gate to the camera. Zero means dead-on to the lens.
        const normal = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(a.gate.getWorldQuaternion(new THREE.Quaternion()));
        const toCam = cam.position.clone()
          .sub(a.gate.getWorldPosition(new THREE.Vector3()));
        // Horizontal plane only: the slant complained about is a yaw, and the
        // camera's slight rise would otherwise show up as false error.
        normal.y = 0; toCam.y = 0;
        return {
          t,
          offDeg: THREE.MathUtils.radToDeg(normal.normalize().angleTo(toCam.normalize())),
          yaw: a.gate.rotation.y,
        };
      };

      // Sampled across the whole act, not just where it is easy to pass.
      return [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.62, 0.78, 0.9, 1].map(sample);
    });
  });

  // While the gate is the subject and actually parting, it must be square on.
  for (const s of r.filter((s) => s.t <= 0.5)) {
    assert.ok(
      s.offDeg < 2,
      `gate is ${s.offDeg.toFixed(1)}deg off the lens at t=${s.t} — it should be facing front`
    );
  }

  // BOUNDED, not merely "it moved". An earlier per-frame rotation in this act
  // accumulated instead of oscillating and ran away 2.2 radians in 1.5s while
  // a test that only asserted change passed happily. The clamp is the thing
  // that stops the gate whipping round as the camera passes the gate plane,
  // so the clamp is what gets asserted.
  for (const s of r) {
    assert.ok(
      Math.abs(s.yaw) <= 0.46 + 1e-6,
      `gate yaw ran past its clamp: ${s.yaw.toFixed(3)} rad at t=${s.t}`
    );
  }

  // Continuous: no frame-to-frame whip anywhere in the act, including across
  // the point where the camera goes through the gate plane.
  for (let i = 1; i < r.length; i += 1) {
    const step = Math.abs(r[i].yaw - r[i - 1].yaw);
    assert.ok(
      step < 0.25,
      `gate yaw jumped ${step.toFixed(3)} rad between t=${r[i - 1].t} and t=${r[i].t}`
    );
  }
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
