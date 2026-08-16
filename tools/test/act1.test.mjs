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

test('the camera leans in behind the curtain without passing through it', async () => {
  // The act used to dolly the camera THROUGH the gate plane, which is why the
  // gate needed a yaw clamp: past that plane the facing angle swings beyond
  // 90 degrees. The curtain reveal replaced that — the leaves parting is the
  // move, and the camera only closes a little way behind them. Staying in
  // front of the gate is what keeps the leaves square to the lens all act.
  const z = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, cam = window.__tccStage.camera;
      const gateZ = window.__tccAct1.gate.position.z;
      setLocal(d, 'threshold', 0);   const start = cam.position.z;
      setLocal(d, 'threshold', 0.95); const end = cam.position.z;
      return { start, end, gateZ };
    });
  });
  assert.ok(z.start > 7 && z.start < 9, `dolly should start near z=8, got ${z.start}`);
  assert.ok(z.end < z.start - 1, `camera should close on the gate, got ${z.start} -> ${z.end}`);
  assert.ok(
    z.end > z.gateZ,
    `camera passed through the gate plane (${z.end.toFixed(2)} vs gate at ${z.gateZ}) — the leaves will not stay square to the lens`
  );
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
  // Act 1's backdrop is the SHADER field, not the painted one — so there is
  // no canvas texture left to sample, and this reads the rendered frame
  // instead. That is the better instrument anyway: it measures what the GPU
  // actually produced rather than the source art it was fed.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector;
      const stage = window.__tccStage;
      const gl = stage.renderer.getContext();

      const survey = () => {
        stage.renderer.render(stage.scene, stage.camera);
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let lum = 0, chroma = 0, n = 0;
        for (let i = 0; i < px.length; i += 4 * 397) { // stride-sample
          const [r0, g0, b0] = [px[i], px[i + 1], px[i + 2]];
          lum += (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
          chroma += (Math.max(r0, g0, b0) - Math.min(r0, g0, b0)) / 255;
          n += 1;
        }
        return { lum: lum / n, chroma: chroma / n };
      };

      setLocal(d, 'threshold', 0);
      const shut = survey();
      const layers = {
        fluidUp: window.__tccFluid.mesh.visible,
        paintedUp: window.__tccField.mesh.visible,
      };
      setLocal(d, 'threshold', 0.95);
      return { shut, open: survey(), layers };
    });
  });

  // The hero runs the morphing shader; the painted field owns Acts 2-4, where
  // its measured light-section tint ceilings apply.
  assert.equal(r.layers.fluidUp, true, 'the fluid field is not showing during Act 1');
  assert.equal(r.layers.paintedUp, false, 'the painted field is still up during Act 1 — two backdrops are stacked');

  assert.ok(r.shut.lum > 0.06, `the hero opens on near-black: mean luminance ${r.shut.lum.toFixed(3)}`);
  // Grey is the failure mode this act kept falling into — a desaturated
  // backdrop is not a brand gradient no matter how bright it is.
  assert.ok(r.shut.chroma > 0.03, `the backdrop is desaturated grey: mean chroma ${r.shut.chroma.toFixed(3)}`);
  // Deliberately NOT capping brightness here. Legibility is measured against
  // the real rendered pixel in composited-contrast.test.mjs; a second,
  // guessed bound in this file would only argue with it.
});

