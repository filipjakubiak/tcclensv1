import { motionEnabled } from './reveal.js';

/**
 * #capabilities — a showreel of what TCC builds.
 *
 * Each capability is a clip. As it scrolls up, its frame opens (scrubbed);
 * once it is on screen it PLAYS — its interface runs the product's own
 * story (a quest fills, a tier ring closes, a wheel spins and lands, a card
 * flips to its barcode, a goal fills). Scroll away and it resets, so
 * scrolling back plays it again: the section behaves like a reel, not a
 * page that animated once.
 *
 * The choreography lives in CSS transitions keyed to .is-on (interruptible,
 * off the main thread); this module only decides WHEN a clip plays, runs the
 * number tickers, and scrubs the cut.
 */

const fmt = new Intl.NumberFormat('en-GB');

export function initShowreel() {
  const clips = [...document.querySelectorAll('#capabilities .capability')];
  if (!clips.length || !motionEnabled()) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  clips.forEach((clip) => {
    const visual = clip.querySelector('.capability__visual');
    const ticks = [...clip.querySelectorAll('[data-tick]')].map((el) => ({
      el, to: Number(el.dataset.tick), from: Number(el.dataset.from ?? 0), tween: null,
    }));
    // Park the numbers at their start so a playing clip counts up to them.
    ticks.forEach((t) => { t.el.textContent = fmt.format(t.from); });

    const play = () => {
      clip.classList.add('is-on', 'is-playing');
      ticks.forEach((t) => {
        const box = { v: t.from };
        t.tween?.kill();
        t.tween = gsap.to(box, {
          v: t.to, duration: 1.6, delay: 0.5, ease: 'power3.out',
          onUpdate: () => { t.el.textContent = fmt.format(Math.round(box.v)); },
        });
      });
    };
    const stop = () => {
      clip.classList.remove('is-on', 'is-playing');
      ticks.forEach((t) => { t.tween?.kill(); t.el.textContent = fmt.format(t.from); });
    };

    ScrollTrigger.create({
      trigger: clip, start: 'top 72%', end: 'bottom 22%',
      onEnter: play, onEnterBack: play, onLeave: stop, onLeaveBack: stop,
    });

    // The cut: the frame opens from a smaller window as the clip rises.
    gsap.fromTo(visual, { '--cut': '7%' }, {
      '--cut': '0%', ease: 'none',
      scrollTrigger: { trigger: clip, start: 'top 98%', end: 'top 58%', scrub: 0.5 },
    });
  });
}
