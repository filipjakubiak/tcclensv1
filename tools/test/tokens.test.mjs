import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { withPage, cssVar } from '../test-support/helpers.mjs';

const EXPECTED = {
  '--canvas': '#FCFCFC', '--chamber': '#08070A', '--ink': '#000000',
  '--ink-2': '#4A4E57', '--ink-3': '#7C828C',
  '--accent': '#D380EB', '--support': '#B1BDCE',
};

test('every brand colour token resolves to its exact spec value', async () => {
  const actual = await withPage(async (page) => {
    const out = {};
    for (const name of Object.keys(EXPECTED)) out[name] = await cssVar(page, name);
    return out;
  });
  for (const [name, want] of Object.entries(EXPECTED)) {
    assert.equal(actual[name].toUpperCase(), want, `${name} drifted`);
  }
});

test('the five capability gradients are all defined', async () => {
  const names = ['performance', 'insight', 'creativity', 'operational', 'sustainability'];
  const vals = await withPage(async (page) => {
    const out = [];
    for (const n of names) out.push(await cssVar(page, `--grad-${n}`));
    return out;
  });
  vals.forEach((v, i) => assert.ok(v.includes('gradient'), `--grad-${names[i]} missing`));
});

test('no hex literal appears outside tokens.css', async () => {
  const dir = path.resolve('../css');
  const offenders = [];
  for (const file of await readdir(dir)) {
    if (file === 'tokens.css') continue;
    const src = await readFile(path.join(dir, file), 'utf8');
    const hits = src.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hits) offenders.push(`${file}: ${hits.join(', ')}`);
  }
  assert.deepEqual(offenders, [], 'rogue hex found');
});
