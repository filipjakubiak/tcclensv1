import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });

test('head and heart separate to opposite sides', async () => {
  // Measured in WORLD space against the mark's own height. Asserting on
  // pivot.position.x passed while the halves visibly never parted, because
  // the pivots sat above the fit scale and their local units were ~0.09 of
  // a world unit. A separation is only real if you can see it, so the
  // yardstick is the mark itself.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, l = window.__tccLens;
      const THREE = window.__tccStage.THREE;
      const centreOf = (o) => {
        o.updateMatrixWorld(true);
        return new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      };
      const markH = () => {
        const b = new THREE.Box3().setFromObject(l.group);
        return b.max.y - b.min.y;
      };
      const gap = () => {
        l.group.updateMatrixWorld(true);
        return centreOf(l.heartPivot).x - centreOf(l.headPivot).x;
      };
      setLocal(d, 'headheart', 0);
      const joined = gap();
      const h = markH();
      setLocal(d, 'headheart', 0.85);
      return { joined, split: gap(), markHeight: h };
    });
  });
  assert.ok(Math.abs(r.joined) < 0.3, `halves did not start joined — ${r.joined.toFixed(2)} apart`);
  // A split narrower than the mark is tall would not read as a separation.
  assert.ok(
    r.split > r.markHeight,
    `halves separated by only ${r.split.toFixed(2)} world units against a ${r.markHeight.toFixed(2)}-unit mark`
  );
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

test('the halves counter-rotate', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      setLocal(window.__tccDirector, 'headheart', 0.9);
      const l = window.__tccLens;
      return { head: l.headPivot.rotation.y, heart: l.heartPivot.rotation.y };
    });
  });
  assert.ok(r.head * r.heart < 0, 'rotations share a sign — not counter-rotating');
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
      const d = window.__tccDirector, a1 = window.__tccAct1, f = window.__tccField;
      const snap = () => ({
        wall: a1.wall[0].visible,
        plates: a1.planes.some((p) => p.visible),
        field: f.mesh.visible,
        // Opaque means fading has to be done in colour, not alpha.
        fieldOpaque: f.mesh.material.transparent === false,
      });
      setLocal(d, 'threshold', 0.7);
      const inAct1 = snap();
      setLocal(d, 'headheart', 0.55);
      const inAct2 = snap();
      setLocal(d, 'threshold', 0.7); // scroll back up
      return { inAct1, inAct2, backInAct1: snap() };
    });
  });
  assert.deepEqual(r.inAct1, { wall: true, plates: true, field: false, fieldOpaque: true });
  assert.deepEqual(r.inAct2, { wall: false, plates: false, field: true, fieldOpaque: true });
  assert.deepEqual(r.backInAct1, r.inAct1, 'scrolling back up did not restore the storefront');
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
