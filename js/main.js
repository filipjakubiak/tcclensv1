import { initNav } from './motion/nav.js';
import { initLenis, initReveals, motionEnabled } from './motion/reveal.js';
import { initCursor, initMagnetic } from './motion/cursor.js';
import { initCounters } from './motion/counters.js';
import { createStage } from './stage/Stage.js';
import { buildEnvironment } from './stage/env.js';
import { createLensMark } from './stage/LensMark.js';
import { createDirector, mountDebugScrub } from './stage/SceneDirector.js';
import act1 from './stage/acts/act1-threshold.js';

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

  // Task 12: the act director replaces Task 11's temporary idle rotation.
  // Acts are registered as placeholders here and swapped for real modules
  // by Tasks 13–16, keeping the same id and range.
  const ctx = { stage, lens, env, THREE: stage.THREE };
  const director = createDirector(stage, ctx);
  director.register(act1);
  for (const [id, range] of [
    ['headheart', [0.22, 0.55]],
    ['prism',     [0.55, 0.82]],
    ['close',     [0.82, 1.00]],
  ]) director.register({ id, range });

  // Park on the opening framing BEFORE attaching scroll. ScrollTrigger with
  // scrub only calls back once the user actually scrolls, so without this no
  // act is ever entered and no update() runs on first paint — every act would
  // render at its build() defaults until the first wheel event. 0.04 is far
  // enough into Act 1 to be its settled hero framing rather than frame zero,
  // and it is the same value ?shot=1 and reduced motion rest at.
  director.setProgress(0.04);
  if (motionEnabled()) director.attachScroll();
  mountDebugScrub(director);

  window.__tccEnv = env;
  // Published last, and only here: every stage test boots on this rather
  // than on __tccStage / __tccLens / __tccDirector, each of which appears
  // partway through this function and would race whatever follows it.
  window.__tccReady = true;
}

initStage();
