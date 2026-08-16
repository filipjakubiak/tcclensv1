import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

const NAMES = ['performance', 'insight', 'creativity', 'operational', 'sustainability'];
const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });

test('the capabilities section carries all five brand gradients, each used once', async () => {
  const used = await withPage((page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('#capabilities .capability')].map((c) => c.dataset.gradient)
    )
  );
  assert.deepEqual([...used].sort(), [...NAMES].sort());
  assert.equal(new Set(used).size, 5, 'a gradient is reused — brand forbids combining');
});

test('no capability card paints more than one gradient', async () => {
  const bad = await withPage((page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('#capabilities .capability')]
        .filter((c) => (getComputedStyle(c).backgroundImage.match(/gradient/g) ?? []).length > 1)
        .map((c) => c.dataset.gradient)
    )
  );
  assert.deepEqual(bad, [], 'gradients are being combined');
});

test('every capability card actually paints its own gradient', async () => {
  // The card markup shipped in Task 7 with data-gradient already set but no
  // paint behind it. An attribute nothing consumes looks identical to a
  // working one in the DOM, so assert the computed background instead.
  const painted = await withPage((page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('#capabilities .capability')].map((c) => ({
        name: c.dataset.gradient,
        bg: getComputedStyle(c).backgroundImage,
      }))
    )
  );
  const seen = new Set();
  for (const p of painted) {
    assert.match(p.bg, /gradient/, `${p.name} card paints no gradient`);
    assert.ok(!seen.has(p.bg), `${p.name} repeats another card's gradient`);
    seen.add(p.bg);
  }
});

test('capability copy stays legible on its gradient', async () => {
  // Each card is a painted surface, so the WebGL backdrop guard skips it.
  // These are the five brightest surfaces on the page and the body text on
  // them is --ink-2, so the pairing needs checking on its own.
  const rows = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const lum = ([r, g, b]) => {
        const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const parse = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const out = [];
      for (const card of document.querySelectorAll('#capabilities .capability')) {
        // Worst case is the darker end of the two-stop gradient.
        const stops = getComputedStyle(card).backgroundImage.match(/rgb\([^)]*\)/g) ?? [];
        if (!stops.length) continue;
        for (const el of card.querySelectorAll('p, h3')) {
          const fg = parse(getComputedStyle(el).color);
          const size = parseFloat(getComputedStyle(el).fontSize);
          let worst = Infinity;
          for (const s of stops) {
            const bg = parse(s);
            const l1 = Math.max(lum(fg), lum(bg)), l2 = Math.min(lum(fg), lum(bg));
            worst = Math.min(worst, (l1 + 0.05) / (l2 + 0.05));
          }
          out.push({ name: card.dataset.gradient, size, ratio: +worst.toFixed(2),
                     tag: el.tagName.toLowerCase() });
        }
      }
      return out;
    });
  });
  assert.ok(rows.length >= 10, `only checked ${rows.length} text runs across five cards`);
  const bad = rows.filter((r) => r.ratio < (r.size >= 24 ? 3 : 4.5));
  assert.deepEqual(bad, [], `\n  ${bad.map((b) => `${b.name} ${b.tag} ${b.ratio}:1 at ${b.size}px`).join('\n  ')}\n`);
});

test('the halves recombine and the mark turns edge-on into a prism', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, l = window.__tccLens;
      const THREE = window.__tccStage.THREE;
      const gap = () => {
        l.group.updateMatrixWorld(true);
        const c = (o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
        return Math.abs(c(l.heartPivot).x - c(l.headPivot).x);
      };
      setLocal(d, 'prism', 0.02);
      const start = gap();
      setLocal(d, 'prism', 0.6);
      return { start, gap: gap(), rotY: l.group.rotation.y };
    });
  });
  assert.ok(r.gap < r.start, `halves did not recombine: ${r.start.toFixed(2)} -> ${r.gap.toFixed(2)}`);
  assert.ok(r.gap < 0.3, `halves are still ${r.gap.toFixed(2)} apart after recombining`);
  assert.ok(Math.abs(r.rotY) > 0.9, `mark did not rotate edge-on: ${r.rotY}`);
});

