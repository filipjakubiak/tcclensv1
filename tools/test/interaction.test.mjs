import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

// NOTE on the two edits below: the brief's original assertions passed
// trivially even with zero implementation — the static markup already
// contains each counter's final text, and "no .cursor elements" is true
// whether or not cursor logic exists. Neither gave real RED. Both are
// strengthened here to assert the actual invariant (the counter visibly
// animates; the cursor dot is created on fine pointers, not merely absent
// on coarse ones) so the TDD cycle is meaningful.

test('stat counters animate up from zero and land exactly on target values', async () => {
  const { early, finalResults } = await withPage(async (page) => {
    await page.locator('#proof').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const early = await page.evaluate(() => {
      const el = document.querySelector('[data-count-to="120"]');
      return el ? el.textContent.trim() : null;
    });
    await page.waitForTimeout(2200);
    const finalResults = await page.evaluate(() =>
      [...document.querySelectorAll('[data-count-to]')].map((el) => ({
        shown: el.textContent.trim(),
        want: el.dataset.countTo + (el.dataset.suffix ?? ''),
      }))
    );
    return { early, finalResults };
  });
  assert.notEqual(early, '120+', 'counter shows its final value almost immediately — it is not animating');
  assert.ok(finalResults.length > 0, 'no counters found');
  for (const r of finalResults) assert.equal(r.shown, r.want);
});

test('the custom cursor appears on fine pointers but is suppressed on coarse pointers', async () => {
  const fineCount = await withPage(async (page) => {
    await page.waitForTimeout(200);
    return page.evaluate(() => document.querySelectorAll('.cursor').length);
  });
  assert.equal(fineCount, 1, 'cursor dot missing on a fine-pointer session');

  const { chromium } = await import('playwright');
  const { startServer } = await import('../serve.mjs');
  const server = await startServer(4381);
  const browser = await chromium.launch();
  const page = await browser.newPage({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const coarseCount = await page.evaluate(() => document.querySelectorAll('.cursor').length);
  await browser.close(); await server.close();
  assert.equal(coarseCount, 0, 'cursor dot appeared on a coarse/touch session');
});

test('counters still show final values under ?shot=1', async () => {
  const shown = await withPage(async (page) => {
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const el = document.querySelector('[data-count-to]');
      return el.textContent.trim();
    });
  }, '/?shot=1');
  assert.notEqual(shown, '0');
});
