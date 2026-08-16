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
  // The hero headline is excluded: initHeroIntro owns it and runs on load.
  // Leaving it here too would give one element two timelines racing for the
  // same properties.
  // How far a heading's lines lean in, by the section's declared direction.
  // The body copy below already varies this way; matching it on the title
  // means a section arrives as one gesture rather than as two unrelated ones.
  const LEAN = { left: -22, right: 22, rise: 0, lift: 0, settle: 0 };

  gsap.utils.toArray('[data-focus-pull]').forEach((el) => {
    if (el.closest('#hero')) return;
    const section = el.closest('section');
    const lean = LEAN[section?.dataset.enter] ?? 0;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });

    // The eyebrow announces the section before the headline lands. It used to
    // be static while everything around it moved, which is what made the
    // titles feel like they simply appeared.
    const eyebrow = section?.querySelector('.eyebrow');
    // fromTo, not a CSS hidden state: eyebrows also live inside [data-lift]
    // cells that the surface kit owns, and a blanket `html.motion-on .eyebrow`
    // rule would hide those permanently since nothing here ever reveals them.
    // Same approach [data-reveal] already takes for body copy.
    if (eyebrow && !eyebrow.closest('[data-lift]')) {
      tl.fromTo(eyebrow, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0);
    }

    tl.to(el, {
      opacity: 1, filter: 'blur(0px)', scale: 1,
      duration: 1.0, ease: 'expo.out',
    }, 0.1);

    const lines = el.querySelectorAll('.line > span');
    if (lines.length) {
      // Stagger raised from 0.06 to 0.12: at the old value the lines of a
      // two-line headline overlapped so heavily that they read as one block
      // moving, which is the opposite of arriving in sequence.
      tl.fromTo(
        lines,
        { x: lean },
        { y: '0%', x: 0, duration: 1.0, ease: 'expo.out', stagger: 0.12 },
        0.1
      );
    }

    // REMOVED: a gradient sweep on the focal word.
    //
    // It animated background-size from 260% down to 100% so the gradient
    // appeared to resolve as the headline landed. gsap.fromTo applies its
    // START value immediately at init, not when the ScrollTrigger fires, so
    // every focal word below the fold sat at 260% — with only the accent end
    // of the ramp inside the glyphs. That is precisely the "just purple, no
    // gradient band" fault this was supposed to be clear of, reintroduced for
    // any word the reader had not scrolled to yet.
    //
    // Deferring it with immediateRender:false would only trade that for a
    // visible jump to 260% at trigger time. The requirement is that the word
    // is the button's gradient, exactly, at all times — so there is no sweep.
    // The headline still arrives with its own motion above.
  });

  // Body copy — quieter register (RULING 1): no blur, that belongs to
  // headlines alone.
  //
  // Each section declares HOW its copy arrives via data-enter. One entrance
  // repeated thirteen times reads as a template no matter how well tuned it
  // is; varying the direction section to section is what makes scrolling
  // feel authored. The variants stay in the same register — short travel,
  // one easing family, nothing bouncing or scaling from zero.
  const ENTRANCES = {
    rise:  { y: 26, x: 0, duration: 0.62, ease: 'power3.out', stagger: 0.05 },
    left:  { y: 0, x: -34, duration: 0.72, ease: 'expo.out', stagger: 0.07 },
    right: { y: 0, x: 34, duration: 0.72, ease: 'expo.out', stagger: 0.07 },
    lift:  { y: 44, x: 0, duration: 0.85, ease: 'expo.out', stagger: 0.09 },
    settle:{ y: -18, x: 0, duration: 0.7, ease: 'power2.out', stagger: 0.06 },
  };

  const groups = new Map();
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    const section = el.closest('section') || document.body;
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(el);
  });

  groups.forEach((els, section) => {
    const kind = section.dataset?.enter ?? 'rise';
    const e = ENTRANCES[kind] ?? ENTRANCES.rise;
    gsap.fromTo(
      els,
      { y: e.y, x: e.x, opacity: 0 },
      {
        y: 0, x: 0, opacity: 1,
        duration: e.duration, ease: e.ease, stagger: e.stagger,
        scrollTrigger: { trigger: els[0], start: 'top 90%', once: true },
      }
    );
  });
}

/**
 * The hero headline arrives on LOAD, not on scroll.
 *
 * Every other headline on the page is scroll-triggered, which is right for
 * them and wrong for this one: it is already in view when the page opens, so
 * a scroll trigger either fires instantly with no sense of arrival, or waits
 * for a scroll that has not happened. This runs once, on its own clock.
 */
export function initHeroIntro() {
  if (!motionEnabled()) return;
  const { gsap } = window;
  const hero = document.getElementById('hero');
  if (!hero) return;

  const tl = gsap.timeline({ delay: 0.15 });
  const lines = hero.querySelectorAll('.display .line > span');
  const heading = hero.querySelector('.display');

  tl.to(heading, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 1.1, ease: 'expo.out' }, 0);
  if (lines.length) {
    // Per-line stagger: the second line follows the first rather than the
    // two moving as one block.
    tl.to(lines, { y: '0%', duration: 1.1, ease: 'expo.out', stagger: 0.11 }, 0);
  }
  tl.to(hero.querySelector('.eyebrow'), { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.1);
  tl.to(hero.querySelector('.lead'), { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.8, ease: 'expo.out' }, 0.42);
  tl.to(hero.querySelectorAll('.hero__ctas .btn'), { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08 }, 0.58);
}
