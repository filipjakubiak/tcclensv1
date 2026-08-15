import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';

export async function withPage(fn, query = '') {
  const server = await startServer(0);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Act ranges are derived from real section offsets at runtime, so a
  // hardcoded global progress no longer names a known act. Tests say which
  // act they mean and how far into it.
  await page.addInitScript(() => {
    window.setLocal = (director, id, t) => {
      const act = director.acts.find((a) => a.id === id);
      if (!act) throw new Error(`no act named ${id}`);
      const [s, e] = act.range;
      director.setProgress(s + (e - s) * t);
      return director.progress;
    };
  });
  try {
    await page.goto(server.url + query, { waitUntil: 'load' });
    return await fn(page);
  } finally {
    await browser.close();
    await server.close();
  }
}

/** Read a CSS custom property off :root as a trimmed string. */
export const cssVar = (page, name) =>
  page.evaluate(
    (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name
  );
