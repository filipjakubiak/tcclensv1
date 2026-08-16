import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });

/**
 * The places the page answers the reader rather than the scrollbar.
 *
 * All of it is gated on a fine pointer AND motionEnabled(), so the ?shot=1
 * and reduced-motion cases assert the ABSENCE of the behaviour just as
 * deliberately as the live case asserts its presence.
 */

test('the mark leans toward the pointer, within bounds', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.waitForTimeout(600);
    const read = () =>
      page.evaluate(() => ({
        x: window.__tccLens.pointer.rotation.x,
        y: window.__tccLens.pointer.rotation.y,
      }));

    // Settle at each corner: the response eases toward its target, so one
    // pointermove samples it mid-travel.
    const settle = async (x, y) => {
      for (let i = 0; i < 40; i += 1) {
        await page.mouse.move(x, y);
        await page.waitForTimeout(16);
      }
      return read();
    };
    return { tl: await settle(80, 80), br: await settle(1360, 820) };
  });

  // Opposite corners must lean opposite ways on both axes.
  assert.ok(r.tl.y < 0 && r.br.y > 0, `no horizontal lean: ${r.tl.y.toFixed(3)} -> ${r.br.y.toFixed(3)}`);
  assert.ok(r.tl.x < 0 && r.br.x > 0, `no vertical lean: ${r.tl.x.toFixed(3)} -> ${r.br.x.toFixed(3)}`);

  // BOUNDED, not merely "it moved" — this codebase has shipped a per-frame
  // updater that accumulated instead of oscillating and ran away past a test
  // that only checked for change. These are the constants in interact.js.
  for (const s of [r.tl, r.br]) {
    assert.ok(Math.abs(s.y) <= 0.16 + 1e-3, `horizontal lean ran past its clamp: ${s.y}`);
    assert.ok(Math.abs(s.x) <= 0.10 + 1e-3, `vertical lean ran past its clamp: ${s.x}`);
  }
});

test('the pointer lean lives above the group acts drive, so nothing overwrites it', async () => {
  // The failure this guards is structural: acts assign to lens.group every
  // frame, so a lean written there would be gone by the next update. It has
  // to be a separate group ABOVE it.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const l = window.__tccLens;
      return {
        separate: l.pointer !== l.group,
        isParent: l.group.parent === l.pointer,
        inScene: l.pointer.parent === window.__tccStage.scene,
      };
    });
  });
  assert.equal(r.separate, true, 'lens.pointer and lens.group are the same object');
  assert.equal(r.isParent, true, 'lens.pointer is not the parent of lens.group');
  assert.equal(r.inScene, true, 'lens.pointer is not the group attached to the scene');
});

test('an act driving lens.group cannot disturb the pointer lean', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const l = window.__tccLens, d = window.__tccDirector;
      l.pointer.rotation.set(0.07, 0.09, 0);
      // Drive every act across its whole range.
      for (const act of d.acts) {
        for (const t of [0, 0.3, 0.6, 0.9]) setLocal(d, act.id, t);
      }
      return { x: l.pointer.rotation.x, y: l.pointer.rotation.y };
    });
  });
  assert.ok(Math.abs(r.x - 0.07) < 1e-9 && Math.abs(r.y - 0.09) < 1e-9,
    `an act wrote to lens.pointer: ${r.x}, ${r.y}`);
});

