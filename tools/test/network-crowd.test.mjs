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

const activeTile = (page) => page.evaluate(() => document.querySelector('.tile.is-active')?.dataset.office);
const inkOf = (page) => page.evaluate(() => {
  const c = document.querySelector('.orbit__globe canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});

test('with motion off the globe is drawn, the tiles are there, and a tile still turns it', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    const before = await page.evaluate(() => ({
      tiles: document.querySelectorAll('.orbit__tiles .tile').length,
      tileOpacity: [...document.querySelectorAll('.orbit__tiles li')].map((li) => getComputedStyle(li).opacity),
      active: document.querySelector('.tile.is-active')?.dataset.office,
    }));
    const ink = await inkOf(page);
    const snap = () => page.evaluate(() => document.querySelector('.orbit__globe canvas').toDataURL());
    const a = await snap();
    await page.focus('.tile[data-office="syd"]');
    await page.waitForTimeout(150);
    const b = await snap();
    return { before, ink, turned: a !== b, active: await activeTile(page) };
  }, '?shot=1');
  assert.equal(r.before.tiles, 8);
  assert.ok(r.before.tileOpacity.every((o) => o === '1'), `tiles hidden: ${r.before.tileOpacity}`);
  assert.equal(r.before.active, 'ams');
  assert.ok(r.ink > 20000, `globe barely drawn: ${r.ink} px`);
  assert.equal(r.active, 'syd');
  assert.ok(r.turned, 'focusing Sydney did not redraw the globe');
});

test('scrolling forms the globe and brings the tiles in; then it tours the offices', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '.orbit__globe', 0.95);
    const early = await page.evaluate(() => document.querySelector('.orbit').classList.contains('is-in'));
    await wheelTo(page, '.orbit', 0.1);
    const settled = await page.evaluate(() => document.querySelector('.orbit').className);
    const first = await activeTile(page);
    await page.waitForTimeout(4200);
    const second = await activeTile(page);
    await wheelTo(page, '.orbit__globe', 1.05);
    const back = await page.evaluate(() => document.querySelector('.orbit').classList.contains('is-in'));
    return { early, settled, first, second, back };
  });
  assert.equal(r.early, false, 'tiles arrived before the globe formed');
  assert.match(r.settled, /is-in/);
  assert.match(r.settled, /is-settled/);
  assert.notEqual(r.first, r.second, `the tour did not advance from ${r.first}`);
  assert.equal(r.back, false, 'scrolling back up did not withdraw the tiles');
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
