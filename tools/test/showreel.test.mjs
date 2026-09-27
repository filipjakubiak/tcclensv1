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

test('kinetic headlines split into letters, land, and give back the original markup', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    const sel = '#capabilities .heading';
    const before = await page.evaluate((s) => {
      const h = document.querySelector(s);
      return { kinetic: h.classList.contains('is-kinetic'), letters: h.querySelectorAll('.kc').length, label: h.getAttribute('aria-label') };
    }, sel);
    await page.mouse.move(10, 10);
    await wheelTo(page, sel, 0.5);
    await page.waitForTimeout(1500);
    const after = await page.evaluate((s) => {
      const h = document.querySelector(s);
      return {
        kinetic: h.classList.contains('is-kinetic'), letters: h.querySelectorAll('.kc').length,
        label: h.getAttribute('aria-label'), html: h.querySelector('.line:last-child > span').innerHTML,
      };
    }, sel);
    return { before, after };
  });
  assert.equal(r.before.kinetic, true);
  assert.ok(r.before.letters > 20, `only ${r.before.letters} letters`);
  assert.equal(r.before.label, 'A complete toolkit for modern loyalty.');
  assert.equal(r.after.kinetic, false, 'the split was never restored');
  assert.equal(r.after.letters, 0);
  assert.equal(r.after.label, null);
  assert.equal(r.after.html, 'for modern <span class="focus-word">loyalty.</span>');
});

test('with motion off the headlines are never split and every clip shows its finished frame', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => ({
      split: document.querySelectorAll('.kc').length,
      quest: getComputedStyle(document.querySelector('.quest__done')).strokeDashoffset,
      disc: getComputedStyle(document.querySelector('.games__disc')).transform,
      world: document.querySelector('.world__pts b').textContent,
      offers: [...document.querySelectorAll('.world__offer')].map((o) => getComputedStyle(o).opacity),
      phoneBack: getComputedStyle(document.querySelector('.phone__back')).transform,
      film: getComputedStyle(document.querySelector('.film__frame')).clipPath,
      band: getComputedStyle(document.querySelector('.band__row')).transform,
    }));
  }, '?shot=1');
  assert.equal(r.split, 0);
  assert.equal(parseFloat(r.quest), 0.25);
  assert.notEqual(r.disc, 'none', 'the wheel is not at its landed angle');
  assert.equal(r.world, '2,460');
  assert.ok(r.offers.every((o) => o === '1'));
  assert.ok(r.phoneBack === 'none' || /matrix/.test(r.phoneBack));
  assert.equal(r.film, 'none');
  assert.equal(r.band, 'none');
});

test('a clip plays when it arrives, counts to its figure, and resets when it leaves', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '#capabilities .capability:nth-child(2)', 0.2);
    await page.waitForTimeout(2600);
    const on = await page.evaluate(() => {
      const c = document.querySelector('#capabilities .capability:nth-child(2)');
      return { on: c.classList.contains('is-on'), pts: c.querySelector('.world__pts b').textContent };
    });
    await wheelTo(page, '#capabilities', 1.2);
    const off = await page.evaluate(() => {
      const c = document.querySelector('#capabilities .capability:nth-child(2)');
      return { on: c.classList.contains('is-on'), pts: c.querySelector('.world__pts b').textContent };
    });
    return { on, off };
  });
  assert.equal(r.on.on, true, 'the clip did not play on arrival');
  assert.equal(r.on.pts, '2,460');
  assert.equal(r.off.on, false, 'the clip kept playing after it left');
  assert.equal(r.off.pts, '1,980', 'the counter did not reset for the next play');
});

test('the film iris opens as the frame rises', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    const iris = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.film__frame')).getPropertyValue('--iris')));
    await wheelTo(page, '.film__frame', 0.97);
    const early = await iris();
    await wheelTo(page, '.film__frame', 0.1);
    return { early, late: await iris() };
  });
  assert.ok(r.early < 30, `iris already open: ${r.early}%`);
  assert.ok(r.late > 70, `iris did not open: ${r.late}%`);
});
