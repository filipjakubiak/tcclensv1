import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = '../assets/img';
const OUT = '../assets/img/optimized';
const WIDTHS = [640, 1024, 1600];
const RASTER = /\.(png|jpe?g)$/i;

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'optimized') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (RASTER.test(e.name)) yield p;
  }
}

await mkdir(OUT, { recursive: true });

// Detect duplicate basenames across the whole source tree before running —
// the optimiser flattens output paths to `<basename>-<width>.<ext>`, so two
// source files sharing a basename in different folders would silently
// overwrite each other's derivatives.
const seen = new Map();
const collisions = new Map();
for await (const file of walk(SRC)) {
  const base = path.basename(file).replace(RASTER, '');
  if (seen.has(base)) {
    if (!collisions.has(base)) collisions.set(base, [seen.get(base)]);
    collisions.get(base).push(file);
  } else {
    seen.set(base, file);
  }
}
if (collisions.size) {
  console.warn(`WARNING: ${collisions.size} duplicate basename(s) found — outputs would collide:`);
  for (const [base, files] of collisions) console.warn(`  ${base}: ${files.join(', ')}`);
} else {
  console.log('no duplicate basenames found across source tree');
}

let n = 0;
const failures = [];
for await (const file of walk(SRC)) {
  let base = path.basename(file).replace(RASTER, '');
  // Disambiguate any colliding basename by prefixing the parent directory
  // rather than letting one overwrite the other silently.
  if (collisions.has(base)) {
    base = `${path.basename(path.dirname(file))}-${base}`;
  }
  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch (err) {
    console.error(`FAILED to read ${file}: ${err.message}`);
    failures.push(file);
    continue;
  }
  for (const w of WIDTHS) {
    if (meta.width && meta.width < w) continue;
    try {
      const pipe = sharp(file).resize({ width: w, withoutEnlargement: true });
      await pipe.clone().avif({ quality: 55 }).toFile(`${OUT}/${base}-${w}.avif`);
      await pipe.clone().webp({ quality: 78 }).toFile(`${OUT}/${base}-${w}.webp`);
      n += 2;
    } catch (err) {
      console.error(`FAILED to encode ${file} at width ${w}: ${err.message}`);
      failures.push(`${file} @ ${w}`);
    }
  }
}
console.log(`wrote ${n} derivatives`);
if (failures.length) {
  console.log(`${failures.length} failure(s): ${failures.join('; ')}`);
}
