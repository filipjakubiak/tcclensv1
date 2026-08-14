import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';
import { startServer } from '../serve.mjs';

test('page serves with the TCC title', async () => {
  const title = await withPage((page) => page.title());
  assert.match(title, /TCC/);
});

test('page exposes the WebGL stage canvas', async () => {
  const has = await withPage((page) => page.locator('canvas#stage').count());
  assert.equal(has, 1);
});

test('refuses to serve files outside the project root', async () => {
  const server = await startServer(0);
  try {
    // %2f survives the URL parser's own dot-segment normalization (which
    // only collapses literal '/'-separated segments), so after our decode
    // step this reaches path.join() as a real '..' that resolves to a
    // sibling directory whose name happens to start with the root's name.
    const res = await fetch(`${server.url}/..%2ftcc-lens-secret/creds.txt`);
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});
