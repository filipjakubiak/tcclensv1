import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });

// Scroll the way a reader does — wheel steps through Lenis — so the
// ScrollTriggers run for real rather than being handed a progress value.
async function wheelTo(page, sel, frac) {
  const dy = await page.evaluate(([s, f]) =>
    document.querySelector(s).getBoundingClientRect().top - innerHeight * f, [sel, frac]);
  for (let left = dy; Math.abs(left) > 1; ) {
    const step = Math.sign(left) * Math.min(Math.abs(left), 400);
    await page.mouse.wheel(0, step);
    left -= step;
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1600);
}

test('with motion off every scroll story renders finished', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const cs = (sel, prop) => getComputedStyle(document.querySelector(sel)).getPropertyValue(prop).trim();
      return {
        hl: [...document.querySelectorAll('.hl')].map((el) => getComputedStyle(el).backgroundSize),
        fwd: cs('.loop__fwd', 'stroke-dashoffset'),
        ret: cs('.loop__ret', 'stroke-dashoffset'),
        line: cs('.uplift__line', 'stroke-dashoffset'),
        gap: cs('.monitor__gap', 'transform'),
        figure: document.querySelector('.bento__figure[data-range]').textContent,
      };
    });
  }, '?shot=1');
  assert.equal(r.hl.length, 2);
  for (const s of r.hl) assert.match(s, /^100%/, `underline parked at ${s}`);
  assert.ok(parseFloat(r.fwd) === 0 && parseFloat(r.ret) === 0, `loop not drawn: ${r.fwd} / ${r.ret}`);
  assert.equal(parseFloat(r.line), 0, 'uplift line not drawn');
  assert.ok(r.gap === 'none' || r.gap === 'matrix(1, 0, 0, 1, 0, 0)', `gap parked at ${r.gap}`);
  assert.equal(r.figure, '3–5%');
});

test('scrolling through the loop walks all three steps and closes it', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(700, 450);
    await wheelTo(page, '.howworks__loop', 0.55);
    const mid = await page.evaluate(() =>
      [...document.querySelectorAll('.howworks__step')].map((s) => s.classList.contains('is-lit')));
    await wheelTo(page, '.howworks__steps', 0.1);
    const end = await page.evaluate(() => ({
      lit: [...document.querySelectorAll('.howworks__step')].map((s) => s.classList.contains('is-lit')),
      lap: document.querySelector('.loop__node').classList.contains('is-lap'),
      fwd: parseFloat(getComputedStyle(document.querySelector('.loop__fwd')).strokeDashoffset),
      ret: parseFloat(getComputedStyle(document.querySelector('.loop__ret')).strokeDashoffset),
    }));
    // And back up: scrub must reverse, not latch.
    await wheelTo(page, '.howworks__loop', 1.1);
    const back = await page.evaluate(() =>
      [...document.querySelectorAll('.howworks__step')].map((s) => s.classList.contains('is-lit')));
    return { mid, end, back };
  });
  assert.equal(r.mid[0], true, 'the first step was not lit mid-scroll');
  assert.ok(r.mid.includes(false), `every step lit already mid-scroll: ${r.mid}`);
  assert.deepEqual(r.end.lit, [true, true, true]);
  assert.equal(r.end.lap, true, 'the loop did not come back round');
  assert.ok(r.end.fwd < 0.01 && r.end.ret < 0.01, `loop not closed: ${r.end.fwd} / ${r.end.ret}`);
  assert.deepEqual(r.back, [false, false, false], `scrolling back up left steps lit: ${r.back}`);
});

test('the uplift figure lands on its exact copy', async () => {
  const fig = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(700, 450);
    await wheelTo(page, '.uplift', 0.5);
    await page.waitForTimeout(1200);
    return page.evaluate(() => document.querySelector('.bento__figure[data-range]').textContent);
  });
  assert.equal(fig, '3–5%');
});
