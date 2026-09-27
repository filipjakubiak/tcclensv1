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
  wires: [...document.querySelectorAll('.aisle__wire')].map((w) => parseFloat(getComputedStyle(w).strokeDashoffset)),
  shift: new DOMMatrix(getComputedStyle(document.querySelector('.fork__panel--retail')).transform).m41,
}));

test('with motion off the aisle is wired and every promise is lit', async () => {
  const r = await withPage(async (page) => { await boot(page); return state(page); }, '?shot=1');
  assert.equal(r.lit.length, 6);
  assert.ok(r.lit.every(Boolean), `unlit promises: ${r.lit}`);
  assert.equal(r.wires.length, 6);
  assert.ok(r.wires.every((w) => w === 0), `wires not drawn: ${r.wires}`);
  assert.equal(r.shift, 0);
});

test('the wires land on the bullets, not on the panel edge', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const grid = document.querySelector('.fork__grid').getBoundingClientRect();
      return [...document.querySelectorAll('.aisle__wire')].map((w) => {
        const end = w.getPointAtLength(w.getTotalLength());
        // The nearest bullet to where this wire ends, in page pixels.
        const d = Math.min(...[...document.querySelectorAll('.fork__points li')].map((li) => {
          const b = li.getBoundingClientRect();
          // Retail promises face the aisle, so their bullet is on the right.
          const x = li.closest('.fork__panel--retail') ? b.right - 4 : b.left + 4;
          return Math.hypot(grid.left + end.x - x, grid.top + end.y - (b.top + parseFloat(getComputedStyle(li).fontSize) * 0.5 + 4));
        }));
        return d;
      });
    });
  }, '?shot=1');
  assert.ok(r.every((d) => d < 6), `wires miss their bullets by ${r.map((d) => d.toFixed(1))}px`);
});

test('scrolling parts the panels, wires the aisle, and reverses', async () => {
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
  assert.ok(r.closed.lit.every((l) => !l), 'promises lit before their wires');
  assert.ok(Math.abs(r.open.shift) < 0.5, `panels did not part fully: ${r.open.shift}px`);
  assert.ok(r.open.lit.every(Boolean), `not every promise lit: ${r.open.lit}`);
  assert.ok(r.back.lit.every((l) => !l), 'scrolling back up left promises lit');
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
