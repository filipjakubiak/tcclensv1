import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

// ---- C1: the tcc wordmark must be legible over the dark hero ----

test('nav logo inverts over the dark hero and reverts once the nav goes solid', async () => {
  const result = await withPage(async (page) => {
    const before = await page.evaluate(
      () => getComputedStyle(document.querySelector('.nav__logo img')).filter
    );
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5));
    await page.waitForTimeout(300);
    const after = await page.evaluate(
      () => getComputedStyle(document.querySelector('.nav__logo img')).filter
    );
    return { before, after };
  });
  assert.match(result.before, /invert/, 'logo is not inverted over the dark hero');
  assert.doesNotMatch(result.after, /invert/, 'logo stays inverted after the nav goes solid');
});

// ---- C2: hero display type must fit each phrase on one visual line ----

test('each hero .line > span renders as a single visual line, not a wrap', async () => {
  const data = await withPage((page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('#hero .line > span')].map((el) => ({
        height: el.getBoundingClientRect().height,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        text: el.textContent,
      }))
    )
  );
  assert.equal(data.length, 2, 'expected the two hero phrase lines');
  for (const { height, fontSize, text } of data) {
    assert.ok(
      height < fontSize * 1.3,
      `"${text}" rendered ${height}px tall against a ${fontSize}px font-size — looks wrapped`
    );
  }
});

test('the hero fits within a reasonable multiple of the viewport at 1440x900', async () => {
  const heroHeight = await withPage((page) =>
    page.evaluate(() => document.getElementById('hero').getBoundingClientRect().height)
  );
  // Not a strict one-viewport requirement (CTAs/eyebrow/lead add height),
  // but the two-line wrap regression pushed this to ~1167px; confirm it's
  // back down near normal single-phrase hero proportions.
  assert.ok(heroHeight < 1000, `hero is ${heroHeight}px tall — still looks wrapped/oversized`);
});

// ---- C3: both Loyalty Monitor statistics must be reachable ----

test('both loyalty monitor statistics are visible concurrently, not hidden', async () => {
  const state = await withPage((page) =>
    page.evaluate(() => {
      const b = document.querySelector('.monitor__state--b');
      const cs = getComputedStyle(b);
      return {
        opacity: cs.opacity,
        visibility: cs.visibility,
        text: b.textContent,
      };
    })
  );
  assert.equal(state.visibility, 'visible', '.monitor__state--b is not in the accessibility tree');
  assert.equal(Number(state.opacity), 1, '.monitor__state--b is not visible');
  assert.match(state.text, /76%/);
});

// ---- I4: fixed nav must not cover an anchor target's heading ----

test('html has scroll-padding-top matching the fixed nav height', async () => {
  const { scrollPad, navH } = await withPage((page) =>
    page.evaluate(() => ({
      scrollPad: getComputedStyle(document.documentElement).scrollPaddingTop,
      navH: getComputedStyle(document.documentElement).getPropertyValue('--nav-h').trim(),
    }))
  );
  assert.equal(scrollPad, navH, `scroll-padding-top (${scrollPad}) does not match --nav-h (${navH})`);
});

// ---- I5: capability cards must present a uniform visual slot ----

test('all five capability cards expose a uniform aspect-ratio visual slot', async () => {
  const boxes = await withPage((page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('.capability')].map((li) => {
        const visual = li.querySelector('.capability__visual');
        if (!visual) return null;
        const r = visual.getBoundingClientRect();
        return Math.round((r.width / r.height) * 100) / 100;
      })
    )
  );
  assert.equal(boxes.length, 5);
  assert.ok(boxes.every((r) => r !== null), 'every capability needs a .capability__visual slot');
  const [first, ...rest] = boxes;
  for (const r of rest) assert.ok(Math.abs(r - first) < 0.05, `aspect ratios differ: ${first} vs ${r}`);
});

