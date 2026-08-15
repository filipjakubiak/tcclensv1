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
    for (const frac of [0, 0.02, 0.26, 0.32, 0.42, 0.5, 0.58, 0.66]) {
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

test('tinted sections keep their copy legible over the brand gradient', async () => {
  // These sections paint their own background, so the WebGL guard above
  // skips them by design — which would leave the per-section gradients
  // completely unchecked. Composites the --canvas veil over each stop of the
  // section's gradient and tests the worst of the two.
  const rows = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccReady, null, { timeout: 15000 });
    return page.evaluate(() => {
      const num = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
      const out = [];

      for (const sec of document.querySelectorAll('main > section[data-tint]')) {
        const cs = getComputedStyle(sec);
        // Read the tokens directly rather than parsing the composited
        // background-image string — splitting layered gradients on commas is
        // fragile, and the tokens are the actual source of truth.
        const veilRaw = cs.getPropertyValue('--veil').trim();
        const tintRaw = cs.getPropertyValue('--tint').trim();
        const veil = num(veilRaw);
        const veilAlpha = Number(veilRaw.match(/rgba?([^)]*?([d.]+)s*)/)?.[1] ?? 1);
        const stops = (tintRaw.match(/rgba?([^)]*)|#[0-9a-fA-F]{3,8}/g) ?? []).map((s) =>
          s.startsWith('#')
            ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
            : num(s)
        );
        if (!stops.length) { out.push({ id: sec.id, error: 'no gradient stops in --tint: ' + tintRaw }); continue; }

        for (const el of sec.querySelectorAll('p, h2, h3, .eyebrow')) {
          const es = getComputedStyle(el);
          if (es.display === 'none') continue;
          // Skip copy sitting on a card, which paints its own surface.
          let n = el.parentElement, carded = false;
          while (n && n !== sec) {
            const b = getComputedStyle(n).backgroundColor;
            if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { carded = true; break; }
            n = n.parentElement;
          }
          if (carded) continue;

          const fg = num(es.color);
          const size = parseFloat(es.fontSize);
          for (const stop of stops) {
            out.push({ id: sec.id, size, fg, bg: over(veil, veilAlpha, stop),
                       text: el.textContent.trim().slice(0, 30) });
          }
        }
      }
      return out;
    });
  });

  assert.ok(rows.length >= 10, `only ${rows.length} checks across the tinted sections`);
  const bad = [];
  for (const r of rows) {
    if (r.error) { bad.push(`${r.id}: ${r.error}`); continue; }
    const l1 = Math.max(LUM(r.fg), LUM(r.bg)), l2 = Math.min(LUM(r.fg), LUM(r.bg));
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const need = r.size >= 24 ? 3 : 4.5;
    if (ratio < need) {
      bad.push(`#${r.id} ${ratio.toFixed(2)}:1 (need ${need}) at ${Math.round(r.size)}px — "${r.text}"`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join('\n  ')}\n`);
});