test('the curtain covers the frame when shut and clears it when open', async () => {
  // The reveal only works if there is something to reveal FROM. The previous
  // gate was a 3-unit pair off to one side that read as a pale slab over the
  // headline; this asserts the leaves actually span the frame at the gate
  // plane, and actually leave it.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, a = window.__tccAct1;
      const THREE = window.__tccStage.THREE;
      const cam = window.__tccStage.camera;

      // Half-width of the camera frustum at the gate's depth, for the camera
      // wherever it currently is.
      const halfFrameAt = () => {
        const dist = Math.abs(cam.position.z - a.gate.position.z);
        const h = 2 * dist * Math.tan((cam.fov * Math.PI) / 180 / 2);
        return (h * cam.aspect) / 2;
      };

      const edges = () => {
        const box = (m) => new THREE.Box3().setFromObject(m);
        const l = box(a.doorL), rr = box(a.doorR);
        return {
          halfFrame: halfFrameAt(),
          // Inner edges, which is where a gap would show.
          innerL: l.max.x,
          innerR: rr.min.x,
          // Outer edges, which is how far off frame they have travelled.
          outerL: l.min.x,
          outerR: rr.max.x,
          top: l.max.y,
          bottom: l.min.y,
          halfFrameH: (2 * Math.abs(cam.position.z - a.gate.position.z) *
            Math.tan((cam.fov * Math.PI) / 180 / 2)) / 2,
        };
      };

      setLocal(d, 'threshold', 0);
      const shut = edges();
      // 0.95, not 1: local t of exactly 1 resolves to the act's END, which is
      // the START of the next act, so the director hands over and Act 1's
      // update never runs for the frame being measured.
      setLocal(d, 'threshold', 0.95);
      return { shut, open: edges() };
    });
  });

  // Shut: the leaves meet on the centre line and reach past both frame edges.
  assert.ok(
    Math.abs(r.shut.innerL - r.shut.innerR) < 0.05,
    `the curtain has a ${Math.abs(r.shut.innerL - r.shut.innerR).toFixed(2)}-unit seam gap when shut`
  );
  assert.ok(
    r.shut.outerL <= -r.shut.halfFrame && r.shut.outerR >= r.shut.halfFrame,
    `the curtain does not reach the frame edges when shut (${r.shut.outerL.toFixed(2)}..${r.shut.outerR.toFixed(2)} vs +/-${r.shut.halfFrame.toFixed(2)})`
  );
  assert.ok(
    r.shut.top >= r.shut.halfFrameH && r.shut.bottom <= -r.shut.halfFrameH,
    'the curtain does not cover the full frame height when shut'
  );

  // Open: both inner edges are past the frame edges, so nothing is left over
  // the reveal.
  assert.ok(
    r.open.innerL <= -r.open.halfFrame,
    `the left leaf still intrudes ${(r.open.innerL + r.open.halfFrame).toFixed(2)} units into frame when open`
  );
  assert.ok(
    r.open.innerR >= r.open.halfFrame,
    `the right leaf still intrudes ${(r.open.halfFrame - r.open.innerR).toFixed(2)} units into frame when open`
  );
});

test('the fluid field drifts on a live page and is frozen under ?shot=1', async () => {
  // Bounds, not mere change: this codebase has already shipped one per-frame
  // updater that accumulated instead of oscillating and ran away, past a test
  // that only asserted the value moved.
  const live = await withPage(async (page) => {
    await boot(page);
    const at = () => page.evaluate(() => window.__tccFluid.uniforms.uTime.value);
    const a = await at();
    await page.waitForTimeout(1200);
    return { a, b: await at(), fluid: await page.evaluate(() => window.__tccFluid.uniforms.uFluid.value) };
  });

  assert.ok(live.b > live.a, 'the fluid clock did not advance on a live page');
  // Real elapsed time, not a runaway: ~1.2s of wall clock should move the
  // clock by about 1.2s.
  const dt = live.b - live.a;
  assert.ok(dt > 0.6 && dt < 3.0, `the fluid clock advanced ${dt.toFixed(2)}s in ~1.2s of wall clock`);
  assert.equal(live.fluid, 1, 'the drift amplitude is not at full on a live page');

  const shot = await withPage(async (page) => {
    await boot(page);
    const at = () => page.evaluate(() => window.__tccFluid.uniforms.uTime.value);
    const a = await at();
    await page.waitForTimeout(900);
    return { a, b: await at(), fluid: await page.evaluate(() => window.__tccFluid.uniforms.uFluid.value) };
  }, '/?shot=1');

  assert.equal(shot.a, shot.b, `?shot=1 must be reproducible; the clock moved ${shot.a} -> ${shot.b}`);
  assert.equal(shot.fluid, 0, '?shot=1 should hold the field still');
});
