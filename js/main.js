import { initNav } from './motion/nav.js';
import { initLenis, initReveals, motionEnabled } from './motion/reveal.js';

initNav();
initLenis();
initReveals();

if (!motionEnabled()) document.documentElement.classList.add('motion-off');
