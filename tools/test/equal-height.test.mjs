import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

/**
 * Cells in a row must be the same height (user, 2026-08-16, twice).
 *
 * Two different causes, both of which looked like "the boxes are uneven":
 *
 * - #how-it-works staggered its three steps with margin-top. All three share
 *   one grid row, so each stretched to the row height MINUS its own margin —
 *   three margins, three heights. The stagger is a transform now (--step-y),
 *   which does not participate in layout.
 * - #insights used align-items:start, so each card was only as tall as its
 *   own copy, and the three carry different amounts of it.
 *
 * Checked at several widths because both faults are layout-mode dependent and
 * a single viewport would have missed the breakpoint behaviour entirely.
 */
const WIDTHS = [1600, 1440, 1280, 1100, 960];

const heightsAt = (width) =>
  withPage(
    async (page) => {
      await page.waitForTimeout(400);
      // Put both sections through the viewport so any entrance has run.
      await page.evaluate(() => {
        const s = document.getElementById('how-it-works');
        window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 150);
      });
      await page.waitForTimeout(900);
      // offsetHeight, NOT getBoundingClientRect().height: the rect includes
      // the entrance transform, and the entrance is STAGGERED, so sampling
      // mid-entrance reads three different scales as three different heights.
      // That made this test pass alone and fail under the suite's
      // concurrency. offsetHeight is the layout box, which is what "the same
      // height" actually means here.
      const steps = await page.evaluate(() =>
        [...document.querySelectorAll('.howworks__step')].map((el) => el.offsetHeight)
      );
      await page.evaluate(() => {
        const s = document.getElementById('insights');
        window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 150);
      });
      await page.waitForTimeout(900);
      const insights = await page.evaluate(() =>
        [...document.querySelectorAll('.insight')].map((el) => el.offsetHeight)
      );
      return { steps, insights };
    },
    '',
    { viewport: { width, height: 900 } }
  );

const spread = (a) => Math.max(...a) - Math.min(...a);

test('the spend / reward / return steps are all the same height', async () => {
  for (const w of WIDTHS) {
    const { steps } = await heightsAt(w);
    assert.equal(steps.length, 3, `expected three steps at ${w}px`);
    assert.ok(
      spread(steps) < 1,
      `at ${w}px the steps differ by ${spread(steps).toFixed(1)}px: ${steps.map((h) => h.toFixed(1)).join(', ')}`
    );
  }
});

test('the steps sit level, and their interiors line up with each other', async () => {
  // The descent was dropped on the user's call after two rounds on this row.
  // Level tops are not enough on their own: the cells were ALSO packing their
  // content from the bottom, and the three copy blocks run 2, 3 and 4 lines,
  // so each index and heading sat at a different offset from its own box top
  // (160px / 136px / 90px). Equal boxes with ragged interiors still read as
  // misaligned, which is what "not aligned still" meant.
  const r = await withPage(async (page) => {
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const s = document.getElementById('how-it-works');
      window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 150);
    });
    await page.waitForTimeout(900);
    return page.evaluate(() =>
      [...document.querySelectorAll('.howworks__step')].map((el) => {
        const box = el.getBoundingClientRect();
        return {
          top: box.top,
          // Offsets measured from each cell's OWN top, so this holds whether
          // or not the row is ever staggered again.
          idx: el.querySelector('.howworks__idx').getBoundingClientRect().top - box.top,
          h3: el.querySelector('h3').getBoundingClientRect().top - box.top,
        };
      })
    );
  });

  const spread = (xs) => Math.max(...xs) - Math.min(...xs);
  assert.ok(
    spread(r.map((s) => s.top)) < 1,
    `the step tops are not level: ${r.map((s) => s.top.toFixed(1)).join(', ')}`
  );
  assert.ok(
    spread(r.map((s) => s.idx)) < 1,
    `the 01/02/03 indices sit at different heights inside their cells: ${r.map((s) => s.idx.toFixed(1)).join(', ')}`
  );
  assert.ok(
    spread(r.map((s) => s.h3)) < 1,
    `the headings sit at different heights inside their cells: ${r.map((s) => s.h3.toFixed(1)).join(', ')}`
  );
});

test('the three insight cards are all the same height', async () => {
  for (const w of WIDTHS) {
    const { insights } = await heightsAt(w);
    assert.equal(insights.length, 3, `expected three insight cards at ${w}px`);
    assert.ok(
      spread(insights) < 1,
      `at ${w}px the cards differ by ${spread(insights).toFixed(1)}px: ${insights.map((h) => h.toFixed(1)).join(', ')}`
    );
  }
});

test('the loyalty monitor CTA is clear of the next section', async () => {
  // The section had padding-block:0 so its 100vh grid could centre the two
  // display figures, but the content runs taller than the viewport, so the
  // CTA sat hard against #clients.
  const gap = await withPage(async (page) => {
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const s = document.getElementById('loyalty-monitor');
      window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY);
    });
    await page.waitForTimeout(600);
    return page.evaluate(() => {
      const cta = document.querySelector('.monitor__cta');
      const section = document.getElementById('loyalty-monitor');
      return section.getBoundingClientRect().bottom - cta.getBoundingClientRect().bottom;
    });
  });
  assert.ok(gap > 40, `only ${gap.toFixed(0)}px between the CTA and the end of the section`);
});