// ---- I6: focus-word must clear 3:1 contrast against --canvas on light sections ----

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function relLuminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function parseRgb(str) {
  // Chromium resolves color-mix() results (and some other computed colors)
  // as `color(srgb r g b)` with 0-1 channel values rather than the
  // classic `rgb(r, g, b)` 0-255 form — handle both.
  const colorFn = str.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (colorFn) return colorFn.slice(1, 4).map((n) => parseFloat(n) * 255);
  const rgbFn = str.match(/rgba?\(([^)]+)\)/);
  return rgbFn[1].split(',').slice(0, 3).map((n) => parseFloat(n));
}
function contrastRatio(a, b) {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

test('--accent-strong meets 3:1 large-text contrast against --canvas', async () => {
  const { accentStrong, canvas } = await withPage((page) =>
    page.evaluate(() => {
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      probe.style.color = 'var(--accent-strong)';
      const accentStrong = getComputedStyle(probe).color;
      probe.style.color = 'var(--canvas)';
      const canvas = getComputedStyle(probe).color;
      probe.remove();
      return { accentStrong, canvas };
    })
  );
  const ratio = contrastRatio(parseRgb(accentStrong), parseRgb(canvas));
  assert.ok(ratio >= 3, `--accent-strong vs --canvas contrast is ${ratio.toFixed(2)}:1, need >= 3:1`);
});

test('theme-dark sections keep the true --accent on .focus-word', async () => {
  const { darkFocus, accent } = await withPage((page) =>
    page.evaluate(() => {
      const el = document.querySelector('.theme-dark .focus-word');
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      probe.style.color = 'var(--accent)';
      const accent = getComputedStyle(probe).color;
      probe.remove();
      return { darkFocus: el ? getComputedStyle(el).color : null, accent };
    })
  );
  assert.ok(darkFocus, 'no .focus-word found inside a .theme-dark section to check');
  assert.equal(darkFocus, accent, 'dark-section focus-word should stay the true brand purple');
});

// ---- M9: every wordmark must preserve the source aspect ratio ----

test('every logo-text.svg instance preserves the 59x27 source aspect ratio', async () => {
  // Was scoped to `.accent-band img`. That band is retired — it was a 40vh
  // slab of flat --accent with a logo in the corner and read as a rendering
  // fault at the bottom of the page. The underlying defect it guarded (a
  // wordmark stretched away from its real 59x27 viewBox) applies to every
  // instance, so the test now covers all of them rather than being deleted
  // with the element that happened to expose it first.
  const dims = await withPage((page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('img[src$="logo-text.svg"]')].map((img) => ({
        w: img.getAttribute('width'),
        h: img.getAttribute('height'),
        where: img.closest('[class]')?.className ?? '(unclassed)',
      }))
    )
  );
  assert.ok(dims.length >= 2, `expected at least two wordmarks, found ${dims.length}`);
  for (const d of dims) {
    assert.equal(d.w, '59', `wordmark in ${d.where} has width ${d.w}`);
    assert.equal(d.h, '27', `wordmark in ${d.where} has height ${d.h}`);
  }
});

// ---- M10: insights sizes breakpoint must match the grid collapse breakpoint ----

test('insights image sizes breakpoint matches the 860px grid collapse', async () => {
  const sizes = await withPage((page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('#insights source[sizes]')].map((s) => s.getAttribute('sizes'))
    )
  );
  assert.ok(sizes.length > 0, 'no insights <source sizes> found');
  for (const s of sizes) assert.match(s, /860px/, `sizes "${s}" does not reference the 860px breakpoint`);
});

// ---- M11: marquee/partner logos must lazy-load like every other image ----

test('marquee and partner logos are lazy-loaded and async-decoded', async () => {
  const bad = await withPage((page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('.marquee img, .partners img')]
        .filter((img) => img.getAttribute('loading') !== 'lazy' || img.getAttribute('decoding') !== 'async')
        .map((img) => img.getAttribute('src'))
    )
  );
  assert.deepEqual(bad, []);
});

// ---- M13: footer must be a sibling of #contact, not nested inside it ----

test('footer sits as a sibling of #contact, not nested inside it', async () => {
  const result = await withPage((page) =>
    page.evaluate(() => {
      const footer = document.querySelector('footer.footer');
      const contact = document.getElementById('contact');
      return {
        footerExists: !!footer,
        nestedInContact: footer ? contact.contains(footer) : null,
        sameParent: footer ? footer.parentElement === contact.parentElement : null,
      };
    })
  );
  assert.equal(result.footerExists, true);
  assert.equal(result.nestedInContact, false, 'footer is still nested inside #contact');
  assert.equal(result.sameParent, true, 'footer is not a sibling of #contact');
});
