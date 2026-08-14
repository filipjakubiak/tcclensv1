import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './helpers.mjs';

test('page serves with the TCC title', async () => {
  const title = await withPage((page) => page.title());
  assert.match(title, /TCC/);
});

test('page exposes the WebGL stage canvas', async () => {
  const has = await withPage((page) => page.locator('canvas#stage').count());
  assert.equal(has, 1);
});
