import { motionEnabled } from './reveal.js';

/**
 * #careers — the one section the user named that had no motion of its own.
 *
 * Two moves, both extending the site's idea rather than adding a new one:
 *
 * 1. The photograph RESOLVES and then DRIFTS. The card's arrival is the
 *    surface kit's (it is a [data-lift] inside a [data-surface-group], just
 *    with a deeper start defined in CSS); what happens here is the slow
 *    scroll-scrubbed travel of the picture INSIDE its frame afterwards, so
 *    the frame stays put on the grid while the image breathes against it.
 * 2. The four values draw their rules in turn, so "built by people" reads as
 *    four named behaviours arriving one at a time instead of a block of copy
 *    fading up.
 *
 * The drift is deliberately on the inner <img> and the entrance on the outer
 * card: they are different elements, so neither can overwrite the other's
 * transform. That is the same rule the surface kit follows for entrance vs
 * tilt, arrived at the hard way.
 */
export function initCareers() {
  if (!motionEnabled()) return;
  const section = document.getElementById('careers');
  if (!section) return;

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  const img = section.querySelector('.careers__img img');
  if (img) {
    // ±5% of the image's own height. The CSS gives it 7% of slack at each
    // end, so the frame cannot run past the picture's edge — the failure
    // mode here is a sliver of card background appearing along one edge,
    // and it is asserted against rather than eyeballed.
    gsap.fromTo(
      img,
      { yPercent: -5 },
      {
        yPercent: 5,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      }
    );
  }

  const values = section.querySelectorAll('.careers__values .value');
  if (values.length) {
    // Animates a custom property that CSS turns into scaleX on the ::before
    // rule — a pseudo-element cannot be a GSAP target, and scaling beats
    // animating width because it never touches layout.
    gsap.to(values, {
      '--rule-s': 1,
      duration: 0.7,
      ease: 'expo.out',
      stagger: 0.12,
      scrollTrigger: { trigger: values[0], start: 'top 88%', once: true },
    });
  }
}
