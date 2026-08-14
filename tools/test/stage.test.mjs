import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

test('stage boots a WebGL renderer with DPR capped at 1.75', async () => {
  const info = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccStage, null, { timeout: 8000 });
    return page.evaluate(() => ({
      dpr: window.__tccStage.renderer.getPixelRatio(),
      canvasIsStage: window.__tccStage.renderer.domElement.id === 'stage',
    }));
  });
  assert.ok(info.dpr <= 1.75, `dpr ${info.dpr} exceeds cap`);
  assert.equal(info.canvasIsStage, true);
});

// A1: the test above asserts `dpr <= 1.75` at the default deviceScaleFactor
// (1), which is trivially true whether or not `Math.min(x, 1.75)` exists in
// Stage.js — it would pass even against a regression that deleted the clamp
// entirely. Drive a real high-DPR device so the clamp has something to do:
// devicePixelRatio reports 3, and only the clamp keeps getPixelRatio() at
// 1.75 rather than passing 3 straight through.
test('the DPR clamp actually reduces a high-DPR device to 1.75', async () => {
  const { chromium } = await import('playwright');
  const { startServer } = await import('../serve.mjs');
  const server = await startServer(0);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 3,
  });
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__tccStage, null, { timeout: 8000 });
  const result = await page.evaluate(() => ({
    reportedDpr: window.devicePixelRatio,
    rendererDpr: window.__tccStage.renderer.getPixelRatio(),
  }));
  await browser.close();
  await server.close();
  assert.equal(result.reportedDpr, 3, 'test setup did not actually raise devicePixelRatio');
  assert.equal(result.rendererDpr, 1.75, `clamp did not engage: renderer dpr was ${result.rendererDpr}`);
});

test('the raf loop pauses when the tab is hidden', async () => {
  const stalled = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccStage, null, { timeout: 8000 });
    // Let a few real frames land first so "before" isn't 0 by coincidence.
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const before = await page.evaluate(() => window.__tccStage.frames);
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => window.__tccStage.frames);
    return after === before;
  });
  assert.equal(stalled, true, 'raf kept running while hidden');
});

test('the raf loop resumes when the tab becomes visible again', async () => {
  const resumed = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccStage, null, { timeout: 8000 });
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(200);
    const stoppedAt = await page.evaluate(() => window.__tccStage.frames);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.__tccStage.frames);
    return after > stoppedAt;
  });
  assert.equal(resumed, true, 'raf did not resume after visibility returned');
});

test('the canvas is hidden from assistive technology', async () => {
  const hidden = await withPage((page) =>
    page.evaluate(() => document.getElementById('stage').getAttribute('aria-hidden'))
  );
  assert.equal(hidden, 'true');
});

test('a live stage makes the hero transparent so the canvas shows through', async () => {
  const result = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccStage, null, { timeout: 8000 });
    return page.evaluate(() => ({
      stageLive: document.documentElement.classList.contains('stage-live'),
      heroBg: getComputedStyle(document.getElementById('hero')).backgroundColor,
    }));
  });
  assert.equal(result.stageLive, true, 'html.stage-live not set when renderer boots');
  assert.equal(result.heroBg, 'rgba(0, 0, 0, 0)', `hero background not transparent: ${result.heroBg}`);
});

test('without WebGL the hero keeps its opaque dark background', async () => {
  const { chromium } = await import('playwright');
  const { startServer } = await import('../serve.mjs');
  const server = await startServer(0);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => ({
    stageDefined: 'stage' in window && window.__tccStage !== undefined,
    stageLive: document.documentElement.classList.contains('stage-live'),
    heroBg: getComputedStyle(document.getElementById('hero')).backgroundColor,
  }));
  await browser.close();
  await server.close();
  assert.equal(result.stageLive, false, 'stage-live set despite WebGL being unavailable');
  assert.notEqual(result.heroBg, 'rgba(0, 0, 0, 0)', 'hero went transparent with no renderer');
});

// A2: dispose() only ever walked the scene graph. Anything built off the
// scene graph — a PMREM environment map and its render target, in
// particular — is invisible to scene.traverse() and leaked. addDisposer()
// is an escape hatch for that; this proves dispose() actually calls it.
test('dispose() calls disposers registered via addDisposer', async () => {
  const called = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccStage, null, { timeout: 8000 });
    return page.evaluate(() => {
      let called = false;
      window.__tccStage.addDisposer(() => { called = true; });
      window.__tccStage.dispose();
      return called;
    });
  });
  assert.equal(called, true, 'dispose() did not invoke a registered disposer');
});

// A2 continued: Material.dispose() does not cascade to its texture maps
// (three.js leaves that to the caller, since maps are often shared). A
// dispose() that only calls material.dispose() during scene.traverse()
// leaks every texture attached to a scene material.
test('dispose() disposes texture maps attached to scene materials', async () => {
  const textureDisposed = await withPage(async (page) => {
    await page.waitForFunction(() => window.__tccStage, null, { timeout: 8000 });
    return page.evaluate(() => {
      const THREE = window.__tccStage.THREE;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 4;
      const texture = new THREE.CanvasTexture(canvas);
      let disposed = false;
      texture.addEventListener('dispose', () => { disposed = true; });
      const material = new THREE.MeshBasicMaterial({ map: texture });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
      window.__tccStage.scene.add(mesh);
      window.__tccStage.dispose();
      return disposed;
    });
  });
  assert.equal(textureDisposed, true, 'a material\'s texture map was left disposed=false after dispose()');
});
