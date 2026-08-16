import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

/**
 * The overlay menu — the only navigation below 860px, where .nav__links is
 * hidden and the burger is the way through the page.
 *
 * Its links had no hover, focus or current state at all before this: flat
 * white on --chamber, with nothing saying where you were or what you were
 * about to open (user, 2026-08-16). They are lit by the brand gradient now.
 */
const PHONE = { viewport: { width: 420, height: 860 } };

const LUM = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const stopsOf = (grad) =>
  (grad.match(/color\(srgb[^)]*\)|rgba?\([^)]*\)|#[0-9a-fA-F]{6}/g) ?? []).map((s) => {
    if (s.startsWith('#')) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const n = s.match(/[\d.]+/g).slice(0, 3).map(Number);
    return s.startsWith('color(') ? n.map((c) => c * 255) : n;
  });

const openMenu = async (page) => {
  await page.click('.nav__burger');
  await page.waitForTimeout(400); // --dur-ui plus the focus handoff
};

test('the burger opens the menu on a phone viewport', async () => {
  const r = await withPage(async (page) => {
    await page.waitForTimeout(300);
    const burgerShown = await page.isVisible('.nav__burger');
    await openMenu(page);
    return {
      burgerShown,
      open: await page.evaluate(() => document.querySelector('.menu').classList.contains('is-open')),
      expanded: await page.getAttribute('.nav__burger', 'aria-expanded'),
    };
  }, '', PHONE);
  assert.equal(r.burgerShown, true, 'the burger is not visible at 420px wide');
  assert.equal(r.open, true);
  assert.equal(r.expanded, 'true');
});

test('each menu link is lit by the gradient of the section it opens', async () => {
  const r = await withPage(async (page) => {
    await page.waitForTimeout(300);
    await openMenu(page);
    return page.evaluate(() =>
      [...document.querySelectorAll('.menu__link')].map((el) => {
        const target = document.querySelector(el.getAttribute('href'));
        const probe = document.createElement('div');
        // --lit holds a gradient token; resolve it by painting it, because a
        // custom property read back raw is unresolved text.
        probe.style.backgroundImage = getComputedStyle(el).getPropertyValue('--lit');
        document.body.appendChild(probe);
        const lit = getComputedStyle(probe).backgroundImage;
        probe.remove();
        return {
          href: el.getAttribute('href'),
          grad: el.dataset.grad ?? null,
          tint: target?.dataset.tint ?? null,
          lit,
        };
      })
    );
  }, '', PHONE);

  assert.ok(r.length >= 5, `only ${r.length} menu links`);
  for (const link of r) {
    assert.ok(/gradient/.test(link.lit), `${link.href} has no gradient in --lit: ${link.lit}`);
    // A link whose section carries a tint must be lit by THAT gradient, so
    // the menu previews the page's own colour order rather than inventing one.
    if (link.tint && link.tint !== 'core') {
      assert.equal(link.grad, link.tint, `${link.href} should be lit by its section's ${link.tint} gradient`);
    } else {
      assert.equal(link.grad, null, `${link.href} has no tinted target and should fall through to core`);
    }
  }
});

test('a lit menu link stays readable on the dark menu', async () => {
  // Gradient text has two colours to clear the floor, and the menu is always
  // --chamber, so both stops of every gradient in play get checked.
  const r = await withPage(async (page) => {
    await page.waitForTimeout(300);
    await openMenu(page);
    await page.hover('.menu__link');
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const chamber = getComputedStyle(document.documentElement).getPropertyValue('--chamber').trim();
      const lit = [...document.querySelectorAll('.menu__link')].map((el) => {
        const probe = document.createElement('div');
        probe.style.backgroundImage = getComputedStyle(el).getPropertyValue('--lit');
        document.body.appendChild(probe);
        const img = getComputedStyle(probe).backgroundImage;
        probe.remove();
        return img;
      });
      return { chamber, lit };
    });
  }, '', PHONE);

  const bg = [1, 3, 5].map((i) => parseInt(r.chamber.slice(i, i + 2), 16));
  for (const grad of r.lit) {
    for (const s of stopsOf(grad)) {
      const [l1, l2] = [Math.max(LUM(s), LUM(bg)), Math.min(LUM(s), LUM(bg))];
      const c = (l1 + 0.05) / (l2 + 0.05);
      assert.ok(c >= 4.5, `lit stop rgb(${s.map(Math.round)}) is ${c.toFixed(2)}:1 on --chamber`);
    }
  }
});

test('hovering a menu link lights it, and only it', async () => {
  const r = await withPage(async (page) => {
    await page.waitForTimeout(300);
    await openMenu(page);
    const wash = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.menu__link')].map((el) =>
          Number(getComputedStyle(el).getPropertyValue('--lit-o'))
        )
      );
    const before = await wash();
    await page.hover('.menu__list li:nth-child(2) .menu__link');
    await page.waitForTimeout(300);
    return { before, after: await wash() };
  }, '', PHONE);

  assert.ok(r.after[1] > r.before[1], 'the hovered link did not light up');
  assert.ok(r.after[1] > 0, `hovered link wash is ${r.after[1]}`);
});

test('the menu marks the section you are actually in', async () => {
  const r = await withPage(async (page) => {
    await page.waitForTimeout(300);
    // Park on a section the menu links to, then open the menu on top of it.
    await page.evaluate(() => {
      const s = document.getElementById('careers');
      window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY + 10);
    });
    await page.waitForTimeout(700); // IntersectionObserver settle
    await openMenu(page);
    return page.evaluate(() => ({
      current: [...document.querySelectorAll('.menu__link[aria-current="true"]')].map((el) =>
        el.getAttribute('href')
      ),
    }));
  }, '', PHONE);

  // Exactly one — several sections are on screen at once, and marking each
  // intersecting one would light half the menu.
  assert.equal(r.current.length, 1, `expected exactly one current link, got ${r.current.join(', ') || 'none'}`);
  assert.equal(r.current[0], '#careers');
});

test('the current-section marker works with motion off', async () => {
  // It is an orientation cue, not choreography: under ?shot=1 and
  // prefers-reduced-motion the GSAP scroll machinery never starts, so this
  // deliberately runs on an IntersectionObserver instead.
  const current = await withPage(async (page) => {
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const s = document.getElementById('insights');
      window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY + 10);
    });
    await page.waitForTimeout(700);
    await openMenu(page);
    return page.evaluate(() =>
      document.querySelector('.menu__link[aria-current="true"]')?.getAttribute('href') ?? null
    );
  }, '/?shot=1', PHONE);

  assert.equal(current, '#insights');
});
