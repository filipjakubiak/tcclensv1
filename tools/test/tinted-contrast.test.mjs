import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

/**
 * The tinted sections paint their own opaque brand gradient, so a screenshot
 * probe that samples 'just left of the text' can land on a card or an image
 * inside them. This checks the token maths directly instead: composite the
 * --canvas veil over each stop of the section's --tint and test the worse of
 * the two. Complements composited-contrast.test.mjs, which covers everything
 * showing the live canvas.
 */
const LUM = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

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
