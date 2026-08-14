import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

test('Neue Plak loads at all three weights', async () => {
  const loaded = await withPage((page) =>
    page.evaluate(async () => {
      await Promise.all(
        ['400', '600', '700'].map((w) => document.fonts.load(`${w} 16px "Neue Plak"`))
      );
      await document.fonts.ready;
      return ['400', '600', '700'].map((w) =>
        document.fonts.check(`${w} 16px "Neue Plak"`)
      );
    })
  );
  assert.deepEqual(loaded, [true, true, true]);
});

test('body inherits Neue Plak', async () => {
  const family = await withPage((page) =>
    page.evaluate(() => getComputedStyle(document.body).fontFamily)
  );
  assert.match(family, /Neue Plak/);
});
