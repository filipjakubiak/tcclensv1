import { initNav } from './motion/nav.js';
import { initLenis, initReveals, motionEnabled } from './motion/reveal.js';
import { initCursor, initMagnetic } from './motion/cursor.js';
import { initCounters } from './motion/counters.js';
import { createStage } from './stage/Stage.js';

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
}

initStage();
