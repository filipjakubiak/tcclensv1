import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { withPage } from '../test-support/helpers.mjs';
import { startServer } from '../serve.mjs';

test('body copy never exceeds the 18px cap', async () => {
  const px = await withPage((page) =>
    page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))
  );
  assert.ok(px <= 18, `body is ${px}px, cap is 18`);
});

test('primary buttons are fully-rounded pills with a purple-tinted shadow', async () => {
  const s = await withPage((page) =>
    page.evaluate(() => {
      const b = document.querySelector('.btn--solid');
      const cs = getComputedStyle(b);
      return { radius: cs.borderRadius, shadow: cs.boxShadow };
    })
  );
  assert.ok(parseFloat(s.radius) >= 100, `radius ${s.radius} is not a pill`);
  assert.match(s.shadow, /148,\s*44,\s*181/, 'shadow is not purple-tinted');
});

test('nav gains a solid surface after scrolling off the hero', async () => {
  const solid = await withPage(async (page) => {
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5));
    await page.waitForTimeout(300);
    return page.evaluate(() => document.querySelector('.nav').classList.contains('nav--solid'));
  });
  assert.equal(solid, true);
});

test('overlay menu opens on burger click, flips aria state, and closes on Escape', async () => {
  const server = await startServer(0);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(server.url, { waitUntil: 'load' });

    const burger = page.locator('.nav__burger');
    const menu = page.locator('.menu');

    // Closed by default.
    await assert.doesNotReject(burger.waitFor({ state: 'visible' }));
    assert.equal(await burger.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.getAttribute('aria-hidden'), 'true');

    // Opens on click.
    await burger.click();
    await page.waitForTimeout(300);
    assert.equal(await burger.getAttribute('aria-expanded'), 'true');
    assert.equal(await menu.getAttribute('aria-hidden'), 'false');
    assert.ok(await menu.evaluate((el) => el.classList.contains('is-open')));

    // Focus is trapped inside the open menu (moved to the first link).
    const focusedInMenu = await page.evaluate(() =>
      document.querySelector('.menu')?.contains(document.activeElement)
    );
    assert.equal(focusedInMenu, true);

    // Escape closes it.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    assert.equal(await burger.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.getAttribute('aria-hidden'), 'true');
    assert.ok(!(await menu.evaluate((el) => el.classList.contains('is-open'))));
  } finally {
    await browser.close();
    await server.close();
  }
});
