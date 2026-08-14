import { initNav } from './motion/nav.js';
import { initLenis, initReveals, motionEnabled } from './motion/reveal.js';
import { initCursor, initMagnetic } from './motion/cursor.js';
import { initCounters } from './motion/counters.js';
import { createStage } from './stage/Stage.js';
import { buildEnvironment } from './stage/env.js';
import { createLensMark } from './stage/LensMark.js';

initNav();
initLenis();
initReveals();
initCursor();
initMagnetic();
initCounters();

if (!motionEnabled()) document.documentElement.classList.add('motion-off');

// RULING 1: top-level `await` inside a block is a syntax error, so all
// stage bootstrapping (this task's WebGL stage, and every later task's
// glass mark / act director / acts) lives inside this async function,
// declared at module top level and invoked once at the end of this file.
async function initStage() {
  const stage = createStage();
  if (!stage) return; // no WebGL — html keeps its default (no stage-live class)

  window.__tccStage = stage;
  // RULING 2: only flip the hero transparent once the renderer is actually
  // running. With no JS, no WebGL, or a failed renderer, #hero keeps its
  // var(--chamber) background from CSS and stays dark and readable.
  document.documentElement.classList.add('stage-live');

  // Task 11: the procedural brand environment and the glass LensMark —
  // the centrepiece every later act (director, doors, split, prism,
  // resolve) moves. Only the LensMark uses transmission — the single
  // largest per-frame WebGL cost — so it must stay the one object.
  //
  // lens.group must stay centred at the origin and ~2 units tall — later
  // tasks (and tools/test/lens.test.mjs) depend on that invariant, so
  // visibility in the hero viewport is tuned via the camera, not by
  // moving or scaling the mark itself.
  const env = buildEnvironment(stage);
  const lens = await createLensMark(stage);

  stage.camera.position.set(1.3, 0.5, 4.2);
  stage.camera.lookAt(0, 0, 0);

  // The glass leans on the environment map for its refraction and
  // dispersion, but a soft key light gives the clearcoat something
  // crisp to specular-highlight against.
  const key = new stage.THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 2, 5);
  stage.scene.add(key);
  const rim = new stage.THREE.DirectionalLight(0xd380eb, 1.5); // --accent
  rim.position.set(3, -1, -3);
  stage.scene.add(rim);
  stage.addDisposer(() => { stage.scene.remove(key); stage.scene.remove(rim); }); // Light has no dispose() to call

  // Temporary idle rotation so the glass has something to catch the
  // environment with before Task 12's act director takes over.
  stage.addUpdater((t) => {
    lens.group.rotation.y = Math.sin(t * 0.25) * 0.35;
    lens.group.rotation.x = Math.sin(t * 0.18) * 0.06;
  });

  window.__tccEnv = env;
}

initStage();
