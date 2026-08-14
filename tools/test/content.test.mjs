import test from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from '../test-support/helpers.mjs';

const IDS = ['hero','thesis','proof','film','what-we-do','how-it-works','capabilities',
             'loyalty-monitor','clients','global','insights','careers','contact'];

test('all thirteen sections exist in spec order', async () => {
  const ids = await withPage((page) =>
    page.evaluate(() => [...document.querySelectorAll('main section')].map((s) => s.id))
  );
  assert.deepEqual(ids, IDS);
});

test('the tagline appears only as the whole phrase', async () => {
  const text = await withPage((page) => page.evaluate(() => document.body.innerText));
  assert.ok(text.includes('Inspiring loyalty'));
  const halves = (text.match(/Inspiring loyalty/g) ?? []).length;
  const wholes = (text.match(/Inspiring loyalty\.\s*Creating value\./g) ?? []).length;
  assert.equal(halves, wholes, 'a half-tagline appears without its partner');
});

test('exactly three sections use the dark chamber surface', async () => {
  const dark = await withPage((page) =>
    page.evaluate(() => [...document.querySelectorAll('main section.theme-dark')].map((s) => s.id))
  );
  assert.deepEqual(dark, ['hero', 'film', 'loyalty-monitor']);
});

test('every content image declares intrinsic dimensions', async () => {
  const bad = await withPage((page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('main img')]
        .filter((i) => !i.getAttribute('width') || !i.getAttribute('height'))
        .map((i) => i.getAttribute('src'))
    )
  );
  assert.deepEqual(bad, [], 'images without width/height cause layout shift');
});
