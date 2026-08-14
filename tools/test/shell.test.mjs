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

test('the burger control stays visible against the open menu backdrop', async () => {
  const server = await startServer(0);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(server.url, { waitUntil: 'load' });
    const burger = page.locator('.nav__burger');

    const closedColor = await burger.evaluate((el) => getComputedStyle(el).color);
    await burger.click();
    await page.waitForTimeout(300);
    const openColor = await burger.evaluate((el) => getComputedStyle(el).color);

    assert.notEqual(openColor, closedColor, 'burger colour does not change when the menu opens');

    // The real invariant: once open, the burger must resolve to --canvas
    // (light) so it reads against the near-black .menu backdrop — not just
    // that its colour changed to *something*.
    const canvasColor = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = 'var(--canvas)';
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    assert.equal(openColor, canvasColor, 'burger is not canvas-coloured against the dark overlay');
  } finally {
    await browser.close();
    await server.close();
  }
});

test('focus still lands in the menu when prefers-reduced-motion suppresses the transition', async () => {
  const server = await startServer(0);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  try {
    await page.goto(server.url, { waitUntil: 'load' });
    // Task 8 (not yet landed) is what actually makes reduced-motion strip
    // `.menu`'s transition in CSS, so `transitionend` would never fire.
    // Simulate that today by disabling the transition directly, proving
    // the fallback path — not just the still-transitioning happy path —
    // is what lands focus.
    await page.addStyleTag({ content: '.menu, .menu * { transition: none !important; }' });
    await page.locator('.nav__burger').click();
    // Give the bounded fallback timer (400ms in nav.js) room to fire;
    // no transitionend will ever come now that the transition is off.
    await page.waitForTimeout(600);
    const focusedInMenu = await page.evaluate(() =>
      document.querySelector('.menu')?.contains(document.activeElement)
    );
    assert.equal(focusedInMenu, true, 'focus never moved into the menu when no transition fired');
  } finally {
    await browser.close();
    await server.close();
  }
});
