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
  await page.waitForTimeout(1600);
}

const state = (page) => page.evaluate(() => ({
  lit: [...document.querySelectorAll('.fork__points li')].map((li) => li.classList.contains('is-lit')),
  rows: [...document.querySelectorAll('.fork__points li')].map((li) => +getComputedStyle(li).opacity),
  seal: +getComputedStyle(document.querySelector('.aisle')).opacity,
  shift: new DOMMatrix(getComputedStyle(document.querySelector('.fork__panel--retail')).transform).m41,
  wires: document.querySelectorAll('.aisle__wire, .aisle__spine').length,
}));

test('with motion off the seal is set and every promise is present', async () => {
  const r = await withPage(async (page) => { await boot(page); return state(page); }, '?shot=1');
  assert.equal(r.lit.length, 6);
  assert.ok(r.lit.every(Boolean), `unlit promises: ${r.lit}`);
  assert.ok(r.rows.every((o) => o === 1));
  assert.equal(r.seal, 1);
  assert.equal(r.shift, 0);
  assert.equal(r.wires, 0, 'the wire diagram is back');
});

test('the seal sits on the seam where the photos meet the copy', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const seal = document.querySelector('.aisle').getBoundingClientRect();
      const img = document.querySelector('.fork__panel--retail .fork__img').getBoundingClientRect();
      const l = document.querySelector('.fork__panel--retail').getBoundingClientRect();
      const rt = document.querySelector('.fork__panel--brand').getBoundingClientRect();
      return { dy: seal.top + seal.height / 2 - img.bottom, dx: seal.left + seal.width / 2 - (l.right + rt.left) / 2 };
    });
  }, '?shot=1');
  assert.ok(Math.abs(r.dy) < 2, `seal is ${r.dy}px off the seam vertically`);
  assert.ok(Math.abs(r.dx) < 2, `seal is ${r.dx}px off the seam horizontally`);
});

test('scrolling parts the panels, sets the seal, lets the promises out, and reverses', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '.fork__grid', 0.8);
    const closed = await state(page);
    await wheelTo(page, '.fork__points', 0.35);
    const open = await state(page);
    await wheelTo(page, '.fork__grid', 0.95);
    const back = await state(page);
    return { closed, open, back };
  });
  assert.ok(r.closed.shift > 10, `panels did not start closed together: ${r.closed.shift}px`);
  assert.ok(r.closed.lit.every((l) => !l), 'promises out before the panels parted');
  assert.ok(Math.abs(r.open.shift) < 0.5, `panels did not part fully: ${r.open.shift}px`);
  assert.ok(r.open.seal > 0.99, 'the seal never set');
  assert.ok(r.open.lit.every(Boolean), `not every promise arrived: ${r.open.lit}`);
  assert.ok(r.back.lit.every((l) => !l), 'scrolling back up left promises out');
});

test('narrow screens stack the panels with no aisle and no overflow', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => ({
      aisle: getComputedStyle(document.querySelector('.aisle')).display,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
  }, '', { viewport: { width: 390, height: 844 } });
  assert.equal(r.aisle, 'none');
  assert.equal(r.overflow, 0);
});
