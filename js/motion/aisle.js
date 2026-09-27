import { motionEnabled } from './reveal.js';

/**
 * #what-we-do — two audiences, one craft.
 *
 * "We sit between the two." The two panels arrive closed together and part;
 * TCC is the seal on the seam between them, set where the photographs meet
 * the copy. Each side's promises then flow OUT of that seam — retail rows
 * travelling left, brand rows travelling right, row by row, both sides at
 * the same time. No wires: the seal is the connection.
 * (Replaced a spine-and-wires diagram the user found odd, 2026-09-27.)
 *
 * Scrubbed and reversible. Narrow screens stack the panels, so there is no
 * seam: the promises simply arrive as each panel reaches the middle.
 * Motion off: panels in place, seal set, every promise present.
 */
export function initAisle() {
  const grid = document.querySelector('.fork__grid');
  const seal = grid?.querySelector('.aisle');
  if (!grid || !seal) return;
  const left = grid.querySelector('.fork__panel--retail');
  const right = grid.querySelector('.fork__panel--brand');
  const rows = [
    ...[...left.querySelectorAll('.fork__points li')].map((li, i) => ({ li, side: -1, i })),
    ...[...right.querySelectorAll('.fork__points li')].map((li, i) => ({ li, side: 1, i })),
  ];

  // The seal sits on the seam where the photos end: measured, not guessed,
  // because the photo height follows the panel width.
  const place = () => {
    const img = left.querySelector('.fork__img');
    grid.style.setProperty('--seam-y', `${(img?.offsetHeight ?? 0).toFixed(1)}px`);
  };
  place();
  new ResizeObserver(place).observe(grid);

  if (!motionEnabled()) { rows.forEach((r) => r.li.classList.add('is-lit')); return; }

  const S = { p: 0 };
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
  const wide = () => window.matchMedia('(min-width: 861px)').matches;

  function render() {
    const p = S.p;
    // 1 · the panels part from the centre line.
    const part = smooth(p / 0.35);
    if (wide()) {
      const shift = 56 * (1 - part);
      left.style.transform = `translateX(${shift.toFixed(1)}px)`;
      right.style.transform = `translateX(${(-shift).toFixed(1)}px)`;
    } else {
      left.style.transform = right.style.transform = '';
    }
    left.style.opacity = right.style.opacity = (0.2 + 0.8 * smooth(p / 0.2)).toFixed(3);
    // 2 · the seal sets on the seam.
    seal.style.setProperty('--in', smooth((p - 0.25) / 0.15).toFixed(3));
    // 3 · promises flow out of the seam, row by row, both sides together.
    rows.forEach((r) => {
      const f = smooth((p - (0.42 + r.i * 0.12)) / 0.2);
      r.li.style.setProperty('--pt', f.toFixed(3));
      r.li.style.setProperty('--dir', r.side);
      r.li.classList.toggle('is-lit', f > 0.98);
    });
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  gsap.to(S, {
    p: 1, ease: 'none', onUpdate: render,
    scrollTrigger: { trigger: grid, start: 'top 85%', end: 'center 45%', scrub: 0.6 },
  });
  render();
}