test('the custom dot replaces the system cursor, and only when it exists', async () => {
  const live = await withPage(async (page) => {
    await page.waitForTimeout(500);
    return page.evaluate(() => ({
      flagged: document.documentElement.classList.contains('cursor-live'),
      dot: !!document.querySelector('.cursor'),
      onLink: getComputedStyle(document.querySelector('.nav__links .link')).cursor,
      onBody: getComputedStyle(document.body).cursor,
    }));
  });
  assert.equal(live.dot, true, 'no custom cursor mounted');
  assert.equal(live.flagged, true, 'cursor-live was not set');
  // Descendants matter: links carry their own `pointer`, so hiding it only on
  // <html> brings the arrow back the moment you touch one.
  assert.equal(live.onBody, 'none');
  assert.equal(live.onLink, 'none');

  const shot = await withPage(async (page) => {
    await page.waitForTimeout(500);
    return page.evaluate(() => ({
      flagged: document.documentElement.classList.contains('cursor-live'),
      dot: !!document.querySelector('.cursor'),
      onBody: getComputedStyle(document.body).cursor,
    }));
  }, '/?shot=1');
  assert.equal(shot.dot, false, 'a cursor dot mounted under ?shot=1');
  assert.equal(shot.flagged, false, 'cursor-live set with no dot to replace the pointer');
  assert.notEqual(shot.onBody, 'none', 'the system cursor was hidden with no replacement');
});

test('the nav reports read progress, with motion on or off', async () => {
  const read = (query) =>
    withPage(async (page) => {
      await page.waitForTimeout(500);
      const at = () =>
        page.evaluate(() =>
          Number(getComputedStyle(document.querySelector('.nav__progress')).getPropertyValue('--read'))
        );
      const top = await at();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(400);
      return { top, bottom: await at() };
    }, query);

  for (const [label, query] of [['live', ''], ['shot', '/?shot=1']]) {
    const r = await read(query);
    assert.ok(r.top < 0.02, `${label}: progress should start at 0, got ${r.top}`);
    assert.ok(r.bottom > 0.95, `${label}: progress should reach the end, got ${r.bottom}`);
  }
});

test('the offices rows are reachable and respond to the keyboard', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const rows = [...document.querySelectorAll('.global__offices li')];
      const first = rows[0];
      first.focus();
      return {
        count: rows.length,
        allFocusable: rows.every((el) => el.getAttribute('tabindex') === '0'),
        focused: document.activeElement === first,
        // The response is CSS on :focus/:focus-within, so what matters is
        // that the element can actually hold focus to trigger it.
        rule: getComputedStyle(first, '::before').backgroundImage,
      };
    });
  });
  assert.ok(r.count >= 8, `only ${r.count} office rows`);
  assert.equal(r.allFocusable, true, 'office rows are not keyboard reachable');
  assert.equal(r.focused, true, 'an office row could not take focus');
  assert.ok(/gradient/.test(r.rule), `the focused row did not take the gradient rule: ${r.rule}`);
});

