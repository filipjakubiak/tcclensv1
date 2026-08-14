import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { startServer } from './serve.mjs';

const JOBS = [
  { file: 'brand-film.mp4',      at: [1.5, 4, 8, 13, 20] },
  { file: 'home-banner.mp4',     at: [0.8, 3, 6] },
  { file: 'loyalty-monitor.mp4', at: [1, 5, 10] },
];

await mkdir('../assets/media/stills', { recursive: true });
const server = await startServer(4399);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
// Establish a real http origin so page-context fetch() below is allowed.
await page.goto(`${server.url}/`).catch(() => {});

let total = 0;
for (const job of JOBS) {
  await page.setContent(
    `<body style="margin:0;background:#000">
       <video id="v" width="1600" muted playsinline></video>
     </body>`
  );
  const video = page.locator('#v');
  // serve.mjs does not support HTTP Range requests, so a plain <video src>
  // never gets a seekable range beyond what's already buffered (seekable
  // stays [0,0] and currentTime silently snaps back to 0 on every seek).
  // Fetching the whole file into a Blob and pointing the video at a blob:
  // URL gives it the complete resource locally, so every timestamp below
  // is truly seekable.
  await page.evaluate(async (src) => {
    const resp = await fetch(src);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const v = document.querySelector('#v');
    v.src = url;
    await new Promise((res) => v.addEventListener('loadedmetadata', res, { once: true }));
  }, `${server.url}/assets/media/${job.file}`);
  await page.waitForFunction(() => document.querySelector('#v').readyState >= 2);

  for (const [i, t] of job.at.entries()) {
    await page.evaluate((sec) => {
      const v = document.querySelector('#v');
      return new Promise((res) => {
        v.addEventListener('seeked', res, { once: true });
        v.currentTime = sec;
      });
    }, t);
    const name = job.file.replace('.mp4', '');
    await video.screenshot({ path: `../assets/media/stills/${name}-${i + 1}.jpg`, quality: 88, type: 'jpeg' });
    console.log(`${name}-${i + 1}.jpg @ ${t}s`);
    total += 1;
  }
}
console.log(`wrote ${total} stills`);

await browser.close();
await server.close();
