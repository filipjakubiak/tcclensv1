export function motionEnabled() {
  const shot = new URLSearchParams(location.search).get('shot') === '1';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !shot && !reduced;
}

export function initLenis() {
  if (!motionEnabled()) return null;
  const lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  lenis.on('scroll', window.ScrollTrigger.update);
  return lenis;
}

export function initReveals() {
  if (!motionEnabled()) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('motion-on');

  // The signature: text arrives out of focus and resolves sharp. Lines
  // reveal in the same timeline, so one ScrollTrigger drives both
  // (RULING 2 — the brief's two-pass forEach created a duplicate trigger).
  gsap.utils.toArray('[data-focus-pull]').forEach((el) => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
    tl.to(el, {
      opacity: 1, filter: 'blur(0px)', scale: 1,
      duration: 0.9, ease: 'expo.out',
    }, 0);
    const lines = el.querySelectorAll('.line > span');
    if (lines.length) {
      tl.to(lines, {
        y: '0%', duration: 0.9, ease: 'expo.out', stagger: 0.06,
      }, 0);
    }
  });

  // Body copy — quieter register (RULING 1): short rise and fade, no blur,
  // staggered within each section.
  const groups = new Map();
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    const section = el.closest('section') || document.body;
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(el);
  });
  groups.forEach((els) => {
    gsap.to(els, {
      y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.05,
      scrollTrigger: { trigger: els[0], start: 'top 90%', once: true },
    });
  });
}
