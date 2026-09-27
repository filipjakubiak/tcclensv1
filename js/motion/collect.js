import { motionEnabled } from './reveal.js';

/**
 * #clients — the brand partners, dealt as collectibles.
 *
 * Collectible rewards are what TCC builds for these brands, so the brands
 * arrive the way a collectible does: the row is dealt face down (TCC's side
 * up) and turns over card by card as it reaches the reader. Under a fine
 * pointer each card then tilts toward the cursor with a foil glare —
 * springing after it, not glued to it — and settles flat when left.
 *
 * The flip is a class-driven CSS transition (reversible, staggered by
 * --i); scroll back above the row and it is dealt again.
 */
export function initCollect() {
  const row = document.querySelector('.collect');
  if (!row || !motionEnabled()) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.create({
    trigger: row, start: 'top 82%',
    onEnter: () => row.classList.add('is-dealt'),
    onLeaveBack: () => row.classList.remove('is-dealt'),
  });

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  row.querySelectorAll('.collectible__card').forEach((card) => {
    const S = { rx: 0, ry: 0 };
    const paint = () => {
      card.style.setProperty('--rx', `${S.rx.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${S.ry.toFixed(2)}deg`);
    };
    const qx = gsap.quickTo(S, 'rx', { duration: 0.4, ease: 'power3.out', onUpdate: paint });
    const qy = gsap.quickTo(S, 'ry', { duration: 0.4, ease: 'power3.out', onUpdate: paint });
    card.addEventListener('pointerenter', () => {
      if (row.classList.contains('is-dealt')) card.classList.add('is-tilting');
    });
    card.addEventListener('pointermove', (e) => {
      if (!card.classList.contains('is-tilting')) return;
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      qx(-ny * 14); qy(nx * 16);
      card.style.setProperty('--gx', `${((nx + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${((ny + 0.5) * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      qx(0); qy(0);
      // Hand the transform back to the flip transition once it has settled.
      setTimeout(() => card.classList.remove('is-tilting'), 420);
    });
  });
}
