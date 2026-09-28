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

// The verified quote, verbatim from tccglobal.com (content inventory).
const QUOTE = '“Performance comes from knowing what drives the head and the heart. We start by truly understanding our retail clients’ business, brand and shoppers. Creating programmes that are designed to profitably grow sales and strengthen engagement with shoppers.”';

test('with motion off the hero headline is whole and the CEO quote is complete and still', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => ({
      split: document.querySelectorAll('#hero .hc').length,
      h1: document.querySelector('#hero .display').textContent.replace(/\s+/g, ' ').trim(),
      words: document.querySelectorAll('.ceo__w').length,
      quote: document.querySelector('.ceo__quote').textContent.replace(/\s+/g, ' ').trim(),
      portrait: document.querySelector('.ceo__portrait img').getAttribute('src'),
      name: document.querySelector('.ceo__who b').textContent,
    }));
  }, '?shot=1');
  assert.equal(r.split, 0);
  assert.equal(r.h1, 'Inspiring loyalty. Creating value.');
  assert.equal(r.words, 0);
  assert.equal(r.quote, QUOTE);
  assert.equal(r.portrait, 'assets/img/people/rick-swinkels.jpeg');
  assert.equal(r.name, 'Rick Swinkels');
});

test('the CEO section follows the film directly, and the film carries no quote of its own', async () => {
  const r = await withPage((page) => page.evaluate(() => ({
    next: document.getElementById('film').nextElementSibling?.id,
    filmQuote: document.querySelectorAll('#film blockquote').length,
  })), '?shot=1');
  assert.equal(r.next, 'ceo');
  assert.equal(r.filmQuote, 0);
});

test('the hero letters rise into place, land without a fringe, and the lines drift apart with the scroll', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    const early = await page.evaluate(() => ({
      split: document.querySelectorAll('#hero .hc').length,
      label: document.querySelector('#hero .display').getAttribute('aria-label'),
    }));
    // GSAP's lag smoothing slows the intro under load, so wait for the
    // landing itself rather than a guessed time.
    await page.waitForFunction(() => document.querySelector('#hero .display').dataset.assembled === '1', null, { timeout: 30000 });
    const landed = await page.evaluate(() => [...document.querySelectorAll('#hero .hc__in')].map((c) => {
      const cs = getComputedStyle(c);
      const m = new DOMMatrix(cs.transform);
      return { moved: Math.hypot(m.m41, m.m42, m.m43), op: +cs.opacity, sa: parseFloat(c.style.getPropertyValue('--sa')) || 0 };
    }));
    const rows = () => page.evaluate(() => [...document.querySelectorAll('#hero .display .line')].map((l) => {
      const m = new DOMMatrix(getComputedStyle(l).transform);
      return { x: m.m41, op: +getComputedStyle(l).opacity };
    }));
    const risen = await page.evaluate(() => [...document.querySelectorAll('#hero .hc')].every((c) =>
      Math.abs(new DOMMatrix(getComputedStyle(c).transform).m42) < 0.5));
    await page.mouse.move(10, 10);
    await wheelTo(page, '#hero', -0.45);
    const out = await rows();
    // The words stay whole: no letter leaves its place in the line.
    const whole = await page.evaluate(() => [...document.querySelectorAll('#hero .hc, #hero .hc__in')].every((c) => {
      const m = new DOMMatrix(getComputedStyle(c).transform);
      return Math.hypot(m.m41, m.m42, m.m43) < 0.5;
    }));
    await wheelTo(page, '#hero', 0);
    const back = await rows();
    return { early, landed, risen, out, whole, back };
  });
  assert.ok(r.early.split > 25, `only ${r.early.split} letters`);
  assert.equal(r.early.label, 'Inspiring loyalty. Creating value.');
  assert.ok(r.landed.every((c) => c.moved < 0.5 && c.op > 0.99), 'a letter never landed');
  assert.ok(r.landed.every((c) => c.sa < 0.01), 'letters kept a colour fringe after landing');
  assert.ok(r.risen, 'a letter never rose into its line');
  assert.ok(r.out[0].x < -10 && r.out[1].x > 10, `lines did not drift apart: ${JSON.stringify(r.out)}`);
  assert.ok(r.out.every((l) => l.op < 0.9), `lines did not fade: ${JSON.stringify(r.out)}`);
  assert.ok(r.whole, 'letters scattered on scroll');
  assert.ok(r.back.every((l) => Math.abs(l.x) < 0.5 && l.op > 0.99), 'scrolling back up did not return the headline');
});

test('the CEO speaks the quote word by word, then offers a replay', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.mouse.move(10, 10);
    await wheelTo(page, '#ceo', 0.08);
    const said = () => page.evaluate(() => document.querySelectorAll('.ceo__w.is-said').length);
    const total = await page.evaluate(() => document.querySelectorAll('.ceo__w').length);
    const a = await said();
    await page.waitForTimeout(1500);
    const b = await said();
    await page.waitForFunction(() => !document.querySelector('.ceo__replay').hidden, null, { timeout: 30000 });
    const done = await page.evaluate(() => ({
      said: document.querySelectorAll('.ceo__w.is-said').length,
      speaking: document.getElementById('ceo').classList.contains('is-speaking'),
      text: document.querySelector('.ceo__quote').textContent.replace(/\s+/g, ' ').trim(),
    }));
    await page.click('.ceo__replay');
    await page.waitForTimeout(200);
    const replayed = await page.evaluate(() => ({
      said: document.querySelectorAll('.ceo__w.is-said').length,
      hidden: document.querySelector('.ceo__replay').hidden,
    }));
    return { total, a, b, done, replayed };
  });
  assert.ok(r.b > r.a, `the transcript did not advance: ${r.a} -> ${r.b}`);
  assert.equal(r.done.said, r.total);
  assert.equal(r.done.speaking, false);
  assert.equal(r.done.text, QUOTE, 'the transcript altered the quote');
  assert.ok(r.replayed.said < r.total && r.replayed.hidden, 'replay did not restart the transcript');
});
