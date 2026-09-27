import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });

test('the mark stays whole — the halves never part in the picture plane', async () => {
  // The act used to pull the halves 1.55 units apart. The user asked for a
  // subtler reading (2026-09-27), so the halves may only breathe along Z.
  // Sampled across the whole act and measured in WORLD space, in the mark's
  // own frame (group rotation removed), because the sway turns the mark and
  // a projected gap would move with it.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, l = window.__tccLens;
      let maxXY = 0, maxZ = 0, samples = 0;
      for (let i = 0; i <= 40; i++) {
        setLocal(d, 'headheart', i / 40);
        for (const p of [l.headPivot, l.heartPivot]) {
          maxXY = Math.max(maxXY, Math.hypot(p.position.x, p.position.y));
          maxZ = Math.max(maxZ, Math.abs(p.position.z));
        }
        samples++;
      }
      return { maxXY, maxZ, samples, DEPTH: window.__tccAct2.DEPTH };
    });
  });
  assert.equal(r.samples, 41);
  assert.ok(r.maxXY < 1e-6, `a half moved ${r.maxXY.toFixed(3)} units in X/Y — the mark came apart`);
  // The breath has to exist, and stay a breath.
  assert.ok(r.maxZ > 0.05, `depth breath peaked at only ${r.maxZ.toFixed(3)} — it does nothing`);
  assert.ok(r.maxZ <= r.DEPTH + 1e-6, `depth breath reached ${r.maxZ.toFixed(3)}, past its ${r.DEPTH} bound`);
});

test('the heart beats once, within bounds, and the head never swells', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, l = window.__tccLens;
      let maxHeart = 0, minHeart = 9, maxHead = 0, minHead = 9;
      for (let i = 0; i <= 200; i++) {
        setLocal(d, 'headheart', i / 200);
        maxHeart = Math.max(maxHeart, l.heartPivot.scale.x);
        minHeart = Math.min(minHeart, l.heartPivot.scale.x);
        maxHead = Math.max(maxHead, l.headPivot.scale.x);
        minHead = Math.min(minHead, l.headPivot.scale.x);
      }
      setLocal(d, 'headheart', 0);
      const start = l.heartPivot.scale.x;
      setLocal(d, 'headheart', 1);
      return { maxHeart, minHeart, maxHead, minHead, start, end: l.heartPivot.scale.x };
    });
  });
  assert.ok(r.maxHeart > 1.02, `heart peaked at ${r.maxHeart.toFixed(3)} — no visible beat`);
  assert.ok(r.maxHeart < 1.08, `heart peaked at ${r.maxHeart.toFixed(3)} — a lurch, not a beat`);
  assert.ok(r.minHeart >= 1 - 1e-6, `heart shrank to ${r.minHeart.toFixed(3)}`);
  assert.ok(Math.abs(r.maxHead - 1) < 1e-6 && Math.abs(r.minHead - 1) < 1e-6, 'the head changed scale');
  assert.ok(Math.abs(r.start - 1) < 1e-3 && Math.abs(r.end - 1) < 1e-3, 'the beat is not at rest at the act edges');
});

test('emphasis hands over from the head light to the heart light', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, a = window.__tccAct2;
      const at = (t) => {
        setLocal(d, 'headheart', t);
        return { head: a.headLight.intensity, heart: a.heartLight.intensity };
      };
      return { early: at(0.35), late: at(0.8) };
    });
  });
  assert.ok(r.early.head > r.early.heart * 1.5, `early on the head is not leading: ${JSON.stringify(r.early)}`);
  assert.ok(r.late.heart > r.late.head * 1.5, `late on the heart is not leading: ${JSON.stringify(r.late)}`);
  // The half out of focus dims but never goes dark.
  assert.ok(r.early.heart > 0 && r.late.head > 0, 'a light went fully dark mid-act');
});

test('the head is lit Space Grey and the heart TCC Purple', async () => {
  const c = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => ({
      head: window.__tccAct2.headLight.color.getHexString(),
      heart: window.__tccAct2.heartLight.color.getHexString(),
    }));
  });
  assert.equal(c.head.toLowerCase(), 'b1bdce');
  assert.equal(c.heart.toLowerCase(), 'd380eb');
});

test('the sway turns toward each half and stays bounded', async () => {
  // Pure function of t (SESSION §2.4): assert the range, not merely change.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, l = window.__tccLens;
      let min = 0, max = 0;
      for (let i = 0; i <= 100; i++) {
        setLocal(d, 'headheart', i / 100);
        if (i / 100 > 0.42) { // past the settle from Act 1's own yaw
          min = Math.min(min, l.group.rotation.y);
          max = Math.max(max, l.group.rotation.y);
        }
      }
      setLocal(d, 'headheart', 1);
      return { min, max, end: l.group.rotation.y, SWAY: window.__tccAct2.SWAY };
    });
  });
  assert.ok(r.min < -0.1 && r.max > 0.1, `sway did not turn both ways: ${r.min.toFixed(2)}..${r.max.toFixed(2)}`);
  assert.ok(Math.max(-r.min, r.max) <= r.SWAY + 1e-6, 'sway exceeded its bound');
  assert.ok(Math.abs(r.end) < 1e-3, `the mark is not front-on at hand-over: ${r.end.toFixed(3)} rad`);
});

