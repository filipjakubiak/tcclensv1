import { motionEnabled } from './reveal.js';

export function initCursor() {
  if (!motionEnabled()) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);

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

  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * MAX;
      const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * MAX;
      gsap.to(el, { x: dx, y: dy, duration: 0.4, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.6)', overwrite: true });
    });
  });
}
