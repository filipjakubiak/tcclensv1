import { motionEnabled } from './reveal.js';

export function initCounters() {
  const nodes = document.querySelectorAll('[data-count-to]');
  const final = (el) => el.dataset.countTo + (el.dataset.suffix ?? '');

  if (!motionEnabled()) {
    nodes.forEach((el) => { el.textContent = final(el); });
    return;
  }

  const { gsap } = window;
  nodes.forEach((el) => {
    const target = Number(el.dataset.countTo);
    const suffix = el.dataset.suffix ?? '';
    const box = { v: 0 };
    gsap.to(box, {
      v: target, duration: 1.6, ease: 'expo.out',
      onUpdate: () => { el.textContent = Math.round(box.v) + suffix; },
      onComplete: () => { el.textContent = final(el); },
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}