test('the marquee slows under the pointer without jumping', async () => {
  // The jump is the point of this test. The first version of the slow-down
  // swapped animation-duration from 38s to 150s, and changing duration
  // mid-play recomputes progress against the NEW duration — the band snapped
  // 209.7px backwards the instant the pointer arrived. GSAP's timeScale
  // rescales the playhead instead, so position is preserved.
  const r = await withPage(async (page) => {
    await boot(page);
    await page.evaluate(() => {
      const s = document.getElementById('clients');
      window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY);
    });
    // Let it travel, so a snap-to-recomputed-progress would be large.
    await page.waitForTimeout(2500);

    // Sampled INSIDE the page on a fixed interval. Measuring across a
    // Playwright round trip cannot tell a snap from ordinary travel: the band
    // moves ~1.6px/ms, so the latency of page.hover() alone reads as a
    // 200px+ "jump" even when the motion is perfectly smooth. That false
    // positive is what this comment exists to stop someone rediscovering.
    // Sampled on requestAnimationFrame, NOT setInterval. Under the WebGL
    // stage a 25ms interval is throttled to ~125ms, and at ~1.6px/ms the
    // band travels ~200px between those samples — exactly the size of the
    // snap being looked for, so the instrument could not resolve its own
    // subject. rAF is the render loop, so one sample is one painted frame.
    // ONE continuous recording with timestamps, segmented by time afterwards.
    // Restarting the recorder mid-test proved unreliable — the second run
    // captured three frames.
    await page.evaluate(() => {
      window.__s = [];
      window.__on = true;
      const t = document.querySelector('.marquee__track');
      const step = () => {
        if (!window.__on) return;
        window.__s.push([performance.now(), new DOMMatrixReadOnly(getComputedStyle(t).transform).m41]);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    // Windows are generous because headless renders at roughly 8fps with the
    // WebGL stage up: a 600ms segment yielded two frames.
    const mark = () => page.evaluate(() => performance.now());
    await page.waitForTimeout(1600);
    const tHover = await mark();
    await page.hover('.marquee');
    await page.waitForTimeout(2600);
    const tLeave = await mark();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(1200);

    const s = await page.evaluate(() => { window.__on = false; return window.__s; });
    return { s, tHover, tLeave };
  });

  // Travel per MILLISECOND, so a dropped frame does not read as a snap.
  const rate = [];
  const signed = [];
  for (let i = 1; i < r.s.length; i += 1) {
    const dt = r.s[i][0] - r.s[i - 1][0];
    const dx = r.s[i][1] - r.s[i - 1][1];
    if (dt > 0) {
      rate.push({ t: r.s[i][0], v: Math.abs(dx) / dt });
      signed.push(dx);
    }
  }
  // Headless with the WebGL stage running renders at roughly 8fps, so a few
  // dozen frames across three seconds is all there is to work with.
  assert.ok(rate.length > 20, `only ${rate.length} frames recorded`);

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const free = rate.filter((f) => f.t < r.tHover).map((f) => f.v);
  // Only the settled part of the hover: the first ~600ms is the speed ramp.
  const slow = rate.filter((f) => f.t > r.tLeave - 1600 && f.t < r.tLeave).map((f) => f.v);
  assert.ok(free.length > 3 && slow.length > 3, `thin segments: ${free.length} free / ${slow.length} slow`);

  const cruise = mean(free);
  assert.ok(cruise > 0.4, `the marquee is barely moving: ${cruise.toFixed(3)} px/ms`);
  assert.ok(
    mean(slow) < cruise * 0.6,
    `the marquee did not slow under the pointer: ${mean(slow).toFixed(3)} vs ${cruise.toFixed(3)} px/ms`
  );

  // DIRECTION, not magnitude — this is the assertion that actually holds at
  // 8fps. Both real defects moved the band BACKWARDS (the CSS one by a
  // measured 209.7px), and travel is strictly leftward, so any positive step
  // is a snap. Magnitude cannot work here: at this frame rate ordinary travel
  // between two frames is the same size as the snap being looked for, which
  // is what defeated two earlier versions of this test.
  //
  // The one legitimate positive step is the cycle wrap, which adds a full
  // 50% of the track — thousands of pixels, nothing like a snap.
  const backwards = signed.filter((dx) => dx > 1 && dx < 1000);
  assert.deepEqual(
    backwards.map((d) => +d.toFixed(1)),
    [],
    'the marquee moved backwards — the position was recomputed rather than integrated'
  );
});

test('the marquee keeps a CSS fallback when JS never takes over', async () => {
  // The keyframe is the no-JS path. It must still be the declared animation
  // until initMarquee actually replaces it, or a JS failure leaves a static
  // row of logos.
  const r = await withPage(async (page) => {
    await page.waitForTimeout(500);
    return page.evaluate(() => ({
      handedOver: document.documentElement.classList.contains('marquee-js'),
      declared: getComputedStyle(document.querySelector('.marquee__track')).animationName,
    }));
  }, '/?shot=1');
  // ?shot=1 disables motion, so GSAP never takes the loop and the CSS
  // keyframe is what remains — reduced motion then stops it separately.
  assert.equal(r.handedOver, false, 'GSAP took the marquee under ?shot=1');
  assert.equal(r.declared, 'marquee', 'the CSS fallback animation is gone');
});
