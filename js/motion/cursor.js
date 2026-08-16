import { motionEnabled } from './reveal.js';

export function initCursor() {
  if (!motionEnabled()) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);

  // Hide the SYSTEM cursor, and only once the dot is actually on the page.
  // Set here rather than in the stylesheet on purpose: every early return
  // above (touch device, reduced motion, ?shot=1) means there is no dot, and
  // a CSS-only `cursor: none` would leave those readers with no pointer at
  // all. The class is the proof that a replacement exists.
  document.documentElement.classList.add('cursor-live');

  const { gsap } = window;
  const move = gsap.quickTo(dot, 'x', { duration: 0.25, ease: 'power3' });
  const moveY = gsap.quickTo(dot, 'y', { duration: 0.25, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { move(e.clientX); moveY(e.clientY); });

  document.querySelectorAll('a, button, [data-magnetic]').forEach((el) => {
    el.addEventListener('pointerenter', () => dot.classList.add('cursor--swell'));
    el.addEventListener('pointerleave', () => dot.classList.remove('cursor--swell'));
  });
}

export function initMagnetic() {
  if (!motionEnabled()) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const { gsap } = window;
  const MAX = 8;

  // Animates CUSTOM PROPERTIES, not x/y.
  //
  // GSAP's x/y write an inline `transform`, and an inline style outranks any
  // stylesheet rule — so `.btn:active { transform: scale(.97) }` stopped
  // applying to every magnetic element the moment this ran. That is the nav
  // CONTACT button, both hero CTAs, the monitor CTA, the careers link and the
  // closing CTA: essentially every primary button on the page had no press
  // feedback, and nothing failed to make it visible.
  //
  // Composing both through variables inside one CSS transform is the same
  // rule the surface kit follows for entrance vs tilt, arrived at the same
  // way — two owners of one property means whichever wrote last wins.
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * MAX;
      const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * MAX;
      gsap.to(el, { '--mag-x': `${dx.toFixed(2)}px`, '--mag-y': `${dy.toFixed(2)}px`, duration: 0.4, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => {
      // power3.out, NOT elastic. The spec's motion system forbids "Bounce.
      // Elastic." by name, and this had carried elastic.out(1, 0.6) since it
      // was written — the one place on the page that overshot.
      gsap.to(el, {
        '--mag-x': '0px', '--mag-y': '0px',
        duration: 0.5, ease: 'power3.out', overwrite: true,
      });
    });
  });
}
