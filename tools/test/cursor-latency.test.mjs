import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });

/** Boot, then stop the stage so rAF runs at real speed. See the note above. */
async function bootIdleStage(page) {
  await boot(page);
  await page.evaluate(() => window.__tccStage?.dispose());
  await page.waitForTimeout(300);
}

/**
 * The dot has to keep up with the hand.
 *
 * Reported from the deployed build: the cursor lagged badly. Measured, it
 * took 768ms to land after the pointer had already stopped, and the link
 * swell rendered at scale 1.000 — it had never fired since it was written.
 * One cause behind both: TWO owners of the dot's `transform`. GSAP wrote it
 * inline every frame; `.cursor { transition: transform 240ms }` then
 * re-interpolated each of those writes, and the same inline transform
 * outranked `.cursor--swell { transform: scale() }`. That is the third time
 * this codebase has been bitten by two owners of one property (magnetic
 * buttons, surface entrance vs tilt), so the first test here is structural.
 *
 * TWO THINGS ABOUT HOW THE TIMED TESTS MEASURE, both learned the hard way:
 *
 * 1. They count FRAMES, not milliseconds. The loop rescales its catch-up by
 *    real dt, so the frame count is the same at 60Hz and 144Hz while a
 *    millisecond budget would not be.
 * 2. They stop the WebGL stage first. Headless has no GPU, three.js falls
 *    back to software, and the page renders at 3.1fps against 61.3fps with
 *    the stage stopped — both measured. At 3fps a single frame is longer
 *    than the whole 240ms transition that caused this bug, so the transition
 *    finished INSIDE one frame and a per-frame sampler could not see it:
 *    re-injecting the original bug moved this suite from 2 frames to 4, well
 *    inside any honest threshold. The environment was masking the defect.
 *    Stopping the stage is what makes these measure the cursor rather than
 *    the test machine. The STRUCTURAL test below needs none of that and is
 *    the real guard against the bug coming back.
 */

/** Move the pointer along a path the way a hand does: small steps. */
async function drag(page, from, to, steps = 30) {
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      Math.round(from[0] + ((to[0] - from[0]) * i) / steps),
      Math.round(from[1] + ((to[1] - from[1]) * i) / steps)
    );
    await page.waitForTimeout(16);
  }
}

/** Count rendered frames until the dot is sitting on `[x, y]`. */
const framesToArrive = (page, x, y) =>
  page.evaluate(
    ([tx, ty]) =>
      new Promise((resolve) => {
        const dot = document.querySelector('.cursor');
        let n = 0;
        const look = () => {
          n += 1;
          const r = dot.getBoundingClientRect();
          if (Math.hypot(r.left + r.width / 2 - tx, r.top + r.height / 2 - ty) < 1.5) resolve(n);
          else if (n >= 240) resolve(n); // gave up; the assertion reports it
          else requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }),
    [x, y]
  );

test('the dot has exactly one owner of its transform', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(700, 400);
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.cursor'));
      return { property: cs.transitionProperty, duration: cs.transitionDuration };
    });
  });

  const alsoAnimatedByCss = r.property
    .split(',')
    .map((s) => s.trim())
    .filter((p) => p === 'transform' || p === 'all');
  assert.equal(
    alsoAnimatedByCss.length,
    0,
    `transform is CSS-transitioned (${r.property} / ${r.duration}) while JS writes it every frame`
  );
});

test('hovering a link swells the dot, and it is drawn at the size it is shown', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    const measure = () =>
      page.evaluate(() => {
        const el = document.querySelector('.cursor');
        const box = el.getBoundingClientRect();
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return { drawn: +box.width.toFixed(1), scale: +Math.hypot(m.a, m.b).toFixed(3) };
      });
    // Counted in frames for the same reason as everything else here.
    const settle = () =>
      page.evaluate(
        () =>
          new Promise((res) => {
            let n = 0;
            const t = () => (n++ < 30 ? requestAnimationFrame(t) : res());
            requestAnimationFrame(t);
          })
      );

    await page.mouse.move(700, 500);
    await settle();
    const rest = await measure();
    await page.locator('.nav__links .link').first().hover();
    await settle();
    return { rest, hot: await measure() };
  });

  // The OUTCOME, not the mechanism. An earlier version of this test asserted
  // the transform's scale factor, which passed only as long as scaling was
  // how the swell happened to be built — and scaling is exactly what had to
  // go. Rendered diameter is what the reader sees either way.
  assert.ok(r.hot.drawn > 40, `the dot did not swell on a link: drawn ${r.hot.drawn}px`);
  assert.ok(r.rest.drawn < 20, `the resting dot is not small: drawn ${r.rest.drawn}px`);

  // And it must get there by BEING that size, not by stretching a smaller
  // raster to it. A 12px circle has no 44px of detail to stretch: that is
  // what made the swelled dot look soft and stair-stepped.
  for (const [name, s] of [['resting', r.rest], ['swelled', r.hot]]) {
    assert.ok(
      Math.abs(s.scale - 1) < 0.01,
      `the ${name} dot is rendered at scale ${s.scale}, so its raster is being resampled`
    );
  }
});

test('the dot lands within a few frames of the pointer stopping', async () => {
  const frames = await withPage(async (page) => {
    await bootIdleStage(page);
    await page.mouse.move(200, 300);
    await page.waitForTimeout(300);
    await drag(page, [200, 300], [1100, 650]);
    return framesToArrive(page, 1100, 650);
  });
  // Measured, and repeatable to the frame across runs: 9 as written, 16 with
  // a `transition: transform` put back on the dot. The threshold sits between
  // the two, so this goes red if a second easing is ever stacked behind the
  // first again — a threshold above 16 would have watched the bug go past.
  assert.ok(frames < 13, `the dot needed ${frames} frames to land after the pointer stopped`);
});

test('the dot does not trail absurdly while the pointer is moving', async () => {
  const trail = await withPage(async (page) => {
    await bootIdleStage(page);
    await page.mouse.move(300, 400);
    await page.waitForTimeout(300);
    const worst = [];
    for (let i = 1; i <= 24; i += 1) {
      const x = 300 + i * 30;
      await page.mouse.move(x, 400);
      await page.waitForTimeout(16);
      worst.push(
        await page.evaluate((mx) => {
          const r = document.querySelector('.cursor').getBoundingClientRect();
          return Math.abs(r.left + r.width / 2 - mx);
        }, x)
      );
    }
    return worst.slice(6); // past the ease-in
  });
  const max = Math.max(...trail);
  // The pointer steps 30px between samples. A deliberate ease is the point,
  // so this is not "no lag" — it is "the lag ONE ease accounts for": 28.9px
  // measured as written, 81-96px with the CSS transition put back.
  assert.ok(max < 50, `the dot trailed the pointer by up to ${max.toFixed(1)}px`);
});
