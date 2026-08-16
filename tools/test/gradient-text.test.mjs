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
        size: getComputedStyle(el).backgroundSize,
        clip: getComputedStyle(el).webkitBackgroundClip || getComputedStyle(el).backgroundClip,
      }));

      const figures = [...document.querySelectorAll('.bento__figure')].map((el) => ({
        image: getComputedStyle(el).backgroundImage,
        size: getComputedStyle(el).fontSize,
      }));

      const btn = document.querySelector('.btn--solid');
      return {
        core: resolve('--grad-core'),
        strong: resolve('--grad-core-strong'),
        canvas: tok('--canvas'),
        chamber: tok('--chamber'),
        words,
        figures,
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

test('the core gradient is bright enough on the dark surfaces it was designed for', async () => {
  const r = await read();

  const core = stopsOf(r.core);
  const strong = stopsOf(r.strong);
  assert.equal(core.length, 2, `--grad-core should have 2 stops, got ${r.core}`);
  assert.equal(strong.length, 2, `--grad-core-strong should have 2 stops, got ${r.strong}`);

  // Dark sections carry the true brand gradient and both stops are bright
  // there. This is the half of the contract that is still enforceable.
  for (const s of core) {
    const c = ratio(s, hex(r.chamber));
    assert.ok(c >= 4.5, `--grad-core stop rgb(${s}) is ${c.toFixed(2)}:1 on --chamber, needs 4.5`);
  }

  // The contrast-safe twin must stay contrast-safe even while unused, so it
  // is ready if the brand call is revisited. Deleting this assertion because
  // nothing currently uses the token would let it rot silently.
  for (const s of strong) {
    const c = ratio(s, hex(r.canvas));
    assert.ok(c >= 4.5, `--grad-core-strong stop rgb(${s}) is ${c.toFixed(2)}:1 on --canvas, needs 4.5`);
  }
});

test('the known light-surface contrast cost of the brand gradient is what we think it is', async () => {
  // NOT a pass/fail on the focal words — the brand decision (user, twice) is
  // that gradient text matches the nav CONTACT button exactly, and on light
  // sections that gradient is below the 3:1 large-text floor. Asserting a
  // floor we knowingly break would just be a failing test; deleting the check
  // would erase the fact. So this pins the MEASURED cost instead: if these
  // numbers move, someone changed the brand gradient or the canvas, and that
  // should be a deliberate act rather than a surprise.
  const r = await read();
  const measured = stopsOf(r.core)
    .map((s) => ratio(s, hex(r.canvas)))
    .sort((a, b) => b - a);

  assert.equal(measured.length, 2);
  assert.ok(
    Math.abs(measured[0] - 2.54) < 0.06,
    `the purple stop now measures ${measured[0].toFixed(2)}:1 on --canvas, was 2.54:1`
  );
  assert.ok(
    Math.abs(measured[1] - 1.85) < 0.06,
    `the Space Grey stop now measures ${measured[1].toFixed(2)}:1 on --canvas, was 1.85:1`
  );
});

test('every focal word carries the exact nav-button gradient', async () => {
  // The requirement in the user's own words: "it should be exactly gradient
  // like on the contact button on the menu bar. purple to light grey."
  // So the test is an equality against the button, not a contrast floor —
  // one paint, every surface, no darkened variant on light sections.
  const r = await read();
  assert.ok(r.words.length >= 6, `only ${r.words.length} focal words found`);

  const bad = [];
  for (const w of r.words) {
    if (!/text/.test(w.clip)) bad.push(`#${w.section}: gradient is not clipped to the text (${w.clip})`);
    if (w.image !== r.core) {
      bad.push(`#${w.section} (${w.dark ? 'dark' : 'light'}) does not match the button gradient:\n      ${w.image}`);
    }
    // Half the ramp outside the glyphs is how this last read as flat purple:
    // background-size was 200%, so only the accent end was ever visible.
    if (w.size && !/^100%/.test(w.size)) {
      bad.push(`#${w.section}: background-size is ${w.size}, so only part of the gradient is inside the text`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}\n`);
});

test('the stat figures carry the same gradient as the focal words and the button', async () => {
  const r = await read();
  assert.ok(r.figures.length >= 6, `only ${r.figures.length} stat figures found`);
  for (const f of r.figures) {
    assert.equal(f.image, r.core, `a stat figure does not match the button gradient: ${f.image}`);
  }
  // One size for every figure except the lead, which carries the section.
  const sizes = r.figures.map((f) => parseFloat(f.size));
  const lead = Math.max(...sizes);
  const rest = sizes.filter((s) => s !== lead);
  assert.ok(rest.length === sizes.length - 1, `expected exactly one oversized figure, got sizes ${sizes.join(', ')}`);
  assert.ok(
    Math.max(...rest) - Math.min(...rest) < 0.5,
    `the supporting figures are not all one size: ${rest.join(', ')}`
  );
  assert.ok(lead > Math.max(...rest), 'the lead figure is not the largest');
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
