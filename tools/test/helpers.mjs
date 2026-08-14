import { chromium } from 'playwright';
import { startServer } from '../serve.mjs';

export async function withPage(fn, query = '') {
  const server = await startServer(0);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
