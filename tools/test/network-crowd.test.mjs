import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });

async function wheelTo(page, sel, frac) {
  const dy = await page.evaluate(([s, f]) =>
    document.querySelector(s).getBoundingClientRect().top - innerHeight * f, [sel, frac]);
  for (let left = dy; Math.abs(left) > 1; ) {
    const step = Math.sign(left) * Math.min(Math.abs(left), 400);
    await page.mouse.wheel(0, step);
    left -= step;
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1500);
}

const readout = (page) => page.evaluate(() => document.querySelector('.netmap__city').textContent);

test('with motion off the network map is finished and still answers the list', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    const settled = await page.evaluate(() => ({
      pins: document.querySelectorAll('.netmap__net .netmap__pin').length,
      pinOpacity: [...document.querySelectorAll('.netmap__net .netmap__pin')].map((p) => getComputedStyle(p).opacity),
      arcs: [...document.querySelectorAll('.netmap__net .netmap__arc')].map((a) => parseFloat(getComputedStyle(a).strokeDashoffset)),
      open: getComputedStyle(document.querySelector('.netmap__lens')).getPropertyValue('--open').trim(),
      city: document.querySelector('.netmap__city').textContent,
      landInk: (() => {
        const c = document.querySelector('.netmap__land');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n;
      })(),
    }));
    // Keyboard: focusing a row selects that office on the map.
    await page.evaluate(() => [...document.querySelectorAll('.global__offices li')]
      .find((li) => li.textContent.includes('Sydney')).focus());
    await page.waitForTimeout(100);
    const afterFocus = await page.evaluate(() => ({
      city: document.querySelector('.netmap__city').textContent,
      active: [...document.querySelectorAll('.netmap__net .netmap__pin.is-active')].map((p) => p.dataset.i),
    }));
    return { settled, afterFocus };
  }, '?shot=1');
  assert.equal(r.settled.pins, 8, 'one pin per named office');
  assert.ok(r.settled.pinOpacity.every((o) => o === '1'), `pins not settled: ${r.settled.pinOpacity}`);
  assert.equal(r.settled.arcs.length, 7);
  assert.ok(r.settled.arcs.every((a) => a === 0), `arcs not drawn: ${r.settled.arcs}`);
  assert.equal(r.settled.open, '1.000', 'lens is not open');
  assert.equal(r.settled.city, 'Amsterdam');
  assert.ok(r.settled.landInk > 5000, `land barely drawn: ${r.settled.landInk} px`);
  assert.equal(r.afterFocus.city, 'Sydney');
  assert.deepEqual(r.afterFocus.active, ['6']);
});

test('scrolling reveals the network, then the readout cycles on its own', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '.netmap__stage', 0.95);
    const early = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.netmap__lens')).getPropertyValue('--open').trim());
    await wheelTo(page, '.netmap', 0.12);
    const first = await readout(page);
    await page.waitForTimeout(3400);
    const second = await readout(page);
    // Back up: the reveal is scrubbed, so it must un-draw.
    await wheelTo(page, '.netmap__stage', 1.05);
    const back = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.netmap__lens')).getPropertyValue('--open').trim());
    return { early, first, second, back };
  });
  assert.equal(r.early, '0.000', 'lens open before the reveal reached it');
  assert.notEqual(r.first, r.second, `readout did not advance: stayed on ${r.first}`);
  assert.equal(r.back, '0.000', 'scrolling back up did not close the lens');
});

test('the 1B+ cell: settled without motion, live with it', async () => {
  const off = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => ({
      toasts: document.querySelectorAll('.toasts .toast').length,
      fig: document.querySelector('.bento__figure[data-count-billion]').textContent,
    }));
  }, '?shot=1');
  assert.equal(off.toasts, 3);
  assert.equal(off.fig, '1B+');

  const on = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '.crowd', 0.45);
    await page.waitForTimeout(800);
    const front = () => page.evaluate(() =>
      document.querySelector('.toasts .toast[data-i="0"] b')?.textContent);
    const a = await front();
    await page.waitForTimeout(2900);
    const b = await front();
    return {
      a, b,
      fig: await page.evaluate(() => document.querySelector('.bento__figure[data-count-billion]').textContent),
      count: await page.evaluate(() => document.querySelectorAll('.toasts .toast').length),
    };
  });
  assert.equal(on.fig, '1B+', 'the figure did not land on its copy');
  assert.notEqual(on.a, on.b, 'the feed did not advance');
  assert.ok(on.count <= 4, `feed is leaking nodes: ${on.count}`);
});
