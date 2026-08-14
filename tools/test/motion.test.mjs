import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

test('?shot=1 renders headlines settled — sharp, opaque, untransformed', async () => {
  const s = await withPage(async (page) => {
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const h = document.querySelector('[data-focus-pull]');
      const inner = document.querySelector('.line > span');
      return {
        filter: getComputedStyle(h).filter,
        opacity: getComputedStyle(h).opacity,
        transform: getComputedStyle(inner).transform,
      };
    });
  }, '/?shot=1');
  assert.ok(s.filter === 'none' || !s.filter.includes('blur'), `still blurred: ${s.filter}`);
  assert.equal(s.opacity, '1');
  assert.ok(s.transform === 'none' || s.transform === 'matrix(1, 0, 0, 1, 0, 0)');
});

test('reduced-motion renders settled too', async () => {
  const { chromium } = await import('playwright');
  const { startServer } = await import('../serve.mjs');
  const server = await startServer(4380);
  const browser = await chromium.launch();
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const opacity = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-focus-pull]')).opacity
  );
  await browser.close(); await server.close();
  assert.equal(opacity, '1');
});

test('with motion on, an offscreen headline starts hidden', async () => {
  const opacity = await withPage(async (page) => {
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const all = [...document.querySelectorAll('[data-focus-pull]')];
      const off = all.find((el) => el.getBoundingClientRect().top > window.innerHeight * 1.5);
      return off ? getComputedStyle(off).opacity : '1';
    });
  });
  assert.equal(opacity, '0');
});
