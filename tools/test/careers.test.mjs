import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

/**
 * #careers motion — the photograph resolving and drifting in its frame, and
 * the four value rules drawing in turn.
 */

/** Scroll to a fraction of the way through a section and let ScrollTrigger catch up. */
const scrollThrough = async (page, frac) => {
  await page.evaluate((f) => {
    const s = document.getElementById('careers');
    const r = s.getBoundingClientRect();
    const top = r.top + window.scrollY;
    // From the section entering the bottom of the viewport to it leaving the
    // top — the same span the drift's ScrollTrigger uses.
    const start = top - window.innerHeight;
    const end = top + r.height;
    window.scrollTo(0, start + (end - start) * f);
    window.ScrollTrigger?.update();
  }, frac);
  await page.waitForTimeout(260);
};

/**
 * How far each value's rule is drawn, read off the PAINTED pseudo-element.
 *
 * Reading --rule-s with getPropertyValue looks equivalent and is not: when the
 * property is unset the rule renders at its scaleX(...,1) fallback — fully
 * drawn — but getPropertyValue returns '', which Number() turns into 0. That
 * reads a correctly drawn rule as a retracted one. The transform matrix is
 * what is actually on screen.
 */
const ruleScales = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.careers__values .value')].map((el) => {
      const t = getComputedStyle(el, '::before').transform;
      if (!t || t === 'none') return 1;
      return Number(t.match(/matrix\(([^,]+)/)?.[1] ?? 1);
    })
  );

/** Blur radius in px, 0 when the element is sharp. */
const blurOf = (filter) =>
  filter === 'none' ? 0 : Number(filter.match(/blur\(([\d.]+)px\)/)?.[1] ?? 0);

const frames = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('.careers__img');
    const img = card.querySelector('img');
    const c = card.getBoundingClientRect();
    const i = img.getBoundingClientRect();
    return {
      card: { top: c.top, bottom: c.bottom, height: c.height },
      img: { top: i.top, bottom: i.bottom, height: i.height },
      opacity: getComputedStyle(card).opacity,
      filter: getComputedStyle(card).filter,
    };
  });

test('the careers photo drifts inside its frame without ever exposing it', async () => {
  // The failure mode is a sliver of card background along one edge when the
  // drift travels further than the image overhangs. Asserted as a BOUND at
  // every sampled position rather than "the image moved" — an earlier act in
  // this build shipped a runaway animation past a test that only checked for
  // change.
  const samples = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });
    const out = [];
    for (const f of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1]) {
      await scrollThrough(page, f);
      out.push({ f, ...(await frames(page)) });
    }
    return out;
  });

  const tol = 0.6; // sub-pixel rounding on fractional layout
  for (const s of samples) {
    assert.ok(
      s.img.top <= s.card.top + tol,
      `at ${s.f} the frame shows above the photo by ${(s.img.top - s.card.top).toFixed(2)}px`
    );
    assert.ok(
      s.img.bottom >= s.card.bottom - tol,
      `at ${s.f} the frame shows below the photo by ${(s.card.bottom - s.img.bottom).toFixed(2)}px`
    );
  }

  // And it does move — checked after the bound, never instead of it.
  const offsets = samples.map((s) => s.img.top - s.card.top);
  const travel = Math.max(...offsets) - Math.min(...offsets);
  assert.ok(travel > 4, `the photo barely drifts: ${travel.toFixed(2)}px of travel`);
});

test('the careers photo settles sharp and opaque once it has arrived', async () => {
  const s = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });
    await scrollThrough(page, 0.5);
    await page.waitForTimeout(1400); // the entrance is 0.85s
    return frames(page);
  });
  assert.equal(s.opacity, '1');
  assert.ok(blurOf(s.filter) < 0.5, `the photo is still out of focus after arriving: ${s.filter}`);
});

test('the four value rules draw in', async () => {
  const r = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });
    // Before the section is anywhere near view.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const before = await ruleScales(page);
    await scrollThrough(page, 0.55);
    await page.waitForTimeout(1600); // 0.7s each plus 0.12s stagger across four
    return { before, after: await ruleScales(page) };
  });

  assert.equal(r.before.length, 4, 'expected four values in #careers');
  assert.ok(r.before.every((v) => v === 0), `rules should start retracted, got ${r.before}`);
  assert.ok(r.after.every((v) => v === 1), `rules should finish drawn, got ${r.after}`);
});

test('?shot=1 leaves careers settled — rules drawn, photo sharp, no drift', async () => {
  const r = await withPage(async (page) => {
    await page.waitForTimeout(500);
    await scrollThrough(page, 0.2);
    const a = await frames(page);
    await scrollThrough(page, 0.9);
    const b = await frames(page);
    return { a, b, rules: await ruleScales(page) };
  }, '/?shot=1');

  assert.ok(r.rules.every((v) => v === 1), `rules must be drawn with motion off, got ${r.rules}`);
  assert.equal(r.a.opacity, '1');
  assert.ok(blurOf(r.a.filter) < 0.5, `blurred under ?shot=1: ${r.a.filter}`);
  // Zero drift, not "less drift" — the screenshot hook has to be reproducible.
  const drift = Math.abs((r.a.img.top - r.a.card.top) - (r.b.img.top - r.b.card.top));
  assert.ok(drift < 0.5, `the photo drifted ${drift.toFixed(2)}px under ?shot=1`);
  // Still covering the frame with no transform at all.
  assert.ok(r.a.img.top <= r.a.card.top + 0.6 && r.a.img.bottom >= r.a.card.bottom - 0.6,
    'the photo does not cover its frame at rest');
});
