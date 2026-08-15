import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

// Boot on __tccReady, not on __tccDirector: the director publishes itself
// before main.js has finished registering acts and mounting the debug UI,
// so waiting on it would race the very things these tests assert.
const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 10000 });

test('global progress maps to the correct act and local t', async () => {
  const cases = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() =>
      [0.0, 0.11, 0.22, 0.385, 0.55, 0.685, 0.82, 1.0].map((p) => {
        window.__tccDirector.setProgress(p);
        return { p, id: window.__tccDirector.activeAct.id, t: +window.__tccDirector.activeAct._t.toFixed(3) };
      })
    );
  });
  const byP = Object.fromEntries(cases.map((c) => [c.p, c]));
  assert.equal(byP[0.0].id, 'threshold');
  assert.equal(byP[0.11].t, 0.5);
  assert.equal(byP[0.22].id, 'headheart');
  assert.equal(byP[0.385].t, 0.5);
  assert.equal(byP[0.55].id, 'prism');
  assert.equal(byP[0.82].id, 'close');
  assert.equal(byP[1.0].t, 1);
});

test('an act is active and updated before any scroll happens', async () => {
  // ScrollTrigger with scrub only calls back once the user scrolls, so a
  // director that waits for it leaves every act at its build() defaults on
  // first paint. main.js parks on the opening framing explicitly; this is
  // the regression guard for that.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      let updated = null;
      const d = window.__tccDirector;
      d.acts[0].update = (t) => { updated = t; };
      return { id: d.activeAct?.id ?? null, progress: d.progress, updatesOnReplay: (d.setProgress(d.progress), updated) };
    });
  });
  assert.equal(r.id, 'threshold', 'no act was active on load');
  assert.ok(r.progress > 0 && r.progress < 0.22, `progress ${r.progress} is not inside Act 1`);
  assert.ok(r.updatesOnReplay !== null, 'setProgress did not drive the active act update');
});

test('progress is clamped outside 0..1', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      window.__tccDirector.setProgress(-3);
      const lo = window.__tccDirector.progress;
      window.__tccDirector.setProgress(9);
      return { lo, hi: window.__tccDirector.progress };
    });
  });
  assert.equal(r.lo, 0);
  assert.equal(r.hi, 1);
});

test('crossing an act boundary fires exit on the old act and enter on the new', async () => {
  const calls = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector;
      const log = [];
      for (const a of d.acts) {
        a.enter = () => log.push(`enter:${a.id}`);
        a.exit = () => log.push(`exit:${a.id}`);
      }
      d.setProgress(0.1);   // settle into threshold
      log.length = 0;       // ignore whatever act we were parked in
      d.setProgress(0.3);   // threshold -> headheart
      d.setProgress(0.35);  // same act, must not re-fire
      return log;
    });
  });
  assert.deepEqual(calls, ['exit:threshold', 'enter:headheart']);
});

test('the debug scrub UI appears only with ?debug=1', async () => {
  const off = await withPage(async (page) => {
    await boot(page);
    return page.locator('#tcc-debug').count();
  });
  const on = await withPage(async (page) => {
    await boot(page);
    return {
      count: await page.locator('#tcc-debug').count(),
      label: await page.locator('#tcc-debug span').textContent(),
    };
  }, '/?debug=1');
  assert.equal(off, 0);
  assert.equal(on.count, 1);
  // The instrument must report the act it is actually parked in on first
  // paint, not a hardcoded placeholder.
  assert.match(on.label, /^0\.\d{3} · (threshold|headheart|prism|close)$/, on.label);
});

test('the debug slider drives the director and reports the active act', async () => {
  const r = await withPage(async (page) => {
    await boot(page);
    await page.locator('#tcc-debug input').fill('600');
    await page.locator('#tcc-debug input').dispatchEvent('input');
    return page.evaluate(() => ({
      progress: window.__tccDirector.progress,
      id: window.__tccDirector.activeAct.id,
      label: document.querySelector('#tcc-debug span').textContent,
    }));
  }, '/?debug=1');
  assert.equal(r.progress, 0.6);
  assert.equal(r.id, 'prism');
  assert.equal(r.label, '0.600 · prism');
});
