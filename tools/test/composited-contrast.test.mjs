import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { withPage } from '../test-support/helpers.mjs';

/**
 * Contrast measured against the COMPOSITED PAGE, from a real screenshot.
 *
 * Two earlier instruments were wrong, in opposite directions:
 *
 * 1. tokens.test.mjs compares brand colours to --canvas. That stopped
 *    describing the page the moment a WebGL backdrop existed behind
 *    transparent sections.
 * 2. backdrop-contrast.test.mjs read pixels out of the WebGL buffer with
 *    gl.readPixels. That buffer knows nothing about the DOM painted on top
 *    of it — light sections veil the canvas at up to 92% --canvas — so it
 *    reported backdrops far darker than anything a visitor sees and failed
 *    on colours that were never on screen. It also sent an entire pass of
 *    glass-material tuning into a layer that the veil then multiplied by
 *    0.14.
 *
 * A screenshot is the only surface that is what the user actually sees:
 * canvas, veil, section tint and grain, composited in the right order.
 */

const LUM = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** Text runs in view, each with a sample point just outside its own box. */
const textRuns = (page) =>
  page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('p, .eyebrow, h1, h2, h3')) {
      const r = el.getBoundingClientRect();
      if (r.top < 90 || r.bottom > window.innerHeight || r.width < 40 || r.height < 6) continue;
      if (!el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.9) continue;
      out.push({
        text: el.textContent.trim().slice(0, 40),
        size: parseFloat(cs.fontSize),
        weight: Number(cs.fontWeight) || 400,
        fg: cs.color.match(/[\d.]+/g).slice(0, 3).map(Number),
        // Just left of the box: same background, no glyphs to average in.
        x: Math.max(2, Math.round(r.left - 6)),
        y: Math.round(r.top + r.height / 2),
      });
    }
    return out;
  });

test('copy stays legible against the composited page', async () => {
  const result = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });
    await page.waitForTimeout(900);

    const bad = [];
    let sampled = 0;

    for (const frac of [0, 0.02, 0.08, 0.2, 0.3, 0.45, 0.6, 0.75, 0.9]) {
      await page.evaluate((v) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: max * v, behavior: 'instant' });
      }, frac);
      await page.waitForTimeout(1300); // Lenis + ScrollTrigger scrub:1 settle

      const runs = await textRuns(page);
      if (!runs.length) continue;

      const png = await page.screenshot({ type: 'png' });
      const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });

      for (const run of runs) {
        if (run.x >= info.width || run.y >= info.height) continue;
        const i = (run.y * info.width + run.x) * info.channels;
        const bg = [data[i], data[i + 1], data[i + 2]];
        sampled += 1;

        const large = run.size >= 24 || (run.size >= 18.66 && run.weight >= 700);
        const need = large ? 3.0 : 4.5;
        const l1 = Math.max(LUM(run.fg), LUM(bg)), l2 = Math.min(LUM(run.fg), LUM(bg));
        const ratio = (l1 + 0.05) / (l2 + 0.05);
        if (ratio < need) {
          bad.push(`${ratio.toFixed(2)}:1 (need ${need}) ${Math.round(run.size)}px over rgb(${bg}) — "${run.text}" @${frac}`);
        }
      }
    }
    return { bad: [...new Set(bad)], sampled };
  });

  // Guard against the test silently measuring nothing.
  assert.ok(result.sampled >= 20, `only sampled ${result.sampled} text runs — the probe is not finding copy`);
  assert.deepEqual(result.bad, [], `\n  ${result.bad.join('\n  ')}\n`);
});
