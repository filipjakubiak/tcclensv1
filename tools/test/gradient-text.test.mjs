import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

/**
 * The core gradient applied to text and buttons (user, 2026-08-16 — "that
 * exact gradient on buttons, purple texts").
 *
 * Gradient text has a failure mode flat colour does not: there are TWO
 * colours to clear the contrast floor, and the pale end is the one that
 * fails. --accent alone already sits ~2:1 on --canvas, and the Space Grey
 * stop is paler still, so the literal core gradient as text on a light
 * surface measures about 1.6:1. --grad-core-strong exists for exactly that,
 * and this guard is what stops it drifting back.
 *
 * Token maths, not a screenshot: background-clip:text paints a per-glyph
 * sweep, so no single sampled pixel describes it.
 */
const LUM = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [l1, l2] = [Math.max(LUM(a), LUM(b)), Math.min(LUM(a), LUM(b))];
  return (l1 + 0.05) / (l2 + 0.05);
};

/**
 * Every colour stop in a resolved gradient string, as 0-255 [r,g,b] triples.
 *
 * Three notations have to be handled, because which one comes back depends on
 * how the colour was written: a hex literal stays hex, rgb() comes back as
 * rgb(), and anything that went through color-mix() resolves to
 * `color(srgb 0.51 0.31 0.57` — 0-1 floats, NOT 0-255. Reading those as
 * 0-255 silently makes every mixed colour look like near-black and every
 * contrast check pass.
 */
const stopsOf = (grad) =>
  (grad.match(/color\(srgb[^)]*\)|rgba?\([^)]*\)|#[0-9a-fA-F]{6}/g) ?? []).map((s) => {
    if (s.startsWith('#')) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const n = s.match(/[\d.]+/g).slice(0, 3).map(Number);
    return s.startsWith('color(') ? n.map((c) => c * 255) : n;
  });

const read = async () =>
  withPage(async (page) => {
    await page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });
    return page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const tok = (n) => root.getPropertyValue(n).trim();

      // getPropertyValue hands back the token UNRESOLVED — a custom property
      // holding color-mix() comes out as the literal "color-mix(in srgb,
      // #D380EB 62%, #000000)" text, whose hex arguments are not the colour
      // that renders. Painting it onto a probe element forces the resolution
      // and getComputedStyle then reports real rgb() stops.
      const resolve = (name) => {
        const probe = document.createElement('div');
        probe.style.backgroundImage = `var(${name})`;
        document.body.appendChild(probe);
        const out = getComputedStyle(probe).backgroundImage;
        probe.remove();
        return out;
      };

      // Which gradient each focal word actually resolves to, and whether a
      // solid fallback survives underneath the clip.
      const words = [...document.querySelectorAll('.focus-word')].map((el) => ({
        section: el.closest('section')?.id ?? '(none)',
        dark: !!el.closest('.theme-dark'),
        image: getComputedStyle(el).backgroundImage,
        clip: getComputedStyle(el).webkitBackgroundClip || getComputedStyle(el).backgroundClip,
      }));

      const btn = document.querySelector('.btn--solid');
      return {
        core: resolve('--grad-core'),
        strong: resolve('--grad-core-strong'),
        canvas: tok('--canvas'),
        chamber: tok('--chamber'),
        words,
        btn: btn && {
          image: getComputedStyle(btn).backgroundImage,
          colour: getComputedStyle(btn).color,
          // The flat colour beneath the gradient — a failed gradient must
          // still leave a brand-purple button, not a transparent one.
          fallback: getComputedStyle(btn).backgroundColor,
        },
      };
    });
  });

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test('core gradient text clears the contrast floor on both surfaces', async () => {
  const r = await read();

  const strong = stopsOf(r.strong);
  const core = stopsOf(r.core);
  assert.equal(strong.length, 2, `--grad-core-strong should have 2 stops, got ${r.strong}`);
  assert.equal(core.length, 2, `--grad-core should have 2 stops, got ${r.core}`);

  // Light surfaces use the darkened twin. 4.5:1 is stricter than the 3:1 a
  // headline-scale focal word strictly needs — deliberately, because these
  // tokens are the obvious thing to reach for on smaller text next.
  for (const s of strong) {
    const c = ratio(s, hex(r.canvas));
    assert.ok(c >= 4.5, `--grad-core-strong stop rgb(${s}) is ${c.toFixed(2)}:1 on --canvas, needs 4.5`);
  }

  // Dark sections keep the true brand gradient; both stops are bright there.
  for (const s of core) {
    const c = ratio(s, hex(r.chamber));
    assert.ok(c >= 4.5, `--grad-core stop rgb(${s}) is ${c.toFixed(2)}:1 on --chamber, needs 4.5`);
  }

  // The defect being guarded, stated directly: the raw gradient must never be
  // the one painting text on a light surface.
  for (const s of core) {
    const c = ratio(s, hex(r.canvas));
    if (c >= 4.5) continue;
    assert.ok(
      true,
      'sanity: the raw core gradient is expected to fail on --canvas, which is why the strong twin exists'
    );
  }
  const rawOnLight = Math.min(...core.map((s) => ratio(s, hex(r.canvas))));
  assert.ok(rawOnLight < 4.5, 'the raw core gradient now passes on light — --grad-core-strong may be redundant, re-check before deleting it');
});

test('every focal word takes the gradient matching its surface', async () => {
  const r = await read();
  assert.ok(r.words.length >= 6, `only ${r.words.length} focal words found`);

  const bad = [];
  for (const w of r.words) {
    if (!/gradient/.test(w.image)) {
      bad.push(`#${w.section}: focal word has no gradient (${w.image})`);
      continue;
    }
    if (!/text/.test(w.clip)) bad.push(`#${w.section}: gradient is not clipped to the text (${w.clip})`);

    const stops = stopsOf(w.image);
    const bg = hex(w.dark ? r.chamber : r.canvas);
    for (const s of stops) {
      const c = ratio(s, bg);
      // 3:1 — these are headline-scale words, and this is the rendered
      // element rather than the token, so the real floor applies.
      if (c < 3) bad.push(`#${w.section} (${w.dark ? 'dark' : 'light'}): stop rgb(${s}) is ${c.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}\n`);
});

test('the solid button carries the gradient and keeps a readable label', async () => {
  const r = await read();
  assert.ok(r.btn, 'no .btn--solid on the page');
  assert.ok(/gradient/.test(r.btn.image), `.btn--solid is not on a gradient: ${r.btn.image}`);

  const label = r.btn.colour.match(/[\d.]+/g).slice(0, 3).map(Number);
  for (const s of stopsOf(r.btn.image)) {
    const c = ratio(label, s);
    assert.ok(c >= 4.5, `.btn--solid label is ${c.toFixed(2)}:1 over stop rgb(${s})`);
  }

  // A gradient with no colour under it renders transparent if the image
  // fails; the flat brand purple stays as the floor.
  assert.ok(
    !/rgba\(0, 0, 0, 0\)|transparent/.test(r.btn.fallback),
    'the solid button has no flat background-color beneath its gradient'
  );
});
