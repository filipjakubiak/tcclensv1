import { motionEnabled } from './reveal.js';

/**
 * The hero headline — kinetic type with a scan.
 *
 *   RISE (on load)  every letter rises through its line's mask, one after
 *       another, the second line picking up where the first ends. The words
 *       stay whole: nothing is thrown, tumbled or blurred.
 *   SCAN  a bar of light crosses the settled headline once, and each letter
 *       flashes the brand's two lights as the bar passes — the lens
 *       calibrating.
 *   DRIFT (on scroll, scrubbed)  as the curtain parts, the two lines slide
 *       apart — the first to the left, the second to the right — and fade.
 *       Scroll back up and they return.
 *
 * Each letter is two nested spans so the two motions never share a
 * transform: the outer one rises, the inner one carries the scan's colour
 * split (a text-shadow fed by --ax/--sa). The heading carries an aria-label
 * with its own words, so assistive tech reads a sentence, not letters.
 *
 * Motion off (reduced motion, ?shot=1): nothing is split; the headline sits
 * sharp and whole.
 */

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

  // ---- rise ------------------------------------------------------------------
  const tl = gsap.timeline({ delay: 0.25 });
  tl.fromTo(chars.map((c) => c.outer), { yPercent: 115 }, {
    yPercent: 0, duration: 1.05, ease: 'expo.out', stagger: 0.028,
  }, 0);

  // ---- scan -----------------------------------------------------------------------
  const bar = document.createElement('span');
  bar.className = 'hero__scan';
  bar.setAttribute('aria-hidden', 'true');
  h1.append(bar);
  tl.addLabel('scan', '>-0.45');
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
    h1.dataset.assembled = '1'; // for tests, and anything that should wait for the landing
  });

  // ---- drift (scrubbed with the curtain) ------------------------------------------
  const drift = gsap.timeline({
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 20%', scrub: 0.6, invalidateOnRefresh: true },
  });
  [...h1.querySelectorAll('.line')].forEach((row, i) => {
    drift.fromTo(row, { xPercent: 0, opacity: 1 }, {
      xPercent: i % 2 ? 14 : -14, opacity: 0, ease: 'power1.in', duration: 1, immediateRender: false,
    }, 0);
  });
  // The lead and the buttons step back out of the way first.
  // fromTo, not to: a scrubbed .to() records its start value when first
  // rendered — during the intro, when these are still at opacity 0 — and
  // would then scroll them back to invisible.
  const out = (sel, y, d) => {
    const el = hero.querySelector(sel);
    if (el) drift.fromTo(el, { y: 0, opacity: 1 }, { y, opacity: 0, ease: 'power1.in', duration: d, immediateRender: false }, 0);
  };
  out('.lead', -40, 0.6);
  out('.hero__ctas', -30, 0.5);
  out('.eyebrow', -20, 0.5);
}
