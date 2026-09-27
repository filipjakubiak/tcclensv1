import { motionEnabled } from './reveal.js';

/**
 * The hero headline — light through a lens, in type.
 *
 * The page's whole idea is a lens: light enters scattered and comes into
 * focus. The headline now does that literally, then undoes it:
 *
 *   ASSEMBLE (on load)  every letter starts scattered in depth — thrown
 *       toward the viewer, tumbled, blurred, its colour split into the brand's
 *       two lights either side of it — and converges into place, centre
 *       letters first. The split closes as each letter lands, so the line
 *       literally focuses.
 *   SCAN  a bar of light crosses the settled headline once, and each letter
 *       flashes its split as the bar passes — the lens calibrating.
 *   DISPERSE (on scroll, scrubbed)  as the curtain parts, the letters leave
 *       through the lens again: centre letters first, each flying out on
 *       its own side of the split, toward the viewer, its colour separating
 *       as it goes. Scroll back up and it re-assembles.
 *
 * Each letter is two nested spans so the two motions never share a
 * transform: the inner one assembles, the outer one disperses. The split is
 * one text-shadow fed by both (--ax from the inner, --dx inherited from the
 * outer). The heading carries an aria-label with its own words, so assistive
 * tech reads a sentence, not letters.
 *
 * Motion off (reduced motion, ?shot=1): nothing is split; the headline sits
 * sharp and whole.
 */

// Deterministic scatter, so the choreography is the same on every visit.
const rnd = (i, s) => { const x = Math.sin(i * 91.7 + s * 47.3) * 43758.5453; return x - Math.floor(x); };

export function initHeroText() {
  const hero = document.getElementById('hero');
  const h1 = hero?.querySelector('.display');
  if (!h1 || !motionEnabled()) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // ---- split -------------------------------------------------------------
  const lines = [...h1.querySelectorAll('.line > span')];
  h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
  const chars = [];
  lines.forEach((line) => {
    const text = line.textContent;
    line.textContent = '';
    line.setAttribute('aria-hidden', 'true');
    for (const word of text.split(/(\s+)/)) {
      if (!word) continue;
      if (/^\s+$/.test(word)) { line.append(' '); continue; }
      const w = document.createElement('span');
      w.className = 'hw';
      for (const ch of word) {
        const outer = document.createElement('span');
        outer.className = 'hc';
        const inner = document.createElement('span');
        inner.className = 'hc__in';
        inner.textContent = ch;
        outer.append(inner);
        w.append(outer);
        chars.push({ outer, inner });
      }
      line.append(w);
    }
  });
  h1.classList.add('is-split');
  // The heading itself is no longer what arrives — its letters are.
  // initHeroIntro was built to rise these lines; the letters own the
  // arrival now, so its tweens on the heading and lines are retired.
  gsap.killTweensOf([h1, ...lines]);
  gsap.set(h1, { opacity: 1, filter: 'none', scale: 1 });
  gsap.set(lines, { y: '0%', x: 0 });

  // Each letter's distance from the headline's centre, for ordering.
  const measure = () => {
    const box = h1.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    chars.forEach((c) => {
      const r = c.outer.getBoundingClientRect();
      c.side = r.left + r.width / 2 < cx ? -1 : 1;
      c.dist = Math.abs(r.left + r.width / 2 - cx) / (box.width / 2);
    });
  };
  measure();

  // ---- assemble ---------------------------------------------------------------
  const tl = gsap.timeline({ delay: 0.25 });
  chars.forEach((c, i) => {
    const sx = (rnd(i, 1) - 0.5) * 2;
    tl.fromTo(c.inner, {
      x: (rnd(i, 2) - 0.5) * 520,
      y: (rnd(i, 3) - 0.5) * 360,
      z: 180 + rnd(i, 4) * 380,
      rotationX: (rnd(i, 5) - 0.5) * 140,
      rotationY: (rnd(i, 6) - 0.5) * 110,
      rotationZ: (rnd(i, 7) - 0.5) * 50,
      opacity: 0,
      filter: 'blur(14px)',
      '--ax': sx * 34,
      '--ay': (rnd(i, 8) - 0.5) * 16,
      '--sa': 1,
      transformPerspective: 900,
    }, {
      x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0,
      opacity: 1, filter: 'blur(0px)', '--ax': 0, '--ay': 0, '--sa': 0,
      duration: 2.1, ease: 'expo.out',
    }, 0.06 + c.dist * 0.6 + rnd(i, 9) * 0.14);
  });

  // ---- scan -----------------------------------------------------------------------
  const bar = document.createElement('span');
  bar.className = 'hero__scan';
  bar.setAttribute('aria-hidden', 'true');
  h1.append(bar);
  tl.addLabel('scan', '>-0.35');
  // The h1 is as wide as its container; the scan ends on the last letter.
  const textRight = () => {
    const h = h1.getBoundingClientRect().left;
    return Math.max(...chars.map((c) => c.outer.getBoundingClientRect().right)) - h + 12;
  };
  tl.fromTo(bar, { x: -24, left: 0, opacity: 0 }, {
    x: textRight, opacity: 1, duration: 1.1, ease: 'power2.inOut',
    onComplete: () => gsap.set(bar, { opacity: 0 }),
  }, 'scan');
  const byX = [...chars].sort((a, b) => a.outer.getBoundingClientRect().left - b.outer.getBoundingClientRect().left);
  byX.forEach((c, i) => {
    tl.to(c.inner, { '--ax': 5, '--ay': -1.5, '--sa': 0.9, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1 },
      `scan+=${0.15 + (i / byX.length) * 0.85}`);
  });
  tl.eventCallback('onComplete', () => {
    chars.forEach((c) => { c.inner.style.filter = ''; c.inner.style.willChange = 'auto'; });
    h1.dataset.assembled = '1'; // for tests, and anything that should wait for the landing
  });

  // ---- disperse (scrubbed with the curtain) ----------------------------------------------
  const scatter = gsap.timeline({
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 20%', scrub: 0.6, invalidateOnRefresh: true },
  });
  chars.forEach((c, i) => {
    // Centre letters leave first — the curtain parts from the centre.
    scatter.to(c.outer, {
      x: () => c.side * (80 + rnd(i, 11) * 360) * (0.6 + c.dist),
      y: () => (rnd(i, 12) - 0.35) * 260, // mostly outward and down — clear of the nav
      z: () => 120 + rnd(i, 13) * 420,
      rotationY: c.side * (20 + rnd(i, 14) * 60),
      rotationX: (rnd(i, 15) - 0.5) * 90,
      opacity: 0,
      '--dx': c.side * (14 + rnd(i, 16) * 26),
      '--ds': 1,
      transformPerspective: 900,
      ease: 'power2.in', duration: 1,
    }, (1 - c.dist) * 0.35);
  });
  // The lead and the buttons step back out of the way first.
  // fromTo, not to: a scrubbed .to() records its start value when first
  // rendered — during the intro, when these are still at opacity 0 — and
  // would then scroll them back to invisible.
  const out = (sel, y, d) => {
    const el = hero.querySelector(sel);
    if (el) scatter.fromTo(el, { y: 0, opacity: 1 }, { y, opacity: 0, ease: 'power1.in', duration: d, immediateRender: false }, 0);
  };
  out('.lead', -40, 0.6);
  out('.hero__ctas', -30, 0.5);
  out('.eyebrow', -20, 0.5);

  window.addEventListener('resize', () => { measure(); ScrollTrigger.refresh(); });
}
