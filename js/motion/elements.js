import { motionEnabled } from './reveal.js';

/**
 * Element-level motion: the parts of the page that are not headlines.
 *
 * The page already had exactly two moves — the headline focus pull and a
 * fade-and-rise on everything else — so every card, cell and grid box
 * entered the same way and the page read as static between headlines.
 *
 * Everything here extends the site's one idea rather than adding new ones.
 * TCC is a lens, so surfaces RESOLVE: they arrive slightly out of focus and
 * off-plane, then settle. Nothing bounces, nothing spins in, nothing scales
 * from zero — the spec bans all three by name.
 */

const QUERY = '[data-lift]';

/**
 * Staggered entrance for grouped surfaces.
 *
 * Ordered by distance from the group's top-left rather than by DOM order, so
 * a bento mosaic resolves as a diagonal sweep across the layout instead of
 * jumping around wherever the markup happens to put a cell.
 */
export function initSurfaceReveals() {
  if (!motionEnabled()) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  document.querySelectorAll('[data-surface-group]').forEach((group) => {
    const cells = [...group.querySelectorAll(QUERY)];
    if (!cells.length) return;

    // `data-surface-group="scroll"` gives every cell its OWN trigger, so the
    // mosaic resolves progressively as you scroll down through it rather than
    // firing as one batch the moment the group's top edge arrives (user,
    // 2026-08-16, for the stat bento). A tall group is the case that needs
    // it: with a single group trigger, cells three rows down have already
    // finished animating before they are anywhere near the viewport.
    if (group.dataset.surfaceGroup === 'scroll') {
      for (const cell of cells) {
        gsap.to(cell, {
          opacity: 1,
          '--enter-y': '0px',
          '--enter-s': 1,
          filter: 'blur(0px)',
          duration: 0.85,
          ease: 'expo.out',
          scrollTrigger: { trigger: cell, start: 'top 88%', once: true },
        });
      }
      return;
    }

    const boxes = new Map(cells.map((el) => [el, el.getBoundingClientRect()]));
    const originX = Math.min(...cells.map((el) => boxes.get(el).left));
    const originY = Math.min(...cells.map((el) => boxes.get(el).top));
    const ordered = [...cells].sort((a, b) => {
      const d = (el) => {
        const r = boxes.get(el);
        // Weight rows harder than columns: reads as a sweep, not a diagonal.
        return (r.top - originY) * 1.6 + (r.left - originX);
      };
      return d(a) - d(b);
    });

    // Animates CSS CUSTOM PROPERTIES, not y/scale directly. The hover tilt
    // below also lives in transform, and two owners of one transform means
    // whichever wrote last wins. Composing both through variables inside a
    // single CSS transform removes the conflict instead of sequencing around it.
    gsap.to(ordered, {
      opacity: 1,
      '--enter-y': '0px',
      '--enter-s': 1,
      filter: 'blur(0px)',
      duration: 0.85,
      ease: 'expo.out',
      stagger: 0.07,
      scrollTrigger: { trigger: group, start: 'top 82%', once: true },
    });
  });
}

/**
 * Pointer response on surfaces: a light that follows the cursor, and a slight
 * tilt away from flat.
 *
 * The light is the point — this is a page about a lens, so a surface catching
 * a highlight as you pass over it is the same idea at a smaller scale. Both
 * are written to CSS custom properties and applied with transform/background
 * only, so nothing here touches layout.
 */
export function initSurfacePointer() {
  if (!motionEnabled()) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const MAX_TILT = 3.2; // degrees — any more and text starts to swim

  for (const el of document.querySelectorAll(QUERY)) {
    let raf = 0;
    let pending = null;

    const apply = () => {
      raf = 0;
      if (!pending) return;
      const { px, py } = pending;
      el.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(2)}%`);
      el.style.setProperty('--tilt-x', `${((0.5 - py) * MAX_TILT * 2).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${((px - 0.5) * MAX_TILT * 2).toFixed(2)}deg`);
    };

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      pending = { px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height };
      // One write per frame; pointermove fires far more often than that.
      if (!raf) raf = requestAnimationFrame(apply);
    });

    el.addEventListener('pointerenter', () => el.classList.add('is-hot'));

    el.addEventListener('pointerleave', () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      pending = null;
      el.classList.remove('is-hot');
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    });
  }
}

/**
 * A section-scale light that follows the pointer across a surface.
 *
 * The same idea as the card sheen above, at the scale of a whole section: the
 * closing CTA is the last thing on the page and the one asking for a click, so
 * its gradient moves under the cursor instead of sitting still.
 *
 * The colours are the section's OWN gradient stops, not a second gradient
 * introduced on top — the brand book forbids combining two, and this has to
 * read as the existing field reacting rather than as a new layer.
 *
 * The light drifts toward the pointer rather than snapping to it. A radial
 * gradient pinned exactly under the cursor reads as a spotlight glued to the
 * mouse; easing the centre toward the target is what makes it feel fluid.
 */
export function initFluidSurfaces() {
  if (!motionEnabled()) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  for (const el of document.querySelectorAll('[data-fluid]')) {
    // Current and target centre, in percent of the element's box.
    let cx = 50, cy = 45, tx = 50, ty = 45;
    let raf = 0;

    const step = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      el.style.setProperty('--fx', `${cx.toFixed(2)}%`);
      el.style.setProperty('--fy', `${cy.toFixed(2)}%`);
      // Stop the loop once it has effectively arrived, so an idle pointer
      // does not keep a rAF running for the life of the page.
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(step);
      else raf = 0;
    };

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) raf = requestAnimationFrame(step);
    });

    el.addEventListener('pointerenter', () => el.classList.add('is-fluid'));
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-fluid');
      // Drift back to centre rather than cutting, so leaving the section is
      // as smooth as entering it.
      tx = 50; ty = 45;
      if (!raf) raf = requestAnimationFrame(step);
    });
  }
}
