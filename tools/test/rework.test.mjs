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

test('with motion off every reworked section shows its finished state', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => ({
      deal: [...document.querySelectorAll('.howworks__step')].map((s) => getComputedStyle(s).transform),
      nums: [...document.querySelectorAll('.monitor__count')].map((n) => n.textContent),
      fill: getComputedStyle(document.querySelector('.monitor__fill')).transform,
      bracket: getComputedStyle(document.querySelector('.gauge__bracket')).opacity,
      cards: [...document.querySelectorAll('.collectible__card')].map((c) => getComputedStyle(c).transform),
      figures: [...document.querySelectorAll('#global .gstat__num')].map((b) => b.textContent),
      valuesList: getComputedStyle(document.querySelector('.careers__values')).display,
      roller: document.querySelectorAll('.values').length,
    }));
  }, '?shot=1');
  assert.ok(r.deal.every((t) => t === 'none'), `cards not in their slots: ${r.deal}`);
  assert.deepEqual(r.nums, ['57%', '76%']);
  assert.ok(r.fill === 'none' || r.fill === 'matrix(1, 0, 0, 1, 0, 0)', `bar not full: ${r.fill}`);
  assert.equal(r.bracket, '1');
  assert.equal(r.cards.length, 11);
  // Face up: rotateY(0) resolves to an identity 3D matrix, or none.
  assert.ok(r.cards.every((t) => t === 'none' || /^matrix(3d)?\(1, 0, 0/.test(t)), `a card is face down: ${r.cards[0]}`);
  assert.deepEqual(r.figures, ['20', '300']);
  assert.notEqual(r.valuesList, 'none', 'the plain values list is gone without motion');
  assert.equal(r.roller, 0, 'the roller was built without motion');
});

test('the spend / reward / return cards are dealt in from the left', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '.howworks__steps', 1.02);
    const start = await page.evaluate(() => [...document.querySelectorAll('.howworks__step')]
      .map((s) => new DOMMatrix(getComputedStyle(s).transform).m41));
    await wheelTo(page, '.howworks__steps', 0.2);
    const end = await page.evaluate(() => [...document.querySelectorAll('.howworks__step')]
      .map((s) => new DOMMatrix(getComputedStyle(s).transform).m41));
    return { start, end };
  });
  assert.ok(r.start.every((x) => x < -100), `cards did not start off to the left: ${r.start}`);
  assert.ok(r.start[2] < r.start[0], 'Return should have furthest to travel');
  assert.ok(r.end.every((x) => Math.abs(x) < 0.5), `cards did not land in their slots: ${r.end}`);
});

test('the gauge: both figures climb together, then 76 pulls away', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    const read = () => page.evaluate(() => ({
      a: parseInt(document.querySelector('.monitor__state--a .monitor__count').textContent, 10),
      b: parseInt(document.querySelector('.monitor__state--b .monitor__count').textContent, 10),
      live: document.querySelector('.gauge').classList.contains('is-live'),
    }));
    await wheelTo(page, '.gauge', 0.85);
    const start = await read();
    await wheelTo(page, '.gauge', 0.1);
    const end = await read();
    return { start, end };
  });
  assert.ok(r.start.a < 20 && r.start.b < 20, `figures started high: ${JSON.stringify(r.start)}`);
  assert.equal(r.end.a, 57);
  assert.equal(r.end.b, 76);
  assert.equal(r.end.live, true, 'the gap never went live');
});

test('the brand partners are dealt face down and turn over', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    const flipped = () => page.evaluate(() => document.querySelector('.collect').classList.contains('is-dealt'));
    await wheelTo(page, '.collect', 1.1);
    const before = await flipped();
    await wheelTo(page, '.collect', 0.4);
    await page.waitForTimeout(1500);
    const after = await flipped();
    const lazy = await page.evaluate(() => [...document.querySelectorAll('.collect img')].every((i) => i.loading === 'lazy' && i.alt));
    return { before, after, lazy };
  });
  assert.equal(r.before, false);
  assert.equal(r.after, true);
  assert.equal(r.lazy, true);
});

test('the values roller plays like story segments and answers the keyboard', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '.values', 0.45);
    const word = () => page.evaluate(() => document.querySelector('.values__letters').textContent);
    const first = await word();
    await page.waitForTimeout(3900);
    const second = await word();
    // Keyboard: focus the selected tab, then ArrowRight.
    await page.focus('.values__tab[aria-selected="true"]');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(900);
    const keyed = await page.evaluate(() => ({
      word: document.querySelector('.values__letters').textContent,
      selected: document.querySelector('.values__tab[aria-selected="true"] .values__name').textContent,
      focused: document.activeElement?.classList.contains('values__tab'),
    }));
    return { first, second, keyed };
  });
  assert.equal(r.first, 'Respect');
  assert.equal(r.second, 'Collaboration');
  assert.equal(r.keyed.selected, 'Care');
  assert.equal(r.keyed.word, 'Care');
  assert.equal(r.keyed.focused, true);
});

test('build your programme: choices light the fitting capabilities', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    const lit = () => page.evaluate(() => [...document.querySelectorAll('.planner__cap.is-in')].map((c) => c.dataset.cap));
    const sum = () => page.evaluate(() => document.querySelector('.planner__summary').textContent);
    const start = { lit: await lit(), sum: await sum() };
    await page.click('.planner__chip[data-goal="baskets"]');
    const two = { lit: await lit(), sum: await sum() };
    await page.click('.planner__opt[data-who="brand"]');
    await page.click('.planner__chip[data-goal="goodwill"]');
    const brand = { lit: await lit(), sum: await sum() };
    // The last goal cannot be switched off.
    await page.click('.planner__chip[data-goal="placement"]');
    await page.click('.planner__chip[data-goal="goodwill"]');
    const last = await page.evaluate(() => document.querySelector('.planner__chip[data-goal="goodwill"]').getAttribute('aria-pressed'));
    return { start, two, brand, last };
  }, '?shot=1');
  assert.deepEqual(r.start.lit, ['quest', 'games']);
  assert.equal(r.start.sum, 'For retailers who want more visits.');
  assert.deepEqual(r.two.lit, ['quest', 'world', 'games']);
  assert.equal(r.two.sum, 'For retailers who want more visits and bigger baskets.');
  assert.deepEqual(r.brand.lit, ['games', 'mobile', 'community']);
  assert.equal(r.brand.sum, 'For brands who want premium placement and genuine goodwill.');
  assert.equal(r.last, 'true', 'the last goal was switched off');
});
