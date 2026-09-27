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
