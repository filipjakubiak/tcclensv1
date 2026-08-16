import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { withPage } from '../test-support/helpers.mjs';

/**
 * The closing CTA's pointer-following light must not eat its own copy.
 *
 * #contact is the densest colour on the page — its veil is 62% where body
 * sections use 68% — and the fluid layer adds more light on top of that. The
 * token-maths guard in tinted-contrast.test.mjs cannot see it: that test
 * composites --veil over --tint and knows nothing about a radial gradient
 * positioned by JS at runtime.
 *
 * So this measures the real pixels, with the light parked in the worst place
 * it can be: directly behind the copy.
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
 * Every [data-fluid] section, with the light parked on its own body copy.
 * Driven off the attribute rather than a hardcoded list, so a third fluid
 * section cannot be added later without inheriting this guard.
 */
const CASES = [
  { section: 'contact', copy: '.contact__lede' },
  { section: 'loyalty-monitor', copy: '.monitor__note' },
];

const probe = ({ section, copy }) =>
  withPage(async (page) => {
    await page.waitForTimeout(600);
    // Centre the COPY in the viewport, not the section top. #loyalty-monitor
    // is a 100vh grid whose note sits below two display-scale figures, so
    // scrolling to the section left the sampled element off-screen entirely
    // and every pixel read came back undefined (NaN contrast, not a failure).
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const b = el.getBoundingClientRect();
      window.scrollTo(0, b.top + window.scrollY - (window.innerHeight - b.height) / 2);
    }, copy);
    await page.waitForTimeout(700);

    // Park the pointer ON the copy, so the brightest part of the radial sits
    // exactly where the text has to be read. Several moves, because the light
    // eases toward the target rather than snapping — one event would sample it
    // still travelling and understate the peak.
    const box = await page.evaluate((sel) => {
      const b = document.querySelector(sel).getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, top: b.top, left: b.left, w: b.width, h: b.height };
    }, copy);
    for (let i = 0; i < 8; i += 1) {
      await page.mouse.move(box.x, box.y);
      await page.waitForTimeout(90);
    }

    const png = await page.screenshot();
    const colour = await page.evaluate(
      (sel) => getComputedStyle(document.querySelector(sel)).color,
      copy
    );
    return { png: png.toString('base64'), colour, box };
  });

test('every fluid section stays legible with the light behind its copy', async () => {
  for (const c of CASES) {
    await checkOne(c);
  }
});

async function checkOne(c) {
  const r = await probe(c);

  const img = sharp(Buffer.from(r.png, 'base64'));
  const { width, height, channels } = await img.metadata();
  const raw = await img.raw().toBuffer();

  // Sample a band of background just left of the copy — inside the section and
  // inside the light, but clear of the glyphs themselves. Returns null rather
  // than reading past the buffer: an out-of-bounds read yields undefined,
  // which propagates to a NaN ratio that compares false against any floor and
  // reports as a contrast failure that never happened.
  const px = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const i = (Math.round(y) * width + Math.round(x)) * channels;
    const out = [raw[i], raw[i + 1], raw[i + 2]];
    return out.every((v) => Number.isFinite(v)) ? out : null;
  };

  const fg = r.colour.match(/[\d.]+/g).slice(0, 3).map(Number);
  const samples = [];
  for (let dy = 4; dy < r.box.h - 4; dy += 6) {
    const s = px(Math.max(2, r.box.left - 12), r.box.top + dy);
    if (s) samples.push(s);
  }
  assert.ok(
    samples.length >= 3,
    `only ${samples.length} in-bounds samples for #${c.section} — the copy was not on screen where expected`
  );

  const worst = Math.min(...samples.map((bg) => ratio(fg, bg)));
  assert.ok(
    worst >= 4.5,
    `the fluid light drops #${c.section} copy to ${worst.toFixed(2)}:1 against a 4.5 floor`
  );
}
