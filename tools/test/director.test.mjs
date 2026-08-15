import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

// Boot on __tccReady, not on __tccDirector: the director publishes itself
// before main.js has finished registering acts and mounting the debug UI,
// so waiting on it would race the very things these tests assert.
const boot = (page) => page.waitForFunction(() => window.__tccReady, null, { timeout: 10000 });

test('global progress maps to the correct act and local t', async () => {
  // Asserted against the director's OWN ranges rather than the plan's fixed
  // fractions. Those fractions turned out not to match the page: the hero is
  // ~7% of the document, not the 22% Act 1 was given, so the ranges are now
  // derived from where each act's section actually sits. Hardcoding numbers
  // here would only re-assert the arithmetic that was wrong.
  const r = await withPage(async (page) => {
    await boot(page);
    return page.evaluate(() => {
      const d = window.__tccDirector;
      const out = [];
      for (const act of d.acts) {
        const [s, e] = act.range;
        for (const local of [0, 0.5, 0.999]) {
          d.setProgress(s + (e - s) * local);
          out.push({ want: act.id, got: d.activeAct.id, local, t: +d.activeAct._t.toFixed(3) });
        }
      }
      d.setProgress(1);
      return { out, atEnd: { id: d.activeAct.id, t: d.activeAct._t }, last: d.acts.at(-1).id,
               ranges: d.acts.map((a) => [a.id, +a.range[0].toFixed(3), +a.range[1].toFixed(3)]) };
    });
  });

  // The ranges must tile [0,1] with no gap and no overlap.
  let cursor = 0;
  for (const [id, start, end] of r.ranges) {
    assert.ok(Math.abs(start - cursor) < 1e-6, `${id} starts at ${start}, expected ${cursor}`);
    assert.ok(end > start, `${id} has an empty or inverted range`);
    cursor = end;
  }
  assert.ok(Math.abs(cursor - 1) < 1e-6, `acts cover only up to ${cursor}`);

  for (const c of r.out) {
    assert.equal(c.got, c.want, `progress inside ${c.want} resolved to ${c.got}`);
    assert.ok(Math.abs(c.t - c.local) < 0.01, `local t was ${c.t}, expected ${c.local} in ${c.want}`);
  }
  assert.equal(r.atEnd.id, r.last, 'the final act must own progress 1');
  assert.equal(r.atEnd.t, 1);
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
      setLocal(d, 'threshold', 0.5);
      log.length = 0;       // ignore whatever act we were parked in
      setLocal(d, 'headheart', 0.3);
      setLocal(d, 'headheart', 0.6); // same act, must not re-fire
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
    return page.evaluate(() => {
      const d = window.__tccDirector;
      // Which act owns 0.6 depends on the page's section layout, so ask the
      // director rather than assuming — that assumption is exactly what went
      // wrong with the plan's fixed act fractions.
      const owner = d.acts.filter((a) => 0.6 >= a.range[0]).at(-1);
      return {
        progress: d.progress,
        id: d.activeAct.id,
        expected: owner.id,
        label: document.querySelector('#tcc-debug span').textContent,
      };
    });
  }, '/?debug=1');
  assert.equal(r.progress, 0.6);
  assert.equal(r.id, r.expected);
  assert.equal(r.label, `0.600 · ${r.expected}`);
});
