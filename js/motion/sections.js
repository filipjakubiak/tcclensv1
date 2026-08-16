import { motionEnabled } from './reveal.js';

/**
 * Per-section motion for the two places that had none.
 *
 * Found by auditing every section for what actually moves rather than by
 * assuming the motion kit had reached everywhere: the surface kit only
 * touches [data-lift] cells and the reveal pass only touches [data-reveal]
 * copy, so a section built from neither was silently static.
 */

/**
 * The loyalty-gap meter draws to its value.
 *
 * It was a bar sitting at width:57% from first paint — the one element on the
 * page whose whole job is to show a quantity, arriving with that quantity
 * already stated. Drawing it makes the 57% a measurement the reader watches
 * being taken.
 *
 * scaleX on a transform, never width: animating width relayouts the bar's
 * containing block on every frame.
 */
export function initMeter() {
  if (!motionEnabled()) return;
  const fill = document.querySelector('.monitor__fill');
  if (!fill) return;

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  gsap.fromTo(
    fill,
    { '--fill': 0 },
    {
      '--fill': 1,
      duration: 1.6,
      ease: 'expo.out',
      // Matches the counters above it, so the number and the bar that
      // represents it arrive together rather than in two separate beats.
      scrollTrigger: { trigger: fill, start: 'top 92%', once: true },
    }
  );
}

/**
 * The offices list arrives as a list — one row at a time, each hairline
 * drawing before its city.
 *
 * Twenty offices is the section's whole claim, so the reader should feel the
 * list accumulate rather than find it already complete. Same rule-draw the
 * careers values use, which is what keeps this from being a new idea.
 */
export function initOffices() {
  if (!motionEnabled()) return;
  const rows = document.querySelectorAll('.global__offices li');
  if (!rows.length) return;

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  const tl = gsap.timeline({
    scrollTrigger: { trigger: rows[0], start: 'top 88%', once: true },
  });

  // The hairline first, then the city on it — the rule reads as the line the
  // text lands on rather than as a divider that happens to share its timing.
  tl.to(rows, { '--rule-s': 1, duration: 0.5, ease: 'power2.out', stagger: 0.06 }, 0);
  tl.fromTo(
    rows,
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06 },
    0.08
  );
}