test('the glass thickens and disperses harder edge-on, and resets on exit', async () => {
  // The point of turning edge-on is the longest possible light path through
  // the glass. If thickness and dispersion do not actually rise, the prism
  // is just the mark seen from the side.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, m = window.__tccLens.material;
      setLocal(d, 'prism', 0.02);
      const flat = { thickness: m.thickness, dispersion: m.dispersion };
      setLocal(d, 'prism', 0.85);
      const edge = { thickness: m.thickness, dispersion: m.dispersion };
      setLocal(d, 'headheart', 0.5); // leave the act
      return { flat, edge, afterExit: { thickness: m.thickness, dispersion: m.dispersion } };
    });
  });
  assert.ok(r.edge.thickness > r.flat.thickness * 1.5, `thickness only went ${r.flat.thickness} -> ${r.edge.thickness}`);
  assert.ok(r.edge.dispersion > r.flat.dispersion, `dispersion only went ${r.flat.dispersion} -> ${r.edge.dispersion}`);
  assert.equal(r.afterExit.thickness, 2.4, 'thickness was not restored on exit');
  assert.equal(r.afterExit.dispersion, 4, 'dispersion was not restored on exit');
});

test('the backdrop follows the capability in view', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(async () => {
      const a3 = window.__tccAct3, f = window.__tccField;
      const seen = {};
      for (const name of ['performance', 'insight', 'creativity', 'operational', 'sustainability']) {
        a3.tintFor(name);
        seen[name] = f.mesh.material.map.image
          .getContext('2d')
          .getImageData(8, 8, 1, 1).data.slice(0, 3).join(',');
      }
      return seen;
    });
  });
  const values = Object.values(r);
  assert.equal(new Set(values).size, 5, `five gradients produced only ${new Set(values).size} distinct backdrops: ${JSON.stringify(r)}`);
});

test('nothing jumps across the Act 2 to Act 3 boundary', async () => {
  // This test used to sample the camera and the mark group ONLY, and passed
  // the whole time the two halves were snapping 1.5 rad at this boundary —
  // Act 3 opened by assigning pivot rotation 0 while Act 2 left it at ±1.5.
  // The boundary lands at the top of #what-we-do, so that was visible on the
  // page as the sequence breaking mid-scroll. Everything an act hands over is
  // sampled now, not just the parts that were easy to reach.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector, S = window.__tccStage, l = window.__tccLens;
      const sample = () => ({
        cam: S.camera.position.toArray(),
        mark: l.group.position.toArray(),
        markRot: l.group.rotation.toArray().slice(0, 3),
        scale: l.group.scale.x,
        headPos: l.headPivot.position.toArray(),
        heartPos: l.heartPivot.position.toArray(),
        headRot: l.headPivot.rotation.toArray().slice(0, 3),
        heartRot: l.heartPivot.rotation.toArray().slice(0, 3),
      });
      setLocal(d, 'headheart', 0.999);
      const before = sample();
      setLocal(d, 'prism', 0.001);
      const after = sample();
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      return {
        act: d.activeAct.id,
        cam: dist(before.cam, after.cam),
        mark: dist(before.mark, after.mark),
        markRot: dist(before.markRot, after.markRot),
        scale: Math.abs(before.scale - after.scale),
        headPos: dist(before.headPos, after.headPos),
        heartPos: dist(before.heartPos, after.heartPos),
        headRot: dist(before.headRot, after.headRot),
        heartRot: dist(before.heartRot, after.heartRot),
      };
    });
  });
  assert.equal(r.act, 'prism');
  assert.ok(r.cam < 0.25, `camera jumped ${r.cam.toFixed(2)} units across the boundary`);
  assert.ok(r.mark < 0.25, `mark jumped ${r.mark.toFixed(2)} units across the boundary`);
  assert.ok(r.scale < 0.1, `mark scale jumped ${r.scale.toFixed(2)} across the boundary`);
  assert.ok(r.markRot < 0.1, `mark rotation jumped ${r.markRot.toFixed(2)} rad across the boundary`);
  assert.ok(r.headPos < 0.25, `head pivot jumped ${r.headPos.toFixed(2)} units across the boundary`);
  assert.ok(r.heartPos < 0.25, `heart pivot jumped ${r.heartPos.toFixed(2)} units across the boundary`);
  assert.ok(r.headRot < 0.1, `head pivot rotation jumped ${r.headRot.toFixed(2)} rad across the boundary`);
  assert.ok(r.heartRot < 0.1, `heart pivot rotation jumped ${r.heartRot.toFixed(2)} rad across the boundary`);
});
