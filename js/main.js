import { initNav } from './motion/nav.js';
import { initLenis, initReveals, motionEnabled } from './motion/reveal.js';
import { initCursor, initMagnetic } from './motion/cursor.js';
import { initCounters } from './motion/counters.js';

initNav();
initLenis();
initReveals();
initCursor();
initMagnetic();
initCounters();

if (!motionEnabled()) document.documentElement.classList.add('motion-off');
