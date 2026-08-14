import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const exists = (p) => access(p).then(() => true, () => false);

test('asset pipeline: the logo mark used for 3D extrusion is present and has two paths', async () => {
  assert.ok(await exists('../assets/img/logo-icon.svg'));
  const svg = await readFile('../assets/img/logo-icon.svg', 'utf8');
  const paths = svg.match(/<path/g) ?? [];
  assert.equal(paths.length, 2, 'expected head circle + heart as separate paths');
});

test('asset pipeline: store interior plates for the Act 1 aisle exist', async () => {
  for (const f of ['deftera-store.jpg', 'newworld-store.jpg']) {
    assert.ok(await exists(`../assets/img/scraped/lifestyle/${f}`), f);
  }
});

test('asset pipeline: optimised derivatives were generated', async () => {
  assert.ok(await exists('../assets/img/optimized/careers-1024.avif'));
  assert.ok(await exists('../assets/img/optimized/careers-1024.webp'));
});
