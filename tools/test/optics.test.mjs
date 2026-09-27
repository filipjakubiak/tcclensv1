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

// Every colour in a computed text-shadow list, as alpha values.
// Chrome serialises color-mix() results as color(srgb r g b / a).
const shadowAlphas = (s) => [...s.matchAll(/(rgba?|color)(([^)]+))/g)].map((m) => {
  if (m[1] === 'color') { const a = m[2].split('/')[1]; return a === undefined ? 1 : Number(a); }
  const p = m[2].split(',').map(Number); return p.length === 4 ? p[3] : 1;
});

test('with motion off the text is untouched: no split words, no fringe, no scramble', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => ({
      words: document.querySelectorAll('.w:not(.focus-word)').length,
      shadow: getComputedStyle(document.querySelector('#thesis .thesis__heading')).textShadow,
      eyebrow: document.querySelector('#thesis .eyebrow').textContent,
      filmWord: document.querySelector('.film__word').textContent,
    }));
  }, '?shot=1');
  assert.equal(r.words, 0);
  assert.equal(r.shadow, 'none');
  assert.equal(r.eyebrow, 'Our belief');
  assert.equal(r.filmWord, 'Recognise');
});

test('a resolved headline carries no colour fringe at rest', async () => {
  const s = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '#thesis .thesis__heading', 0.4);
    await page.waitForTimeout(1500);
    return page.evaluate(() => getComputedStyle(document.querySelector('#thesis .thesis__heading')).textShadow);
  });
  const alphas = shadowAlphas(s);
  assert.equal(alphas.length, 2, `expected the two dispersion shadows, got ${s}`);
  assert.ok(alphas.every((a) => a === 0), `fringe visible at rest: ${s}`);
});

test('speed opens the split within bounds, and rest closes it', async () => {
  // Driven through the velocity input directly: headless Chrome runs at a
  // few frames a second, which caps the scroll velocity it can report and
  // made a wheel-driven version of this test measure the browser, not us.
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '#thesis .thesis__heading', 0.4);
    await page.waitForTimeout(1500);
    const vel = () => page.evaluate(() =>
      parseFloat(document.querySelector('#thesis .thesis__heading').style.getPropertyValue('--vel')) || 0);
    let peak = 0;
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.__tccOptics.kick(1));
      await page.waitForTimeout(60);
      peak = Math.max(peak, await vel());
    }
    await page.waitForTimeout(2500);
    return { peak, rest: await vel() };
  });
  assert.ok(r.peak > 0.3, `a full fling barely opened the split: ${r.peak}`);
  assert.ok(r.peak <= 1, `split exceeded its bound: ${r.peak}`);
  assert.equal(r.rest, 0, `split did not close at rest: ${r.rest}`);
});

test('statements come into focus in reading order and end fully sharp', async () => {
  // The film's quote was removed (2026-09-27: it was not TCC's verified
  // copy); the thesis pull quote carries the focal-plane reading now.
  const sel = '#thesis .pullquote';
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, sel, 0.66);
    const mid = await page.evaluate((s) => [...document.querySelectorAll(s + ' .w')].map((w) => +getComputedStyle(w).opacity), sel);
    await wheelTo(page, sel, 0.25);
    const end = await page.evaluate((s) => ({
      op: [...document.querySelectorAll(s + ' .w')].map((w) => +getComputedStyle(w).opacity),
      text: document.querySelector(s).textContent,
    }), sel);
    return { mid, end };
  });
  assert.ok(r.mid.some((o) => o > 0.9) && r.mid.some((o) => o < 0.5), `not mid-read: ${r.mid}`);
  for (let i = 1; i < r.mid.length; i++) {
    assert.ok(r.mid[i] <= r.mid[i - 1] + 0.35, `word ${i} ahead of word ${i - 1}: ${r.mid}`);
  }
  assert.ok(r.end.op.every((o) => o > 0.99), `not all sharp at the end: ${r.end.op}`);
  assert.match(r.end.text, /You cannot discount your way to devotion/);
});

test('eyebrows calibrate back to their exact copy', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '#capabilities .eyebrow', 0.5);
    return page.evaluate(() => {
      const eb = document.querySelector('#capabilities .eyebrow');
      return { text: eb.querySelector('.eb__real').textContent, fx: eb.querySelector('.eb__fx').textContent, calibrating: eb.classList.contains('is-calibrating') };
    });
  });
  assert.equal(r.text, 'What we build');
  assert.equal(r.fx, '');
  assert.equal(r.calibrating, false);
});
