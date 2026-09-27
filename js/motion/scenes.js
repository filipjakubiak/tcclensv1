import { motionEnabled } from './reveal.js';

/**
 * Scenes — the sections that stood still get a moment each, in the same
 * language as the rest of the reel (lens, light, the scroll as the clock):
 *
 *   band      the cut into the showreel: the five capabilities as huge
 *             type, two rows driven in opposite directions by the scroll
 *   film      the lens opens on the film — an iris widens as it rises,
 *             and the frame settles out of a slight zoom
 *   insights  each photo develops up its frame, one after another
 *   contact   the closing headline's lines converge from either side as
 *             you arrive — the last cut pulls everything to the centre
 *
 * All scrubbed pieces are reversible; one-shots play once. Under reduced
 * motion / ?shot=1 none of this runs and every element sits in place.
 */
export function initScenes() {
  if (!motionEnabled()) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // ---- band ------------------------------------------------------------
  const band = document.querySelector('.band');
  if (band) {
    const [a, b] = band.querySelectorAll('.band__row');
    const st = { trigger: band, start: 'top bottom', end: 'bottom top', scrub: 0.4 };
    gsap.fromTo(a, { xPercent: 0 }, { xPercent: -22, ease: 'none', scrollTrigger: st });
    gsap.fromTo(b, { xPercent: -30 }, { xPercent: -8, ease: 'none', scrollTrigger: { ...st } });
  }

  // ---- film --------------------------------------------------------------
  const frame = document.querySelector('.film__frame');
  if (frame) {
    const img = frame.querySelector('img');
    const st = { trigger: frame, start: 'top 95%', end: 'center 55%', scrub: 0.5 };
    gsap.fromTo(frame, { '--iris': '16%' }, { '--iris': '75%', ease: 'none', scrollTrigger: st });
    if (img) gsap.fromTo(img, { scale: 1.22 }, { scale: 1, ease: 'none', scrollTrigger: { ...st } });
  }

  // ---- insights ---------------------------------------------------------------
  const photos = gsap.utils.toArray('.insight__img');
  if (photos.length) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: photos[0], start: 'top 85%', once: true } });
    photos.forEach((p, i) => {
      const img = p.querySelector('img');
      tl.fromTo(p, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out' }, i * 0.14);
      if (img) tl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 1.4, ease: 'expo.out', clearProps: 'transform' }, i * 0.14);
    });
  }

  // ---- contact ---------------------------------------------------------------
  const lines = gsap.utils.toArray('#contact .heading .line');
  lines.forEach((line, i) => {
    gsap.fromTo(line, { xPercent: i % 2 ? 14 : -14 }, {
      xPercent: 0, ease: 'none',
      scrollTrigger: { trigger: '#contact', start: 'top bottom', end: 'top 35%', scrub: 0.5 },
    });
  });
}
