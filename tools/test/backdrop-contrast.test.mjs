import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

/**
 * Contrast measured against what is ACTUALLY BEHIND the text.
 *
 * tokens.test.mjs checks brand colours against --canvas, and that was a fair
 * description of the page until the WebGL backdrop existed. It no longer is:
 * `#stage` is a fixed canvas above `body`'s --canvas fill and below `main`,
 * and only .theme-dark sections paint a background of their own. So for every
 * light section, the thing behind the copy is whatever the gradient field is
 * currently rendering — and no token-based test can see that.
 *
 * At full gradient strength this caught eyebrows at 2.01:1 and body copy at
 * 4.19:1, both AA failures, on a suite that was otherwise green.
 */

const LUM = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

async function sampleAt(page, frac) {
  await page.evaluate((v) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: max * v, behavior: 'instant' });
  }, frac);
  await page.waitForTimeout(1400); // Lenis + ScrollTrigger scrub:1 settle

  return page.evaluate(() => {
    const S = window.__tccStage;
    const gl = S.renderer.getContext();
    S.renderer.render(S.scene, S.camera);
    const dpr = S.renderer.getPixelRatio();
    const out = [];

    for (const el of document.querySelectorAll('p, .eyebrow, h1, h2')) {
      const r = el.getBoundingClientRect();
      if (r.top < 90 || r.bottom > window.innerHeight || r.width < 40) continue;

      // Only sample text with nothing opaque painted behind it — those are
      // the runs sitting directly on the canvas.
      let node = el, painted = false;
      while (node && node !== document.body) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { painted = true; break; }
        node = node.parentElement;
      }
      if (painted) continue;

      const buf = new Uint8Array(4);
      gl.readPixels(
        Math.round((r.left + 4) * dpr),
        Math.round((window.innerHeight - (r.top + r.height / 2)) * dpr),
        1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf
      );
      const cs = getComputedStyle(el);
      out.push({
        text: el.textContent.trim().slice(0, 40),
        size: parseFloat(cs.fontSize),
        weight: Number(cs.fontWeight) || 400,
        fg: cs.color.match(/\d+/g).slice(0, 3).map(Number),
        bg: [buf[0], buf[1], buf[2]],
      });
    }
    return out;
  });
}

test('copy stays legible against the live WebGL backdrop', async () => {
  const failures = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });
    await page.waitForTimeout(800);

    const bad = [];
    let sampled = 0;
    // Across Act 2 and into Act 3, where the gradient field is the page's
    // background rather than --canvas.
    for (const frac of [0.26, 0.32, 0.42, 0.5, 0.58, 0.66]) {
      for (const row of await sampleAt(page, frac)) {
        sampled += 1;
        const large = row.size >= 24 || (row.size >= 18.66 && row.weight >= 700);
        const need = large ? 3.0 : 4.5;
        const l1 = Math.max(LUM(row.fg), LUM(row.bg));
        const l2 = Math.min(LUM(row.fg), LUM(row.bg));
        const ratio = (l1 + 0.05) / (l2 + 0.05);
        if (ratio < need) {
          bad.push(`${ratio.toFixed(2)}:1 (need ${need}) at ${Math.round(row.size)}px over rgb(${row.bg}) — "${row.text}"`);
        }
      }
    }
    return { bad, sampled };
  });

  // Guard against the test silently measuring nothing.
  assert.ok(failures.sampled >= 6, `only sampled ${failures.sampled} text runs — the probe is not finding copy`);
  assert.deepEqual(failures.bad, [], `\n  ${failures.bad.join('\n  ')}\n`);
});