test('separating the halves does not move the mark as a whole', async () => {
  // The recentring offset is baked into head.position / heart.position.
  // Acts must drive the PIVOTS. An act assigning to mesh.position instead
  // would silently discard that offset, which is the failure this catches.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, l = window.__tccLens;
      const read = () => ({
        head: l.head.position.toArray(),
        heart: l.heart.position.toArray(),
      });
      setLocal(d, 'headheart', 0);
      const before = read();
      setLocal(d, 'headheart', 0.9);
      return { before, after: read() };
    });
  });
  assert.deepEqual(r.after, r.before, 'an act wrote to head/heart mesh position instead of its pivot');
});

test('nothing jumps across the Act 1 to Act 2 boundary', async () => {
  // Act-boundary continuity is the single thing most likely to break the
  // whole scroll, and neither act can see the other's end state. Sampling
  // either side of 0.22: a pop shows up as a large delta over a tiny step.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, S = window.__tccStage, l = window.__tccLens;
      const sample = () => ({
        cam: S.camera.position.toArray(),
        mark: l.group.position.toArray(),
        scale: l.group.scale.x,
      });
      setLocal(d, 'threshold', 0.999);
      const before = sample();
      setLocal(d, 'headheart', 0.001);
      const after = sample();
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      return {
        cam: dist(before.cam, after.cam),
        mark: dist(before.mark, after.mark),
        scale: Math.abs(before.scale - after.scale),
        act: d.activeAct.id,
      };
    });
  });
  assert.equal(r.act, 'headheart', 'progress 0.221 should already be Act 2');
  assert.ok(r.cam < 0.25, `camera jumped ${r.cam.toFixed(2)} units across the boundary`);
  assert.ok(r.mark < 0.25, `mark jumped ${r.mark.toFixed(2)} units across the boundary`);
  assert.ok(r.scale < 0.1, `mark scale jumped ${r.scale.toFixed(2)} across the boundary`);
});

test('Act 2 swaps the storefront for the brand gradient, and Act 1 puts it back', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, a1 = window.__tccAct1;
      const f = window.__tccField, fl = window.__tccFluid;
      const snap = () => ({
        gate: a1.doorL.visible,
        // Act 1 runs the morphing SHADER field; the painted canvas field owns
        // Acts 2-4, where its measured light-section tint ceilings apply.
        // Exactly one of the two is ever up.
        field: f.mesh.visible,
        fluid: fl.mesh.visible,
        // Opaque means fading has to be done in colour, not alpha — both
        // backdrops are refraction content for the glass mark, and three.js
        // renders only opaque objects into the transmission target.
        fieldOpaque: f.mesh.material.transparent === false,
        fluidOpaque: fl.mesh.material.transparent === false,
      });
      setLocal(d, 'threshold', 0.7);
      const inAct1 = snap();
      setLocal(d, 'headheart', 0.55);
      const inAct2 = snap();
      setLocal(d, 'threshold', 0.7); // scroll back up
      return { inAct1, inAct2, backInAct1: snap() };
    });
  });
  assert.deepEqual(r.inAct1, {
    gate: true, field: false, fluid: true, fieldOpaque: true, fluidOpaque: true,
  });
  assert.deepEqual(r.inAct2, {
    gate: false, field: true, fluid: false, fieldOpaque: true, fluidOpaque: true,
  });
  assert.deepEqual(r.backInAct1, r.inAct1, 'scrolling back up did not restore the curtain and its field');
});

test('the gradient field gives the glass something to refract', async () => {
  // The whole reason Act 2 needs a backdrop at all: without one the mark
  // refracts flat --chamber and the glass reads as plastic again.
  const px = await withPage(async (page) => {
    await boot(page);
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const S = window.__tccStage, d = window.__tccDirector, f = window.__tccField;
      setLocal(d, 'headheart', 0.55);
      const v = window.__tccLens.group.position.clone().project(S.camera);
      const x = Math.round((v.x * 0.5 + 0.5) * S.renderer.domElement.width);
      const y = Math.round((v.y * 0.5 + 0.5) * S.renderer.domElement.height);
      const gl = S.renderer.getContext();
      const read = () => {
        S.renderer.render(S.scene, S.camera);
        const b = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
        return [b[0], b[1], b[2]];
      };
      const withField = read();
      f.mesh.visible = false;
      const without = read();
      f.mesh.visible = true;
      return { withField, without };
    });
  });
  const delta = Math.abs(px.withField[0] - px.without[0])
    + Math.abs(px.withField[1] - px.without[1])
    + Math.abs(px.withField[2] - px.without[2]);
  assert.ok(delta > 20, `hiding the gradient changed the mark by only ${delta} — it is not being refracted`);
});
